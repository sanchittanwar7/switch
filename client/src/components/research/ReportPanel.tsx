import { useResearchStore } from "../../stores/researchStore";
import { RefreshCw, X, Clock, FileText, Loader2 } from "lucide-react";
import MarkdownRenderer from "../editor/MarkdownRenderer";

export default function ReportPanel() {
  const {
    sessionId,
    reportContent,
    reportLastModified,
    loadingReport,
    loadReport,
    closeReportPanel,
  } = useResearchStore();

  if (!sessionId) {
    return (
      <div className="w-80 shrink-0 border-l border-brand-hairline bg-brand-canvas-soft flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-hairline">
          <h3 className="text-xs font-semibold text-brand-ink tracking-[-0.01em]">
            Report
          </h3>
          <button
            onClick={closeReportPanel}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-brand-mute px-4 text-center">
            No active research session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 shrink-0 border-l border-brand-hairline bg-brand-canvas-soft flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-hairline">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-brand-mute shrink-0" />
          <h3 className="text-xs font-semibold text-brand-ink tracking-[-0.01em] truncate">
            Report
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadReport}
            disabled={loadingReport}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors disabled:opacity-50"
            title="Refresh report"
          >
            {loadingReport ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
          </button>
          <button
            onClick={closeReportPanel}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {reportLastModified && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-brand-hairline text-[10px] text-brand-mute">
          <Clock size={10} className="shrink-0" />
          <span>Last updated {formatRelativeTime(reportLastModified)}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loadingReport ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={16} className="animate-spin text-brand-mute" />
          </div>
        ) : !reportContent ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <FileText size={24} className="text-brand-mute mb-3" />
            <p className="text-xs text-brand-mute text-center">
              No report generated yet. Continue the conversation and the agent will create one.
            </p>
          </div>
        ) : (
          <div className="p-4">
            <MarkdownRenderer content={reportContent} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}
