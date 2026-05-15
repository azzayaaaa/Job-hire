"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Download,
  Eye,
  Gem,
  MessageCircle,
  Printer,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { authenticatedFetch, authenticatedPatch, authenticatedPost } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import { useAlert } from "@/components/AlertProvider";

type AiMode = "cv" | "growth" | "jobs" | "chat";
type CvForm = {
  name: string;
  title: string;
  phone: string;
  email: string;
  location: string;
  linkedin: string;
  website: string;
  summary: string;
  skills: string;
  experience: string;
  education: string;
};
type AiMessage = {
  role: "user" | "assistant";
  text: string;
  cvHtml?: string;
  showUpgradeButton?: boolean;
  todoSuggestion?: {
    title: string;
    note: string;
  };
  todoAdded?: boolean;
  roadmapAdded?: boolean;
  roadmapLoading?: boolean;
  actions?: Array<{
    type: "candidate-chat" | "job-focus";
    label: string;
    payload: Record<string, unknown>;
  }>;
};
type MessageStore = Record<string, AiMessage[]>;
type LooseRecord = Record<string, unknown>;

const candidateModes: { key: AiMode; label: string; Icon: React.ElementType }[] = [
  { key: "cv", label: "CV бэлдэх", Icon: Printer },
  { key: "growth", label: " Өөрийгөө хөгжүүлэх", Icon: Sparkles },
  { key: "jobs", label: "Тохирох ажил хайх", Icon: Briefcase },
];

const employerModes: { key: AiMode; label: string; Icon: React.ElementType }[] = [
  { key: "growth", label: "Ажилтан хайх", Icon: Users },
  { key: "chat", label: "Энгийн чат", Icon: MessageCircle },
];

const cvFields: { key: keyof CvForm; placeholder: string; wide?: boolean }[] = [
  { key: "name", placeholder: "Нэр" },
  { key: "title", placeholder: "Мэргэжил" },
  { key: "phone", placeholder: "Утас" },
  { key: "email", placeholder: "И-мэйл" },
  { key: "location", placeholder: "Байршил", wide: true },
  { key: "linkedin", placeholder: "LinkedIn холбоос", wide: true },
  { key: "website", placeholder: "Portfolio / website", wide: true },
  { key: "summary", placeholder: "Товч танилцуулга", wide: true },
  { key: "skills", placeholder: "Ур чадвар", wide: true },
  { key: "experience", placeholder: "Туршлага", wide: true },
  { key: "education", placeholder: "Боловсрол", wide: true },
];

const initialCvForm: CvForm = {
  name: "",
  title: "",
  phone: "",
  email: "",
  location: "",
  linkedin: "",
  website: "",
  summary: "",
  skills: "",
  experience: "",
  education: "",
};

function getSystemPrompt(mode: AiMode) {
  const base =
    "Чи JobHub платформын AI туслах. Зөвхөн Монгол хэлээр, эелдэг, соёлтой, ойлгомжтой хариул. Монгол үгийн санд байхгүй зохиомол үг, англи үг, гадаад хэлний хольц ашиглахгүй. Хэрэглэгчийн асуултад тулгуурлаж үнэн зөв, хэрэгтэй хариул.";
  if (mode === "cv") {
    return `${base} Хэрэглэгч CV бэлдэх горим сонгосон. Мэдээлэл дутуу бол богино асуултаар тодруул. HTML, CSS, код, div tag огт битгий харуул. Зөвхөн CV-д оруулах агуулгыг цэгцтэй Монгол хэлээр санал болго.`;
  }
  if (mode === "growth") {
    return `${base} Хэрэглэгч ажилтан хайх горим сонгосон. Ажил олгогчид тохирох ажилтан хайх, шалгуур тодорхойлох, зарын шаардлага боловсруулах, кандидатыг үнэлэх талаар бодит, хэрэгжих зөвлөгөө өг.`;
  }
  return `${base} Хэрэглэгч энгийн чат горим сонгосон. Товч, найрсаг, хэрэгтэй байдлаар ярилц.`;
}

