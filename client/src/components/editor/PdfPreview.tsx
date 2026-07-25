import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfPreviewProps {
  pdfUrl: string | null;
}

export default function PdfPreview({ pdfUrl }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loadError, setLoadError] = useState(false);

  if (!pdfUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-canvas">
        <span className="text-sm text-brand-mute">
          Compile to preview PDF
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-canvas">
        <span className="text-sm text-brand-error">
          Failed to load PDF
        </span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-brand-canvas">
      <div className="flex items-center justify-center gap-3 py-1.5 bg-brand-canvas-soft border-t border-brand-hairline shrink-0">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            disabled={scale <= 0.5}
            className="p-1 rounded-full hover:bg-brand-canvas-soft-2 text-brand-body disabled:opacity-30 transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-brand-body w-10 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.0, s + 0.1))}
            disabled={scale >= 2.0}
            className="p-1 rounded-full hover:bg-brand-canvas-soft-2 text-brand-body disabled:opacity-30 transition-colors"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {numPages > 0 && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="p-1 rounded-full hover:bg-brand-canvas-soft-2 text-brand-body disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-brand-body min-w-[60px] text-center tabular-nums">
              {pageNumber} / {numPages}
            </span>
            <button
              onClick={() =>
                setPageNumber((p) => Math.min(numPages, p + 1))
              }
              disabled={pageNumber >= numPages}
              className="p-1 rounded-full hover:bg-brand-canvas-soft-2 text-brand-body disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto flex justify-center p-4">
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages: loaded }) => {
            setNumPages(loaded);
            setLoadError(false);
            if (pageNumber > loaded) setPageNumber(loaded);
          }}
          onLoadError={() => setLoadError(true)}
          className="flex justify-center"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-lg"
          />
        </Document>
      </div>
    </div>
  );
}
