# Plan: Job Relevance Ranking in the Research Agent

## 1. Goal

When a user researches a company, the research agent currently builds a markdown report
about that company (see `server/src/agent/research-system-prompt.ts` and
`server/src/agent/research-orchestrator.ts`). The report has nine fixed pillars but no
notion of *which open roles at that company are a good fit for the user*.

This change adds a **job-relevance ranking** step to the research flow:

1. While researching a company, the agent resolves the company's **Applicant Tracking System
   (ATS)** and queries its public JSON API — Greenhouse, Lever, Ashby, SmartRecruiters, or
   Workday — to collect the **job descriptions (JDs) of all open roles**. When no ATS JSON API
   resolves, it falls back to the careers page and then search (see §4.3).
2. The server loads the user's **profile** — location preference, work experience, skills,
   and projects — from the existing Postgres tables.
3. The server calls **TypeSafe AI's JEV** model using the `score` primitive to judge how
   relevant the user's profile is to each open role.
4. The top **5** roles, ranked by relevance, are listed in the **chat window** (as part of the
   agent's reply) and written into **`REPORT.md`** under a new "Open Roles & Fit" pillar.

The ranking uses the composite/fan-out pattern documented by TypeSafe: one `score` question
per job in a single `systemOne` request, then ranking in application code by the returned
scores. See the TypeSafe docs for [Score](https://docs.typesafe.ai/primitives/score) and the
[JavaScript SDK](https://docs.typesafe.ai/sdk/javascript).

## 2. Current state (reference)

Relevant files and facts gathered from the repo:

- **Agent orchestrator** — `server/src/agent/research-orchestrator.ts`
  - `runResearchStream(session, req, res)` calls `streamText` from `ai`, streams SSE
    events (`tool_call`, `tool_result`, `message`, `done`, `error`).
  - Tools come from `createTools(session.userId, workspaceSubPath)`.
  - `stopWhen: isStepCount(50)` bounds the run.
- **Tools** — `server/src/agent/tools.ts`
  - `createTools(userId, workspaceSubPath?)` returns `read_files`, `write_file`,
    `list_dir`, `web_fetch`, `add_job_to_wishlist`.
  - `web_fetch` fetches a URL and pipes the body through `@mozilla/readability` to extract
    article text. **This mangles JSON**: ATS JSON endpoints (`application/json`) get stripped
    to nothing useful. A JSON pass-through (content-type detection) must be added so the agent
    can read ATS JSON APIs — see §4.13.
  - `add_job_to_wishlist` already reads/writes the `applications` table via `db` and
    captures `userId` through a closure — the template for the new `rank_open_roles` tool.
- **System prompt** — `server/src/agent/research-system-prompt.ts`
  - `buildResearchSystemPrompt(title, instructions)` defines the nine research pillars and
    instructs the agent to keep `REPORT.md` updated.
- **Sessions** — `server/src/agent/research-session-store.ts`
  - `ResearchSession` is persisted to `session.json` under the workspace; has `messages`,
    `settings`, `processing`, etc. No ranking field yet.
- **Routes** — `server/src/agent/research-routes.ts`
  - `POST /api/research/sessions` creates a session, `GET /api/research/sessions/:id/stream`
    opens the SSE stream, `GET /api/research/sessions/:id/report` returns `REPORT.md`,
    `GET /api/research/sessions/:id` returns session detail including `messages`.
- **Profile data** — `server/src/db/schema.ts` and `server/src/routes/profile.ts`
  - `userProfiles`: `city`, `country`, `isRemote` (location preference).
  - `workExperiences`: `company`, `role`, `teamName`, `description`, `startDate`,
    `endDate`, `skills[]`.
  - `skills`: `name`, `expertise` (`beginner` | `intermediate` | `expert`).
  - `projects`: `title`, `description`, `github`, `url`.
  - There is **no single aggregate query** yet; `profile.ts` exposes CRUD routes but the
    research agent does not read profile data.
- **Client** — `client/src/stores/researchStore.ts`, `client/src/views/ResearchView.tsx`,
  `client/src/components/research/ReportPanel.tsx`
  - The store consumes SSE events via `EventSource` and renders a tool log plus a report
    panel. No ranking UI yet.
- **TypeSafe SDK** — `@typesafe-ai/sdk` is **not installed**. It provides `TypeSafeClient`
  with `systemOne({ state, questions })` and a `score(instructions, criteria)` question
  builder (`ScoreQuestion` with `type: "score"`, `instructions`, `criteria` tuple of >= 2).
- **Env** — `server/.env.example` and `server/src/index.ts` show env usage; there is no
  TypeSafe key yet.

## 3. Architecture decision (summary)

- **Deterministic code owns the workflow; JEV supplies the judgment.** JD collection is done
  by the LLM agent — by probing the company's ATS JSON API (via a JSON-capable `web_fetch`),
  then falling back to the careers page and then search when the ATS doesn't resolve. Profile
  loading and scoring/ranking are deterministic TypeScript code in the server, triggered
  through a new agent tool `rank_open_roles`.
- **One `score` question per job, single request.** All jobs are scored in parallel by JEV
  in one `systemOne` call (fan-out). Ranking happens in code by score, then confidence.
- **API key stays server-side only.** `TYPESAFE_API_KEY` is read from env in the server;
  it is never exposed to the client.
- **Graceful degradation.** Missing API key, empty profile, or TypeSafe errors return a
  human-readable message to the agent instead of crashing the run.
- **Ordered JD collection with explicit fallbacks.** The agent collects roles in order of
  preference: user-supplied URL → ATS JSON API → careers page → search. If the company has
  hundreds/thousands of openings, it stops and asks the user for specific role URLs. In every
  branch it tells the user what it is doing (details in §4.3).
- **No new UI surfaces.** The ranked top-5 is rendered through two existing channels: the
  agent's chat reply (already Markdown-rendered in `ResearchView`) and `REPORT.md` (already
  rendered by `ReportPanel`). The tool returns a Markdown list the agent can paste into both,
  so there are no client-side code changes and no new SSE events.

---

## Subtask 1 — TypeSafe SDK integration and configuration

### Objective

Install the `@typesafe-ai/sdk` package in the server workspace, add the `TYPESAFE_API_KEY`
environment variable, and create a small server-side client module so the rest of the
feature can call `systemOne` without touching the SDK directly.

### Files touched

- `server/package.json` — add dependency.
- `server/.env.example` — document the new key.
- `server/src/lib/typesafe.ts` — **new** client module.

### 1.1 Install the dependency

The SDK is `@typesafe-ai/sdk` (Node.js 20+, ESM + CJS + TS declarations). The server package
is ESM (`"type": "module"`) with strict TypeScript, which matches the SDK's target.

Run from the workspace root (npm workspaces are declared in the root `package.json`):

```sh
npm install @typesafe-ai/sdk -w server
```

This adds the dependency to `server/package.json` and updates the root `package-lock.json`.
The version should be pinned to the current release (`^0.6.0` at time of writing); the
lockfile resolves the exact version.

Verification that install worked:

```sh
npm ls @typesafe-ai/sdk -w server
```

Expected output shows the package resolved under `server/node_modules`.

Confirm the package exposes the symbols we need. From the SDK's published types
(`types.ts` and `questions.ts`):

- `TypeSafeClient` — class with `systemOne(request, options?)`.
- `score(instructions, criteria)` — builds a `ScoreQuestion` (`{ type: "score", instructions,
  criteria }`); `criteria` must be a tuple of at least two descriptions.
- `SystemOneResult<Q>` — `{ model, answers, usage }`, with each `answers[k]` a
  `ScoreResponse` (`{ type: "score", score, confidence, legend, probabilities }`) when the
  question was built with `score(...)`.
- The client constructor accepts `{ apiKey, baseURL?, defaultModel?, logLevel?, timeout?,
  retry?, dangerouslyAllowBrowser? }`; `apiKey` falls back to `TYPESAFE_API_KEY`.

The default model is `jev-latest` (the JEV System One model the user asked for), so no
`defaultModel` override is required. We pass `apiKey` explicitly for clarity.

### 1.2 Add the environment variable

Add a new section to `server/.env.example` after the Sponsored Board block. Keep the same
comment style (uppercase section dividers, `—` separators):

```
# ── TypeSafe AI (job relevance ranking) ───────────────────
# API key for TypeSafe's System One model (JEV). Used to score
# how relevant a candidate's profile is to open roles. Server-side only.
TYPESAFE_API_KEY=
```

Also add `TYPESAFE_API_KEY=` to the local `server/.env` (do not commit the real value; the
file is gitignored). The server dev script loads `.env` directly via
`--env-file=.env`, and `tsx` does not auto-load env otherwise, so the key must be present in
`.env` for local dev.

Notes:

- The key is **server-only**. Never add it to `client/.env` or reference it in client code.
- The TypeSafe SDK also reads `TYPESAFE_API_KEY` from the environment by default; we still
  pass it explicitly in the client module (below) for clarity and testability.
- Do not log the key. The SDK redacts known credential headers at `debug` level, but our
  module should still avoid logging it anywhere.

### 1.3 Create `server/src/lib/typesafe.ts`

This module owns the `TypeSafeClient` singleton. Reasons for a singleton:

- The client holds no per-user state; one instance per process is sufficient.
- Construction validates the API key and is cheap; lazy init avoids throwing at import time
  (which would break server boot when the key is not yet configured).
- A single module is easy to stub in future unit tests (no test suite today, but keeping the
  boundary clean).

Draft implementation:

```ts
import { TypeSafeClient } from "@typesafe-ai/sdk";

let client: TypeSafeClient | null = null;

/**
 * Return the process-wide TypeSafe client, creating it on first use.
 * Throws if TYPESAFE_API_KEY is not set.
 */
export function getTypeSafeClient(): TypeSafeClient {
  if (!client) {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) {
      throw new Error("TYPESAFE_API_KEY is not configured");
    }
    client = new TypeSafeClient({ apiKey });
  }
  return client;
}

/**
 * Whether TypeSafe is usable. Prefer this check over try/catch at call sites
 * when you want a friendly message instead of an exception.
 */
export function isTypeSafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}
```

Design notes:

- `getTypeSafeClient` throws a clear error; call sites (the tool) catch it and convert to a
  friendly string for the agent.
- `isTypeSafeConfigured` lets the tool short-circuit before doing expensive profile work.
- We intentionally do **not** expose the SDK or client to the browser; `TypeSafeClient`
  refuses to run in a browser by default (`dangerouslyAllowBrowser` defaults to false),
  which is the behavior we want.
- `baseURL` is left default (`https://api.typesafe.ai`); no custom gateway is used.

Optional logging configuration (only if we later want request visibility):

```ts
client = new TypeSafeClient({
  apiKey,
  logLevel: process.env.NODE_ENV === "development" ? "warn" : "off",
});
```

`warn` is the SDK default and logs nothing on success, only on retries/failures. Keep the
default unless debugging is needed.

### 1.4 Failure modes

| Scenario | Behavior |
| --- | --- |
| `TYPESAFE_API_KEY` missing | `getTypeSafeClient` throws `TYPESAFE_API_KEY is not configured`; tool returns friendly string. |
| Key present but invalid (401) | SDK throws `APIError` after retries; tool catches and relays a trimmed message. |
| Network unreachable | SDK throws `APIConnectionError` after retries; tool catches. |
| Request timeout | SDK throws `APITimeoutError`; tool catches. |
| 5xx from TypeSafe | SDK retries per default policy (408/429/5xx, exp backoff, jitter); after exhaustion throws `APIError`. |
| Missing global `fetch` | Impossible in Node 20+ (built-in `fetch`); SDK also allows a custom `fetch`. |

The tool layer (Subtask 4) is the single place that maps these to user-facing strings, so
this module stays thin and does not swallow errors.

### 1.5 Acceptance criteria

- `@typesafe-ai/sdk` listed in `server/package.json` `dependencies`.
- `TYPESAFE_API_KEY` documented in `server/.env.example`.
- `server/src/lib/typesafe.ts` exports `getTypeSafeClient` and `isTypeSafeConfigured`.
- `npm run lint -w server` (i.e. `tsc --noEmit`) passes with the new module.
- No TypeSafe references anywhere under `client/`.

### 1.6 Verification steps

```sh
npm install @typesafe-ai/sdk -w server
npm run lint -w server
```

Then a one-off smoke check via `tsx` (not committed):

```sh
cd server && TYPESAFE_API_KEY=<key> npx tsx -e "import('./src/lib/typesafe.ts').then(m => console.log(m.isTypeSafeConfigured()))"
```

Expect `true` when the key is set and `false` when it is not.

### 1.7 Alternatives considered

- **Call the HTTP API directly with `fetch`** instead of the SDK. Rejected: the SDK gives
  typed `score` builders, typed answers, retries, and timeout handling for free, matching the
  repo's existing use of typed SDKs (`@ai-sdk/*`).
- **Pass the key per-request from the client.** Rejected: keys must stay server-side
  (security rule in AGENTS.md and TypeSafe's own guidance).
- **Initialize the client eagerly at module load.** Rejected: would crash server boot when the
  key is absent; lazy init lets the server run with ranking degraded but functional.

### 1.8 Security notes

- The key is read only from `process.env`, never logged, never returned by any route.
- No client-side settings UI for this key in scope.
- The SDK sends `Authorization: Bearer <key>` on every call; it runs only server-side, so the
  key never crosses the browser boundary.

### 1.9 Full module listing (expanded)

The complete `server/src/lib/typesafe.ts`, including a typed error wrapper that the scoring
engine (Subtask 3) and tool (Subtask 4) can rely on to distinguish configuration errors from
transient API errors:

```ts
import {
  TypeSafeClient,
  APIError,
  APIConnectionError,
  APITimeoutError,
  TypeSafeError,
} from "@typesafe-ai/sdk";

let client: TypeSafeClient | null = null;

/**
 * Configuration is missing. Distinct from API/transport errors so callers can
 * show a targeted "set your key" message rather than a generic failure.
 */
export class TypeSafeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypeSafeConfigError";
  }
}

export function isTypeSafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export function getTypeSafeClient(): TypeSafeClient {
  if (!client) {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) {
      throw new TypeSafeConfigError("TYPESAFE_API_KEY is not configured");
    }
    client = new TypeSafeClient({ apiKey });
  }
  return client;
}

/**
 * Normalize any error thrown during a systemOne call into a short,
 * human-readable string suitable for surfacing to the agent.
 */
export function describeTypeSafeError(err: unknown): string {
  if (err instanceof TypeSafeConfigError) {
    return "TypeSafe AI is not configured. Set TYPESAFE_API_KEY in server/.env.";
  }
  if (err instanceof APIError) {
    return `TypeSafe API error (${err.status}): ${err.message}`;
  }
  if (err instanceof APIConnectionError) {
    return "Could not reach TypeSafe AI. Check network connectivity and retry.";
  }
  if (err instanceof APITimeoutError) {
    return "TypeSafe AI request timed out. Try again or reduce the number of roles.";
  }
  if (err instanceof TypeSafeError) {
    return `TypeSafe AI error: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Unknown TypeSafe AI error";
}
```

Rationale:

- `describeTypeSafeError` centralizes the mapping from SDK exception classes to user-facing
  strings, so the tool does not import the error classes itself.
- `TypeSafeConfigError` extends `Error` and is thrown only for the missing-key case; everything
  else is delegated to the SDK's own error types.
- The SDK exports `APIError`, `APIConnectionError`, `APITimeoutError`, and `TypeSafeError` from
  its index (verified against the published `errors.ts`); the exact import names are stable in
  `^0.6.0`.

### 1.10 Exact dependency change

`server/package.json` `dependencies` gains one entry (alphabetically placed):

```json
"dependencies": {
  "@ai-sdk/anthropic": "^4.0.20",
  "@ai-sdk/deepseek": "^3.0.13",
  "@ai-sdk/google": "^4.0.24",
  "@ai-sdk/openai": "^4.0.20",
  "@mozilla/readability": "^0.6.0",
  "@supabase/supabase-js": "^2.110.8",
  "@typesafe-ai/sdk": "^0.6.0",
  "ai": "^7.0.37",
  ...
}
```

The root `package-lock.json` is regenerated by the `npm install -w server` command; do not edit
it by hand.

### 1.11 SDK surface we depend on (reference)

| Symbol | Kind | Used by |
| --- | --- | --- |
| `TypeSafeClient` | class | `typesafe.ts` (singleton) |
| `TypeSafeClient#systemOne({ state, questions })` | method | `relevance-scorer.ts` |
| `score(instructions, criteria)` | builder | `relevance-scorer.ts` |
| `APIError` / `APIConnectionError` / `APITimeoutError` / `TypeSafeError` | error classes | `typesafe.ts` (`describeTypeSafeError`) |

All of these are exported from the package root (`@typesafe-ai/sdk`). We do **not** need
`noul`, `choice`, or the `models` resource for this feature.

### 1.12 Environment loading mechanics

- **Dev** (`npm run dev -w server`): `tsx watch --env-file=.env src/index.ts` loads
  `server/.env` into `process.env` before the process starts. `TYPESAFE_API_KEY` must live
  there.
- **Build/start** (`node dist/index.js`): Node does **not** auto-load `.env`; the deployment
  must inject `TYPESAFE_API_KEY` via the platform's env config (same as `DATABASE_URL` and
  `SUPABASE_SECRET_KEY` today).
- The key is read lazily inside `getTypeSafeClient`/`isTypeSafeConfigured`, not at module
  import, so a missing key does not prevent the server from booting (ranking degrades to a
  friendly message).

---

## Subtask 2 — User profile aggregation

### Objective

Build a server-side module that loads a single, well-shaped "candidate profile" object from
the four profile tables. This object becomes the `state.candidate` input to TypeSafe. The
module must be deterministic, typed, and tolerant of missing data (a new user may have an
empty or partial profile).

### Files touched

- `server/src/agent/profile-loader.ts` — **new**.
- (No schema changes required; the four tables already exist and are populated by
  `server/src/routes/profile.ts`.)

### 2.1 Data contract

Define a `CandidateProfile` type that flattens the DB rows into a shape TypeSafe can consume
as `state.candidate`. The fields map directly to the schema columns:

```ts
export interface CandidateLocationPreference {
  city: string | null;
  country: string | null;
  isRemote: boolean;
}

export interface CandidateWorkExperience {
  company: string;
  role: string;
  teamName: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  skills: string[];
}

export interface CandidateSkill {
  name: string;
  expertise: "beginner" | "intermediate" | "expert";
}

export interface CandidateProject {
  title: string;
  description: string | null;
  github: string | null;
  url: string | null;
}

export interface CandidateProfile {
  locationPreference: CandidateLocationPreference | null;
  workExperience: CandidateWorkExperience[];
  skills: CandidateSkill[];
  projects: CandidateProject[];
}
```

Design choices:

- **`locationPreference` is nullable** — the `userProfiles` table may have no row for a user.
- **Lists default to `[]`** — an empty array is a valid state; it signals "no experience" to
  JEV rather than crashing.
- **Field names mirror the DB columns** — `teamName` stays `teamName` (no renaming) so the
  state maps one-to-one to the schema and is easy to audit against `profile.ts`.
- **Include `startDate`/`endDate`** — these let JEV infer seniority and tenure, which matter
  for relevance.

### 2.2 Queries

Use the existing `db` client (`server/src/db`) and drizzle query builder, mirroring the
patterns in `server/src/routes/profile.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  userProfiles, workExperiences, skills, projects,
} from "../db/schema";

export async function loadCandidateProfile(userId: string): Promise<CandidateProfile> {
  const [location] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  const experiences = await db
    .select()
    .from(workExperiences)
    .where(eq(workExperiences.userId, userId))
    .orderBy(workExperiences.position);

  const skillRows = await db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId));

  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId));

  return {
    locationPreference: location
      ? { city: location.city, country: location.country, isRemote: location.isRemote }
      : null,
    workExperience: experiences.map((e) => ({
      company: e.company,
      role: e.role,
      teamName: e.teamName,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      skills: e.skills ?? [],
    })),
    skills: skillRows.map((s) => ({ name: s.name, expertise: s.expertise })),
    projects: projectRows.map((p) => ({
      title: p.title,
      description: p.description,
      github: p.github,
      url: p.url,
    })),
  };
}
```

Notes:

- `workExperiences.position` preserves the user's chosen ordering (most recent first, from
  `profile.ts` reorder logic); ordering is meaningful to JEV.
