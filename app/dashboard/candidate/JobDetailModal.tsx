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
} from "lucide-react";
import axios from "axios";

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
  const jobImage =
    job.jobImage ||
    (typeof window !== "undefined" ? localStorage.getItem(`jobImage_${job.id}`) : "") ||
    "";
  const employerLogo =
    job.employerLogo ||
    job.employer?.logo ||
    loadEmployerLogo(job.employerId) ||
    "";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPDF = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");

    if (!isPDF && !isImage) {
      alert("Зөвхөн PDF, JPG, PNG файл оруулна уу");
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
      setShowAiResult(false);
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
    setShowAiResult(false);
  };

  const handleSaveCV = () => {
    if (!cvData) return;
    localStorage.setItem(storageKey, JSON.stringify({ name: cvName, data: cvData }));
    setSavedCVExists(true);
    setUsingSavedCV(true);
    setIsReplacingCV(false);
    alert("CV хадгалагдлаа!");
  };

  const processWithAI = async () => {
    if (!cvData || aiProcessing) return;

    setAiProcessing(true);
    try {
      const res = await axios.post("http://localhost:5000/api/ai/analyze-cv", {
        cv: cvData,
        jobTitle: job.title,
        jobDescription: job.description,
      });
      setAiAnalysis(res.data.analysis || "AI дүн шинжилгээ гаргалаа");
      setShowAiResult(true);
    } catch {
      alert("AI дүн шинжилгээ хийхэд алдаа гарлаа");
    } finally {
      setAiProcessing(false);
    }
  };

  const handleGenerateCV = async () => {
    if (!userInfo.trim()) {
      alert("CV үүсгэх мэдээллээ оруулна уу");
      return;
    }

    setAiGenerating(true);
    try {
      const res = await axios.post("http://localhost:5000/api/ai/generate-cv", {
        userInfo,
        jobTitle: job.title,
        jobDescription: job.description,
      });
      const generated = res.data.cv || res.data.cvText || "";
      if (!generated) throw new Error("Empty generated CV");

      setCvName("AI-Generated CV.txt");
      setCvData(generated);
      setFileType("text");
      setUsingSavedCV(false);
      setIsReplacingCV(false);
      setShowAIGenerator(false);
    } catch {
      alert("AI-аар CV үүсгэхэд алдаа гарлаа");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyWithCV = async () => {
    if (!cvData) {
      alert("CV оруулна уу");
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-[#1e2535] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#1e2535] bg-[#0d1117]">
          <div>
            <p className="text-white font-semibold text-lg">{job.title}</p>
            <p className="text-sm text-gray-500">{job.company || job.employer?.fullName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {jobImage && (
            <div className="overflow-hidden rounded-2xl border border-[#1e2535] bg-[#111827]">
              <img src={jobImage} alt={job.title || "job"} className="h-52 w-full object-cover" />
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
                  <div className="flex items-center justify-between gap-4">
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
                    <div className="flex items-center gap-3 shrink-0">
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
                    disabled={aiProcessing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1a2035] border border-[#1e2535] text-[#4c6ef5] text-sm font-semibold rounded-xl hover:border-[#3b5bdb]/50 transition-all disabled:opacity-40"
                  >
                    <Sparkles size={16} />
                    {aiProcessing ? "AI-аар боловсруулж байна..." : "AI-аар дүн шинжилгээ хийх"}
                  </button>
                )}

                {showAiResult && aiAnalysis && (
                  <div className="bg-[#1a2035] border border-[#3b5bdb]/30 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-[#4c6ef5] mb-2 flex items-center gap-2">
                      <Sparkles size={14} /> AI дүн шинжилгээ
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
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
                      className="border-2 border-dashed border-[#1e2535] hover:border-[#3b5bdb]/50 rounded-2xl p-10 text-center cursor-pointer transition-all group"
                    >
                      <FileText size={36} className="text-[#4c6ef5] mx-auto mb-3 group-hover:scale-110 transition-transform" />
                      <p className="text-sm text-white font-medium mb-1">PDF файл эсвэл зураг сонгоно уу</p>
                      <p className="text-xs text-gray-500">PDF, JPG, PNG, JPEG дэмжинэ</p>
                    </div>
                    <input
                      id="jobDetailCvInput"
                      type="file"
                      accept=".pdf,image/*"
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
                    <div className="flex gap-2">
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
