import { createHash } from "crypto";

const MIN_CANDIDATE_CHARS = 200;
export const MAX_ATS_CANDIDATES = 50;
const BROAD_TERMS = new Set(["go", "ai", "ml", "it", "us"]);

export type SearchTerm = { value: string; weight: number };

export type Candidate = {
  raw: Record<string, unknown>;
  text: string;
  matched: string[];
  score: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeProfileTerms(profileTerms?: string[]): SearchTerm[] {
  if (!profileTerms || profileTerms.length < 1 || profileTerms.length > 20) return [];

  const terms = new Set<string>();
  for (const term of profileTerms) {
    const value = term.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    if (value.length < 3 || value.length > 80 || BROAD_TERMS.has(value)) continue;
    terms.add(value);
  }

  return [...terms].map((value) => ({ value, weight: 1 }));
}

export function scoreObject(raw: Record<string, unknown>, terms: SearchTerm[]): Candidate | null {
  const text = JSON.stringify(raw);
  const matched = terms.filter(({ value }) => new RegExp(escapeRegex(value), "iu").test(text));

  if (matched.length === 0) return null;

  return {
    raw,
    text,
    matched: matched.map(({ value }) => value),
    score: matched.reduce((total, term) => total + term.weight, 0),
  };
}

function isCollectionContainer(raw: Record<string, unknown>, textLength: number, payloadLength: number): boolean {
  if (textLength === payloadLength) return true;

  const directCollectionChars = Object.values(raw).reduce<number>((total, value) => {
    if (!Array.isArray(value)) return total;
    return (
      total +
      value.reduce((childTotal, child) => {
        return childTotal + (isRecord(child) ? JSON.stringify(child).length : 0);
      }, 0)
    );
  }, 0);

  return directCollectionChars >= textLength * 0.5;
}

function collectCandidates(
  value: unknown,
  terms: SearchTerm[],
  payloadLength: number,
  candidates: Candidate[],
  seen: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectCandidates(entry, terms, payloadLength, candidates, seen));
    return;
  }

  if (!isRecord(value)) return;

  const candidate = scoreObject(value, terms);
  if (
    candidate &&
    candidate.text.length >= MIN_CANDIDATE_CHARS &&
    candidate.text.length <= payloadLength &&
    !isCollectionContainer(value, candidate.text.length, payloadLength)
  ) {
    const fingerprint = createHash("sha256").update(candidate.text).digest("hex");
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      candidates.push(candidate);
    }
  }

  Object.values(value).forEach((entry) => collectCandidates(entry, terms, payloadLength, candidates, seen));
}

export function retrieveAtsCandidates(
  payload: unknown,
  terms: SearchTerm[],
  maxChars: number,
): { text: string; count: number; skippedOversized: number } {
  if (!isRecord(payload) && !Array.isArray(payload)) {
    return { text: "No JSON objects were available for job retrieval.", count: 0, skippedOversized: 0 };
  }

  const payloadLength = JSON.stringify(payload).length;
  const candidates: Candidate[] = [];
  collectCandidates(payload, terms, payloadLength, candidates, new Set());
  candidates.sort((a, b) => b.score - a.score || a.text.length - b.text.length);

  const selected: Candidate[] = [];
  let selectedChars = 2;
  let skippedOversized = 0;
  const reservedNoticeChars = 240;

  for (const candidate of candidates) {
    const separatorChars = selected.length === 0 ? 0 : 1;
    if (candidate.text.length + separatorChars > maxChars - reservedNoticeChars) {
      skippedOversized += 1;
      continue;
    }
    if (selectedChars + candidate.text.length + separatorChars > maxChars - reservedNoticeChars) continue;
    selected.push(candidate);
    selectedChars += candidate.text.length + separatorChars;
    if (selected.length === MAX_ATS_CANDIDATES) break;
  }

  if (selected.length === 0) {
    return {
      text: "No complete profile-relevant job records fit within the retrieval limit. Ask the user for job URLs or job-description text.",
      count: 0,
      skippedOversized,
    };
  }

  const suffix =
    skippedOversized > 0
      ? "\n\nSome complete matching records were too large for safe context. Do not use partial records; ask the user for those job URLs if needed."
      : "";
  return {
    text: `${JSON.stringify(selected.map(({ raw }) => raw))}${suffix}`,
    count: selected.length,
    skippedOversized,
  };
}
