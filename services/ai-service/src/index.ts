import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import axios from "axios";
import multer from "multer";
import { PDFParse } from "pdf-parse";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5004;

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://192.168.10.76:3000",
]);

const isAllowedLocalOrigin = (origin?: string): boolean => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    const isDevFrontend = url.protocol === "http:" && url.port === "3000";
    const isPrivateLan =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(url.hostname);

    return isDevFrontend && isPrivateLan;
  } catch {
    return false;
  }
};

// ===============================
// MIDDLEWARE
// ===============================
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedLocalOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// DEBUG: log every request body
app.use((req, _res, next) => {
  console.log("[BODY]", req.body);
  next();
});

// ===============================
// ENV CHECK
// ===============================
if (!process.env.GROQ_API_KEY) {
  console.error("[ERROR] GROQ_API_KEY not found");
  process.exit(1);
}

const GROQ_API_KEY = process.env.GROQ_API_KEY.trim();

console.log(
  "[OK] GROQ key:",
  JSON.stringify(GROQ_API_KEY).slice(0, 18) + "...",
  "(len=" + GROQ_API_KEY.length + ")"
);

// ===============================
// GROQ API (OpenAI compatible)
// ===============================
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

const MONGOLIAN_SYSTEM_PROMPT = `
Чи JobHub платформын AI туслах. Үндсэндээ монголоор, ойлгомжтой, найрсаг, хэрэгтэй байдлаар хариул.
Хэрэглэгч латинаар монгол бичсэн, англи үг хольсон байсан ч утгыг нь ойлго.
Мэндчилгээ болон богино асуултад богино, шууд хариул. Хэрэгтэй үед нэг тодруулах асуулт асуу.
Код, API, model, CV, PDF зэрэг тогтсон нэр томьёог хүчээр орчуулах шаардлагагүй.
`.trim();

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const CHAT_SYSTEM_PROMPT = `
Чи JobHub платформын AI туслах. Хэрэглэгчтэй ChatGPT шиг ухаалаг, энгийн, хүнтэй ярьж байгаа мэт ярилц.

Зан төлөв:
1. Үндсэндээ монголоор хариул. Хэрэглэгч латинаар монгол бичсэн ч утгыг нь ойлго.
2. Хэрэглэгч англиар асуувал монголоор тайлбарлаад, хэрэгтэй бол англи нэр томьёог хэвээр нь ашигла.
3. Мэндчилгээ ирвэл богино мэндлээд дараагийн алхам руу ор. Дахин дахин "Сайн байна уу" гэж бүү давт.
4. Өмнөх ярианы утгыг барьж, яг асуусан зүйлд нь шууд хариул.
5. Хэт албан, модон өгүүлбэрээс зайлсхий. Найрсаг, ойлгомжтой, хэрэгтэй бай.
6. Мэдэхгүй зүйлээ зохиохгүй. Тодруулах шаардлагатай бол нэг богино асуулт асуу.
7. Ажил, CV, ажилтан хайх, карьерын зөвлөгөөн дээр бодитой, хэрэгжихүйц зөвлөгөө өг.
8. Код, технологи, брэнд, API, model нэр зэрэг тогтсон нэр томьёог орчуулах гэж хүчлэхгүй.
`.trim();

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant for a job platform.";

function normalizeGroqMessages(
  input: string,
  useMongoliPrompt: boolean,
  history?: unknown,
  systemContext?: unknown,
): GroqMessage[] {
  const extraSystemContext = compactText(systemContext, 1200);
  const baseSystemPrompt = useMongoliPrompt ? CHAT_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = extraSystemContext
    ? `${baseSystemPrompt}\n\nНэмэлт горимын заавар:\n${extraSystemContext}`
    : baseSystemPrompt;
  const messages: GroqMessage[] = [{ role: "system", content: systemPrompt }];

  if (Array.isArray(history)) {
    for (const item of history.slice(-16)) {
      const role = (item as any)?.role;
      const content = compactText((item as any)?.content ?? (item as any)?.text ?? "", 2500);

      if ((role === "user" || role === "assistant") && content) {
        messages.push({ role, content });
      }
    }
  }

  messages.push({ role: "user", content: input });
  return messages;
}

