import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, CheckCircle, XCircle, Wrench, Bot, ChevronRight,
  Cpu, User, Plus, Trash2, FlaskConical, Settings,
} from "lucide-react";
import { useResearchStore } from "../stores/researchStore";
import { useSettingsStore } from "../stores/settingsStore";
import MarkdownRenderer from "../components/editor/MarkdownRenderer";
import ReportPanel from "../components/research/ReportPanel";
import InstructionsModal from "../components/research/InstructionsModal";

export default function ResearchView() {
  const [inputText, setInputText] = useState("");
  const [instructionsModalOpen, setInstructionsModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const store = useResearchStore();
  const { availableModels, loadAvailableModels } = useSettingsStore();

  useEffect(() => {
    store.loadSessions();
    store.loadInstructions();
    loadAvailableModels();
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [store.entries]);

  useEffect(() => {
    if (allModels.length === 0) return;
    const current = allModels.find((m) => m.model === store.selectedModel);
    if (!current) {
      const firstDefault = availableModels.find((g) => g.defaultModel)?.defaultModel;
      store.setSelectedModel(firstDefault || allModels[0].model);
    }
  }, [availableModels]);

  const allModels = availableModels.flatMap((g) =>
    g.models.map((m) => ({ model: m, provider: g.provider })),
  );
  const hasModels = allModels.length > 0;
  const isRunning = store.status === "running";
  const hasActiveSession = store.sessionId !== null;
  const showWelcome = store.sessions.length === 0 && !hasActiveSession;

  const getSelectedProvider = () => {
    if (!store.selectedModel) return undefined;
    return allModels.find((m) => m.model === store.selectedModel)?.provider;
  };

  const handleSend = async () => {
    const message = inputText.trim();
    if (!message || isRunning || !hasModels) return;
    setInputText("");

    if (!hasActiveSession) {
      const provider = getSelectedProvider();
      const { sessionId: sid, sessionToken: stoken } = await store.createSession(
        message,
        provider,
        store.selectedModel || undefined,
      );
      store.connectSSE(sid, stoken);
    } else {
      await store.sendMessage(message);
      if (store.sessionId && store.sessionToken) {
        store.connectSSE(store.sessionId, store.sessionToken);
      }
    }
  };

  const handleStartNew = () => {
    store.startNewSession();
    setInputText("");
  };

  const handleLoadSession = (id: string) => {
    setConfirmDeleteId(null);
    store.loadSession(id);
  };

  const handleDeleteSession = (id: string) => {
    if (confirmDeleteId === id) {
      store.deleteSession(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const toggleEntry = (callId: string) => {
    store.entries.forEach((entry, i) => {
      if (entry.type === "tool_entry" && entry.callId === callId) {
        const updated = [...store.entries];
        updated[i] = { ...entry, expanded: !entry.expanded };
        useResearchStore.setState({ entries: updated });
      }
    });
  };

  if (showWelcome) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-canvas-soft">
        <div className="text-center max-w-md px-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-canvas border border-brand-hairline mx-auto mb-6">
            <FlaskConical size={28} className="text-brand-link" />
          </div>
          <h2 className="text-lg font-semibold text-brand-ink tracking-[-0.02em] mb-2">
            Research companies.
          </h2>
          <p className="text-sm text-brand-body mb-8">
            Research companies to prepare for interviews. The agent gathers information from the web and builds a structured report.
          </p>

          {!hasModels ? (
            <p className="text-xs text-brand-mute">
              <a href="/settings" className="text-brand-link hover:underline">
                Configure a provider
              </a>
              {" "}in Settings to get started.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-brand-mute shrink-0" />
                <select
                  value={store.selectedModel}
                  onChange={(e) => store.setSelectedModel(e.target.value)}
                  className="flex-1 bg-brand-canvas text-brand-ink text-xs px-2 py-1.5 rounded-sm border border-brand-hairline outline-none focus:border-brand-link transition-colors"
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
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Research Stripe..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isRunning}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isRunning) handleSend();
                  }}
                  className="flex-1 bg-brand-canvas text-brand-ink text-xs px-3 h-10 rounded-md border border-brand-hairline outline-none focus:border-brand-link focus:ring-2 focus:ring-brand-link/20 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={isRunning || !inputText.trim()}
                  className="shrink-0 flex items-center justify-center w-10 h-10 rounded-md bg-brand-ink text-brand-on-primary hover:bg-brand-link transition-colors disabled:opacity-30"
                >
                  {isRunning ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-brand-canvas-soft">
      <div className="w-60 shrink-0 border-r border-brand-hairline flex flex-col">
        <div className="px-3 py-3 border-b border-brand-hairline flex items-center gap-2">
          <button
            onClick={handleStartNew}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-link hover:text-brand-link-deep transition-colors"
          >
            <Plus size={14} />
            New Research
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {store.loadingSessions && store.sessions.length === 0 && (
            <div className="text-xs text-brand-mute text-center py-6">
              <Loader2 size={14} className="animate-spin inline-block mr-1.5" />
              Loading...
            </div>
          )}

          {!store.loadingSessions && store.sessions.length > 0 && (
            <div className="py-1">
              {store.sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    store.sessionId === s.id
                      ? "bg-brand-canvas-soft-2"
                      : "hover:bg-brand-canvas-soft-2"
                  }`}
                >
                  <button
                    onClick={() => handleLoadSession(s.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="text-xs text-brand-ink truncate font-medium">
                      {s.title || "Untitled"}
                    </div>
                    <div className="text-[10px] text-brand-mute mt-0.5">
                      {formatRelativeTime(s.lastActivityAt)}
                      {s.messageCount > 0 && (
                        <> &middot; {s.messageCount} message{s.messageCount !== 1 ? "s" : ""}</>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {confirmDeleteId === s.id ? (
                      <span className="text-[10px] text-brand-error font-medium px-1.5 py-0.5 rounded-sm bg-brand-error-soft">
                        Confirm
                      </span>
                    ) : (
                      <Trash2 size={12} className="text-brand-mute hover:text-brand-error" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {!hasActiveSession ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-canvas border border-brand-hairline mx-auto mb-4">
                <FlaskConical size={22} className="text-brand-link" />
              </div>
              <h2 className="text-base font-semibold text-brand-ink tracking-[-0.02em] mb-1">
                Company Research.
              </h2>
              <p className="text-sm text-brand-body mb-1">
                Select a past session or start new research.
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
          >
            {store.entries.map((entry, i) => {
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
                      Ready. Send another message to continue.
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
                    onClick={() => toggleEntry(entry.callId)}
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

            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-brand-mute pt-1">
                <Loader2 size={14} className="animate-spin" />
                Working...
              </div>
            )}
          </div>
        )}

        <div className="border-t border-brand-hairline p-3 space-y-2">
          <div className="flex items-center gap-2">
            {hasModels ? (
              <>
                <Cpu size={14} className="text-brand-mute shrink-0" />
                <select
                  value={store.selectedModel}
                  onChange={(e) => store.setSelectedModel(e.target.value)}
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
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-brand-mute flex-1">
                <Cpu size={14} className="shrink-0" />
                <span>
                  <a href="/settings" className="text-brand-link hover:underline">
                    Configure a provider
                  </a>
                  {" "}in Settings to select a model.
                </span>
              </div>
            )}

            <button
              onClick={() => setInstructionsModalOpen(true)}
              className="relative shrink-0 p-1.5 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
              title="Research Instructions"
            >
              <Settings size={14} />
              {store.instructions && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-brand-link rounded-full" />
              )}
            </button>
          </div>

          {hasActiveSession && (store.status === "done" || store.status === "idle") && (
            <div className="flex gap-2">
              <button
                onClick={handleStartNew}
                className="flex items-center gap-1 text-xs text-brand-mute hover:text-brand-ink transition-colors"
              >
                <Plus size={12} />
                New session
              </button>
            </div>
          )}

          {hasModels && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={hasActiveSession ? "Send a follow-up message..." : "e.g. Research Stripe..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isRunning}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isRunning) handleSend();
                }}
                className="flex-1 bg-brand-canvas-soft-2 text-brand-ink text-xs px-2.5 py-1.5 rounded-sm border border-brand-hairline outline-none focus:border-brand-link transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={isRunning || !inputText.trim()}
                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-sm bg-brand-ink text-brand-on-primary hover:bg-brand-link transition-colors disabled:opacity-30"
              >
                {isRunning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {store.reportPanelOpen ? (
        <ReportPanel />
      ) : (
        <button
          onClick={store.openReportPanel}
          className="shrink-0 flex items-center justify-center w-8 border-l border-brand-hairline hover:bg-brand-canvas-soft-2 transition-colors group"
          title="Open Report"
        >
          <span
            className="text-[10px] font-medium text-brand-mute group-hover:text-brand-ink tracking-widest"
            style={{ writingMode: "vertical-rl" }}
          >
            REPORT
          </span>
        </button>
      )}

      {instructionsModalOpen && (
        <InstructionsModal
          open={instructionsModalOpen}
          onClose={() => setInstructionsModalOpen(false)}
        />
      )}
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

function formatRelativeTime(ts: number): string {
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