function getAiModeContext(mode: AiMode) {
  const base =
    "Чи JobHub платформын AI туслах. Монгол хэлээр найрсаг, шууд, хэрэгтэй хариул. Хэрэглэгч латинаар монгол бичсэн ч ойлго. Өмнөх ярианы утгыг барьж, дахин дахин мэндчилгээ давтахгүй.";

  if (mode === "cv") {
    return `${base} CV горимд байгаа тул CV бичих, засах, сайжруулах тал дээр бодитой зөвлөгөө өг. HTML/CSS код бүү гарга, зөвхөн CV-д орох агуулга санал болго.`;
  }

  if (mode === "growth") {
    return `${base} Ажилтан хайх горимд байгаа тул ажлын зар, шаардлага, ярилцлагын асуулт, кандидат үнэлгээний талаар хэрэгжихүйц зөвлөгөө өг.`;
  }

  return `${base} Энгийн чат горимд байгаа тул товч, ойлгомжтой, ярианы өнгөөр хариул.`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLines(value: string) {
  const safe = escapeHtml(value.trim());
  return safe || "Мэдээлэл оруулаагүй";
}

function listItems(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function getProfilePhoto(userId?: number | string) {
  if (typeof window === "undefined" || !userId) return "";
  try {
    return JSON.parse(localStorage.getItem(`userProfile_${userId}`) || "{}")?.photo || "";
  } catch {
    return "";
  }
}

function getSavedProfile(userId?: number | string) {
  if (typeof window === "undefined" || !userId) return null;
  try {
    return JSON.parse(localStorage.getItem(`userProfile_${userId}`) || "null") as {
      lastName?: string;
      firstName?: string;
      phone?: string;
      photo?: string;
    } | null;
  } catch {
    return null;
  }
}

function buildCvFromForm(form: CvForm, userId?: number | string) {
  const photo = getProfilePhoto(userId);
  const missing = getMissingCvFields(form);
  if (missing.length) return "";

  const contactLines = [
    form.email,
    form.linkedin,
    form.website,
    form.phone,
    form.location,
  ].filter(Boolean);
  const skills = listItems(form.skills);

  return `<!doctype html>
<html lang="mn">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e9eef5;
      color: #202838;
      font-family: Georgia, "Times New Roman", serif;
    }
    .cv-page {
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      position: relative;
      background: #ffffff;
      overflow: hidden;
    }
    .template {
      position: absolute;
      inset: 0;
      background: url("/cv.avif") center / 100% 100% no-repeat;
      opacity: 0.08;
    }
    .gold {
      position: absolute;
      inset: 0 0 auto 0;
      height: 59mm;
      background: #ddb75f;
    }
    .left-bg {
      position: absolute;
      left: 0;
      top: 59mm;
      bottom: 0;
      width: 77mm;
      background: #f2eadb;
    }
    .right-bg {
      position: absolute;
      left: 77mm;
      right: 0;
      top: 59mm;
      bottom: 0;
      background: #ffffff;
    }
    .photo-frame {
      position: absolute;
      left: 16mm;
      top: 15mm;
      width: 61mm;
      height: 82mm;
      background: #f6efe2;
      border: 8px solid #f6efe2;
      z-index: 2;
      overflow: hidden;
    }
    .profile-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      display: block;
    }
    .photo-placeholder {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      color: #8b7652;
      font: 700 12px Arial, sans-serif;
      text-transform: uppercase;
    }
    .block {
      position: absolute;
      color: #252d3b;
      z-index: 3;
    }
    h1 {
      margin: 0;
      color: #ffffff;
      font-size: 32px;
      line-height: 1.05;
      letter-spacing: 0;
      text-transform: uppercase;
      font-weight: 700;
    }
    .title {
      margin: 5mm 0 0;
      color: #ffffff;
      font-family: Arial, sans-serif;
      font-size: 13px;
      letter-spacing: 0;
      text-transform: uppercase;
      font-weight: 700;
    }
    h2 {
      margin: 0 0 4mm;
      color: #252d3b;
      font-size: 14px;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 1.4px;
    }
    p, li {
      margin: 0;
      color: #2f3746;
      font-size: 10px;
      line-height: 1.52;
      white-space: pre-wrap;
    }
    .name-block { left: 124mm; top: 16mm; width: 64mm; }
    .contact-block { left: 16mm; top: 108mm; width: 51mm; }
    .skills-block { left: 16mm; top: 175mm; width: 51mm; }
    .summary-block { left: 95mm; top: 75mm; width: 88mm; }
    .experience-block { left: 95mm; top: 132mm; width: 88mm; }
    .education-block { left: 95mm; top: 236mm; width: 88mm; }
    .contact-line {
      margin-bottom: 3mm;
      font-family: Arial, sans-serif;
      font-size: 9.5px;
      color: #454d59;
      word-break: break-word;
    }
    ul {
      margin: 0;
      padding-left: 4mm;
    }
    li {
      margin-bottom: 2.1mm;
    }
    .experience-text {
      max-height: 76mm;
      overflow: hidden;
    }
    .education-text {
      max-height: 35mm;
      overflow: hidden;
    }
    @media print {
      body { background: #ffffff; }
      .cv-page { margin: 0; }
    }
  </style>
</head>
<body>
  <main class="cv-page">
    <div class="template"></div>
    <div class="gold"></div>
    <div class="left-bg"></div>
    <div class="right-bg"></div>
    <div class="photo-frame">
      ${photo ? `<img class="profile-photo" src="${escapeHtml(photo)}" alt="" />` : `<div class="photo-placeholder">Profile photo</div>`}
    </div>

    <section class="block name-block">
      <h1>${formatLines(form.name)}</h1>
      <p class="title">${formatLines(form.title)}</p>
    </section>

    <section class="block contact-block">
      ${contactLines.map((line) => `<p class="contact-line">${escapeHtml(line)}</p>`).join("")}
    </section>

    <section class="block skills-block">
      <h2>Skills</h2>
      <ul>${skills || `<li>${formatLines(form.skills)}</li>`}</ul>
    </section>

    <section class="block summary-block">
      <h2>Profile</h2>
      <p>${formatLines(form.summary)}</p>
    </section>

    <section class="block experience-block">
      <h2>Experience</h2>
      <p class="experience-text">${formatLines(form.experience)}</p>
    </section>

    <section class="block education-block">
      <h2>Education</h2>
      <p class="education-text">${formatLines(form.education)}</p>
    </section>
  </main>
</body>
</html>`;
}

function withProfileDefaults(form: CvForm, userId?: number | string): CvForm {
  const profile = getSavedProfile(userId);
  if (!profile) return form;

  const profileName = [profile.lastName, profile.firstName].filter(Boolean).join(" ");
  return {
    ...form,
    name: form.name.trim() || profileName,
    phone: form.phone.trim() || profile.phone || "",
  };
}

function getMissingCvFields(form: CvForm) {
  const required: { key: keyof CvForm; label: string }[] = [
    { key: "name", label: "нэр" },
    { key: "title", label: "мэргэжил / хүсэж буй албан тушаал" },
    { key: "phone", label: "утас" },
    { key: "email", label: "и-мэйл" },
    { key: "summary", label: "товч танилцуулга" },
    { key: "skills", label: "ур чадвар" },
    { key: "experience", label: "ажлын туршлага" },
    { key: "education", label: "боловсрол" },
  ];

  return required.filter(({ key }) => !form[key].trim()).map(({ label }) => label);
}

function getSavedAiCvKey(userId?: number | string) {
  return `jobhub-ai-generated-cv-${userId || "guest"}`;
}

function buildCvPlainText(form: CvForm) {
  return [
    `Нэр: ${form.name}`,
    `Мэргэжил: ${form.title}`,
    `Утас: ${form.phone}`,
    `И-мэйл: ${form.email}`,
    `Байршил: ${form.location}`,
    form.linkedin ? `LinkedIn: ${form.linkedin}` : "",
    form.website ? `Portfolio: ${form.website}` : "",
    `Товч танилцуулга: ${form.summary}`,
    `Ур чадвар: ${form.skills}`,
    `Туршлага: ${form.experience}`,
    `Боловсрол: ${form.education}`,
  ].filter(Boolean).join("\n");
}

function loadSavedAiCv(userId?: number | string): { html: string; text: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(getSavedAiCvKey(userId));
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { html?: string; text?: string };
    if (!parsed.html) return null;
    return { html: parsed.html, text: parsed.text || "" };
  } catch {
    return null;
  }
}

function loadLatestCvFromMessages(userId?: number | string): { html: string; text: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(`jobhub-ai-${userId || "guest"}-cv`);
    const messages = saved ? JSON.parse(saved) as AiMessage[] : [];
    const cvMessage = [...messages].reverse().find((message) => message.cvHtml);
    return cvMessage?.cvHtml ? { html: cvMessage.cvHtml, text: "" } : null;
  } catch {
    return null;
  }
}

