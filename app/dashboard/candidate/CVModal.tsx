"use client";
import { useState } from "react";
import { X, FileText, Sparkles } from "lucide-react";
import { authenticatedPatch, authenticatedPost } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import { useAlert } from "@/components/AlertProvider";

const loadSavedCV = (userId: number) => {
  if (typeof window === "undefined") return { name: "", data: "", text: "" };

  const saved = window.localStorage.getItem(`userCV_${userId}`);
  if (!saved) return { name: "", data: "", text: "" };

  try {
    const parsed = JSON.parse(saved) as { name?: string; data?: string; text?: string };
    return {
      name: parsed.name || "",
      data: parsed.data || "",
      text: parsed.text || "",
    };
  } catch {
    return { name: "", data: "", text: "" };
  }
};

const getErrorStatus = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status;

const isFileDataUrl = (value: string) =>
  /^data:(application\/pdf|image\/)/i.test(value);

const dataUrlToFile = async (dataUrl: string, fileName: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName || "uploaded-cv", {
    type: blob.type || "application/octet-stream",
  });
};

export default function CVModal({
  onClose,
  userId,
}: {
  onClose: () => void;
  userId: number;
}) {
  const { showAlert } = useAlert();
  const [initialCV] = useState(() => loadSavedCV(userId));
  const [cvName, setCvName] = useState(initialCV.name);
  const [cvData, setCvData] = useState(initialCV.data);
  const [cvText, setCvText] = useState(initialCV.text);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [userInfo, setUserInfo] = useState("");
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedCV, setGeneratedCV] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCvName(file.name);
      setCvData(ev.target?.result as string);
      setCvText("");
      setSelectedFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateCV = async () => {
    if (!userInfo.trim()) {
      showAlert("Өөрийнхөө мэдээллийг оруулна уу", "warning");
      return;
    }

    setAiGenerating(true);
    try {
      try {
        await authenticatedPost(API_URLS.user.useEntitlement(userId), { feature: "aiCv" });
      } catch (entitlementError: unknown) {
        if (getErrorStatus(entitlementError) === 402) {
          setPaywall(true);
          return;
        }
        throw entitlementError;
      }

      const response = await fetch(API_URLS.ai.generateCv(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInfo,
          fileType: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      const generated = data.htmlContent || data.cv || data.cvText || "";
      if (!generated) throw new Error("Empty generated CV");

      setGeneratedCV(generated);
      setCvName("AI-Generated CV.txt");
      setCvData(generated);
      setCvText(generated);
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      showAlert("CV үүсгэхэд алдаа гарлаа", "error");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await authenticatedPost(API_URLS.user.upgradePlan(userId), { plan: "PRO_MONTHLY" });
      setPaywall(false);
      showAlert("Pro эрх идэвхжлээ. Одоо AI CV-г хязгааргүй ашиглаж болно.", "success");
    } catch {
      showAlert("Төлөвлөгөө идэвхжүүлэхэд алдаа гарлаа.", "error");
    } finally {
      setUpgrading(false);
    }
  };

  const handleSave = async () => {
    if (!cvData) {
      showAlert("CV файл эсвэл AI үүсгүүлсэн CV оруулна уу", "warning");
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
      let readableCvText = cvText || cvData;
      if (selectedFile || isFileDataUrl(cvData)) {
        const fileToParse =
          selectedFile || (await dataUrlToFile(cvData, cvName || "uploaded-cv.pdf"));
        const formData = new FormData();
        formData.append("file", fileToParse);

        const parsedCvResponse = await authenticatedPost(
          API_URLS.ai.parseCv(),
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        readableCvText = String(parsedCvResponse.data?.cvText || "").trim();
        if (!readableCvText) {
          throw new Error("CV text extraction returned empty text");
        }
        setCvText(readableCvText);
      }

      const storageKey = `userCV_${userId}`;
      // Save to localStorage first (for offline support)
      localStorage.setItem(
        storageKey,
        JSON.stringify({ name: cvName, data: cvData, text: readableCvText }),
      );
      
      console.log("📱 CVModal: Saved to localStorage, now sending to backend...");
      
      // Send CV to user-service directly with both cvText and cvFileName
      const response = await authenticatedPatch(API_URLS.user.profile(userId), {
        cvText: readableCvText,
        cvFileName: cvName,
      });
      
      console.log("✅ CVModal: CV saved to backend successfully:", {
        userId,
        cvFileName: response.data?.cvFileName,
        hasCVText: !!response.data?.cvText,
      });
      
      showAlert("CV хадгалагдлаа!", "success");
      onClose();
    } catch (error) {
      console.error("❌ CVModal: CV save error:", error);
      showAlert("CV хадгалахад алдаа. Дахин оролдоно уу.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#1e2535] bg-[#0d1117]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1e2535] bg-[#0d1117] px-4 py-4 sm:px-6">
          <p className="text-white font-semibold">CV оруулах</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          {paywall && (
            <div className="rounded-2xl border border-[#4c6ef5]/30 bg-[#3b5bdb]/10 p-4">
              <p className="text-sm font-black text-white">Free AI CV лимит дууссан</p>
              <p className="mt-1 text-xs leading-5 text-gray-400">
                Free эрхээр AI-аар CV 1 удаа үүсгэнэ. Pro эрх 10,000₮/сар бөгөөд role-оосоо хамаарах боломжуудаа хязгааргүй ашиглана.
              </p>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="mt-3 w-full rounded-xl bg-[#3b5bdb] py-2.5 text-sm font-black text-white hover:bg-[#4c6ef5] disabled:opacity-50"
              >
                {upgrading ? "Идэвхжүүлж байна..." : "Pro авах - 10,000₮/сар"}
              </button>
            </div>
          )}
          {!showAIGenerator ? (
            <>
              <div
                onClick={() => document.getElementById("cvInput")?.click()}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-[#1e2535] p-6 text-center transition-all hover:border-[#3b5bdb]/50 sm:p-10"
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

              <div className="flex flex-col gap-2 border-t border-[#1e2535] pt-2 sm:flex-row">
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

              <div className="flex flex-col gap-2 sm:flex-row">
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
