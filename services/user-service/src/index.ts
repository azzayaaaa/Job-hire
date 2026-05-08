import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import hpp from 'hpp';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const app = express();

let prisma: any;

// Initialize Prisma with error handling
try {
  prisma = new PrismaClient();
  console.log('[User Service] Prisma Client initialized successfully');
} catch (error) {
  console.error('[User Service] Prisma Client initialization failed:', error);
  process.exit(1);
}

// Security Middleware
app.use(helmet());
app.use(hpp() as any);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const port = 5005;

// Health check
app.get('/', (req, res) => {
  res.send('User Service is running');
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// Create New User (Called by Auth Service)
app.post('/api/users/create', async (req, res) => {
  const { email, password, userType, credits, referralCode, referredBy } = req.body;
  
  try {
    const newUser = await prisma.user.create({
      data: {
        email,
        password,
        userType,
        credits: credits || 10,
        referralCode,
        referredBy
      }
    });
    console.log(`[User Service] New user created: ${email}`);
    res.status(201).json({ success: true, user: newUser });
  } catch (error: any) {
    console.error("[User Service] Create User Error:", error.message);
    res.status(500).json({ error: "Хэрэглэгч үүсгэхэд алдаа гарлаа" });
  }
});

// Get User by Email (Used by Auth Service for login + Google login)
app.get('/api/users/by-email/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { email: decodeURIComponent(email) },
      select: {
        id: true,
        email: true,
        password: true,
        userType: true,
        credits: true,
        referralCode: true,
        referredBy: true,
        cvText: true,
        cvFileName: true,
      }
    });

    if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    return res.status(200).json(user);
  } catch (error: any) {
    console.error("[User Service] by-email lookup error:", {
      email,
      message: error?.message,
      code: error?.code,
    });

    return res.status(500).json({
      error: "Имэйлээр хайхад алдаа гарлаа",
      details: error?.message || String(error),
    });
  }
});

// Get User by Referral Code (Used by Auth Service for invites)
app.get('/api/users/by-referral/:referralCode', async (req, res) => {
  const { referralCode } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { referralCode: decodeURIComponent(referralCode) },
      select: {
        id: true,
        email: true,
        userType: true,
        credits: true,
        referralCode: true,
      }
    });

    if (!user) return res.status(404).json({ error: "Урилгын код олдсонгүй" });
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: "Урилгын кодоор хайхад алдаа гарлаа" });
  }
});

app.post('/api/users/internal/set-verification-code', async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string | null };

  if (!email) return res.status(400).json({ error: "email шаардлагатай" });

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { verificationCode: code },
      select: { id: true, email: true, userType: true }
    });

    return res.status(200).json({ success: true, user });
  } catch (error: any) {
    console.error("[User Service] Set verification code error:", error.message);
    return res.status(500).json({ error: "Код хадгалахад алдаа гарлаа", details: error.message });
  }
});

app.post('/api/users/internal/reset-password', async (req, res) => {
  const { email, password, code } = req.body as { email?: string; password?: string; code?: string };

  if (!email || !password || !code) {
    return res.status(400).json({ error: "email, password, code шаардлагатай" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, verificationCode: true }
    });

    if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    if (user.verificationCode !== code) return res.status(400).json({ error: "Код буруу" });

    const updated = await prisma.user.update({
      where: { email },
      data: {
        password,
        verificationCode: null
      },
      select: { id: true, email: true, userType: true, credits: true }
    });

    return res.status(200).json({ success: true, user: updated });
  } catch (error: any) {
    console.error("[User Service] Reset password error:", error.message);
    return res.status(500).json({ error: "Нууц үг шинэчлэхэд алдаа гарлаа", details: error.message });
  }
});

// Update profile fields (Used by Auth Service for Google login + employer profile updates)
app.post('/api/users/update-profile', async (req, res) => {
  const { id, fullName, email, phone, website, location, description, logo, cvText, cvFileName } = req.body as { 
    id: number; 
    fullName?: string;
    email?: string;
    phone?: string;
    website?: string;
    location?: string;
    description?: string;
    logo?: string;
    cvText?: string;
    cvFileName?: string;
  };

  if (!id) return res.status(400).json({ error: "id шаардлагатай" });

  console.log(`[User Service] Update profile request for user ${id}:`, {
    hasCVText: !!cvText,
    cvTextLength: cvText?.length || 0,
    cvFileName: cvFileName || "(none)",
    fullName: fullName || "(none)",
    website: website || "(none)",
    location: location || "(none)",
  });

  try {
    const updateData: any = {};
    if (typeof fullName === 'string') updateData.fullName = fullName;
    if (typeof email === 'string') updateData.email = email;
    if (typeof phone === 'string') updateData.phone = phone;
    if (typeof website === 'string') updateData.website = website;
    if (typeof location === 'string') updateData.location = location;
    if (typeof description === 'string') updateData.description = description;
    if (typeof logo === 'string') updateData.logo = logo;
    if (typeof cvText === 'string') updateData.cvText = cvText;
    if (typeof cvFileName === 'string') updateData.cvFileName = cvFileName;

    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        userType: true,
        credits: true,
        referralCode: true,
        fullName: true,
        phone: true,
        website: true,
        location: true,
        description: true,
        logo: true,
      }
    });

    return res.status(200).json(updated);
  } catch (error: any) {
    console.error("[User Service] Update Profile Error:", error.message);
    console.error("[User Service] Full error:", error);
    return res.status(500).json({ 
      error: "Профайл шинэчлэхэд алдаа гарлаа", 
      details: error.message,
      code: error.code 
    });
  }
});