- Drizzle's `$inferSelect` types are not exported here; we map into our own explicit types
  so the TypeSafe state is decoupled from DB concerns.
- The four queries could be run via `Promise.all` for lower latency; for a single user's rows
  the difference is negligible, so keep sequential for clarity.

### 2.3 Serialization for JEV

Before scoring, the profile is embedded into `state.candidate`. To keep token usage bounded
and the signal clean:

- Strip `null` fields from work-experience/project entries when building state (optional but
  recommended) so JEV does not see a wall of `null`s.
- If `locationPreference` is `null`, omit the key entirely; the scoring instructions mention
  "no location preference recorded" when it matters.
- Keep `skills` and `workExperience[].skills` as arrays of strings (not objects with
  `id`/`createdAt`) to minimize noise.

Example serialized `state.candidate`:

```json
{
  "locationPreference": { "city": "San Francisco", "country": "USA", "isRemote": false },
  "workExperience": [
    {
      "company": "Acme Corp",
      "role": "Senior Frontend Engineer",
      "teamName": "Growth",
      "description": "Built React design system used by 3 teams.",
      "startDate": "2021-03-01",
      "endDate": null,
      "skills": ["React", "TypeScript", "GraphQL"]
    }
  ],
  "skills": [
    { "name": "React", "expertise": "expert" },
    { "name": "TypeScript", "expertise": "expert" }
  ],
  "projects": [
    { "title": "oss-ui", "description": "Open-source React component library", "github": "https://github.com/u/oss-ui", "url": null }
  ]
}
```

