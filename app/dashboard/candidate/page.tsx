"use client";

import Image from "next/image";
import ProfileModal from "./ProfileModal";
import CVModal from "./CVModal";
import JobDetailModal from "./JobDetailModal";
import TodoApp from "./TodoApp";
import MessagesView from "../employer/MessagesView";
import FloatingChat from "@/components/FloatingChat";
import AiAssistantPanel from "@/components/AiAssistantPanel";
import NotificationCenter from "@/components/NotificationCenter";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import UpgradePlanModal from "@/components/UpgradePlanModal";
 
import React, { Suspense, useState, useEffect, useRef, useCallback } from "react";
import DashboardLayout from "../DashboardLayout";
import {
  Search,
  Loader2,
  Sparkles,
  Send,
  Briefcase,
  Bookmark,
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
  BadgeCheck,
  Settings,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  authenticatedFetch,
  authenticatedPost,
  authenticatedPatch,
  authenticatedDelete,
  resetAxiosClient,
} from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import { useAlert } from "@/components/AlertProvider";
import { CandidateJob, JobSortKey, useJobFilters } from "@/hooks/useJobFilters";

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

function hydrateJobImages(jobs: CandidateJob[]): CandidateJob[] {
  if (typeof window === "undefined") return jobs;
  return jobs.map((job) => {
    const employerProfile = JSON.parse(localStorage.getItem(`employerProfile_${job.employerId}`) || "{}");
    const logo = employerProfile.logo || job.employer?.logo || job.employerLogo || "";
    return {
      ...job,
      jobImage: localStorage.getItem(`jobImage_${job.id}`) || job.image || job.jobImage || "",
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

type CandidateProfileDraft = {
  photo?: string;
  lastName?: string;
  firstName?: string;
  phone?: string;
  age?: string;
  gender?: string;
};

function getIncompleteProfileFields(profile?: CandidateProfileDraft | null) {
  const missing: string[] = [];
  if (!profile?.photo) missing.push("цээж зураг");
  if (!profile?.lastName?.trim()) missing.push("овог");
  if (!profile?.firstName?.trim()) missing.push("нэр");
  if (!/^\d{8}$/.test(profile?.phone || "")) missing.push("утасны дугаар");
  const age = Number(profile?.age || 0);
  if (!profile?.age || age < 16 || age > 99) missing.push("нас");
  if (!profile?.gender) missing.push("хүйс");
  return missing;
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
  highlighted = false,
  viewMode = "list",
}: {
  job: any;
  session: any;
  onApply: (job: any) => void;
  onChat: (employer: any) => void;
  onSaveToggle: (jobId: number, saved: boolean) => void;
  highlighted?: boolean;
  viewMode?: "list" | "grid";
}) {
  const { showAlert } = useAlert();
  const userId = (session?.user as any)?.id;
  const candidateApplication = job.applications?.find(
    (a: any) => Number(a.candidateId) === Number(userId)
  );
  const applied = !!candidateApplication;
  const isApproved = candidateApplication?.status === "APPROVED";
  const saved = !!job.isSaved;
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
    onSaveToggle(job.id, next);
  };

  const handleCopyJobLink = async () => {
    try {
      await navigator.clipboard.writeText(buildJobShareText(job));
      showAlert("Ажлын зарын холбоос AI-д илгээх мэдээлэлтэйгээ хуулагдлаа.", "success");
    } catch {
      showAlert("Холбоос хуулахад алдаа гарлаа.", "error");
    }
  };

  const handleChatClick = () => {
    if (!isApproved) {
      showAlert("Ажил олгогч зөвшөөрсөн үед л чатлах хэсэг нээгдэнэ. Та түр хүлээнэ үү.", "info");
      return;
    }

    onChat({
      id: job.employerId,
      email: job.employer?.email,
      fullName: job.employer?.fullName,
    });
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
      <div data-job-id={job.id} className={`bg-white dark:bg-[#111827] border rounded-2xl p-5 hover:border-blue-200 dark:hover:border-[#3b5bdb]/40 hover:shadow-lg transition-all flex flex-col gap-3 ${highlighted ? "border-blue-500 ring-2 ring-blue-500/40 shadow-lg" : "border-gray-100 dark:border-[#1f2937]"}`}>
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
            onClick={() => (applied ? handleChatClick() : onApply(job))}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500 transition-all"
          >
            {applied ? (isApproved ? "Чатлах" : "Илгээсэн") : "CV илгээх"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-job-id={job.id} className={`bg-white dark:bg-[#111827] border rounded-2xl px-4 md:px-5 py-3 md:py-4 hover:border-blue-200 dark:hover:border-[#3b5bdb]/40 hover:shadow-md transition-all ${highlighted ? "border-blue-500 ring-2 ring-blue-500/40 shadow-lg" : "border-gray-100 dark:border-[#1f2937]"}`}>
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
                  onClick={handleChatClick}
                  className="hidden md:flex px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#1a2035] rounded-xl hover:bg-gray-200 dark:hover:bg-[#1e2a45] transition-all flex-1 md:flex-none md:min-w-max"
                >
                  Чатлах
                </button>
              ) : (
                <button
                  onClick={() => onApply(job)}
                  className="hidden md:flex px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#1a2035] rounded-xl hover:bg-gray-200 dark:hover:bg-[#1e2a45] transition-all flex-1 md:flex-none md:min-w-max"
                >
                  Дэлгэрэнгүй
                </button>
              )}
              <button
                onClick={() => (applied ? handleChatClick() : onApply(job))}
                disabled={applied && !isApproved}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex-1 md:flex-none md:min-w-max ${
                  applied && !isApproved
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
  const { showAlert } = useAlert();
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
      showAlert("PDF, зураг эсвэл text файл оруулна уу.", "warning");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const sendAiMessage = async () => {
    if ((!aiInput.trim() && !selectedFile) || aiLoading) return;
    const userMsg = aiInput.trim();
    const previousMessages = aiMessages;
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
        : await authenticatedPost(API_URLS.ai.ask(), {
            message: userMsg,
            history: previousMessages.slice(-12).map((msg) => ({
              role: msg.role === "assistant" ? "assistant" : "user",
              content: msg.text,
            })),
          });
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
function CandidateDashboardContent() {
  const { data: session, status } = useSession();
  const { showAlert } = useAlert();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState<CandidateJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const chatSocket = null;
  const [floatingChatEnabled, setFloatingChatEnabled] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [appliedCountData, setAppliedCountData] = useState(0);
  const [filterStats, setFilterStats] = useState<any>({
    jobType: { FULL_TIME: 0, PART_TIME: 0, REMOTE: 0, TEMPORARY: 0, INTERNSHIP: 0 },
    experience: { "0-1": 0, "1-3": 0, "3-5": 0, "5+": 0 },
    location: {},
    totalJobs: 0,
  });

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [aiOpen, setAiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "saved" | "applied" | "messages" | "improvement">("all");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<any>(null);
  const [candidateProfile, setCandidateProfile] = useState<any>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [recentlyViewedJobIds, setRecentlyViewedJobIds] = useState<number[]>([]);
  const hydratedFilterUrlRef = useRef(false);

  const [showProfile, setShowProfile] = useState(false);
  const [showCV, setShowCV] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgradePlan, setShowUpgradePlan] = useState(false);
  const [showJobDetail, setShowJobDetail] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [highlightedJobId, setHighlightedJobId] = useState<number | null>(null);

  const JOBS_PER_PAGE = 8;
  const userId = Number((session?.user as any)?.id || 0);
  const {
    activeFilterCount,
    currentPage,
    experienceFilters,
    filteredJobs,
    jobTypeFilters,
    locationQuery,
    pageButtons,
    paginatedJobs,
    resetFilters,
    salaryMax,
    salaryMin,
    searchQuery,
    selectedCategory,
    setCurrentPage,
    setExperienceFilters,
    setJobTypeFilters,
    setLocationQuery,
    setSalaryMax,
    setSalaryMin,
    setSearchQuery,
    setSelectedCategory,
    setSortBy,
    sortBy,
    totalPages,
  } = useJobFilters({
    jobs,
    userId,
    activeTab,
    candidateProfile,
    recentlyViewedJobIds,
    jobsPerPage: JOBS_PER_PAGE,
  });
  const unreadChatCount = conversations.reduce(
    (sum: number, conversation: any) => sum + Number(conversation?.unreadCount || 0),
    0,
  );
  const sessionUserType = (session?.user as any)?.userType?.toUpperCase();
  const isWrongDashboardRole = status === "authenticated" && sessionUserType && sessionUserType !== "CANDIDATE";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status !== "authenticated" || !session?.user) return;

    if (sessionUserType === "ADMIN") router.replace("/dashboard/admin");
    else if (sessionUserType === "EMPLOYER") router.replace("/dashboard/employer");
  }, [session, sessionUserType, status, router]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem("candidateRecentlyViewedJobs") || "[]");
      if (Array.isArray(saved)) {
        setRecentlyViewedJobIds(saved.map(Number).filter(Boolean).slice(0, 12));
      }
    } catch {
      setRecentlyViewedJobIds([]);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;
    const res = await authenticatedFetch(API_URLS.chat.conversations(userId));
    setConversations(res.data || []);
  }, [session]);

  const refreshFilterStats = useCallback(async () => {
    const res = await authenticatedFetch(API_URLS.jobs.stats());
    setFilterStats(res.data);
  }, []);

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    const userId = (session?.user as any)?.id;
    if (!userId || isWrongDashboardRole) return;
    try {
      if (!options?.silent) setLoading(true);
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
      if (!options?.silent) setLoading(false);
    }
  }, [session, isWrongDashboardRole]);

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
    const tab = searchParams.get("tab");
    if (tab === "messages" || tab === "applied" || tab === "saved" || tab === "all" || tab === "improvement") {
      setActiveTab(tab);
      setCurrentPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    if (hydratedFilterUrlRef.current) return;
    hydratedFilterUrlRef.current = true;
    setSearchQuery(searchParams.get("q") || "");
    setLocationQuery(searchParams.get("location") || "");
    setSelectedCategory(searchParams.get("category") || "all");
    const type = searchParams.get("type");
    if (type) setJobTypeFilters((current) => ({ ...current, [type]: true }));
    const exp = searchParams.get("exp");
    if (exp) setExperienceFilters((current) => ({ ...current, [exp]: true }));
    const salary = Number(searchParams.get("salaryMax"));
    if (salary) setSalaryMax(salary);
    const sort = searchParams.get("sort") as JobSortKey | null;
    if (sort === "newest" || sort === "salary" || sort === "recommended" || sort === "recentlyViewed") {
      setSortBy(sort);
    }
  }, [
    searchParams,
    setExperienceFilters,
    setJobTypeFilters,
    setLocationQuery,
    setSalaryMax,
    setSearchQuery,
    setSelectedCategory,
    setSortBy,
  ]);

  useEffect(() => {
    if (!hydratedFilterUrlRef.current || activeTab === "messages" || activeTab === "improvement") return;
    const params = new URLSearchParams(searchParams.toString());
    const activeType = Object.entries(jobTypeFilters).find(([, value]) => value)?.[0] || "";
    const activeExp = Object.entries(experienceFilters).find(([, value]) => value)?.[0] || "";
    const setOrDelete = (key: string, value?: string | number) => {
      if (value && value !== "all") params.set(key, String(value));
      else params.delete(key);
    };

    setOrDelete("tab", activeTab === "all" ? "" : activeTab);
    setOrDelete("q", searchQuery.trim());
    setOrDelete("location", locationQuery.trim());
    setOrDelete("category", selectedCategory);
    setOrDelete("type", activeType);
    setOrDelete("exp", activeExp);
    setOrDelete("salaryMax", salaryMax < 10000000 ? salaryMax : "");
    setOrDelete("sort", sortBy !== "newest" ? sortBy : "");

    const query = params.toString();
    if (query !== searchParams.toString()) {
      router.replace(`/dashboard/candidate${query ? `?${query}` : ""}`, { scroll: false });
    }
  }, [
    activeTab,
    experienceFilters,
    jobTypeFilters,
    locationQuery,
    router,
    salaryMax,
    searchParams,
    searchQuery,
    selectedCategory,
    sortBy,
  ]);

  useEffect(() => {
    const handleAiJobFocus = (event: Event) => {
      const jobId = Number((event as CustomEvent<{ jobId?: number }>).detail?.jobId);
      if (!jobId) return;
      setActiveTab("all");
      resetFilters();
      const index = jobs.findIndex((job: any) => Number(job.id) === jobId);
      setCurrentPage(index >= 0 ? Math.floor(index / JOBS_PER_PAGE) + 1 : 1);
      setHighlightedJobId(jobId);
      window.setTimeout(() => {
        document.querySelector(`[data-job-id="${jobId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 160);
      window.setTimeout(() => setHighlightedJobId((current) => current === jobId ? null : current), 5000);
    };

    window.addEventListener("jobhub:ai-focus-candidate-job", handleAiJobFocus);
    return () => window.removeEventListener("jobhub:ai-focus-candidate-job", handleAiJobFocus);
  }, [jobs, resetFilters, setCurrentPage]);

  useEffect(() => {
    if (activeTab !== "messages") return;
    const timeout = setTimeout(() => {
      fetchConversations().catch(() => {});
    }, 800);
    return () => clearTimeout(timeout);
  }, [activeTab, fetchConversations]);

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
    if (!session?.user) return;
    const iv = setInterval(() => {
      refreshFilterStats().catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, [session, refreshFilterStats]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setJobs([]); setConversations([]); setSelectedContact(null);
      setSavedCount(0); setAppliedCountData(0);
      resetAxiosClient();
    }
  }, [status]);

  useEffect(() => {
    const openUpgrade = () => setShowUpgradePlan(true);
    window.addEventListener("jobhub:open-upgrade-plan", openUpgrade);
    return () => window.removeEventListener("jobhub:open-upgrade-plan", openUpgrade);
  }, []);

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

  const closeJobDetail = useCallback(() => {
    setShowJobDetail(false);
    setSelectedJob(null);

    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("job")) return;

    params.delete("job");
    const query = params.toString();
    router.replace(`/dashboard/candidate${query ? `?${query}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  const requireCompleteCandidateProfile = () => {
    const userId = (session?.user as any)?.id;
    let profile = candidateProfile;

    if (userId && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`userProfile_${userId}`);
        if (saved) profile = JSON.parse(saved);
      } catch {}
    }

    const missing = getIncompleteProfileFields(profile);
    if (missing.length === 0) return true;

    showAlert(`Ажилд хүсэлт илгээхийн өмнө профайлаа бүрэн бөглөнө үү: ${missing.join(", ")}.`, "warning");
    setCandidateProfile(profile || null);
    setShowProfile(true);
    return false;
  };

  const handleApply = (job: any) => {
    if (!session?.user) return showAlert("Нэвтэрч орно уу.", "warning");
    if (!requireCompleteCandidateProfile()) return;
    const viewedJobId = Number(job.id);
    if (viewedJobId) {
      setRecentlyViewedJobIds((current) => {
        const next = [viewedJobId, ...current.filter((id) => id !== viewedJobId)].slice(0, 12);
        if (typeof window !== "undefined") {
          localStorage.setItem("candidateRecentlyViewedJobs", JSON.stringify(next));
        }
        return next;
      });
    }
    setSelectedJob(job);
    setShowJobDetail(true);
  };

  const handleApplyWithCV = async (jobId: number, cvData?: string, cvName?: string) => {
    if (!session?.user) return showAlert("Нэвтэрч орно уу.", "warning");
    if (!requireCompleteCandidateProfile()) return;
    try {
      const userId = (session.user as any).id;

      let userProfile: any = null;
      try {
        const profileRes = await authenticatedFetch(API_URLS.auth.profile(userId));
        userProfile = profileRes.data;
      } catch (e) {
        console.error("Could not fetch profile:", e);
      }

      const submittedCV = cvData || userProfile?.cvText || "";
      const submittedCVName = cvName || userProfile?.cvFileName || "candidate-cv";

      if (!submittedCV) {
        showAlert("CV оруулаагүй байна. AI-аар үүсгээд дахин оролдоно уу.", "warning");
        setShowCV(true);
        return;
      }

      try {
        await authenticatedPatch(API_URLS.user.profile(userId), {
          cvText: submittedCV,
          cvFileName: submittedCVName,
        });
      } catch (profileUpdateError) {
        console.warn("Could not save CV to user profile before applying:", profileUpdateError);
      }

      await authenticatedPost(API_URLS.jobs.apply(), {
        jobId,
        candidateId: userId,
        cvText: submittedCV,
        cvFileName: submittedCVName,
      });
      showAlert("Хүсэлт илгээгдлээ!", "success");
      setJobs((prev) =>
        prev.map((job: any) =>
          Number(job.id) === Number(jobId)
            ? {
                ...job,
                applications: [
                  ...(job.applications || []).filter(
                    (app: any) => Number(app.candidateId) !== Number(userId),
                  ),
                  { candidateId: userId, status: "PENDING" },
                ],
              }
            : job,
        ),
      );
      closeJobDetail();
      fetchData({ silent: true });
    } catch (err: any) {
      if (err.response?.status === 400) {
        showAlert("Та аль хэдийн өргөдөл илгээсэн байна.", "info");
      } else {
        showAlert("Алдаа гарлаа.", "error");
      }
    }
  };

  const localProfileName = [candidateProfile?.lastName, candidateProfile?.firstName]
    .filter(Boolean).join(" ").trim();
  const userName =
    localProfileName ||
    (session?.user as any)?.name ||
    (session?.user as any)?.email?.split("@")[0] ||
    "Нэвтрэгч";
  const userInitial = userName[0]?.toUpperCase() || "Б";

  if (status === "loading" || isWrongDashboardRole) {
    return (
      <div className="grid h-screen place-items-center bg-[#050b14]">
        <Loader2 className="animate-spin text-[#4f67ff]" />
      </div>
    );
  }

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
              <span className="inline-flex items-center gap-2">
                {item.label}
                {item.key === "messages" && unreadChatCount > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-black text-white">
                    {unreadChatCount > 9 ? "9+" : unreadChatCount}
                  </span>
                )}
              </span>
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
          <NotificationCenter />
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
                  onClick={(e) => { e.stopPropagation(); setShowSettings(true); setProfileOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a2035] rounded-xl flex items-center gap-2.5"
                >
                  <Settings size={14} className="text-blue-500" /> Тохиргоо
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowUpgradePlan(true); setProfileOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a2035] rounded-xl flex items-center gap-2.5"
                >
                  <TrendingUp size={14} className="text-emerald-500" /> Түвшин ахиулах
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
      <div className="flex h-[100dvh] overflow-hidden bg-gray-50 pt-14 pb-20 dark:bg-[#060c18] md:pb-0">

        {activeTab === "improvement" ? (
          <main className="flex min-w-0 flex-1 items-start justify-center overflow-hidden p-2 sm:p-4 md:p-6">
            <div className="h-full w-full max-w-[1600px] overflow-hidden rounded-2xl border border-white/10 bg-[#060c18] shadow-2xl shadow-black/30 md:h-[90vh] md:w-[90vw]">
              <TodoApp userId={(session?.user as any)?.id || 0} />
            </div>
          </main>
        ) : activeTab === "messages" ? (
          <main ref={chatContainerRef} className="flex-1 overflow-hidden p-0 md:p-6">
            <MessagesView
              conversations={conversations}
              selectedContact={selectedContact}
              onSelectContact={setSelectedContact}
              senderId={(session?.user as any)?.id}
              socket={chatSocket}
              onOpenProfile={() => setFloatingChatEnabled(true)}
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
                  onChange={(e) => { setLocationQuery(e.target.value); setCurrentPage(1); }}
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
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="md:hidden relative flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#1e2535] text-gray-600 dark:text-gray-400 text-sm rounded-xl hover:border-blue-400 transition-all shrink-0"
              >
                <SlidersHorizontal size={14} />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex w-full h-full pt-[56px] bg-gray-50 dark:bg-[#060c18]">
              <aside className="hidden md:flex w-72 shrink-0 sticky top-[112px] self-start h-[calc(100vh-112px)] overflow-y-auto border-r border-gray-200 dark:border-[#1a2235] bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur p-5 scrollbar-hide flex-col shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Шүүлтүүр</p>
                  <button
                    onClick={() => {
                      resetFilters();
                      setMobileFiltersOpen(false);
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
                      onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
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
                  <div className="hidden">
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
                      onChange={(e) => { setLocationQuery(e.target.value); setCurrentPage(1); }}
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
                          onChange={(v) => { setLocationQuery(v ? loc : ""); setCurrentPage(1); }}
                        />
                      ))}
                  </div>
                </div>
              </aside>

              <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-[#060c18]">
                {activeFilterCount > 0 && (
                  <div className="shrink-0 px-6 py-3 border-b border-gray-100 dark:border-[#1a2235] bg-blue-50 dark:bg-blue-500/10 flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Идэвхтэй шүүлтүүр:</span>
                    {selectedCategory !== "all" && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-[#1a2035] border border-gray-200 dark:border-[#2a3550] rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                        {selectedCategory}
                        <button onClick={() => setSelectedCategory("all")} className="ml-1 text-gray-400 hover:text-red-500"><X size={12} /></button>
                      </div>
                    )}
                    {searchQuery.trim() && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-[#1a2035] border border-gray-200 dark:border-[#2a3550] rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                        {searchQuery.trim()}
                        <button onClick={() => setSearchQuery("")} className="ml-1 text-gray-400 hover:text-red-500"><X size={12} /></button>
                      </div>
                    )}
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
                    <button onClick={resetFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-500">
                      Reset all
                    </button>
                  </div>
                )}

                <div className="shrink-0 px-3 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 border-b border-gray-100 dark:border-[#1a2235] bg-white dark:bg-[#0b1120]">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-hide whitespace-nowrap">
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
                        onChange={(e) => setSortBy(e.target.value as JobSortKey)}
                        className="bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none cursor-pointer"
                      >
                        <option value="newest">Шинэ эхэлсэн</option>
                        <option value="salary">Цалин өндөр</option>
                        <option value="recommended">AI match</option>
                        <option value="recentlyViewed">Recent</option>
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
                      <button onClick={resetFilters} className="mt-3 text-blue-500 text-sm underline">
                        Шүүлтүүр арилгах
                      </button>
                    </div>
                  ) : (
                    <>
                      {paginatedJobs.map((job: any) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          session={session}
                          onApply={handleApply}
                          onChat={openChat}
                          onSaveToggle={handleSaveToggle}
                          highlighted={highlightedJobId === Number(job.id)}
                          viewMode={viewMode}
                        />
                      ))}
                      {currentPage < totalPages && (
                        <button
                          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                          className="md:hidden rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-blue-600 shadow-sm dark:border-[#1e2535] dark:bg-[#0b1120]"
                        >
                          Load more
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="hidden md:flex shrink-0 px-3 md:px-6 py-3 md:py-4 border-t border-gray-100 dark:border-[#1a2235] items-center justify-center gap-1 bg-white dark:bg-[#0b1120] overflow-x-auto">
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
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[70] bg-black/45 md:hidden" onClick={() => setMobileFiltersOpen(false)}>
          <section
            className="absolute bottom-0 left-0 right-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-[#1a2235] dark:bg-[#0b1120]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Filters</p>
              <button onClick={() => setMobileFiltersOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-gray-100 text-gray-500 dark:bg-[#1a2035]">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500">Category</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 outline-none dark:border-[#1e2535] dark:bg-[#0d1117] dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="IT">IT / Technology</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Design">Design</option>
                </select>
              </label>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Job type</p>
                <div className="grid grid-cols-2 gap-2">
                  {[["FULL_TIME", "Full time"], ["PART_TIME", "Part time"], ["REMOTE", "Remote"], ["TEMPORARY", "Temp"], ["INTERNSHIP", "Intern"]].map(([key, label]) => (
                    <SidebarCheckbox key={key} label={label} count={filterStats.jobType?.[key] || 0} checked={jobTypeFilters[key]} onChange={(v) => { setJobTypeFilters((f) => ({ ...f, [key]: v })); setCurrentPage(1); }} />
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500">Salary</span>
                <input type="range" min={500000} max={10000000} step={100000} value={salaryMax} onChange={(e) => { setSalaryMin(500000); setSalaryMax(Number(e.target.value)); setCurrentPage(1); }} className="w-full accent-blue-600" />
                <span className="text-xs font-semibold text-gray-500">500K - {salaryMax >= 10000000 ? "10M+" : `${Math.round(salaryMax / 1000000)}M`}</span>
              </label>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Experience</p>
                <div className="grid grid-cols-2 gap-2">
                  {[["0-1", "0-1"], ["1-3", "1-3"], ["3-5", "3-5"], ["5+", "5+"]].map(([key, label]) => (
                    <SidebarCheckbox key={key} label={label} count={filterStats.experience?.[key] || 0} checked={experienceFilters[key]} onChange={(v) => { setExperienceFilters((f) => ({ ...f, [key]: v })); setCurrentPage(1); }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={resetFilters} className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 dark:border-[#1e2535] dark:text-gray-300">Reset</button>
                <button onClick={() => setMobileFiltersOpen(false)} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">Apply</button>
              </div>
            </div>
          </section>
        </div>
      )}

      <AiAssistantPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        userId={(session?.user as any)?.id}
        role="candidate"
      />
      <FloatingChat enabled={floatingChatEnabled} />

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
      {showSettings && (
        <AccountSettingsModal
          onClose={() => setShowSettings(false)}
          userId={(session?.user as any)?.id || 0}
          role="candidate"
        />
      )}
      {showUpgradePlan && (
        <UpgradePlanModal
          onClose={() => setShowUpgradePlan(false)}
          userId={(session?.user as any)?.id || 0}
          role="candidate"
        />
      )}
      {showJobDetail && selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={closeJobDetail}
          onApply={handleApplyWithCV}
          userId={(session?.user as any)?.id || 0}
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
            { key: "improvement", label: "TODO", Icon: Sparkles },
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
              <span className="inline-flex items-center gap-1 leading-none">
                {label}
                {key === "messages" && unreadChatCount > 0 && (
                  <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                    {unreadChatCount > 9 ? "9+" : unreadChatCount}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </DashboardLayout>
  );
}

export default function CandidateDashboard() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center bg-[#050b14]">
          <Loader2 className="animate-spin text-[#4f67ff]" />
        </div>
      }
    >
      <CandidateDashboardContent />
    </Suspense>
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