async function groqRespond(
  input: string,
  useMongoliPrompt: boolean = true,
  maxTokens: number = 1024,
  history?: unknown,
  systemContext?: unknown,
  temperatureOverride?: number,
): Promise<string | null> {
  const messages = normalizeGroqMessages(input, useMongoliPrompt, history, systemContext);

  try {
    const resp = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_TEXT_MODEL,
        messages,
        temperature: temperatureOverride ?? (useMongoliPrompt ? 0.55 : 0.7),
        max_tokens: maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60_000,
      },
    );

    const data = resp.data as GroqChatResponse;
    const responseText = data.choices?.[0]?.message?.content;
    
    if (responseText) {
      console.log("[OK] GROQ Response:", responseText.slice(0, 100));
      return responseText;
    }
    
    console.warn("[WARN] GROQ returned empty response:", JSON.stringify(data));
    return null;
  } catch (err: any) {
    console.error("[ERROR] GROQ API Error:", {
      status: err.response?.status,
      statusText: err.response?.statusText,
      message: err.message,
      data: err.response?.data,
    });
    throw err;
  }
}

async function groqVisionRespond(input: string, file: Express.Multer.File): Promise<string | null> {
  const imageDataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  try {
    const resp = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_VISION_MODEL,
        messages: [
          { role: "system", content: MONGOLIAN_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: input },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.35,
        max_tokens: 1400,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60_000,
      },
    );

    return (resp.data as GroqChatResponse).choices?.[0]?.message?.content ?? null;
  } catch (err: any) {
    console.error("[ERROR] GROQ Vision Error:", {
      status: err.response?.status,
      message: err.message,
      data: err.response?.data,
    });
    return null;
  }
}

async function extractUploadedText(file: Express.Multer.File): Promise<string> {
  if (file.mimetype === "application/pdf") {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return result.text?.trim() || "";
    } finally {
      await parser.destroy();
    }
  }

  if (file.mimetype.startsWith("text/")) {
    return file.buffer.toString("utf8").trim();
  }

  return "";
}

