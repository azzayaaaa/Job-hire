"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BadgeCheck,
  Briefcase,
  Calendar,
  Copy,
  Filter,
  Heart,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { API_URLS } from "./lib/apiConfig";

type JobForLanding = {
  id: number;
  title?: string | null;
  company?: string | null;
  employer?: { fullName?: string | null; logo?: string | null } | null;
  employerId?: number | null;
  location?: string | null;
  jobType?: string | null;
  type?: string | null;
  experience?: string | null;
  salary?: string | null;
  salaryMin?: string | number | null;
  salaryMax?: string | number | null;
  description?: string | null;
  requirements?: string | null;
  employerLogo?: string | null;
  createdAt?: string | Date | null;
};

const JOB_TYPE_MAP: Record<string, string> = {
  FULL_TIME: "Бүтэн цаг",
  PART_TIME: "Хагас цаг",
  REMOTE: "Зайнаас",
  TEMPORARY: "Түр хугацаа",
  INTERNSHIP: "Дадлага",
};

const JOB_TYPES = Object.entries(JOB_TYPE_MAP);
const JOBS_PER_PAGE = 8;

function getDashboardPath(userType?: string | null) {
  switch (userType?.toUpperCase()) {
    case "ADMIN":
      return "/dashboard/admin";
    case "EMPLOYER":
      return "/dashboard/employer";
    case "CANDIDATE":
      return "/dashboard/candidate";
    default:
      return "/dashboard";
  }
}

function getRelativeTime(createdAt?: string | Date | null): string {
  if (!createdAt) return "Саяхан";
  const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return "Саяхан";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Саяхан";
  if (diffMins < 60) return `${diffMins} минутын өмнө`;
  if (diffHours < 24) return `${diffHours} цагийн өмнө`;
  if (diffDays < 7) return `${diffDays} өдрийн өмнө`;
  return date.toLocaleDateString("mn-MN");
}

function parseSalaryValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;

  const normalized = value.toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return 0;

  const amount = Number(match[0]);
  if (!Number.isFinite(amount)) return 0;
  if (/[мm]/.test(normalized)) return amount * 1_000_000;
  if (/[кk]/.test(normalized)) return amount * 1_000;
  return amount;
}