// Get User Profile
app.get('/api/users/profile/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        email: true,
        userType: true,
        credits: true,
        referralCode: true,
        fullName: true,
        phone: true,
        website: true,
        location: true,
        description: true,
        logo: true,
        cvText: true,
        cvFileName: true,
      }
    });
    if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Мэдээлэл авахад алдаа гарлаа" });
  }
});

// PATCH User CV (for updating CV text specifically)
app.patch('/api/users/profile/:id', async (req, res) => {
  const { id } = req.params;
  const { cvText, cvFileName } = req.body;

  console.log('[User Service] PATCH /api/users/profile/:id', {
    paramsId: id,
    hasCvText: typeof cvText === 'string' && cvText.length > 0,
    cvTextLength: typeof cvText === 'string' ? cvText.length : 0,
    cvFileName: typeof cvFileName === 'string' ? cvFileName : null,
  });

  try {
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        ...(typeof cvText === 'string' ? { cvText } : {}),
        ...(typeof cvFileName === 'string' ? { cvFileName } : {}),
      },
      select: {
        id: true,
        email: true,
        userType: true,
        credits: true,
        referralCode: true,
        fullName: true,
        phone: true,
        cvText: true,
        cvFileName: true,
      }
    });

    return res.status(200).json(user);
  } catch (error: any) {
    console.error('[User Service] PATCH profile error:', error?.message || error);
    return res.status(500).json({ error: "CV шинэчлэхэд алдаа гарлаа", details: error?.message || String(error) });
  }
});

app.get('/api/users/admin/all', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        userType: true,
        credits: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ error: "Хэрэглэгчдийг авахад алдаа гарлаа" });
  }
});

app.post('/api/users/admin/update-credits', async (req, res) => {
  const { userId, credits } = req.body;

  try {
    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { credits: Number(credits) }
    });

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ error: "Кредит шинэчлэхэд алдаа гарлаа" });
  }
});

app.post('/api/users/admin/update-role', async (req, res) => {
  const { userId, userType } = req.body;

  try {
    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { userType }
    });

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ error: "Эрх шинэчлэхэд алдаа гарлаа" });
  }
});

app.delete('/api/users/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "id буруу байна" });
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      const jobs = await tx.job.findMany({
        where: { employerId: userId },
        select: { id: true },
      });
      const jobIds = jobs.map((job: { id: number }) => job.id);

      if (jobIds.length > 0) {
        await tx.jobApplication.deleteMany({
          where: { jobId: { in: jobIds } },
        });
      }

      await tx.jobApplication.deleteMany({
        where: { candidateId: userId },
      });

      await tx.chatMessage.deleteMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
      });

      await tx.studyPlan.deleteMany({
        where: { userId },
      });

      await tx.job.deleteMany({
        where: { employerId: userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return res.status(200).json({ success: true, message: "Хэрэглэгч амжилттай устгагдлаа" });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    }

    console.error("[User Service] Delete User Error:", {
      userId,
      code: error?.code,
      message: error?.message,
    });
    return res.status(500).json({ error: "Хэрэглэгч устгахад алдаа гарлаа", details: error?.message });
  }
});

// 404 handler for debugging
app.use((req: any, res: any) => {
  console.error(`[User Service] 404 - ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: "Route not found", 
    method: req.method, 
    path: req.path,
    routes: [
      'GET /',
      'GET /test',
      'POST /api/users/create',
      'GET /api/users/by-email/:email',
      'GET /api/users/by-referral/:referralCode',
      'POST /api/users/update-profile',
      'GET /api/users/profile/:id',
      'PATCH /api/users/profile/:id'
    ]
  });
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[User Service] Error:', err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

const server = app.listen(port, () => {
  console.log(`[User Service] Server running on http://localhost:${port}`);
});

server.on('error', (err: any) => {
  console.error('[User Service] Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[User Service] SIGTERM received, shutting down gracefully');
  server.close(async () => {
    try {
      if (prisma) {
        await prisma.$disconnect();
      }
      console.log('[User Service] Disconnected from database');
      process.exit(0);
    } catch (error) {
      console.error('[User Service] Error during shutdown:', error);
      process.exit(1);
    }
  });
});
