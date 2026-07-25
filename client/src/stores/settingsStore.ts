import { create } from "zustand";
import { apiGet, apiPut } from "../lib/api";

export interface SettingsData {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface SettingsStore {
  settings: SettingsData | null;
  loading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  saveSettings: (data: Partial<SettingsData>) => Promise<SettingsData>;
  clearError: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  loading: false,
  error: null,

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

  clearError: () => set({ error: null }),
}));
