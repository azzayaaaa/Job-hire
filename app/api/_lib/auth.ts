import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function jobHubEmailTemplate({
  title,
  description,
  code,
  actionLabel,
  footer = "If you did not request this email, you can safely ignore it.",
}: {
  title: string;
  description: string;
  code?: string;
  actionLabel?: string;
  footer?: string;
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeFooter = escapeHtml(footer);
  const safeCode = code ? escapeHtml(code) : "";
  const safeActionLabel = actionLabel ? escapeHtml(actionLabel) : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 18px 45px rgba(15,23,42,0.10);">
      <tr>
        <td style="background:#0f172a;padding:28px 32px;">
          <div style="font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#93c5fd;font-weight:700;">JobHub</div>
          <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">${safeTitle}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#374151;">${safeDescription}</p>
          ${
            safeCode
              ? `<div style="margin:24px 0;padding:22px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
                  <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;font-weight:700;">${safeActionLabel || "Verification code"}</div>
                  <div style="margin-top:10px;font-size:34px;line-height:1;font-weight:800;letter-spacing:0.22em;color:#111827;">${safeCode}</div>
                </div>`
              : ""
          }
          <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${safeFooter}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function makeAccessToken(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !Number.isInteger(port) || !user || !pass || !from) {
    throw new Error("SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: true,
    auth: {
      user,
      pass,
    },
  });

  await transporter.verify();
  return transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}

export async function sendCode(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.password) return { status: 400, data: { error: "Email already registered" } };

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    await sendEmail(
      email,
      "JobHub verification code",
      jobHubEmailTemplate({
        title: "Verify your email",
        description: "Use this code to finish creating your JobHub account. The code expires in 2 minutes.",
        actionLabel: "Verification code",
        code,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send verification code";
    return { status: 502, data: { error: "Failed to send verification code", details: message } };
  }
  verificationCodes.set(email, { code, expiresAt: Date.now() + 2 * 60 * 1000 });
  await prisma.user.upsert({
    where: { email },
    update: { verificationCode: code },
    create: {
      email,
      password: "",
      userType: "CANDIDATE",
      verificationCode: code,
      referralCode: crypto.randomBytes(4).toString("hex"),
    },
  });
  return { status: 200, data: { success: true, message: "Code sent" } };
}

export async function verifyCode(email: string, code: string) {
  const cached = verificationCodes.get(email);
  if (cached?.code === code && Date.now() <= cached.expiresAt) {
    return { status: 200, data: { success: true, message: "Code verified" } };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { verificationCode: true } });
  if (user?.verificationCode === code) {
    return { status: 200, data: { success: true, message: "Code verified" } };
  }

  return { status: 400, data: { error: "Invalid or expired code" } };
}

export async function registerUser(body: any) {
  const { email, password, userType, code, invitedByCode } = body;
  if (!email || !password) return { status: 400, data: { error: "email and password required" } };

  if (code) {
    const verified = await verifyCode(email, code);
    if (verified.status !== 200) return verified;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.password) return { status: 400, data: { error: "Email already registered" } };

  const inviter = invitedByCode
    ? await prisma.user.findUnique({ where: { referralCode: String(invitedByCode) }, select: { id: true } })
    : null;

  const hashedPassword = await bcrypt.hash(String(password), 10);
  const userData = {
      email,
      password: hashedPassword,
      userType: String(userType || "CANDIDATE").toUpperCase(),
      referredBy: inviter?.id ?? null,
      credits: 0,
      subscriptionPlan: "FREE",
      freeCvGenerationsUsed: 0,
      freeSelfImprovementUsed: 0,
      verificationCode: null,
    };
  const newUser = existing
    ? await prisma.user.update({ where: { email }, data: userData })
    : await prisma.user.create({
        data: {
          ...userData,
          referralCode: crypto.randomBytes(4).toString("hex"),
        },
      });

  verificationCodes.delete(email);
  return {
    status: 201,
    data: {
      success: true,
      token: makeAccessToken({ id: newUser.id, email: newUser.email, userType: newUser.userType }),
      user: newUser,
    },
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.password) return { status: 404, data: { error: "User not found" } };

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return { status: 400, data: { error: "Invalid password" } };

  let authUser = user;
  if (email === "azzayabayartai07@gmail.com" && user.userType !== "ADMIN") {
    authUser = await prisma.user.update({ where: { id: user.id }, data: { userType: "ADMIN" } });
  }

  return {
    status: 200,
    data: {
      success: true,
      token: makeAccessToken({ id: authUser.id, email: authUser.email, userType: authUser.userType }),
      user: authUser,
    },
  };
}

export async function googleLoginUser(body: any) {
  const email = String(body?.email || "");
  if (!email) return { status: 400, data: { error: "email required" } };

  const requestedUserType = String(body?.userType || "CANDIDATE").toUpperCase();
  const userType =
    email === "azzayabayartai07@gmail.com"
      ? "ADMIN"
      : ["CANDIDATE", "EMPLOYER", "ADMIN"].includes(requestedUserType)
        ? requestedUserType
        : "CANDIDATE";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName: body?.name ?? undefined,
      image: body?.image ?? undefined,
      ...(email === "azzayabayartai07@gmail.com" ? { userType: "ADMIN" } : {}),
    },
    create: {
      email,
      password: "",
      userType,
      fullName: body?.name ?? undefined,
      image: body?.image ?? undefined,
      referralCode: crypto.randomBytes(4).toString("hex"),
    },
  });

  return {
    status: 200,
    data: {
      success: true,
      token: makeAccessToken({ id: user.id, email: user.email, userType: user.userType }),
      user,
    },
  };
}
