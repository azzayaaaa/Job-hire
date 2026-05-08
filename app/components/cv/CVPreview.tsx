'use client';

import React, { useRef } from 'react';
import { Download, X, Printer } from 'lucide-react';

interface CVPreviewProps {
  htmlContent: string;
  onClose: () => void;
}

export default function CVPreview({ htmlContent, onClose }: CVPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const downloadAsHTML = () => {
    const element = document.createElement('a');
    const file = new Blob([htmlContent], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `CV_${new Date().getTime()}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadAsPDF = async () => {
    try {
      // Create a temporary container
      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      // Use html2pdf if available, otherwise use browser print
      if (typeof (window as any).html2pdf !== 'undefined') {
        (window as any).html2pdf().set({
          margin: 10,
          filename: `CV_${new Date().getTime()}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
        }).save();
      } else {
        // Fallback: print to PDF using browser print dialog
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
      alert('PDF татахад алдаа гарлаа');
    }
  };

  const handlePrint = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.print();
      } catch (error) {
        console.error('Print error:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">CV Урдчилсан үзүүлэлт</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden bg-gray-100 p-4">
          <div
            ref={previewRef}
            className="w-full h-full bg-white rounded-lg shadow overflow-auto"
          >
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              className="w-full h-full border-none"
              title="CV Preview"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-4 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
          >
            <Printer size={20} /> Хэвлэх
          </button>

          <div className="flex gap-3">
            <button
              onClick={downloadAsHTML}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              <Download size={20} /> HTML татах
            </button>

            <button
              onClick={downloadAsPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <Download size={20} /> PDF татах
            </button>
          </div>
        </div>
      </div>

      {/* html2pdf script */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    </div>
  );
}
