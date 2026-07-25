import { eq } from "drizzle-orm";
import { db } from "./db";
import { userSettings } from "./db/schema";
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

const DEFAULT_LLM: LLMSettings = {
  provider: "openai",
  apiKey: "",
  baseUrl: PROVIDER_DEFAULTS.openai.baseUrl,
  model: PROVIDER_DEFAULTS.openai.model,
};

function fromDbRow(row: typeof userSettings.$inferSelect): LLMSettings {
  const provider = (row.provider as LLMProvider) || "openai";
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
  return {
    provider,
    apiKey: row.apiKey || "",
    baseUrl: row.baseUrl || defaults.baseUrl,
    model: row.model || defaults.model,
  };
}

export async function getSettings(userId: string): Promise<Settings> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  return {
    llm: row ? fromDbRow(row) : { ...DEFAULT_LLM },
    workspaceRoot: getWorkspaceRoot(),
  };
}

export async function updateSettings(userId: string, partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings(userId);
  const llm = { ...current.llm, ...(partial.llm || {}) };

  await db
    .insert(userSettings)
    .values({
      userId,
      provider: llm.provider,
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl || null,
      model: llm.model || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userSettings.userId],
      set: {
        provider: llm.provider,
        apiKey: llm.apiKey,
        baseUrl: llm.baseUrl || null,
        model: llm.model || null,
        updatedAt: new Date(),
      },
    });

  return {
    llm,
    workspaceRoot: current.workspaceRoot,
  };
}
