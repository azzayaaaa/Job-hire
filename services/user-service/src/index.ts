import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import hpp from 'hpp';
import { PrismaClient } from './lib/prismaClient';

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

// CORS Configuration - must specify origin when using credentials
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    // If no Origin header (server-to-server), allow default.
    // Otherwise, reflect the request origin to avoid "192.168.x" vs "localhost" mismatches.
    callback(null, origin ?? 'http://localhost:3000');
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

const port = 5005;

const PRO_MONTHLY_PRICE_MNT = 10000;
const PAYMENT_BANK = {
  bankName: 'TDB',
  bankAccount: '140005000499582572',
  bankHolderName: 'Аззаяа Баяртай',
};
const FREE_LIMITS = {
  aiCv: 1,
  selfImprovement: 1,
} as const;

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isProActive(user: { subscriptionPlan?: string | null; subscriptionExpiresAt?: Date | string | null }) {
  if (user.subscriptionPlan === 'PRO_UNTIL_CHANGED') return true;
  if (user.subscriptionPlan !== 'PRO_MONTHLY') return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

function createOrderId() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `JH-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function createTransactionCode() {
  // Generate unique code like JOB621, JOB789, etc.
  const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit number: 100-999
  return `JOB${randomNum}`;
}

async function createUniqueTransactionCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const transactionCode = createTransactionCode();
    const existing = await prisma.paymentOrder.findUnique({ where: { transactionCode } });
    if (!existing) return transactionCode;
  }

  return `JOB${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function expireElapsedSubscriptions() {
  await prisma.user.updateMany({
    where: {
      subscriptionPlan: 'PRO_MONTHLY',
      subscriptionExpiresAt: { lte: new Date() },
    },
    data: {
      subscriptionPlan: 'FREE',
      subscriptionExpiresAt: null,
    },
  });
}

function entitlementPayload(user: any) {
  const proActive = isProActive(user);
  return {
    plan: proActive ? 'PRO_MONTHLY' : 'FREE',
    proActive,
    priceMnt: PRO_MONTHLY_PRICE_MNT,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    free: {
      aiCv: {
        limit: FREE_LIMITS.aiCv,
        used: user.freeCvGenerationsUsed || 0,
        remaining: Math.max(FREE_LIMITS.aiCv - (user.freeCvGenerationsUsed || 0), 0),
      },
      selfImprovement: {
        limit: FREE_LIMITS.selfImprovement,
        used: user.freeSelfImprovementUsed || 0,
        remaining: Math.max(FREE_LIMITS.selfImprovement - (user.freeSelfImprovementUsed || 0), 0),
      },
    },
  };
}

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
        credits: Number.isFinite(Number(credits)) ? Number(credits) : 0,
        referralCode,
        referredBy,
        subscriptionPlan: 'FREE',
        freeCvGenerationsUsed: 0,
        freeSelfImprovementUsed: 0,
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
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        freeCvGenerationsUsed: true,
        freeSelfImprovementUsed: true,
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
    await expireElapsedSubscriptions();
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
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        freeCvGenerationsUsed: true,
        freeSelfImprovementUsed: true,
        emailNotifications: true,
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
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        freeCvGenerationsUsed: true,
        freeSelfImprovementUsed: true,
        emailNotifications: true,
      }
    });

    return res.status(200).json(user);
  } catch (error: any) {
    console.error('[User Service] PATCH profile error:', error?.message || error);
    return res.status(500).json({ error: "CV шинэчлэхэд алдаа гарлаа", details: error?.message || String(error) });
  }
});

app.get('/api/users/entitlements/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await expireElapsedSubscriptions();
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        userType: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        freeCvGenerationsUsed: true,
        freeSelfImprovementUsed: true,
      },
    });

    if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    return res.status(200).json(entitlementPayload(user));
  } catch (error: any) {
    console.error('[User Service] Entitlements fetch error:', error?.message || error);
    return res.status(500).json({ error: "Эрхийн мэдээлэл авахад алдаа гарлаа", details: error?.message });
  }
});

