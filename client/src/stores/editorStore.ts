import { create } from "zustand";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";
import type { FileEntry, LaTeXError } from "../types";

interface EditorStore {
  activeFile: string | null;
  openFiles: string[];
  fileContents: Record<string, string>;
  fileTree: FileEntry[];
  isDirty: boolean;
  compileStatus: "idle" | "compiling" | "success" | "error";
  compileErrors: LaTeXError[];
  pdfUrl: string | null;
  agentSession: {
    sessionId: string;
    sessionToken: string;
    status: string;
  } | null;

  setActiveFile: (path: string) => void;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  fetchFileTree: (dir?: string) => Promise<void>;
  createFile: (path: string, content?: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  renameEntry: (oldPath: string, newPath: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  compile: (projectPath: string) => Promise<void>;
  setPdfUrl: (url: string | null) => void;
  startAgentSession: (
    jobUrl: string,
    resumeProjectPath: string,
  ) => Promise<{ sessionId: string; sessionToken: string }>;
  endAgentSession: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  activeFile: null,
  openFiles: [],
  fileContents: {},
  fileTree: [],
  isDirty: false,
  compileStatus: "idle",
  compileErrors: [],
  pdfUrl: null,
  agentSession: null,

  setActiveFile: (path) => {
    set({ activeFile: path, isDirty: false });
  },

  openFile: async (path) => {
    const { fileContents, openFiles } = get();
    if (!fileContents[path]) {
      const { content } = await apiGet<{ content: string }>(
        `/api/fs/read?file=${encodeURIComponent(path)}`,
      );
      set((s) => ({
        fileContents: { ...s.fileContents, [path]: content },
      }));
    }
    if (!openFiles.includes(path)) {
      set({ openFiles: [...openFiles, path], activeFile: path });
    } else {
      set({ activeFile: path });
    }
  },

  closeFile: (path) => {
    const { openFiles, activeFile, fileContents } = get();
    const newOpenFiles = openFiles.filter((f) => f !== path);
    const { [path]: _removed, ...rest } = fileContents;
    set({
      openFiles: newOpenFiles,
      fileContents: rest,
      activeFile:
        activeFile === path
          ? newOpenFiles[newOpenFiles.length - 1] || null
          : activeFile,
    });
  },

  setFileContent: (path, content) => {
    set((s) => ({
      fileContents: { ...s.fileContents, [path]: content },
      isDirty: true,
    }));
  },

  saveFile: async (path) => {
    const content = get().fileContents[path];
    if (content === undefined) return;
    await apiPut("/api/fs/write", { path, content });
    set({ isDirty: false });
  },

  fetchFileTree: async (dir = "") => {
    const data = await apiGet<FileEntry[]>(
      `/api/fs/list?dir=${encodeURIComponent(dir)}`,
    );
    set({ fileTree: data });
  },

  createFile: async (path, content = "") => {
    await apiPut("/api/fs/write", { path, content });
    await get().fetchFileTree();
  },

  createFolder: async (path) => {
    await apiPost("/api/fs/mkdir", { path });
    await get().fetchFileTree();
  },

  deleteEntry: async (path) => {
    await apiDelete("/api/fs/delete", { path });
    await get().fetchFileTree();
  },

  renameEntry: async (oldPath, newPath) => {
    await apiPost("/api/fs/rename", { oldPath, newPath });
    set((s) => ({
      fileContents: renameKey(s.fileContents, oldPath, newPath),
      openFiles: s.openFiles.map((f) => (f === oldPath ? newPath : f)),
      activeFile: s.activeFile === oldPath ? newPath : s.activeFile,
    }));
    await get().fetchFileTree();
  },

  readFile: async (path) => {
    const { content } = await apiGet<{ content: string }>(
      `/api/fs/read?file=${encodeURIComponent(path)}`,
    );
    set((s) => ({
      fileContents: { ...s.fileContents, [path]: content },
    }));
    return content;
  },

  compile: async (projectPath) => {
    set({ compileStatus: "compiling", compileErrors: [] });
    try {
      const result = await apiPost<{
        success: boolean;
        pdfPath?: string;
        errors?: LaTeXError[];
      }>("/api/latex/compile", { projectPath });
      if (result.success && result.pdfPath) {
        set({
          compileStatus: "success",
          pdfUrl: `/pdfs/${encodeURIComponent(result.pdfPath)}`,
        });
      } else {
        set({ compileStatus: "error", compileErrors: result.errors || [] });
      }
    } catch {
      set({ compileStatus: "error" });
    }
  },

  setPdfUrl: (url) => set({ pdfUrl: url }),

  startAgentSession: async (jobUrl, resumeProjectPath) => {
    const result = await apiPost<{
      sessionId: string;
      sessionToken: string;
    }>("/api/agent/tailor", { jobUrl, resumeProjectPath });
    set({ agentSession: { ...result, status: "running" } });
    return result;
  },

  endAgentSession: () => set({ agentSession: null }),
}));

function renameKey<T extends Record<string, unknown>>(
  obj: T,
  oldKey: string,
  newKey: string,
): T {
  if (!(oldKey in obj)) return obj;
  const { [oldKey]: value, ...rest } = obj as Record<string, unknown>;
  return { ...rest, [newKey]: value } as T;
}
