import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ATS_CANDIDATES,
  normalizeProfileTerms,
  retrieveAtsCandidates,
} from "../src/agent/ats-candidate-retrieval";
import { getAtsJsonApi } from "../src/agent/ats-url";
import { MAX_WEB_FETCH_RESULT_CHARS, truncateWebFetchResult } from "../src/agent/tool-output";

function job(title: string, description: string): Record<string, unknown> {
  return {
    title,
    location: "Remote",
    url: `https://jobs.example.com/${title.toLowerCase().replaceAll(" ", "-")}`,
    description,
  };
}

test("normalizes bounded profile terms and drops broad values", () => {
  assert.deepEqual(normalizeProfileTerms([" TypeScript ", "typescript", "AI", "remote"]), [
    { value: "typescript", weight: 1 },
    { value: "remote", weight: 1 },
  ]);
});

test("returns complete matching job objects without root containers", () => {
  const relevant = job(
    "Platform Engineer",
    "Build distributed systems using TypeScript and PostgreSQL. ".repeat(8),
  );
  const payload = {
    jobs: [
      job("Oversized Platform Engineer", "TypeScript distributed systems. ".repeat(8_000)),
      relevant,
    ],
    metadata: { generatedAt: "2026-09-20", source: "example" },
  };

  const result = retrieveAtsCandidates(
    payload,
    normalizeProfileTerms(["platform engineer", "typescript", "distributed systems", "remote"]),
    200_000,
  );
  const returned = JSON.parse(result.text.split("\n\n")[0]) as Record<string, unknown>[];

  assert.ok(result.text.length <= 200_000);
  assert.ok(returned.length <= MAX_ATS_CANDIDATES);
  assert.deepEqual(returned, [relevant]);
  assert.ok(result.skippedOversized > 0);
});

test("uses verified Recruitee hint for a custom careers domain", () => {
  assert.deepEqual(getAtsJsonApi("https://careers.tether.io/", "Recruitee"), {
    provider: "Recruitee",
    url: "https://careers.tether.io/api/offers/",
  });
});

test("caps web fetch output at 50,000 characters", () => {
  const result = truncateWebFetchResult("x".repeat(MAX_WEB_FETCH_RESULT_CHARS + 1));

  assert.equal(result.length, MAX_WEB_FETCH_RESULT_CHARS);
  assert.match(result, /Result truncated/);
});
