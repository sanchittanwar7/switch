import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "../utils/paths";
import type { LLMSettings } from "../settings";

export interface AgentMessage {
  role: "user" | "assistant" | "tool_call" | "tool_result";
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: unknown;
}

export interface AgentSession {
  id: string;
  userId: string;
  sessionToken: string;
  jobUrl?: string;
  resumeProjectPath: string;
  settings: LLMSettings;
  messages: AgentMessage[];
  createdAt: number;
  lastActivityAt: number;
  processing: boolean;
}

export interface SessionSummary {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  messageCount: number;
  firstUserMessage: string;
}

interface SessionIndexEntry {
  userId: string;
  resumeProjectPath: string;
  sessionToken: string;
  lastActivityAt: number;
}

const sessions = new Map<string, AgentSession>();

function getResumeSessionsDir(userId: string, resumeProjectPath: string): string {
  const normalized = path.normalize(resumeProjectPath);
  if (normalized.includes("..")) {
    throw new Error("Path traversal not allowed");
  }
  return path.join(getWorkspaceRoot(userId), normalized, "sessions");
}

function getSessionPath(userId: string, resumeProjectPath: string, sessionId: string): string {
  return path.join(getResumeSessionsDir(userId, resumeProjectPath), `${sessionId}.json`);
}

function getIndexDir(): string {
  return path.join(getWorkspaceRoot(), "sessions");
}

function getIndexPath(sessionId: string): string {
  return path.join(getIndexDir(), `${sessionId}.json`);
}

async function persistSession(session: AgentSession): Promise<void> {
  try {
    const sessionDir = getResumeSessionsDir(session.userId, session.resumeProjectPath);
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(
      getSessionPath(session.userId, session.resumeProjectPath, session.id),
      JSON.stringify(session, null, 2),
      "utf-8",
    );

    const indexDir = getIndexDir();
    await fs.mkdir(indexDir, { recursive: true });
    const indexEntry: SessionIndexEntry = {
      userId: session.userId,
      resumeProjectPath: session.resumeProjectPath,
      sessionToken: session.sessionToken,
      lastActivityAt: session.lastActivityAt,
    };
    await fs.writeFile(getIndexPath(session.id), JSON.stringify(indexEntry), "utf-8");
  } catch {
    // best-effort persistence — don't block on disk errors
  }
}

async function removeSessionFiles(session: AgentSession): Promise<void> {
  try {
    await fs.unlink(getSessionPath(session.userId, session.resumeProjectPath, session.id));
  } catch {
    // file may not exist
  }
  try {
    await fs.unlink(getIndexPath(session.id));
  } catch {
    // file may not exist
  }
}

async function loadSessionFromDisk(sessionId: string, userId?: string): Promise<AgentSession | null> {
  try {
    const indexRaw = await fs.readFile(getIndexPath(sessionId), "utf-8");
    const index: SessionIndexEntry = JSON.parse(indexRaw);

    const sessionRaw = await fs.readFile(
      getSessionPath(index.userId, index.resumeProjectPath, sessionId),
      "utf-8",
    );
    const session = JSON.parse(sessionRaw) as AgentSession;
    session.processing = false;
    return session;
  } catch {
    if (userId) {
      try {
        const userRoot = getWorkspaceRoot(userId);
        const dirs = await fs.readdir(userRoot, { withFileTypes: true });
        for (const dir of dirs) {
          if (!dir.isDirectory()) continue;
          try {
            const sessionRaw = await fs.readFile(
              path.join(userRoot, dir.name, "sessions", `${sessionId}.json`),
              "utf-8",
            );
            const session = JSON.parse(sessionRaw) as AgentSession;
            session.processing = false;
            persistIndexForSession(session);
            return session;
          } catch {
            // this directory doesn't have the session
          }
        }
      } catch {
        // user dir not found
      }
    }
    return null;
  }
}

async function persistIndexForSession(session: AgentSession): Promise<void> {
  try {
    const indexDir = getIndexDir();
    await fs.mkdir(indexDir, { recursive: true });
    const indexEntry: SessionIndexEntry = {
      userId: session.userId,
      resumeProjectPath: session.resumeProjectPath,
      sessionToken: session.sessionToken,
      lastActivityAt: session.lastActivityAt,
    };
    await fs.writeFile(getIndexPath(session.id), JSON.stringify(indexEntry), "utf-8");
  } catch {
    // best-effort
  }
}

export function createSession(
  userId: string,
  resumeProjectPath: string,
  settings: LLMSettings,
  jobUrl?: string,
  initialMessage?: string,
): { sessionId: string; sessionToken: string } {
  const id = uuid();
  const sessionToken = uuid();
  const now = Date.now();

  const messages: AgentMessage[] = [];
  if (initialMessage) {
    messages.push({ role: "user", content: initialMessage });
  }

  const session: AgentSession = {
    id,
    userId,
    sessionToken,
    jobUrl,
    resumeProjectPath,
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

export async function getSession(sessionId: string, token: string): Promise<AgentSession | undefined> {
  const cached = sessions.get(sessionId);
  if (cached) {
    if (cached.sessionToken !== token) return undefined;
    cached.lastActivityAt = Date.now();
    persistSession(cached);
    return cached;
  }

  const loaded = await loadSessionFromDisk(sessionId);
  if (!loaded || loaded.sessionToken !== token) return undefined;
  loaded.lastActivityAt = Date.now();
  sessions.set(sessionId, loaded);
  return loaded;
}

export async function loadSessionById(sessionId: string, userId?: string): Promise<AgentSession | null> {
  return loadSessionFromDisk(sessionId, userId);
}

export async function listSessions(userId: string, resumeProjectPath: string): Promise<SessionSummary[]> {
  try {
    const dir = getResumeSessionsDir(userId, resumeProjectPath);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const summaries: SessionSummary[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(dir, entry.name), "utf-8");
        const session = JSON.parse(raw) as AgentSession;
        summaries.push({
          id: session.id,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          messageCount: session.messages.length,
          firstUserMessage: session.messages.find((m) => m.role === "user")?.content.slice(0, 120) || "",
        });
      } catch {
        // skip unreadable files
      }
    }

    summaries.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return summaries;
  } catch {
    return [];
  }
}

export function addMessage(
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

export function setProcessing(sessionId: string, processing: boolean): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.processing = processing;
  persistSession(session);
}

export function deleteSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    removeSessionFiles(session);
  }
  sessions.delete(sessionId);
}
