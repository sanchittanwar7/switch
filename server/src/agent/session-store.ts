import { v4 as uuid } from "uuid";
import type { LLMSettings } from "../settings";

export interface AgentSession {
  id: string;
  userId: string;
  sessionToken: string;
  jobUrl: string;
  resumeProjectPath: string;
  settings: LLMSettings;
  createdAt: number;
  lastActivityAt: number;
}

const sessions = new Map<string, AgentSession>();
const SESSION_TTL = 15 * 60 * 1000;

export function createSession(
  userId: string,
  jobUrl: string,
  resumeProjectPath: string,
  settings: LLMSettings
): { sessionId: string; sessionToken: string } {
  const id = uuid();
  const sessionToken = uuid();
  const now = Date.now();

  sessions.set(id, {
    id,
    userId,
    sessionToken,
    jobUrl,
    resumeProjectPath,
    settings,
    createdAt: now,
    lastActivityAt: now,
  });

  return { sessionId: id, sessionToken };
}

export function getSession(sessionId: string, token: string): AgentSession | undefined {
  const session = sessions.get(sessionId);
  if (!session || session.sessionToken !== token) return undefined;
  if (Date.now() - session.lastActivityAt > SESSION_TTL) {
    sessions.delete(sessionId);
    return undefined;
  }
  session.lastActivityAt = Date.now();
  return session;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);
