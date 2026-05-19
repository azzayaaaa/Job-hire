import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Building2, CalendarDays, CheckCircle2, LogIn, MapPin, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";

const EXPERIENCE_MARKER = /^\[EXPERIENCE:([^\]]+)\]\s*/;

function cleanRequirements(value?: string | null) {
  return String(value || "").replace(EXPERIENCE_MARKER, "").trim();
}

function getExperience(value?: string | null) {
  return String(value || "").match(EXPERIENCE_MARKER)?.[1] || "Туршлага нээлттэй";
}

function formatDate(value?: Date | string | null) {
  if (!value) return "Саяхан";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Саяхан";
  return date.toLocaleDateString("mn-MN");
}

function splitLines(value?: string | null) {
  return String(value || "")
    .split(/\n|•|-/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id: Number(id) },
    select: { title: true, description: true },
  });

  return {
    title: job?.title ? `${job.title} | JobHub MN` : "JobHub MN",
    description: job?.description?.slice(0, 150) || "JobHub MN ажлын зар",
  };
}

export default async function PublicJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) notFound();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      employer: { select: { id: true, fullName: true, email: true, phone: true } },
      applications: { select: { id: true } },
    },
  });

  if (!job || job.status === "DELETED") notFound();

  const requirements = cleanRequirements(job.requirements);
  const requirementItems = splitLines(requirements);
  const applyPath = `/login?callbackUrl=${encodeURIComponent(`/dashboard/candidate?job=${job.id}`)}`;

  return (
    <main className="min-h-screen bg-[#050812] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(79,103,255,0.24),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.18),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-black tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#4f67ff]">
              <Briefcase size={18} />
            </span>
            JobHub MN
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-bold text-white/80 hover:bg-white/10"
          >
            <LogIn size={15} />
            Нэвтрэх
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-200">
              <Sparkles size={14} />
              JobHub ажлын зар
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              {job.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">
              {job.description || "Энэ ажлын байранд тохирох ур чадвар, туршлагатай ажил горилогчдыг урьж байна."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/35">
                  <Building2 size={15} />
                  Байгууллага
                </p>
                <p className="mt-2 text-lg font-black">{job.employer.fullName || job.employer.email}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/35">
                  <MapPin size={15} />
                  Байршил
                </p>
                <p className="mt-2 text-lg font-black">{job.location || "Улаанбаатар"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/35">
                  <Briefcase size={15} />
                  Төрөл
                </p>
                <p className="mt-2 text-lg font-black">{job.jobType || "FULL_TIME"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/35">
                  <CalendarDays size={15} />
                  Нийтэлсэн
                </p>
                <p className="mt-2 text-lg font-black">{formatDate(job.createdAt)}</p>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-[#0b1120]/90 p-5 shadow-2xl shadow-black/30">
            <div className="rounded-2xl bg-[#4f67ff] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">Цалин</p>
              <p className="mt-2 text-3xl font-black">{job.salary || "Тохиролцоно"}</p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/35">Туршлага</p>
                <p className="mt-1 text-sm font-bold text-white/85">{getExperience(job.requirements)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/35">Ангилал</p>
                <p className="mt-1 text-sm font-bold text-white/85">{job.category || "IT"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/35">Анкет</p>
                <p className="mt-1 text-sm font-bold text-white/85">{job.applications.length} хүн илгээсэн</p>
              </div>
            </div>

            <Link
              href={applyPath}
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-cyan-400 text-sm font-black text-[#05101f] hover:bg-cyan-300"
            >
              Анкет илгээх
            </Link>
          </aside>
        </section>

        <section className="relative mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <h2 className="text-xl font-black">Шаардлага</h2>
          {requirementItems.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {requirementItems.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-[#0b1120] p-4 text-sm leading-6 text-white/75">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={18} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/60">Дэлгэрэнгүй шаардлага оруулаагүй байна.</p>
          )}
        </section>
      </div>
    </main>
  );
}