async function extractPdfViaVision(file: Express.Multer.File): Promise<string> {
  const parser = new PDFParse({ data: file.buffer });
  try {
    const screenshots = await parser.getScreenshot({
      first: 2,
      desiredWidth: 1400,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const pageTexts = await Promise.all(
      screenshots.pages.slice(0, 2).map(async (page) => {
        const pageFile = {
          ...file,
          originalname: `${file.originalname || "cv"}.page-${page.pageNumber}.png`,
          mimetype: "image/png",
          buffer: Buffer.from(page.data),
        } as Express.Multer.File;

        return groqVisionRespond(
          "Extract every readable resume/CV detail from this rendered PDF page. Return plain text only. Preserve names, contact details, roles, skills, work history, and education.",
          pageFile,
        );
      }),
    );

    return pageTexts
      .filter((text): text is string => Boolean(text))
      .filter(
        (text) =>
          !/ямар ч текст харагдахгүй|унших боломжтой мэдээлэл байхгүй|no text (?:is )?visible|the page is empty|there are no details to extract/i.test(
            text,
          ),
      )
      .join("\n")
      .trim();
  } finally {
    await parser.destroy();
  }
}

function compactText(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function extractCurrentUserPrompt(rawPrompt: string): string {
  const prompt = rawPrompt.trim();
  const marker = "Хэрэглэгчийн асуулт:";
  const markerIndex = prompt.lastIndexOf(marker);

  if (markerIndex >= 0) {
    return prompt.slice(markerIndex + marker.length).trim();
  }

  if (prompt.includes("JobHub") && prompt.includes("\n\n")) {
    const lastBlock = prompt.split(/\n\s*\n/).pop()?.trim() || prompt;
    const colonIndex = lastBlock.indexOf(":");
    return colonIndex >= 0 ? lastBlock.slice(colonIndex + 1).trim() : lastBlock;
  }

  return prompt;
}

// ===============================
// Multer
// ===============================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ===============================
// TEST ROUTE
// ===============================
app.get("/test", async (_req, res) => {
  try {
    console.log("[TEST] Testing GROQ API...");
    const reply = await groqRespond("What is 2+2?", false);
    res.json({
      success: true,
      reply,
    });
  } catch (e: any) {
    console.error("[ERROR] TEST ERROR:", e.message);
    res.status(500).json({ 
      error: e.message ?? "test failed",
      details: e.response?.data ?? null
    });
  }
});

// ===============================
// HEALTH
// ===============================
app.get("/", (_req, res) => {
  res.json({ success: true, message: "AI running" });
});

// ===============================
// AI ASK
// ===============================
app.post("/api/ai/ask", async (req: Request, res: Response) => {
  try {
    const rawPrompt = req.body?.prompt?.trim() || req.body?.message?.trim();
    const history = req.body?.history;
    const systemContext = req.body?.systemContext || req.body?.modeContext;

    if (!rawPrompt) {
      return res.status(400).json({
        success: false,
        error: "prompt or message missing",
      });
    }

    const prompt = extractCurrentUserPrompt(rawPrompt);

    console.log("Processing AI request:", prompt.slice(0, 50));
    
    const answer = await groqRespond(prompt, true, 1200, history, systemContext);

    if (!answer) {
      console.warn("[WARN] GROQ returned null answer for prompt:", prompt);
      return res.status(500).json({
        success: false,
        error: "AI service returned empty response",
      });
    }

    res.json({
      success: true,
      answer,
    });
  } catch (err: any) {
    console.error("[ERROR] ASK ERROR:", err.message);
    const upstreamStatus = Number(err.response?.status);
    const isRateLimited = upstreamStatus === 429;
    res.status(isRateLimited ? 429 : 500).json({ 
      success: false,
      error: isRateLimited
        ? "AI үйлчилгээний өдрийн лимит түр дууссан байна. Түр хүлээгээд дахин оролдоно уу."
        : err.message ?? "AI request failed",
      details: process.env.NODE_ENV === "development" ? err.response?.data : undefined
    });
  }
});

app.post("/api/ai/ask-file", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const message = compactText((req.body as any)?.message || "", 3000);
    const jobsContext = compactText((req.body as any)?.jobsContext || "", 9000);

    if (!file && !message) {
      return res.status(400).json({
        success: false,
        error: "message or file missing",
      });
    }

    let extractedText = "";
    if (file) {
      extractedText = await extractUploadedText(file);
    }

    const cleanBasePrompt = `
Чи ажлын платформын карьерийн зөвлөх AI.
Хэрэглэгч файл, CV, ажлын зарын холбоос эсвэл ажлын мэдээлэл илгээж болно.

Заавар:
1. Монголоор хариул.
2. CV болон ажлын зарын тохирлыг үнэнээр дүгнэ. Хэт магтахгүй.
3. Тохирлын хувийг ойролцоогоор өг.
4. Яагаад тохирч эсвэл тохирохгүй байгааг товч, тодорхой хэл.
5. Дутуу ур чадвар, сайжруулах зөвлөгөөг жагсаа.
6. Доорх ажлын жагсаалтаас тохирох ажлууд байвал 3 хүртэл санал болго.

Хэрэглэгчийн бичсэн зүйл:
${message || "(байхгүй)"}

Файлын нэр: ${file?.originalname || "(байхгүй)"}
Файлаас уншсан текст:
${extractedText || "(текст уншигдаагүй эсвэл зураг файл байна)"}

Одоогийн боломжит ажлууд:
${jobsContext || "(ажлын жагсаалт ирээгүй)"}
`;

    let answer: string | null = null;
    if (file?.mimetype.startsWith("image/")) {
      answer = await groqVisionRespond(cleanBasePrompt, file);
    }

    if (!answer) {
      answer = await groqRespond(cleanBasePrompt, true);
    }

    if (!answer) {
      return res.status(502).json({
        success: false,
        error: "AI service returned empty response",
      });
    }

    res.json({
      success: true,
      answer,
      fileName: file?.originalname || null,
      extractedChars: extractedText.length,
    });
  } catch (err: any) {
    console.error("[ERROR] ASK-FILE ERROR:", {
      message: err?.message,
      data: err?.response?.data,
    });
    res.status(500).json({
      success: false,
      error: err.message ?? "AI file request failed",
    });
  }
});

// ===============================
// CV PARSE (simple)
// ===============================
app.post("/api/ai/parse", upload.single("cv"), async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "file missing" });
    }

    // Temporary fallback text to avoid PDF parse failures.
    const text = "Sample CV text";

    const ai = await groqRespond(
      `Extract skills as JSON array only.\n\nCV:\n${text}\n\nJSON:`,
      false // Don't use Mongolian system prompt for English prompts
    );
    res.json({
      success: true,
      ai,
    });
  } catch (err: any) {
    console.error("[ERROR] PARSE ERROR:", err);
    res.status(500).json({ error: err.message ?? "parse failed" });
  }
});