### 2.4 Edge cases

| Scenario | Expected behavior |
| --- | --- |
| Brand-new user (no profile rows) | All lists empty, `locationPreference` null; `isProfileEmpty` true. |
| Location set, no skills/experience | `locationPreference` populated; still treated as "empty" for scoring purposes. |
| Partial experience (no `endDate`) | `endDate: null` (current role); JEV interprets as ongoing. |
| Experience with empty `skills` array | Serialized as `[]`; no crash. |
| DB read error | Propagates; the tool catches and returns a readable failure string. |
| Large skill lists | No truncation here; profile data is small relative to JDs. |

### 2.5 A "profile empty" helper

Expose a helper so the scoring tool can decide whether to short-circuit:

```ts
export function isProfileEmpty(profile: CandidateProfile): boolean {
  return (
    profile.workExperience.length === 0 &&
    profile.skills.length === 0 &&
    profile.projects.length === 0
  );
}
```

Location preference alone (with no skills/experience) is treated as "empty enough" to warn,
since location alone cannot drive a relevance score.

### 2.6 Test plan (manual, no test suite in repo)

1. Fresh user id → `loadCandidateProfile` returns `{ locationPreference: null, workExperience:
   [], skills: [], projects: [] }`; `isProfileEmpty` → `true`.
2. User with only location → `isProfileEmpty` → `true`; location still populated.
3. User with one experience + two skills + one project (created via Profile UI) → all fields
   round-trip with correct ordering (`position` asc).
4. Experience with null `endDate` and empty `skills` → mapped to `null`/`[]` correctly.

Run each via a `tsx` one-liner against a known dev `userId`.

### 2.7 Acceptance criteria

- `server/src/agent/profile-loader.ts` exports `CandidateProfile`, its nested types,
  `loadCandidateProfile(userId)`, and `isProfileEmpty(profile)`.
- Queries read all four tables and preserve ordering.
- `npm run lint -w server` passes.

### 2.8 Alternatives considered

- **Reuse `routes/profile.ts` logic via a shared module.** The CRUD routes return flat,
  per-resource arrays, not a single aggregate; an aggregate is what TypeSafe needs. A dedicated
  loader is cleaner than reusing route handlers.
- **Store a denormalized profile snapshot.** Rejected: reads are cheap and data is small;
  denormalizing adds staleness risk.
- **Include the resume PDF text.** Out of scope; the profile tables already carry the
  structured signal the user listed (location, experience, skills, projects).

### 2.9 Full module listing

```ts
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  userProfiles, workExperiences, skills, projects,
} from "../db/schema";

export interface CandidateLocationPreference {
  city: string | null;
  country: string | null;
  isRemote: boolean;
}

export interface CandidateWorkExperience {
  company: string;
  role: string;
  teamName: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  skills: string[];
}

export interface CandidateSkill {
  name: string;
  expertise: "beginner" | "intermediate" | "expert";
}

export interface CandidateProject {
  title: string;
  description: string | null;
  github: string | null;
  url: string | null;
}

export interface CandidateProfile {
  locationPreference: CandidateLocationPreference | null;
  workExperience: CandidateWorkExperience[];
  skills: CandidateSkill[];
  projects: CandidateProject[];
}

export function isProfileEmpty(profile: CandidateProfile): boolean {
  return (
    profile.workExperience.length === 0 &&
    profile.skills.length === 0 &&
    profile.projects.length === 0
  );
}

export async function loadCandidateProfile(userId: string): Promise<CandidateProfile> {
  const [location] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  const experiences = await db
    .select()
    .from(workExperiences)
    .where(eq(workExperiences.userId, userId))
    .orderBy(workExperiences.position);

  const skillRows = await db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId));

  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId));

  return {
    locationPreference: location
      ? {
          city: location.city,
          country: location.country,
          isRemote: location.isRemote,
        }
      : null,
    workExperience: experiences.map((e) => ({
      company: e.company,
      role: e.role,
      teamName: e.teamName,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      skills: e.skills ?? [],
    })),
    skills: skillRows.map((s) => ({ name: s.name, expertise: s.expertise })),
    projects: projectRows.map((p) => ({
      title: p.title,
      description: p.description,
      github: p.github,
      url: p.url,
    })),
  };
}
```

### 2.10 Column → field mapping

| Table | Column | Profile field | Null handling |
| --- | --- | --- | --- |
| `user_profiles` | `city` | `locationPreference.city` | `string \| null` |
| `user_profiles` | `country` | `locationPreference.country` | `string \| null` |
| `user_profiles` | `is_remote` | `locationPreference.isRemote` | `boolean` (default `false`) |
| `work_experiences` | `company` | `workExperience[].company` | non-null |
| `work_experiences` | `role` | `workExperience[].role` | non-null |
| `work_experiences` | `team_name` | `workExperience[].teamName` | `string \| null` |
| `work_experiences` | `description` | `workExperience[].description` | `string \| null` |
| `work_experiences` | `start_date` | `workExperience[].startDate` | non-null text `YYYY-MM-DD` |
| `work_experiences` | `end_date` | `workExperience[].endDate` | `string \| null` (null = current) |
| `work_experiences` | `skills` | `workExperience[].skills` | `string[]` (default `[]`) |
| `skills` | `name` | `skills[].name` | non-null |
| `skills` | `expertise` | `skills[].expertise` | `beginner\|intermediate\|expert` |
| `projects` | `title` | `projects[].title` | non-null |
| `projects` | `description` | `projects[].description` | `string \| null` |
| `projects` | `github` | `projects[].github` | `string \| null` |
| `projects` | `url` | `projects[].url` | `string \| null` |

### 2.11 Ordering and null-semantics notes

- `workExperiences.position` is the single source of ordering; the reorder route
  (`PUT /api/profile/experiences/reorder`) rewrites it, so the loader simply orders by it.
  Do **not** additionally sort by `startDate` in the loader — that would fight the user's
  explicit ordering.
- `startDate`/`endDate` are stored as `text` (`YYYY-MM-DD`) in the schema (not `timestamp`),
  so no date parsing is needed. Pass them through verbatim.
- `skills` and `workExperiences.skills` are Postgres `text[]`; drizzle returns `string[]`.
  Guard with `?? []` for safety even though the column is `notNull().default([])`.

### 2.12 Concrete edge-case walkthroughs

1. **Empty profile** — `loadCandidateProfile` returns all-empty; `isProfileEmpty` true; the
   tool returns "Your profile is empty. Add location, work experience, skills, and projects in
   Profile first." No TypeSafe call is made.
2. **Location-only user** — `locationPreference` is `{ city: "Berlin", country: "DE",
   isRemote: true }`, lists empty. `isProfileEmpty` still true (location cannot drive a match),
   so the tool still short-circuits — by design.
3. **Current role (null endDate)** — `endDate: null` serialized as `null`; JEV treats it as
   ongoing, which increases perceived seniority/recency appropriately.
4. **Duplicate skill names** — the loader does not dedupe; JEV handles minor redundancy fine.
   If it becomes a problem, dedupe by lowercased name in a later pass.
5. **Unicode / non-ASCII names** — passed through unchanged; `JSON.stringify` in the SDK
   serializes UTF-8 correctly.

### 2.13 Performance notes

- All four tables already have a `user_id` index (see `server/src/db/schema.ts`:
  `user_profiles_user_id_idx` is unique, `work_experiences_user_id_idx`, `skills_user_id_idx`,
  `projects_user_id_idx`). The loader's lookups are indexed point queries.
- The result set is a single user's profile — at most dozens of rows — so no pagination or
  batching is required.

---

## Subtask 3 — Relevance scoring engine

### Objective

Implement the core TypeSafe integration: given a candidate profile and a list of open roles
(each with a JD), produce a ranked list of the top 5 roles. This is pure TypeScript that:

1. Builds the `state` (candidate + jobs).
2. Builds one `score` question per job with a concrete rubric.
3. Calls `systemOne` once (fan-out).
4. Normalizes, sorts, and returns the top 5 with scores, confidence, and probabilities.

### Files touched

- `server/src/agent/relevance-scorer.ts` — **new**.

### 3.1 Input type — open roles

The tool (Subtask 4) receives roles from the agent. Define:

```ts
export interface OpenRole {
  id: string;          // stable key, e.g. slug or index the agent assigns
  title: string;       // role title, e.g. "Senior Frontend Engineer"
  company?: string;    // optional; the company under research
  location?: string;   // "Remote" or "SF, CA", etc.
  url?: string;        // link to the JD
  description: string; // the JD text
}
```

The `id` must be unique within a request because it is used both to key the question and to
map answers back to roles. If the agent cannot supply ids, the tool assigns
`job_${index}`.

