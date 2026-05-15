import { prisma } from "@/lib/prisma";
import { deterministicMatch } from "../../_lib/jobs";
import { error, json, readJson } from "../../_lib/response";

async function groq(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are JobHub's helpful Mongolian career assistant. Answer clearly and practically." },
        { role: "user", content: prompt },
      ],
      temperature: 0.55,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || null;
}

async function fileToText(value: unknown) {
  if (typeof File !== "undefined" && value instanceof File) {
    if (value.type.startsWith("text/") || value.name.toLowerCase().endsWith(".txt")) {
      return value.text();
    }
    return "";
  }
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const route = path.join("/");
  let body: any = {};
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    body = Object.fromEntries(form.entries());
  } else {
    body = await readJson(request);
  }

  if (route === "ask" || route === "ask-file") {
    const prompt = String(body?.message || body?.question || body?.prompt || "");
    const fileText = await fileToText(body?.file);
    const answer = (await groq([prompt, fileText].filter(Boolean).join("\n\nAttached file text:\n"))) || "AI service is not configured. Please set GROQ_API_KEY.";
    return json({ success: true, answer, response: answer });
  }
  if (route === "generate-roadmap") {
    const answer = (await groq(`Generate a practical learning roadmap: ${JSON.stringify(body).slice(0, 4000)}`)) || "Roadmap generation requires GROQ_API_KEY.";
    return json({ success: true, roadmap: answer, response: answer });
  }
  if (route === "generate-cv") {
    const cv = (await groq(`Generate a professional CV from this profile data:\n${JSON.stringify(body).slice(0, 6000)}`)) || "CV generation requires GROQ_API_KEY.";
    return json({ success: true, cv, cvText: cv, generatedCV: cv });
  }
  if (route === "parse-cv" || route === "parse" || route === "extract-from-file") {
    const uploadedText = await fileToText(body?.file || body?.cv);
    const text = String(body?.cvText || body?.text || body?.dataUrl || uploadedText || "");
    return json({ success: true, cvText: text.startsWith("data:") ? "" : text, text: text.startsWith("data:") ? "" : text });
  }
  if (route === "analyze" || route === "analyze-cv" || route === "skill-gap-analysis") {
    const analysis = (await groq(`Analyze this CV/profile and give practical feedback:\n${JSON.stringify(body).slice(0, 6000)}`)) || "Analysis requires GROQ_API_KEY.";
    return json({ success: true, analysis, feedback: analysis });
  }
  if (route === "match-cv-to-job") {
    const match = deterministicMatch(
      { title: body?.jobTitle, description: body?.jobDescription, requirements: body?.jobRequirements },
      { cvText: body?.cv },
    );
    return json({ success: true, ...match });
  }
  if (route === "find-matching-jobs") {
    const jobs = Array.isArray(body?.availableJobs) ? body.availableJobs : [];
    const matches = jobs.map((job: any) => ({ jobId: job.id, ...deterministicMatch(job, { cvText: body?.cv }) })).sort((a: any, b: any) => b.matchScore - a.matchScore);
    return json({ success: true, matches });
  }
  if (route === "match-candidates-to-job") {
    const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
    const job = { title: body?.jobTitle, description: body?.jobDescription, requirements: body?.jobRequirements };
    const matches = candidates.map((candidate: any) => ({ candidateId: candidate.id, ...deterministicMatch(job, candidate) })).sort((a: any, b: any) => b.matchScore - a.matchScore);
    return json({ success: true, matches });
  }

  return error(`Unknown ai route: ${route}`, 404);
}

export async function GET() {
  const [jobs, users] = await Promise.all([prisma.job.count(), prisma.user.count()]);
  return json({ ok: true, jobs, users });
}
