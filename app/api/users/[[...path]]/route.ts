import { prisma } from "@/lib/prisma";
import { error, json, readJson } from "../../_lib/response";
import {
  PAYMENT_BANK,
  PRO_MONTHLY_PRICE_MNT,
  addMonths,
  createOrderId,
  createUniqueTransactionCode,
  entitlementPayload,
  expireElapsedSubscriptions,
  publicUserSelect,
} from "../../_lib/users";

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const [a, b, c, d] = path;
  const url = new URL(request.url);

  if (a === "by-email" && b) {
    const user = await prisma.user.findUnique({ where: { email: decodeURIComponent(b) } });
    if (!user) return error("User not found", 404);
    return json(user);
  }
  if (a === "by-referral" && b) {
    const user = await prisma.user.findUnique({ where: { referralCode: decodeURIComponent(b) } });
    if (!user) return error("Referral code not found", 404);
    return json(user);
  }
  if (a === "profile" && b) {
    await expireElapsedSubscriptions();
    const user = await prisma.user.findUnique({ where: { id: Number(b) }, select: publicUserSelect });
    if (!user) return error("User not found", 404);
    return json(user);
  }
  if (a === "entitlements" && b) {
    await expireElapsedSubscriptions();
    const user = await prisma.user.findUnique({ where: { id: Number(b) } });
    if (!user) return error("User not found", 404);
    return json(entitlementPayload(user));
  }
  if (a === "admin" && b === "all") {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, userType: true, credits: true, subscriptionPlan: true, subscriptionExpiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return json(users);
  }
  if (a === "admin" && b === "payment-orders") {
    const status = url.searchParams.get("status") || undefined;
    const orders = await prisma.paymentOrder.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, email: true, fullName: true, userType: true, subscriptionPlan: true, subscriptionExpiresAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return json(orders);
  }
  if (a === "payment-orders" && b === "user" && c) {
    const orders = await prisma.paymentOrder.findMany({ where: { userId: Number(c) }, orderBy: { createdAt: "desc" }, take: 10 });
    return json(orders);
  }

  return error(`Unknown users route: ${path.join("/")}`, 404);
}

