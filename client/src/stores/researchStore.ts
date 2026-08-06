import { create } from "zustand";
import { apiGet, apiPost, apiPut, apiDelete, apiUrl } from "../lib/api";
import type { ResearchSessionSummary, ResearchSessionDetail, ResearchReport, AgentMessage } from "../types";

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

interface ResearchStore {
  sessions: ResearchSessionSummary[];
  loadingSessions: boolean;

  sessionId: string | null;
  sessionToken: string | null;
  title: string;

  entries: LogEntry[];
  status: "idle" | "running" | "done" | "error";

  reportContent: string;
  reportLastModified: number | null;
  reportPanelOpen: boolean;
  loadingReport: boolean;

  instructions: string | null;
  loadingInstructions: boolean;

  selectedModel: string;

  loadSessions: () => Promise<void>;
  createSession: (message: string, provider?: string, model?: string) => Promise<{ sessionId: string; sessionToken: string }>;
  loadSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  connectSSE: (id: string, token: string) => void;
  startNewSession: () => void;

  openReportPanel: () => void;
  closeReportPanel: () => void;
  loadReport: () => Promise<void>;

  loadInstructions: () => Promise<void>;
  saveInstructions: (instructions: string | null) => Promise<void>;

  setSelectedModel: (model: string) => void;
}

const LS_SESSIONS_KEY = "switch_research_sessions";
const LS_LAST_KEY = "switch_research_last";

function loadTokensFromStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTokensToStorage(tokens: Record<string, string>): void {
  try {
    localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(tokens));
  } catch {
    // ignore quota errors
  }
}