function getNonCyrillicCvFields(form: CvForm) {
  const fields: { key: keyof CvForm; label: string }[] = [
    { key: "name", label: "нэр" },
    { key: "title", label: "мэргэжил" },
    { key: "location", label: "байршил" },
    { key: "summary", label: "товч танилцуулга" },
    { key: "skills", label: "ур чадвар" },
    { key: "experience", label: "туршлага" },
    { key: "education", label: "боловсрол" },
  ];

  return fields
    .filter(({ key }) => /[A-Za-z]/.test(form[key]))
    .map(({ label }) => label);
}

function loadMessages(storageKey: string): AiMessage[] {
  if (typeof window === "undefined") {
    return [{ role: "assistant", text: "Сайн байна уу. Та ямар тусламж авах вэ?" }];
  }

  try {
    const saved = localStorage.getItem(storageKey);
    return saved
      ? JSON.parse(saved)
      : [{ role: "assistant", text: "Сайн байна уу. Та ямар тусламж авах вэ?" }];
  } catch {
    return [{ role: "assistant", text: "Сайн байна уу. Та ямар тусламж авах вэ?" }];
  }
}

function shouldSuggestTodo(mode: AiMode, role: "candidate" | "employer", text: string) {
  if (role !== "candidate") return false;
  const normalized = text.toLowerCase();
  const keywords = [
    "сурах",
    "сайжруулах",
    "хөгж",
    "дадлага",
    "зорилго",
    "ур чадвар",
    "skill",
    "learn",
    "improve",
    "career",
    "cv",
    "portfolio",
    "ярилцлага",
    "surah",
    "suraltsah",
    "hugjuuleh",
    "hogjvvleh",
    "ooriigoo",
    "uuriiguu",
    "zorilgo",
    "chadvar",
    "html",
    "css",
    "javascript",
    "js",
    "typescript",
    "react",
    "next",
    "python",
    "sql",
    "figma",
  ];
  return keywords.some((keyword) => normalized.includes(keyword));
}

function buildTodoSuggestion(userText: string, aiText: string) {
  const cleanUserText = userText.replace(/\s+/g, " ").trim();
  const cleanAiText = aiText.replace(/\s+/g, " ").trim();
  return {
    title: cleanUserText.length > 80 ? `${cleanUserText.slice(0, 80)}...` : cleanUserText,
    note: cleanAiText.length > 260 ? `${cleanAiText.slice(0, 260)}...` : cleanAiText,
  };
}

function addSelfImprovementTodo(userId: number | string | undefined, suggestion: { title: string; note: string }) {
  if (typeof window === "undefined" || !userId) return;
  const key = `selfImprovementTodos_${userId}`;
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  const next = [
    {
      id: Date.now(),
      title: suggestion.title,
      note: suggestion.note,
      done: false,
      source: "AI",
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, 100);
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("jobhub:self-improvement-todos-updated", { detail: { userId } }));
}

