import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "./utils/paths";
import { PROVIDER_DEFAULTS } from "./settings";
import { runMigrations } from "./db/migrate";
import { seedColumns } from "./db/seed";

const DEFAULT_SETTINGS = {
  llm: {
    provider: "openai",
    apiKey: "",
    baseUrl: PROVIDER_DEFAULTS.openai.baseUrl,
    model: PROVIDER_DEFAULTS.openai.model,
  },
  workspaceRoot: getWorkspaceRoot(),
};

export async function ensureWorkspace(): Promise<void> {
  const root = getWorkspaceRoot();

  await fs.mkdir(path.join(root, "resumes"), { recursive: true });

  const settingsPath_ = path.join(root, "settings.json");
  try {
    await fs.access(settingsPath_);
  } catch {
    await fs.writeFile(settingsPath_, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
  }
}

export async function initializeDatabase(): Promise<void> {
  await runMigrations();
  await seedColumns();
}
