import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, CheckCircle, XCircle, Wrench, Bot, ChevronRight } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import MarkdownRenderer from "./MarkdownRenderer";

interface ToolEntry {
  type: "tool_entry";
  callId: string;
  tool: string;
  args: unknown;
  result: string | null;
  expanded: boolean;
}

interface ErrorEntry {
  type: "error";
  content?: string;
}

interface DoneEntry {
  type: "done";
}

interface AgentTextEntry {
  type: "agent_text";
  text: string;
}

type LogEntry = ToolEntry | ErrorEntry | DoneEntry | AgentTextEntry;

interface AgentPanelProps {
  projectPath: string;
}

export default function AgentPanel({ projectPath }: AgentPanelProps) {
  const [jobUrl, setJobUrl] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const logRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const activeFile = useEditorStore((s) => s.activeFile);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const resumeProjectPath = activeFile
    ? activeFile.split("/").slice(0, 2).join("/")
    : projectPath;

  const resolveStalePendings = useCallback(() => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.type === "tool_entry" && entry.result === null
          ? { ...entry, result: "(No result received)" }
          : entry,
      ),
    );
  }, []);

  const handleStart = useCallback(async () => {
    if (!jobUrl.trim() || !resumeProjectPath) return;

    eventSourceRef.current?.close();
    setEntries([]);
    setStatus("running");

    try {
      const token = await getAuthToken();
      const res = await fetch("/api/agent/tailor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobUrl: jobUrl.trim(),
          resumeProjectPath,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to start agent" }));
        setEntries([{ type: "error", content: data.error || "Failed to start agent" }]);
        setStatus("error");
        return;
      }

      const { sessionId, sessionToken } = await res.json();

      const es = new EventSource(
        `/api/agent/sessions/${sessionId}/stream?token=${encodeURIComponent(sessionToken)}`,
      );
      eventSourceRef.current = es;

      es.addEventListener("tool_call", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const entry: ToolEntry = {
            type: "tool_entry",
            callId: data.id,
            tool: data.tool,
            args: data.args,
            result: null,
            expanded: false,
          };
          setEntries((prev) => [...prev, entry]);
        } catch { /* ignore malformed SSE data */ }
      });

      es.addEventListener("tool_result", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setEntries((prev) => {
            const idx = prev.findIndex(
              (entry) => entry.type === "tool_entry" && entry.callId === data.id,
            );
            if (idx === -1) return prev;
            const next = [...prev];
            const entry = next[idx] as ToolEntry;
            next[idx] = { ...entry, result: data.summary || "" };
            return next;
          });
        } catch { /* ignore malformed SSE data */ }
      });

      es.addEventListener("message", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const chunk = data.content || "";
          if (!chunk) return;
          setEntries((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.type === "agent_text") {
              const next = [...prev];
              next[next.length - 1] = { ...last, text: last.text + chunk };
              return next;
            }
            const entry: AgentTextEntry = {
              type: "agent_text",
              text: chunk,
            };
            return [...prev, entry];
          });
        } catch { /* ignore malformed SSE data */ }
      });

      es.addEventListener("error", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setEntries((prev) => [
            ...prev,
            { type: "error", content: data.error || "Unknown error" },
          ]);
        } catch {
          setEntries((prev) => [
            ...prev,
            { type: "error", content: "Stream error" },
          ]);
        }
        setStatus("error");
        es.close();
        resolveStalePendings();
      });

      es.addEventListener("done", () => {
        resolveStalePendings();
        setEntries((prev) => [...prev, { type: "done" }]);
        setStatus("done");
        es.close();
      });

      let errorHandled = false;

      es.onerror = () => {
        if (errorHandled) return;
        if (es.readyState === EventSource.CLOSED) {
          errorHandled = true;
          resolveStalePendings();
          setStatus("error");
        }
      };
    } catch (err) {
      resolveStalePendings();
      setEntries([
        { type: "error", content: err instanceof Error ? err.message : "Connection failed" },
      ]);
      setStatus("error");
    }
  }, [jobUrl, resumeProjectPath]);

  const toggleExpanded = (callId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.type === "tool_entry" && entry.callId === callId
          ? { ...entry, expanded: !entry.expanded }
          : entry,
      ),
    );
  };

  return (
    <div className="h-full flex flex-col bg-brand-canvas">
      <div className="flex-1 flex flex-col min-h-0">
        <div ref={logRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {status === "idle" && entries.length === 0 && (
            <div className="text-xs text-brand-mute text-center py-4">
              Enter a job posting URL to tailor your resume.
            </div>
          )}

          {entries.map((entry, i) => {
            if (entry.type === "error") {
              return (
                <div key={i} className="flex items-start gap-2">
                  <XCircle size={14} className="text-brand-error shrink-0 mt-0.5" />
                  <span className="text-xs text-brand-error">{entry.content}</span>
                </div>
              );
            }

            if (entry.type === "done") {
              return (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-brand-link shrink-0 mt-0.5" />
                  <span className="text-xs text-brand-link font-medium">
                    Resume tailored successfully
                  </span>
                </div>
              );
            }

            if (entry.type === "agent_text") {
              return (
                <div key={i} className="flex items-start gap-2">
                  <Bot size={14} className="text-brand-link shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <MarkdownRenderer content={entry.text} />
                  </div>
                </div>
              );
            }

            const pending = entry.result === null;

            return (
              <div key={entry.callId}>
                <button
                  onClick={() => toggleExpanded(entry.callId)}
                  className="flex items-center gap-2 w-full text-left group"
                >
                  <span
                    className={`shrink-0 transition-transform ${
                      entry.expanded ? "rotate-90" : ""
                    }`}
                  >
                    <ChevronRight size={12} className="text-brand-mute" />
                  </span>
                  {pending ? (
                    <Loader2 size={12} className="animate-spin text-brand-link shrink-0" />
                  ) : (
                    <Wrench size={12} className="text-brand-link shrink-0" />
                  )}
                  <span className="text-xs text-brand-ink font-medium min-w-0 truncate">
                    {entry.tool}
                  </span>
                  {!pending && !entry.expanded && (
                    <span className="text-xs text-brand-mute truncate">
                      {truncateResult(entry.result)}
                    </span>
                  )}
                </button>

                {entry.expanded && (
                  <div className="ml-5 mt-1 space-y-1.5">
                    {entry.args !== undefined && entry.args !== null && (
                      <div className="bg-brand-canvas-soft-2 rounded-sm border border-brand-hairline p-2">
                        <div className="text-[10px] text-brand-mute mb-0.5 font-medium">
                          Arguments
                        </div>
                        <pre className="text-xs text-brand-body whitespace-pre-wrap break-all font-mono">
                          {formatArgs(entry.args)}
                        </pre>
                      </div>
                    )}
                    {entry.result !== null && (
                      <div className="bg-brand-canvas-soft-2 rounded-sm border border-brand-hairline p-2">
                        <div className="text-[10px] text-brand-mute mb-0.5 font-medium">
                          Result
                        </div>
                        <pre className="text-xs text-brand-body whitespace-pre-wrap break-all font-mono">
                          {entry.result}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {status === "running" && (
            <div className="flex items-center gap-2 text-xs text-brand-mute pt-1">
              <Loader2 size={14} className="animate-spin" />
              Working...
            </div>
          )}
        </div>

        <div className="border-t border-brand-hairline p-3">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Job posting URL..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              disabled={status === "running"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && status !== "running") handleStart();
              }}
              className="flex-1 bg-brand-canvas-soft-2 text-brand-ink text-xs px-2.5 py-1.5 rounded-sm border border-brand-hairline outline-none focus:border-brand-link transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleStart}
              disabled={status === "running" || !jobUrl.trim() || !resumeProjectPath}
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded-sm bg-brand-ink text-white hover:bg-brand-link transition-colors disabled:opacity-30"
            >
              {status === "running" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function truncateResult(result: string | null): string {
  if (!result) return "";
  const firstLine = result.split("\n")[0];
  return firstLine.length > 50 ? firstLine.slice(0, 50) + "..." : firstLine;
}

function formatArgs(args: unknown): string {
  if (typeof args === "string") return args;
  return JSON.stringify(args, null, 2);
}

async function getAuthToken(): Promise<string> {
  const { supabase } = await import("../../lib/supabase");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}
