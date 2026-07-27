import { and, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { userSettings, userProviders } from "./db/schema.js";
import { getWorkspaceRoot } from "./utils/paths.js";

export const LLM_PROVIDERS = ["openai", "gemini", "claude", "deepseek", "qwen"] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

export const PROVIDER_BASE_URLS: Record<LLMProvider, string> = {
  openai:    "https://api.openai.com/v1",
  gemini:    "https://generativelanguage.googleapis.com/v1beta",
  claude:    "https://api.anthropic.com/v1",
  deepseek:  "https://api.deepseek.com/v1",
  qwen:      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
};

export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  openai: [
    "gpt-5.2",
    "gpt-5.2-mini",
    "gpt-5.1",
    "gpt-5",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "o4-mini",
    "o3",
    "o3-mini",
  ],
  gemini: [
    "gemini-3.1-pro",
    "gemini-3.1-flash",
    "gemini-3-pro",
    "gemini-3-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ],
  claude: [
    "claude-fable-5",
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-haiku-4-5",
    "claude-opus-4-8",
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-sonnet-4-5",
    "claude-opus-4-5",
  ],
  deepseek: [
    "deepseek-v4-flash",
    "deepseek-v4-pro",
  ],
  qwen: [
    "qwen3.7-max",
    "qwen3.7-plus",
    "qwen3.6-flash",
    "qwen3.6-plus",
    "qwen3.6-max",
    "qwen3.6-coder",
    "qwen3-plus",
    "qwen3-max",
    "qwen3-coder",
  ],
};

export const PROVIDER_DEFAULTS: Record<LLMProvider, { baseUrl: string; model: string }> = {
  openai:    { baseUrl: PROVIDER_BASE_URLS.openai, model: "gpt-5.2" },
  gemini:    { baseUrl: PROVIDER_BASE_URLS.gemini, model: "gemini-3.1-pro" },
  claude:    { baseUrl: PROVIDER_BASE_URLS.claude, model: "claude-sonnet-5" },
  deepseek:  { baseUrl: PROVIDER_BASE_URLS.deepseek, model: "deepseek-v4-flash" },
  qwen:      { baseUrl: PROVIDER_BASE_URLS.qwen, model: "qwen3.7-plus" },
};

export interface LLMSettings {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface UserProvider {
  id: string;
  provider: LLMProvider;
  apiKey: string;
  defaultModel: string | null;
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

export async function getUserProviders(userId: string): Promise<UserProvider[]> {
  const rows = await db
    .select()
    .from(userProviders)
    .where(eq(userProviders.userId, userId))
    .orderBy(userProviders.createdAt);

  return rows.map((r) => ({
    id: r.id,
    provider: r.provider as LLMProvider,
    apiKey: r.apiKey,
    defaultModel: r.defaultModel || null,
  }));
}

export async function addUserProvider(
  userId: string,
  provider: LLMProvider,
  apiKey: string,
): Promise<UserProvider> {
  const [row] = await db
    .insert(userProviders)
    .values({ userId, provider, apiKey })
    .onConflictDoUpdate({
      target: [userProviders.userId, userProviders.provider],
      set: { apiKey, updatedAt: new Date() },
    })
    .returning();

  return { id: row.id, provider: row.provider as LLMProvider, apiKey: row.apiKey, defaultModel: row.defaultModel || null };
}

export async function setDefaultModel(
  userId: string,
  providerId: string,
  defaultModel: string | null,
): Promise<UserProvider | null> {
  const [row] = await db
    .update(userProviders)
    .set({ defaultModel, updatedAt: new Date() })
    .where(and(eq(userProviders.id, providerId), eq(userProviders.userId, userId)))
    .returning();

  if (!row) return null;

  return { id: row.id, provider: row.provider as LLMProvider, apiKey: row.apiKey, defaultModel: row.defaultModel || null };
}

export async function deleteUserProvider(userId: string, providerId: string): Promise<boolean> {
  const result = await db
    .delete(userProviders)
    .where(and(eq(userProviders.id, providerId), eq(userProviders.userId, userId)))
    .returning({ id: userProviders.id });

  return result.length > 0;
}

export async function getLLMSettingsForModel(
  userId: string,
  model: string,
): Promise<LLMSettings | null> {
  const rows = await db
    .select()
    .from(userProviders)
    .where(eq(userProviders.userId, userId));

  for (const row of rows) {
    const providerModels = PROVIDER_MODELS[row.provider as LLMProvider];
    const defaultModels = PROVIDER_MODELS[row.provider as LLMProvider] || [];
    const allModels = [...new Set([...defaultModels, model])];

    if (allModels.includes(model) || model) {
      return {
        provider: row.provider as LLMProvider,
        apiKey: row.apiKey,
        baseUrl: PROVIDER_BASE_URLS[row.provider as LLMProvider] || "",
        model,
      };
    }
  }

  const settings = await getSettings(userId);
  return settings.llm.apiKey ? settings.llm : null;
}
