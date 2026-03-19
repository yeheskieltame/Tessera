"use client";

interface PdfViewerProps {
  url: string;
  onClose: () => void;
}

export default function PdfViewer({ url, onClose }: PdfViewerProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-5xl h-[85vh] glass-strong rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100/50">
          <h3 className="text-sm font-semibold text-slate-700">
            Report Preview
          </h3>
          <div className="flex items-center gap-3">
            <a
              href={url}
              download
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF iframe */}
        <div className="flex-1">
          <iframe src={url} className="w-full h-full" title="PDF Report" />
        </div>
      </div>
    </div>
  );
}
