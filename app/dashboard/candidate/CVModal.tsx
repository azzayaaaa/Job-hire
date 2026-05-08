"use client";
import { useState } from "react";
import { X, FileText, Sparkles } from "lucide-react";
import axios from "axios";
import { authenticatedPatch } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";

const loadSavedCV = (userId: number) => {
  if (typeof window === "undefined") return { name: "", data: "" };

  const saved = window.localStorage.getItem(`userCV_${userId}`);
  if (!saved) return { name: "", data: "" };

  try {
    const parsed = JSON.parse(saved) as { name?: string; data?: string };
    return {
      name: parsed.name || "",
      data: parsed.data || "",
    };
  } catch {
    return { name: "", data: "" };
  }
};

export default function CVModal({
  onClose,
  userId,
}: {
  onClose: () => void;
  userId: number;
}) {
  const [initialCV] = useState(() => loadSavedCV(userId));
  const [cvName, setCvName] = useState(initialCV.name);
  const [cvData, setCvData] = useState(initialCV.data);
  const [userInfo, setUserInfo] = useState("");
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedCV, setGeneratedCV] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCvName(file.name);
      setCvData(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateCV = async () => {
    if (!userInfo.trim()) {
      alert("Өөрийнхөө мэдээллийг оруулна уу");
      return;
    }

    setAiGenerating(true);
    try {
      const res = await axios.post("http://localhost:5004/api/ai/generate-cv", {
        userInfo: userInfo,
        fileType: null,
      });

      setGeneratedCV(res.data.cv);
      setCvName("AI-Generated CV.txt");
      setCvData(res.data.cv);
    } catch (error) {
      console.error(error);
      alert("CV үүсгэхэд алдаа гарлаа");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!cvData) {
      alert("CV файл эсвэл AI үүсгүүлсэн CV оруулна уу");
      return;
    }
    
    console.log("💾 CVModal: Saving CV...", {
      userId,
      cvFileName: cvName,
      cvDataLength: cvData.length,
      cvDataPreview: cvData.substring(0, 100),
    });
    
    setIsSaving(true);
    try {
      const storageKey = `userCV_${userId}`;
      // Save to localStorage first (for offline support)
      localStorage.setItem(storageKey, JSON.stringify({ name: cvName, data: cvData }));
      
      console.log("📱 CVModal: Saved to localStorage, now sending to backend...");
      
      // Send CV to user-service directly with both cvText and cvFileName
      const response = await authenticatedPatch(API_URLS.user.profile(userId), {
        cvText: cvData,
        cvFileName: cvName,
      });
      
      console.log("✅ CVModal: CV saved to backend successfully:", {
        userId,
        cvFileName: response.data?.cvFileName,
        hasCVText: !!response.data?.cvText,
      });
      
      alert("CV хадгалагдлаа!");
      onClose();
    } catch (error) {
      console.error("❌ CVModal: CV save error:", error);
      alert("CV хадгалахад алдаа. Дахин оролдоно уу.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-[#1e2535] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2535] sticky top-0 bg-[#0d1117]">
          <p className="text-white font-semibold">CV оруулах</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {!showAIGenerator ? (
            <>
              <div
                onClick={() => document.getElementById("cvInput")?.click()}
                className="border-2 border-dashed border-[#1e2535] hover:border-[#3b5bdb]/50 rounded-2xl p-10 text-center cursor-pointer transition-all"
              >
                <FileText size={36} className="text-[#4c6ef5] mx-auto mb-3" />
                {cvName ? (
                  <p className="text-sm text-white font-medium">{cvName}</p>
                ) : (
                  <>
                    <p className="text-sm text-white font-medium mb-1">PDF эсвэл зураг сонгоно уу</p>
                    <p className="text-xs text-gray-500">PDF, JPG, PNG дэмжинэ</p>
                  </>
                )}
              </div>
              <input id="cvInput" type="file" accept=".pdf,image/*" className="hidden" onChange={handleFile} />

              <button
                onClick={() => setShowAIGenerator(true)}
                className="w-full py-3 bg-[#3b5bdb]/20 text-[#4c6ef5] text-sm font-semibold rounded-xl hover:bg-[#3b5bdb]/30 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> AI-аар CV үүсгүүлэх
              </button>

              <div className="flex gap-2 pt-2 border-t border-[#1e2535]">
                <button
                  onClick={handleSave}
                  disabled={!cvData || isSaving}
                  className="flex-1 py-2.5 bg-[#3b5bdb] text-white text-sm font-semibold rounded-xl hover:bg-[#4c6ef5] disabled:opacity-40 transition-all"
                >
                  {isSaving ? "Хадгалаж байна..." : "Хадгалах"}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 border border-[#1e2535] text-gray-400 text-sm rounded-xl hover:text-white transition-all"
                >
                  Цуцлах
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-semibold text-white mb-2 block">Өөрийнхөө мэдээлэл</label>
                <textarea
                  value={userInfo}
                  onChange={(e) => setUserInfo(e.target.value)}
                  placeholder="Жишээ: Нэр, туршлага, ур чадвар, боловсрол, сонирхол зэргийг оруулна уу..."
                  className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#3b5bdb] transition-all resize-none h-32"
                />
              </div>

              {generatedCV && (
                <div className="bg-[#1a2035] border border-[#1e2535] rounded-xl p-4">
                  <p className="text-xs font-semibold text-[#4c6ef5] mb-2">Үүсгэсэн CV:</p>
                  <p className="text-xs text-gray-300 line-clamp-4">{generatedCV}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleGenerateCV}
                  disabled={aiGenerating || !userInfo.trim()}
                  className="flex-1 py-3 bg-[#3b5bdb] text-white text-sm font-semibold rounded-xl hover:bg-[#4c6ef5] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Sparkles size={14} /> {aiGenerating ? "Үүсгээж байна..." : "CV үүсгүүлэх"}
                </button>
                <button
                  onClick={() => setShowAIGenerator(false)}
                  className="px-4 py-3 border border-[#1e2535] text-gray-400 text-sm rounded-xl hover:text-white transition-all"
                >
                  Эргээх
                </button>
              </div>

              {generatedCV && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-green-600/20 text-green-400 text-sm font-semibold rounded-xl hover:bg-green-600/30 transition-all disabled:opacity-40"
                >
                  {isSaving ? "Хадгалаж байна..." : "CV-г хадгалах"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
