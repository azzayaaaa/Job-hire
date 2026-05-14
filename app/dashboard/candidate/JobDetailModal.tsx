"use client";

import { useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import axios from "axios";
import { API_URLS } from "@/lib/apiConfig";
import { useAlert } from "@/components/AlertProvider";

type CVFileType = "pdf" | "image" | "text" | null;

type EmployerInfo = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  logo?: string | null;
};

type JobDetail = {
  id: number;
  title?: string | null;
  company?: string | null;
  employer?: EmployerInfo | null;
  employerId?: number | null;
  location?: string | null;
  type?: string | null;
  experience?: string | null;
  salary?: string | null;
  description?: string | null;
  jobImage?: string | null;
  employerLogo?: string | null;
};

type MatchAnalysis = {
  matchScore?: number;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  recommendation?: string;
};

const ALLOWED_CV_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const ALLOWED_CV_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const CV_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const CV_FILE_TYPE_MESSAGE = "Зөвхөн PDF, JPG, JPEG, PNG, WEBP файл оруулж болно.";

const isAllowedCVFile = (file: File) => {
  const fileName = file.name.toLowerCase();
  return ALLOWED_CV_TYPES.has(file.type) || ALLOWED_CV_EXTENSIONS.some((ext) => fileName.endsWith(ext));
};

const inferFileType = (name?: string, data?: string): CVFileType => {
  const lowerName = name?.toLowerCase() || "";
  if (lowerName.endsWith(".pdf") || data?.startsWith("data:application/pdf")) return "pdf";
  if (data?.startsWith("data:image/")) return "image";
  if (lowerName.endsWith(".txt")) return "text";
  return null;
};

const loadSavedCV = (userId: number) => {
  if (typeof window === "undefined") {
    return { name: "", data: "", fileType: null as CVFileType, exists: false };
  }

  const saved = window.localStorage.getItem(`userCV_${userId}`);
  if (!saved) {
    return { name: "", data: "", fileType: null as CVFileType, exists: false };
  }

  try {
    const parsed = JSON.parse(saved) as { name?: string; data?: string };
    if (!parsed.name || !parsed.data) {
      return { name: "", data: "", fileType: null as CVFileType, exists: false };
    }

    return {
      name: parsed.name,
      data: parsed.data,
      fileType: inferFileType(parsed.name, parsed.data),
      exists: true,
    };
  } catch {
    return { name: "", data: "", fileType: null as CVFileType, exists: false };
  }
};