### 3.2 Rubric

A relevance rubric with 6 levels (0–5). Each level must describe a concrete *situation*, not
a degree (per the TypeSafe "Writing good levels" guidance):

```
0 — "No overlap: the candidate's skills, domain, and seniority are entirely different from
     what the role requires."
1 — "Weak match: the candidate has only a few tangential skills or an adjacent domain, and
     none of the role's core requirements."
2 — "Partial match: the candidate meets some core skills or has adjacent experience but is
     missing key requirements or the right seniority."
3 — "Reasonable match: the candidate meets most core skills and has relevant experience,
     with a few gaps that are learnable."
4 — "Strong match: the candidate meets the core skills and experience, with only minor gaps
     in nice-to-haves."
5 — "Excellent match: the candidate meets or exceeds requirements across skills, experience,
     and domain."
```

This rubric is a single dimension ("overall relevance of candidate to role"). It is chosen
over a composite of multiple score questions for simplicity and because the user's ask is a
single "how relevant" judgment. Composite scoring (skill match + experience match + location
fit, combined by code weights) is documented as an optional enhancement in §3.8.

Each level is a standalone description; JEV never sees level numbers, so "worse than the
previous" phrasing is avoided. Levels describe situations the model can match a JD against.

### 3.3 State shape

The `state` for `systemOne` is one object containing the candidate and all jobs:

```ts
const state = {
  candidate: profile,   // CandidateProfile, from Subtask 2
  jobs: roles.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company ?? null,
    location: r.location ?? null,
    url: r.url ?? null,
    description: r.description,
  })),
};
```

JEV can reference nested state by backticked path in instructions (e.g. `` `jobs[0].title` ``).

### 3.4 Question fan-out

One `score` question per job, keyed by `job_${index}`. The instructions reference the specific
job by path so the model evaluates the right JD:

```ts
import { score } from "@typesafe-ai/sdk";

const RUBRIC = [ /* 6 strings from §3.2 */ ] as const;

function buildQuestions(roles: OpenRole[]) {
  const questions: Record<string, ReturnType<typeof score>> = {};
  roles.forEach((_, i) => {
    questions[`job_${i}`] = score(
      `How relevant is the candidate's profile to the job described in \`jobs[${i}]\`? ` +
      `Consider required skills, seniority, domain, and (when stated) the role's location ` +
      `against the candidate's location preference.`,
      RUBRIC,
    );
  });
  return questions;
}
```

Key points:

- Question IDs (`job_0`, …) are for code only; they are not sent to the model.
- All questions are answered in parallel within a single request — one HTTP call regardless of
  the number of roles (fan-out pattern). This keeps latency near-constant as the role count
  grows (bounded by token limits).
- The same rubric is reused for every job, so scores are directly comparable and ranking is
  meaningful.

### 3.5 Calling TypeSafe and mapping answers

```ts
export async function scoreRolesForCandidate(
  profile: CandidateProfile,
  roles: OpenRole[],
): Promise<RankedRole[]> {
  const client = getTypeSafeClient();
  const response = await client.systemOne({
    state: { candidate: profile, jobs: roles.map(/* ... */) },
    questions: buildQuestions(roles),
  });

  const maxLevel = RUBRIC.length - 1; // 5

  const ranked = roles.map((role, i) => {
    const answer = response.answers[`job_${i}`];
    return {
      rank: 0, // filled after sorting
      title: role.title,
      location: role.location ?? null,
      url: role.url ?? null,
      score: answer.score,                       // 0..5, may be fractional
      normalizedScore: answer.score / maxLevel,  // 0..1
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      legend: answer.legend,
    };
  });

  ranked.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  ranked.forEach((r, i) => { r.rank = i + 1; });

  return ranked;
}
```

Notes:

- `answer.score` is the probability-weighted mean of level numbers (0..5 here). It can land
  between levels.
- Sort by `score` desc, tiebreak by `confidence` desc. (Lower-confidence ties are ranked below
  clearer ones.)
- `normalizedScore` is 0..1, useful for UI bars. Since all jobs share the same rubric, the raw
  score alone is already comparable; normalization is for display only.
- The returned array is the full ranking; the caller (Subtask 4) slices to the top 5.

### 3.6 Top-5 selection and result type

Define the public result type:

```ts
export interface RankedRole {
  rank: number;
  title: string;
  location: string | null;
  url: string | null;
  score: number;          // 0..maxLevel
  normalizedScore: number;// 0..1
  confidence: number;     // 0..1
  probabilities: Record<string, number>;
  legend: Record<string, string>;
}

export interface RelevanceResult {
  ranked: RankedRole[];   // top 5 (or fewer if <5 roles)
  totalScored: number;
  rubric: string[];
}
```

A helper `buildTopRoles(ranked, k = 5)` slices the array. If fewer than `k` roles were
scored, return all of them.

### 3.7 Token budgeting and role-count limits

Large JDs can blow up tokens. Apply a budget:

- Truncate each role's `description` to a max length (e.g. 4000 characters) before sending,
  keeping the head of the JD (which usually contains responsibilities and requirements).
- Cap the number of roles scored in one request (e.g. 25). If the agent supplies more, score
  in chunks and merge, or instruct the agent to limit to the most relevant roles.
- Track `response.usage.input_tokens` for observability; log it server-side at debug level
  (not to the client).

Chunking pseudocode (only needed if > 25 roles):

```ts
const CHUNK = 25;
async function scoreAll(profile, roles) {
  const results: RankedRole[] = [];
  for (let i = 0; i < roles.length; i += CHUNK) {
    const slice = roles.slice(i, i + CHUNK).map((r, j) => ({ ...r, id: `job_${i + j}` }));
    results.push(...await scoreRolesForCandidate(profile, slice));
  }
  return results.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
}
```

For the first iteration, instruct the agent to pass at most ~25 roles and skip chunking unless
the need arises.

### 3.8 Optional enhancement — composite scoring

If a single relevance score proves too coarse, split into per-job score questions
(`skill_match`, `experience_match`, `seniority_fit`, `location_fit`), normalize each by its
own top level, and combine with code weights (e.g. `0.45*skills + 0.30*experience +
0.15*seniority + 0.10*location`). This is the TypeSafe "Composite scoring" pattern. It is
**out of scope for the first iteration** but the module boundary (state + question builders
are already separated) makes it a localized change.

### 3.9 Example request and response

Request body built by `systemOne` (for 2 roles):

```json
{
  "model": "jev-latest",
  "state": {
    "candidate": { "locationPreference": { "city": "SF", "country": "USA", "isRemote": false },
                   "workExperience": [], "skills": [{ "name": "React", "expertise": "expert" }], "projects": [] },
    "jobs": [
      { "id": "job_0", "title": "Senior Frontend Engineer", "location": "Remote",
        "url": "https://acme.com/jobs/1", "description": "5+ years React, TypeScript..." },
      { "id": "job_1", "title": "ML Engineer", "location": "NYC",
        "url": "https://acme.com/jobs/2", "description": "PyTorch, transformers..." }
    ]
  },
  "questions": {
    "job_0": { "type": "score",
               "instructions": "How relevant is the candidate's profile to the job described in `jobs[0]`? ...",
               "criteria": ["No overlap: ...", "Weak match: ...", "Partial match: ...",
                            "Reasonable match: ...", "Strong match: ...", "Excellent match: ..."] },
    "job_1": { "type": "score", "instructions": "How relevant is ... `jobs[1]`? ...", "criteria": ["..."] }
  }
}
```

Response:

```json
{
  "model": "jev-latest",
  "answers": {
    "job_0": { "type": "score", "score": 4.2, "confidence": 0.9,
               "probabilities": { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0.8, "5": 0.2 },
               "legend": { "0": "No overlap: ...", "4": "Strong match: ...", "5": "Excellent match: ..." } },
    "job_1": { "type": "score", "score": 0.3, "confidence": 0.85,
               "probabilities": { "0": 0.7, "1": 0.3, "2": 0, "3": 0, "4": 0, "5": 0 },
               "legend": { "0": "No overlap: ...", "1": "Weak match: ..." } }
  },
  "usage": { "input_tokens": 512, "output_tokens": 30 }
}
```

Ranking: `job_0` (4.2) ranks above `job_1` (0.3). With only 2 roles, both are returned.

### 3.10 Error handling

- `getTypeSafeClient()` throws when key missing → propagate a clear error string upstream.
- SDK `APIError`/`APIConnectionError`/`APITimeoutError` → wrap with context (how many roles,
  which company) and rethrow a typed error the tool can stringify for the agent.
- Empty `roles` → return an empty `RelevanceResult` (the tool handles the user-facing message).
- Zero-scored jobs (no matches) → still rank; the agent may report "no strong matches".

### 3.10b Full module listing

The complete `server/src/agent/relevance-scorer.ts`:

```ts
import { score } from "@typesafe-ai/sdk";
import { getTypeSafeClient, describeTypeSafeError } from "../lib/typesafe";
import type { CandidateProfile } from "./profile-loader";

export const RUBRIC = [
  "No overlap: the candidate's skills, domain, and seniority are entirely different from what the role requires.",
  "Weak match: the candidate has only a few tangential skills or an adjacent domain, and none of the role's core requirements.",
  "Partial match: the candidate meets some core skills or has adjacent experience but is missing key requirements or the right seniority.",
  "Reasonable match: the candidate meets most core skills and has relevant experience, with a few gaps that are learnable.",
  "Strong match: the candidate meets the core skills and experience, with only minor gaps in nice-to-haves.",
  "Excellent match: the candidate meets or exceeds requirements across skills, experience, and domain.",
] as const;

export interface OpenRole {
  id: string;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  description: string;
}

export interface RankedRole {
  rank: number;
  title: string;
  location: string | null;
  url: string | null;
  score: number;
  normalizedScore: number;
  confidence: number;
  probabilities: Record<string, number>;
  legend: Record<string, string>;
}

export interface RelevanceResult {
  ranked: RankedRole[];
  totalScored: number;
  rubric: string[];
}

const MAX_DESCRIPTION_CHARS = 4000;

function truncate(role: OpenRole): OpenRole {
  if (role.description.length <= MAX_DESCRIPTION_CHARS) return role;
  return { ...role, description: role.description.slice(0, MAX_DESCRIPTION_CHARS) };
}

