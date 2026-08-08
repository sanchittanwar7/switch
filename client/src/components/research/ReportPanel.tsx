import { useRef, useCallback, useState, useEffect } from "react";
import { RefreshCw, Clock, FileText, Loader2, PanelLeft, List, ChevronUp } from "lucide-react";
import { useResearchStore } from "../../stores/researchStore";
import MarkdownRenderer from "../editor/MarkdownRenderer";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function parseToc(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      entries.push({ id: slugify(h2[1]), text: h2[1].trim(), level: 2 });
      continue;
    }
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      entries.push({ id: slugify(h3[1]), text: h3[1].trim(), level: 3 });
    }
  }
  return entries;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-|-$/g, "");
}

function scrollToHeading(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

interface ReportPanelProps {
  onCollapse: () => void;
}

export default function ReportPanel({ onCollapse }: ReportPanelProps) {
  const {
    sessionId,
    reportContent,
    reportLastModified,
    loadingReport,
    loadReport,
  } = useResearchStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const toc = parseToc(reportContent);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (el) setScrolled(el.scrollTop > 200);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleRefresh = useCallback(() => {
    loadReport();
  }, [loadReport]);

  return (
    <div className="h-full border-l border-brand-hairline bg-brand-canvas-soft flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-hairline">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-brand-mute shrink-0" />
          <h3 className="text-xs font-semibold text-brand-ink tracking-[-0.01em] truncate">
            Report
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
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
            onClick={onCollapse}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
            title="Collapse report"
          >
            <PanelLeft size={14} />
          </button>
        </div>
      </div>

      {reportLastModified && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-brand-hairline text-[10px] text-brand-mute">
          <Clock size={10} className="shrink-0" />
          <span>Last updated {formatRelativeTime(reportLastModified)}</span>
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto relative">
        {scrolled && reportContent && (
          <button
            onClick={scrollToTop}
            className="sticky top-3 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-brand-canvas border border-brand-hairline shadow-sm text-brand-mute hover:text-brand-ink hover:border-brand-hairline-strong transition-all"
            title="Scroll to top"
          >
            <ChevronUp size={14} />
          </button>
        )}
        {loadingReport ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={16} className="animate-spin text-brand-mute" />
          </div>
        ) : !reportContent ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <FileText size={24} className="text-brand-mute mb-3" />
            <p className="text-xs text-brand-mute text-center">
              {sessionId
                ? "No report generated yet. Continue the conversation and the agent will create one."
                : "No active research session."}
            </p>
          </div>
        ) : (
          <div className="p-4">
            {toc.length > 1 && (
              <div className="mb-6 pb-4 border-b border-brand-hairline">
                <div className="flex items-center gap-1.5 mb-2">
                  <List size={12} className="text-brand-mute shrink-0" />
                  <span className="text-[11px] font-medium text-brand-ink">Contents</span>
                </div>
                <ul className="space-y-0.5">
                  {toc.map((entry) => (
                    <li key={entry.id}>
                      <button
                        onClick={() => scrollToHeading(entry.id)}
                        className={`text-xs text-brand-body hover:text-brand-link transition-colors text-left w-full ${
                          entry.level === 3 ? "pl-4" : ""
                        }`}
                      >
                        {entry.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
