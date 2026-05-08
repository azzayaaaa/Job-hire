"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, GripVertical, Star, Mail, Phone, MapPin, Briefcase, FileText } from "lucide-react";
import CVPreviewModal from "./CVPreviewModal";

export default function CandidateProfilePanel({
  candidate,
  onClose,
}: {
  candidate: any;
  onClose: () => void;
}) {
  const [position, setPosition] = useState({ top: 20, right: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showCV, setShowCV] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("📋 CandidateProfilePanel received candidate:", {
      id: candidate.id,
      fullName: candidate.fullName || "(none)",
      email: candidate.email || "(none)",
      cvText: candidate.cvText ? `✅ ${candidate.cvText.substring(0, 50)}...` : "❌ Missing",
      cvFileName: candidate.cvFileName || "❌ Missing",
      cv: candidate.cv ? `✅ Present` : "❌ Missing",
      allKeys: Object.keys(candidate),
    });
  }, [candidate]);

  const getRating = (candidate: any) => {
    let score = 0;
    if (candidate.fullName) score += 20;
    if (candidate.email) score += 20;
    if (candidate.phone) score += 20;
    if (candidate.location) score += 20;
    if (candidate.cvText || candidate.cv) score += 20; // cvText нэмсэн
    return score;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current) {
      setIsDragging(true);
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      setPosition({
        top: Math.max(0, e.clientY - dragOffset.y),
        right: Math.max(0, window.innerWidth - (e.clientX + dragOffset.x)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const rating = getRating(candidate);
  const hasCV = !!(candidate.cvText || candidate.cv);

  return (
    <>
      <div
        ref={panelRef}
        className="fixed bg-[#0d1117] border border-[#1e2535] rounded-2xl w-[320px] shadow-2xl z-40 pointer-events-auto"
        style={{
          top: `${position.top}px`,
          right: `${position.right}px`,
          cursor: isDragging ? "grabbing" : "default",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[#1e2535] bg-white/[0.02] cursor-grab active:cursor-grabbing rounded-t-2xl"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-white/40" />
            <p className="text-[10px] font-black text-white/40 uppercase">Profile</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white hover:bg-white/10 p-1 rounded transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-[#4F67FF]/20 rounded-full flex items-center justify-center text-lg font-black text-[#4F67FF] mb-2">
              {(candidate.fullName?.[0] || candidate.email[0]).toUpperCase()}
            </div>
            <p className="text-sm font-bold text-white">{candidate.fullName || "Unknown"}</p>
            <div className="flex items-center gap-0.5 mt-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={11} className={i < Math.round(rating / 20) ? "fill-[#F59E0B] text-[#F59E0B]" : "text-white/10"} />
              ))}
            </div>
            <p className="text-[9px] text-white/40 mt-1">{rating}% Profile Complete</p>
          </div>

          <div className="h-px bg-white/5" />

          {/* Contact Info */}
          <div className="space-y-3">
            {candidate.email && (
              <div className="flex items-start gap-3">
                <Mail size={13} className="text-[#4F67FF] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[8px] font-semibold text-white/40 uppercase">Email</p>
                  <p className="text-[10px] text-white break-all">{candidate.email}</p>
                </div>
              </div>
            )}
            {candidate.phone && (
              <div className="flex items-start gap-3">
                <Phone size={13} className="text-[#10B981] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[8px] font-semibold text-white/40 uppercase">Phone</p>
                  <p className="text-[10px] text-white">{candidate.phone}</p>
                </div>
              </div>
            )}
            {candidate.location && (
              <div className="flex items-start gap-3">
                <MapPin size={13} className="text-[#F59E0B] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[8px] font-semibold text-white/40 uppercase">Location</p>
                  <p className="text-[10px] text-white">{candidate.location}</p>
                </div>
              </div>
            )}
            {candidate.appliedFor && (
              <div className="flex items-start gap-3">
                <Briefcase size={13} className="text-[#A855F7] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[8px] font-semibold text-white/40 uppercase">Applied For</p>
                  <p className="text-[10px] text-white truncate">{candidate.appliedFor}</p>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-white/5" />

          {/* Quick Actions */}
          <div className="space-y-2">
            {hasCV ? (
              <button
                onClick={() => {
                  console.log(" Opening CV modal with:", { cvText: !!candidate.cvText, cvFileName: candidate.cvFileName });
                  setShowCV(true);
                }}
                className="w-full px-3 py-2 bg-[#4F67FF]/10 border border-[#4F67FF]/30 text-[#4F67FF] text-[9px] font-bold rounded-lg hover:bg-[#4F67FF]/20 transition-all uppercase flex items-center justify-center gap-1"
              >
                <FileText size={11} /> View CV
              </button>
            ) : (
              <div className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white/30 text-[9px] font-bold rounded-lg uppercase text-center" title="Кандидат CV-г өөрийн профилд ачаалаагүй байна">
                CV байхгүй байна
              </div>
            )}
            <button className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-[9px] font-bold rounded-lg hover:bg-white/10 transition-all uppercase">
              See Applications
            </button>
          </div>
        </div>
      </div>

      {/* CV Preview Modal */}
      {showCV && (
        <CVPreviewModal
          cvData={candidate.cvText || candidate.cv || ""}
          cvFileName={candidate.cvFileName}
          candidateName={candidate.fullName || candidate.email || "Unknown"}
          onClose={() => {
            console.log(" Closing CV modal");
            setShowCV(false);
          }}
        />
      )}
    </>
  );
}