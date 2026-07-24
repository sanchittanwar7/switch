import path from "path";
import os from "os";

const DEFAULT_WORKSPACE = path.join(os.homedir(), ".switch");

export function getWorkspaceRoot(): string {
  return process.env.WORKSPACE_ROOT || DEFAULT_WORKSPACE;
}

export function resolvePath(relativePath: string): string {
  const normalized = path.normalize(relativePath);
  if (normalized.includes("..")) {
    throw new Error("Path traversal not allowed");
  }
  return path.join(getWorkspaceRoot(), normalized);
}
