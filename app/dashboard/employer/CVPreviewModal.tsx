"use client";

import { useEffect } from "react";
import { X, FileText, Download, AlertCircle, CheckCircle2 } from "lucide-react";

export default function CVPreviewModal({
  cvData,
  cvFileName,
  candidateName,
  onClose,
  onApprove,
  onReject,
  applicationStatus,
  isProcessing = false,
}: {
  cvData: string;
  cvFileName?: string;
  candidateName: string;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  applicationStatus?: string;
  isProcessing?: boolean;
}) {
  useEffect(() => {
    console.log(" CVPreviewModal received:", {
      candidateName,
      cvFileName: cvFileName || "(none)",
      cvDataPresent: !!cvData,
      cvDataLength: cvData?.length || 0,
      cvDataPreview: cvData ? cvData.substring(0, 100) : "(empty)",
    });
  }, [cvData, cvFileName, candidateName]);

  const hasCV = !!cvData && cvData.trim().length > 0;
  const isPDF = cvData?.startsWith("data:application/pdf");
  const isImage = cvData?.startsWith("data:image");
  const isText = hasCV && !isPDF && !isImage;

  const handleDownload = () => {
    if (!cvData) return;
    const link = document.createElement("a");
    link.href = cvData;
    link.download = cvFileName || `${candidateName}_CV`;
    link.click();
  };

  const ActionButtons = () => (
    <div className="flex items-center gap-2">
      {applicationStatus && (
        <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-black uppercase text-white/45">
          {applicationStatus}
        </span>
      )}
      {onReject && (
        <button
          type="button"
          onClick={onReject}
          disabled={isProcessing || applicationStatus === "REJECTED"}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444]/15 text-[#F87171] text-xs font-semibold rounded-lg hover:bg-[#EF4444]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <X size={12} /> Татгалзах
        </button>
      )}
      {onApprove && (
        <button
          type="button"
          onClick={onApprove}
          disabled={isProcessing || applicationStatus === "APPROVED"}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981]/15 text-[#34D399] text-xs font-semibold rounded-lg hover:bg-[#10B981]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <CheckCircle2 size={12} /> Зөвшөөрөх
        </button>
      )}
    </div>
  );

  if (!hasCV) {
    console.warn("⚠️ CVPreviewModal: No CV data available");
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2535] shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-[#EF4444]" />
              <p className="text-white font-semibold text-sm">CV олдсонгүй</p>
            </div>
            <div className="flex items-center gap-2">
              <ActionButtons />
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <AlertCircle size={48} className="text-white/20 mb-4" />
            <p className="text-white/60 text-center mb-2">{candidateName} нь CV-г хадгалаагүй байна</p>
            <p className="text-white/40 text-xs text-center">Кандидат CV-г өөрийн профилд ачаалсан тохиолдолд л энд харагдана.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-[#1e2535] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2535] shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#4c6ef5]" />
            <div>
              <p className="text-white font-semibold text-sm">{candidateName} — CV</p>
              {cvFileName && <p className="text-white/40 text-xs">{cvFileName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionButtons />
            {cvData && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#3b5bdb]/20 text-[#4c6ef5] text-xs font-semibold rounded-lg hover:bg-[#3b5bdb]/30 transition-all"
              >
                <Download size={12} /> Татах
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CV Content */}
        <div className="flex-1 overflow-auto p-6">
          {isPDF && (
            <iframe
              src={cvData}
              className="w-full h-[65vh] rounded-xl border border-[#1e2535]"
              title="CV Preview"
              onError={() => console.error("❌ PDF iframe failed to load")}
            />
          )}
          {isImage && (
            <img
              src={cvData}
              alt="CV"
              className="w-full rounded-xl border border-[#1e2535] object-contain"
              onError={() => console.error("❌ Image failed to load")}
            />
          )}
          {isText && (
            <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono bg-[#1a2035] rounded-xl p-4 border border-[#1e2535] leading-relaxed">
              {cvData}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