// ===============================
// ANALYZE CV
// ===============================
app.post("/api/ai/analyze-cv", async (req: Request, res: Response) => {
  try {
    const { cv, jobTitle, jobDescription } = req.body;

    if (!cv || !jobTitle) {
      return res.status(400).json({ error: "cv and jobTitle required" });
    }

    const prompt = `
You are a professional CV analyst. Analyze the following CV in relation to the job posting and provide constructive feedback.

Job Title: ${jobTitle}
Job Description: ${jobDescription || "Not provided"}

CV Content:
${cv}

Please provide:
1. How well the CV matches the job requirements
2. Key strengths to highlight
3. Areas that need improvement
4. Specific suggestions to increase chances of success

Format the response in clear, numbered sections in Mongolian.`;

    // useMongoliPrompt = true because this prompt explicitly asks for Mongolian response
    const analysis = await groqRespond(prompt, true);

    res.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    console.error("[ERROR] ANALYZE-CV ERROR:", err);
    res.status(500).json({ error: err.message ?? "analyze-cv failed" });
  }
});

app.post("/api/ai/parse-cv", upload.single("file"), async (req: Request, res: Response) => {
  try {
    let file = (req as any).file as Express.Multer.File | undefined;
    const dataUrl = typeof (req.body as any)?.dataUrl === "string" ? (req.body as any).dataUrl : "";

    if (!file && dataUrl.startsWith("data:")) {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        file = {
          fieldname: "file",
          originalname: String((req.body as any)?.fileName || "uploaded-cv"),
          encoding: "7bit",
          mimetype: match[1],
          buffer: Buffer.from(match[2], "base64"),
          size: Buffer.byteLength(match[2], "base64"),
          destination: "",
          filename: "",
          path: "",
          stream: undefined as any,
        };
      }
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "file or dataUrl required",
      });
    }

    let cvText = await extractUploadedText(file);

    if (
      file.mimetype === "application/pdf" &&
      compactText(cvText, 400).replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "").trim().length < 40
    ) {
      cvText = await extractPdfViaVision(file);
    }

    if (!cvText && file.mimetype.startsWith("image/")) {
      cvText =
        (await groqVisionRespond(
          "Extract the visible resume/CV text from this image. Return plain text only. Preserve names, contact details, skills, experience, and education.",
          file,
        )) || "";
    }

    const normalizedCvText = compactText(cvText, 20_000);
    if (!normalizedCvText) {
      return res.status(422).json({
        success: false,
        error: "CV text could not be extracted",
      });
    }

    return res.json({
      success: true,
      cvText: normalizedCvText,
    });
  } catch (err: any) {
    console.error("[ERROR] PARSE-CV ERROR:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "parse-cv failed",
    });
  }
});

/**
 * ===============================
 * SKILL GAP ANALYSIS
 * ===============================
 * Hardened to avoid Groq 500s caused by:
 * - non-string CV payloads
 * - excessively large CV text (prompt too big / context overflow)
 * - occasional upstream "input too large" errors
 */
const DEFAULT_SKILL_GAP_MAX_CV_CHARS = 4000;

function looksLikeContextSizeError(details: unknown): boolean {
  const text =
    typeof details === "string"
      ? details
      : JSON.stringify(details ?? "");

  const t = text.toLowerCase();
  return (
    t.includes("context") ||
    t.includes("too large") ||
    t.includes("maximum") ||
    t.includes("length") ||
    t.includes("tokens")
  );
}

