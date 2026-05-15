import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { error, json, readJson } from "../../_lib/response";
import { jobHubEmailTemplate, sendEmail } from "../../_lib/auth";

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = String(body?.email || "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return error("Email not found", 404);

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    await sendEmail(
      email,
      "JobHub password reset",
      jobHubEmailTemplate({
        title: "Reset your password",
        description: "Use this one-time code to reset your JobHub password. Keep it private.",
        actionLabel: "Reset code",
        code,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send reset code";
    return error("Failed to send reset code", 502, message);
  }
  await prisma.user.update({ where: { email }, data: { verificationCode: code } });
  return json({ success: true, message: "Code sent" });
}

export async function PUT(request: Request) {
  const body = await readJson(request);
  const email = String(body?.email || "");
  const code = String(body?.code || "");
  const newPassword = String(body?.newPassword || body?.password || "");
  if (!email || !code || !newPassword) return error("email, code and newPassword required", 400);

  const user = await prisma.user.findUnique({ where: { email }, select: { verificationCode: true } });
  if (!user || user.verificationCode !== code) return error("Invalid code", 400);
  await prisma.user.update({
    where: { email },
    data: { password: await bcrypt.hash(newPassword, 10), verificationCode: null },
  });
  return json({ success: true });
}
