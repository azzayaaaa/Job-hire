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
// ðŸ”¥ MIDDLEWARE
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

// DEBUG Ð±Ò¯Ñ… request body Ñ…Ð°Ñ€Ð½Ð°
app.use((req, _res, next) => {
  console.log("ðŸ“¦ BODY:", req.body);
  next();
});

// ===============================
// ðŸ”¥ ENV CHECK
// ===============================
if (!process.env.GROQ_API_KEY) {
  console.error("âŒ GROQ_API_KEY not found");
  process.exit(1);
}

const GROQ_API_KEY = process.env.GROQ_API_KEY.trim();

console.log(
  "âœ… GROQ key:",
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
): Promise<string | null> {
  const messages = normalizeGroqMessages(input, useMongoliPrompt, history, systemContext);

  try {
    const resp = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_TEXT_MODEL,
        messages,
        temperature: useMongoliPrompt ? 0.55 : 0.7,
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
      console.log("âœ… GROQ Response:", responseText.slice(0, 100));
      return responseText;
    }
    
    console.warn("âš ï¸ GROQ returned empty response:", JSON.stringify(data));
    return null;
  } catch (err: any) {
    console.error("âŒ GROQ API Error:", {
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
    console.error("âŒ GROQ Vision Error:", {
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
// ðŸ§ª TEST ROUTE
// ===============================
app.get("/test", async (_req, res) => {
  try {
    console.log("ðŸ§ª Testing GROQ API...");
    const reply = await groqRespond("What is 2+2?", false);
    res.json({
      success: true,
      reply,
    });
  } catch (e: any) {
    console.error("âŒ TEST ERROR:", e.message);
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
        error: "âŒ prompt or message missing",
      });
    }

    const prompt = extractCurrentUserPrompt(rawPrompt);

    console.log("Processing AI request:", prompt.slice(0, 50));
    
    const answer = await groqRespond(prompt, true, 1200, history, systemContext);

    if (!answer) {
      console.warn("âš ï¸ GROQ returned null answer for prompt:", prompt);
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
    console.error("âŒ ASK ERROR:", err.message);
    res.status(500).json({ 
      success: false,
      error: err.message ?? "AI request failed",
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

    const basePrompt = `
Ð¢Ð° Ð°Ð¶Ð»Ñ‹Ð½ Ð¿Ð»Ð°Ñ‚Ñ„Ð¾Ñ€Ð¼Ñ‹Ð½ ÐºÐ°Ñ€ÑŒÐµÑ€Ð¸Ð¹Ð½ Ð·Ó©Ð²Ð»Ó©Ñ… AI.
Ð¥ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡ Ñ„Ð°Ð¹Ð», CV, Ð°Ð¶Ð»Ñ‹Ð½ Ð·Ð°Ñ€Ñ‹Ð½ Ñ…Ð¾Ð»Ð±Ð¾Ð¾Ñ ÑÑÐ²ÑÐ» Ð°Ð¶Ð»Ñ‹Ð½ Ð¼ÑÐ´ÑÑÐ»ÑÐ» Ð¸Ð»Ð³ÑÑÐ¶ Ð±Ð¾Ð»Ð½Ð¾.

Ð—Ð°Ð°Ð²Ð°Ñ€:
1. Ð—Ó©Ð²Ñ…Ó©Ð½ Ð¼Ð¾Ð½Ð³Ð¾Ð»Ð¾Ð¾Ñ€ Ñ…Ð°Ñ€Ð¸ÑƒÐ».
2. CV Ð±Ð¾Ð»Ð¾Ð½ Ð°Ð¶Ð»Ñ‹Ð½ Ð·Ð°Ñ€Ñ‹Ð½ Ñ‚Ð¾Ñ…Ð¸Ñ€Ð»Ñ‹Ð³ Ò¯Ð½ÑÐ½ÑÑÑ€ Ð´Ò¯Ð³Ð½Ñ. Ð¥ÑÑ‚ Ð¼Ð°Ð³Ñ‚Ð°Ñ…Ð³Ò¯Ð¹.
3. Ð¢Ð¾Ñ…Ð¸Ñ€Ð»Ñ‹Ð½ Ñ…ÑƒÐ²Ð¸Ð¹Ð³ Ð¾Ð¹Ñ€Ð¾Ð»Ñ†Ð¾Ð¾Ð³Ð¾Ð¾Ñ€ Ó©Ð³.
4. Ð¯Ð°Ð³Ð°Ð°Ð´ Ñ‚Ð¾Ñ…Ð¸Ñ€Ñ‡/Ñ‚Ð¾Ñ…Ð¸Ñ€Ð¾Ñ…Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð³Ð°Ð°Ð³ Ñ‚Ð¾Ð²Ñ‡, Ñ‚Ð¾Ð´Ð¾Ñ€Ñ…Ð¾Ð¹ Ñ…ÑÐ».
5. Ð”ÑƒÑ‚ÑƒÑƒ ÑƒÑ€ Ñ‡Ð°Ð´Ð²Ð°Ñ€, ÑÐ°Ð¹Ð¶Ñ€ÑƒÑƒÐ»Ð°Ñ… Ð·Ó©Ð²Ð»Ó©Ð³Ó©Ó©Ð³ Ð¶Ð°Ð³ÑÐ°Ð°.
6. Ð”Ð¾Ð¾Ñ€Ñ… Ð°Ð¶Ð»Ñ‹Ð½ Ð¶Ð°Ð³ÑÐ°Ð°Ð»Ñ‚Ð°Ð°Ñ Ñ‚Ð¾Ñ…Ð¸Ñ€Ð¾Ñ… Ð°Ð¶Ð»ÑƒÑƒÐ´ Ð±Ð°Ð¹Ð²Ð°Ð» 3 Ñ…Ò¯Ñ€Ñ‚ÑÐ» ÑÐ°Ð½Ð°Ð» Ð±Ð¾Ð»Ð³Ð¾.

Ð¥ÑÑ€ÑÐ³Ð»ÑÐ³Ñ‡Ð¸Ð¹Ð½ Ð±Ð¸Ñ‡ÑÑÐ½ Ð·Ò¯Ð¹Ð»:
${message || "(Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹)"}

Ð¤Ð°Ð¹Ð»Ñ‹Ð½ Ð½ÑÑ€: ${file?.originalname || "(Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹)"}
Ð¤Ð°Ð¹Ð»Ð°Ð°Ñ ÑƒÐ½ÑˆÑÐ°Ð½ Ñ‚ÐµÐºÑÑ‚:
${extractedText || "(Ñ‚ÐµÐºÑÑ‚ ÑƒÐ½ÑˆÐ¸Ð³Ð´Ð°Ð°Ð³Ò¯Ð¹ ÑÑÐ²ÑÐ» Ð·ÑƒÑ€Ð°Ð³ Ñ„Ð°Ð¹Ð» Ð±Ð°Ð¹Ð½Ð°)"}

ÐžÐ´Ð¾Ð¾Ð³Ð¸Ð¹Ð½ Ð±Ð¾Ð»Ð¾Ð¼Ð¶Ð¸Ñ‚ Ð°Ð¶Ð»ÑƒÑƒÐ´:
${jobsContext || "(Ð°Ð¶Ð»Ñ‹Ð½ Ð¶Ð°Ð³ÑÐ°Ð°Ð»Ñ‚ Ð¸Ñ€ÑÑÐ³Ò¯Ð¹)"}
`;

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
    console.error("âŒ ASK-FILE ERROR:", {
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

    // Ñ‚Ò¯Ñ€ dummy (pdf parse Ð°Ð»Ð´Ð°Ð° Ð³Ð°Ñ€Ð³Ð°Ñ…Ð³Ò¯Ð¹Ð½ Ñ‚ÑƒÐ»Ð´)
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
    console.error("âŒ PARSE ERROR:", err);
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
    console.error("âŒ ANALYZE-CV ERROR:", err);
    res.status(500).json({ error: err.message ?? "analyze-cv failed" });
  }
});

/**
 * ===============================
 * SKILL GAP ANALYSIS
 * ===============================
 * Hardened to avoid Groq 500s caused by:
 * - non-string CV payloads
 * - excessively large CV text (prompt too big / context overflow)
 * - occasional upstream â€œinput too largeâ€ errors
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

    console.error("âŒ SKILL-GAP-ANALYSIS ERROR:", details);

    const detailsString = typeof details === "string" ? details : JSON.stringify(details);
    res.status(502).json({
      error: "skill-gap-analysis failed",
      details: detailsString,
    });
  }
});

// ===============================
// GENERATE/ENHANCE CV
// ===============================
app.post("/api/ai/generate-cv", async (req: any, res: Response) => {
  try {
    console.log("ðŸ“¨ CV Generate request received");
    const { personalInfo, experience, education, skills, profilePhotoBase64 } = req.body;

    if (!personalInfo) {
      console.warn("âš ï¸ Missing personalInfo");
      return res.status(400).json({ error: "personalInfo is required" });
    }

    console.log("âœ… Personal Info received:", personalInfo.name);

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
1. Return ONLY raw HTML â€” no markdown, no code fences, no explanation
2. All CSS must be embedded in <style> tags inside <head>
3. The CV must be print-ready (A4 size, proper margins)
4. Section titles MUST be in Mongolian: Ð¢Ð¾Ð²Ñ‡ Ñ‚Ð°Ð½Ð¸Ð»Ñ†ÑƒÑƒÐ»Ð³Ð°, ÐÐ¶Ð»Ñ‹Ð½ Ñ‚ÑƒÑ€ÑˆÐ»Ð°Ð³Ð°, Ð‘Ð¾Ð»Ð¾Ð²ÑÑ€Ð¾Ð», Ð£Ñ€ Ñ‡Ð°Ð´Ð²Ð°Ñ€, Ð¥Ð¾Ð»Ð±Ð¾Ð¾ Ð±Ð°Ñ€Ð¸Ñ…
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

Generate a complete, professional HTML CV document now:`;

    console.log("ðŸ¤– Calling Groq API with prompt length:", prompt.length);
    const generatedCV = await groqRespond(prompt, false, 3000);

    if (!generatedCV) {
      console.error("âŒ Groq returned null");
      return res.status(500).json({ error: "AI-Ð°Ð°Ñ Ñ…Ð°Ñ€Ð¸Ñƒ Ð°Ð²Ð°Ñ… Ð±Ð¾Ð»Ð¾Ð¼Ð¶Ð³Ò¯Ð¹ Ð±Ð°Ð¹Ð½Ð°" });
    }

    // If we have a photo, inject it into the HTML
    let finalHTML = generatedCV;
    if (photoTag) {
      // Try to insert photo after the first opening tag
      finalHTML = generatedCV.replace(/<body[^>]*>/, `<body>${photoTag}`);
    }

    console.log("âœ… CV Generated successfully, length:", finalHTML.length);
    res.json({
      success: true,
      htmlContent: finalHTML,
      message: "CV generated successfully",
    });
  } catch (err: any) {
    console.error("âŒ GENERATE-CV ERROR:", err.message);
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
    console.error("âŒ EXTRACT-FROM-FILE ERROR:", err);
    res.status(500).json({ error: err.message ?? "extract-from-file failed" });
  }
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error("ðŸ’¥ GLOBAL ERROR:", err);
  res.status(500).json({
    success: false,
    error: err.message ?? "internal error",
  });
});

// ===============================
// START
// ===============================
app.listen(PORT, () => {
  console.log(`ðŸš€ http://localhost:${PORT}`);
});
