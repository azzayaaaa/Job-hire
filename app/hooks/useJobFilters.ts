"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type JobApplication = {
  candidateId?: number | string;
  status?: string;
};

export type CandidateJob = {
  id: number | string;
  title?: string;
  company?: string;
  category?: string;
  tags?: string[];
  location?: string;
  jobType?: string;
  type?: string;
  experience?: string | number;
  salary?: unknown;
  salaryMin?: number | string;
  salaryMax?: number | string;
  createdAt?: string | Date;
  isSaved?: boolean;
  applications?: JobApplication[];
  employer?: {
    fullName?: string;
    email?: string;
    logo?: string;
  };
  [key: string]: unknown;
};

export type JobSortKey = "newest" | "salary" | "recommended" | "recentlyViewed";
export type JobTabKey = "all" | "saved" | "applied" | "messages" | "improvement";

const DEFAULT_JOB_TYPES = {
  FULL_TIME: false,
  PART_TIME: false,
  REMOTE: false,
  TEMPORARY: false,
  INTERNSHIP: false,
};

const DEFAULT_EXPERIENCE = {
  "0-1": false,
  "1-3": false,
  "3-5": false,
  "5+": false,
};
const SALARY_MIN_DEFAULT = 500000;
const SALARY_MAX_DEFAULT = 10000000;

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

function getJobSalaryMax(job: CandidateJob): number {
  return Number(job.salaryMax) || parseSalaryValue(job.salary);
}

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

function scoreJob(job: CandidateJob, profile?: unknown): number {
  const profileText = normalizeText(JSON.stringify(profile || {}));
  const jobText = normalizeText([
    job.title,
    job.company,
    job.category,
    job.location,
    job.jobType || job.type,
    ...(job.tags || []),
  ].join(" "));

  if (!profileText) return getJobSalaryMax(job) / 1_000_000;

  const tokens = Array.from(
    new Set(
      profileText
        .split(/[^a-zа-яө үё0-9+#.]+/i)
        .map((item) => item.trim())
        .filter((item) => item.length > 2),
    ),
  ).slice(0, 80);

  const matches = tokens.filter((token) => jobText.includes(token)).length;
  return matches * 10 + getJobSalaryMax(job) / 1_000_000;
}

function makePageButtons(currentPage: number, totalPages: number): (number | "...")[] {
  const buttons: (number | "...")[] = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (
      page === 1 ||
      page === totalPages ||
      (page >= currentPage - 1 && page <= currentPage + 1)
    ) {
      buttons.push(page);
    } else if (buttons[buttons.length - 1] !== "...") {
      buttons.push("...");
    }
  }
  return buttons;
}

export function useJobFilters({
  jobs,
  userId,
  activeTab,
  candidateProfile,
  recentlyViewedJobIds,
  jobsPerPage = 8,
}: {
  jobs: CandidateJob[];
  userId?: number;
  activeTab: JobTabKey;
  candidateProfile?: unknown;
  recentlyViewedJobIds?: number[];
  jobsPerPage?: number;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<JobSortKey>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [jobTypeFilters, setJobTypeFilters] = useState<Record<string, boolean>>(DEFAULT_JOB_TYPES);
  const [experienceFilters, setExperienceFilters] = useState<Record<string, boolean>>(DEFAULT_EXPERIENCE);
  const [salaryMin, setSalaryMin] = useState(SALARY_MIN_DEFAULT);
  const [salaryMax, setSalaryMax] = useState(SALARY_MAX_DEFAULT);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 280);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setLocationQuery("");
    setSelectedCategory("all");
    setJobTypeFilters(DEFAULT_JOB_TYPES);
    setExperienceFilters(DEFAULT_EXPERIENCE);
    setSalaryMin(SALARY_MIN_DEFAULT);
    setSalaryMax(SALARY_MAX_DEFAULT);
    setSortBy("newest");
    setCurrentPage(1);
  }, []);

  const filteredJobs = useMemo(() => {
    let list = [...jobs];

    if (activeTab === "saved") list = list.filter((job) => job.isSaved);
    if (activeTab === "applied" && userId) {
      list = list.filter((job) =>
        job.applications?.some((app) => Number(app.candidateId) === Number(userId)),
      );
    }

    if (debouncedSearchQuery.trim()) {
      const query = normalizeText(debouncedSearchQuery);
      list = list.filter((job) =>
        [
          job.title,
          job.company,
          job.employer?.fullName,
          job.category,
          job.location,
          ...(job.tags || []),
        ]
          .map(normalizeText)
          .some((value) => value.includes(query)),
      );
    }

    if (selectedCategory !== "all") {
      const category = normalizeText(selectedCategory);
      list = list.filter((job) =>
        normalizeText(job.category).includes(category) ||
        (job.tags || []).some((tag) => normalizeText(tag).includes(category)),
      );
    }

    if (locationQuery.trim()) {
      const query = normalizeText(locationQuery);
      list = list.filter((job) => normalizeText(job.location).includes(query));
    }

    const activeTypes = Object.entries(jobTypeFilters).filter(([, value]) => value).map(([key]) => key);
    if (activeTypes.length > 0) {
      list = list.filter((job) => activeTypes.includes(String(job.jobType || job.type || "")));
    }

    const activeExperience = Object.entries(experienceFilters).filter(([, value]) => value).map(([key]) => key);
    if (activeExperience.length > 0) {
      list = list.filter((job) => {
        const experience = normalizeText(job.experience);
        return activeExperience.some((item) => experience.includes(item));
      });
    }

    if (salaryMax < SALARY_MAX_DEFAULT) {
      list = list.filter((job) => {
        const parsedSalary = parseSalaryValue(job.salary);
        const min = Number(job.salaryMin) || parsedSalary || 0;
        const max = Number(job.salaryMax) || parsedSalary || Infinity;
        return max >= salaryMin && min <= salaryMax;
      });
    }

    if (sortBy === "salary") {
      list.sort((a, b) => getJobSalaryMax(b) - getJobSalaryMax(a));
    } else if (sortBy === "recommended") {
      list.sort((a, b) => scoreJob(b, candidateProfile) - scoreJob(a, candidateProfile));
    } else if (sortBy === "recentlyViewed") {
      const order = new Map((recentlyViewedJobIds || []).map((id, index) => [id, index]));
      list.sort((a, b) => (order.get(Number(a.id)) ?? 9999) - (order.get(Number(b.id)) ?? 9999));
    } else {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    }

    return list;
  }, [
    activeTab,
    candidateProfile,
    debouncedSearchQuery,
    experienceFilters,
    jobTypeFilters,
    jobs,
    locationQuery,
    recentlyViewedJobIds,
    salaryMax,
    salaryMin,
    selectedCategory,
    sortBy,
    userId,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / jobsPerPage));
  const effectiveCurrentPage = Math.min(currentPage, totalPages);
  const paginatedJobs = filteredJobs.slice(
    (effectiveCurrentPage - 1) * jobsPerPage,
    effectiveCurrentPage * jobsPerPage,
  );
  const pageButtons = () => makePageButtons(effectiveCurrentPage, totalPages);
  const activeFilterCount =
    Number(!!searchQuery.trim()) +
    Number(!!locationQuery.trim()) +
    Number(selectedCategory !== "all") +
    Number(salaryMax < SALARY_MAX_DEFAULT) +
    Object.values(jobTypeFilters).filter(Boolean).length +
    Object.values(experienceFilters).filter(Boolean).length;

  return {
    activeFilterCount,
    currentPage,
    debouncedSearchQuery,
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
  };
}
