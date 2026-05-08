"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  GraduationCap,
  MessageCircle,
  Printer,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { authenticatedPost } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";

type AiMode = "cv" | "growth" | "chat";
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
};
type MessageStore = Record<string, AiMessage[]>;

const modes: { key: AiMode; label: string; Icon: React.ElementType }[] = [
  { key: "cv", label: "CV бэлдэх", Icon: FileText },
  { key: "growth", label: "Өөрийгөө хөгжүүлэх", Icon: GraduationCap },
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
    return `${base} Хэрэглэгч өөрийгөө хөгжүүлэх горим сонгосон. Ур чадвар, дадал, суралцах төлөвлөгөөг бодит алхмаар зөвлө.`;
  }
  return `${base} Хэрэглэгч энгийн чат горим сонгосон. Товч, найрсаг, хэрэгтэй байдлаар ярилц.`;
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

function CvPreviewModal({
  htmlContent,
  onClose,
}: {
  htmlContent: string;
  onClose: () => void;
}) {
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const downloadRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (downloadRef.current) {
      downloadRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  const downloadPdf = async () => {
    if (!downloadRef.current || downloading) return;
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
      alert("PDF татахад алдаа гарлаа. Хэвлэх товчоор PDF болгон хадгалаад үзээрэй.");
    } finally {
      setDownloading(false);
    }
  };

  const printCv = () => {
    const frameWindow = printFrameRef.current?.contentWindow;
    if (!frameWindow) return;
    frameWindow.focus();
    frameWindow.print();
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-3">
      <div className="w-full max-w-4xl h-[92vh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden">
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

        <div className="flex-1 bg-gray-100 p-3 overflow-hidden">
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
}: {
  open: boolean;
  onClose: () => void;
  userId?: number | string;
}) {
  const [mode, setMode] = useState<AiMode>("chat");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageStore, setMessageStore] = useState<MessageStore>({});
  const [cvForm, setCvForm] = useState<CvForm>(initialCvForm);
  const [previewHtml, setPreviewHtml] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const storageKey = useMemo(() => `jobhub-ai-${userId || "guest"}-${mode}`, [userId, mode]);
  const messages = messageStore[storageKey] ?? loadMessages(storageKey);

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

  const send = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");
    setMessagesForCurrentKey((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);
    try {
      const res = await authenticatedPost(API_URLS.ai.ask(), {
        message: `${getSystemPrompt(mode)}\n\nХэрэглэгчийн асуулт: ${userText}`,
      });
      setMessagesForCurrentKey((prev) => [
        ...prev,
        { role: "assistant", text: res.data?.answer || res.data?.reply || "Хариу ирсэнгүй." },
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

  const generateCv = () => {
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

    const html = buildCvFromForm(formWithProfile, userId);
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

  return (
    <>
      <div
        className={`fixed top-14 right-0 bottom-0 z-[70] w-full max-w-sm bg-white dark:bg-[#080d1a] border-l border-gray-200 dark:border-[#1e2535] flex flex-col shadow-2xl transition-transform duration-300 ${
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

        <div className="grid grid-cols-3 gap-1 p-3 border-b border-gray-200 dark:border-[#1e2535]">
          {modes.map(({ key, label, Icon }) => (
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
          <div className="p-3 grid grid-cols-2 gap-2 border-b border-gray-200 dark:border-[#1e2535]">
            {cvFields.map(({ key, placeholder, wide }) => (
              <input
                key={key}
                value={cvForm[key]}
                onChange={(event) =>
                  setCvForm((prev) => ({ ...prev, [key]: event.target.value }))
                }
                placeholder={placeholder}
                className={`${
                  wide ? "col-span-2" : ""
                } bg-gray-100 dark:bg-[#111827] border border-gray-200 dark:border-[#1e2535] rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none`}
              />
            ))}
            <button
              onClick={generateCv}
              className="col-span-2 bg-blue-600 text-white rounded-lg py-2 text-xs font-bold hover:bg-blue-700"
            >
              CV загвар үүсгэх
            </button>
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
                {msg.cvHtml && (
                  <button
                    onClick={() => setPreviewHtml(msg.cvHtml || "")}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-700"
                  >
                    <Eye size={14} /> CV харах / PDF татах
                  </button>
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

      {previewHtml && <CvPreviewModal htmlContent={previewHtml} onClose={() => setPreviewHtml("")} />}
    </>
  );
}
