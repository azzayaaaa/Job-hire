"use client";
import { useState, useEffect } from "react";
import { X, Sparkles, TrendingUp, BookOpen, Target, CheckCircle2, AlertCircle } from "lucide-react";
import axios from "axios";

export default function SelfImprovementModal({
  onClose,
  userId,
}: {
  onClose: () => void;
  userId: number;
}) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    fetchSkillAnalysis();
  }, [userId]);

  const fetchSkillAnalysis = async () => {
    setLoading(true);
    try {
      const storageKey = `userCV_${userId}`;
      const savedCV = localStorage.getItem(storageKey);
      if (!savedCV) {
        setError("CV олдоогүй. Эхлээд CV үүсгэнэ үү.");
        setLoading(false);
        return;
      }

      const cvData = JSON.parse(savedCV) as { name?: string; data?: unknown };

      if (!("data" in cvData) || cvData.data == null) {
        setError("CV data олдсонгүй. Дахин CV оруулна уу.");
        setLoading(false);
        return;
      }

      const cvValue = cvData.data;
      const cv =
        typeof cvValue === "string"
          ? cvValue
          : (() => {
              try {
                return JSON.stringify(cvValue);
              } catch {
                return String(cvValue);
              }
            })();

      const MAX_CV_CHARS_FRONTEND = 5000;
      const cvSafe =
        typeof cv === "string" && cv.length > MAX_CV_CHARS_FRONTEND
          ? `${cv.slice(0, MAX_CV_CHARS_FRONTEND)}\n...[TRUNCATED]...`
          : cv;

      const res = await axios.post("http://localhost:5004/api/ai/skill-gap-analysis", {
        cv: cvSafe,
        userId: userId,
      });

      if (res.data) {
        setAnalysis(res.data.analysis);
        setRecommendations(res.data.recommendations || []);
      }
    } catch (err: any) {
      console.error(err);

      const detailsRaw =
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        err?.message ||
        "";

      const details =
        typeof detailsRaw === "string" ? detailsRaw : JSON.stringify(detailsRaw);

      setError(
        details
          ? `Дүн шинжилгээ авахад алдаа гарлаа: ${details}`
          : "Дүн шинжилгээ авахад алдаа гарлаа. Дахин оролдоно уу."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-[#1e2535] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#1e2535] bg-[#0d1117]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3b5bdb]/20 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-[#4c6ef5]" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Өөрийгөө хөгжүүлэх</p>
              <p className="text-xs text-gray-500">AI дээр үндэслэсэн ур чадварын дүн шинжилгээ</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="space-y-3 text-center">
                <Sparkles size={32} className="text-[#4c6ef5] mx-auto animate-spin" />
                <p className="text-gray-400">Дүн шинжилгээ хийж байна...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-semibold text-red-400">Алдаа</p>
                <p className="text-sm text-red-300/80">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview */}
              {analysis && (
                <div className="bg-[#1a2035] border border-[#1e2535] rounded-2xl p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Sparkles size={18} className="text-[#4c6ef5] mt-1 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[#4c6ef5] uppercase tracking-wider">AI Дүн шинжилгээ</p>
                      <p className="text-sm text-gray-300 mt-1 leading-relaxed">{analysis}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Skill Gaps */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Target size={18} className="text-[#4c6ef5]" />
                  <h3 className="text-sm font-semibold text-white">Дутуу байгаа ур чадвар</h3>
                </div>
                <div className="space-y-3">
                  {recommendations.length > 0 ? (
                    recommendations.map((rec: any, idx: number) => (
                      <div key={idx} className="bg-[#1a2035] border border-[#1e2535] rounded-xl p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[#3b5bdb]/20 text-[#4c6ef5] text-xs flex items-center justify-center">
                                {idx + 1}
                              </span>
                              {rec.skill}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Зах зээлийн эрэлт: {rec.marketDemand}%</p>
                          </div>
                          <div className="text-right">
                            <div className="w-16 h-2 bg-[#0d1117] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#3b5bdb]"
                                style={{ width: `${rec.marketDemand}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">{rec.description}</p>
                      </div>
                    ))
                  ) : (
                    <div className="bg-[#1a2035] border border-[#1e2535] rounded-xl p-4 text-center py-8">
                      <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Бүх ур чадвар дэвшилтэд байна! 🎉</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Learning Recommendations */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen size={18} className="text-[#4c6ef5]" />
                  <h3 className="text-sm font-semibold text-white">Сурах чиглэл</h3>
                </div>
                <div className="bg-[#1a2035] border border-[#1e2535] rounded-2xl p-5 space-y-3">
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <span>Онлайн сургалтанд элсэх (Coursera, Udemy гэх мэт)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <span>Бодит төслүүдэд ажиллаж туршлага олж авах</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <span>Ур чадварыг шалгалт эсвэл портфолиогоор нотолгоо</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <span>GitHub болон LinkedIn-д дээрэнгийн төслүүг хуваалцах</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-[#1e2535] pt-6 flex gap-3">
                <button
                  onClick={fetchSkillAnalysis}
                  className="flex-1 px-4 py-3 bg-[#3b5bdb] text-white text-sm font-semibold rounded-xl hover:bg-[#4c6ef5] transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} /> Дахин үнэлүүлэх
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-[#1e2535] text-gray-400 text-sm font-semibold rounded-xl hover:text-white transition-all"
                >
                  Хаах
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
