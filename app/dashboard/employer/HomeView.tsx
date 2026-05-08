"use client";

import React from "react";
import { Briefcase, Users, FileText, Eye, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

function StatCard({
  label,
  value,
  sub,
  subColor,
  color,
  bg,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  subColor: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-5 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${bg}15`, color: bg }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-white/30 truncate">
          {label}
        </p>
        <h4
          className="text-[26px] font-black leading-none mt-1"
          style={{ color }}
        >
          {value}
        </h4>
        <p className="text-[10px] font-semibold mt-1" style={{ color: subColor }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

export default function HomeView({
  jobs,
  applications,
  chartData,
  credits,
}: any) {
  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[14px] font-black text-white">
              Сүүлийн 7 өдрийн хандалт
            </h3>
            <p className="text-[10px] text-white/35 mt-1">
              Өргөдлүүдийн өдрийн хэрэгжүүлэлт
            </p>
          </div>
          <TrendingUp size={18} className="text-[#10B981]" />
        </div>

        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" />
              <YAxis stroke="rgba(255,255,255,0.2)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#fff" }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4F67FF"
                dot={{ fill: "#4F67FF", r: 4 }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-white/40 text-[12px]">
            Өргөдөл байхгүй
          </div>
        )}
      </div>

      {/* Credits Info */}
      {credits !== undefined && (
        <div className="bg-[#4F67FF]/10 border border-[#4F67FF]/30 rounded-2xl p-4">
          <p className="text-[12px] font-semibold text-white mb-1">
            💳 Үлдэгдэл кредит
          </p>
          <p className="text-[18px] font-black text-[#4F67FF]">{credits}</p>
          <p className="text-[9px] text-white/40 mt-1">
            Нийт {credits} кредит боломжтой
          </p>
        </div>
      )}
    </div>
  );
}