app.post('/api/users/entitlements/:id/use', async (req, res) => {
  const { id } = req.params;
  const { feature } = req.body as { feature?: 'aiCv' | 'selfImprovement' };

  if (feature !== 'aiCv' && feature !== 'selfImprovement') {
    return res.status(400).json({ error: "feature буруу байна" });
  }

  try {
    await expireElapsedSubscriptions();
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        userType: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        freeCvGenerationsUsed: true,
        freeSelfImprovementUsed: true,
      },
    });

    if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    if (isProActive(user)) {
      return res.status(200).json({ allowed: true, consumed: false, entitlements: entitlementPayload(user) });
    }

    const usedKey = feature === 'aiCv' ? 'freeCvGenerationsUsed' : 'freeSelfImprovementUsed';
    const limit = feature === 'aiCv' ? FREE_LIMITS.aiCv : FREE_LIMITS.selfImprovement;
    if ((user[usedKey] || 0) >= limit) {
      return res.status(402).json({
        allowed: false,
        error: "Free эрхийн лимит дууссан байна",
        entitlements: entitlementPayload(user),
      });
    }

    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: { [usedKey]: { increment: 1 } },
      select: {
        id: true,
        userType: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        freeCvGenerationsUsed: true,
        freeSelfImprovementUsed: true,
      },
    });

    return res.status(200).json({ allowed: true, consumed: true, entitlements: entitlementPayload(updated) });
  } catch (error: any) {
    console.error('[User Service] Entitlement consume error:', error?.message || error);
    return res.status(500).json({ error: "Эрх шалгахад алдаа гарлаа", details: error?.message });
  }
});

app.post('/api/users/entitlements/:id/upgrade', async (req, res) => {
  const { id } = req.params;

  try {
    const now = new Date();
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        subscriptionPlan: 'PRO_MONTHLY',
        subscriptionExpiresAt: addMonths(now, 1),
      },
      select: {
        id: true,
        userType: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        freeCvGenerationsUsed: true,
        freeSelfImprovementUsed: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Pro эрх идэвхжлээ",
      entitlements: entitlementPayload(user),
    });
  } catch (error: any) {
    console.error('[User Service] Upgrade error:', error?.message || error);
    return res.status(500).json({ error: "Төлөвлөгөө идэвхжүүлэхэд алдаа гарлаа", details: error?.message });
  }
});

