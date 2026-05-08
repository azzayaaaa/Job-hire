declare module "html2pdf.js" {
  type Html2PdfOptions = {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
    pagebreak?: Record<string, unknown>;
  };

  type Html2PdfWorker = {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(source: Element): Html2PdfWorker;
    save(): Promise<void>;
  };

  const html2pdf: () => Html2PdfWorker;
  export default html2pdf;
}
