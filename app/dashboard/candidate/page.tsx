"use client";

import Image from "next/image";
import ProfileModal from "./ProfileModal";
import CVModal from "./CVModal";
import JobDetailModal from "./JobDetailModal";
import SelfImprovementModal from "./SelfImprovementModal";
import MessagesView from "../employer/MessagesView";
import FloatingChat from "@/components/FloatingChat";
import AiAssistantPanel from "@/components/AiAssistantPanel";
 
import CVForm from "@/components/cv/CVForm";
import CVPreview from "@/components/cv/CVPreview";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import DashboardLayout from "../DashboardLayout";
import {
  Search,
  Loader2,
  Sparkles,
  Send,
  Briefcase,
  Bookmark,
  Bell,
  ChevronDown,
  MapPin,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  TrendingUp,
  X,
  Heart,
  Plus,
  Copy,
  LayoutGrid,
  List,
  Building2,
  BadgeCheck,
} from "lucide-react";
import axios from "axios";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import {
  authenticatedFetch,
  authenticatedPost,
  authenticatedDelete,
  resetAxiosClient,
} from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";

// ─── Time formatting ──────────────────────────────────────────────────────────
function getRelativeTime(createdAt: string | Date): string {
  const date =
    typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "саяхан";
  if (diffMins < 60) return `${diffMins} минутын өмнө`;
  if (diffHours < 24) return `${diffHours} цагийн өмнө`;
  if (diffDays < 7) return `${diffDays} өдрийн өмнө`;
  return date.toLocaleDateString("mn-MN");
}

// ─── Company Avatar ───────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#3b5bdb", "#2f9e44", "#1971c2", "#e03131",
  "#6741d9", "#0c8599", "#f08c00", "#c2255c",
];
function CompanyAvatar({
  name,
  image,
  size = 48,
  className,
}: {
  name: string;
  image?: string;
  size?: number;
  className?: string;
}) {
  if (image) {
    return (
      <div
        className={`${className || ""} overflow-hidden`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          flexShrink: 0,
        }}
      >
        <img src={image} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  const letter = (name || "J")[0].toUpperCase();
  const color = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length];
  const nameParts = name.trim().split(/\s+/);
  const abbr =
    name && name.length >= 2
      ? (name[0] + (nameParts[1]?.[0] || name[1])).toUpperCase()
      : letter + letter;
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        color: "#fff",
        fontSize: size * 0.33,
        flexShrink: 0,
      }}
    >
      {abbr.slice(0, 2)}
    </div>
  );
}

// ─── Job Type Label ───────────────────────────────────────────────────────────
const JOB_TYPE_MAP: Record<string, string> = {
  FULL_TIME: "Бүтэн цаг",
  PART_TIME: "Хагас цаг",
  REMOTE: "Гэрээс",
  TEMPORARY: "Түр хугацаа",
  INTERNSHIP: "Дадлага",
};

// ─── Salary formatter ─────────────────────────────────────────────────────────
function formatSalary(amount: number): string {
  if (!amount) return "Тохиролцоно";
  return `${amount
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'")}₮`;
}

function hydrateJobImages(jobs: any[]) {
  if (typeof window === "undefined") return jobs;
  return jobs.map((job) => {
    const employerProfile = JSON.parse(localStorage.getItem(`employerProfile_${job.employerId}`) || "{}");
    const logo = employerProfile.logo || job.employer?.logo || job.employerLogo || "";
    return {
      ...job,
      jobImage: localStorage.getItem(`jobImage_${job.id}`) || job.jobImage || "",
      employerLogo: logo,
      employer: job.employer ? { ...job.employer, logo } : job.employer,
    };
  });
}

function formatSalaryText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Тохиролцоно";
  const parsed = parseSalaryValue(value);
  if (!parsed) return String(value);
  const raw = String(value).trim();
  const suffix = raw.replace(/[\d\s,.'₮ төгрөг]+/gi, "").trim();
  return `${parsed.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}₮${suffix ? ` ${suffix}` : ""}`;
}

function formatSalaryShort(val: number): string {
  if (!val) return "Тохиролцоно";
  if (val >= 1000000) return `${(val / 1000000).toFixed(0)}М₮`;
  if (val >= 1000) return `${Math.round(val / 1000)}К₮`;
  return `${val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}₮`;
}

function formatNumber(val: number): string {
  return val.toLocaleString("en-US");
}

function parseSalaryValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;

  const normalized = value
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return 0;

  const amount = Number(match[0]);
  if (!Number.isFinite(amount)) return 0;

  if (/[мm]/.test(normalized)) return amount * 1_000_000;
  if (/[кk]/.test(normalized)) return amount * 1_000;
  return amount;
}

function getJobSalaryMin(job: any): number {
  return Number(job.salaryMin) || parseSalaryValue(job.salary);
}

function getJobSalaryMax(job: any): number {
  return Number(job.salaryMax) || parseSalaryValue(job.salary);
}