function buildQuestions(roles: OpenRole[]) {
  const questions: Record<string, ReturnType<typeof score>> = {};
  roles.forEach((_, i) => {
    questions[`job_${i}`] = score(
      `How relevant is the candidate's profile to the job described in \`jobs[${i}]\`? ` +
        `Consider required skills, seniority, domain, and (when stated) the role's location ` +
        `against the candidate's location preference.`,
      RUBRIC,
    );
  });
  return questions;
}

export async function scoreRolesForCandidate(
  profile: CandidateProfile,
  roles: OpenRole[],
): Promise<RankedRole[]> {
  if (roles.length === 0) return [];

  const trimmed = roles.map(truncate);
  const client = getTypeSafeClient();

  const response = await client.systemOne({
    state: {
      candidate: profile,
      jobs: trimmed.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company ?? null,
        location: r.location ?? null,
        url: r.url ?? null,
        description: r.description,
      })),
    },
    questions: buildQuestions(trimmed),
  });

  const maxLevel = RUBRIC.length - 1;

  const ranked: RankedRole[] = trimmed.map((role, i) => {
    const answer = response.answers[`job_${i}`];
    return {
      rank: 0,
      title: role.title,
      location: role.location ?? null,
      url: role.url ?? null,
      score: answer.score,
      normalizedScore: answer.score / maxLevel,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      legend: answer.legend,
    };
  });

  ranked.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  ranked.forEach((r, i) => { r.rank = i + 1; });

  return ranked;
}

export function buildTopRoles(ranked: RankedRole[], k = 5): RankedRole[] {
  return ranked.slice(0, k);
}

export function summarizeTopRoles(top: RankedRole[]): string {
  if (top.length === 0) return "No matching roles found.";
  const lines = top.map((r) => {
    const pct = Math.round(r.normalizedScore * 100);
    const loc = r.location ? ` — ${r.location}` : "";
    const link = r.url ? ` — ${r.url}` : "";
    return `${r.rank}. **${r.title}**${loc} — ${pct}% match${link}`;
  });
  return `**Top matching roles:**\n\n${lines.join("\n")}`;
}
```

The Markdown output is intentionally plain (bold title, em-dash separators, raw URL) so it
renders identically in the chat window's `MarkdownRenderer` and in `REPORT.md`. No images,
tables, or complex nesting — a simple ordered list survives both renderers.

Notes:

- `truncate` is applied per role before building state, so both `state.jobs` and `questions`
  operate on the trimmed list (ids stay stable via `job_${i}`).
- `describeTypeSafeError` is imported for the tool's use; the scorer itself lets errors
  propagate to the tool, which is the single error-to-string boundary.
- `summarizeTopRoles` is a pure function (easy to test) and lives here so formatting stays next
  to the data shape it formats.

### 3.10c Worked ranking example

Given a candidate with React/TypeScript expertise and a set of open roles, expect JEV to place
the frontend role well above unrelated roles:

| Role | Expected rough score | Reason |
| --- | --- | --- |
| Senior Frontend Engineer (React, TS) | 4–5 | Core skills match, seniority matches |
| Frontend Engineer (React) | 3–4 | Skills match, seniority lower than candidate |
| Full-stack Engineer (React + Node) | 3–4 | Partial skill overlap |
| Backend Engineer (Go) | 0–1 | No overlap |
| ML Engineer (PyTorch) | 0 | No overlap |

The exact numbers are JEV's call; the test only asserts *relative ordering* (frontend > full
stack > backend/ML) and that scores fall in `[0, 5]`.

### 3.10d Confidence semantics

- `confidence` describes how concentrated the probability distribution is, **not** correctness.
- A role scoring `4.0` with confidence `1.0` (all mass on level 4) is a clear call; `4.0` with
  confidence `0.3` (mass spread over levels 2–5) is ambiguous.
- We use confidence only as a tiebreaker in ranking and as a subtle UI hint; we never gate the
  ranking on a confidence threshold in the first iteration.

### 3.11 Acceptance criteria

- `server/src/agent/relevance-scorer.ts` exports `OpenRole`, `RankedRole`, `RelevanceResult`,
  `RUBRIC`, `scoreRolesForCandidate`, and `buildTopRoles`.
- One `systemOne` call scores all roles; results sorted score desc / confidence desc.
- `npm run lint -w server` passes.

### 3.12 Verification steps

- Unit-style smoke test via `tsx` with a synthetic profile and 3 synthetic roles; assert
  ordering is stable and scores are within `[0, 5]`.
- Verify a role that exactly matches the profile's skills ranks first in a hand-crafted case.
- Verify truncation keeps `description` under budget.
- Verify empty roles returns empty result without throwing.

---

## Subtask 4 — `rank_open_roles` tool and system-prompt changes

### Objective

Expose the scoring engine to the LLM agent as a new tool, and update the research system
prompt so the agent (a) fetches the company's open roles/JDs and (b) calls the tool, then
lists the top-5 result in its chat reply and writes it into `REPORT.md`.

### Files touched

- `server/src/agent/tools.ts` — add `rank_open_roles`.
- `server/src/agent/research-system-prompt.ts` — update instructions.

### 4.1 Tool definition

Add `rank_open_roles` to the object returned by `createTools`. It follows the same shape as
`add_job_to_wishlist` (closure over `userId`, uses `tool()` from `ai`, zod schema). The tool
returns a **Markdown string** (the ranked top-5 list) so the agent can paste it directly into
its chat reply and into `REPORT.md` — no structured parsing required downstream:

```ts
rank_open_roles: tool({
  description:
    "Rank the company's open roles by how relevant the user's profile is to each role. " +
    "Pass every role you found (with its JD text) and get back the top 5 ranked by relevance, " +
    "formatted as a Markdown list. Use this after collecting the company's open roles from its " +
    "ATS JSON API (or from search results if no ATS resolves).",
  inputSchema: z.object({
    jobs: z.array(
      z.object({
        title: z.string().describe("Role title"),
        location: z.string().optional().describe("Role location, e.g. 'Remote'"),
        url: z.string().optional().describe("Link to the job posting"),
        description: z.string().describe("The job description text"),
      }),
    ).min(1).max(25).describe("Open roles with their job descriptions"),
  }),
  execute: async ({ jobs }) => {
    // 1. Check TypeSafe config
    if (!isTypeSafeConfigured()) {
      return "TypeSafe AI is not configured. Set TYPESAFE_API_KEY in server/.env.";
    }
    // 2. Load profile
    const profile = await loadCandidateProfile(userId);
    if (isProfileEmpty(profile)) {
      return "Your profile is empty. Add location, work experience, skills, and projects in Profile first.";
    }
    // 3. Score and format
    try {
      const roles: OpenRole[] = jobs.map((j, i) => ({
        id: `job_${i}`, title: j.title, location: j.location,
        url: j.url, description: j.description,
      }));
      const ranked = await scoreRolesForCandidate(profile, roles);
      const top = buildTopRoles(ranked, 5);
      return summarizeTopRoles(top);
    } catch (err) {
      return `Could not rank roles: ${describeTypeSafeError(err)}`;
    }
  },
}),
```

Return shape rationale:

- The tool returns a **plain Markdown string** (not a structured object), so the `streamText`
  pipeline passes it straight back to the model as a string tool result. The model then echoes
  it in its chat reply and drops the same text into `REPORT.md`.
- This keeps the feature to server + prompt changes only: no SSE events, no session
  persistence, and no client code.
- The `description` explicitly instructs *when* to call it and *what the result looks like*
  (a Markdown list), which improves tool-selection reliability in the Vercel AI SDK.

`summarizeTopRoles(top)` produces a Markdown fragment, e.g.:

```
**Top matching roles:**

1. **Senior Frontend Engineer** — Remote — 84% match — https://acme.com/jobs/1
2. **Frontend Engineer** — SF — 71% match — https://acme.com/jobs/2
3. **Product Engineer** — Remote — 58% match — https://acme.com/jobs/3
```

The exact format is defined once in `summarizeTopRoles` (Subtask 3) so the chat reply and the
report stay consistent.

### 4.2 System-prompt update

Edit `server/src/agent/research-system-prompt.ts`. Add `rank_open_roles` to the tools list
and insert a new directive into the guidance. Add a tenth pillar for open roles.

Add to the TOOLS AVAILABLE list:

```
- rank_open_roles(jobs): Rank the company's open roles by how relevant the user's profile is.
  Pass an array of { title, location?, url?, description } — the description is the JD text.
  Returns the top 5 most relevant roles as a Markdown list with match scores.
- add_job_to_wishlist(company, role, jobUrl?, tags?): Add a job to the user's wishlist on the
  jobs board. Call this when the user asks to save one of the ranked roles (e.g. "add the
  Senior Frontend Engineer role to my wishlist").
```

Add a pillar:

```
10. **Open Roles & Fit** — All open roles with their JDs, ranked by relevance to the user's
    profile (top 5 shown).
```

Add guidance bullets:

```
- When the user asks about a company's open roles (or when researching a company in general),
  collect the company's open roles from its ATS JSON API (see the ATS resolution steps in
  §4.3), then rank them. Always tell the user what you are doing at each step (which ATS you
  are trying, whether you are falling back to search, etc.).
- Call rank_open_roles once with ALL collected roles and their JD text. Then:
  * Paste the returned Markdown list verbatim into your chat reply so the user sees it
    immediately.
  * Also add it under the "Open Roles & Fit" pillar in REPORT.md.
