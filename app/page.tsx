"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Briefcase, TrendingUp, Users, ArrowRight, Loader2 } from "lucide-react";
import axios from "axios";

export default function LandingPage() {
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:5001/api/ai/market-insights");
        setInsights(res.data.insights);
      } catch (error) {
        setInsights("Одоогоор зах зээлийн мэдээлэл боловсруулж байна...");
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  return (
    <div className="min-h-screen bg-[#080D1D] text-white">
      {/* Header */}
      <nav className="flex items-center justify-between p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4F67FF] rounded-xl flex items-center justify-center font-black text-xl">H</div>
          <span className="text-2xl font-bold tracking-tighter">JobHub</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="px-6 py-3 rounded-2xl font-bold text-sm hover:bg-white/5 transition-all">Нэвтрэх</Link>
          <Link href="/register" className="bg-[#4F67FF] px-8 py-3 rounded-2xl font-bold text-sm hover:bg-[#3d52cc] transition-all">Бүртгүүлэх</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-8 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-[#4F67FF]/10 text-[#4F67FF] px-4 py-2 rounded-full text-xs font-bold mb-8 animate-bounce">
          <Sparkles size={14} /> AI-д суурилсан ирээдүйн ажлын талбар
        </div>
        <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter leading-[0.9]">
          АЖИЛ ХАЙХ <br /> <span className="text-[#4F67FF]">ШИНЭ ТҮВШИН.</span>
        </h1>
        <p className="text-[#6b7280] text-lg max-w-2xl mx-auto mb-12">
          AI таны CV-г засаж, тохирох ажлыг олж, сурах төлөвлөгөө гаргаж өгнө. <br /> Хөдөлмөрийн зах зээлийг ухаалгаар удирд.
        </p>

        {/* AI Market Insights Card */}
        <div className="max-w-3xl mx-auto bg-[#111827] p-8 rounded-[48px] border border-white/5 relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-[#4F67FF]/10 to-[#8062FF]/10 rounded-[48px] blur-3xl group-hover:opacity-100 opacity-0 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-3 mb-6">
              <TrendingUp className="text-[#10B981]" />
              <h3 className="font-bold text-sm uppercase tracking-widest text-[#6b7280]">Зах зээлийн AI тойм</h3>
            </div>
            {loading ? (
              <Loader2 className="animate-spin mx-auto text-[#4F67FF]" />
            ) : (
              <p className="text-xl font-medium leading-relaxed italic text-white/90">
                "{insights}"
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-8 py-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard 
          icon={<Briefcase size={24} />} 
          title="Ухаалаг Хайлт" 
          desc="AI таны туршлагад 99% тохирох ажлыг автоматаар шүүж харуулна."
        />
        <FeatureCard 
          icon={<Sparkles size={24} />} 
          title="CV Optimizer" 
          desc="Зүгээр л текст бич. AI түүнийг мэргэжлийн PDF CV болгож өгнө."
        />
        
        <FeatureCard 
          icon={<Users size={24} />} 
          title="Шууд Холболт" 
          desc="Ажил олгогчтой шууд чатлаж, AI-аар үнэлүүлсэн оноогоо харуул."
        />
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="bg-[#111827] p-10 rounded-[40px] border border-white/5 hover:border-[#4F67FF]/30 transition-all group">
      <div className="w-14 h-14 bg-[#4F67FF]/10 rounded-2xl flex items-center justify-center text-[#4F67FF] mb-6 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <p className="text-[#6b7280] text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