const formatSalaryText = (value?: string | null) => {
  if (!value) return "";
  const numeric = value.replace(/[^\d]/g, "");
  if (!numeric) return value;
  const formatted = numeric.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const suffix = value.replace(/[\d\s,.'₮ төгрөг]+/gi, "").trim();
  return `${formatted}₮${suffix ? ` ${suffix}` : ""}`;
};

const loadEmployerLogo = (employerId?: number | null) => {
  if (typeof window === "undefined" || !employerId) return "";
  try {
    return JSON.parse(localStorage.getItem(`employerProfile_${employerId}`) || "{}")?.logo || "";
  } catch {
    return "";
  }
};

export default function JobDetailModal({
  job,
  onClose,
  onApply,
  userId,
}: {
  job: JobDetail;
  onClose: () => void;
  onApply: (jobId: number, cvData?: string, cvName?: string) => void | Promise<void>;
  userId: number;
}) {
  const storageKey = `userCV_${userId}`;
  const [initialCV] = useState(() => loadSavedCV(userId));
  const [cvName, setCvName] = useState(initialCV.name);
  const [cvData, setCvData] = useState(initialCV.data);
  const [fileType, setFileType] = useState<CVFileType>(initialCV.fileType);
  const [savedCVExists, setSavedCVExists] = useState(initialCV.exists);
  const [usingSavedCV, setUsingSavedCV] = useState(initialCV.exists);
  const [isReplacingCV, setIsReplacingCV] = useState(false);

  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [showAiResult, setShowAiResult] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [userInfo, setUserInfo] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const [applying, setApplying] = useState(false);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);

  const { showAlert } = useAlert();

  const jobImage =
    job.jobImage ||
    (typeof window !== "undefined" ? localStorage.getItem(`jobImage_${job.id}`) : "") ||
    "";
  const employerLogo =
    job.employerLogo ||
    job.employer?.logo ||
    loadEmployerLogo(job.employerId) ||
    "";

  const calculateMatchScore = async (cvText: string) => {
    if (!cvText) return;
    setMatchLoading(true);
    try {
      const response = await axios.post(API_URLS.ai.matchCvToJob(), {
        cv: cvText,
        jobTitle: job.title,
        jobDescription: job.description,
        jobRequirements: job.description,
      });
      const analysis = response.data?.analysis || {};
      const score = Number(response.data?.matchScore ?? analysis.matchScore ?? 0);
      setMatchScore(Number.isFinite(score) ? score : 0);
      setMatchAnalysis(analysis);
      setAiAnalysis(analysis.summary || analysis.recommendation || "AI тохирлын дүн гарлаа.");
      setShowAiResult(true);
    } catch (error) {
      console.error("Failed to calculate match score:", error);
      showAlert("AI тохирол тооцоолоход алдаа гарлаа", "error");
    } finally {
      setMatchLoading(false);
    }
  };

  const resetAiMatch = () => {
    setMatchScore(null);
    setMatchAnalysis(null);
    setAiAnalysis("");
    setShowAiResult(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = isAllowedCVFile(file) && !isPDF;

    if (!isAllowedCVFile(file)) {
      showAlert(CV_FILE_TYPE_MESSAGE, "warning");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setCvName(file.name);
      setCvData(data);
      setFileType(isPDF ? "pdf" : "image");
      setUsingSavedCV(false);
      setIsReplacingCV(false);
      resetAiMatch();
    };
    reader.readAsDataURL(file);
  };

  const handleUseSavedCV = () => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;

    const parsed = JSON.parse(saved) as { name: string; data: string };
    setCvName(parsed.name);
    setCvData(parsed.data);
    setFileType(inferFileType(parsed.name, parsed.data));
    setUsingSavedCV(true);
    setIsReplacingCV(false);
    resetAiMatch();
  };

  const handleSaveCV = () => {
    if (!cvData) return;
    localStorage.setItem(storageKey, JSON.stringify({ name: cvName, data: cvData }));
    setSavedCVExists(true);
    setUsingSavedCV(true);
    setIsReplacingCV(false);
    showAlert("CV хадгалагдлаа!", "success");
  };

  const processWithAI = async () => {
    if (!cvData || aiProcessing) return;

    setAiProcessing(true);
    try {
      await calculateMatchScore(cvData);
    } catch {
      showAlert("AI тохирол тооцоолоход алдаа гарлаа", "error");
    } finally {
      setAiProcessing(false);
    }
  };

  const handleGenerateCV = async () => {
    if (!userInfo.trim()) {
      showAlert("CV үүсгэх мэдээллээ оруулна уу", "warning");
      return;
    }

    setAiGenerating(true);
    try {
      const response = await fetch(API_URLS.ai.generateCv(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInfo,
          jobTitle: job.title,
          jobDescription: job.description,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      const generated = data.htmlContent || data.cv || data.cvText || "";
      if (!generated) throw new Error("Empty generated CV");

      setCvName("AI-Generated CV.txt");
      setCvData(generated);
      setFileType("text");
      setUsingSavedCV(false);
      setIsReplacingCV(false);
      setShowAIGenerator(false);
      resetAiMatch();
    } catch {
      showAlert("AI-аар CV үүсгэхэд алдаа гарлаа", "error");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyWithCV = async () => {
    if (!cvData) {
      showAlert("CV оруулна уу", "warning");
      return;
    }

    setApplying(true);
    try {
      const currentCV = JSON.stringify({ name: cvName, data: cvData });
      if (localStorage.getItem(storageKey) !== currentCV) {
        localStorage.setItem(storageKey, currentCV);
      }

      await onApply(job.id, cvData, cvName);
    } finally {
      setApplying(false);
    }
  };

  const handleAutoApply = async () => {
    if (!initialCV.data) {
      showAlert("CV хадгалаагүй байна. Эхлээд CV нэмнэ үү.", "warning");
      return;
    }

    setAutoApplying(true);
    try {
      const response = await axios.post(API_URLS.jobs.applyWithAutoCv(), {
        jobId: job.id,
        candidateId: userId,
      });

      if (response.status === 201) {
        showAlert("Өргөдөл амжилттай илгээгдлээ!", "success");
        onClose();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Өргөдөл илгээхэд алдаа гарлаа";
      showAlert(errorMsg, "error");
    } finally {
      setAutoApplying(false);
    }
  };

  const getMatchScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-orange-400";
  };

  const getMatchScoreLabel = (score: number | null) => {
    if (score === null) return "Тооцоолж байна...";
    if (score >= 80) return "Маш сайн тохирол";
    if (score >= 60) return "Сайн тохирол";
    return "Эсүүлэх тохирол";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-24px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#1e2535] bg-[#0d1117]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#1e2535] bg-[#0d1117] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold text-white">{job.title}</p>
            <p className="truncate text-sm text-gray-500">{job.company || job.employer?.fullName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {savedCVExists && matchScore !== null && (
            <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-600/30 rounded-2xl p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getMatchScoreColor(matchScore).replace("text", "bg").replace("400", "400/20")}`}>
                    <Zap size={20} className={getMatchScoreColor(matchScore)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-400">CV ТОХИРЛЫН ОНОО</p>
                    <p className={`text-lg font-bold ${getMatchScoreColor(matchScore)}`}>{matchScore}%</p>
                    <p className="text-xs text-gray-400">{getMatchScoreLabel(matchScore)}</p>
                  </div>
                </div>
                <button
                  onClick={handleAutoApply}
                  disabled={autoApplying}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  <Zap size={14} />
                  {autoApplying ? "Явуулж..." : "Авто өргөдөл"}
                </button>
              </div>
            </div>
          )}

          {jobImage && (
            <div className="overflow-hidden rounded-2xl border border-[#1e2535] bg-[#111827]">
              <img src={jobImage} alt={job.title || "job"} className="h-40 w-full object-cover sm:h-52" />
            </div>
          )}

          <section>
            <h3 className="text-sm font-semibold text-white mb-3">Ажлын дэлгэрэнгүй</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[#3b5bdb]" />
                <span>{job.location || "Улаанбаатар"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#3b5bdb]" />
                <span>{job.type || "Бүтэн цагийн"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[#3b5bdb]" />
                <span>{job.experience || "2-5 жил"}</span>
              </div>
              {job.salary && (
                <div className="flex items-center gap-2">
                  <span className="text-[#2f9e44]">Цалин:</span>
                  <span className="text-[#2f9e44] font-semibold">{formatSalaryText(job.salary)}</span>
                </div>
              )}
            </div>
            {job.description && <p className="text-sm text-gray-400 mt-4">{job.description}</p>}
          </section>

          {job.employer && (
            <section className="border-t border-[#1e2535] pt-6">
              <h3 className="text-sm font-semibold text-white mb-4">Ажил олгогчийн мэдээлэл</h3>
              <div className="bg-[#1a2035] border border-[#1e2535] rounded-2xl p-4 space-y-3">
                {employerLogo && (
                  <div className="flex items-center gap-3 rounded-xl bg-[#0d1117] p-3">
                    <img src={employerLogo} alt={job.employer.fullName || "company"} className="h-12 w-12 rounded-xl object-cover" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Компанийн зураг</p>
                      <p className="text-sm font-semibold text-white">{job.employer.fullName || job.company || "Компани"}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Building2 size={18} className="text-[#4c6ef5] mt-1 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Компани</p>
                    <p className="text-sm font-semibold text-white">{job.employer.fullName || "Компани нэр"}</p>
                  </div>
                </div>
                {job.employer.email && (
                  <div className="flex items-start gap-3">
                    <Mail size={18} className="text-[#4c6ef5] mt-1 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">И-мэйл</p>
                      <a href={`mailto:${job.employer.email}`} className="text-sm text-[#4c6ef5] hover:text-[#3b5bdb] transition-all">
                        {job.employer.email}
                      </a>
                    </div>
                  </div>
                )}
                {job.employer.phone && (
                  <div className="flex items-start gap-3">
                    <Phone size={18} className="text-[#4c6ef5] mt-1 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Утас</p>
                      <a href={`tel:${job.employer.phone}`} className="text-sm text-[#4c6ef5] hover:text-[#3b5bdb] transition-all">
                        {job.employer.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="border-t border-[#1e2535] pt-6">
            <h3 className="text-sm font-semibold text-white mb-4">CV оруулах</h3>

            {cvData && !isReplacingCV ? (
              <div className="space-y-4">
                <div className="bg-[#1a2035] border border-[#1e2535] rounded-2xl p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-green-500/15 rounded-lg flex items-center justify-center shrink-0">
                        <FileText size={20} className="text-green-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{cvName}</p>
                        <p className={usingSavedCV ? "text-xs text-green-400" : "text-xs text-gray-500"}>
                          {usingSavedCV ? "✓ Хадгалагдсан CV" : "Шинээр сонгосон CV"}
                          {fileType && ` • ${fileType === "pdf" ? "PDF" : fileType === "image" ? "Зураг" : "Text"}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-start">
                      <CheckCircle2 size={20} className="text-green-500" />
                      <button
                        onClick={() => setIsReplacingCV(true)}
                        className="text-xs font-semibold text-[#4c6ef5] hover:text-[#7c93ff] transition-all"
                      >
                        CV солих
                      </button>
                    </div>
                  </div>
                </div>

                {!showAiResult && (
                  <button
                    onClick={processWithAI}
                    disabled={aiProcessing || matchLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1a2035] border border-[#1e2535] text-[#4c6ef5] text-sm font-semibold rounded-xl hover:border-[#3b5bdb]/50 transition-all disabled:opacity-40"
                  >
                    <Sparkles size={16} />
                    {aiProcessing || matchLoading ? "AI тооцоолж байна..." : "AI-аар тохирол тооцоолуулах"}
                  </button>
                )}

                {showAiResult && aiAnalysis && (
                  <div className="bg-[#1a2035] border border-[#3b5bdb]/30 rounded-2xl p-4 space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#4c6ef5] mb-2 flex items-center gap-2">
                          <Sparkles size={14} /> AI тохирлын дүн
                        </p>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
                      </div>
                      {matchScore !== null && (
                        <div className="shrink-0 text-left sm:text-right">
                          <div className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-black ${getMatchScoreColor(matchScore).replace("text", "bg").replace("400", "400/20")} ${getMatchScoreColor(matchScore)}`}>
                            <Zap size={14} />
                            {matchScore}%
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500">{getMatchScoreLabel(matchScore)}</p>
                        </div>
                      )}
                    </div>

                    {!!matchAnalysis?.strengths?.length && (
                      <div>
                        <p className="text-xs font-semibold text-green-400 mb-2">Таны давуу ур чадвар</p>
                        <ul className="space-y-1 text-sm text-gray-300">
                          {matchAnalysis.strengths.map((item, index) => (
                            <li key={`strength-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!!matchAnalysis?.gaps?.length && (
                      <div>
                        <p className="text-xs font-semibold text-orange-400 mb-2">Дутуу байж болох зүйл</p>
                        <ul className="space-y-1 text-sm text-gray-300">
                          {matchAnalysis.gaps.map((item, index) => (
                            <li key={`gap-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {matchAnalysis?.recommendation && (
                      <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-gray-300 leading-relaxed">
                        {matchAnalysis.recommendation}
                      </p>
                    )}

                    <button
                      onClick={processWithAI}
                      disabled={aiProcessing || matchLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0d1117] border border-[#1e2535] text-[#4c6ef5] text-xs font-semibold rounded-xl hover:border-[#3b5bdb]/50 transition-all disabled:opacity-40"
                    >
                      <Sparkles size={14} />
                      Дахин тооцоолуулах
                    </button>
                  </div>
                )}

                {!usingSavedCV && (
                  <button
                    onClick={handleSaveCV}
                    className="w-full py-3 bg-[#2a3550] text-white text-sm font-semibold rounded-xl hover:bg-[#3a4560] transition-all"
                  >
                    CV-г хадгалах
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {savedCVExists && (
                  <button
                    onClick={handleUseSavedCV}
                    className="w-full py-3 bg-green-600/10 text-green-400 text-sm font-semibold rounded-xl hover:bg-green-600/20 transition-all"
                  >
                    Хадгалагдсан CV ашиглах
                  </button>
                )}

                {!showAIGenerator ? (
                  <>
                    <div
                      onClick={() => document.getElementById("jobDetailCvInput")?.click()}
                      className="group cursor-pointer rounded-2xl border-2 border-dashed border-[#1e2535] p-6 text-center transition-all hover:border-[#3b5bdb]/50 sm:p-10"
                    >
                      <FileText size={36} className="text-[#4c6ef5] mx-auto mb-3 group-hover:scale-110 transition-transform" />
                      <p className="text-sm text-white font-medium mb-1">PDF файл эсвэл зураг сонгоно уу</p>
                      <p className="text-xs text-gray-500">PDF, JPG, JPEG, PNG, WEBP дэмжинэ</p>
                    </div>
                    <input
                      id="jobDetailCvInput"
                      type="file"
                      accept={CV_ACCEPT}
                      className="hidden"
                      onChange={handleFile}
                    />
                    <button
                      onClick={() => setShowAIGenerator(true)}
                      className="w-full py-3 bg-[#3b5bdb]/20 text-[#4c6ef5] text-sm font-semibold rounded-xl hover:bg-[#3b5bdb]/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles size={16} /> AI-аар CV үүсгүүлэх
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={userInfo}
                      onChange={(e) => setUserInfo(e.target.value)}
                      placeholder="Нэр, туршлага, ур чадвар, боловсрол зэрэг CV-д оруулах мэдээллээ бичнэ үү..."
                      className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#3b5bdb] transition-all resize-none h-32"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={handleGenerateCV}
                        disabled={aiGenerating || !userInfo.trim()}
                        className="flex-1 py-3 bg-[#3b5bdb] text-white text-sm font-semibold rounded-xl hover:bg-[#4c6ef5] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        <Sparkles size={14} /> {aiGenerating ? "Үүсгэж байна..." : "CV үүсгүүлэх"}
                      </button>
                      <button
                        onClick={() => setShowAIGenerator(false)}
                        className="px-4 py-3 border border-[#1e2535] text-gray-400 text-sm rounded-xl hover:text-white transition-all"
                      >
                        Буцах
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => (savedCVExists ? handleUseSavedCV() : onClose())}
                  className="w-full px-6 py-3 border border-[#1e2535] text-gray-400 text-sm rounded-xl hover:text-white transition-all"
                >
                  Цуцлах
                </button>
              </div>
            )}
          </section>

          <button
            onClick={handleApplyWithCV}
            disabled={!cvData || applying}
            className="w-full py-3 bg-[#3b5bdb] text-white text-sm font-semibold rounded-xl hover:bg-[#4c6ef5] transition-all disabled:opacity-40"
          >
            {applying ? "Өргөдөл илгээж байна..." : "Өргөдөл илгээх"}
          </button>
        </div>
      </div>
    </div>
  );
}
