import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "../utils/paths";
import { db } from "../db";
import { userSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import type { LLMSettings } from "../settings";

export interface AgentMessage {
  role: "user" | "assistant" | "tool_call" | "tool_result";
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: unknown;
}

export interface ResearchSession {
  id: string;
  userId: string;
  sessionToken: string;
  title: string;
  settings: LLMSettings;
  messages: AgentMessage[];
  createdAt: number;
  lastActivityAt: number;
  processing: boolean;
}

export interface ResearchSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  lastActivityAt: number;
  messageCount: number;
}

interface IndexEntry {
  id: string;
  title: string;
  createdAt: number;
  lastActivityAt: number;
}

const sessions = new Map<string, ResearchSession>();
const SESSION_TTL = 30 * 60 * 1000;

function getResearchDir(userId: string): string {
  return path.join(getWorkspaceRoot(userId), "research");
}

function getSessionDir(userId: string, sessionId: string): string {
  return path.join(getResearchDir(userId), sessionId);
}

function getSessionJsonPath(userId: string, sessionId: string): string {
  return path.join(getSessionDir(userId, sessionId), "session.json");
}

function getReportPath(userId: string, sessionId: string): string {
  return path.join(getSessionDir(userId, sessionId), "REPORT.md");
}

function getIndexPath(userId: string): string {
  return path.join(getResearchDir(userId), "index.json");
}

async function persistSession(session: ResearchSession): Promise<void> {
  try {
    const dir = getSessionDir(session.userId, session.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      getSessionJsonPath(session.userId, session.id),
      JSON.stringify(session, null, 2),
      "utf-8",
    );
    await updateIndex(session);
  } catch {
    // best-effort persistence
  }
}

async function updateIndex(session: ResearchSession): Promise<void> {
  const indexPath = getIndexPath(session.userId);
  let entries: IndexEntry[] = [];
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    entries = JSON.parse(raw);
  } catch {
    // index doesn't exist yet
  }

  const existing = entries.findIndex((e) => e.id === session.id);
  const entry: IndexEntry = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
  };

  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }

  entries.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

  try {
    await fs.writeFile(indexPath, JSON.stringify(entries), "utf-8");
  } catch {
    // best-effort
  }
}

async function removeFromIndex(userId: string, sessionId: string): Promise<void> {
  const indexPath = getIndexPath(userId);
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const entries: IndexEntry[] = JSON.parse(raw);
    const filtered = entries.filter((e) => e.id !== sessionId);
    await fs.writeFile(indexPath, JSON.stringify(filtered), "utf-8");
  } catch {
    // index may not exist
  }
}

async function removeSessionFiles(session: ResearchSession): Promise<void> {
  try {
    await fs.rm(getSessionDir(session.userId, session.id), { recursive: true, force: true });
  } catch {
    // directory may not exist
  }
}

export function createResearchSession(
  userId: string,
  title: string,
  settings: LLMSettings,
  initialMessage?: string,
): { sessionId: string; sessionToken: string } {
  const id = uuid();
  const sessionToken = uuid();
  const now = Date.now();

  const messages: AgentMessage[] = [];
  if (initialMessage) {
    messages.push({ role: "user", content: initialMessage });
  }

  const session: ResearchSession = {
    id,
    userId,
    sessionToken,
    title,
    settings,
    messages,
    createdAt: now,
    lastActivityAt: now,
    processing: false,
  };

  sessions.set(id, session);
  persistSession(session);

  return { sessionId: id, sessionToken };
}

export async function getResearchSession(
  sessionId: string,
  token: string,
): Promise<ResearchSession | undefined> {
  const cached = sessions.get(sessionId);
  if (cached) {
    if (cached.sessionToken !== token) return undefined;
    if (Date.now() - cached.lastActivityAt > SESSION_TTL) {
      sessions.delete(sessionId);
      removeSessionFiles(cached);
      return undefined;
    }
    cached.lastActivityAt = Date.now();
    persistSession(cached);
    return cached;
  }

  const loaded = await loadResearchSessionById(sessionId);
  if (!loaded || loaded.sessionToken !== token) return undefined;
  if (Date.now() - loaded.lastActivityAt > SESSION_TTL) {
    removeSessionFiles(loaded);
    return undefined;
  }
  loaded.lastActivityAt = Date.now();
  sessions.set(sessionId, loaded);
  return loaded;
}

