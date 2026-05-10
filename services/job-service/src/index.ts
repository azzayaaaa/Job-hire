import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import hpp from 'hpp';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import Queue from 'bull';

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const NOTIFY_SERVICE_URL = 'http://127.0.0.1:5006/api/notify';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://127.0.0.1:5005/api/users';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5005/api/notifications';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function emailTemplate(title: string, body: string, ctaLabel: string, ctaUrl: string) {
  return `
    <div style="margin:0;padding:28px;background:#f4f7fb;font-family:Arial,sans-serif;color:#111827">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#111827,#1d4ed8);color:#fff">
          <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.75">JobHub мэдэгдэл</div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:28px">
          <div style="font-size:15px;line-height:1.7;color:#374151">${body}</div>
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;font-weight:800;border-radius:12px;padding:13px 18px">
            ${escapeHtml(ctaLabel)}
          </a>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af">Имэйл мэдэгдлээ тохиргооноос унтрааж болно. Платформын хонхон дээрх мэдэгдэл үргэлж хадгалагдана.</p>
        </div>
      </div>
    </div>
  `;
}

async function getEmailPreference(userId: number) {
  try {
    const res = await axios.get(`${USER_SERVICE_URL}/profile/${userId}`);
    return res.data?.emailNotifications !== false;
  } catch (error: any) {
    console.error(`[Job Service] Could not fetch email preference for user ${userId}:`, error.message);
    return true;
  }
}

async function sendEmailIfAllowed(userId: number, to: string, subject: string, html: string) {
  const allowed = await getEmailPreference(userId);
  if (!allowed) return;
  await axios.post(`${NOTIFY_SERVICE_URL}/send-email`, { to, subject, html });
}

async function createInAppNotification(data: {
  senderId: number;
  receiverId: number;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  try {
    await axios.post(NOTIFICATION_SERVICE_URL, data);
  } catch (error: any) {
    console.error('[Job Service] In-app notification failed:', error.message);
  }
}

// Redis Queue Setup
const notificationQueue = new Queue('job-notifications', {
  redis: { port: 6379, host: '127.0.0.1' }
});

// Security Middleware
app.use(helmet());
app.use(hpp());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Хэт их хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу." },
  standardHeaders: true,
  legacyHeaders: false,
});

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    // If no Origin header (server-to-server), allow default.
    // Otherwise, reflect the request origin to avoid "192.168.x" vs "localhost" mismatches.
    callback(null, origin ?? 'http://localhost:3000');
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const statsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Client polls ~every 5s => 180 calls/15min. Allow some headroom.
  max: 300,
  message: { error: "Хэт их хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу." },
  standardHeaders: true,
  legacyHeaders: false,
});

const EXPERIENCE_MARKER = /^\[EXPERIENCE:([^\]]+)\]\s*/;

function normalizeJobForClient(job: any) {
  const requirements = typeof job.requirements === 'string' ? job.requirements : '';
  const experienceMatch = requirements.match(EXPERIENCE_MARKER);
  const cleanRequirements = requirements.replace(EXPERIENCE_MARKER, '').trim();

  return {
    ...job,
    type: job.jobType,
    experience: experienceMatch?.[1] || job.experience || '',
    requirements: cleanRequirements,
  };
}

