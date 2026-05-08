"use client";

import React from "react";
import { Calendar, Clock, User, MapPin, Plus } from "lucide-react";

export default function InterviewsView() {
  // Placeholder data - in a real app, this would come from the backend
  const interviews: any[] = [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-black text-white">Ярилцлага</h2>
          <p className="text-[12px] text-white/35 mt-1">
            Хүлээлтийн болон явагдсан ярилцлага
          </p>
        </div>
        <button className="flex items-center gap-2 bg-[#4F67FF] hover:bg-[#3d52e0] text-white font-black text-[11px] px-4 py-2 rounded-lg transition-all">
          <Plus size={13} /> Үйл явдал нэмэх
        </button>
      </div>

      {/* Empty State */}
      <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-12 text-center">
        <Calendar size={32} className="mx-auto text-white/20 mb-4" />
        <h3 className="text-[12px] font-black text-white/40 mb-2">
          Ярилцлага байхгүй
        </h3>
        <p className="text-[11px] text-white/30 max-w-xs mx-auto">
          Кандидатуудын хамт ярилцлагын цаг сүүлээгээр аажаа энд гарч ирнэ
        </p>
      </div>

      {/* Example Interview Card (commented out) */}
      <div className="hidden">
        <div className="bg-[#111827] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.12] transition-all">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 bg-[#4F67FF]/20 rounded-xl flex items-center justify-center text-sm font-black text-[#4F67FF] shrink-0">
                MB
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-white">Батаа Монх</p>
                <div className="flex items-center gap-3 text-[10px] text-white/50 mt-2">
                  <Clock size={11} />
                  <span>2024-05-15 14:00</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/50 mt-1">
                  <MapPin size={11} />
                  <span>Zoom встреча</span>
                </div>
              </div>
            </div>
            <div className="bg-[#10B981]/12 text-[#10B981] px-2.5 py-1 rounded-lg text-[8px] font-black uppercase whitespace-nowrap">
              Хүлээлтэд
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
