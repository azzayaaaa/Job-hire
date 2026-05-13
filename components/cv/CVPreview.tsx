'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { useAlert } from '@/components/AlertProvider';
import { useSession } from 'next-auth/react';
import { API_URLS } from '@/lib/apiConfig';
import { authenticatedFetch } from '@/lib/axiosClient';

interface CVPreviewProps {
  htmlContent: string;
  onClose: () => void;
}

export default function CVPreview({ htmlContent, onClose }: CVPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { showAlert } = useAlert();
  const { data: session } = useSession();
  const [proActive, setProActive] = useState(false);

  useEffect(() => {
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      setProActive(false);
      return;
    }

    let cancelled = false;
    authenticatedFetch(API_URLS.user.entitlements(userId))
      .then((res) => {
        if (!cancelled) setProActive(res.data?.proActive === true);
      })
      .catch(() => {
        if (!cancelled) setProActive(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const requirePro = () => {
    showAlert('CV татах болон хэвлэх эрх Pro plan дээр нээгдэнэ.', 'warning');
  };

  const downloadAsHTML = () => {
    if (!proActive) {
      requirePro();
      return;
    }

    const element = document.createElement('a');
    const file = new Blob([htmlContent], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `CV_${new Date().getTime()}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadAsPDF = async () => {
    if (!proActive) {
      requirePro();
      return;
    }

    try {
      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      if (typeof (window as any).html2pdf !== 'undefined') {
        (window as any)
          .html2pdf()
          .set({
            margin: 10,
            filename: `CV_${new Date().getTime()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
          })
          .save();
      } else {
        const printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.print();
        }
      }

      document.body.removeChild(container);
    } catch (error) {
      console.error('PDF download error:', error);
      showAlert('PDF татахад алдаа гарлаа', 'error');
    }
  };

  const handlePrint = () => {
    if (!proActive) {
      requirePro();
      return;
    }

    try {
      iframeRef.current?.contentWindow?.print();
    } catch (error) {
      console.error('Print error:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-4">
      <div className="my-3 flex h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl sm:h-[92dvh]">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">CV Урьдчилсан үзүүлэлт</h2>
            {!proActive && (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                Free plan дээр preview харагдана. Татах болон хэвлэх эрх Pro plan дээр нээгдэнэ.
              </p>
            )}
          </div>
          <button onClick={onClose} className="self-end rounded-lg p-2 transition-colors hover:bg-gray-100 sm:self-auto">
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-3 sm:p-4">
          <div className="h-full w-full overflow-auto rounded-lg bg-white shadow">
            <iframe ref={iframeRef} srcDoc={htmlContent} className="h-full w-full border-none" title="CV Preview" />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-100 px-4 py-2 font-medium text-blue-700 transition-colors hover:bg-blue-200"
          >
            <Printer size={20} /> Хэвлэх
          </button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={downloadAsHTML}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 font-medium text-white transition-colors hover:bg-yellow-700"
            >
              <Download size={20} /> HTML татах
            </button>

            <button
              onClick={downloadAsPDF}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
            >
              <Download size={20} /> PDF татах
            </button>
          </div>
        </div>
      </div>

      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    </div>
  );
}