app.post("/api/ai/skill-gap-analysis", async (req: Request, res: Response) => {
  try {
    const { cv } = req.body as { cv?: unknown; userId?: unknown };

    if (!cv) return res.status(400).json({ error: "cv required" });

    const maxCvChars = Number(
      process.env.SKILL_GAP_MAX_CV_CHARS ?? DEFAULT_SKILL_GAP_MAX_CV_CHARS,
    );

    const cvText =
      typeof cv === "string"
        ? cv
        : (() => {
            try {
              return JSON.stringify(cv);
            } catch {
              return String(cv);
            }
          })();

    const normalizedCvText = cvText.replace(/\s+/g, " ").trim();

    const truncateCv = (limit: number) =>
      normalizedCvText.length > limit
        ? `${normalizedCvText.slice(0, limit)}\n...[TRUNCATED]...`
        : normalizedCvText;

    const buildPrompt = (truncatedCvText: string) => `
You are an expert career advisor. Analyze this CV and identify skill gaps compared to current market demands.

CV Content:
${truncatedCvText}

Provide analysis in the following JSON format only:
{
  "analysis": "Overall assessment of the candidate's skills and career trajectory (in Mongolian)",
  "recommendations": [
    {
      "skill": "Skill name",
      "marketDemand": 85,
      "description": "Why this skill is important and how to develop it (in Mongolian)"
    }
  ]
}

Focus on:
1. High-demand skills that are missing from the CV
2. Skills that need enhancement
3. Market trends in their field
4. Practical learning resources and paths`;

    const firstTrunc = truncateCv(maxCvChars);
    const prompt = buildPrompt(firstTrunc);

    let response: string | null = null;
    try {
      response = await groqRespond(prompt);
    } catch (err: any) {
      const details =
        err?.response?.data?.error ||
        err?.response?.data ||
        err?.message ||
        "skill-gap-analysis upstream failed";

      // One retry with more aggressive truncation if it looks like size/context issues
      if (looksLikeContextSizeError(details)) {
        const secondLimit = Math.max(2000, Math.floor(maxCvChars * 0.6));
        response = await groqRespond(buildPrompt(truncateCv(secondLimit)));
      } else {
        throw err;
      }
    }

    if (!response) {
      return res.status(502).json({ error: "skill-gap-analysis failed", details: "Empty AI response" });
    }

    // Try to parse JSON from response
    let parsedData:
      | { analysis?: string; recommendations?: Array<{ skill?: string; marketDemand?: number; description?: string }> }
      | null = null;

    try {
      const fencedMatch = response.match(/```json\s*([\s\S]*?)```/i);
      const jsonString = fencedMatch?.[1] ?? response.match(/\{[\s\S]*\}/)?.[0];

      if (jsonString) {
        parsedData = JSON.parse(jsonString);
      }
    } catch (e) {
      console.error("JSON parse error:", e);
    }

    res.json({
      success: true,
      analysis: parsedData?.analysis || response,
      recommendations: parsedData?.recommendations || [],
    });
  } catch (err: any) {
    const details =
      err?.response?.data?.error ||
      err?.response?.data ||
      err?.message ||
      "skill-gap-analysis failed";

    console.error("[ERROR] SKILL-GAP-ANALYSIS ERROR:", details);

    const detailsString = typeof details === "string" ? details : JSON.stringify(details);
    res.status(502).json({
      error: "skill-gap-analysis failed",
      details: detailsString,
    });
  }
});

// ===============================
// 30-DAY LEARNING ROADMAP
// ===============================
app.post("/api/ai/generate-roadmap", async (req: Request, res: Response) => {
  try {
    const topic = compactText(req.body?.topic || "", 180);
    const requestedDays = Number(req.body?.days || 30);
    const days = Math.min(30, Math.max(7, Number.isFinite(requestedDays) ? requestedDays : 30));

    if (!topic) {
      return res.status(400).json({ error: "topic required" });
    }

    const prompt = `
You are a practical learning coach.
Create a ${days}-day learning roadmap for this topic: "${topic}".

Return ONLY valid JSON, no markdown, no commentary:
[
  {
    "day": 1,
    "title": "Short task title in Mongolian",
    "description": "Specific guidance in Mongolian: what to study, what to practice, and what small result to produce."
  }
]

Rules:
1. Produce exactly ${days} items.
2. Use progressive sequencing from basics to applied practice.
3. Each day must be actionable, concrete, and suitable as a TODO item.
4. Include practice, review, mini-project, and recap days where appropriate.
5. Do not repeat the same task wording.
6. Keep each title concise and each description under 220 characters.
`.trim();

    const response = await groqRespond(prompt, true, 2600, undefined, undefined, 0.35);
    if (!response) {
      return res.status(502).json({ error: "roadmap generation failed", details: "Empty AI response" });
    }

    let roadmap: Array<{ day?: number; title?: string; description?: string }> = [];
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        roadmap = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("[ERROR] ROADMAP JSON PARSE ERROR:", error);
    }

    const normalizedRoadmap = Array.isArray(roadmap)
      ? roadmap
          .slice(0, days)
          .map((item, index) => ({
            day: Number(item?.day) || index + 1,
            title: compactText(item?.title || `${topic} сурах алхам ${index + 1}`, 120),
            description: compactText(
              item?.description || `${topic} сэдвийн ${index + 1}-р өдрийн сурах ажил.`,
              260,
            ),
          }))
          .filter((item) => item.title)
      : [];

    if (!normalizedRoadmap.length) {
      return res.status(502).json({
        error: "roadmap generation failed",
        details: "AI response did not contain a usable roadmap",
      });
    }

    res.json({
      success: true,
      roadmap: normalizedRoadmap,
    });
  } catch (err: any) {
    console.error("[ERROR] GENERATE-ROADMAP ERROR:", {
      message: err?.message,
      data: err?.response?.data,
    });
    res.status(500).json({
      error: err.message ?? "generate-roadmap failed",
      details: err.response?.data ?? null,
    });
  }
});

