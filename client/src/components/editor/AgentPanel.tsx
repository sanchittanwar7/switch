import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, CheckCircle, XCircle, Wrench, Bot, ChevronRight, Cpu, User, MessageSquare, Plus } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { AvailableModel } from "../../stores/settingsStore";
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

interface UserTextEntry {
  type: "user_text";
  text: string;
}

type LogEntry = ToolEntry | ErrorEntry | DoneEntry | AgentTextEntry | UserTextEntry;

interface SessionSummary {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  messageCount: number;
  firstUserMessage: string;
}

interface AgentPanelProps {
  projectPath: string;
}

const LS_SESSIONS_PREFIX = "switch_agent_sessions_";
const LS_LAST_PREFIX = "switch_agent_last_";

function lsKey(suffix: string, resumePath: string): string {
  return `${suffix}${resumePath}`;
}

function loadTokensFromStorage(resumePath: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(lsKey(LS_SESSIONS_PREFIX, resumePath));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTokensToStorage(resumePath: string, tokens: Record<string, string>): void {
  try {
    localStorage.setItem(lsKey(LS_SESSIONS_PREFIX, resumePath), JSON.stringify(tokens));
  } catch {
    // ignore quota errors
  }
}

function loadLastSessionFromStorage(resumePath: string): { sessionId: string; sessionToken: string } | null {
  try {
    const raw = localStorage.getItem(lsKey(LS_LAST_PREFIX, resumePath));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastSessionToStorage(resumePath: string, sessionId: string, sessionToken: string): void {
  try {
    localStorage.setItem(lsKey(LS_LAST_PREFIX, resumePath), JSON.stringify({ sessionId, sessionToken }));
  } catch {
    // ignore quota errors
  }
}

export default function AgentPanel({ projectPath }: AgentPanelProps) {
  const [inputText, setInputText] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [selectedModel, setSelectedModel] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionSummaries, setSessionSummaries] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const activeFile = useEditorStore((s) => s.activeFile);
  const { availableModels, loadAvailableModels } = useSettingsStore();

  const resumeProjectPath = activeFile
    ? activeFile.split("/").slice(0, 2).join("/")
    : projectPath;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  useEffect(() => {
    loadAvailableModels();
  }, []);

  useEffect(() => {
    if (allModels.length === 0) return;
    const current = allModels.find((m) => m.model === selectedModel);
    if (!current) {
      const firstDefault = availableModels.find((g) => g.defaultModel)?.defaultModel;
      setSelectedModel(firstDefault || allModels[0].model);
    }
  }, [availableModels]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!resumeProjectPath) return;
    loadSessionList();

    const last = loadLastSessionFromStorage(resumeProjectPath);
    if (last) {
      loadPastSession(last.sessionId, last.sessionToken)
        .catch(() => {
          // session expired, ignore
        });
    }
  }, [resumeProjectPath]);

  const loadSessionList = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/agent/sessions?resumeProjectPath=${encodeURIComponent(resumeProjectPath)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionSummaries(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  }, [resumeProjectPath]);

  function getSelectedProvider(): string | undefined {
    if (!selectedModel) return undefined;
    for (const group of availableModels) {
      if (group.models.includes(selectedModel)) {
        return group.provider;
      }
    }
    return undefined;
  }

  const allModels = availableModels.flatMap((g) =>
    g.models.map((m) => ({ model: m, provider: g.provider })),
  );

  const resolveStalePendings = useCallback(() => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.type === "tool_entry" && entry.result === null
          ? { ...entry, result: "(No result received)" }
          : entry,
      ),
    );
  }, []);

  const connectSSE = useCallback(
    (sid: string, stoken: string) => {
      eventSourceRef.current?.close();
      const es = new EventSource(
        `/api/agent/sessions/${sid}/stream?token=${encodeURIComponent(stoken)}`,
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
        loadSessionList();
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
    },
    [resolveStalePendings, loadSessionList],
  );

  const handleSend = useCallback(async () => {
    const message = inputText.trim();
    if (!message || !resumeProjectPath || status === "running") return;

    setInputText("");
    const userEntry: UserTextEntry = { type: "user_text", text: message };
    setEntries((prev) => [...prev, userEntry]);
    setStatus("running");

    const provider = getSelectedProvider();

    try {
      const authToken = await getAuthToken();

      if (!sessionId || !sessionToken) {
        const isUrl = /^https?:\/\//.test(message);
        const res = await fetch("/api/agent/tailor", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            message,
            resumeProjectPath,
            ...(isUrl ? { jobUrl: message } : {}),
            ...(provider && selectedModel ? { provider, model: selectedModel } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed to start agent" }));
          setEntries((prev) => [...prev, { type: "error", content: data.error || "Failed to start agent" }]);
          setStatus("error");
          return;
        }

        const { sessionId: sid, sessionToken: stoken } = await res.json();
        setSessionId(sid);
        setSessionToken(stoken);
        storeSessionToken(sid, stoken);
        connectSSE(sid, stoken);
      } else {
        const res = await fetch(`/api/agent/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ message, token: sessionToken }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed to send message" }));
          setEntries((prev) => [...prev, { type: "error", content: data.error || "Failed to send message" }]);
          setStatus("error");
          return;
        }

        connectSSE(sessionId, sessionToken);
      }
    } catch (err) {
      resolveStalePendings();
      setEntries((prev) => [
        ...prev,
        { type: "error", content: err instanceof Error ? err.message : "Connection failed" },
      ]);
      setStatus("error");
    }
  }, [inputText, resumeProjectPath, status, sessionId, sessionToken, selectedModel, connectSSE, resolveStalePendings]);

  const storeSessionToken = useCallback((sid: string, stoken: string) => {
    const tokens = loadTokensFromStorage(resumeProjectPath);
    tokens[sid] = stoken;
    saveTokensToStorage(resumeProjectPath, tokens);
    saveLastSessionToStorage(resumeProjectPath, sid, stoken);
  }, [resumeProjectPath]);

  const loadPastSession = useCallback(async (sid: string, stoken: string) => {
    const token = await getAuthToken();
    const res = await fetch(`/api/agent/sessions/${sid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setSessionId(null);
      setSessionToken(null);
      return;
    }

    const data = await res.json();
    const entriesFromMessages: LogEntry[] = [];

    for (const msg of data.messages) {
      if (msg.role === "user") {
        entriesFromMessages.push({ type: "user_text", text: msg.content });
      } else if (msg.role === "assistant") {
        entriesFromMessages.push({ type: "agent_text", text: msg.content });
      } else if (msg.role === "tool_call") {
        entriesFromMessages.push({
          type: "tool_entry",
          callId: msg.toolCallId || "",
          tool: msg.toolName || "",
          args: msg.toolInput,
          result: null,
          expanded: false,
        });
      } else if (msg.role === "tool_result") {
        for (let i = entriesFromMessages.length - 1; i >= 0; i--) {
          const e = entriesFromMessages[i];
          if (e.type === "tool_entry" && e.callId === msg.toolCallId) {
            e.result = msg.content;
            break;
          }
        }
      }
    }

    setEntries(entriesFromMessages);
    setSessionId(data.id);
    setSessionToken(data.sessionToken);
    setStatus("done");

    const tokens = loadTokensFromStorage(resumeProjectPath);
    tokens[data.id] = data.sessionToken;
    saveTokensToStorage(resumeProjectPath, tokens);
    saveLastSessionToStorage(resumeProjectPath, data.id, data.sessionToken);
  }, [resumeProjectPath]);

  const startNewSession = useCallback(() => {
    eventSourceRef.current?.close();
    setEntries([]);
    setSessionId(null);
    setSessionToken(null);
    setStatus("idle");
  }, []);

  const toggleExpanded = (callId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.type === "tool_entry" && entry.callId === callId
          ? { ...entry, expanded: !entry.expanded }
          : entry,
      ),
    );
  };

  const hasModels = allModels.length > 0;

  const showSessionList = status === "idle" && !sessionId;

  return (
    <div className="h-full flex flex-col bg-brand-canvas-soft">
      <div className="flex-1 flex flex-col min-h-0">
        <div ref={logRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {showSessionList && (
            <div className="space-y-1">
              {loadingSessions && sessionSummaries.length === 0 && (
                <div className="text-xs text-brand-mute text-center py-4">
                  <Loader2 size={14} className="animate-spin inline-block mr-1.5" />
                  Loading past sessions...
                </div>
              )}

              {!loadingSessions && sessionSummaries.length === 0 && (
                <div className="text-xs text-brand-mute text-center py-4">
                  No past sessions. Ask the agent to tailor your resume, improve content, or review your drafts.
                </div>
              )}

              {sessionSummaries.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    const tokens = loadTokensFromStorage(resumeProjectPath);
                    const stoken = tokens[s.id];
                    if (stoken) {
                      loadPastSession(s.id, stoken);
                    } else {
                      setEntries([{ type: "error", content: "Session token not available. Start a new session." }]);
                    }
                  }}
                  className="w-full text-left p-2 rounded-sm border border-brand-hairline bg-brand-canvas hover:border-brand-hairline-strong transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare size={14} className="text-brand-mute shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-brand-ink truncate">
                        {s.firstUserMessage || "Empty session"}
                      </div>
                      <div className="text-[10px] text-brand-mute mt-0.5">
                        {formatDate(s.lastActivityAt)} &middot; {s.messageCount} message{s.messageCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!showSessionList && entries.map((entry, i) => {
            if (entry.type === "error") {
              return (
                <div key={i} className="flex items-start gap-2">
                  <XCircle size={14} className="text-brand-error shrink-0 mt-0.5" />
                  <span className="text-xs text-brand-error">{entry.content}</span>
                </div>
              );
            }

            if (entry.type === "user_text") {
              return (
                <div key={i} className="flex items-start gap-2">
                  <User size={14} className="text-brand-body shrink-0 mt-0.5" />
                  <span className="text-xs text-brand-ink whitespace-pre-wrap">{entry.text}</span>
                </div>
              );
            }

            if (entry.type === "done") {
              return (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-brand-link shrink-0 mt-0.5" />
                  <span className="text-xs text-brand-link font-medium">
                    Ready. You can send another message to continue.
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
                        <div className="text-xs text-brand-mute mb-0.5 font-medium">
                          Arguments
                        </div>
                        <pre className="text-xs text-brand-body whitespace-pre-wrap break-all font-mono">
                          {formatArgs(entry.args)}
                        </pre>
                      </div>
                    )}
                    {entry.result !== null && (
                      <div className="bg-brand-canvas-soft-2 rounded-sm border border-brand-hairline p-2">
                        <div className="text-xs text-brand-mute mb-0.5 font-medium">
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

        <div className="border-t border-brand-hairline p-3 space-y-2">
          {hasModels ? (
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-brand-mute shrink-0" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="flex-1 bg-brand-canvas-soft-2 text-brand-ink text-xs px-2 py-1.5 rounded-sm border border-brand-hairline outline-none focus:border-brand-link transition-colors"
              >
                {availableModels.map((group) => (
                  <optgroup key={group.provider} label={group.provider.toUpperCase()}>
                    {group.models.map((m) => (
                      <option key={`${group.provider}-${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-brand-mute">
              <Cpu size={14} className="shrink-0" />
              <span>
                <a href="/settings" className="text-brand-link hover:underline">
                  Configure a provider
                </a>{" "}
                in Settings to select a model.
              </span>
            </div>
          )}

          {sessionId && (status === "done" || status === "idle") && (
            <div className="flex gap-2">
              <button
                onClick={startNewSession}
                className="flex items-center gap-1 text-xs text-brand-mute hover:text-brand-ink transition-colors"
              >
                <Plus size={12} />
                New session
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              placeholder={
                sessionId
                  ? "Send a follow-up message..."
                  : "Paste a job URL or ask the agent anything..."
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={status === "running"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && status !== "running") handleSend();
              }}
              className="flex-1 bg-brand-canvas-soft-2 text-brand-ink text-xs px-2.5 py-1.5 rounded-sm border border-brand-hairline outline-none focus:border-brand-link transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={status === "running" || !inputText.trim() || !resumeProjectPath || !hasModels}
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded-sm bg-brand-ink text-brand-on-primary hover:bg-brand-link transition-colors disabled:opacity-30"
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

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

async function getAuthToken(): Promise<string> {
  const { supabase } = await import("../../lib/supabase");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}
