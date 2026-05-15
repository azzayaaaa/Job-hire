import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const PRO_MONTHLY_PRICE_MNT = 10000;
export const PAYMENT_BANK = {
  bankName: "TDB",
  bankAccount: "140005000499582572",
  bankHolderName: "Azzayaa Bayartai",
};

const FREE_LIMITS = {
  aiCv: 1,
  selfImprovement: 1,
} as const;

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isProActive(user: { subscriptionPlan?: string | null; subscriptionExpiresAt?: Date | string | null }) {
  if (user.subscriptionPlan === "PRO_UNTIL_CHANGED") return true;
  if (user.subscriptionPlan !== "PRO_MONTHLY") return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

export async function expireElapsedSubscriptions() {
  await prisma.user.updateMany({
    where: {
      subscriptionPlan: "PRO_MONTHLY",
      subscriptionExpiresAt: { lte: new Date() },
    },
    data: {
      subscriptionPlan: "FREE",
      subscriptionExpiresAt: null,
    },
  });
}

export function entitlementPayload(user: any) {
  const proActive = isProActive(user);
  return {
    plan: proActive ? "PRO_MONTHLY" : "FREE",
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

export function createOrderId() {
  return `JH-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function createTransactionCode() {
  return `JOB${Math.floor(Math.random() * 900) + 100}`;
}

export async function createUniqueTransactionCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const transactionCode = createTransactionCode();
    const existing = await prisma.paymentOrder.findUnique({ where: { transactionCode } });
    if (!existing) return transactionCode;
  }
  return `JOB${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export const publicUserSelect = {
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
  image: true,
  cvText: true,
  cvFileName: true,
  skills: true,
  subscriptionPlan: true,
  subscriptionExpiresAt: true,
  freeCvGenerationsUsed: true,
  freeSelfImprovementUsed: true,
  emailNotifications: true,
} as const;
