"use client";

import React from "react";
import { Users, Star, Mail, MapPin, Briefcase, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

export default function CandidatesView({
  applications,
  jobs,
  onSelectCandidate,
  onApproveCandidate,
  onRejectCandidate,
  processingApplicationId,
}: any) {
  const getRating = (candidate: any) => {
    // Simple scoring based on profile completeness
    let score = 0;
    if (candidate.fullName) score += 20;
    if (candidate.email) score += 20;
    if (candidate.phone) score += 20;
    if (candidate.location) score += 20;
    if (candidate.cv || candidate.cvText) score += 20;
    return score;
  };

  const getRatingColor = (score: number) => {
    if (score >= 80) return "text-[#10B981]";
    if (score >= 60) return "text-[#F59E0B]";
    return "text-[#EF4444]";
  };

  const handleCandidateSelect = (candidate: any) => {
    console.log("👤 CandidatesView: Candidate selected:", {
      id: candidate.id,
      fullName: candidate.fullName,
      cvText: !!candidate.cvText,
      cvFileName: candidate.cvFileName,
      allFields: Object.keys(candidate)
    });
    onSelectCandidate && onSelectCandidate(candidate);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      APPROVED: { label: "Зөвшөөрсөн", cls: "bg-[#10B981]/12 text-[#10B981]" },
      REJECTED: { label: "Татгалзсан", cls: "bg-[#EF4444]/12 text-[#EF4444]" },
      REVIEWED: { label: "Үнэлэгдсэн", cls: "bg-[#A855F7]/12 text-[#A855F7]" },
      PENDING: { label: "Шинэ", cls: "bg-[#4F67FF]/12 text-[#4F67FF]" },
    };
    return map[status] || map.PENDING;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-black text-white">Кандидатууд</h2>
          <p className="text-[12px] text-white/35 mt-1">
            {applications.length} өргөдөл хүлээн авсан
          </p>
        </div>
        <Users size={24} className="text-white/20" />
      </div>

      {/* Candidates List */}
      {applications.length > 0 ? (
        <div className="space-y-3">
          {applications
            .map((app: any, idx: number) => {
              const candidate = app.candidate || {};
              const job = app.job || jobs?.find((j: any) => Number(j.id) === Number(app.jobId)) || {};
              const rating = getRating(candidate);
              const statusBadge = getStatusBadge(app.status);
              const isProcessing = processingApplicationId === app.id;
              return (
                <div
                  key={idx}
                  onClick={() =>
                    handleCandidateSelect({
                      ...candidate,
                      applicationId: app.id,
                      applicationStatus: app.status,
                      appliedFor: job.title,
                    })
                  }
                  className="bg-[#111827] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.12] transition-all cursor-pointer hover:bg-[#111827]/80"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-[#4F67FF]/20 rounded-xl flex items-center justify-center text-sm font-black text-[#4F67FF] shrink-0">
                        {(candidate.fullName?.[0] || candidate.email?.[0] || "U").toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[12px] font-bold text-white truncate">
                            {candidate.fullName || "Нэр бүртгэлтэй емес"}
                          </p>
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={10}
                                className={
                                  i < Math.round(rating / 20)
                                    ? "fill-[#F59E0B] text-[#F59E0B]"
                                    : "text-white/10"
                                }
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-white/50 mb-2">
                          {candidate.email && (
                            <>
                              <Mail size={11} className="shrink-0" />
                              <span className="truncate">{candidate.email}</span>
                            </>
                          )}
                          {candidate.location && (
                            <>
                              <MapPin size={11} className="shrink-0" />
                              <span>{candidate.location}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[9px] text-white/40">
                          <Briefcase size={10} />
                          <span>{job.title || "Ажлын зар"}</span>
                          <span>•</span>
                          <span>
                            {new Date(app.createdAt).toLocaleDateString("mn-MN")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRejectCandidate?.(app.id);
                        }}
                        disabled={isProcessing || app.status === "REJECTED"}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EF4444]/10 text-[#F87171] text-[10px] font-black hover:bg-[#EF4444]/20 disabled:opacity-45 disabled:cursor-not-allowed transition-all"
                      >
                        <XCircle size={13} /> Татгалзах
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApproveCandidate?.(app.id);
                        }}
                        disabled={isProcessing || app.status === "APPROVED"}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#10B981]/10 text-[#34D399] text-[10px] font-black hover:bg-[#10B981]/20 disabled:opacity-45 disabled:cursor-not-allowed transition-all"
                      >
                        <CheckCircle2 size={13} /> Зөвшөөрөх
                      </button>
                      <ChevronRight size={13} className="text-white/20" />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-8 text-center">
          <Users size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-[12px] text-white/40">
            Ажлын байр нийтлэгдсэний дараа кандидатуудыг эндээс харах боломжтой
          </p>
        </div>
      )}
    </div>
  );
}