export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const [a, b, c, d] = path;
  const body = await readJson(request);

  if (a === "create") {
    const user = await prisma.user.create({
      data: {
        email: String(body?.email || ""),
        password: body?.password ? String(body.password) : "",
        userType: String(body?.userType || "CANDIDATE").toUpperCase(),
        credits: Number.isFinite(Number(body?.credits)) ? Number(body.credits) : 0,
        referralCode: String(body?.referralCode || cryptoRandom()),
        referredBy: body?.referredBy ? Number(body.referredBy) : null,
      },
    });
    return json({ success: true, user }, 201);
  }
  if (a === "internal" && b === "set-verification-code") {
    const user = await prisma.user.update({ where: { email: String(body?.email || "") }, data: { verificationCode: body?.code ? String(body.code) : null } });
    return json({ success: true, user });
  }
  if (a === "internal" && b === "reset-password") {
    const user = await prisma.user.findUnique({ where: { email: String(body?.email || "") } });
    if (!user || user.verificationCode !== String(body?.code || "")) return error("Invalid code", 400);
    const updated = await prisma.user.update({ where: { email: user.email }, data: { password: String(body?.password || ""), verificationCode: null } });
    return json({ success: true, user: updated });
  }
  if (a === "update-profile") {
    const id = Number(body?.id || body?.userId);
    const data: Record<string, unknown> = {};
    for (const key of ["fullName", "email", "phone", "website", "location", "description", "logo", "image", "cvText", "cvFileName", "skills"]) {
      if (typeof body?.[key] === "string") data[key] = body[key];
    }
    const user = await prisma.user.update({ where: { id }, data, select: publicUserSelect });
    return json(user);
  }
  if (a === "entitlements" && b && c === "use") {
    await expireElapsedSubscriptions();
    const feature = body?.feature === "selfImprovement" ? "freeSelfImprovementUsed" : "freeCvGenerationsUsed";
    const user = await prisma.user.findUnique({ where: { id: Number(b) } });
    if (!user) return error("User not found", 404);
    if (entitlementPayload(user).proActive) return json({ allowed: true, consumed: false, entitlements: entitlementPayload(user) });
    const limit = feature === "freeCvGenerationsUsed" ? 1 : 1;
    if ((user as any)[feature] >= limit) return json({ allowed: false, error: "Free limit reached", entitlements: entitlementPayload(user) }, 402);
    const updated = await prisma.user.update({ where: { id: Number(b) }, data: { [feature]: { increment: 1 } } });
    return json({ allowed: true, consumed: true, entitlements: entitlementPayload(updated) });
  }
  if (a === "entitlements" && b && c === "upgrade") {
    const user = await prisma.user.update({ where: { id: Number(b) }, data: { subscriptionPlan: "PRO_MONTHLY", subscriptionExpiresAt: addMonths(new Date(), 1) } });
    return json({ success: true, entitlements: entitlementPayload(user) });
  }
  if (a === "admin" && b === "update-credits") {
    const user = await prisma.user.update({ where: { id: Number(body?.userId) }, data: { credits: Number(body?.credits) } });
    return json({ success: true, user });
  }
  if (a === "admin" && b === "update-role") {
    const user = await prisma.user.update({ where: { id: Number(body?.userId) }, data: { userType: String(body?.userType || "CANDIDATE").toUpperCase() } });
    return json({ success: true, user });
  }
  if (a === "payment-orders") {
    const userId = Number(body?.userId);
    if (!Number.isInteger(userId)) return error("Invalid userId", 400);
    const pending = await prisma.paymentOrder.findFirst({ where: { userId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    const data = {
      amountMnt: Number(body?.amountMnt || PRO_MONTHLY_PRICE_MNT),
      plan: String(body?.plan || "PRO_MONTHLY"),
      duration: String(body?.duration || "ONE_MONTH"),
      screenshotUrl: typeof body?.screenshotUrl === "string" ? body.screenshotUrl : undefined,
      ...PAYMENT_BANK,
    };
    const order = pending
      ? await prisma.paymentOrder.update({ where: { id: pending.id }, data, include: { user: true } })
      : await prisma.paymentOrder.create({
          data: { ...data, orderId: createOrderId(), transactionCode: await createUniqueTransactionCode(), userId },
          include: { user: true },
        });
    return json({ success: true, order }, pending ? 200 : 201);
  }
  if (a === "admin" && b === "payment-orders" && c && d === "approve") {
    const orderId = Number(c);
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("ORDER_NOT_FOUND");
      const user = await tx.user.update({ where: { id: order.userId }, data: { subscriptionPlan: "PRO_MONTHLY", subscriptionExpiresAt: addMonths(now, 1) } });
      const updatedOrder = await tx.paymentOrder.update({ where: { id: orderId }, data: { status: "SUCCESS", reviewedAt: now, reviewedBy: Number(body?.adminId || 0) || null } });
      return { order: updatedOrder, user };
    });
    return json({ success: true, ...result });
  }
  if (a === "admin" && b === "payment-orders" && c && d === "reject") {
    const order = await prisma.paymentOrder.update({
      where: { id: Number(c) },
      data: { status: "REJECTED", rejectReason: String(body?.reason || ""), reviewedAt: new Date(), reviewedBy: Number(body?.adminId || 0) || null },
    });
    return json({ success: true, order });
  }

  return error(`Unknown users route: ${path.join("/")}`, 404);
}

export async function PATCH(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const body = await readJson(request);
  if (path[0] === "profile" && path[1]) {
    const data: Record<string, unknown> = {};
    for (const key of ["fullName", "email", "phone", "website", "location", "description", "logo", "image", "cvText", "cvFileName", "skills"]) {
      if (typeof body?.[key] === "string") data[key] = body[key];
    }
    const user = await prisma.user.update({ where: { id: Number(path[1]) }, data, select: publicUserSelect });
    return json(user);
  }
  return error(`Unknown users route: ${path.join("/")}`, 404);
}

export async function DELETE(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  if (path[0] === "admin" && path[1] === "users" && path[2]) {
    await prisma.user.delete({ where: { id: Number(path[2]) } });
    return json({ success: true });
  }
  return error(`Unknown users route: ${path.join("/")}`, 404);
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10);
}