app.get('/api/users/admin/all', async (req, res) => {
  try {
    await expireElapsedSubscriptions();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        userType: true,
        credits: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
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

app.post('/api/users/payment-orders', async (req, res) => {
  const { userId, screenshotUrl, amountMnt, plan, duration, transactionCode } = req.body as {
    userId?: number | string;
    screenshotUrl?: string;
    amountMnt?: number | string;
    plan?: string;
    duration?: string;
    transactionCode?: string;
  };

  const parsedUserId = Number(userId);
  const parsedAmount = Number(amountMnt || PRO_MONTHLY_PRICE_MNT);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ error: 'userId буруу байна' });
  }

  const hasScreenshot = typeof screenshotUrl === 'string' && screenshotUrl.startsWith('data:image/');
  if (!hasScreenshot) {
    return res.status(400).json({ error: 'Гүйлгээний screenshot зураг оруулна уу' });
  }

  if (screenshotUrl.length > 8_000_000) {
    return res.status(413).json({ error: 'Screenshot зураг хэт том байна' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });

    const pending = await prisma.paymentOrder.findFirst({
      where: { userId: parsedUserId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    if (pending) {
      const pendingWithCode = pending.transactionCode
        ? pending
        : await prisma.paymentOrder.update({
            where: { id: pending.id },
            data: { transactionCode: await createUniqueTransactionCode() },
          });

      const updated = await prisma.paymentOrder.update({
        where: { id: pendingWithCode.id },
        data: {
          amountMnt: parsedAmount,
          plan: plan || pendingWithCode.plan || 'PRO_MONTHLY',
          duration: duration || pendingWithCode.duration || 'ONE_MONTH',
          screenshotUrl,
          ...PAYMENT_BANK,
        },
        include: {
          user: { select: { id: true, email: true, fullName: true, userType: true } },
        },
      });

      return res.status(200).json({ success: true, order: updated });
    }

    let nextTransactionCode =
      typeof transactionCode === 'string' && /^JOB[A-Z0-9]{3,8}$/.test(transactionCode)
        ? transactionCode
        : await createUniqueTransactionCode();

    const existingCode = await prisma.paymentOrder.findUnique({ where: { transactionCode: nextTransactionCode } });
    if (existingCode) {
      nextTransactionCode = await createUniqueTransactionCode();
    }

    const order = await prisma.paymentOrder.create({
      data: {
        orderId: createOrderId(),
        transactionCode: nextTransactionCode,
        userId: parsedUserId,
        amountMnt: parsedAmount,
        plan: plan || 'PRO_MONTHLY',
        duration: duration || 'ONE_MONTH',
        screenshotUrl,
        ...PAYMENT_BANK,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, userType: true } },
      },
    });

    return res.status(201).json({ success: true, order });
  } catch (error: any) {
    console.error('[User Service] Create payment order error:', error?.message || error);
    return res.status(500).json({ error: 'Төлбөрийн хүсэлт үүсгэхэд алдаа гарлаа', details: error?.message });
  }
});

app.post('/api/users/payment-orders-legacy', async (req, res) => {
  const { userId, screenshotUrl, amountMnt, plan, duration } = req.body as {
    userId?: number | string;
    screenshotUrl?: string;
    amountMnt?: number | string;
    plan?: string;
    duration?: string;
  };

  const parsedUserId = Number(userId);
  const parsedAmount = Number(amountMnt || PRO_MONTHLY_PRICE_MNT);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ error: 'userId буруу байна' });
  }

  if (typeof screenshotUrl !== 'string' || !screenshotUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Гүйлгээний screenshot зураг оруулна уу' });
  }

  if (screenshotUrl.length > 8_000_000) {
    return res.status(413).json({ error: 'Screenshot зураг хэт том байна' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });

    const pending = await prisma.paymentOrder.findFirst({
      where: { userId: parsedUserId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      return res.status(409).json({
        error: 'Танд шалгагдаж байгаа төлбөрийн хүсэлт байна',
        order: pending,
      });
    }

    const order = await prisma.paymentOrder.create({
      data: {
        orderId: createOrderId(),
        transactionCode: createTransactionCode(),
        userId: parsedUserId,
        amountMnt: parsedAmount,
        plan: plan || 'PRO_MONTHLY',
        duration: duration || 'ONE_MONTH',
        screenshotUrl,
        ...PAYMENT_BANK,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, userType: true } },
      },
    });

    return res.status(201).json({ success: true, order });
  } catch (error: any) {
    console.error('[User Service] Create payment order error:', error?.message || error);
    return res.status(500).json({ error: 'Төлбөрийн хүсэлт үүсгэхэд алдаа гарлаа', details: error?.message });
  }
});

app.get('/api/users/payment-orders/user/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'userId буруу байна' });
  }

  try {
    const orders = await prisma.paymentOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return res.status(200).json(orders);
  } catch (error: any) {
    return res.status(500).json({ error: 'Төлбөрийн хүсэлтүүд авахад алдаа гарлаа', details: error?.message });
  }
});

