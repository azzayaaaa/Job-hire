"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Zap,
  Star,
  Loader,
  Mail,
} from "lucide-react";
import axios from "axios";
import { API_URLS } from "@/lib/apiConfig";

interface RecommendedCandidate {
  id: number;
  fullName: string;
  email: string;
  matchScore: number;
  strengths?: string[];
  feedback?: string;
}

export default function CandidateRecommendations({
  jobId,
  jobTitle,
  jobDescription,
  onSelectCandidate,
}: {
  jobId: number;
  jobTitle: string;
  jobDescription?: string;
  onSelectCandidate: (candidate: any) => void;
}) {
  const [recommendations, setRecommendations] = useState<RecommendedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post(
          API_URLS.jobs.recommendationsCandidatesForJob(),
          { jobId },
          { timeout: 10000 }
        );

        if (response.data?.recommendations) {
          setRecommendations(response.data.recommendations.slice(0, 10));
        }
      } catch (err: any) {
        console.error("Failed to fetch candidate recommendations:", err);
        setError("Кандидатуудын сайталыг илүүлэхэд алдаа гарлаа");
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchRecommendations();
    }
  }, [jobId]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-600/20 text-green-400";
    if (score >= 60) return "bg-yellow-600/20 text-yellow-400";
    return "bg-orange-600/20 text-orange-400";
  };

  if (loading) {
    return (
      <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6">
        <div className="flex items-center justify-center gap-2 text-white/40">
          <Loader size={16} className="animate-spin" />
          <span className="text-sm">Кандидатуудыг хайж байна...</span>
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return (
      <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6 text-center">
        <Users size={32} className="mx-auto text-white/20 mb-3" />
        <p className="text-sm text-white/40">
          {error || "Энэ ажилд сайтал кандидат олдоогүй байна"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-black text-white flex items-center gap-2">
            <Zap size={18} className="text-yellow-400" />
            Сайтал кандидатууд ({recommendations.length})
          </h3>
          <p className="text-[11px] text-white/35 mt-1">
            "{jobTitle}"-д үйлдэлгүй холбоотой
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {recommendations.map((candidate) => (
          <div
            key={candidate.id}
            onClick={() => onSelectCandidate(candidate)}
            className="bg-gradient-to-br from-[#1a2540] to-[#111827] border border-white/[0.08] hover:border-green-600/40 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-green-600/20 group"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-white group-hover:text-green-400 transition-all truncate">
                  {candidate.fullName}
                </h4>
                <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
                  <Mail size={12} />
                  <a
                    href={`mailto:${candidate.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-white transition-all truncate"
                  >
                    {candidate.email}
                  </a>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1 ${getScoreColor(candidate.matchScore)}`}>
                <Star size={12} fill="currentColor" />
                {candidate.matchScore}%
              </div>
            </div>

            {candidate.strengths && candidate.strengths.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-white/50 mb-1">Давуу талууд:</p>
                <div className="flex flex-wrap gap-1">
                  {candidate.strengths.slice(0, 2).map((strength, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-green-600/15 text-green-400 px-2 py-1 rounded"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {candidate.feedback && (
              <p className="text-xs text-white/60 bg-white/[0.02] rounded-lg p-2">
                {candidate.feedback}
              </p>
            )}

            <div className="mt-2 pt-2 border-t border-white/[0.05]">
              <p className="text-xs text-green-400 font-semibold">
                ➔ Кандидатыг үзэх
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