// Apply limiter only to high-volume "jobs/all" and writes (not for stats polling)
app.get('/api/jobs/all', limiter, async (req, res) => {
  console.log('[Job Service] GET /api/jobs/all - Fetching all active jobs');
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    const employerIds = [...new Set(jobs.map((job) => job.employerId))];
    const jobIds = jobs.map((job) => job.id);

    const [employers, applications] = await Promise.all([
      employerIds.length
        ? prisma.user.findMany({
            where: { id: { in: employerIds } },
            select: { id: true, email: true, fullName: true, phone: true, logo: true }
          })
        : Promise.resolve([]),
      jobIds.length
        ? prisma.jobApplication.findMany({
            where: { jobId: { in: jobIds } },
            select: {
              id: true,
              jobId: true,
              candidateId: true,
              status: true,
              matchScore: true,
              feedback: true,
              createdAt: true
            }
          })
        : Promise.resolve([])
    ]);

    const candidateIds = [...new Set(applications.map(app => app.candidateId))];
    const candidates = candidateIds.length 
      ? await prisma.user.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, email: true, fullName: true, phone: true, image: true, cvText: true, cvFileName: true }
        })
      : [];

    console.log(`[Job Service] Fetched ${candidates.length} unique candidates`);
    candidates.forEach((c, idx) => {
      console.log(`[Job Service] Candidate ${idx + 1}: ${c.email}`, {
        id: c.id,
        hasCVText: !!c.cvText,
        cvTextLength: c.cvText?.length || 0,
        cvFileName: c.cvFileName || "(none)",
      });
    });

    const employerMap = new Map(employers.map((employer) => [employer.id, employer]));
    const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const applicationsByJobId = new Map<number, any[]>();

    for (const application of applications) {
      const existing = applicationsByJobId.get(application.jobId) || [];
      existing.push({
        ...application,
        candidate: candidateMap.get(application.candidateId) || null
      });
      applicationsByJobId.set(application.jobId, existing);
    }

    const safeJobs = jobs.map((job) => ({
      ...normalizeJobForClient(job),
      employer: employerMap.get(job.employerId) || null,
      applications: applicationsByJobId.get(job.id) || []
    }));

    // Log sample of returned data
    if (safeJobs.length > 0 && safeJobs[0].applications.length > 0) {
      const firstApp = safeJobs[0].applications[0];
      console.log(`[Job Service] Sample response - First job, first application:`, {
        jobId: safeJobs[0].id,
        candidateName: firstApp.candidate?.fullName,
        candidateEmail: firstApp.candidate?.email,
        hasCVText: !!firstApp.candidate?.cvText,
        cvFileName: firstApp.candidate?.cvFileName
      });
    }

    console.log(`[Job Service] Successfully fetched ${safeJobs.length} jobs with ${applications.length} total applications`);
    res.json(safeJobs);
  } catch (error) {
    console.error('[Job Service] Error fetching jobs:', error);
    res.status(500).json({ error: "Алдаа гарлаа" });
  }
});

