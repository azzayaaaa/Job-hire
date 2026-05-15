import { prisma } from "@/lib/prisma";
import { error, json, readJson } from "../../_lib/response";
import { deterministicMatch, normalizeJobForClient } from "../../_lib/jobs";
import { entitlementPayload, expireElapsedSubscriptions } from "../../_lib/users";

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const [a, b, c] = path;

  if (a === "all") {
    const jobs = await prisma.job.findMany({
      where: { status: "ACTIVE" },
      include: {
        employer: { select: { id: true, email: true, fullName: true, phone: true, logo: true } },
        applications: { include: { candidate: { select: { id: true, email: true, fullName: true, phone: true, image: true, cvFileName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return json(jobs.map(normalizeJobForClient));
  }
  if (a === "employer" && b) {
    const jobs = await prisma.job.findMany({
      where: { employerId: Number(b), status: { not: "DELETED" } },
      include: { employer: { select: { id: true, email: true, fullName: true, phone: true, logo: true } }, applications: true },
      orderBy: { createdAt: "desc" },
    });
    return json(jobs.map(normalizeJobForClient));
  }
  if (a === "filters" && b === "stats") {
    const [categories, locations, totalJobs] = await Promise.all([
      prisma.job.groupBy({ by: ["category"], where: { status: "ACTIVE" }, _count: { category: true } }),
      prisma.job.groupBy({ by: ["location"], where: { status: "ACTIVE" }, _count: { location: true } }),
      prisma.job.count({ where: { status: "ACTIVE" } }),
    ]);
    return json({ totalJobs, categories, locations });
  }
  if (a === "stats" && b === "employer" && c) {
    const employerId = Number(c);
    const [activeJobs, applications] = await Promise.all([
      prisma.job.count({ where: { employerId, status: "ACTIVE" } }),
      prisma.jobApplication.count({ where: { job: { employerId } } }),
    ]);
    return json({ activeJobs, applications, views: 0 });
  }
  if (a === "stats" && b === "candidate" && c) {
    const candidateId = Number(c);
    const [applied, saved] = await Promise.all([
      prisma.jobApplication.count({ where: { candidateId } }),
      prisma.savedJob.count({ where: { candidateId } }),
    ]);
    return json({ applied, saved });
  }
  if (a === "saved" && b === "count" && c) {
    const count = await prisma.savedJob.count({ where: { candidateId: Number(c) } });
    return json({ count });
  }
  if (a === "applied" && b === "count" && c) {
    const count = await prisma.jobApplication.count({ where: { candidateId: Number(c) } });
    return json({ count });
  }
  if (a === "saved" && b) {
    const saved = await prisma.savedJob.findMany({
      where: { candidateId: Number(b) },
      include: { job: { include: { employer: { select: { id: true, email: true, fullName: true, logo: true } }, applications: true } } },
      orderBy: { createdAt: "desc" },
    });
    return json(saved.map((item) => ({ ...item, job: normalizeJobForClient({ ...item.job, isSaved: true }) })));
  }
  if (a && b === "applications") {
    const applications = await prisma.jobApplication.findMany({
      where: { jobId: Number(a) },
      include: { candidate: { select: { id: true, email: true, fullName: true, phone: true, image: true, cvText: true, cvFileName: true, skills: true } } },
      orderBy: { createdAt: "desc" },
    });
    return json(applications);
  }
  if (a && b === "share-link") {
    const job = await prisma.job.findUnique({ where: { id: Number(a) }, select: { id: true, title: true } });
    if (!job) return error("Job not found", 404);
    const shareLink = `${new URL(request.url).origin}/dashboard/candidate?job=${job.id}`;
    return json({ success: true, jobId: job.id, jobTitle: job.title, shareLink, shareMessage: `${job.title} - ${shareLink}` });
  }
  if (a) {
    const job = await prisma.job.findUnique({
      where: { id: Number(a) },
      include: { employer: { select: { id: true, email: true, fullName: true, phone: true, logo: true } }, applications: true },
    });
    if (!job) return error("Job not found", 404);
    return json(normalizeJobForClient(job));
  }

  return error(`Unknown jobs route: ${path.join("/")}`, 404);
}

export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const [a, b, c] = path;
  const body = await readJson(request);

  if (a === "create") {
    await expireElapsedSubscriptions();
    const employerId = Number(body?.employerId);
    if (!Number.isInteger(employerId)) return error("Invalid employerId", 400);
    const employer = await prisma.user.findUnique({ where: { id: employerId } });
    if (!employer) return error("Employer not found", 404);
    if (employer && !entitlementPayload(employer).proActive) {
      const count = await prisma.job.count({ where: { employerId, status: { not: "DELETED" } } });
      if (count >= 2) return json({ error: "Free plan employer job limit reached", code: "FREE_EMPLOYER_JOB_LIMIT_REACHED" }, 402);
    }
    const job = await prisma.job.create({
      data: {
        title: String(body?.title || ""),
        description: String(body?.description || ""),
        requirements: `[EXPERIENCE:${body?.experience || "1-3"}]\n${body?.requirements || ""}`,
        location: String(body?.location || ""),
        salary: body?.salary ? String(body.salary) : null,
        category: String(body?.category || "IT"),
        jobType: String(body?.jobType || "FULL_TIME"),
        employerId,
        image: body?.image ? String(body.image) : null,
      },
    });
    return json(normalizeJobForClient(job), 201);
  }
  if (a === "apply" || a === "apply-with-auto-cv") {
    const jobId = Number(body?.jobId);
    const candidateId = Number(body?.candidateId);
    if (!Number.isInteger(jobId) || !Number.isInteger(candidateId)) return error("Invalid jobId or candidateId", 400);
    const [job, candidate] = await Promise.all([
      prisma.job.findUnique({ where: { id: jobId }, include: { employer: { select: { id: true, email: true, emailNotifications: true } } } }),
      prisma.user.findUnique({ where: { id: candidateId }, select: { id: true, fullName: true, email: true, cvText: true, cvFileName: true } }),
    ]);
    if (!job || job.status === "DELETED") return error("Job not found", 404);
    if (!candidate) return error("Candidate not found", 404);
    const application = await prisma.jobApplication.upsert({
      where: { jobId_candidateId: { jobId, candidateId } },
      update: {
        feedback: a === "apply-with-auto-cv" ? "CV auto-uploaded from saved profile" : body?.cvFileName || candidate.cvFileName || null,
      },
      create: {
        jobId,
        candidateId,
        matchScore: 0,
        feedback: a === "apply-with-auto-cv" ? "CV auto-uploaded from saved profile" : body?.cvFileName || candidate.cvFileName || null,
      },
      include: { candidate: { select: { id: true, email: true, fullName: true, phone: true, image: true, cvText: true, cvFileName: true, skills: true } }, job: true },
    });
    await prisma.notification
      .create({
        data: {
          senderId: candidateId,
          receiverId: job.employerId,
          type: "JOB_APPLICATION",
          title: "New job application",
          message: `${candidate.fullName || candidate.email} applied for ${job.title}.`,
          link: "/dashboard/employer?tab=candidates",
        },
      })
      .catch(() => null);
    return json({ success: true, application }, 201);
  }
  if (a === "submit-cv") {
    return json({ success: true, message: "CV submitted" });
  }
  if (a === "applications" && b && c === "status") {
    const application = await prisma.jobApplication.update({
      where: { id: Number(b) },
      data: { status: String(body?.status || "PENDING").toUpperCase() },
      include: { candidate: { select: { id: true, email: true, fullName: true, phone: true, image: true } }, job: true },
    });
    if (application.status === "APPROVED" || application.status === "REJECTED") {
      await prisma.notification
        .create({
          data: {
            senderId: application.job.employerId,
            receiverId: application.candidateId,
            type: "APPLICATION_STATUS",
            title: application.status === "APPROVED" ? "Application approved" : "Application rejected",
            message: `Your application for ${application.job.title} was ${application.status.toLowerCase()}.`,
            link: application.status === "APPROVED" ? "/dashboard/candidate?tab=messages" : "/dashboard/candidate?tab=applied",
          },
        })
        .catch(() => null);
    }
    return json({ success: true, application });
  }
  if (a === "save") {
    const saved = await prisma.savedJob.upsert({
      where: { jobId_candidateId: { jobId: Number(body?.jobId), candidateId: Number(body?.candidateId) } },
      update: {},
      create: { jobId: Number(body?.jobId), candidateId: Number(body?.candidateId) },
    });
    return json({ success: true, saved });
  }
  if (a === "recommendations" && b === "for-candidate") {
    const candidate = await prisma.user.findUnique({ where: { id: Number(body?.candidateId) } });
    const jobs = await prisma.job.findMany({ where: { status: "ACTIVE" }, include: { employer: { select: { id: true, email: true, fullName: true, logo: true } } }, take: 20 });
    const recommendations = jobs
      .map((job) => ({ ...normalizeJobForClient(job), ...deterministicMatch(job, candidate) }))
      .sort((x, y) => y.matchScore - x.matchScore)
      .slice(0, 10);
    return json({ success: true, recommendations });
  }
  if (a === "recommendations" && b === "candidates-for-job") {
    const job = body?.jobId ? await prisma.job.findUnique({ where: { id: Number(body.jobId) } }) : body;
    const candidates = await prisma.user.findMany({ where: { userType: "CANDIDATE", cvText: { not: null } }, select: { id: true, email: true, fullName: true, phone: true, cvText: true, cvFileName: true, skills: true }, take: 30 });
    const recommendations = candidates
      .map((candidate) => ({ ...candidate, ...deterministicMatch(job, candidate) }))
      .filter((candidate) => candidate.matchScore >= 10)
      .sort((x, y) => y.matchScore - x.matchScore)
      .slice(0, 10);
    return json({ success: true, recommendations });
  }

  return error(`Unknown jobs route: ${path.join("/")}`, 404);
}

export async function PUT(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const body = await readJson(request);
  const job = await prisma.job.update({
    where: { id: Number(path[0]) },
    data: {
      title: String(body?.title || ""),
      description: String(body?.description || ""),
      requirements: `[EXPERIENCE:${body?.experience || "1-3"}]\n${body?.requirements || ""}`,
      location: String(body?.location || ""),
      salary: body?.salary ? String(body.salary) : null,
      category: String(body?.category || "IT"),
      jobType: String(body?.jobType || "FULL_TIME"),
      image: body?.image ? String(body.image) : null,
    },
  });
  return json(normalizeJobForClient(job));
}

export async function PATCH(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const body = await readJson(request);
  if (path[1] === "status") {
    const job = await prisma.job.update({ where: { id: Number(path[0]) }, data: { status: String(body?.status || "ACTIVE").toUpperCase() } });
    return json({ success: true, job: normalizeJobForClient(job) });
  }
  if (path[0] === "applications" && path[2] === "match-score") {
    const application = await prisma.jobApplication.update({ where: { id: Number(path[1]) }, data: { matchScore: Number(body?.matchScore || 0) } });
    return json({ success: true, application });
  }
  return error(`Unknown jobs route: ${path.join("/")}`, 404);
}

export async function DELETE(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  if (path[0] === "unsave" && path[1] && path[2]) {
    await prisma.savedJob.deleteMany({ where: { jobId: Number(path[1]), candidateId: Number(path[2]) } });
    return json({ success: true });
  }
  const job = await prisma.job.update({ where: { id: Number(path[0]) }, data: { status: "DELETED" } });
  return json({ success: true, job });
}