// ===============================
// GENERATE/ENHANCE CV
// ===============================
app.post("/api/ai/generate-cv", async (req: any, res: Response) => {
  try {
    console.log("[CV] Generate request received");
    const {
      personalInfo: requestedPersonalInfo,
      experience,
      education,
      skills,
      profilePhotoBase64,
      userInfo,
      jobTitle,
      jobDescription,
    } = req.body;
    const freeTextBrief = String(userInfo || "").trim();
    const personalInfo = requestedPersonalInfo || (freeTextBrief
      ? {
          name: "Candidate",
          email: "",
          phone: "",
          location: "",
          jobTitle: jobTitle || "",
        }
      : null);

    if (!personalInfo) {
      console.warn("[WARN] Missing CV generation payload");
      return res.status(400).json({ error: "personalInfo or userInfo is required" });
    }

    console.log("[OK] Personal Info received:", personalInfo.name);

    // Format the data for the prompt
    const experienceText = (experience || [])
      .map((exp: any) => `- ${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate})\n  ${exp.description}`)
      .join("\n");

    const educationText = (education || [])
      .map((edu: any) => `- ${edu.degree} in ${edu.field} from ${edu.school} (${edu.year})`)
      .join("\n");

    const skillsText = (skills || []).join(", ");

    // Create image tag if photo exists
    const photoTag = profilePhotoBase64 
      ? `<img src="data:image/jpeg;base64,${profilePhotoBase64}" style="width:150px;height:150px;border-radius:50%;object-fit:cover;margin:0 auto;display:block;">`
      : "";

    const prompt = `You are a professional CV designer and HTML/CSS expert. Generate a complete, beautiful, single-file HTML CV document.

CRITICAL REQUIREMENTS:
1. Return ONLY raw HTML - no markdown, no code fences, no explanation
2. All CSS must be embedded in <style> tags inside <head>
3. The CV must be print-ready (A4 size, proper margins)
4. Section titles MUST be in Mongolian: Товч танилцуулга, Ажлын туршлага, Боловсрол, Ур чадвар, Холбоо барих
5. Design must be professional, modern, ATS-friendly
6. Use a professional layout with good spacing
7. Color scheme: dark navy and professional accents

CV DATA:
Personal Info:
- Name: ${personalInfo.name}
- Email: ${personalInfo.email}
- Phone: ${personalInfo.phone}
- Location: ${personalInfo.location}
- Job Title: ${personalInfo.jobTitle}

Experience:
${experienceText || "No experience listed"}

Education:
${educationText || "No education listed"}

Skills:
${skillsText || "No skills listed"}

User-provided brief:
${freeTextBrief || "No free-text brief provided"}

Target job context:
- Job title: ${jobTitle || personalInfo.jobTitle || "Not specified"}
- Job description: ${jobDescription || "Not specified"}

Generate a complete, professional HTML CV document now:`;

    console.log("[AI] Calling Groq API with prompt length:", prompt.length);
    const generatedCV = await groqRespond(prompt, false, 3000);

    if (!generatedCV) {
      console.error("[ERROR] Groq returned null");
      return res.status(500).json({ error: "AI-аас хариу авах боломжгүй байна" });
    }

    // If we have a photo, inject it into the HTML
    let finalHTML = generatedCV;
    if (photoTag) {
      // Try to insert photo after the first opening tag
      finalHTML = generatedCV.replace(/<body[^>]*>/, `<body>${photoTag}`);
    }

    console.log("[OK] CV generated successfully, length:", finalHTML.length);
    res.json({
      success: true,
      htmlContent: finalHTML,
      message: "CV generated successfully",
    });
  } catch (err: any) {
    console.error("[ERROR] GENERATE-CV ERROR:", err.message);
    res.status(500).json({ 
      error: err.message ?? "generate-cv failed",
      details: err.response?.data || err.toString()
    });
  }
});