app.post('/api/users/admin/update-plan', async (req, res) => {
  const { userId, plan, duration } = req.body as {
    userId?: number | string;
    plan?: 'FREE' | 'PRO';
    duration?: 'SEVEN_DAYS' | 'ONE_MONTH' | 'UNTIL_CHANGED';
  };

  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "userId буруу байна" });
  }

  if (plan !== 'FREE' && plan !== 'PRO') {
    return res.status(400).json({ error: "plan буруу байна" });
  }

  if (plan === 'PRO' && duration !== 'SEVEN_DAYS' && duration !== 'ONE_MONTH' && duration !== 'UNTIL_CHANGED') {
    return res.status(400).json({ error: "duration сонгоно уу" });
  }

  try {
    const now = new Date();
    const data =
      plan === 'FREE'
        ? { subscriptionPlan: 'FREE', subscriptionExpiresAt: null }
        : duration === 'UNTIL_CHANGED'
          ? { subscriptionPlan: 'PRO_UNTIL_CHANGED', subscriptionExpiresAt: null }
          : {
              subscriptionPlan: 'PRO_MONTHLY',
              subscriptionExpiresAt: duration === 'SEVEN_DAYS' ? addDays(now, 7) : addMonths(now, 1),
            };

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        userType: true,
        credits: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ success: true, user });
  } catch (error: any) {
    console.error('[User Service] Update plan error:', error?.message || error);
    return res.status(500).json({ error: "Plan шинэчлэхэд алдаа гарлаа", details: error?.message });
  }
});