- If the user asks to save one of the ranked roles to their wishlist (e.g. "add the first one
  to my wishlist"), call add_job_to_wishlist with the role's title, company, and job URL.
- Never invent roles or JD text. Only pass roles you actually found.
- If rank_open_roles returns a message saying the profile is empty or TypeSafe is not
  configured, tell the user how to fix it (complete Profile, or set the API key) and continue
  with the rest of the research.
```

### 4.3 JD collection order (prompt-level)

Most companies don't build custom job boards — they run one of a handful of Applicant
Tracking Systems (ATS) that expose public JSON APIs. Collect open roles in the following
order of preference, stopping once you have usable JDs. Add a dedicated "COLLECTING OPEN
ROLES" block to the system prompt with the steps below.

**Step 0 — User-supplied URL.** If the user gave a specific careers/jobs URL (or a link to a
specific posting), `web_fetch` it directly first. It often lists roles outright or reveals
which ATS the company uses.

**Step 1 — ATS JSON API (preferred).** Guess the company's slug (usually the lowercase company
name with spaces/punctuation stripped; often the primary domain). Probe the endpoints in
order, stopping at the first that returns a valid JSON jobs payload:

```
Greenhouse:       https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
Lever:            https://api.lever.co/v0/postings/{slug}?mode=json
Ashby:            https://api.ashbyhq.com/posting-api/job-board/{slug}
SmartRecruiters:  https://api.smartrecruiters.com/v1/companies/{slug}/postings
Workday:          https://{slug}.wd1.myworkdayjobs.com/wday/cxs/{slug}/{board}/jobs
```

Workday's slug/board format varies per tenant, so it is tried last and may need adjustment.

**Step 2 — Parse the JSON, no HTML parsing.** For each job object, capture: title, location
(if present), the posting URL, and the JD text. Field names vary by ATS (e.g. `title`/`name`,
`location`, `url`/`absolute_url`/`hostedUrl`/`applyUrl`, `content`/`description`). Strip any
HTML tags to plain text; prefer the longest, most complete JD text available.

**Step 3 — Careers-page fallback.** If no ATS resolves (unknown slug, or the company uses a
custom board), `web_fetch` the company's careers page and follow links to each role's detail
page to collect JDs. This is a fallback, not the first choice, because JS-rendered careers
pages return nothing useful through `web_fetch`.

**Step 4 — Search fallback.** If both the ATS and the careers page fail (e.g. JS-rendered
page), fall back to a search-engine search for openings relevant to the user's profile (e.g.
fetch `https://html.duckduckgo.com/html/?q={company} {role} job`, then follow promising
links). Collect the roles found, rank them, and tell the user you switched to search-based
discovery.

**Step 5 — Handle the "too many openings" case.** If the company has hundreds/thousands of
openings (e.g. Amazon, Qualcomm), scoring all of them is not feasible. Tell the user there are
too many openings, give them the careers-page link, and ask for the URL(s) of the specific
roles they think are relevant; fetch and rank only those. Do not silently sample — confirm
scope with the user.

In every branch, narrate progress in the chat: "Fetching the role you linked…", "Resolving
Acme's ATS…", "No ATS found — trying the careers page", "Career page is JS-rendered —
searching for openings instead", "Acme has 3,400 openings — too many to rank all; here's the
careers page, send me specific role URLs".

**Final step — Rank.** Call `rank_open_roles` once with all collected roles (or the
user-selected subset), then paste the result into the chat reply and `REPORT.md` per §4.2.

### 4.4 Sharing `createTools` vs a research-only tool

`createTools` is shared by both the resume agent (`server/src/agent/orchestrator.ts`) and the
research agent (`server/src/agent/research-orchestrator.ts`). Adding `rank_open_roles` to the
shared set makes it available to both. That is acceptable: the resume agent would simply
never be prompted to call it. If we later want stricter separation, extract a
`createResearchTools` variant — but that is not required for this change.

### 4.5 Imports required in `tools.ts`

Add these imports at the top of `server/src/agent/tools.ts`:

```ts
import { isTypeSafeConfigured, describeTypeSafeError } from "../lib/typesafe";
import { loadCandidateProfile, isProfileEmpty } from "./profile-loader";
import {
  scoreRolesForCandidate, buildTopRoles, summarizeTopRoles,
  type OpenRole,
} from "./relevance-scorer";
```

`summarizeTopRoles` can live in `relevance-scorer.ts` (as a pure function over `RankedRole[]`)
or in `tools.ts`; placing it in `relevance-scorer.ts` keeps formatting near the ranking logic
and reusable in tests. `RUBRIC` is no longer needed by the tool (it is internal to the scorer),
so it is not imported here.

### 4.6 Edge cases in the tool

| Scenario | Tool output (string) |
| --- | --- |
| No `TYPESAFE_API_KEY` | `"TypeSafe AI is not configured. Set TYPESAFE_API_KEY in server/.env."` |
| Empty profile | `"Your profile is empty. Add location, work experience, skills, and projects in Profile first."` |
| `jobs` empty/absent | zod `.min(1)` rejects before execution; the SDK surfaces a validation error to the model. |
| TypeSafe API error | `"Could not rank roles: <describeTypeSafeError message>"` |
| < 5 roles passed | Returns a Markdown list of all scored roles. |
| 25+ roles passed | zod `.max(25)` rejects; prompt instructs agent to cap at ~25. |

### 4.7 Acceptance criteria

- `rank_open_roles` present in `createTools` with a zod schema `{ jobs: [...] }`.
- System prompt documents the tool, adds the "Open Roles & Fit" pillar, and adds ATS-collection
  guidance.
- Tool returns a **Markdown string** (top ≤5 roles with match %) on success, and a plain
  friendly message on failure; no structured object, no SSE, no persistence.
- `npm run lint -w server` passes.

### 4.8 Verification steps

- Run the research agent against a real company with an ATS JSON API; confirm the agent probes
  the ATS, collects roles, and calls `rank_open_roles` (visible as a `tool_call` entry in the
  client log).
- Confirm the agent pastes the ranked list into its chat reply **and** writes it into
  `REPORT.md` under the "Open Roles & Fit" pillar.
- Confirm friendly messages appear when the profile is empty or the key is missing.

### 4.9 `tools.ts` before/after

**Before** (the `createTools` return object ends after `add_job_to_wishlist`):

```ts
    add_job_to_wishlist: tool({
      description: "Add a job to the user's wishlist on the jobs board. ...",
      inputSchema: z.object({ ... }),
      execute: async ({ company, role, jobUrl, tags }) => { ... },
    }),
  };
}
```

**After** (insert `rank_open_roles` after `add_job_to_wishlist`, before the closing `};`):

```ts
    add_job_to_wishlist: tool({
      description: "Add a job to the user's wishlist on the jobs board. ...",
      inputSchema: z.object({ ... }),
      execute: async ({ company, role, jobUrl, tags }) => { ... },
    }),

    rank_open_roles: tool({
      description:
        "Rank the company's open roles by how relevant the user's profile is to each role. " +
        "Pass every role you found (with its JD text) and get back the top 5 ranked by relevance, " +
        "formatted as a Markdown list. Use this after collecting the company's open roles from its " +
        "ATS JSON API (or from search results if no ATS resolves).",
      inputSchema: z.object({
        jobs: z
          .array(
            z.object({
              title: z.string().describe("Role title"),
              location: z.string().optional().describe("Role location, e.g. 'Remote'"),
              url: z.string().optional().describe("Link to the job posting"),
              description: z.string().describe("The job description text"),
            }),
          )
          .min(1)
          .max(25)
          .describe("Open roles with their job descriptions"),
      }),
      execute: async ({ jobs }) => {
        if (!isTypeSafeConfigured()) {
          return "TypeSafe AI is not configured. Set TYPESAFE_API_KEY in server/.env.";
        }

        const profile = await loadCandidateProfile(userId);
        if (isProfileEmpty(profile)) {
          return "Your profile is empty. Add location, work experience, skills, and projects in Profile first.";
        }

        try {
          const roles: OpenRole[] = jobs.map((j, i) => ({
            id: `job_${i}`,
            title: j.title,
            location: j.location,
            url: j.url,
            description: j.description,
          }));
          const ranked = await scoreRolesForCandidate(profile, roles);
          const top = buildTopRoles(ranked, 5);
          return summarizeTopRoles(top);
        } catch (err) {
          return `Could not rank roles: ${describeTypeSafeError(err)}`;
        }
      },
    }),
  };
}
```

### 4.10 System prompt before/after

**Before** (relevant excerpts from `research-system-prompt.ts`):

```
TOOLS AVAILABLE:
- read_files(paths): Read one or more files — pass an array of relative paths
- write_file(path, content): Write content to a file (creates parent directories automatically)
- list_dir(path): List files and directories
- web_fetch(url): Fetch a URL and return its content — HTML pages as article text, JSON APIs
  as raw JSON (e.g. Greenhouse/Lever/Ashby/SmartRecruiters job boards)
...
The report should be structured with these pillars:
1. **Careers Page** — ...
...
9. **News & Risks** — Recent news, controversies, regulatory risks
```

**After**:

```
TOOLS AVAILABLE:
- read_files(paths): Read one or more files — pass an array of relative paths
- write_file(path, content): Write content to a file (creates parent directories automatically)
- list_dir(path): List files and directories
- web_fetch(url): Fetch a URL and return its content — HTML pages as article text, JSON APIs
  as raw JSON (e.g. Greenhouse/Lever/Ashby/SmartRecruiters job boards)
- rank_open_roles(jobs): Rank the company's open roles by how relevant the user's profile is.
  Pass an array of { title, location?, url?, description } — description is the JD text.
  Returns the top 5 most relevant roles with match scores.
- add_job_to_wishlist(company, role, jobUrl?, tags?): Add a job to the user's wishlist on the
  jobs board. Call this when the user asks to save one of the ranked roles.
...
The report should be structured with these pillars:
1. **Careers Page** — ...
...
9. **News & Risks** — Recent news, controversies, regulatory risks
10. **Open Roles & Fit** — All open roles with their JDs, ranked by relevance to the user's
    profile (top 5 shown).
```

And a new guidance block appended to `GUIDELINES:`:

```
- When the user asks about a company's open roles (or when researching a company in general),
  collect the roles from the company's ATS JSON API, then rank them (see "COLLECTING OPEN
  ROLES" below for the endpoint list and failure handling). Tell the user what you are doing
  at each step.
- Call rank_open_roles once with ALL collected roles and their JD text. Then:
  * Paste the returned Markdown list verbatim into your chat reply so the user sees it
    immediately.
  * Also add it under the "Open Roles & Fit" pillar in REPORT.md.
- If the user asks to save one of the ranked roles to their wishlist (e.g. "add the first one
  to my wishlist"), call add_job_to_wishlist with the role's title, company, and job URL.
- Never invent roles or JD text. Only pass roles you actually found.
- If rank_open_roles returns a message saying the profile is empty or TypeSafe is not
  configured, tell the user how to fix it (complete Profile, or set the API key) and continue
  with the rest of the research.
```