app.post('/api/jobs/create', async (req, res) => {
  const { title, description, requirements, location, salary, category, jobType, employerId, experience, image } = req.body;
  console.log(`[Job Service] POST /api/jobs/create - Employer ${employerId} is creating job: ${title}`);
  try {
    const experienceMarker = `[EXPERIENCE:${experience || '1-3'}]`;
    const job = await prisma.job.create({
      data: {
        title,
        description,
        requirements: `${experienceMarker}\n${requirements}`,
        location,
        salary,
        category,
        jobType: jobType || "FULL_TIME",
        employerId: Number(employerId),
        image: image || null
      }
    });

    console.log(`[Job Service] 200 OK - Job created successfully with ID: ${job.id}`);

    const [matchingUsers, employer] = await Promise.all([
      prisma.user.findMany({
        where: { userType: 'CANDIDATE' },
        select: { id: true, email: true, fullName: true }
      }),
      prisma.user.findUnique({
        where: { id: Number(employerId) },
        select: { id: true, fullName: true, email: true }
      })
    ]);

    const jobLink = `http://localhost:3000/dashboard/candidate?job=${job.id}`;
    const notifications = matchingUsers.map(async (user) => {
      await createInAppNotification({
        senderId: Number(employerId),
        receiverId: user.id,
        type: 'JOB_OFFER',
        title: 'Шинэ ажлын зар нэмэгдлээ',
        message: `${employer?.fullName || employer?.email || 'Ажил олгогч'} "${title}" ажлын зарыг нийтэллээ. Дээр дарж дэлгэрэнгүй харна уу.`,
        link: jobLink,
      });

      await sendEmailIfAllowed(
        user.id,
        user.email,
        `Шинэ ажлын зар: ${title}`,
        emailTemplate(
          'Шинэ ажлын зар нэмэгдлээ',
          `<p>Сайн байна уу?</p><p><b>${escapeHtml(employer?.fullName || employer?.email || 'Ажил олгогч')}</b> шинэ ажлын зар нийтэллээ.</p><p><b>${escapeHtml(title)}</b><br/>Байршил: ${escapeHtml(location)}</p>`,
          'Дэлгэрэнгүй харах',
          jobLink,
        ),
      );
    });

    Promise.allSettled(notifications);

    res.status(201).json(job);
  } catch (error) {
    console.error('[Job Service] Error creating job:', error);
    res.status(500).json({ error: "Ажил хадгалах үед алдаа гарлаа" });
  }
});
app.post('/api/jobs/apply', async (req, res) => {
  const { jobId, candidateId } = req.body;
  console.log(`[Job Service] POST /api/jobs/apply - Candidate ${candidateId} applying for job ${jobId}`);

  const parsedJobId = Number(jobId);
  const parsedCandidateId = Number(candidateId);

  if (isNaN(parsedJobId) || isNaN(parsedCandidateId)) {
    return res.status(400).json({ error: 'Invalid jobId or candidateId.' });
  }

  try {
    const job = await prisma.job.findUnique({ where: { id: parsedJobId } });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const application = await prisma.jobApplication.create({
      data: {
        jobId: parsedJobId,
        candidateId: parsedCandidateId,
        matchScore: null,
        feedback: "Хүсэлт амжилттай илгээгдлээ."
      }
    });

    try {
      const [employer, candidate] = await Promise.all([
        prisma.user.findUnique({ where: { id: job.employerId }, select: { id: true, email: true, fullName: true } }),
        prisma.user.findUnique({ where: { id: parsedCandidateId }, select: { id: true, email: true, fullName: true } })
      ]);

      if (employer && candidate) {
        const candidateName = candidate.fullName || candidate.email;
        const employerLink = 'http://localhost:3000/dashboard/employer?tab=candidates';
        await createInAppNotification({
          senderId: candidate.id,
          receiverId: employer.id,
          type: 'JOB_OFFER',
          title: 'Шинэ ажлын хүсэлт ирлээ',
          message: `Таны "${job.title}" зарт ${candidateName} хүсэлт явууллаа. Энэ дээр дарж дэлгэрэнгүй харна уу.`,
          link: employerLink,
        });

        await sendEmailIfAllowed(
          employer.id,
          employer.email,
          `Шинэ хүсэлт: ${job.title}`,
          emailTemplate(
            'Шинэ ажлын хүсэлт ирлээ',
            `<p>Сайн байна уу?</p><p>Таны <b>${escapeHtml(job.title)}</b> зарт <b>${escapeHtml(candidateName)}</b> хүсэлт явууллаа.</p><p>Кандидатын CV болон дэлгэрэнгүй мэдээллийг самбараасаа шалгана уу.</p>`,
            'Кандидатууд харах',
            employerLink,
          ),
        );
      }
    } catch (notifyErr: any) {
      console.error('[Job Service] Notification failed (Apply):', notifyErr.message);
    }

    console.log(`[Job Service] Application submitted and employer notified - 201 OK`);
    res.status(201).json({ success: true, application });
  } catch (error: any) {
    console.error('[Job Service] Error creating job application:', error);
    return res.status(500).json({ error: 'Failed to create job application.', details: error.message });
  }
});
// Submit CV to Employer
app.post('/api/jobs/submit-cv', async (req, res) => {
  const { jobId, candidateId, cvData, cvName, employerId } = req.body;
  console.log(`[Job Service] POST /api/jobs/submit-cv - Candidate ${candidateId} submitting CV for job ${jobId}`);

  const parsedJobId = Number(jobId);
  const parsedCandidateId = Number(candidateId);
  const parsedEmployerId = Number(employerId);

  if (isNaN(parsedJobId) || isNaN(parsedCandidateId)) {
    return res.status(400).json({ error: 'Invalid jobId or candidateId.' });
  }

  try {
    const job = await prisma.job.findUnique({ where: { id: parsedJobId } });
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Store CV submission in the system
    const cvSubmission = await prisma.jobApplication.create({
      data: {
        jobId: parsedJobId,
        candidateId: parsedCandidateId,
        matchScore: 0, // Will be calculated by employer/AI
        feedback: "CV submitted directly by candidate",
        // Store CV data as JSON if available
        cvData: cvData || null
      }
    });

    // Notify Employer about CV submission
    try {
      const employer = await prisma.user.findUnique({ where: { id: job.employerId } });
      const candidate = await prisma.user.findUnique({ where: { id: parsedCandidateId } });
      
      if (employer) {
        await axios.post(`${NOTIFY_SERVICE_URL}/send-email`, {
          to: employer.email,
          subject: `CV хүлээлээ: ${job.title}`,
          html: `<h3>Сайн байна уу?</h3><p><b>${candidate?.fullName || candidate?.email}</b> хүн таны <b>${job.title}</b> зарт CV илгээлээ.</p><p>CV: ${cvName}</p><a href="http://localhost:3000/dashboard/employer">Үзэх</a>`
        });
      }
    } catch (notifyErr: any) {
      console.error('[Job Service] Notification failed (Submit CV):', notifyErr.message);
    }

    console.log(`[Job Service] CV submitted and employer notified - 201 OK`);
    res.status(201).json({ success: true, submission: cvSubmission });
  } catch (error: any) {
    console.error('[Job Service] Error submitting CV:', error);
    return res.status(500).json({ error: 'Failed to submit CV.', details: error.message });
  }
});

