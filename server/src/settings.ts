import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "./utils/paths";

export const LLM_PROVIDERS = ["openai", "gemini", "claude", "deepseek", "qwen"] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

export const PROVIDER_DEFAULTS: Record<LLMProvider, { baseUrl: string; model: string }> = {
  openai:    { baseUrl: "https://api.openai.com/v1",      model: "gpt-5.2" },
  gemini:    { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.1-pro" },
  claude:    { baseUrl: "https://api.anthropic.com/v1",   model: "claude-sonnet-5" },
  deepseek:  { baseUrl: "https://api.deepseek.com/v1",    model: "deepseek-v4-flash" },
  qwen:      { baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model: "qwen3.6-plus" },
};

export interface LLMSettings {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface Settings {
  llm: LLMSettings;
  workspaceRoot?: string;
}

const DEFAULT_SETTINGS: Settings = {
  llm: {
    provider: "openai",
    apiKey: "",
    baseUrl: PROVIDER_DEFAULTS.openai.baseUrl,
    model: PROVIDER_DEFAULTS.openai.model,
  },
  workspaceRoot: getWorkspaceRoot(),
};

function settingsPath(): string {
  return path.join(getWorkspaceRoot(), "settings.json");
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const merged = {
    ...current,
    ...partial,
    llm: { ...current.llm, ...(partial.llm || {}) },
  };
  await fs.writeFile(settingsPath(), JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
