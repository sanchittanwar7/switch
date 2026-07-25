import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Play,
  ExternalLink,
} from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { apiGetBlob } from "../../lib/api";

interface EditorToolbarProps {
  projectPath: string;
}

export default function EditorToolbar({ projectPath }: EditorToolbarProps) {
  const {
    compileStatus,
    compileErrors,
    pdfUrl,
    pdfPath,
    compile,
  } = useEditorStore();

  const [showErrors, setShowErrors] = useState(false);

  const handleCompile = () => {
    compile(projectPath);
  };

  const handleDownload = async () => {
    if (!pdfPath) return;
    try {
      const blob = await apiGetBlob(
        `/api/latex/download?path=${encodeURIComponent(pdfPath)}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfPath.split("/").pop() || "document.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-brand-canvas-soft border-b border-brand-hairline shrink-0">
      <button
        onClick={handleCompile}
        disabled={compileStatus === "compiling"}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-ink text-brand-on-primary rounded-full text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {compileStatus === "compiling" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Play size={14} />
        )}
        Compile
      </button>

      {pdfUrl && (
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
        >
          <Download size={14} />
          PDF
        </button>
      )}

      <div className="flex-1" />

      <div className="relative">
        {compileStatus === "compiling" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-brand-body">
            <Loader2 size={14} className="animate-spin" />
            Compiling...
          </span>
        )}

        {compileStatus === "success" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-brand-success">
            <CheckCircle2 size={14} />
            Compiled
            <button
              onClick={() => window.open(pdfUrl!, "_blank")}
              className="ml-1 text-brand-mute hover:text-brand-ink transition-colors"
              title="Open PDF in new tab"
            >
              <ExternalLink size={12} />
            </button>
          </span>
        )}

        {compileStatus === "error" && (
          <div>
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="inline-flex items-center gap-1.5 text-xs text-brand-error hover:opacity-80 transition-opacity"
            >
              <XCircle size={14} />
              {compileErrors.length > 0
                ? `${compileErrors.length} error${compileErrors.length !== 1 ? "s" : ""}`
                : "Compilation failed"}
            </button>
            {showErrors && compileErrors.length > 0 && (
              <div
                className="absolute right-0 top-full mt-2 z-50 w-80 max-h-48 overflow-y-auto bg-brand-canvas-soft border border-brand-hairline rounded-lg p-3"
                style={{
                  boxShadow:
                    "0px 1px 1px rgba(0,0,0,0.3), 0px 8px 16px -4px rgba(0,0,0,0.4), 0px 24px 32px -8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)",
                }}
              >
                {compileErrors.map((err, i) => (
                  <div
                    key={i}
                    className="text-xs text-brand-ink mb-1.5 last:mb-0 font-mono leading-5"
                  >
                    <span className="text-brand-error font-medium">
                      l.{err.line}
                    </span>{" "}
                    <span className="text-brand-body">{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {compileStatus === "idle" && (
          <span className="text-xs text-brand-mute">Ready</span>
        )}
      </div>
    </div>
  );
}