// Update application status (approve/reject/review)
app.post('/api/jobs/applications/:applicationId/status', async (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;
  const parsedApplicationId = Number(applicationId);
  const normalizedStatus = String(status || '').toUpperCase();
  const allowedStatuses = ['PENDING', 'REVIEWED', 'APPROVED', 'REJECTED'];

  if (isNaN(parsedApplicationId)) {
    return res.status(400).json({ error: 'Invalid application ID' });
  }

  if (!allowedStatuses.includes(normalizedStatus)) {
    return res.status(400).json({ error: 'Invalid application status' });
  }

  try {
    const application = await prisma.jobApplication.update({
      where: { id: parsedApplicationId },
      data: { status: normalizedStatus },
      include: {
        candidate: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            cvText: true,
            cvFileName: true,
            skills: true,
          }
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
          }
        }
      }
    });

    try {
      const employer = await prisma.user.findUnique({
        where: { id: application.job.employerId },
        select: { id: true, email: true, fullName: true }
      });

      if (employer && (normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED')) {
        const employerName = employer.fullName || employer.email || 'Ажил олгогч';
        const approved = normalizedStatus === 'APPROVED';
        const link = approved
          ? 'http://localhost:3000/dashboard/candidate?tab=messages'
          : 'http://localhost:3000/dashboard/candidate?tab=applied';
        const titleText = approved ? 'Таны хүсэлт зөвшөөрөгдлөө' : 'Таны хүсэлт татгалзагдлаа';
        const messageText = approved
          ? `Баяр хүргэе! Ажил олгогч ${employerName} таны "${application.job.title}" ажилд илгээсэн хүсэлтийг зөвшөөрлөө. Энд дарж чатлана уу.`
          : `Уучлаарай, таны хүсэлт явуулсан ${employerName} таны "${application.job.title}" ажилд илгээсэн хүсэлтийг татгалзлаа.`;

        await createInAppNotification({
          senderId: employer.id,
          receiverId: application.candidate.id,
          type: approved ? 'JOB_SELECTED' : 'JOB_REJECTED',
          title: titleText,
          message: messageText,
          link,
        });

        await sendEmailIfAllowed(
          application.candidate.id,
          application.candidate.email,
          titleText,
          emailTemplate(
            titleText,
            `<p>${escapeHtml(messageText)}</p>`,
            approved ? 'Чат руу очих' : 'Миний хүсэлтүүд',
            link,
          ),
        );
      }
    } catch (notifyErr: any) {
      console.error('[Job Service] Notification failed (Status):', notifyErr.message);
    }

    console.log(`[Job Service] Application ${parsedApplicationId} status updated to ${normalizedStatus}`);
    res.json({ success: true, application });
  } catch (error: any) {
    console.error('[Job Service] Error updating application status:', error);
    res.status(500).json({ error: 'Failed to update application status', details: error.message });
  }
});

// Stats for Employer
app.get('/api/jobs/stats/employer/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const totalJobs = await prisma.job.count({ where: { employerId: Number(id) } });
    const totalApplications = await prisma.jobApplication.count({
      where: {
        job: { employerId: Number(id) }
      }
    });
    res.json({ totalJobs, totalApplications, totalChats: 0 });
  } catch (error) {
    res.status(500).json({ error: "Статистик авахад алдаа гарлаа" });
  }
});

