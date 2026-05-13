"use client";

import React, { useEffect, useState } from "react";
import {
  Briefcase,
  Zap,
  MapPin,
  TrendingUp,
  Loader,
} from "lucide-react";
import axios from "axios";
import { API_URLS } from "@/lib/apiConfig";

interface RecommendedJob {
  id: number;
  title: string;
  location?: string;
  salary?: string;
  matchScore: number;
  matchReason?: string;
  employer?: {
    fullName?: string;
  };
}

export default function JobRecommendations({
  userId,
  onSelectJob,
}: {
  userId: number;
  onSelectJob: (job: any) => void;
}) {
  const [recommendations, setRecommendations] = useState<RecommendedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post(
          API_URLS.jobs.recommendationsForCandidate(),
          { candidateId: userId },
          { timeout: 30000 }
        );

        if (response.data?.recommendations) {
          setRecommendations(response.data.recommendations.slice(0, 5));
        }
      } catch (err: any) {
        console.error("Failed to fetch recommendations:", err);
        setError("Сайтал илүүлэхэд алдаа гарлаа");
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchRecommendations();
    }
  }, [userId]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-600/20 text-green-400";
    if (score >= 60) return "bg-yellow-600/20 text-yellow-400";
    return "bg-orange-600/20 text-orange-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Маш сайн";
    if (score >= 60) return "Сайн";
    return "Эсүүлэх";
  };

  if (loading) {
    return (
      <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6">
        <div className="flex items-center justify-center gap-2 text-white/40">
          <Loader size={16} className="animate-spin" />
          <span className="text-sm">Сайтал хайж байна...</span>
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return (
      <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6 text-center">
        <Briefcase size={32} className="mx-auto text-white/20 mb-3" />
        <p className="text-sm text-white/40">
          {error || "CV хадгалсан ажил олох боломжгүй байна"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-black text-white flex items-center gap-2">
            <Zap size={20} className="text-yellow-400" />
            Танд сайтал ажлууд
          </h2>
          <p className="text-[12px] text-white/35 mt-1">
            Таны CV-г суч {recommendations.length} ажил олдлоо
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        {recommendations.map((job) => (
          <div
            key={job.id}
            onClick={() => onSelectJob(job)}
            className="bg-gradient-to-br from-[#1a2540] to-[#111827] border border-white/[0.08] hover:border-blue-600/40 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-600/20 group"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-all truncate">
                  {job.title}
                </h3>
                <p className="text-xs text-white/40 mt-1">
                  {job.employer?.fullName || "Компани"}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${getScoreColor(job.matchScore)}`}>
                {job.matchScore}%
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {job.location && (
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <MapPin size={12} />
                  <span>{job.location}</span>
                </div>
              )}
              {job.salary && (
                <div className="flex items-center gap-2 text-xs text-green-400/70">
                  <TrendingUp size={12} />
                  <span>{job.salary}</span>
                </div>
              )}
            </div>

            {job.matchReason && (
              <p className="text-xs text-white/60 bg-white/[0.02] rounded-lg p-2">
                {job.matchReason}
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-white/[0.05]">
              <p className="text-xs text-blue-400 font-semibold">
                ➔ Дэлгэрэнгүй үзэх
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
