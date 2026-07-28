import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Play,
  ExternalLink,
  HelpCircle,
  X,
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
  const [helpOpen, setHelpOpen] = useState(false);

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

      <button
        onClick={() => setHelpOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-hairline text-brand-body px-3 py-1 text-xs font-medium hover:bg-brand-canvas-soft hover:text-brand-ink transition-colors"
      >
        <HelpCircle size={14} />
        Get Help
      </button>

      <div className="relative">
        {compileStatus === "compiling" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-brand-body">
            <Loader2 size={14} className="animate-spin" />
            Compiling...
          </span>
        )}

        {compileStatus === "success" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-brand-link">
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

      {helpOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setHelpOpen(false)}
          />
          <div
            className="fixed top-0 right-0 bottom-0 z-50 w-1/2 bg-brand-canvas border-l border-brand-hairline overflow-y-auto"
            style={{
              boxShadow:
                "-8px 0px 32px -8px rgba(0,0,0,0.4), 0px 1px 1px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-brand-canvas border-b border-brand-hairline">
              <h3 className="text-sm font-semibold text-brand-ink tracking-[-0.02em]">
                How to configure and use the AI Agent
              </h3>
              <button
                onClick={() => setHelpOpen(false)}
                className="p-1 text-brand-mute hover:text-brand-ink rounded-sm transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-8">
              <div className="rounded-lg overflow-hidden border border-brand-hairline bg-brand-canvas-soft">
                <iframe
                  src="https://scribehow.com/embed/Configure_DeepSeek_AI_for_Resume_Optimization__ZtckvFXCS3u8C9ocGxxi2w?as=video"
                  width="100%"
                  height="800"
                  allow="fullscreen"
                  style={{ aspectRatio: "16 / 12", border: 0, minHeight: 480 }}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-brand-ink">
                  Step-by-step guide
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        Go to the Settings page and configure a provider
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        Navigate to Settings and add an AI provider by providing
                        your API key. Supported providers include OpenAI,
                        Anthropic, Google, and DeepSeek.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        Open the agent chat in the editor
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        In the editor sidebar, click the Bot icon to open the AI
                        Agent panel. This is where you interact with the agent to
                        tailor your resume.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        Choose a model from the provider you configured
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        In the agent panel, select the provider and model you
                        want to use. The available models depend on the provider
                        you configured in Settings.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        Share a job URL with the agent
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        Paste a link to the job posting you want to apply for.
                        The agent will fetch the job description and use it to
                        tailor your resume.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      5
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        The agent tailors your resume — tweak as needed
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        The agent will rewrite your resume to highlight relevant
                        skills and experience. Review the changes and make any
                        adjustments directly in the editor.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      6
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        Compile to see your changes
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        Press the Compile button in the toolbar to build your
                        LaTeX resume and preview the updated PDF. Download it
                        when you are satisfied.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
