import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "./utils/paths";
import { PROVIDER_DEFAULTS } from "./settings";

const DEFAULT_KANBAN = {
  columns: [
    { id: "wishlist",  title: "Wishlist",  cardIds: [] as string[] },
    { id: "applied",   title: "Applied",   cardIds: [] as string[] },
    { id: "screening", title: "Screening", cardIds: [] as string[] },
    { id: "interview", title: "Interview", cardIds: [] as string[] },
    { id: "offer",     title: "Offer",     cardIds: [] as string[] },
    { id: "accepted",  title: "Accepted",  cardIds: [] as string[] },
    { id: "rejected",  title: "Rejected",  cardIds: [] as string[] },
  ],
  cards: {} as Record<string, unknown>,
};

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

  const kanbanPath = path.join(root, "kanban.json");
  try {
    await fs.access(kanbanPath);
  } catch {
    await fs.writeFile(kanbanPath, JSON.stringify(DEFAULT_KANBAN, null, 2), "utf-8");
  }

  const settingsPath_ = path.join(root, "settings.json");
  try {
    await fs.access(settingsPath_);
  } catch {
    await fs.writeFile(settingsPath_, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
  }
}