function formatMoney(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Тохиролцоно";
  return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}₮`;
}

function formatSalaryText(job: JobForLanding): string {
  if (job.salaryMin && job.salaryMax) {
    return `${formatMoney(job.salaryMin)} - ${formatMoney(job.salaryMax)}`;
  }
  if (!job.salary) return "Тохиролцоно";
  const parsed = parseSalaryValue(job.salary);
  if (!parsed) return job.salary;
  return formatMoney(parsed);
}

function getJobSalaryMax(job: JobForLanding): number {
  return Number(job.salaryMax) || parseSalaryValue(job.salary) || Number(job.salaryMin) || 0;
}

function getJobTimestampMs(job: JobForLanding): number {
  if (!job.createdAt) return 0;
  const date = typeof job.createdAt === "string" ? new Date(job.createdAt) : job.createdAt;
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function CompanyAvatar({ name, image }: { name: string; image?: string | null }) {
  if (image) {
    return (
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <img src={image} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "J";

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">
      {letters}
    </div>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
    >
      <span>{label}</span>
      <span
        className={`h-4 w-4 rounded border ${
          checked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
        }`}
      />
    </button>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [jobs, setJobs] = useState<JobForLanding[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [postedFrom, setPostedFrom] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "salary">("newest");
  const [salaryMin, setSalaryMin] = useState(0);
  const [salaryMax, setSalaryMax] = useState(10000000);
  const [jobTypeFilters, setJobTypeFilters] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoadingJobs(true);
        setJobsError("");
        const res = await fetch(API_URLS.jobs.all(), {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to load jobs (${res.status})`);
        const data = await res.json();
        const list = (data?.data || data || []) as JobForLanding[];
        setJobs(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error("Failed to load landing jobs:", error);
        setJobs([]);
        setJobsError("Ажлын зар ачаалахад алдаа гарлаа.");
      } finally {
        setLoadingJobs(false);
      }
    };

    fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    let list = [...jobs];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter((job) => {
        const company = job.company || job.employer?.fullName || "";
        return (
          (job.title || "").toLowerCase().includes(query) ||
          company.toLowerCase().includes(query) ||
          (job.description || "").toLowerCase().includes(query)
        );
      });
    }

    if (locationQuery.trim()) {
      const query = locationQuery.toLowerCase();
      list = list.filter((job) => (job.location || "").toLowerCase().includes(query));
    }

    if (postedFrom) {
      const [year, month, day] = postedFrom.split("-").map(Number);
      const start = new Date(year, month - 1, day).getTime();
      list = list.filter((job) => getJobTimestampMs(job) >= start);
    }

    const activeTypes = Object.entries(jobTypeFilters)
      .filter(([, active]) => active)
      .map(([type]) => type);
    if (activeTypes.length) {
      list = list.filter((job) => activeTypes.includes(job.jobType || job.type || ""));
    }

    if (salaryMin > 0 || salaryMax < 10000000) {
      list = list.filter((job) => {
        const min = Number(job.salaryMin) || parseSalaryValue(job.salary) || 0;
        const max = Number(job.salaryMax) || parseSalaryValue(job.salary) || Infinity;
        return max >= salaryMin && min <= salaryMax;
      });
    }

    if (sortBy === "salary") {
      list.sort((a, b) => getJobSalaryMax(b) - getJobSalaryMax(a));
    } else {
      list.sort((a, b) => getJobTimestampMs(b) - getJobTimestampMs(a));
    }

    return list;
  }, [jobs, searchQuery, locationQuery, postedFrom, jobTypeFilters, salaryMin, salaryMax, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PER_PAGE));
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, locationQuery, postedFrom, jobTypeFilters, salaryMin, salaryMax, sortBy]);

  const routeToLoginForJob = (jobId: number) => {
    const returnTo = `/dashboard/candidate?job=${jobId}`;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("postLoginRedirect", returnTo);
    }
    router.push(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  };

  const handleApplyClick = (jobId: number) => {
    if (status !== "authenticated" || !session?.user) {
      routeToLoginForJob(jobId);
      return;
    }
    const userType = (session.user as any).userType?.toUpperCase();
    if (userType !== "CANDIDATE") {
      alert("CV илгээх нь зөвхөн ажил хайгч эрхтэй хэрэглэгчид нээлттэй.");
      router.push(getDashboardPath(userType));
      return;
    }
    router.push(`/dashboard/candidate?job=${jobId}`);
  };

  const handleSaveToggle = (jobId: number) => {
    if (status !== "authenticated" || !session?.user) {
      routeToLoginForJob(jobId);
      return;
    }
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleDashboardClick = async () => {
    if (status === "authenticated") {
      await signOut({ callbackUrl: "/login?selectAccount=1" });
      return;
    }

    router.push("/login?selectAccount=1");
  };

  const handleCopyJobLink = async (job: JobForLanding) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const text = `${origin}/dashboard/candidate?job=${job.id}`;
    await navigator.clipboard.writeText(text);
    alert("Ажлын зарын холбоос хуулагдлаа.");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setLocationQuery("");
    setPostedFrom("");
    setSalaryMin(0);
    setSalaryMax(10000000);
    setJobTypeFilters({});
    setSortBy("newest");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-black text-white">
              J
            </div>
            <div>
              <p className="text-lg font-black leading-none">JobHub</p>
              <p className="text-xs font-semibold text-slate-500">Ажлын зарын сан</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {status === "authenticated" ? (
              <button
                type="button"
                onClick={handleDashboardClick}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Dashboard
              </button>
            ) : (
              <>
                <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
                  Нэвтрэх
                </Link>
                <Link href="/register" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">
                  Бүртгүүлэх
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                <Briefcase size={14} />
                Нээлттэй ажлын байрууд
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Ажлын зараа хайж, CV илгээнэ үү</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Нэвтрээгүй хэрэглэгч ажлын зарыг үзэж болно. CV илгээх үед нэвтрэх хуудас руу шилжинэ.
              </p>
            </div>
            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 text-sm font-bold">
              <button
                type="button"
                onClick={() => setSortBy("newest")}
                className={`rounded-xl px-4 py-2 ${sortBy === "newest" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                Шинэ
              </button>
              <button
                type="button"
                onClick={() => setSortBy("salary")}
                className={`rounded-xl px-4 py-2 ${sortBy === "salary" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                Цалин
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_280px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Албан тушаал, компани, түлхүүр үгээр хайх..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Байршил"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-black">
              <SlidersHorizontal size={18} className="text-blue-600" />
              Шүүлтүүр
            </div>
            <button onClick={clearFilters} className="text-xs font-bold text-blue-600 hover:text-blue-700">
              Цэвэрлэх
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <Calendar size={14} />
                Нийтлэгдсэн огноо
              </label>
              <input
                type="date"
                value={postedFrom}
                onChange={(e) => setPostedFrom(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <Filter size={14} />
                Ажлын төрөл
              </p>
              <div className="space-y-1">
                {JOB_TYPES.map(([key, label]) => (
                  <FilterCheckbox
                    key={key}
                    label={label}
                    checked={Boolean(jobTypeFilters[key])}
                    onChange={() =>
                      setJobTypeFilters((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Цалингийн хүрээ</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(Number(e.target.value) || 0)}
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500"
                  placeholder="Доод"
                />
                <input
                  type="number"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(Number(e.target.value) || 10000000)}
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500"
                  placeholder="Дээд"
                />
              </div>
            </div>
          </div>
        </aside>

        <div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-600">
              <span className="font-black text-slate-950">{filteredJobs.length}</span> ажлын байр олдлоо
            </p>
            <p className="text-xs font-semibold text-slate-500">CV илгээхэд нэвтрэх шаардлагатай</p>
          </div>

          {loadingJobs ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Loader2 className="animate-spin text-blue-600" size={30} />
            </div>
          ) : jobsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center font-bold text-red-700">
              {jobsError}
            </div>
          ) : paginatedJobs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-lg font-black">Ажлын зар олдсонгүй</p>
              <p className="mt-2 text-sm text-slate-500">Шүүлтүүрээ өөрчлөөд дахин хайгаарай.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedJobs.map((job) => {
                const companyName = job.company || job.employer?.fullName || "Компани";
                const companyImage = job.employerLogo || job.employer?.logo;
                const jobType = JOB_TYPE_MAP[job.jobType || job.type || ""] || job.jobType || job.type || "Бүтэн цаг";
                const isSaved = saved.has(job.id);

                return (
                  <article
                    key={job.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex gap-4">
                      <CompanyAvatar name={companyName} image={companyImage} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-lg font-black tracking-tight text-slate-950">
                              {job.title || "Ажлын байр"}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
                              <span>{companyName}</span>
                              <BadgeCheck size={14} className="text-blue-600" />
                              <span className="hidden sm:inline">•</span>
                              <span>{getRelativeTime(job.createdAt)}</span>
                            </div>
                          </div>
                          <div className="rounded-xl bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">
                            {formatSalaryText(job)}
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                          {job.description || job.requirements || "Дэлгэрэнгүй мэдээллийг dashboard дээрээс харна уу."}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1">
                            <MapPin size={13} />
                            {job.location || "Улаанбаатар"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1">
                            <Briefcase size={13} />
                            {jobType}
                          </span>
                          {job.experience && <span className="rounded-lg bg-slate-100 px-2.5 py-1">{job.experience}</span>}
                        </div>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyJobLink(job)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                              title="Холбоос хуулах"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveToggle(job.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-200 hover:text-red-500"
                              title="Хадгалах"
                            >
                              <Heart size={17} fill={isSaved ? "#ef4444" : "none"} stroke={isSaved ? "#ef4444" : "currentColor"} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyClick(job.id)}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
                          >
                            CV илгээх
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }).map((_, index) => {
                const page = index + 1;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`h-10 min-w-10 rounded-xl px-3 text-sm font-black transition ${
                      currentPage === page
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