app.get('/api/users/admin/payment-orders', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  try {
    const orders = await prisma.paymentOrder.findMany({
      where: status ? { status } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            userType: true,
            subscriptionPlan: true,
            subscriptionExpiresAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json(orders);
  } catch (error: any) {
    console.error('[User Service] Admin payment orders error:', error?.message || error);
    return res.status(500).json({ error: 'Төлбөрийн хүсэлтүүд авахад алдаа гарлаа', details: error?.message });
  }
});

app.post('/api/users/admin/payment-orders/:id/approve', async (req, res) => {
  const orderPk = Number(req.params.id);
  const adminId = Number(req.body?.adminId || 0) || null;
  if (!Number.isInteger(orderPk) || orderPk <= 0) {
    return res.status(400).json({ error: 'order id буруу байна' });
  }

  try {
    const now = new Date();
    const result = await prisma.$transaction(async (tx: any) => {
      const order = await tx.paymentOrder.findUnique({
        where: { id: orderPk },
        include: { user: true },
      });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== 'PENDING') throw new Error('ORDER_ALREADY_REVIEWED');

      const updatedUser = await tx.user.update({
        where: { id: order.userId },
        data: {
          subscriptionPlan: 'PRO_MONTHLY',
          subscriptionExpiresAt: addMonths(now, 1),
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          userType: true,
          subscriptionPlan: true,
          subscriptionExpiresAt: true,
        },
      });

      const updatedOrder = await tx.paymentOrder.update({
        where: { id: orderPk },
        data: {
          status: 'SUCCESS',
          reviewedAt: now,
          reviewedBy: adminId,
          rejectReason: null,
        },
      });

      await tx.notification.create({
        data: {
          senderId: adminId || order.userId,
          receiverId: order.userId,
          type: 'PAYMENT_APPROVED',
          title: 'Pro plan идэвхжлээ',
          message: `Таны ${order.orderId} дугаартай төлбөр баталгаажиж, Pro plan 1 сарын хугацаатай идэвхжлээ.`,
          link: '/dashboard/settings',
        },
      });

      return { order: updatedOrder, user: updatedUser };
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    if (error?.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Order олдсонгүй' });
    if (error?.message === 'ORDER_ALREADY_REVIEWED') return res.status(409).json({ error: 'Энэ order аль хэдийн шалгагдсан байна' });
    console.error('[User Service] Approve payment order error:', error?.message || error);
    return res.status(500).json({ error: 'Төлбөр баталгаажуулахад алдаа гарлаа', details: error?.message });
  }
});

app.post('/api/users/admin/payment-orders/:id/reject', async (req, res) => {
  const orderPk = Number(req.params.id);
  const adminId = Number(req.body?.adminId || 0) || null;
  const reason = String(req.body?.reason || '').trim();

  if (!Number.isInteger(orderPk) || orderPk <= 0) {
    return res.status(400).json({ error: 'order id буруу байна' });
  }
  if (!reason) {
    return res.status(400).json({ error: 'Татгалзсан шалтгаан бичнэ үү' });
  }

  try {
    const now = new Date();
    const result = await prisma.$transaction(async (tx: any) => {
      const order = await tx.paymentOrder.findUnique({
        where: { id: orderPk },
      });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== 'PENDING') throw new Error('ORDER_ALREADY_REVIEWED');

      const updatedOrder = await tx.paymentOrder.update({
        where: { id: orderPk },
        data: {
          status: 'REJECTED',
          rejectReason: reason,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });

      await tx.notification.create({
        data: {
          senderId: adminId || order.userId,
          receiverId: order.userId,
          type: 'PAYMENT_REJECTED',
          title: 'Төлбөрийн хүсэлт буцаагдлаа',
          message: `${order.orderId} дугаартай төлбөрийн хүсэлт буцаагдлаа. Шалтгаан: ${reason}`,
          link: '/dashboard/settings',
        },
      });

      return { order: updatedOrder };
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    if (error?.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Order олдсонгүй' });
    if (error?.message === 'ORDER_ALREADY_REVIEWED') return res.status(409).json({ error: 'Энэ order аль хэдийн шалгагдсан байна' });
    console.error('[User Service] Reject payment order error:', error?.message || error);
    return res.status(500).json({ error: 'Төлбөр татгалзахад алдаа гарлаа', details: error?.message });
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

      await tx.paymentOrder.deleteMany({
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


// Notification Routes
app.use('/api/notifications', (req, res, next) => {
  console.log(`[User Service] Notification route hit: ${req.method} ${req.path}`);
  next();
});

app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await prisma.notification.findMany({
      where: { receiverId: Number(userId) },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(notifications);
  } catch (error: any) {
    console.error("[Notifications] Get notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.get('/api/notifications/:userId/unread', async (req, res) => {
  try {
    const { userId } = req.params;
    const unreadCount = await prisma.notification.count({
      where: {
        receiverId: Number(userId),
        isRead: false,
      },
    });
    res.json({ unreadCount });
  } catch (error: any) {
    console.error("[Notifications] Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const { senderId, receiverId, type, title, message, link } = req.body;

    const notification = await prisma.notification.create({
      data: {
        senderId: Number(senderId),
        receiverId: Number(receiverId),
        type,
        title,
        message,
        link: link || null,
        isRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            image: true,
          },
        },
      },
    });

    res.json(notification);
  } catch (error: any) {
    console.error("[Notifications] Create notification error:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await prisma.notification.update({
      where: { id: Number(notificationId) },
      data: { isRead: true },
    });

    res.json(notification);
  } catch (error: any) {
    console.error("[Notifications] Mark as read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

app.put('/api/notifications/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const { emailNotifications } = req.body;

    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { emailNotifications },
      select: {
        id: true,
        email: true,
        emailNotifications: true,
      },
    });

    res.json(user);
  } catch (error: any) {
    console.error("[Notifications] Update preferences error:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

app.delete('/api/notifications/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    await prisma.notification.delete({
      where: { id: Number(notificationId) },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Notifications] Delete notification error:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[User Service] Error:', err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

const server = app.listen(port, () => {
  console.log(`[User Service] Server running on http://localhost:${port}`);
  expireElapsedSubscriptions().catch((error: any) => {
    console.error('[User Service] Initial subscription expiry cleanup error:', error?.message || error);
  });
});

const subscriptionExpiryTimer = setInterval(() => {
  expireElapsedSubscriptions().catch((error: any) => {
    console.error('[User Service] Subscription expiry cleanup error:', error?.message || error);
  });
}, 60_000);

server.on('error', (err: any) => {
  console.error('[User Service] Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[User Service] SIGTERM received, shutting down gracefully');
  clearInterval(subscriptionExpiryTimer);
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