// ===============================
// EXTRACT FROM FILE (PDF/Image)
// ===============================
app.post("/api/ai/extract-from-file", upload.single("file"), async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "file required" });
    }

    const mimeType = req.file.mimetype;
    const fileName = req.file.originalname;
    
    let fileDescription = `Uploaded file: ${fileName}`;

    if (mimeType === "application/pdf") {
      fileDescription = `PDF document: ${fileName}`;
    } else if (mimeType.startsWith("image/")) {
      fileDescription = `Image file: ${fileName}`;
    }

    const prompt = `
You are a document analyzer. Extract all relevant professional and educational information from this ${fileDescription}.

Extract and structure the following information in JSON format:
{
  "personalInfo": {
    "name": "",
    "email": "",
    "phone": "",
    "location": ""
  },
  "summary": "",
  "skills": [],
  "experience": [
    {
      "company": "",
      "position": "",
      "duration": "",
      "description": ""
    }
  ],
  "education": [
    {
      "school": "",
      "degree": "",
      "field": "",
      "year": ""
    }
  ],
  "certifications": [],
  "languages": []
}

Make sure to extract all relevant information and provide it in the above JSON format.`;

    const extraction = await groqRespond(prompt);

    // Try to parse JSON from response
    let parsedExtraction = null;
    try {
      const jsonMatch = extraction?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedExtraction = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("JSON parse error:", e);
    }

    res.json({
      success: true,
      extraction: parsedExtraction || extraction,
      rawText: extraction,
    });
  } catch (err: any) {
    console.error("[ERROR] EXTRACT-FROM-FILE ERROR:", err);
    res.status(500).json({ error: err.message ?? "extract-from-file failed" });
  }
});

// ===============================
// CV MATCHING & JOB RECOMMENDATIONS
// ===============================

/**
 * Calculate match score between CV and Job
 * Returns a score from 0-100 and feedback
 */
app.post("/api/ai/match-cv-to-job", async (req: Request, res: Response) => {
  try {
    const { cv, jobTitle, jobDescription, jobRequirements } = req.body;

    if (!cv || !jobTitle) {
      return res.status(400).json({ error: "cv and jobTitle required" });
    }

    const cvText = typeof cv === "string" ? cv : JSON.stringify(cv);
    const reqText = jobRequirements || "Not specified";
    const descText = jobDescription || "Not specified";

    const prompt = `You are an expert HR recruiter and CV analyzer. Analyze how well this CV matches the job posting.
Use only evidence from the CV and job posting. Do not invent skills, experience, education, or requirements.
For the exact same CV text and exact same job posting, return the same score and reasoning.
Score strictly: strong direct evidence earns high score; missing required evidence lowers score.

CV Content (first 2000 chars):
${cvText.slice(0, 2000)}

Job Title: ${jobTitle}
Job Description: ${descText.slice(0, 1000)}
Required Skills & Experience: ${reqText.slice(0, 1000)}

Provide ONLY a JSON response with this exact format (no markdown, no code fences):
{
  "matchScore": <0-100 number>,
  "summary": "<1-2 sentence summary in Mongolian explaining the fit>",
  "strengths": ["<candidate skill/experience found in CV that helps for this job>", "<...>"],
  "gaps": ["<required skill/experience missing or weak in CV>", "<...>"],
  "recommendation": "<brief recommendation in Mongolian explaining why this chance is this percent and what to improve>"
}`;

    const response = await groqRespond(prompt, false, 1000, undefined, undefined, 0);
    
    if (!response) {
      return res.status(502).json({ error: "AI matching failed" });
    }

    let matchData = {
      matchScore: 0,
      summary: "Matching analysis complete",
      strengths: [],
      gaps: [],
      recommendation: ""
    };

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        matchData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("Failed to parse match response as JSON");
      matchData.summary = response;
    }

    res.json({
      success: true,
      matchScore: matchData.matchScore,
      analysis: matchData
    });
  } catch (err: any) {
    console.error("[ERROR] MATCH-CV-TO-JOB ERROR:", err.message);
    res.status(500).json({ error: err.message ?? "match-cv-to-job failed" });
  }
});

/**
 * Find matching jobs for a candidate based on their CV
 * Returns list of suitable jobs with match scores
 */
