"use client";

import React from "react";
import {
  Briefcase, MapPin, Users, Eye, MoreHorizontal,
  ChevronRight, TrendingUp,
} from "lucide-react";

const JOB_COLORS: Record<string, string> = {
  "Frontend Developer": "#4F67FF",
  "Backend Developer (Node.js)": "#10B981",
  "UI/UX Designer": "#A855F7",
  "Data Analyst": "#F59E0B",
  "Python Developer": "#EF4444",
};

const JOB_ICONS: Record<string, string> = {
  "Frontend Developer": "💻",
  "Backend Developer (Node.js)": "🟢",
  "UI/UX Designer": "🎨",
  "Data Analyst": "📊",
  "Python Developer": "🐍",
};

function jobColor(title: string) {
  return JOB_COLORS[title] ?? "#4F67FF";
}

function jobIcon(title: string) {
  return JOB_ICONS[title] ?? "💼";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Идэвхтэй", cls: "bg-[#10B981]/12 text-[#10B981]" },
    PAUSED: { label: "Нөөрог", cls: "bg-[#F59E0B]/12 text-[#F59E0B]" },
    CLOSED: { label: "Хаагдсан", cls: "bg-white/[0.06] text-white/30" },
  };
  const s = map[status] ?? map["ACTIVE"];
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function JobsView({ jobs, applications, onSelectJob }: any) {
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

      {/* Jobs Grid */}
      {jobs.length > 0 ? (
        <div className="bg-[#111827] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
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
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ background: `${jobColor(job.title)}18` }}
                      >
                        {jobIcon(job.title)}
                      </div>
                      <div>
                        <p className="text-[12px] font-bold text-white">
                          {job.title}
                        </p>
                        <p className="text-[10px] text-white/35">
                          {job.location || "Улаанбаатар"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-[10px] text-white/40">
                    {job.jobType || "Бүтэн цагийн"}
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-[12px] font-bold text-white">
                      {applications.filter((a: any) => a.jobId === job.id).length}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[12px] text-white/50">
                    {(job.views ?? 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={job.status ?? "ACTIVE"} />
                  </td>
                  <td className="px-6 py-3">
                    <button className="w-7 h-7 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/35 hover:text-white hover:border-white/20 transition-all">
                      <MoreHorizontal size={13} />
                    </button>
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
