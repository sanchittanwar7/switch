import { createHash } from "node:crypto";

export function normalizeUrl(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const input = raw.trim();
  if (!input) return null;

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  let path = parsed.pathname;
  if (path === "/") {
    path = "";
  } else if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  const host = parsed.host.toLowerCase();
  return `${parsed.protocol}//${host}${path}`;
}

export function contentHash(raw: string): string | null {
  const normalized = normalizeUrl(raw);
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}
