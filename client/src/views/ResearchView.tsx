import { useEffect, useRef, useState, useMemo } from "react";
import {
  Send, Loader2, CircleStop, CheckCircle, XCircle, Wrench, Bot, ChevronRight,
  Cpu, Plus, Trash2, FlaskConical, Settings, PanelLeft, Star,
} from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!inputText && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputText]);

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

  const handleStop = () => {
    store.stopSSE();
  };

  const handleStartNew = () => {
    store.startNewSession();
    setInputText("");
  };

  const insertWishlistTemplate = () => {
    setInputText(`Add following job to my wishlist:
Company: <COMPANY_NAME>
Role: <ROLE_NAME>
Job URL: <JOB_URL>
Tags: <COMMA_SEPARATED_TAGS>`);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
      el?.focus();
    });
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

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  if (showWelcome) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-canvas-soft">
        <div className="text-center w-full px-8">
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
            <div className="px-[15%]">
              <div className="w-full flex flex-col gap-1 bg-brand-canvas border border-brand-hairline rounded-xl focus-within:border-brand-link focus-within:ring-2 focus-within:ring-brand-link/20 transition-colors p-2">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="e.g. Research Stripe..."
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  const el = textareaRef.current;
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                  }
                }}
                disabled={isRunning}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isRunning) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="w-full bg-transparent text-brand-ink text-sm px-1 outline-none resize-none placeholder:text-brand-mute disabled:opacity-50"
              />

              <div className="flex items-center gap-1 self-end">
                <select
                  value={store.selectedModel}
                  onChange={(e) => store.setSelectedModel(e.target.value)}
                  className="shrink-0 bg-transparent text-brand-ink text-xs px-2 h-8 outline-none max-w-[160px] truncate rounded-sm hover:bg-brand-canvas-soft-2 transition-colors"
                >
                  {availableModels.map((group) => (
                    <optgroup key={group.provider} label={group.provider.toUpperCase()}>
                      {group.models.map((m) => (
                        <option key={`${group.provider}-${m}`} value={m}>
                          {m.split("/").pop()}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <button
                  onClick={() => setInstructionsModalOpen(true)}
                  className="relative shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
                  title="Research Instructions"
                >
                  <Settings size={16} />
                  {store.instructions && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-brand-link rounded-full" />
                  )}
                </button>

                {isRunning ? (
                  <button
                    onClick={handleStop}
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-brand-mute hover:text-brand-error hover:bg-brand-error-soft transition-colors"
                  >
                    <CircleStop size={15} />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors disabled:opacity-30"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>
            </div>
          )}
        </div>
        {instructionsModalOpen && (
          <InstructionsModal
            open={instructionsModalOpen}
            onClose={() => setInstructionsModalOpen(false)}
          />
        )}
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

      <div className="flex-1 min-w-0">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={store.reportPanelOpen ? 70 : 100} minSize={30}>
            <div className="h-full flex flex-col">
              {!hasActiveSession ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center w-full max-w-2xl px-8">
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-canvas border border-brand-hairline mx-auto mb-6">
                      <FlaskConical size={28} className="text-brand-link" />
                    </div>
                    <h2 className="text-lg font-semibold text-brand-ink tracking-[-0.02em] mb-2">
                      Research companies.
                    </h2>
                    <p className="text-sm text-brand-body mb-8">
                      Research companies to prepare for interviews. The agent gathers information from the web and builds a structured report.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  ref={logRef}
                  className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
                >
                  {(() => {
                    const toolGroups: { type: "tool_group"; key: string; entries: typeof store.entries }[] = [];
                    const items: (typeof store.entries[number] | typeof toolGroups[number])[] = [];
                    let group: typeof store.entries = [];

                    const flushGroup = () => {
                      if (group.length === 0) return;
                      if (group.length === 1) {
                        items.push(group[0]);
                      } else {
                        items.push({ type: "tool_group", key: `group_${(group[0] as any).callId}`, entries: [...group] });
                      }
                      group = [];
                    };

                    for (const entry of store.entries) {
                      if (entry.type === "tool_entry") {
                        group.push(entry);
                      } else {
                        flushGroup();
                        items.push(entry);
                      }
                    }
                    flushGroup();

                    return items.map((item, i) => {
                    if ("type" in item && item.type === "tool_group") {
                      const groupKey = item.key;
                      const groupExpanded = expandedGroups.has(groupKey);
                      const pendingCount = item.entries.filter((e) => (e as any).result === null).length;

                      return (
                        <div key={groupKey}>
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            className="flex items-center gap-2 w-full text-left group"
                          >
                            <span className={`shrink-0 transition-transform ${groupExpanded ? "rotate-90" : ""}`}>
                              <ChevronRight size={12} className="text-brand-mute" />
                            </span>
                            <Wrench size={12} className="text-brand-link shrink-0" />
                            <span className="text-xs text-brand-ink font-medium">
                              {item.entries.length} tools
                            </span>
                            {!groupExpanded && (
                              <span className="text-xs text-brand-mute truncate">
                                {item.entries.map((e) => (e as any).tool).join(", ")}
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span className="text-[10px] text-brand-link shrink-0">
                                ({pendingCount} running)
                              </span>
                            )}
                          </button>

                          {groupExpanded && (
                            <div className="ml-5 space-y-1">
                              {item.entries.map((entry) => {
                                const e = entry as any;
                                const pending = e.result === null;
                                return (
                                  <div key={e.callId}>
                                    <button
                                      onClick={() => toggleEntry(e.callId)}
                                      className="flex items-center gap-2 w-full text-left group"
                                    >
                                      <span className={`shrink-0 transition-transform ${e.expanded ? "rotate-90" : ""}`}>
                                        <ChevronRight size={10} className="text-brand-mute" />
                                      </span>
                                      {pending ? (
                                        <Loader2 size={10} className="animate-spin text-brand-link shrink-0" />
                                      ) : (
                                        <Wrench size={10} className="text-brand-link shrink-0" />
                                      )}
                                      <span className="text-xs text-brand-ink font-medium min-w-0 truncate">
                                        {e.tool}
                                      </span>
                                      {!pending && !e.expanded && (
                                        <span className="text-xs text-brand-mute truncate">
                                          {truncateResult(e.result)}
                                        </span>
                                      )}
                                    </button>

                                    {e.expanded && (
                                      <div className="ml-5 mt-1 space-y-1.5">
                                        {e.args !== undefined && e.args !== null && (
                                          <div className="bg-brand-canvas-soft-2 rounded-sm border border-brand-hairline p-2">
                                            <div className="text-xs text-brand-mute mb-0.5 font-medium">
                                              Arguments
                                            </div>
                                            <pre className="text-xs text-brand-body whitespace-pre-wrap break-all font-mono">
                                              {formatArgs(e.args)}
                                            </pre>
                                          </div>
                                        )}
                                        {e.result !== null && (
                                          <div className="bg-brand-canvas-soft-2 rounded-sm border border-brand-hairline p-2">
                                            <div className="text-xs text-brand-mute mb-0.5 font-medium">
                                              Result
                                            </div>
                                            <pre className="text-xs text-brand-body whitespace-pre-wrap break-all font-mono">
                                              {e.result}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (item.type === "error") {
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <XCircle size={14} className="text-brand-error shrink-0 mt-0.5" />
                          <span className="text-xs text-brand-error">{item.content}</span>
                        </div>
                      );
                    }

                    if (item.type === "user_text") {
                      return (
                        <div key={i} className="flex justify-end">
                          <div className="bg-brand-canvas rounded-lg border border-brand-hairline px-3 py-2 max-w-[85%]">
                            <span className="text-xs text-brand-ink whitespace-pre-wrap">{item.text}</span>
                          </div>
                        </div>
                      );
                    }

                    if (item.type === "done") {
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle size={14} className="text-brand-link shrink-0 mt-0.5" />
                          <span className="text-xs text-brand-link font-medium">
                            Ready. Send another message to continue.
                          </span>
                        </div>
                      );
                    }

                    if (item.type === "agent_text") {
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <Bot size={14} className="text-brand-link shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <MarkdownRenderer content={item.text} />
                          </div>
                        </div>
                      );
                    }

                    const e = item as any;
                    const pending = e.result === null;

                    return (
                      <div key={e.callId}>
                        <button
                          onClick={() => toggleEntry(e.callId)}
                          className="flex items-center gap-2 w-full text-left group"
                        >
                          <span
                            className={`shrink-0 transition-transform ${
                              e.expanded ? "rotate-90" : ""
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
                            {e.tool}
                          </span>
                          {!pending && !e.expanded && (
                            <span className="text-xs text-brand-mute truncate">
                              {truncateResult(e.result)}
                            </span>
                          )}
                        </button>

                        {e.expanded && (
                          <div className="ml-5 mt-1 space-y-1.5">
                            {e.args !== undefined && e.args !== null && (
                              <div className="bg-brand-canvas-soft-2 rounded-sm border border-brand-hairline p-2">
                                <div className="text-xs text-brand-mute mb-0.5 font-medium">
                                  Arguments
                                </div>
                                <pre className="text-xs text-brand-body whitespace-pre-wrap break-all font-mono">
                                  {formatArgs(e.args)}
                                </pre>
                              </div>
                            )}
                            {e.result !== null && (
                              <div className="bg-brand-canvas-soft-2 rounded-sm border border-brand-hairline p-2">
                                <div className="text-xs text-brand-mute mb-0.5 font-medium">
                                  Result
                                </div>
                                <pre className="text-xs text-brand-body whitespace-pre-wrap break-all font-mono">
                                  {e.result}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });})()}

                  {isRunning && (
                    <div className="flex items-center gap-2 text-xs text-brand-mute pt-1">
                      <Loader2 size={14} className="animate-spin" />
                      Working...
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-brand-hairline p-3 space-y-2">
                  {!hasModels && (
                    <div className="flex items-center gap-2 text-xs text-brand-mute">
                      <Cpu size={14} className="shrink-0" />
                      <span>
                        <a href="/settings" className="text-brand-link hover:underline">
                          Configure a provider
                        </a>
                        {" "}in Settings to select a model.
                      </span>
                    </div>
                  )}

                  {hasModels && (
                    <div className="px-[15%]">
                      <div className="w-full flex flex-col gap-1 bg-brand-canvas border border-brand-hairline rounded-xl focus-within:border-brand-link focus-within:ring-2 focus-within:ring-brand-link/20 transition-colors p-2">
                      <textarea
                        ref={textareaRef}
                        rows={1}
                        placeholder={hasActiveSession ? "Send a follow-up message..." : "e.g. Research Stripe..."}
                        value={inputText}
                        onChange={(e) => {
                          setInputText(e.target.value);
                          const el = textareaRef.current;
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }
                        }}
                        disabled={isRunning}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !isRunning) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        className="w-full bg-transparent text-brand-ink text-sm px-1 outline-none resize-none placeholder:text-brand-mute disabled:opacity-50"
                      />

                      <div className="flex items-center gap-1 self-end">
                        <select
                          value={store.selectedModel}
                          onChange={(e) => store.setSelectedModel(e.target.value)}
                          className="shrink-0 bg-transparent text-brand-ink text-xs px-2 h-8 outline-none max-w-[160px] truncate rounded-sm hover:bg-brand-canvas-soft-2 transition-colors"
                        >
                          {availableModels.map((group) => (
                            <optgroup key={group.provider} label={group.provider.toUpperCase()}>
                              {group.models.map((m) => (
                                <option key={`${group.provider}-${m}`} value={m}>
                                  {m.split("/").pop()}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>

                        <button
                          onClick={() => setInstructionsModalOpen(true)}
                          className="relative shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
                          title="Research Instructions"
                        >
                          <Settings size={16} />
                          {store.instructions && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-link rounded-full" />
                          )}
                        </button>

                        {isRunning ? (
                          <button
                            onClick={handleStop}
                            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-brand-mute hover:text-brand-error hover:bg-brand-error-soft transition-colors"
                          >
                            <CircleStop size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={handleSend}
                            disabled={!inputText.trim()}
                            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors disabled:opacity-30"
                          >
                            <Send size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    {hasActiveSession && (store.status === "done" || store.status === "idle") && (
                      <div className="flex justify-center mt-2">
                        <button
                          onClick={insertWishlistTemplate}
                          className="flex items-center gap-1.5 text-xs text-brand-body bg-brand-canvas border border-brand-hairline hover:border-brand-hairline-strong hover:text-brand-ink rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          <Star size={12} />
                          Add job to wishlist
                        </button>
                      </div>
                    )}
                    </div>
                  )}
                </div>
            </div>
          </Panel>

          {store.reportPanelOpen ? (
            <>
              <PanelResizeHandle className="w-px bg-brand-hairline hover:bg-brand-link active:bg-brand-link transition-colors cursor-col-resize" />
              <Panel defaultSize={30} minSize={15}>
                <ReportPanel onCollapse={store.closeReportPanel} />
              </Panel>
            </>
          ) : (
            <div className="w-8 shrink-0 flex items-start pt-4 border-l border-brand-hairline bg-brand-canvas-soft">
              <button
                onClick={store.openReportPanel}
                className="p-1 text-brand-mute hover:text-brand-ink rounded-sm transition-colors"
                title="Show report"
              >
                <PanelLeft size={14} className="rotate-180" />
              </button>
            </div>
          )}
        </PanelGroup>
      </div>

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