export async function loadResearchSessionById(sessionId: string): Promise<ResearchSession | null> {
  const cached = sessions.get(sessionId);
  if (cached) return cached;

  try {
    // We need to find the session on disk. Since we don't know the userId,
    // we scan the index file from all possible user directories.
    // Instead, we look up via the in-memory cache first, then fall back to
    // reading the global index. But for simplicity, we store sessions in-memory
    // on startup by reading index files.
    // Since we don't know userId from just sessionId, the caller (route) must
    // provide userId. So this function is used differently.
    return null;
  } catch {
    return null;
  }
}

export async function loadResearchSessionByIdAndUserId(
  sessionId: string,
  userId: string,
): Promise<ResearchSession | null> {
  const cached = sessions.get(sessionId);
  if (cached && cached.userId === userId) return cached;

  try {
    const raw = await fs.readFile(getSessionJsonPath(userId, sessionId), "utf-8");
    const session = JSON.parse(raw) as ResearchSession;
    if (Date.now() - session.lastActivityAt > SESSION_TTL) {
      removeSessionFiles(session);
      return null;
    }
    sessions.set(sessionId, session);
    return session;
  } catch {
    return null;
  }
}

export async function listResearchSessions(userId: string): Promise<ResearchSessionSummary[]> {
  const indexPath = getIndexPath(userId);
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const entries: IndexEntry[] = JSON.parse(raw);
    return entries
      .filter((e) => Date.now() - e.lastActivityAt <= SESSION_TTL)
      .map((e) => ({
        id: e.id,
        title: e.title,
        createdAt: e.createdAt,
        lastActivityAt: e.lastActivityAt,
        messageCount: 0, // loaded from session.json if needed
      }));
  } catch {
    return [];
  }
}

export function addResearchMessage(
  sessionId: string,
  role: AgentMessage["role"],
  content: string,
  extra?: Partial<Pick<AgentMessage, "toolCallId" | "toolName" | "toolInput">>,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  const msg: AgentMessage = { role, content, ...extra };
  session.messages.push(msg);
  session.lastActivityAt = Date.now();
  persistSession(session);
}

export function setResearchProcessing(sessionId: string, processing: boolean): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.processing = processing;
  persistSession(session);
}

export async function deleteResearchSession(userId: string, sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (session) {
    removeSessionFiles(session);
  } else {
    // try to clean up disk even if not in memory
    try {
      await fs.rm(getSessionDir(userId, sessionId), { recursive: true, force: true });
    } catch {
      // may not exist
    }
  }
  sessions.delete(sessionId);
  await removeFromIndex(userId, sessionId);
}

export async function readResearchReport(
  userId: string,
  sessionId: string,
): Promise<string> {
  try {
    return await fs.readFile(getReportPath(userId, sessionId), "utf-8");
  } catch {
    return "";
  }
}

export async function getResearchReportStat(
  userId: string,
  sessionId: string,
): Promise<{ lastModified: number } | null> {
  try {
    const stat = await fs.stat(getReportPath(userId, sessionId));
    return { lastModified: stat.mtimeMs };
  } catch {
    return null;
  }
}

export async function getResearchInstructions(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ researchInstructions: userSettings.researchInstructions })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  return row?.researchInstructions ?? null;
}

export async function setResearchInstructions(
  userId: string,
  instructions: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: userSettings.id })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (existing) {
      await tx
        .update(userSettings)
        .set({
          researchInstructions: instructions,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      await tx
        .insert(userSettings)
        .values({
          userId,
          researchInstructions: instructions,
        });
    }
  });
}

// cleanup stale sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_TTL) {
      sessions.delete(id);
      removeSessionFiles(session);
    }
  }
}, 5 * 60 * 1000);
