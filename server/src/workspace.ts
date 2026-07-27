import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "./utils/paths";
import { runMigrations } from "./db/migrate";
import { seedColumns } from "./db/seed";

export async function ensureUserWorkspace(userId: string): Promise<void> {
  const root = getWorkspaceRoot(userId);
  await fs.mkdir(path.join(root, "resumes"), { recursive: true });
}

export async function initializeDatabase(): Promise<void> {
  await runMigrations();
  await seedColumns();
}
