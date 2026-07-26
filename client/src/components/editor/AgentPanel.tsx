import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, CheckCircle, XCircle, Wrench, FileText, Bot } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";

interface StreamEvent {
  type: "tool_call" | "tool_result" | "message" | "error" | "done";
  content?: string;
  tool?: string;
  args?: string;
}

interface AgentPanelProps {
  projectPath: string;
}

export default function AgentPanel({ projectPath }: AgentPanelProps) {
  const [jobUrl, setJobUrl] = useState("");
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [agentText, setAgentText] = useState("");
  const textRef = useRef("");
  const logRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const activeFile = useEditorStore((s) => s.activeFile);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [events, agentText]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const resumeProjectPath = activeFile
    ? activeFile.split("/").slice(0, 2).join("/")
    : projectPath;

  const handleStart = useCallback(async () => {
    if (!jobUrl.trim() || !resumeProjectPath) return;

    eventSourceRef.current?.close();
    setEvents([]);
    setAgentText("");
    textRef.current = "";
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
        setEvents((prev) => [
          ...prev,
          { type: "error", content: data.error || "Failed to start agent" },
        ]);
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
          setEvents((prev) => [
            ...prev,
            { type: "tool_call", tool: data.tool, args: data.args },
          ]);
        } catch { /* ignore malformed SSE data */ }
      });

      es.addEventListener("tool_result", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => [
            ...prev,
            { type: "tool_result", content: data.summary || "" },
          ]);
        } catch { /* ignore malformed SSE data */ }
      });

      es.addEventListener("message", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          textRef.current += data.text || "";
          setAgentText(textRef.current);
        } catch { /* ignore malformed SSE data */ }
      });

      es.addEventListener("error", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => [
            ...prev,
            { type: "error", content: data.error || "Unknown error" },
          ]);
        } catch {
          // non-SSE error event (e.g. HTTP error from server before SSE stream starts)
        }
        setStatus("error");
        es.close();
      });

      es.addEventListener("done", () => {
        setStatus("done");
        es.close();
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setStatus((prev) => (prev === "running" ? "error" : prev));
        }
      };
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        { type: "error", content: err instanceof Error ? err.message : "Connection failed" },
      ]);
      setStatus("error");
    }
  }, [jobUrl, resumeProjectPath]);

  const eventIcon = (type: StreamEvent["type"]) => {
    switch (type) {
      case "tool_call":
        return <Wrench size={14} className="text-brand-link shrink-0 mt-0.5" />;
      case "tool_result":
        return <FileText size={14} className="text-brand-mute shrink-0 mt-0.5" />;
      case "error":
        return <XCircle size={14} className="text-brand-error shrink-0 mt-0.5" />;
      case "done":
        return <CheckCircle size={14} className="text-brand-link shrink-0 mt-0.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-brand-canvas">
      <div className="flex-1 flex flex-col min-h-0">
        <div ref={logRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {status === "idle" && events.length === 0 && (
            <div className="text-xs text-brand-mute text-center py-4">
              Enter a job posting URL to tailor your resume.
            </div>
          )}

          {events.map((ev, i) => (
            <div key={i} className="flex items-start gap-2">
              {eventIcon(ev.type)}
              <div className="min-w-0 flex-1">
                {ev.type === "tool_call" && (
                  <span className="text-xs text-brand-ink">
                    <span className="text-brand-link font-medium">{ev.tool}</span>
                    {ev.args && (
                      <span className="text-brand-mute"> {truncateArgs(ev.args)}</span>
                    )}
                  </span>
                )}
                {ev.type === "tool_result" && (
                  <span className="text-xs text-brand-body">
                    {ev.content}
                  </span>
                )}
                {ev.type === "error" && (
                  <span className="text-xs text-brand-error">{ev.content}</span>
                )}
                {ev.type === "done" && (
                  <span className="text-xs text-brand-link font-medium">
                    Resume tailored successfully
                  </span>
                )}
              </div>
            </div>
          ))}

          {agentText && (
            <div className="flex items-start gap-2">
              <Bot size={14} className="text-brand-violet shrink-0 mt-0.5" />
              <p className="text-xs text-brand-ink whitespace-pre-wrap">{agentText}</p>
            </div>
          )}

          {status === "running" && (
            <div className="flex items-center gap-2 text-xs text-brand-mute">
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

function truncateArgs(args: unknown): string {
  const str = typeof args === "string" ? args : JSON.stringify(args);
  return str.length > 60 ? str.slice(0, 60) + "..." : str;
}

async function getAuthToken(): Promise<string> {
  const { supabase } = await import("../../lib/supabase");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}
