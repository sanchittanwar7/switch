import { create } from "zustand";
import { apiGet, apiPut, apiPost, apiDelete, getDefaultResume, setDefaultResume as setDefaultResumeApi } from "../lib/api";

export interface SettingsData {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  shareQuestions: boolean;
}

export interface ProviderConfig {
  id: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
  defaultModel: string | null;
}

export interface AvailableModel {
  provider: string;
  providerId: string;
  models: string[];
  defaultModel: string | null;
}

interface SettingsStore {
  settings: SettingsData | null;
  providers: ProviderConfig[];
  availableModels: AvailableModel[];
  loading: boolean;
  error: string | null;
  defaultResumeName: string | null;
  availableResumes: { name: string }[];
  loadSettings: () => Promise<void>;
  saveSettings: (data: Partial<SettingsData>) => Promise<SettingsData>;
  loadProviders: () => Promise<void>;
  addProvider: (provider: string, apiKey: string) => Promise<ProviderConfig>;
  deleteProvider: (id: string) => Promise<void>;
  loadAvailableModels: () => Promise<void>;
  setDefaultModel: (providerId: string, model: string | null) => Promise<void>;
  loadDefaultResume: () => Promise<void>;
  setDefaultResume: (name: string | null) => Promise<void>;
  clearError: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  providers: [],
  availableModels: [],
  loading: false,
  error: null,
  defaultResumeName: null,
  availableResumes: [],

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiGet<SettingsData>("/api/settings");
      set({
        settings: data,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load settings",
      });
    }
  },

  saveSettings: async (data) => {
    set({ error: null });
    const saved = await apiPut<SettingsData>("/api/settings", data);
    set({ settings: saved });
    return saved;
  },

  loadProviders: async () => {
    set({ loading: true, error: null });
    try {
      const providers = await apiGet<ProviderConfig[]>("/api/settings/providers");
      set({ providers, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load providers",
      });
    }
  },

  addProvider: async (provider, apiKey) => {
    set({ error: null });
    const created = await apiPost<ProviderConfig>("/api/settings/providers", {
      provider,
      apiKey,
    });
    set((state) => ({ providers: [...state.providers, created] }));
    return created;
  },

  deleteProvider: async (id) => {
    set({ error: null });
    await apiDelete(`/api/settings/providers/${id}`);
    set((state) => ({
      providers: state.providers.filter((p) => p.id !== id),
    }));
  },

  loadAvailableModels: async () => {
    try {
      const models = await apiGet<AvailableModel[]>("/api/settings/models");
      set({ availableModels: models });
    } catch {
      // non-critical, fall through silently
    }
  },

  setDefaultModel: async (providerId, model) => {
    set({ error: null });
    const updated = await apiPut<ProviderConfig>(`/api/settings/providers/${providerId}/default-model`, { model });
    set((state) => ({
      providers: state.providers.map((p) =>
        p.id === providerId ? updated : p,
      ),
      availableModels: state.availableModels.map((am) =>
        am.providerId === providerId ? { ...am, defaultModel: updated.defaultModel } : am,
      ),
    }));
  },

  loadDefaultResume: async () => {
    try {
      const data = await getDefaultResume();
      set({ defaultResumeName: data.defaultResumeName, availableResumes: data.resumes });
    } catch {
      // non-critical
    }
  },

  setDefaultResume: async (name) => {
    set({ error: null });
    await setDefaultResumeApi(name);
    set({ defaultResumeName: name });
  },

  clearError: () => set({ error: null }),
}));