function appendSelfImprovementTodos(
  userId: number | string | undefined,
  nextTodos: Array<Record<string, unknown>>,
) {
  if (typeof window === "undefined" || !userId || !nextTodos.length) return;
  const key = `selfImprovementTodos_${userId}`;
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  localStorage.setItem(key, JSON.stringify([...nextTodos, ...existing].slice(0, 160)));
  window.dispatchEvent(new CustomEvent("jobhub:self-improvement-todos-updated", { detail: { userId } }));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function extractJobIdFromText(text: string) {
  const patterns = [
    /[?&]job=(\d+)/i,
    /\/dashboard\/candidate\?[^ \n]*job=(\d+)/i,
    /\/jobs?\/(\d+)/i,
    /\bjob\s*#?\s*(\d+)\b/i,
    /\bажил\s*#?\s*(\d+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }

  return null;
}

function includesAny(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function formatCandidateJobMatch(job: LooseRecord, analysis: LooseRecord) {
  const nestedAnalysis = analysis.analysis && typeof analysis.analysis === "object"
    ? analysis.analysis as LooseRecord
    : {};
  const score = Number(analysis.matchScore ?? nestedAnalysis.matchScore ?? 0);
  const strengths = Array.isArray(nestedAnalysis.strengths) ? nestedAnalysis.strengths.slice(0, 3) : [];
  const gaps = Array.isArray(nestedAnalysis.gaps) ? nestedAnalysis.gaps.slice(0, 3) : [];

  return [
    `"${String(job.title || "энэ ажил")}" дээр таны CV-ийн тохирол: ${score}%.`,
    String(nestedAnalysis.summary || ""),
    strengths.length ? `Давуу тал: ${strengths.join(", ")}.` : "",
    gaps.length ? `Анхаарах зүйл: ${gaps.join(", ")}.` : "",
    String(nestedAnalysis.recommendation || ""),
  ].filter(Boolean).join("\n\n");
}

function formatJobRecommendations(items: LooseRecord[]) {
  if (!items.length) return { text: "Таны хадгалсан CV-д тохирох ажил одоогоор олдсонгүй.", actions: [] };

  return {
    text: [
      "Таны CV-г уншаад database дахь ажлын заруудаас хамгийн ойр тохирохыг оллоо:",
      ...items.slice(0, 5).map((job, index) => {
        const employer = job.employer && typeof job.employer === "object" ? job.employer as LooseRecord : {};
        const company = employer.fullName || job.company || "Компани";
        const email = employer.email ? ` | ${String(employer.email)}` : "";
        const reason = job.matchReason ? `\n   Шалтгаан: ${String(job.matchReason)}` : "";
        return `${index + 1}. ${String(job.title || "Ажлын байр")} - ${String(company)}${email} (${Number(job.matchScore ?? 0)}%)${reason}`;
      }),
      "Доорх email товчийг дарахад тухайн ажлын зар руу шууд очиж ялгарч харагдана.",
    ].join("\n"),
    actions: items.slice(0, 5).map((job) => {
      const employer = job.employer && typeof job.employer === "object" ? job.employer as LooseRecord : {};
      return {
        type: "job-focus" as const,
        label: String(employer.email || job.title || `Job #${String(job.id || "")}`),
        payload: { jobId: Number(job.id) },
      };
    }).filter((action) => Number(action.payload.jobId) > 0),
  };
}

function formatCandidateRecommendations(items: LooseRecord[]) {
  if (!items.length) return { text: "Тохирох CV хадгалсан кандидат одоогоор олдсонгүй.", actions: [] };

  return {
    text: [
      "Database дахь бүх хадгалсан CV-г уншаад хамгийн тохиромжтой кандидатуудыг оллоо:",
      ...items.slice(0, 10).map((candidate, index) => {
        const contact = candidate.email ? `, ${String(candidate.email)}` : "";
        const strengths = Array.isArray(candidate.strengths) && candidate.strengths.length
          ? `\n   Давуу тал: ${candidate.strengths.slice(0, 3).join(", ")}`
          : "";
        const feedback = candidate.feedback ? `\n   AI дүгнэлт: ${String(candidate.feedback)}` : "";
        return `${index + 1}. ${String(candidate.fullName || "Нэргүй кандидат")}${contact} (${Number(candidate.matchScore ?? 0)}%)${strengths}${feedback}`;
      }),
      "Доорх email товчийг дарахад шууд Messages хэсэг рүү орж чат эхэлнэ.",
    ].join("\n"),
    actions: items.slice(0, 10).map((candidate) => ({
      type: "candidate-chat" as const,
      label: String(candidate.email || candidate.fullName || `Candidate #${String(candidate.id || "")}`),
      payload: {
        id: Number(candidate.id),
        email: String(candidate.email || ""),
        fullName: String(candidate.fullName || candidate.email || "Candidate"),
        phone: String(candidate.phone || ""),
      },
    })).filter((action) => Number(action.payload.id) > 0),
  };
}

function CvPreviewModal({
  htmlContent,
  onClose,
  canDownload,
}: {
  htmlContent: string;
  onClose: () => void;
  canDownload: boolean;
}) {
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const downloadRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    if (downloadRef.current) {
      downloadRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  const downloadPdf = async () => {
    if (!downloadRef.current || downloading) return;
    if (!canDownload) {
      showAlert("Та Pro plan болсон үед CV-г татаж авч болно.", "warning");
      return;
    }
    setDownloading(true);
    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;

      await html2pdf()
        .set({
          margin: 0,
          filename: `JobHub-CV-${Date.now()}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(downloadRef.current.querySelector(".cv-page") || downloadRef.current)
        .save();
    } catch (error) {
      console.error("PDF download error:", error);
      showAlert("PDF татахад алдаа гарлаа. Хэвлэх товчоор PDF болгон хадгалаад үзээрэй.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const printCv = () => {
    if (!canDownload) {
      showAlert("Та Pro plan болсон үед CV-г хэвлэх боломжтой.", "warning");
      return;
    }
    const frameWindow = printFrameRef.current?.contentWindow;
    if (!frameWindow) return;
    frameWindow.focus();
    frameWindow.print();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:items-center">
      <div className="my-3 flex h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl sm:h-[92dvh]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
          <div>
            <p className="text-sm font-bold text-gray-900">CV урьдчилсан харагдац</p>
            <p className="text-xs text-gray-500">public/cv.avif дизайнтай PDF болгон татна</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Хаах"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-3">
          <iframe
            ref={printFrameRef}
            srcDoc={htmlContent}
            className="w-full h-full bg-white border-0 rounded-lg"
            title="CV preview"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-white">
          <button
            onClick={printCv}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200"
          >
            <Printer size={15} /> Хэвлэх
          </button>
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download size={15} /> {downloading ? "Татаж байна..." : "PDF татах"}
          </button>
        </div>
      </div>

      <div
        ref={downloadRef}
        className="pointer-events-none fixed left-[-10000px] top-0 bg-white"
        aria-hidden="true"
      />
    </div>
  );
}

export default function AiAssistantPanel({
  open,
  onClose,
  userId,
  role = "candidate",
}: {
  open: boolean;
  onClose: () => void;
  userId?: number | string;
  role?: "candidate" | "employer";
}) {
  const availableModes = role === "employer" ? employerModes : candidateModes;
  const defaultMode = availableModes[0]?.key ?? "chat";
  const [mode, setMode] = useState<AiMode>(defaultMode);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageStore, setMessageStore] = useState<MessageStore>({});
  const [cvForm, setCvForm] = useState<CvForm>(initialCvForm);
  const [previewHtml, setPreviewHtml] = useState("");
  const [savedCv, setSavedCv] = useState<{ html: string; text: string } | null>(null);
  const [proActive, setProActive] = useState(false);
  const [expandedCvSection, setExpandedCvSection] = useState<string>("personal");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const storageKey = useMemo(() => `jobhub-ai-${userId || "guest"}-${mode}`, [userId, mode]);
  const messages = messageStore[storageKey] ?? loadMessages(storageKey);

  useEffect(() => {
    setSavedCv(loadSavedAiCv(userId) || loadLatestCvFromMessages(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProActive(false);
      return;
    }

    let cancelled = false;
    authenticatedFetch(API_URLS.user.entitlements(userId))
      .then((res) => {
        if (!cancelled) setProActive(res.data?.proActive === true);
      })
      .catch(() => {
        if (!cancelled) setProActive(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!availableModes.some((item) => item.key === mode)) {
      setMode(defaultMode);
    }
  }, [availableModes, defaultMode, mode]);

  const setMessagesForCurrentKey = (
    updater: AiMessage[] | ((previous: AiMessage[]) => AiMessage[]),
  ) => {
    setMessageStore((previousStore) => {
      const previousMessages = previousStore[storageKey] ?? loadMessages(storageKey);
      const nextMessages =
        typeof updater === "function" ? updater(previousMessages) : updater;
      return { ...previousStore, [storageKey]: nextMessages };
    });
  };

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages.slice(-100)));
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, storageKey]);

  const handleStructuredAiRequest = async (
    userText: string,
    previousMessages: AiMessage[],
  ): Promise<{ text: string; actions?: AiMessage["actions"] } | null> => {
    if (!userId) return null;

    const recentUserContext = previousMessages
      .filter((message) => message.role === "user")
      .slice(-2)
      .map((message) => message.text)
      .join(" ");
    const searchContext = `${recentUserContext} ${userText}`.trim();
    const jobId = extractJobIdFromText(searchContext);
    const asksForOwnJobFit = includesAny(searchContext, [
      "her tohir",
      "хэр тохир",
      "tohirj",
      "тохирч",
      "ene ajild",
      "энэ ажилд",
      "match",
      "fit",
    ]);
    const asksForJobs = includesAny(searchContext, [
      "tohiroh ajil",
      "тохирох ажил",
      "hamgiin tohiroh ajil",
      "hamgiin tohiromjtoi ajil",
      "хамгийн тохирсон ажил",
      "хамгийн тохиромжтой ажил",
      "ажил олж",
      "ажил олж өг",
      "ажлыг ол",
      "ажил санал",
      "nadad ajil",
      "надад ажил",
      "job recommend",
    ]);
    const asksForCandidates = includesAny(searchContext, [
      "tohiroh hun",
      "тохирох хүн",
      "candidate",
      "ажилтан ол",
      "hun olj",
      "хүн олж",
      "хүн хэрэгтэй",
      "hun heregtei",
      "meddeg hun",
      "мэддэг хүн",
      "олдоод өг",
      "olood og",
      "хайж өг",
    ]);

    if (role === "candidate" && jobId && asksForOwnJobFit) {
      const [profileRes, jobRes] = await Promise.all([
        authenticatedFetch(API_URLS.user.profile(userId)),
        authenticatedFetch(API_URLS.jobs.detail(jobId)),
      ]);
      const profile = profileRes.data;
      const job = jobRes.data;

      if (!profile?.cvText) {
        return { text: "Та CV хадгалаагүй байна. Эхлээд CV-гээ profile дээр хадгалаад дахин асуугаарай." };
      }

      const matchRes = await authenticatedPost(API_URLS.ai.matchCvToJob(), {
        cv: profile.cvText,
        jobTitle: job?.title,
        jobDescription: job?.description,
        jobRequirements: job?.requirements,
      });

      return { text: formatCandidateJobMatch(job, matchRes.data) };
    }

    if (role === "candidate" && asksForJobs) {
      const profileRes = await authenticatedFetch(API_URLS.user.profile(userId));
      if (!profileRes.data?.cvText && savedCv?.text) {
        await authenticatedPatch(API_URLS.user.profile(userId), {
          cvText: savedCv.text,
          cvFileName: "AI-Generated-CV.html",
        });
      }
      if (!profileRes.data?.cvText && !savedCv?.text) {
        return { text: "Та CV хадгалаагүй байна. CV-гээ хадгалсны дараа би database дээр байгаа ажлуудаас хамгийн тохирохыг чинь олж өгнө." };
      }

      const recRes = await authenticatedPost(API_URLS.jobs.recommendationsForCandidate(), {
        candidateId: userId,
      });

      return formatJobRecommendations(recRes.data?.recommendations || []);
    }

    if (role === "employer" && asksForCandidates) {
      const recRes = await authenticatedPost(API_URLS.jobs.recommendationsCandidatesForJob(), {
        ...(jobId ? { jobId } : {}),
        searchText: searchContext,
      });

      return formatCandidateRecommendations(recRes.data?.recommendations || []);
    }

    return null;
  };

  const send = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    const previousMessages = messages;
    setInput("");
    setMessagesForCurrentKey((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);
    try {
      if (role === "employer" && userId) {
        try {
          await authenticatedPost(API_URLS.user.useEntitlement(userId), { feature: "selfImprovement" });
        } catch (error: unknown) {
          if ((error as { response?: { status?: number } })?.response?.status === 402) {
            setMessagesForCurrentKey((prev) => [
              ...prev,
              {
                role: "assistant",
                text: "Free employer AI туслахыг 1 удаа ашиглаж болно. Илүү ашиглахын тулд Pro plan идэвхжүүлнэ үү.",
                showUpgradeButton: true,
              },
            ]);
            return;
          }
          throw error;
        }
      }

      const structuredAnswer = await handleStructuredAiRequest(userText, previousMessages);
      if (structuredAnswer) {
        setMessagesForCurrentKey((prev) => [
          ...prev,
          { role: "assistant", text: structuredAnswer.text, actions: structuredAnswer.actions },
        ]);
        return;
      }

      const res = await authenticatedPost(API_URLS.ai.ask(), {
        systemContext: getAiModeContext(mode),
        history: previousMessages.slice(-12).map((msg) => ({
          role: msg.role,
          content: msg.text,
        })),
        message: `${getSystemPrompt(mode)}\n\nХэрэглэгчийн асуулт: ${userText}`,
      });
      const answer = res.data?.answer || res.data?.reply || "Хариу ирсэнгүй.";
      const todoSuggestion = shouldSuggestTodo(mode, role, userText)
        ? buildTodoSuggestion(userText, answer)
        : undefined;
      setMessagesForCurrentKey((prev) => [
        ...prev,
        { role: "assistant", text: answer, todoSuggestion },
      ]);
    } catch {
      setMessagesForCurrentKey((prev) => [
        ...prev,
        { role: "assistant", text: "Алдаа гарлаа. Дахин оролдоно уу." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const generateRoadmapFromSuggestion = async (
    messageIndex: number,
    suggestion: { title: string; note: string },
  ) => {
    if (!userId) return;

    setMessagesForCurrentKey((prev) =>
      prev.map((item, index) =>
        index === messageIndex ? { ...item, roadmapLoading: true } : item,
      ),
    );

    try {
      const res = await authenticatedPost(API_URLS.ai.generateRoadmap(), {
        topic: suggestion.title,
        days: 30,
        userId,
      });
      const roadmap = Array.isArray(res.data?.roadmap) ? res.data.roadmap : [];
      const startDate = new Date();
      const createdAt = new Date().toISOString();
      const roadmapGroupId = `roadmap-${Date.now()}`;
      const generatedTodos = roadmap.slice(0, 30).map((item: any, index: number) => {
        const day = Number(item?.day) || index + 1;
        return {
          id: Date.now() + index,
          title: `Өдөр ${day}: ${String(item?.title || suggestion.title).trim()}`,
          description: String(item?.description || suggestion.note || "").trim(),
          note: String(item?.description || suggestion.note || "").trim(),
          done: false,
          priority: day <= 7 ? "high" : day <= 21 ? "medium" : "low",
          dueDate: addDays(startDate, day - 1),
          category: "roadmap",
          source: "AI",
          roadmapDay: day,
          roadmapGroupId,
          roadmapTopic: suggestion.title,
          createdAt,
        };
      });

      if (!generatedTodos.length) {
        throw new Error("Roadmap хоосон ирлээ.");
      }

      appendSelfImprovementTodos(userId, generatedTodos);
      setMessagesForCurrentKey((prev) =>
        prev.map((item, index) =>
          index === messageIndex
            ? { ...item, roadmapAdded: true, roadmapLoading: false }
            : item,
        ),
      );
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      
      setMessagesForCurrentKey((prev) =>
        prev.map((item, index) =>
          index === messageIndex ? { ...item, roadmapLoading: false } : item,
        ),
      );
      
      if (status === 402) {
        setMessagesForCurrentKey((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "🎯 30 хоногийн roadmap үүсгэх боломж дууссан байна!\n\nFree хэрэглэгчид 1 удаа ашиглаж болно. Pro эрхтэй болохын тулд profile дээрээс шатлал ахиулаа.\n\n💳 Pro эрх: 10,000₮/сар (хязгааргүй roadmap үүсгэлт)\n\nPro болсон даруудаа дахин оролдоно уу.",
            showUpgradeButton: true,
          },
        ]);
      } else {
        setMessagesForCurrentKey((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Roadmap үүсгэхэд алдаа гарлаа. AI service ажиллаж байвал дахин оролдоно уу.",
          },
        ]);
      }
    }
  };

  const generateCv = async () => {
    const formWithProfile = withProfileDefaults(cvForm, userId);
    const missing = getMissingCvFields(formWithProfile);
    if (missing.length) {
      setMessagesForCurrentKey((prev) => [
        ...prev,
        { role: "user", text: "Миний мэдээллээр CV бэлдэнэ үү." },
        {
          role: "assistant",
          text: `CV бэлдэхэд дараах мэдээлэл дутуу байна: ${missing.join(", ")}. Эдгээрийг бөглөөд дахин үүсгээрэй.`,
        },
      ]);
      return;
    }

    const nonCyrillicFields = getNonCyrillicCvFields(formWithProfile);
    if (nonCyrillicFields.length) {
      setMessagesForCurrentKey((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `CV form дээр кирилл үсгээр бичнэ үү: ${nonCyrillicFields.join(", ")}. И-мэйл, LinkedIn, website талбарууд латин байж болно.`,
        },
      ]);
      return;
    }

    if (userId) {
      try {
        await authenticatedPost(API_URLS.user.useEntitlement(userId), { feature: "aiCv" });
      } catch (error: unknown) {
        if ((error as { response?: { status?: number } })?.response?.status === 402) {
          setMessagesForCurrentKey((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "🎯 AI CV үүсгэх боломж дууссан байна!\n\nFree хэрэглэгчид 1 удаа ашиглаж болно. Pro эрхтэй болохын тулд profile дээрээс шатлал ахиулаа.\n\n💳 Pro эрх: 10,000₮/сар (хязгааргүй AI CV үүсгэлт)\n\nPro болсон даруудаа дахин оролдоно уу.",
              showUpgradeButton: true,
            },
          ]);
          return;
        }
        throw error;
      }
    }

    const html = buildCvFromForm(formWithProfile, userId);
    const cvText = buildCvPlainText(formWithProfile);
    const nextSavedCv = { html, text: cvText };
    localStorage.setItem(getSavedAiCvKey(userId), JSON.stringify(nextSavedCv));
    setSavedCv(nextSavedCv);
    if (userId) {
      authenticatedPatch(API_URLS.user.profile(userId), {
        cvText,
        cvFileName: "AI-Generated-CV.html",
      }).catch(() => {});
    }
    setPreviewHtml(html);
    setMessagesForCurrentKey((prev) => [
      ...prev,
      { role: "user", text: "Миний мэдээллээр CV бэлдэнэ үү." },
      {
        role: "assistant",
        text: "CV бэлэн боллоо. Доорх товчоор урьдчилж хараад PDF хэлбэрээр татаж аваарай.",
        cvHtml: html,
      },
    ]);
  };

  const findMatchingJobs = () => {
    if (!savedCv?.text) {
      setMessagesForCurrentKey((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Эхлээд CV-гээ үүсгээд хадгална уу. Дараа нь таны CV дээр тулгуурлаад тохирох ажлуудыг хайж өгнө.",
        },
      ]);
      return;
    }

    send("Миний CV-д тохирох ажлуудыг хайж өг.");
  };

  return (
    <>
      <div
        className={`fixed top-14 right-0 bottom-16 z-[70] flex w-full max-w-[min(100vw,24rem)] flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 dark:border-[#1e2535] dark:bg-[#080d1a] md:bottom-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1e2535]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-500" />
            <p className="text-sm font-bold text-gray-900 dark:text-white">AI туслах</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg"
            aria-label="Хаах"
          >
            <X size={16} />
          </button>
        </div>

        <div className={`grid grid-cols-1 gap-1 border-b border-gray-200 p-3 dark:border-[#1e2535] ${role === "candidate" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {availableModes.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`px-2 py-2 rounded-lg text-[11px] font-semibold flex flex-col items-center gap-1 ${
                mode === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-[#1a2035] text-gray-600 dark:text-gray-300"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {mode === "cv" && (
          <div className="border-b border-gray-200 dark:border-[#1e2535]">
            {savedCv?.html && (
              <div className="border-b border-gray-100 p-3 dark:border-[#0f1620]">
                <button
                  type="button"
                  onClick={() => setPreviewHtml(savedCv.html)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-blue-700"
                >
                  <Eye size={14} /> CV харах / PDF татах
                </button>
                <p className="mt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  Өмнө үүсгэсэн CV хадгалагдсан байна. Form-оо өөрчлөөд шинээр үүсгэж бас болно.
                </p>
              </div>
            )}
            {/* Personal Info Section */}
            <div className="border-b border-gray-100 dark:border-[#0f1620]">
              <button
                onClick={() => setExpandedCvSection(expandedCvSection === "personal" ? "" : "personal")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0f1620] transition"
              >
                <span className="text-xs font-bold text-gray-900 dark:text-white">👤 Хувийн мэдээлэл</span>
                <span className={`text-gray-400 transition ${expandedCvSection === "personal" ? "rotate-180" : ""}`}>▼</span>
              </button>
              {expandedCvSection === "personal" && (
                <div className="px-3 py-2 space-y-2 bg-gray-50 dark:bg-[#0f1620]">
                  <input value={cvForm.name} onChange={(e) => setCvForm(p => ({ ...p, name: e.target.value }))} placeholder="Нэр" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none" />
                  <input value={cvForm.title} onChange={(e) => setCvForm(p => ({ ...p, title: e.target.value }))} placeholder="Мэргэжил" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none" />
                  <input value={cvForm.phone} onChange={(e) => setCvForm(p => ({ ...p, phone: e.target.value }))} placeholder="Утас" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none" />
                  <input value={cvForm.email} onChange={(e) => setCvForm(p => ({ ...p, email: e.target.value }))} placeholder="И-мэйл" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none" />
                  <input value={cvForm.location} onChange={(e) => setCvForm(p => ({ ...p, location: e.target.value }))} placeholder="Байршил" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none" />
                </div>
              )}
            </div>

            {/* Links Section */}
            <div className="border-b border-gray-100 dark:border-[#0f1620]">
              <button
                onClick={() => setExpandedCvSection(expandedCvSection === "links" ? "" : "links")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0f1620] transition"
              >
                <span className="text-xs font-bold text-gray-900 dark:text-white">🔗 Холбоо</span>
                <span className={`text-gray-400 transition ${expandedCvSection === "links" ? "rotate-180" : ""}`}>▼</span>
              </button>
              {expandedCvSection === "links" && (
                <div className="px-3 py-2 space-y-2 bg-gray-50 dark:bg-[#0f1620]">
                  <input value={cvForm.linkedin} onChange={(e) => setCvForm(p => ({ ...p, linkedin: e.target.value }))} placeholder="LinkedIn холбоос" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none" />
                  <input value={cvForm.website} onChange={(e) => setCvForm(p => ({ ...p, website: e.target.value }))} placeholder="Portfolio / website" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none" />
                </div>
              )}
            </div>

            {/* Professional Section */}
            <div className="border-b border-gray-100 dark:border-[#0f1620]">
              <button
                onClick={() => setExpandedCvSection(expandedCvSection === "professional" ? "" : "professional")}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#0f1620] transition"
              >
                <span className="text-xs font-bold text-gray-900 dark:text-white">💼 Мэргэжлийн мэдээлэл</span>
                <span className={`text-gray-400 transition ${expandedCvSection === "professional" ? "rotate-180" : ""}`}>▼</span>
              </button>
              {expandedCvSection === "professional" && (
                <div className="px-3 py-2 space-y-2 bg-gray-50 dark:bg-[#0f1620]">
                  <textarea value={cvForm.summary} onChange={(e) => setCvForm(p => ({ ...p, summary: e.target.value }))} placeholder="Товч танилцуулга" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none resize-none h-16" />
                  <textarea value={cvForm.skills} onChange={(e) => setCvForm(p => ({ ...p, skills: e.target.value }))} placeholder="Ур чадвар (томъёогоор салга)" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none resize-none h-16" />
                  <textarea value={cvForm.experience} onChange={(e) => setCvForm(p => ({ ...p, experience: e.target.value }))} placeholder="Туршлага" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none resize-none h-20" />
                  <textarea value={cvForm.education} onChange={(e) => setCvForm(p => ({ ...p, education: e.target.value }))} placeholder="Боловсрол" className="w-full bg-white dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none resize-none h-16" />
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="p-3">
              <button
                onClick={generateCv}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs font-bold hover:bg-blue-700 transition"
              >
                ✨ CV загвар үүсгэх
              </button>
            </div>
          </div>
        )}

        {mode === "jobs" && role === "candidate" && (
          <div className="border-b border-gray-200 p-4 dark:border-[#1e2535]">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
              <p className="text-sm font-black text-gray-900 dark:text-white">Тохирох ажил хайх</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-600 dark:text-gray-300">
                Хадгалсан CV дээр тулгуурлаад database дахь ажлуудаас хамгийн ойр тохирохыг хайна.
              </p>
              {!savedCv?.text && (
                <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                  CV үүсгээгүй байна. Эхлээд CV бэлдэх хэсгээс form бөглөж CV үүсгэнэ үү.
                </p>
              )}
              <button
                type="button"
                onClick={findMatchingJobs}
                disabled={loading}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Briefcase size={14} /> Ажил хайх
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[86%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-[#1a2035] text-gray-800 dark:text-gray-200"
                }`}
              >
                {msg.text}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {msg.actions.map((action, actionIndex) => (
                      <button
                        key={`${action.type}-${actionIndex}-${action.label}`}
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent(
                              action.type === "candidate-chat"
                                ? "jobhub:ai-open-candidate-chat"
                                : "jobhub:ai-focus-candidate-job",
                              { detail: action.payload },
                            ),
                          );
                          onClose();
                        }}
                        className="w-full rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-left text-[11px] font-black text-blue-700 transition hover:bg-blue-500/15 dark:text-blue-200"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
                {msg.cvHtml && (
                  <button
                    onClick={() => setPreviewHtml(msg.cvHtml || "")}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-700"
                  >
                    <Eye size={14} /> CV харах / PDF татах
                  </button>
                )}
                {msg.showUpgradeButton && (
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("jobhub:open-upgrade-plan"));
                    }}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-2 text-[11px] font-bold text-white hover:from-purple-700 hover:to-pink-700 transition"
                  >
                    <Gem size={14} />
                    Pro болон хэрэглэгч нэмэх
                  </button>
                )}
                {msg.todoSuggestion && (
                  <div className="mt-3 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-3">
                    <p className="text-[11px] font-black text-blue-700 dark:text-blue-200">
                      Өөрийгөө хөгжүүлэх дээр ямар байдлаар нэмэх вэ?
                    </p>
                    <p className="mt-1 text-[11px] text-blue-900/80 dark:text-blue-100/80">
                      Нэг зорилго болгон хадгалах эсвэл 30 хоногийн өдөр өдөртэй roadmap болгож үүсгэнэ.
                    </p>

                    <div className="mt-3 grid gap-2">
                      <button
                        type="button"
                        disabled={msg.todoAdded}
                        onClick={() => {
                          addSelfImprovementTodo(userId, msg.todoSuggestion!);
                          setMessagesForCurrentKey((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, todoAdded: true } : item,
                            ),
                          );
                        }}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/80 px-3 py-2 text-[11px] font-black text-blue-700 transition hover:bg-white dark:bg-[#0d1117] dark:text-blue-200 dark:hover:bg-[#111827] disabled:bg-emerald-600 disabled:text-white"
                      >
                        {msg.todoAdded ? "TODO дээр нэмэгдсэн" : "TODO зорилго болгох"}
                      </button>

                      <button
                        type="button"
                        disabled={msg.roadmapAdded || msg.roadmapLoading}
                        onClick={() => generateRoadmapFromSuggestion(index, msg.todoSuggestion!)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-[11px] font-black text-white transition hover:bg-blue-700 disabled:bg-emerald-600"
                      >
                        <Sparkles size={13} className={msg.roadmapLoading ? "animate-spin" : ""} />
                        {msg.roadmapAdded
                          ? "30 хоногийн roadmap нэмэгдсэн"
                          : msg.roadmapLoading
                          ? "Roadmap үүсгэж байна..."
                          : "30 хоногийн roadmap болгох"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <p className="text-xs text-gray-400">Бодож байна...</p>}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-[#1e2535] flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && send()}
            placeholder="Асуултаа бичнэ үү..."
            className="flex-1 bg-gray-100 dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white outline-none"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-40"
            aria-label="Илгээх"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {previewHtml && (
        <CvPreviewModal
          htmlContent={previewHtml}
          onClose={() => setPreviewHtml("")}
          canDownload={proActive}
        />
      )}
    </>
  );
}