// Get Job Filter Statistics (Job Type, Location, Experience, Salary)
app.get('/api/jobs/filters/stats', async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'ACTIVE' },
      select: {
        jobType: true,
        location: true,
        salary: true,
        requirements: true
      }
    });

    // Count by Job Type
    const jobTypeStats = {
      FULL_TIME: jobs.filter(j => j.jobType === 'FULL_TIME').length,
      PART_TIME: jobs.filter(j => j.jobType === 'PART_TIME').length,
      REMOTE: jobs.filter(j => j.jobType === 'REMOTE').length,
      TEMPORARY: jobs.filter(j => j.jobType === 'TEMPORARY').length,
      INTERNSHIP: jobs.filter(j => j.jobType === 'INTERNSHIP').length,
    };

    // Count by Location
    const locationStats: Record<string, number> = {};
    const locations = [...new Set(jobs.map(j => j.location || 'Улаанбаатар'))];
    locations.forEach(loc => {
      locationStats[loc] = jobs.filter(j => (j.location || 'Улаанбаатар') === loc).length;
    });

    const getExperience = (requirements?: string | null) =>
      requirements?.match(EXPERIENCE_MARKER)?.[1] || '1-3';

    const experienceStats = {
      '0-1': jobs.filter(j => getExperience(j.requirements) === '0-1').length,
      '1-3': jobs.filter(j => getExperience(j.requirements) === '1-3').length,
      '3-5': jobs.filter(j => getExperience(j.requirements) === '3-5').length,
      '5+': jobs.filter(j => getExperience(j.requirements) === '5+').length,
    };

    // Count by Salary Range
    const salaryRanges = {
      'under_500k': jobs.filter(j => {
        const sal = Number(j.salary) || 0;
        return sal < 500000;
      }).length,
      '500k_1m': jobs.filter(j => {
        const sal = Number(j.salary) || 0;
        return sal >= 500000 && sal < 1000000;
      }).length,
      '1m_3m': jobs.filter(j => {
        const sal = Number(j.salary) || 0;
        return sal >= 1000000 && sal < 3000000;
      }).length,
      '3m_5m': jobs.filter(j => {
        const sal = Number(j.salary) || 0;
        return sal >= 3000000 && sal < 5000000;
      }).length,
      'over_5m': jobs.filter(j => {
        const sal = Number(j.salary) || 0;
        return sal >= 5000000;
      }).length,
    };

    res.json({
      jobType: jobTypeStats,
      location: locationStats,
      experience: experienceStats,
      salaryRanges,
      totalJobs: jobs.length
    });
  } catch (error: any) {
    console.error('[Job Service] Error fetching filter stats:', error);
    res.status(500).json({ error: "Фильтер статистик авахад алдаа гарлаа" });
  }
});

// Stats for Candidate
app.get('/api/jobs/stats/candidate/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const totalApplications = await prisma.jobApplication.count({ where: { candidateId: Number(id) } });
    res.json({ totalApplications });
  } catch (error) {
    res.status(500).json({ error: "Статистик авахад алдаа гарлаа" });
  }
});

