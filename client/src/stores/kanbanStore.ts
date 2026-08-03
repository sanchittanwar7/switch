import { create } from "zustand";
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from "../lib/api";
import type { Column, Application, Comment } from "../types";

interface KanbanStore {
  columns: Column[];
  applications: Record<string, Application>;
  loading: boolean;
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
}

interface BoardResponse {
  columns: Column[];
  applications: Record<string, Application>;
}

export const useKanbanStore = create<KanbanStore>((set) => ({
  columns: [],
  applications: {},
  loading: false,

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
}));