Plus a new "COLLECTING OPEN ROLES" block:

```
COLLECTING OPEN ROLES:
- Collect open roles in this order of preference, stopping once you have usable JDs:
  1. If the user gave a specific careers/jobs URL, web_fetch it directly.
  2. Probe the company's ATS JSON API. Guess the slug (usually the lowercase company name)
     and probe in order, stopping at the first valid JSON response:
     * Greenhouse:      https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
     * Lever:           https://api.lever.co/v0/postings/{slug}?mode=json
     * Ashby:           https://api.ashbyhq.com/posting-api/job-board/{slug}
     * SmartRecruiters: https://api.smartrecruiters.com/v1/companies/{slug}/postings
     * Workday:         https://{slug}.wd1.myworkdayjobs.com/wday/cxs/{slug}/{board}/jobs
  3. web_fetch the careers page and follow links to each role's detail page (fallback — a
     JS-rendered careers page returns nothing useful through web_fetch).
  4. Search-engine search for openings relevant to the user's profile (e.g. fetch
     https://html.duckduckgo.com/html/?q={company} {role} job), collect promising roles.
- Parse JSON directly (no HTML parsing). Capture each role's title, location, posting URL,
  and JD text; strip HTML tags from JD fields. Tell the user which source/ATS you used.
- If the company has too many openings to score (hundreds/thousands), do NOT silently sample.
  Tell the user, give them the careers-page link, and ask for the URL(s) of the roles they
  think are relevant; fetch and rank only those.

### 4.11 Prompt-injection / untrusted-content note

The JD text comes from company websites (untrusted content). Because it flows only into the
`state` of a TypeSafe `score` request — and JEV is a System One model that returns a typed
score rather than executing instructions — it cannot inject tool calls into the research
agent. The system prompt still explicitly says "Never invent roles or JD text" and "Only pass
roles you actually found" so the agent does not fabricate inputs. No other mitigation is
required for this feature.

### 4.12 Zod validation behavior in the Vercel AI SDK

The Vercel AI SDK (`ai@^7`) validates tool inputs against `inputSchema` before invoking
`execute`. If the model emits malformed `jobs`, the call is rejected with a validation error
returned to the model as the tool result, and the model can retry with corrected input. The
`.min(1)`/`.max(25)` bounds therefore double as a guard against both empty and over-large
requests.

### 4.13 `web_fetch` JSON pass-through (required code change)

The ATS JSON approach depends on the agent being able to read raw JSON. The current
`web_fetch` (in `server/src/agent/tools.ts`) runs every response through `Readability`, which
is designed for HTML articles and returns nothing useful for `application/json` responses
(most ATS endpoints). Add content-type detection so JSON bodies pass through verbatim:

```ts
web_fetch: tool({
  description:
    "Fetch a URL and return its content. HTML pages are reduced to their main article text; " +
    "JSON APIs (e.g. Greenhouse/Lever/Ashby/SmartRecruiters job boards) are returned as raw JSON.",
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch"),
  }),
  execute: async ({ url }) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return `Failed to fetch: HTTP ${response.status} ${response.statusText}`;
      }
      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();
      if (contentType.includes("application/json") || contentType.includes("+json")) {
        return body;
      }
      const dom = new JSDOM(body, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      return article?.textContent || "Could not extract meaningful content from this page.";
    } catch (err) {
      return `Error fetching ${url}: ${err instanceof Error ? err.message : "Unknown error"}`;
    }
  },
}),
```

Notes:

- JSON is returned as a raw string; the model reads the `jobs`/`postings` array directly from
  it. The tool does not parse/transform JSON itself (keeps the change minimal).
- Content-type detection is heuristic: some endpoints omit the header; for those the
  Readability path still runs and returns an empty/partial result, which the agent interprets
  as "no ATS data" and falls back (per §4.3).
- The updated tool description tells the model it may receive raw JSON, improving reliability.
- This is the only new code change in `tools.ts` beyond `rank_open_roles`.

---

## Subtask 5 — Output formatting and verification

### Objective

Ensure the ranked top-5 roles appear in **both** existing output channels — the chat window
and `REPORT.md` — with no new UI surfaces. This subtask defines the Markdown output contract,
confirms the existing renderers handle it, and specifies the end-to-end verification and
regression checks.

### Files touched

- No new files and no client changes. This subtask is primarily specification + verification.
- The formatting logic (`summarizeTopRoles`) lives in `server/src/agent/relevance-scorer.ts`
  (already added in Subtask 3).
- The only code-level touch, if any, is confirming the system prompt (Subtask 4) is sufficient
  to make the agent paste the list into both channels.

### 5.1 Where the output surfaces

There are exactly two render targets, both already present in the app:

1. **Chat window** — `client/src/views/ResearchView.tsx` renders agent replies with
   `MarkdownRenderer` (`client/src/components/editor/MarkdownRenderer.tsx`). Agent text deltas
   arrive over SSE `message` events and are accumulated into an `agent_text` entry, then
   rendered as Markdown.
2. **`REPORT.md`** — the agent writes the report via the `write_file` tool; the client fetches
   it through `GET /api/research/sessions/:id/report` and renders it with the same
   `MarkdownRenderer` in `client/src/components/research/ReportPanel.tsx`.

Because both channels share `MarkdownRenderer`, a single Markdown string produced by the tool
renders consistently in both places with zero client code changes.

### 5.2 Confirming the shared renderer supports the format

`MarkdownRenderer` uses `react-markdown` with `remark-gfm`. Relevant supported constructs
(verified against `MarkdownRenderer.tsx`):

| Construct | Used by output? | Rendered as |
| --- | --- | --- |
| `**bold**` | Yes (role title) | `strong` → `font-medium text-brand-ink` |
| Ordered list `1. …` | Yes (rank list) | `ol` → `list-decimal` |
| Links `[text](url)` / raw URL | Yes (JD link) | `a` → `target="_blank" rel="noopener noreferrer"` |
| Paragraphs | Yes | `p` → `text-brand-body` |
| Headings `##` | Only in REPORT.md pillar | `h2` → `text-sm font-semibold` |
| Em dash `—` | Yes (separator) | Plain text (no special handling) |
| Tables | No | Not used by the output |

The output deliberately avoids tables and images so it degrades gracefully and stays simple.
Raw URLs are auto-linked by `react-markdown`/`remark-gfm` in most cases, but the formatter
emits the URL as plain text after an em dash, which `remark-gfm`'s autolink extension handles
for `http://`/`https://` links when enabled. To be safe, the formatter can emit an explicit
Markdown link (`[url](url)`) instead of a raw URL — see §5.5 for the final contract.

### 5.3 `REPORT.md` update path

The agent already keeps `REPORT.md` updated through the `write_file` tool. The new pillar is a
section the agent appends/updates during research:

- After `rank_open_roles` returns, the agent updates `REPORT.md`, adding or refreshing the
  `## Open Roles & Fit` section with the returned list.
- The existing guidance "Always read REPORT.md first before updating it (use read_files)" still
  applies; the agent must preserve the other nine pillars.
- The client's `ReportPanel` re-fetches `REPORT.md` after the stream ends (`loadReport` is
  called on `done` when the panel is open), so the new pillar appears without any client change.

### 5.4 Chat window update path

The chat window shows the agent's prose reply. The prompt (Subtask 4) instructs the agent to
paste the returned Markdown list verbatim into its reply. No store, SSE, or component change is
needed: the list flows through the normal `message` SSE deltas and renders via
`MarkdownRenderer`.

### 5.5 Final Markdown output contract

`summarizeTopRoles` returns the following exact shape (single function, single source of
truth):

```
**Top matching roles:**

1. **Senior Frontend Engineer** — Remote — 84% match — [Job](https://acme.com/jobs/1)
2. **Frontend Engineer** — SF — 71% match — [Job](https://acme.com/jobs/2)
3. **Product Engineer** — Remote — 58% match — [Job](https://acme.com/jobs/3)
```

Rules:

- One heading line `**Top matching roles:**` followed by a blank line.
- One ordered-list item per role (rank 1..5, or fewer if fewer roles).
- Item format: `<rank>. **<title>** — <location> — <pct>% match — [Job](<url>)`.
- `location` omitted when null/empty; `[Job](<url>)` omitted when `url` is null.
- `pct` = `Math.round(normalizedScore * 100)`.
- Empty result returns the string `No matching roles found.`

The formatter uses an explicit `[Job](url)` link rather than a raw URL to guarantee a clickable
link in both renderers without relying on autolink behavior.

Corresponding code (already specified in Subtask 3, repeated here for the contract):

```ts
export function summarizeTopRoles(top: RankedRole[]): string {
  if (top.length === 0) return "No matching roles found.";
  const lines = top.map((r) => {
    const pct = Math.round(r.normalizedScore * 100);
    const loc = r.location ? ` — ${r.location}` : "";
    const link = r.url ? ` — [Job](${r.url})` : "";
    return `${r.rank}. **${r.title}**${loc} — ${pct}% match${link}`;
  });
  return `**Top matching roles:**\n\n${lines.join("\n")}`;
}
```

### 5.6 No client changes — rationale

- Both targets already render Markdown through the same `MarkdownRenderer`.
- The ranking is produced server-side and delivered as ordinary agent text (chat) or file
  content (report), not as a new structured payload.
- Therefore there is no new SSE event, no `topRoles` store field, no `TopRolesPanel`, and no
  `rightPanelTab`. The feature is fully contained in server code + the research system prompt.

### 5.7 Sample `REPORT.md` excerpt

```markdown
## Open Roles & Fit

The company lists the following open roles. Ranked by relevance to your profile:

**Top matching roles:**

1. **Senior Frontend Engineer** — Remote — 84% match — [Job](https://acme.com/jobs/1)
2. **Frontend Engineer** — SF — 71% match — [Job](https://acme.com/jobs/2)
3. **Product Engineer** — Remote — 58% match — [Job](https://acme.com/jobs/3)
```

The agent places this under the tenth pillar, after the existing nine. The `ReportPanel`'s
table-of-contents parser (`parseToc`) picks up `##` headings, so "Open Roles & Fit" appears in
the contents list automatically.

### 5.8 Sample chat reply excerpt