// ─── Tag pill ─────────────────────────────────────────────────────────────────
function Tag({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-1 bg-[#111827] text-gray-400 text-xs rounded-md border border-[#1f2937]">
      {label}
    </span>
  );
}

// ─── JobCard ──────────────────────────────────────────────────────────────────
function JobCard({
  job,
  session,
  onApply,
  onChat,
  onSaveToggle,
  viewMode = "list",
}: {
  job: any;
  session: any;
  onApply: (job: any) => void;
  onChat: (employer: any) => void;
  onSaveToggle: (jobId: number, saved: boolean) => void;
  viewMode?: "list" | "grid";
}) {
  const userId = (session?.user as any)?.id;
  const applied = job.applications?.some(
    (a: any) => Number(a.candidateId) === Number(userId)
  );
  const [saved, setSaved] = useState(job.isSaved || false);
  const [relTime, setRelTime] = useState(getRelativeTime(job.createdAt || new Date()));

  useEffect(() => {
    const iv = setInterval(
      () => setRelTime(getRelativeTime(job.createdAt || new Date())),
      60000
    );
    return () => clearInterval(iv);
  }, [job.createdAt]);

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    onSaveToggle(job.id, next);
  };

  const handleCopyJobLink = async () => {
    try {
      await navigator.clipboard.writeText(buildJobShareText(job));
      alert("Ажлын зарын холбоос AI-д илгээх мэдээлэлтэйгээ хуулагдлаа.");
    } catch {
      alert("Холбоос хуулахад алдаа гарлаа.");
    }
  };

  const salaryText =
    job.salaryMin && job.salaryMax
      ? `${formatSalary(job.salaryMin)} - ${formatSalary(job.salaryMax)}`
      : formatSalaryText(job.salary);

  const category = job.category || job.tags?.[0] || "IT";
  const jobTypeKey = job.jobType || job.type;
  const jobType = JOB_TYPE_MAP[jobTypeKey] || jobTypeKey || "Бүтэн цаг";
  const experience = job.experience ? `${job.experience} жил` : "1-3 жил";
  const companyName = job.company || job.employer?.fullName || "Компани";
  const companyImage = job.employerLogo || job.employer?.logo;

  if (viewMode === "grid") {
    return (
      <div className="bg-white dark:bg-[#111827] border border-gray-100 dark:border-[#1f2937] rounded-2xl p-5 hover:border-blue-200 dark:hover:border-[#3b5bdb]/40 hover:shadow-lg transition-all flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <CompanyAvatar name={companyName} image={companyImage} size={44} />
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyJobLink}
              title="AI-д илгээхээр холбоос хуулах"
              className="w-8 h-8 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-blue-500 transition-colors"
            >
              <Copy size={15} />
            </button>
            <button
              onClick={handleSave}
              title="Хадгалах"
              className="w-8 h-8 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors"
            >
              <Heart size={16} fill={saved ? "#f43f5e" : "none"} stroke={saved ? "#f43f5e" : "currentColor"} />
            </button>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{job.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            {companyName}
            <BadgeCheck size={11} className="text-blue-500" />
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Tag label={category} />
          <Tag label={jobType} />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div className="flex items-center gap-1.5"><MapPin size={11} />{job.location || "Улаанбаатар"}</div>
          <div className="flex items-center gap-1.5"><Clock size={11} />{relTime}</div>
        </div>
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-[#1f2937]">
          <span className="text-sm font-bold text-emerald-500">{salaryText}</span>
          <button
            onClick={() => onApply(job)}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500 transition-all"
          >
            {applied ? "Илгээсэн" : "CV илгээх"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111827] border border-gray-100 dark:border-[#1f2937] rounded-2xl px-4 md:px-5 py-3 md:py-4 hover:border-blue-200 dark:hover:border-[#3b5bdb]/40 hover:shadow-md transition-all">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <CompanyAvatar name={companyName} image={companyImage} size={44} className="hidden sm:block md:w-[52px] md:h-[52px]" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-base md:text-base font-extrabold text-gray-900 dark:text-white truncate leading-tight line-clamp-2">
                {job.title}
              </h4>

              <div className="mt-1 flex items-center gap-1 flex-wrap">
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {companyName}
                </span>
                <BadgeCheck size={13} className="text-blue-500 shrink-0" />
              </div>

              {/* Mobile: salary under title/company (sm smaller font) */}
              <div className="mt-1 md:hidden">
                <span className="text-sm font-bold text-emerald-500 whitespace-nowrap bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
                  {salaryText}
                </span>
              </div>
            </div>

            {/* Desktop/tablet: keep salary on the right */}
            <span className="hidden md:inline-flex text-base md:text-lg font-bold text-emerald-500 shrink-0 whitespace-nowrap bg-emerald-50 dark:bg-emerald-500/10 px-2 md:px-3 py-1 rounded-lg">
              {salaryText}
            </span>
          </div>
          <div className="flex flex-wrap md:items-center md:gap-5 gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5 md:gap-1.5 w-full md:w-auto">
              <MapPin size={12} className="shrink-0" />
              {job.location || "Улаанбаатар"}
            </span>
            <span className="flex items-center gap-1.5 md:gap-1.5 w-full md:w-auto">
              <Briefcase size={12} className="shrink-0" />
              {experience}
            </span>
            <span className="flex items-center gap-1.5 md:gap-1.5 w-full md:w-auto">
              <Clock size={12} className="shrink-0" />
              {relTime}
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-3">
            <div className="flex gap-1.5 flex-wrap">
              <Tag label={category} />
              <Tag label={jobType} />
              {(job.tags || []).slice(0, 1).map((t: string) => (
                <Tag key={t} label={t} />
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap md:flex-nowrap">
              <button
                onClick={handleCopyJobLink}
                title="AI-д илгээхээр холбоос хуулах"
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
              >
                <Copy size={15} />
              </button>
              <button
                onClick={handleSave}
                title="Хадгалах"
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
              >
                <Heart
                  size={16}
                  fill={saved ? "#f43f5e" : "none"}
                  stroke={saved ? "#f43f5e" : "currentColor"}
                />
              </button>
              {applied ? (
                <button
                  onClick={() =>
                    onChat({
                      id: job.employerId,
                      email: job.employer?.email,
                      fullName: job.employer?.fullName,
                    })
                  }
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#1a2035] rounded-xl hover:bg-gray-200 dark:hover:bg-[#1e2a45] transition-all flex-1 md:flex-none md:min-w-max"
                >
                  Чатлах
                </button>
              ) : (
                <button
                  onClick={() => onApply(job)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#1a2035] rounded-xl hover:bg-gray-200 dark:hover:bg-[#1e2a45] transition-all flex-1 md:flex-none md:min-w-max"
                >
                  Дэлгэрэнгүй
                </button>
              )}
              <button
                onClick={() => onApply(job)}
                disabled={applied}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex-1 md:flex-none md:min-w-max ${
                  applied
                    ? "bg-gray-200 dark:bg-[#1a2035] text-gray-500 dark:text-gray-500 cursor-not-allowed opacity-60"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
              >
                {applied ? "✓ Илгээсэн" : "CV илгээх"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Checkbox ─────────────────────────────────────────────────────────
function SidebarCheckbox({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group select-none">
      <div className="flex items-center gap-2.5">
        <div
          onClick={() => onChange(!checked)}
          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
            checked
              ? "bg-blue-600 border-blue-600"
              : "border-gray-300 dark:border-[#2a3550] group-hover:border-blue-400"
          }`}
        >
          {checked && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <span className="text-xs text-gray-400">{count}</span>
    </label>
  );
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────
function AiPanel({
  open,
  onClose,
  session,
  jobs,
}: {
  open: boolean;
  onClose: () => void;
  session: any;
  jobs: any[];
}) {
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiMessages, setAiMessages] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: "Сайн байна уу? Би таны ухаалаг туслах байна. Юугаар туслах вэ?" },
  ]);
  const aiScrollRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aiScrollRef.current)
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
  }, [aiMessages]);

  const buildJobsContext = () =>
    JSON.stringify(
      (jobs || []).slice(0, 20).map((job: any) => ({
        id: job.id,
        title: job.title,
        company: job.company || job.employer?.fullName,
        location: job.location,
        salary: job.salary,
        type: JOB_TYPE_MAP[job.jobType || job.type] || job.jobType || job.type,
        requirements: job.requirements,
        description: job.description,
      }))
    );

  const handleAiFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed =
      file.type === "application/pdf" ||
      file.type.startsWith("image/") ||
      file.type.startsWith("text/");

    if (!allowed) {
      alert("PDF, зураг эсвэл text файл оруулна уу.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const sendAiMessage = async () => {
    if ((!aiInput.trim() && !selectedFile) || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    const fileToSend = selectedFile;
    setSelectedFile(null);
    setAiMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: fileToSend
          ? `${userMsg || "Энэ файлыг уншаад зөвлөгөө өгнө үү."}\n[Файл: ${fileToSend.name}]`
          : userMsg,
      },
    ]);
    setAiLoading(true);
    try {
      const res = fileToSend
        ? await authenticatedPost(
            API_URLS.ai.askWithFile(),
            (() => {
              const formData = new FormData();
              formData.append("file", fileToSend);
              formData.append("message", userMsg || "CV-г уншаад тохирох ажлууд болон сайжруулах зөвлөгөө өгнө үү.");
              formData.append("jobsContext", buildJobsContext());
              return formData;
            })(),
            { headers: { "Content-Type": "multipart/form-data" } }
          )
        : await authenticatedPost(API_URLS.ai.ask(), { message: userMsg });
      const answer = res.data?.answer || res.data?.reply;
      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", text: answer || "Хариу ирсэнгүй." },
      ]);
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Алдаа гарлаа. Дахин оролдоно уу." },
      ]);
    } finally {
      setAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className={`fixed top-14 right-0 bottom-0 z-50 w-80 bg-white dark:bg-[#080d1a] border-l border-gray-200 dark:border-[#1e2535] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#1e2535]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-blue-500" />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">AI Туслах</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition-all">
          <X size={15} />
        </button>
      </div>
      <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {aiMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Sparkles size={11} className="text-blue-500" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-100 dark:bg-[#1a2035] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#1e2535] rounded-bl-sm"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {aiLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center mr-2 shrink-0">
              <Sparkles size={11} className="text-blue-500" />
            </div>
            <div className="bg-gray-100 dark:bg-[#1a2035] border border-gray-200 dark:border-[#1e2535] px-4 py-3 rounded-2xl">
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-gray-200 dark:border-[#1e2535]">
        {selectedFile && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-3 py-2">
            <p className="truncate text-xs font-semibold text-blue-700 dark:text-blue-200">{selectedFile.name}</p>
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-blue-500 hover:text-red-500"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*,.txt,text/plain"
            className="hidden"
            onChange={handleAiFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={aiLoading}
            className="w-10 h-10 bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2535] text-gray-600 dark:text-gray-300 rounded-xl flex items-center justify-center hover:border-blue-400 hover:text-blue-500 disabled:opacity-40 transition-all"
          >
            <Plus size={17} />
          </button>
          <input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendAiMessage()}
            type="text"
            placeholder="Асуултаа бичнэ үү..."
            className="flex-1 bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2535] rounded-xl py-2.5 px-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-400 transition-all"
          />
          <button
            onClick={sendAiMessage}
            disabled={aiLoading || (!aiInput.trim() && !selectedFile)}
            className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 disabled:opacity-40 transition-all"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CandidateDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [chatSocket, setChatSocket] = useState<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [appliedCountData, setAppliedCountData] = useState(0);
  const [filterStats, setFilterStats] = useState<any>({
    jobType: { FULL_TIME: 0, PART_TIME: 0, REMOTE: 0, TEMPORARY: 0, INTERNSHIP: 0 },
    experience: { "0-1": 0, "1-3": 0, "3-5": 0, "5+": 0 },
    location: {},
    totalJobs: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [aiOpen, setAiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "saved" | "applied" | "messages" | "improvement">("all");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<any>(null);
  const [candidateProfile, setCandidateProfile] = useState<any>(null);

  const [jobTypeFilters, setJobTypeFilters] = useState<Record<string, boolean>>({
    FULL_TIME: false, PART_TIME: false, REMOTE: false, TEMPORARY: false, INTERNSHIP: false,
  });
  const [experienceFilters, setExperienceFilters] = useState<Record<string, boolean>>({
    "0-1": false, "1-3": false, "3-5": false, "5+": false,
  });
  const [salaryMin, setSalaryMin] = useState(500000);
  const [salaryMax, setSalaryMax] = useState(10000000);

  const [showProfile, setShowProfile] = useState(false);
  const [showCV, setShowCV] = useState(false);
  const [showJobDetail, setShowJobDetail] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [showCVGenerator, setShowCVGenerator] = useState(false);
  const [showCVPreview, setShowCVPreview] = useState(false);
  const [generatedCVHTML, setGeneratedCVHTML] = useState("");

  const JOBS_PER_PAGE = 8;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (!userId || typeof window === "undefined") return;

    const saved = localStorage.getItem(`userProfile_${userId}`);
    if (!saved) { setCandidateProfile(null); return; }

    try {
      setCandidateProfile(JSON.parse(saved));
    } catch {
      setCandidateProfile(null);
    }
  }, [session]);

  const fetchData = useCallback(async () => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        authenticatedFetch(API_URLS.jobs.all()),
        authenticatedFetch(API_URLS.chat.conversations(userId)),
        authenticatedFetch(API_URLS.jobs.stats()),
      ]);
      if (results[0].status === "fulfilled") setJobs(hydrateJobImages(results[0].value.data || []));
      else setJobs([]);
      if (results[1].status === "fulfilled") setConversations(results[1].value.data || []);
      if (results[2].status === "fulfilled") setFilterStats(results[2].value.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  useEffect(() => {
    const jobId = Number(searchParams.get("job"));
    if (!jobId || jobs.length === 0 || showJobDetail) return;

    const linkedJob = jobs.find((job: any) => Number(job.id) === jobId);
    if (linkedJob) {
      setSelectedJob(linkedJob);
      setShowJobDetail(true);
    }
  }, [searchParams, jobs, showJobDetail]);

  useEffect(() => {
    const userId = Number((session?.user as any)?.id);
    if (!userId) return;

    setAppliedCountData(
      jobs.filter((job: any) =>
        job.applications?.some((app: any) => Number(app.candidateId) === userId)
      ).length
    );
    setSavedCount(jobs.filter((job: any) => job.isSaved).length);
  }, [jobs, session]);

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;

    const socket = io(API_URLS.sockets.chat());
    setChatSocket(socket);
    socket.on("connect", () => { socket.emit("join-room", userId); });
    socket.on("new-message", () => { fetchData(); });

    return () => {
      setChatSocket(null);
      socket.off("new-message");
      socket.disconnect();
    };
  }, [session, fetchData]);

  useEffect(() => {
    if (!session?.user) return;
    const iv = setInterval(async () => {
      try {
        const res = await authenticatedFetch(API_URLS.jobs.stats());
        setFilterStats(res.data);
      } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [session]);

  useEffect(() => {
    const socket = io(API_URLS.sockets.auth());
    socket.on("new-job-posted", (data: any) => {
      setJobs((prev) => [...hydrateJobImages([data.job]), ...prev]);
      authenticatedFetch(API_URLS.jobs.stats())
        .then((res) => setFilterStats(res.data))
        .catch(() => {});
    });
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      setJobs([]); setConversations([]); setSelectedContact(null);
      setSavedCount(0); setAppliedCountData(0);
      resetAxiosClient();
    }
  }, [status]);

  const handleSaveToggle = async (jobId: number, saved: boolean) => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;

    const previousJobs = jobs;
    const previousSavedCount = savedCount;
    setJobs((prev) =>
      prev.map((job: any) => job.id === jobId ? { ...job, isSaved: saved } : job)
    );
    setSavedCount((c) => saved ? c + 1 : Math.max(0, c - 1));

    try {
      if (saved) {
        await authenticatedPost(API_URLS.jobs.save(), { jobId, candidateId: userId });
      } else {
        await authenticatedDelete(API_URLS.jobs.unsave(jobId, userId));
      }
    } catch (err) {
      setJobs(previousJobs);
      setSavedCount(previousSavedCount);
    }
  };

  const openChat = (contact: any) => {
    if (!contact?.id) return;
    const normalizedContact = {
      ...contact,
      email: contact.email || "",
      fullName: contact.fullName || contact.email?.split("@")[0] || "Employer",
    };

    setSelectedContact(normalizedContact);
    setConversations((prev) => {
      const contactId = Number(normalizedContact.id);
      const exists = prev.some(
        (conv: any) => Number(conv.participantId ?? conv.id) === contactId
      );
      if (exists) return prev;
      return [
        {
          id: contactId,
          participantId: contactId,
          participantEmail: normalizedContact.email,
          participantName: normalizedContact.fullName,
          email: normalizedContact.email,
          fullName: normalizedContact.fullName,
          lastMessage: "Чат эхлүүлэхэд бэлэн",
        },
        ...prev,
      ];
    });
    setActiveTab("messages");
  };

  const handleApply = (job: any) => {
    if (!session?.user) return alert("Нэвтрэх");
    setSelectedJob(job);
    setShowJobDetail(true);
  };

  const handleApplyWithCV = async (jobId: number, cvData?: string) => {
    if (!session?.user) return alert("Нэвтрэх");
    try {
      const userId = (session.user as any).id;

      let userProfile: any = null;
      try {
        const profileRes = await authenticatedFetch(API_URLS.auth.profile(userId));
        userProfile = profileRes.data;
      } catch (e) {
        console.error("Could not fetch profile:", e);
      }

      if (!userProfile?.cvText && !cvData) {
        alert("CV оруулаагүй байна. AI-аар үүсгүүлэх үү?");
        setShowCV(true);
        return;
      }

      await authenticatedPost(API_URLS.jobs.apply(), {
        jobId,
        candidateId: userId,
      });
      alert("Хүсэлт илгээгдлээ!");
      setShowJobDetail(false);
      fetchData();
    } catch (err: any) {
      if (err.response?.status === 400) {
        alert("Та аль хэдийн өргөдөл илгээсэн байна");
      } else {
        alert("Алдаа гарлаа");
      }
    }
  };

  const filteredJobs = useMemo(() => {
    let list = [...jobs];
    const userId = Number((session?.user as any)?.id);

    if (activeTab === "saved") list = list.filter((job: any) => job.isSaved);
    if (activeTab === "applied" && userId) {
      list = list.filter((job: any) =>
        job.applications?.some((app: any) => Number(app.candidateId) === userId)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (j) =>
          (j.title || "").toLowerCase().includes(q) ||
          (j.company || "").toLowerCase().includes(q) ||
          (j.employer?.fullName || "").toLowerCase().includes(q)
      );
    }

    if (locationQuery.trim()) {
      const lq = locationQuery.toLowerCase();
      list = list.filter((j) => (j.location || "").toLowerCase().includes(lq));
    }

    const activeTypes = Object.entries(jobTypeFilters).filter(([, v]) => v).map(([k]) => k);
    if (activeTypes.length > 0) {
      list = list.filter((j) => activeTypes.includes(j.jobType || j.type));
    }

    const activeExp = Object.entries(experienceFilters).filter(([, v]) => v).map(([k]) => k);
    if (activeExp.length > 0) {
      list = list.filter((j) => {
        const exp = j.experience || "";
        return activeExp.some((e) => exp.includes(e));
      });
    }

    if (salaryMax < 10000000) {
      list = list.filter((j) => {
        const parsedSalary = parseSalaryValue(j.salary);
        const min = Number(j.salaryMin) || parsedSalary || 0;
        const max = Number(j.salaryMax) || parsedSalary || Infinity;
        return max >= salaryMin && min <= salaryMax;
      });
    }

    if (sortBy === "newest") list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortBy === "salary") list.sort((a, b) => getJobSalaryMax(b) - getJobSalaryMax(a));

    return list;
  }, [jobs, session, activeTab, searchQuery, locationQuery, jobTypeFilters, experienceFilters, salaryMin, salaryMax, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PER_PAGE));
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE
  );

  const localProfileName = [candidateProfile?.lastName, candidateProfile?.firstName]
    .filter(Boolean).join(" ").trim();
  const userName =
    localProfileName ||
    (session?.user as any)?.name ||
    (session?.user as any)?.email?.split("@")[0] ||
    "Нэвтрэгч";
  const userInitial = userName[0]?.toUpperCase() || "Б";

  const pageButtons = (): (number | "...")[] => {
    const btns: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) btns.push(i);
    } else {
      btns.push(1, 2, 3);
      if (currentPage > 4) btns.push("...");
      if (currentPage > 3 && currentPage < totalPages - 2) btns.push(currentPage);
      if (currentPage < totalPages - 3) btns.push("...");
      btns.push(totalPages);
    }
    return btns;
  };

  return (
    <DashboardLayout role="candidate">
      {/* ── NAVBAR ─────────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white dark:bg-[#0b1120] border-b border-gray-200 dark:border-[#1a2235] flex items-center px-3 md:px-6 gap-3 md:gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo.png"
            alt="JobHub"
            width={40}
            height={40}
            className="w-8 h-8 object-contain"
            priority
          />
          <span className="hidden sm:inline text-gray-900 dark:text-white font-bold text-lg tracking-tight">
            JobHub
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { key: "all", label: "Ажлын байр" },
            { key: "saved", label: "Хадгалсан" },
            { key: "applied", label: "CV илгээсэн" },
            { key: "messages", label: "Чат" },
            { key: "improvement", label: "Өөрийгөө хөгжүүлэх" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === item.key
                  ? "text-blue-600 border-b-2 border-blue-600 rounded-none"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setActiveTab("saved"); setCurrentPage(1); }}
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl transition-all relative"
          >
            <Heart size={18} />
          </button>
          <button
            onClick={() => { setActiveTab("applied"); setCurrentPage(1); }}
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl transition-all"
          >
            <Bell size={18} />
          </button>
          <button
            onClick={() => setAiOpen(!aiOpen)}
            className="w-9 h-9 flex items-center justify-center bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-all"
          >
            <Sparkles size={16} />
          </button>

          <div ref={profileRef} className="relative flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-[#1e2535] cursor-pointer" onClick={() => setProfileOpen(!profileOpen)}>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
              {candidateProfile?.photo ? (
                <img src={candidateProfile.photo} alt="profile" className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">{userName}</p>
              <p className="text-xs text-gray-500">Ажил горилогч</p>
            </div>
            <ChevronDown size={14} className="text-gray-400" />

            {profileOpen && (
              <div className="absolute top-12 right-0 z-50 w-52 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2535] rounded-2xl p-1.5 shadow-2xl">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowProfile(true); setProfileOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a2035] rounded-xl flex items-center gap-2.5"
                >
                  <Users size={14} className="text-blue-500" /> Профайл бөглөх
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCV(true); setProfileOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a2035] rounded-xl flex items-center gap-2.5"
                >
                  <Briefcase size={14} className="text-blue-500" /> CV оруулах
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCVGenerator(true); setProfileOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a2035] rounded-xl flex items-center gap-2.5"
                >
                  <Sparkles size={14} className="text-purple-500" /> CV үүсгэх (AI)
                </button>
                <div className="border-t border-gray-200 dark:border-[#1e2535] my-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); signOut({ callbackUrl: "/login" }); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl flex items-center gap-2.5"
                >
                  <X size={14} /> Гарах
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────────────────── */}
      <div className="pt-14 flex h-screen overflow-hidden pb-20 md:pb-0 bg-gray-50 dark:bg-[#060c18]">

        {activeTab === "improvement" ? (
          <main className="flex-1 overflow-y-auto">
            <SelfImprovementModal
              onClose={() => setActiveTab("all")}
              userId={(session?.user as any)?.id || 0}
            />
          </main>
        ) : activeTab === "messages" ? (
          <main ref={chatContainerRef} className="flex-1 overflow-hidden p-0 md:p-6">
            <MessagesView
              conversations={conversations}
              selectedContact={selectedContact}
              onSelectContact={setSelectedContact}
              senderId={(session?.user as any)?.id}
              socket={chatSocket}
            />
          </main>
        ) : (
          <>
            <div className="fixed top-14 left-0 right-0 z-40 bg-white dark:bg-[#0b1120] border-b border-gray-200 dark:border-[#1a2235] px-3 md:px-6 py-3 flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2535] rounded-xl px-3 md:px-4 py-2 md:py-2.5">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Ажлын байр хайх..."
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
                />
              </div>
              <div className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2535] rounded-xl px-4 py-2.5 cursor-pointer min-w-[160px]">
                <MapPin size={14} className="text-gray-400" />
                <select
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none cursor-pointer"
                >
                  <option value="">Бүх байршил</option>
                  {Object.keys(filterStats.location || {}).map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setCurrentPage(1)}
                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-all shrink-0"
              >
                <Search size={15} /> Хайх
              </button>
              <button className="md:hidden flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#1e2535] text-gray-600 dark:text-gray-400 text-sm rounded-xl hover:border-blue-400 transition-all shrink-0">
                <SlidersHorizontal size={14} />
              </button>
            </div>

            <div className="flex w-full h-full pt-[56px] bg-gray-50 dark:bg-[#060c18]">
              <aside className="hidden md:flex w-72 shrink-0 sticky top-[112px] self-start h-[calc(100vh-112px)] overflow-y-auto border-r border-gray-200 dark:border-[#1a2235] bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur p-5 scrollbar-hide flex-col shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Шүүлтүүр</p>
                  <button
                    onClick={() => {
                      setJobTypeFilters({ FULL_TIME: false, PART_TIME: false, REMOTE: false, TEMPORARY: false, INTERNSHIP: false });
                      setExperienceFilters({ "0-1": false, "1-3": false, "3-5": false, "5+": false });
                      setSalaryMin(500000); setSalaryMax(10000000);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-all"
                  >
                    Арилгах
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Ангилал</p>
                  <div className="relative">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2535] rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-400 outline-none appearance-none cursor-pointer"
                    >
                      <option value="all">Бүх ангилал</option>
                      <option value="IT">IT / Технологи</option>
                      <option value="Marketing">Маркетинг</option>
                      <option value="Design">Дизайн</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Ажлын төрөл</p>
                  <div className="space-y-2.5">
                    {[
                      ["FULL_TIME", "Бүтэн цагийн"],
                      ["PART_TIME", "Хагас цагийн"],
                      ["REMOTE", "Гэрээс ажиллах"],
                      ["TEMPORARY", "Түр хугацааны"],
                      ["INTERNSHIP", "Дадлага"],
                    ].map(([key, label]) => (
                      <SidebarCheckbox
                        key={key}
                        label={label}
                        count={filterStats.jobType?.[key] || 0}
                        checked={jobTypeFilters[key]}
                        onChange={(v) => { setJobTypeFilters((f) => ({ ...f, [key]: v })); setCurrentPage(1); }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Цалингийн түвшин</p>
                  <div className="text-sm text-gray-800 dark:text-white font-semibold mb-3">
                    500К₮ – {salaryMax >= 10000000 ? "10М₮+" : `${Math.round(salaryMax / 1000000)}М₮`}
                  </div>
                  <input
                    type="range"
                    min={500000}
                    max={10000000}
                    step={100000}
                    value={salaryMax}
                    onChange={(e) => { setSalaryMin(500000); setSalaryMax(Number(e.target.value)); setCurrentPage(1); }}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>500К₮</span><span>10М₮+</span>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Туршлага</p>
                  <div className="space-y-2.5">
                    {[["0-1", "0-1 жил"], ["1-3", "1-3 жил"], ["3-5", "3-5 жил"], ["5+", "5+ жил"]].map(([key, label]) => (
                      <SidebarCheckbox
                        key={key}
                        label={label}
                        count={filterStats.experience?.[key] || 0}
                        checked={experienceFilters[key]}
                        onChange={(v) => { setExperienceFilters((f) => ({ ...f, [key]: v })); setCurrentPage(1); }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Байршил</p>
                  <div className="relative mb-3">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      placeholder="Байршлаар хайх..."
                      className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2535] rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none"
                    />
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(filterStats.location || {})
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .slice(0, 6)
                      .map(([loc, cnt]) => (
                        <SidebarCheckbox
                          key={loc}
                          label={loc}
                          count={cnt as number}
                          checked={locationQuery === loc}
                          onChange={(v) => setLocationQuery(v ? loc : "")}
                        />
                      ))}
                  </div>
                </div>
              </aside>

              <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-[#060c18]">
                {(Object.values(jobTypeFilters).some(v => v) || Object.values(experienceFilters).some(v => v) || salaryMax < 10000000 || locationQuery) && (
                  <div className="shrink-0 px-6 py-3 border-b border-gray-100 dark:border-[#1a2235] bg-blue-50 dark:bg-blue-500/10 flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Идэвхтэй шүүлтүүр:</span>
                    {Object.entries(jobTypeFilters).map(([key, checked]) =>
                      checked ? (
                        <div key={key} className="inline-flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-[#1a2035] border border-gray-200 dark:border-[#2a3550] rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                          {JOB_TYPE_MAP[key] || key}
                          <button onClick={() => setJobTypeFilters((f) => ({ ...f, [key]: false }))} className="ml-1 text-gray-400 hover:text-red-500"><X size={12} /></button>
                        </div>
                      ) : null
                    )}
                    {Object.entries(experienceFilters).map(([key, checked]) =>
                      checked ? (
                        <div key={key} className="inline-flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-[#1a2035] border border-gray-200 dark:border-[#2a3550] rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                          {key} жил туршлага
                          <button onClick={() => setExperienceFilters((f) => ({ ...f, [key]: false }))} className="ml-1 text-gray-400 hover:text-red-500"><X size={12} /></button>
                        </div>
                      ) : null
                    )}
                    {locationQuery && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-[#1a2035] border border-gray-200 dark:border-[#2a3550] rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                        📍 {locationQuery}
                        <button onClick={() => setLocationQuery("")} className="ml-1 text-gray-400 hover:text-red-500"><X size={12} /></button>
                      </div>
                    )}
                    {salaryMax < 10000000 && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-[#1a2035] border border-gray-200 dark:border-[#2a3550] rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                        💰 до {formatNumber(salaryMax)}₮
                        <button onClick={() => setSalaryMax(10000000)} className="ml-1 text-gray-400 hover:text-red-500"><X size={12} /></button>
                      </div>
                    )}
                  </div>
                )}

                <div className="shrink-0 px-3 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 border-b border-gray-100 dark:border-[#1a2235] bg-white dark:bg-[#0b1120]">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide whitespace-nowrap">
                      {[
                        { key: "all", label: "Бүгд", count: filteredJobs.length },
                        { key: "saved", label: "Хадгалсан", count: savedCount },
                        { key: "applied", label: "Өргөдөл", count: appliedCountData },
                      ].map((t) => (
                        <button
                          key={t.key}
                          onClick={() => { setActiveTab(t.key as any); setCurrentPage(1); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            activeTab === t.key
                              ? "bg-blue-600 text-white"
                              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a2035] hover:text-gray-900 dark:hover:text-white"
                          }`}
                        >
                          {t.label}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? "bg-white/20" : "bg-gray-200 dark:bg-[#1a2035] text-gray-500"}`}>
                            {t.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-white">{filteredJobs.length}</span> ажлын байр
                    </p>
                    <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
                      <span>Эрэмбэлэх:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none cursor-pointer"
                      >
                        <option value="newest">Шинэ эхэлсэн</option>
                        <option value="salary">Цалин өндөр</option>
                      </select>
                      <ChevronDown size={13} />
                    </div>
                    <div className="hidden md:flex items-center border border-gray-200 dark:border-[#1e2535] rounded-lg overflow-hidden">
                      <button
                        onClick={() => setViewMode("list")}
                        className={`w-8 h-8 flex items-center justify-center transition-all ${viewMode === "list" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-700 dark:hover:text-white"}`}
                      >
                        <List size={14} />
                      </button>
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`w-8 h-8 flex items-center justify-center transition-all ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-700 dark:hover:text-white"}`}
                      >
                        <LayoutGrid size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`flex-1 overflow-y-auto px-3 md:px-6 py-4 scrollbar-hide ${viewMode === "grid" ? "hidden md:grid md:grid-cols-2 gap-4 content-start" : "flex flex-col gap-3"}`}>
                  {loading ? (
                    <div className="col-span-1 md:col-span-2 flex justify-center py-20">
                      <Loader2 className="animate-spin text-blue-600" size={28} />
                    </div>
                  ) : paginatedJobs.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 text-center py-20">
                      <p className="text-gray-400 text-sm">Ажлын байр олдсонгүй</p>
                      <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="mt-3 text-blue-500 text-sm underline">
                        Шүүлтүүр арилгах
                      </button>
                    </div>
                  ) : (
                    paginatedJobs.map((job: any) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        session={session}
                        onApply={handleApply}
                        onChat={openChat}
                        onSaveToggle={handleSaveToggle}
                        viewMode={viewMode}
                      />
                    ))
                  )}
                </div>

                <div className="shrink-0 px-3 md:px-6 py-3 md:py-4 border-t border-gray-100 dark:border-[#1a2235] flex items-center justify-center gap-1 bg-white dark:bg-[#0b1120] overflow-x-auto">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-[#1e2535] text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-30 transition-all shrink-0"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {pageButtons().map((btn, i) =>
                    btn === "..." ? (
                      <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm hidden md:flex">…</span>
                    ) : (
                      <button
                        key={btn}
                        onClick={() => setCurrentPage(btn as number)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-all shrink-0 ${
                          currentPage === btn
                            ? "bg-blue-600 text-white"
                            : "border border-gray-200 dark:border-[#1e2535] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hidden md:flex"
                        } ${currentPage === btn ? "flex" : ""}`}
                      >
                        {btn}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-[#1e2535] text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-30 transition-all shrink-0"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </main>
            </div>
          </>
        )}
      </div>

      {/* ── AI PANEL ──────────────────────────────────────────────────────────── */}
      <AiAssistantPanel open={aiOpen} onClose={() => setAiOpen(false)} userId={(session?.user as any)?.id} />
      <FloatingChat />

      {/* ── MODALS ────────────────────────────────────────────────────────────── */}
      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          userId={(session?.user as any)?.id || 0}
          onSaved={setCandidateProfile}
        />
      )}
      {showCV && (
        <CVModal
          onClose={() => setShowCV(false)}
          userId={(session?.user as any)?.id || 0}
        />
      )}
      {showJobDetail && selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setShowJobDetail(false)}
          onApply={handleApplyWithCV}
          userId={(session?.user as any)?.id || 0}
        />
      )}
      {showCVGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl my-8 relative">
            <button onClick={() => setShowCVGenerator(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10">
              <X size={24} />
            </button>
            <div className="p-6">
              <CVForm
                onCVGenerated={(htmlContent: string) => {
                  setGeneratedCVHTML(htmlContent);
                  setShowCVGenerator(false);
                  setShowCVPreview(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
      {showCVPreview && generatedCVHTML && (
        <CVPreview
          htmlContent={generatedCVHTML}
          onClose={() => { setShowCVPreview(false); setGeneratedCVHTML(""); }}
        />
      )}


      {/* ── MOBILE BOTTOM NAV ───────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-[#0b1120] border-t border-gray-200 dark:border-[#1a2235]">
        <div className="grid grid-cols-5">
          {[
            { key: "all", label: "Ажлын байр", Icon: LayoutGrid },
            { key: "saved", label: "Хадгалсан", Icon: Bookmark },
            { key: "applied", label: "CV", Icon: Briefcase },
            { key: "messages", label: "Чат", Icon: Send },
            { key: "improvement", label: "Профайл", Icon: Users },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key as any);
                setCurrentPage(1);
              }}
              aria-label={label}
              className={`flex flex-col items-center justify-center gap-1 px-1.5 py-2 text-[11px] transition-all ${
                activeTab === key
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span className="leading-none">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </DashboardLayout>
  );
}

function buildJobShareText(job: any): string {
  const jobUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/dashboard/candidate?job=${job.id}`
      : `/dashboard/candidate?job=${job.id}`;
  const companyName = job.company || job.employer?.fullName || "Компани";
  const jobType = JOB_TYPE_MAP[job.jobType || job.type] || job.jobType || job.type || "Бүтэн цаг";

  return [
    `Ажлын зарын холбоос: ${jobUrl}`,
    `Гарчиг: ${job.title || ""}`,
    `Компани: ${companyName}`,
    `Байршил: ${job.location || "Улаанбаатар"}`,
    `Төрөл: ${jobType}`,
    `Цалин: ${formatSalaryText(job.salary)}`,
    `Шаардлага: ${job.requirements || ""}`,
    `Тайлбар: ${job.description || ""}`,
  ].join("\n");
}