function loadLastSessionFromStorage(): { sessionId: string; sessionToken: string } | null {
  try {
    const raw = localStorage.getItem(LS_LAST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastSessionToStorage(sessionId: string, sessionToken: string): void {
  try {
    localStorage.setItem(LS_LAST_KEY, JSON.stringify({ sessionId, sessionToken }));
  } catch {
    // ignore quota errors
  }
}

let eventSourceRef: EventSource | null = null;

export const useResearchStore = create<ResearchStore>((set, get) => ({
  sessions: [],
  loadingSessions: false,

  sessionId: null,
  sessionToken: null,
  title: "",

  entries: [],
  status: "idle",

  reportContent: "",
  reportLastModified: null,
  reportPanelOpen: false,
  loadingReport: false,

  instructions: null,
  loadingInstructions: false,

  selectedModel: "",

  loadSessions: async () => {
    set({ loadingSessions: true });
    try {
      const data = await apiGet<ResearchSessionSummary[]>("/api/research/sessions");
      set({ sessions: data });
    } catch {
      // ignore
    } finally {
      set({ loadingSessions: false });
    }
  },

  createSession: async (message, provider, model) => {
    const body: Record<string, unknown> = { message };
    if (provider) body.provider = provider;
    if (model) body.model = model;

    const result = await apiPost<{ sessionId: string; sessionToken: string }>(
      "/api/research/sessions",
      body,
    );

    const { sessionId, sessionToken } = result;

    const tokens = loadTokensFromStorage();
    tokens[sessionId] = sessionToken;
    saveTokensToStorage(tokens);
    saveLastSessionToStorage(sessionId, sessionToken);

    set({
      sessionId,
      sessionToken,
      title: message.slice(0, 80),
      entries: [{ type: "user_text", text: message }],
      status: "idle",
    });

    get().loadSessions();
    return result;
  },

  loadSession: async (id) => {
    const tokens = loadTokensFromStorage();
    const token = tokens[id];

    if (!token) return;

    try {
      const session = await apiGet<ResearchSessionDetail>(`/api/research/sessions/${id}`);

      const entries: LogEntry[] = session.messages.map((m: AgentMessage) => {
        if (m.role === "user") return { type: "user_text", text: m.content };
        if (m.role === "assistant") return { type: "agent_text", text: m.content };
        if (m.role === "tool_call") {
          const args = m.toolInput || {};
          return {
            type: "tool_entry",
            callId: m.toolCallId || "",
            tool: m.toolName || "",
            args,
            result: null,
            expanded: false,
          };
        }
        if (m.role === "tool_result") {
          return {
            type: "tool_entry",
            callId: m.toolCallId || "",
            tool: m.toolName || "",
            args: null,
            result: m.content || null,
            expanded: false,
          };
        }
        return { type: "agent_text", text: m.content };
      });

      saveLastSessionToStorage(id, token);

      set({
        sessionId: id,
        sessionToken: token,
        title: session.title,
        entries,
        status: "idle",
        reportPanelOpen: false,
        reportContent: "",
        reportLastModified: null,
      });
    } catch {
      // session not found or expired
    }
  },

  deleteSession: async (id) => {
    const tokens = loadTokensFromStorage();
    const token = tokens[id];

    if (!token) return;

    try {
      await apiDelete(`/api/research/sessions/${id}`, { token });

      delete tokens[id];
      saveTokensToStorage(tokens);

      const { sessionId } = get();
      if (sessionId === id) {
        set({
          sessionId: null,
          sessionToken: null,
          title: "",
          entries: [],
          status: "idle",
        });
      }

      get().loadSessions();
    } catch {
      // ignore
    }
  },

  sendMessage: async (message) => {
    const { sessionId, sessionToken } = get();
    if (!sessionId || !sessionToken) return;

    set((s) => ({
      entries: [...s.entries, { type: "user_text", text: message }],
    }));

    await apiPost(`/api/research/sessions/${sessionId}/messages`, {
      message,
      token: sessionToken,
    });
  },

  connectSSE: (id, token) => {
    if (eventSourceRef) {
      eventSourceRef.close();
      eventSourceRef = null;
    }

    set({ status: "running" });

    const es = new EventSource(
      apiUrl(`/api/research/sessions/${id}/stream?token=${encodeURIComponent(token)}`),
    );
    eventSourceRef = es;

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
        set((s) => ({ entries: [...s.entries, entry] }));
      } catch { /* ignore */ }
    });

    es.addEventListener("tool_result", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        set((s) => {
          const entries = [...s.entries];
          const idx = entries.findIndex(
            (entry) => entry.type === "tool_entry" && entry.callId === data.id,
          );
          if (idx === -1) return s;
          const existing = entries[idx] as ToolEntry;
          entries[idx] = { ...existing, result: data.summary || "" };
          return { entries };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("message", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const chunk = data.content || "";
        if (!chunk) return;
        set((s) => {
          const entries = [...s.entries];
          const last = entries[entries.length - 1];
          if (last && last.type === "agent_text") {
            entries[entries.length - 1] = { ...last, text: last.text + chunk };
            return { entries };
          }
          entries.push({ type: "agent_text", text: chunk });
          return { entries };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener("error", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        set((s) => ({
          entries: [...s.entries, { type: "error", content: data.message || "Unknown error" }],
          status: "error",
        }));
      } catch {
        set((s) => ({
          entries: [...s.entries, { type: "error", content: "Stream error" }],
          status: "error",
        }));
      }
      es.close();
      eventSourceRef = null;
      set((s) => ({
        entries: s.entries.map((entry) =>
          entry.type === "tool_entry" && entry.result === null
            ? { ...entry, result: "(No result received)" }
            : entry,
        ),
      }));
    });

    es.addEventListener("done", () => {
      set((s) => ({
        entries: s.entries.map((entry) =>
          entry.type === "tool_entry" && entry.result === null
            ? { ...entry, result: "(No result received)" }
            : entry,
        ),
      }));
      set((s) => ({ entries: [...s.entries, { type: "done" }], status: "done" }));
      es.close();
      eventSourceRef = null;

      const { reportPanelOpen } = get();
      if (reportPanelOpen) {
        get().loadReport();
      }
    });
  },

  startNewSession: () => {
    if (eventSourceRef) {
      eventSourceRef.close();
      eventSourceRef = null;
    }
    set({
      sessionId: null,
      sessionToken: null,
      title: "",
      entries: [],
      status: "idle",
      reportContent: "",
      reportLastModified: null,
      reportPanelOpen: false,
    });
  },

  openReportPanel: () => {
    set({ reportPanelOpen: true });
    get().loadReport();
  },

  closeReportPanel: () => {
    set({ reportPanelOpen: false });
  },

  loadReport: async () => {
    const { sessionId } = get();
    if (!sessionId) return;

    set({ loadingReport: true });
    try {
      const data = await apiGet<ResearchReport>(`/api/research/sessions/${sessionId}/report`);
      set({
        reportContent: data.content,
        reportLastModified: data.lastModified,
      });
    } catch {
      // ignore
    } finally {
      set({ loadingReport: false });
    }
  },

  loadInstructions: async () => {
    set({ loadingInstructions: true });
    try {
      const data = await apiGet<{ instructions: string | null }>("/api/research/instructions");
      set({ instructions: data.instructions });
    } catch {
      // ignore
    } finally {
      set({ loadingInstructions: false });
    }
  },

  saveInstructions: async (instructions) => {
    const data = await apiPut<{ instructions: string | null }>("/api/research/instructions", {
      instructions,
    });
    set({ instructions: data.instructions });
  },

  setSelectedModel: (model) => {
    set({ selectedModel: model });
  },
}));