```
Here are the open roles at Acme, ranked by how well they match your profile:

**Top matching roles:**

1. **Senior Frontend Engineer** — Remote — 84% match — [Job](https://acme.com/jobs/1)
2. **Frontend Engineer** — SF — 71% match — [Job](https://acme.com/jobs/2)
3. **Product Engineer** — Remote — 58% match — [Job](https://acme.com/jobs/3)
```

The user sees this immediately in the chat log; the same text lands in `REPORT.md`.

### 5.9 Edge cases and rendering checks

| Scenario | Expected rendering |
| --- | --- |
| Role with no location | `1. **Title** — 84% match — [Job](url)` (location segment dropped) |
| Role with no URL | `1. **Title** — Remote — 84% match` (link dropped) |
| Fewer than 5 roles | List shows all scored roles (1..N) |
| Zero roles / no match | `No matching roles found.` |
| Missing key / empty profile | Friendly string (from Subtask 4) shown instead of a list |
| Title containing Markdown chars (e.g. `C++`) | Bold wraps the literal title; `C++` renders fine as text |

### 5.10 Verification steps (manual, end-to-end)

1. Populate a profile (location + a few skills + one experience) in the Profile view.
2. Start a research session: "Research Acme and rank their open roles for me."
3. Confirm the agent probes the ATS JSON API, collects roles, and calls `rank_open_roles`
   (visible as a `tool_call` entry).
4. Confirm the chat window shows the ranked Markdown list (bold titles, ordered list, links).
5. Confirm `REPORT.md` (right panel) contains an `## Open Roles & Fit` section with the same
   list, and the contents nav lists it.
6. Reload the session; confirm the report still shows the pillar (it is persisted in
   `REPORT.md`, not in session state).
7. Click a job link; confirm it opens in a new tab (`target="_blank"`).

### 5.11 Regression checks

- The existing nine pillars in `REPORT.md` are unchanged and still render.
- The wishlist tool (`add_job_to_wishlist`) and the rest of the research flow are unaffected.
- `npm run lint -w server` passes; `npm run lint -w client` passes (no client edits).
- `npm run build` passes (client then server).

### 5.12 Acceptance criteria

- `summarizeTopRoles` returns the Markdown contract in §5.5.
- The agent pastes the list into the chat reply and `REPORT.md` (prompt-driven, verified
  manually).
- No client code, store, SSE, or component changes introduced.
- Both renderers display the list correctly (bold titles, ordered list, links).

### 5.13 Full end-to-end sequence

Numbered trace of one successful research turn, from user input to both outputs:

1. User types "Research Acme and tell me which open roles fit me." and hits send.
2. `ResearchView.handleSend` calls `store.createSession(...)`, then `connectSSE(sid, token)`.
3. Server `POST /api/research/sessions` stores the session; `GET .../stream` opens SSE.
4. `runResearchStream` runs `streamText` with the updated system prompt.
5. Agent resolves the ATS and calls
   `web_fetch("https://boards-api.greenhouse.io/v1/boards/acme/jobs")` → tool returns raw JSON
   (per §4.13).
6. Agent parses the JSON to collect each role's title, location, URL, and JD text (no HTML
   parsing).
7. Agent calls `rank_open_roles({ jobs: [...] })` with the collected roles.
8. Tool `execute` loads the profile (`loadCandidateProfile`), scores all roles in one
   `systemOne` call, ranks, slices to 5, and returns `summarizeTopRoles(top)` — a Markdown
   string.
9. `streamText` returns that string to the model as the tool result; the client shows the
   `tool_call`/`tool_result` entries in the chat log (collapsed tool group).
10. Agent emits a `message` delta containing the Markdown list → chat window renders it via
    `MarkdownRenderer` (bold, ordered list, links).
11. Agent calls `write_file("REPORT.md", ...)` adding the `## Open Roles & Fit` section.
12. Stream emits `done`; `researchStore` calls `loadReport`; `ReportPanel` fetches and renders
    the updated `REPORT.md`.

### 5.14 Prompt-effectiveness notes

The success of "paste into both channels" hinges on the system prompt. Mitigations already in
Subtask 4:

- The tool's `description` states the result is "formatted as a Markdown list".
- The `rank_open_roles` guidance bullet explicitly says: "Paste the returned Markdown list
  verbatim into your chat reply … Also add it under the Open Roles & Fit pillar in REPORT.md."
- The pillar list gives the agent a concrete heading to write under.

If manual testing shows the agent sometimes omits the chat reply or the report section, tighten
the wording further (e.g. "You MUST include the list in both places"). No code change is needed
for prompt iteration.

### 5.15 Failure modes and fallback rendering

| Failure | User sees |
| --- | --- |
| TypeSafe key missing | Agent replies with the configure-key message (not a list). |
| Empty profile | Agent replies with the fill-profile message (not a list). |
| TypeSafe API error | Agent replies "Could not rank roles: …". |
| Agent extracts zero roles | Agent says no open roles found; no `rank_open_roles` call. |
| No ATS JSON API resolves | Agent falls back to the careers page, then search (per §4.3). |
| Career page JS-rendered (web_fetch empty) | Agent falls back to search; agent tells the user. |
| Too many openings (hundreds/thousands) | Agent stops, gives the careers-page link, asks the user for specific role URLs, ranks only those. |
| Agent forgets to update `REPORT.md` | Chat still shows the list; report omits the pillar (prompt iteration fix). |
| Link has no `http(s)` scheme | `[Job](url)` still renders, but may be treated as a relative link; formatter passes the URL as provided by the agent. |

### 5.16 Single source of truth

`summarizeTopRoles` is the only place the ranked list is formatted. The chat reply and
`REPORT.md` both originate from that one string, so they cannot drift. If the format changes,
only one function changes.

### 5.17 Cost and latency notes

- One `systemOne` request scores all roles (fan-out); latency is roughly one model call,
  independent of role count (bounded by token limits).
- Cost is proportional to total JD tokens + a small per-question overhead; 25 roles is the
  hard cap, typical cases are far smaller.
- Rendering the list is free (pure client Markdown), and no extra storage is written beyond the
  existing `REPORT.md`.

### 5.18 Alternatives considered (and rejected)

- **Dedicated "Top Roles" panel** (`TopRolesPanel` + tab toggle + `top_roles` SSE event +
  `topRoles` session field): rejected per product direction — the ranking belongs in the
  conversation and the report, not in a new UI surface. This also removes all client work.
- **Structured tool result** (object with `ranked` array): no longer needed without a dedicated
  panel; a plain Markdown string is simpler and flows directly into both renderers.
- **Persisting the ranking in `session.json`**: unnecessary now; `REPORT.md` already persists
  the result, and reloading the session re-fetches it.

### 5.19 File-level change summary (whole feature)

| File | Change |
| --- | --- |
| `server/package.json` | Add `@typesafe-ai/sdk` |
| `server/.env.example` | Document `TYPESAFE_API_KEY` |
| `server/src/lib/typesafe.ts` | **New** — `TypeSafeClient` singleton + error mapping |
| `server/src/agent/profile-loader.ts` | **New** — `loadCandidateProfile` + `isProfileEmpty` |
| `server/src/agent/relevance-scorer.ts` | **New** — rubric, `scoreRolesForCandidate`, `buildTopRoles`, `summarizeTopRoles` |
| `server/src/agent/tools.ts` | Add `rank_open_roles` tool; make `web_fetch` return raw JSON for JSON content-types |
| `server/src/agent/research-system-prompt.ts` | Add tool, pillar, and guidance |
| `client/**` | **No changes** |
| `server/src/agent/research-orchestrator.ts` | **No changes** |
| `server/src/agent/research-session-store.ts` | **No changes** |

The feature is therefore fully server-side plus prompt text. There are no migration,
persistence, SSE, or client-review concerns.

### 5.20 UX and accessibility notes

- The ranked list is plain Markdown: an ordered list with bold titles and descriptive links.
  Screen readers announce list items and link text; the "84% match" suffix is real text, not a
  color-only or image-only indicator.
- Links open in a new tab via `MarkdownRenderer`'s `a` component (`target="_blank"
  rel="noopener noreferrer"`), which is already applied to every rendered link.
- The chat reply keeps the list inline with the agent's prose, so the user sees context
  (which company, how many roles) without switching views. The same list in `REPORT.md`
  provides a persistent, reviewable record.
- Because both surfaces use the same tokens (`brand-ink`, `brand-body`, `brand-link`), the
  list is visually consistent with the rest of the research view.

### 5.21 Definition of done

The feature is done when, for a populated profile and a valid API key:

- Researching a real company with open roles produces a ranked top-5 list.
- The list appears in the chat reply and in `REPORT.md` under `## Open Roles & Fit`.
- Missing key, empty profile, and TypeSafe errors degrade to friendly messages.
- No client files changed; `npm run lint -w server` and `npm run build` pass.

---

## 7. Rollout and verification checklist

Order of implementation: Subtask 1 → 2 → 3 → 4 → 5.

- [ ] `@typesafe-ai/sdk` installed (server).
- [ ] `TYPESAFE_API_KEY` in `.env` and documented in `.env.example`.
- [ ] Profile aggregation + scoring + tool + prompt complete.
- [ ] `web_fetch` returns raw JSON for JSON content-types (§4.13).
- [ ] JD collection order + fallbacks (URL → ATS → careers page → search) and "too many openings" handling wired into the system prompt (§4.3).
- [ ] Tool returns a Markdown top-5 list; agent pastes it into chat + `REPORT.md`.
- [ ] `npm run lint -w server` passes (no client edits, so client lint/build unchanged).
- [ ] `npm run build` passes (client before server).
- [ ] Manual end-to-end test with a real company, a populated profile, and a valid API key.

## 8. Out of scope (future)

- Composite scoring across multiple dimensions (skill/experience/seniority/location) with code
  weights (documented in §3.8).
- Persisting historical scores per role across sessions (currently the list lives only in the
  chat transcript and `REPORT.md`).
- Auto-fetching ATS JSON endpoints server-side without LLM involvement (deterministic scraping
  outside the agent loop).
- Dedicated search-engine API integration (the search fallback is done via `web_fetch` on a
  search results URL, not a search API).
- Client-side settings UI for the TypeSafe key (key remains server-side).