// Get applications for a specific job (with candidate details)
app.get('/api/jobs/:jobId/applications', async (req, res) => {
  const { jobId } = req.params;
  console.log(`[Job Service] GET /api/jobs/${jobId}/applications - Fetching applications for job ${jobId}`);
  try {
    const jobIdNum = Number(jobId);
    if (isNaN(jobIdNum)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const applications = await prisma.jobApplication.findMany({
      where: { jobId: jobIdNum },
      include: {
        candidate: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            cvText: true,
            cvFileName: true,
            skills: true,
          }
        },
        job: {
          select: {
            id: true,
            title: true,
            location: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`[Job Service] Successfully fetched ${applications.length} applications for job ${jobId}`);
    res.json(applications);
  } catch (error: any) {
    console.error('[Job Service] Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications', details: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// SAVED JOBS ENDPOINTS (with user isolation)
// ──────────────────────────────────────────────────────────────

// Get saved jobs count for a candidate (ORM; no raw SQL)
app.get('/api/jobs/saved/count/:candidateId', async (req, res) => {
  const userId = Number(req.params.candidateId);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Invalid candidate ID' });
  }

  try {
    const count = await (prisma as any).savedJob.count({
      where: { candidateId: userId },
    });
    res.json({ count });
  } catch (error: any) {
    console.error('[Job Service] Error fetching saved count:', error);
    res.status(500).json({ error: 'Failed to fetch saved count', details: error?.message });
  }
});

// Get applied jobs count for a candidate (with user isolation)
app.get('/api/jobs/applied/count/:candidateId', async (req, res) => {
  const userId = Number(req.params.candidateId);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Invalid candidate ID' });
  }

  try {
    const count = await prisma.jobApplication.count({
      where: { candidateId: userId },
    });
    res.json({ count });
  } catch (error: any) {
    console.error('[Job Service] Error fetching applied count:', error);
    res.status(500).json({ error: 'Failed to fetch applied count', details: error?.message });
  }
});

// Get all saved jobs for a candidate (ORM; no raw SQL)
app.get('/api/jobs/saved/:candidateId', async (req, res) => {
  const userId = Number(req.params.candidateId);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Invalid candidate ID' });
  }

  try {
    const saved = await (prisma as any).savedJob.findMany({
      where: { candidateId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        jobId: true,
        candidateId: true,
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            requirements: true,
            location: true,
            salary: true,
            category: true,
            jobType: true,
            status: true,
            employerId: true,
            image: true,
            createdAt: true,
            updatedAt: true,
            employer: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                logo: true,
              },
            },
            applications: {
              where: { candidateId: userId },
              select: {
                id: true,
                jobId: true,
                candidateId: true,
                status: true,
                matchScore: true,
                feedback: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    // Shape to match your earlier frontend expectations: { id, jobId, candidateId, createdAt, job: {...} }
    const savedJobs = saved.map((s: any) => ({
      id: s.id,
      jobId: s.jobId,
      candidateId: s.candidateId,
      createdAt: s.createdAt,
      job: {
        ...s.job,
        isSaved: true,
        employer: s.job.employer ?? null,
        applications: s.job.applications ?? [],
      },
    }));

    res.json(savedJobs);
  } catch (error: any) {
    console.error('[Job Service] Error fetching saved jobs:', error);
    res.status(500).json({ error: 'Failed to fetch saved jobs', details: error?.message });
  }
});

// Save a job (ORM; idempotent)
app.post('/api/jobs/save', async (req, res) => {
  const jobIdNum = Number(req.body?.jobId);
  const candidateIdNum = Number(req.body?.candidateId);

  if (!Number.isInteger(jobIdNum) || !Number.isInteger(candidateIdNum)) {
    return res.status(400).json({ error: 'Invalid job or candidate ID' });
  }

  try {
    const job = await prisma.job.findUnique({ where: { id: jobIdNum } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Idempotency using unique composite @@unique([jobId, candidateId])
    // Prisma exposes it as: jobId_candidateId
    const existing = await (prisma as any).savedJob.findUnique({
      where: { jobId_candidateId: { jobId: jobIdNum, candidateId: candidateIdNum } },
      select: { id: true, createdAt: true, jobId: true, candidateId: true },
    });

    if (existing) {
      return res.status(200).json({ success: true, alreadySaved: true, saved: existing });
    }

    const saved = await (prisma as any).savedJob.create({
      data: { jobId: jobIdNum, candidateId: candidateIdNum },
      select: { id: true, createdAt: true, jobId: true, candidateId: true },
    });

    return res.status(201).json({ success: true, saved });
  } catch (error: any) {
    // Race condition fallback
    if (error?.code === 'P2002') {
      return res.status(200).json({ success: true, alreadySaved: true });
    }

    console.error('[Job Service] Error saving job:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    res.status(500).json({ error: 'Failed to save job', details: error?.message });
  }
});

// Unsave (delete) a saved job (ORM)
app.delete('/api/jobs/unsave/:jobId/:candidateId', async (req, res) => {
  const jobIdNum = Number(req.params.jobId);
  const candidateIdNum = Number(req.params.candidateId);

  if (!Number.isInteger(jobIdNum) || !Number.isInteger(candidateIdNum)) {
    return res.status(400).json({ error: 'Invalid job or candidate ID' });
  }

  try {
    const deleted = await (prisma as any).savedJob.deleteMany({
      where: { jobId: jobIdNum, candidateId: candidateIdNum },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Saved job not found' });
    }

    return res.json({ success: true, message: 'Job unsaved' });
  } catch (error: any) {
    console.error('[Job Service] Error unsaving job:', error);
    res.status(500).json({ error: 'Failed to unsave job', details: error?.message });
  }
});

const PORT = 5003;
app.listen(PORT, () => {
  console.log(`Job Service running on http://localhost:${PORT}`);
});
