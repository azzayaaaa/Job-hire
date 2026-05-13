"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

export default function HomeView({
  chartData,
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

    </div>
  );
}
