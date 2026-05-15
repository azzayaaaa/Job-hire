"use client";

import React, { useState } from "react";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Check,
  Code2,
  Copy,
  Edit3,
  Eye,
  Laptop,
  MapPin,
  MoreHorizontal,
  Palette,
  Power,
  Server,
  Trash2,
  Users,
} from "lucide-react";
import { API_URLS } from "@/lib/apiConfig";

const JOB_COLORS: Record<string, string> = {
  "Frontend Developer": "#4F67FF",
  "Backend Developer (Node.js)": "#10B981",
  "UI/UX Designer": "#A855F7",
  "Data Analyst": "#F59E0B",
  "Python Developer": "#EF4444",
};

function jobColor(title: string) {
  return JOB_COLORS[title] ?? "#4F67FF";
}

function jobIcon(title: string) {
  const icons: Record<string, React.ReactNode> = {
    "Frontend Developer": <Laptop size={16} />,
    "Backend Developer (Node.js)": <Server size={16} />,
    "UI/UX Designer": <Palette size={16} />,
    "Data Analyst": <BarChart3 size={16} />,
    "Python Developer": <Code2 size={16} />,
  };

  return icons[title] ?? <Briefcase size={16} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Идэвхтэй", cls: "bg-[#10B981]/12 text-[#10B981]" },
    PAUSED: { label: "Нooрог", cls: "bg-[#F59E0B]/12 text-[#F59E0B]" },
    CLOSED: { label: "Хаагдсан", cls: "bg-white/[0.06] text-white/30" },
  };
  const s = map[status] ?? map["ACTIVE"];
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${s.cls}`}>
      {s.label}
    </span>
  );
}

function formatJobSalary(job: any) {
  if (!job?.salary) return "Цалин тохиролцоно";
  const raw = String(job.salary);
  return raw.includes("₮") ? raw : `${raw}₮`;
}

function formatJobDate(job: any) {
  if (!job?.createdAt) return "Огноо байхгүй";
  return new Date(job.createdAt).toLocaleDateString("mn-MN");
}

function statusSummary(status?: string) {
  if (status === "PAUSED") return "Түр зогссон";
  if (status === "CLOSED") return "Хаагдсан";
  return "Идэвхтэй зар";
}

export default function JobsView({
  jobs,
  applications,
  onSelectJob,
  onEditJob,
  onDeleteJob,
  onToggleJobStatus,
}: any) {
  const [copiedJobId, setCopiedJobId] = useState<number | null>(null);
  const [openMenuJobId, setOpenMenuJobId] = useState<number | null>(null);
  const [shareToast, setShareToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  const handleShareJob = async (e: React.MouseEvent, jobId: number) => {
    e.stopPropagation();
    
    try {
      const response = await fetch(API_URLS.jobs.shareLink(jobId), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to get share link');
      }

      const data = await response.json();
      const shareLink = data.shareLink || `${window.location.origin}/dashboard/candidate?job=${jobId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareLink);
      
      setCopiedJobId(jobId);
      setShareToast({ show: true, message: 'Ажлын холбоос хуулагдлаа' });
      
      setTimeout(() => {
        setCopiedJobId(null);
        setShareToast({ show: false, message: "" });
      }, 2000);
    } catch (error) {
      console.error('Error sharing job:', error);
      setShareToast({ show: true, message: 'Алдаа: Холбоос хуулж чадсангүй' });
      setTimeout(() => setShareToast({ show: false, message: "" }), 2000);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, jobId: number) => {
    e.stopPropagation();
    setOpenMenuJobId((current) => (current === jobId ? null : jobId));
  };

  const runAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    setOpenMenuJobId(null);
    action();
  };

  const renderMenu = (job: any) => (
    <div className="absolute right-0 top-8 z-30 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0b1120] shadow-2xl">
      <button
        type="button"
        onClick={(e) => runAction(e, () => onEditJob?.(job))}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white/80 hover:bg-white/[0.06]"
      >
        <Edit3 size={13} />
        Засах
      </button>
      <button
        type="button"
        onClick={(e) => runAction(e, () => onToggleJobStatus?.(job))}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white/80 hover:bg-white/[0.06]"
      >
        <Power size={13} />
        {job.status === "ACTIVE" ? "Идэвхгүй болгох" : "Идэвхтэй болгох"}
      </button>
      <button
        type="button"
        onClick={(e) => runAction(e, () => onDeleteJob?.(job))}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-red-300 hover:bg-red-500/10"
      >
        <Trash2 size={13} />
        Устгах
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-black text-white">Ажлын байрууд</h2>
          <p className="text-[12px] text-white/35 mt-1">
            {jobs.length} идэвхтэй ажлын байр байна
          </p>
        </div>
        <Briefcase size={24} className="text-white/20" />
      </div>

      {/* Share Toast */}
      {shareToast.show && (
        <div className="bg-blue-600 text-white px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
          <Check size={16} />
          {shareToast.message}
        </div>
      )}

      {/* Jobs Grid */}
      {jobs.length > 0 ? (
        <div className="bg-[#111827] rounded-2xl border border-white/[0.06] overflow-visible">
          <div className="grid gap-3 p-3 md:hidden">
            {jobs.map((job: any) => (
              <div
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectJob(job)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectJob(job);
                  }
                }}
                className="w-full rounded-xl border border-white/[0.06] bg-[#0d1526] p-3 text-left transition-all hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${jobColor(job.title)}18`, color: jobColor(job.title) }}
                    >
                      {jobIcon(job.title)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 break-words text-[13px] font-black text-white">
                          {job.title}
                        </p>
                        <StatusBadge status={job.status ?? "ACTIVE"} />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/45">
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate">{job.location || "Улаанбаатар"}</span>
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-white/65">
                        {job.jobType || "Бүтэн цагийн"} · {formatJobSalary(job)}
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => handleMenuClick(e, job.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-white/35 hover:text-white"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openMenuJobId === job.id && renderMenu(job)}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-white/45">
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={11} />
                    {applications.filter((a: any) => a.jobId === job.id).length} анкет
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye size={11} />
                    {(job.views ?? 0).toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={11} />
                    {formatJobDate(job)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3">
                  <button
                    type="button"
                    onClick={(e) => handleShareJob(e, job.id)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-400/15"
                    title="Ажлын холбоос хуулах"
                  >
                    {copiedJobId === job.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedJobId === job.id ? "Хуулагдсан" : "Хуулах"}
                  </button>
                  <span className="text-[10px] font-semibold text-[#10B981]">
                    {statusSummary(job.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-white/25">
                  Ажлын байр
                </th>
                <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-white/25">
                  Төрөл
                </th>
                <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-white/25">
                  Анкет
                </th>
                <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-white/25">
                  Үзсэн
                </th>
                <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-white/25">
                  Статус
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {jobs.map((job: any) => (
                <tr
                  key={job.id}
                  onClick={() => onSelectJob(job)}
                  className="cursor-pointer transition-all hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 lg:px-6">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${jobColor(job.title)}18`, color: jobColor(job.title) }}
                      >
                        {jobIcon(job.title)}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-[12px] font-bold text-white">
                          {job.title}
                        </p>
                        <p className="break-words text-[10px] text-white/35">
                          {job.location || "Улаанбаатар"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-white/40 lg:px-6">
                    {job.jobType || "Бүтэн цагийн"}
                  </td>
                  <td className="px-4 py-3 lg:px-6">
                    <span className="text-[12px] font-bold text-white">
                      {applications.filter((a: any) => a.jobId === job.id).length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-white/50 lg:px-6">
                    {(job.views ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 lg:px-6">
                    <StatusBadge status={job.status ?? "ACTIVE"} />
                  </td>
                  <td className="px-4 py-3 lg:px-6">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleShareJob(e, job.id)}
                        className="w-7 h-7 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/35 hover:text-white hover:border-white/20 hover:bg-blue-600/10 transition-all"
                        title="Ажлын холбоос хуулах"
                      >
                        {copiedJobId === job.id ? (
                          <Check size={13} className="text-green-400" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => handleMenuClick(e, job.id)}
                          className="w-7 h-7 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/35 hover:text-white hover:border-white/20 transition-all"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {openMenuJobId === job.id && renderMenu(job)}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-8 text-center">
          <Briefcase size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-[12px] text-white/40">
            Ажлын байр үүсүүлээд шүүлт хийж эхлээрэй
          </p>
        </div>
      )}
    </div>
  );
}
