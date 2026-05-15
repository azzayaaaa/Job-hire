import { sendEmail } from "../../_lib/auth";
import { error, json, readJson } from "../../_lib/response";

export async function POST(request: Request) {
  const body = await readJson(request);
  const to = String(body?.to || "");
  const subject = String(body?.subject || "");
  const html = String(body?.html || "");

  if (!to || !subject || !html) return error("to, subject and html required", 400);

  try {
    await sendEmail(to, subject, html);
    return json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return error("Failed to send email", 502, message);
  }
}
