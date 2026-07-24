import path from "path";
import os from "os";

const DEFAULT_WORKSPACE = path.join(os.homedir(), ".switch");

export function getWorkspaceRoot(userId?: string): string {
  const base = process.env.WORKSPACE_ROOT || DEFAULT_WORKSPACE;
  if (userId) {
    return path.join(base, userId);
  }
  return base;
}

export function resolvePath(relativePath: string, userId?: string): string {
  const normalized = path.normalize(relativePath);
  if (normalized.includes("..")) {
    throw new Error("Path traversal not allowed");
  }
  return path.join(getWorkspaceRoot(userId), normalized);
}