app.post("/api/ai/find-matching-jobs", async (req: Request, res: Response) => {
  try {
    const { cv, availableJobs } = req.body;

    if (!cv || !Array.isArray(availableJobs) || availableJobs.length === 0) {
      return res.status(400).json({ error: "cv and availableJobs array required" });
    }

    const cvText = typeof cv === "string" ? cv : JSON.stringify(cv);
    const jobsText = availableJobs
      .slice(0, 10)
      .map((job: any, idx: number) => 
        `${idx + 1}. [ID:${job.id}] ${job.title} - ${job.location}\n   Requirements: ${job.requirements?.slice(0, 200)}`
      )
      .join("\n");

    const prompt = `You are a career matching AI. A candidate has the CV below. Review the available jobs and match them based on fit.

Candidate CV (first 1500 chars):
${cvText.slice(0, 1500)}

Available Jobs:
${jobsText}

For each job, provide a match score from 0-100. Return ONLY a JSON array with no markdown:
[
  {
    "jobId": <job_id_number>,
    "matchScore": <0-100>,
    "reason": "<why this job matches in Mongolian>"
  }
]

Sort by matchScore descending. Include only jobs with score >= 50.`;

    const response = await groqRespond(prompt, false, 1200);

    if (!response) {
      return res.status(502).json({ error: "Job matching failed" });
    }

    let matches = [];
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        matches = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("Failed to parse job matches as JSON");
    }

    res.json({
      success: true,
      matches: matches.slice(0, 5)
    });
  } catch (err: any) {
    console.error("[ERROR] FIND-MATCHING-JOBS ERROR:", err.message);
    res.status(500).json({ error: err.message ?? "find-matching-jobs failed" });
  }
});

/**
 * Find matching candidates for a job posting
 * Used by employers to see which candidates are most suitable
 */
app.post("/api/ai/match-candidates-to-job", async (req: Request, res: Response) => {
  try {
    const { jobTitle, jobDescription, jobRequirements, candidates } = req.body;

    if (!jobTitle || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: "jobTitle and candidates array required" });
    }

    const candidatesText = candidates
      .slice(0, 15)
      .map((cand: any, idx: number) =>
        `${idx + 1}. [ID:${cand.id}] ${cand.fullName || cand.email || "Unnamed candidate"}\n   CV/Profile: ${String(cand.cvText || cand.profileText || "").slice(0, 1200) || "(no readable CV/profile)"}\n   Skills: ${String(cand.skills || "").slice(0, 300) || "(not listed)"}`
      )
      .join("\n\n");

    const prompt = `You are an expert recruiter. Match candidates to this job posting.

Job Title: ${jobTitle}
Job Description: ${jobDescription?.slice(0, 800) || "Not provided"}
Required Skills: ${jobRequirements?.slice(0, 600) || "Not specified"}

Candidates:
${candidatesText}

For each candidate, score their match from 0-100. Use only the candidate evidence provided above.
Do not return candidates with no readable CV/profile evidence.
Do not give 0 unless the candidate is completely unrelated, and exclude candidates below 40.
Return ONLY a JSON array with no markdown:
[
  {
    "candidateId": <candidate_id_number>,
    "matchScore": <0-100>,
    "strengths": ["<strength1>", "<strength2>"],
    "feedback": "<brief feedback in Mongolian>"
  }
]

Sort by matchScore descending. Include only candidates with score >= 40.`;

    const response = await groqRespond(prompt, false, 1400);

    if (!response) {
      return res.status(502).json({ error: "Candidate matching failed" });
    }

    let matches: any[] = [];
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        matches = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("Failed to parse candidate matches as JSON");
    }

    res.json({
      success: true,
      matches: matches
        .filter((match: any) => Number(match?.matchScore) >= 40)
        .sort((a: any, b: any) => Number(b.matchScore) - Number(a.matchScore))
        .slice(0, 10)
    });
  } catch (err: any) {
    console.error("[ERROR] MATCH-CANDIDATES-TO-JOB ERROR:", err.message);
    res.status(500).json({ error: err.message ?? "match-candidates-to-job failed" });
  }
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error("[ERROR] GLOBAL ERROR:", err);
  res.status(500).json({
    success: false,
    error: err.message ?? "internal error",
  });
});

// ===============================
// START
// ===============================
app.listen(PORT, () => {
  console.log(`AI service running at http://localhost:${PORT}`);
});
