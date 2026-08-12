import { create } from "zustand";
import { apiGet, apiPost, apiPatch, apiDelete, apiPut, startAutoTailor } from "../lib/api";
import { createSSEConnection } from "../lib/sse";
import type { Column, Application, Comment } from "../types";
import { apiUrl } from "../lib/api";

interface GeneratingStatus {
  sessionId: string;
  sessionToken: string;
  tailoredResumePath: string;
  step: string;
  toolCalls: number;
  error?: string;
}

const STEP_LABELS: Record<string, string> = {
  read_files: "Reading current resume...",
  web_fetch: "Fetching job description...",
  list_dir: "Analyzing project structure...",
  write_file: "Writing tailored resume...",
};

const activeConnections = new Map<string, { close: () => void }>();

interface KanbanStore {
  columns: Column[];
  applications: Record<string, Application>;
  loading: boolean;
  generatingCards: Set<string>;
  generatingStatus: Record<string, GeneratingStatus>;
  fetchBoard: () => Promise<void>;
  createApplication: (data: {
    company: string;
    role: string;
    jobUrl?: string;
    resumePath?: string;
    tags?: string[];
    columnId: string;
  }) => Promise<Application>;
  updateApplication: (
    id: string,
    data: Partial<
      Pick<
        Application,
        "company" | "role" | "jobUrl" | "resumePath" | "tags" | "columnId"
      >
    >,
  ) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  moveApplication: (columns: { id: string; applicationIds: string[] }[]) => Promise<void>;
  addComment: (applicationId: string, text: string) => Promise<void>;
  autoGenerateResume: (cardId: string) => Promise<void>;
  cancelAutoGenerate: (cardId: string) => void;
}

interface BoardResponse {
  columns: Column[];
  applications: Record<string, Application>;
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  columns: [],
  applications: {},
  loading: false,
  generatingCards: new Set(),
  generatingStatus: {},

  fetchBoard: async () => {
    set({ loading: true });
    const data = await apiGet<BoardResponse>("/api/kanban");
    set({ columns: data.columns, applications: data.applications, loading: false });
  },

  createApplication: async (data) => {
    const application = await apiPost<Application>("/api/kanban/applications", data);
    set((state) => ({
      applications: { ...state.applications, [application.id]: application },
      columns: state.columns.map((col) =>
        col.id === application.columnId
          ? { ...col, applicationIds: [...col.applicationIds, application.id] }
          : col,
      ),
    }));
    return application;
  },

  updateApplication: async (id, data) => {
    const updated = await apiPatch<Application>(`/api/kanban/applications/${id}`, data);
    set((state) => ({
      applications: { ...state.applications, [id]: updated },
    }));
  },

  deleteApplication: async (id) => {
    await apiDelete(`/api/kanban/applications/${id}`);
    set((state) => {
      const { [id]: _removed, ...rest } = state.applications;
      return {
        applications: rest,
        columns: state.columns.map((col) => ({
          ...col,
          applicationIds: col.applicationIds.filter((aid) => aid !== id),
        })),
      };
    });
  },

  moveApplication: async (columns) => {
    set((state) => {
      const newApplications = { ...state.applications };
      for (const col of columns) {
        for (let i = 0; i < col.applicationIds.length; i++) {
          const applicationId = col.applicationIds[i];
          if (newApplications[applicationId]) {
            newApplications[applicationId] = {
              ...newApplications[applicationId],
              columnId: col.id,
              position: i,
            };
          }
        }
      }
      return {
        applications: newApplications,
        columns: state.columns.map((col) => {
          const updated = columns.find((c) => c.id === col.id);
          return updated ? { ...col, applicationIds: updated.applicationIds } : col;
        }),
      };
    });

    await apiPut("/api/kanban", { columns });
  },

  addComment: async (applicationId, text) => {
    const comment = await apiPost<Comment>(
      `/api/kanban/applications/${applicationId}/comments`,
      { text },
    );
    set((state) => {
      const application = state.applications[applicationId];
      if (!application) return state;
      return {
        applications: {
          ...state.applications,
          [applicationId]: { ...application, comments: [...application.comments, comment] },
        },
      };
    });
  },

  autoGenerateResume: async (cardId) => {
    const state = get();
    if (state.generatingCards.has(cardId)) return;

    try {
      const { sessionId, sessionToken, tailoredResumePath } = await startAutoTailor(cardId);

      set((s) => ({
        generatingCards: new Set(s.generatingCards).add(cardId),
        generatingStatus: {
          ...s.generatingStatus,
          [cardId]: { sessionId, sessionToken, tailoredResumePath, step: "Starting...", toolCalls: 0 },
        },
      }));

      const connection = createSSEConnection(
        apiUrl(`/api/agent/sessions/${sessionId}/stream?token=${sessionToken}`),
        {
          onToolCall: (data) => {
            set((s) => {
              const status = s.generatingStatus[cardId];
              if (!status) return s;
              return {
                generatingStatus: {
                  ...s.generatingStatus,
                  [cardId]: { ...status, step: STEP_LABELS[data.tool] || "Working...", toolCalls: status.toolCalls + 1 },
                },
              };
            });
          },
          onDone: async () => {
            const current = get();
            const status = current.generatingStatus[cardId];
            if (!status) return;

            activeConnections.delete(cardId);

            await apiPatch(`/api/kanban/applications/${cardId}`, { resumePath: status.tailoredResumePath });

            const doneCards = new Set(get().generatingCards);
            doneCards.delete(cardId);
            const { [cardId]: _, ...restStatus } = get().generatingStatus;

            set({
              generatingCards: doneCards,
              generatingStatus: restStatus,
              applications: {
                ...get().applications,
                [cardId]: { ...get().applications[cardId], resumePath: status.tailoredResumePath },
              },
            });
          },
          onError: (error) => {
            activeConnections.delete(cardId);
            set((s) => {
              const status = s.generatingStatus[cardId];
              if (!status) return s;
              return {
                generatingStatus: {
                  ...s.generatingStatus,
                  [cardId]: { ...status, step: error, error },
                },
              };
            });
          },
        },
      );

      activeConnections.set(cardId, connection);
    } catch (err) {
      set((s) => {
        const doneCards = new Set(s.generatingCards);
        doneCards.delete(cardId);
        const { [cardId]: _, ...restStatus } = s.generatingStatus;
        return {
          generatingCards: doneCards,
          generatingStatus: {
            ...restStatus,
            [cardId]: {
              sessionId: "",
              sessionToken: "",
              tailoredResumePath: "",
              step: err instanceof Error ? err.message : "Failed to start generation",
              toolCalls: 0,
              error: err instanceof Error ? err.message : "Failed to start generation",
            },
          },
        };
      });
    }
  },

  cancelAutoGenerate: (cardId) => {
    const conn = activeConnections.get(cardId);
    if (conn) {
      conn.close();
      activeConnections.delete(cardId);
    }
    const doneCards = new Set(get().generatingCards);
    doneCards.delete(cardId);
    const { [cardId]: _, ...restStatus } = get().generatingStatus;
    set({ generatingCards: doneCards, generatingStatus: restStatus });
  },
}));
