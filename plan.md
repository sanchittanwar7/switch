# Company Research Feature — Implementation Plan

## Overview

Add a `/research` page with an agentic chat interface for company research. Users provide a company name (and optionally custom pillars/sources), and an AI agent fetches web data and continuously writes a structured report. Past research sessions persist on disk and can be re-opened. Per-user instructions are prepended to every conversation.

**Storage:** Each session is a directory at `~/.lean-switch/{userId}/research/{sessionId}/` containing two files:
- `session.json` — full session data (messages, metadata, token)
- `REPORT.md` — evolving markdown report (written by agent, read by report panel)

No DB table for research sessions. Only `research_instructions` goes in `user_settings`.

**Layout:** Two panels (session list + chat), plus a collapsible right report panel:
- **Left sidebar:** Session history list — click to load/continue any past session
- **Center:** Agentic chat with streaming tool calls
- **Right panel:** Report — collapsed by default; on open, loads `REPORT.md` from filesystem via API, shows last-modified timestamp + refresh button

**Reuses existing infrastructure:**
- Vercel AI SDK v7 (`streamText`, tools, `isStepCount`)
- Existing provider factory (`createModel`)
- Existing tools: `web_fetch`, `read_files`, `write_file`, `list_dir`
- SSE streaming pattern (two-step: POST creates session → GET streams)
- Token-based SSE auth (non-JWT, extracted from query param)
- In-memory session cache + filesystem persistence
- `useSettingsStore` for available models/providers
- Design tokens from `index.css` @theme block

---

## Subtasks

### 1. Database Column — `server/src/db/schema.ts` (~10 LOC)

**Add `research_instructions` column to `user_settings`:**
- `researchInstructions`: `text("research_instructions")` — nullable (default null)

Add the column via a simple direct SQL migration (same pattern as `ensureShareQuestionsColumn` in `workspace.ts`). No new table needed.

---

### 2. Research Session Store — `server/src/agent/research-session-store.ts` (~200 LOC)

Filesystem-only. Similar pattern to existing `session-store.ts` but simpler — no resume path, no DB round-trips.

**Data model:**
```typescript
interface ResearchSession {
  id: string;
  userId: string;
  sessionToken: string;
  title: string;             // e.g. "Stripe" (first user message or company name)
  messages: AgentMessage[];  // reuse existing AgentMessage type
  createdAt: number;
  lastActivityAt: number;
  processing: boolean;
}

interface ResearchSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  lastActivityAt: number;
  messageCount: number;
}
```

**Storage layout:**
```
~/.lean-switch/{userId}/research/{sessionId}/
├── session.json    # full ResearchSession
└── REPORT.md       # markdown report, created/updated by agent
```

**Index for listing:** `~/.lean-switch/{userId}/research/index.json` — array of `{ id, title, createdAt, lastActivityAt }` for fast listing without reading every session.json.

**Functions:**
- `createResearchSession(userId, title, settings)` → `{ sessionId, sessionToken }`
  - Creates directory, writes `session.json`, appends to `index.json`
- `getResearchSession(id, token)` → `ResearchSession | undefined`
  - Validates token + TTL (30 min), updates lastActivityAt
- `loadResearchSessionById(id)` → `ResearchSession | null`
  - Disk read, no token needed (for loading session details via JWT route)
- `listResearchSessions(userId)` → `ResearchSessionSummary[]`
  - Reads `index.json`, sorted by lastActivityAt desc
- `addResearchMessage(id, role, content, extra?)` → void + persist session.json
- `setResearchProcessing(id, bool)` → void + persist
- `deleteResearchSession(userId, id)` → void
  - Removes directory + updates index.json
- `readResearchReport(userId, sessionId)` → `string`
  - Reads `REPORT.md` from session directory, returns content
- `getResearchReportStat(userId, sessionId)` → `{ lastModified: number } | null`
  - Stats `REPORT.md`, returns mtime (for "last updated" display)

**Instructions (DB):**
- `getResearchInstructions(userId)` → `string | null` — reads from `user_settings.research_instructions`
- `setResearchInstructions(userId, instructions)` → void — upserts `user_settings`

**TTL + cleanup:** 30 min inactivity TTL, 5 min cleanup interval (same as existing).

---

### 3. Research System Prompt — `server/src/agent/research-system-prompt.ts` (~80 LOC)

Takes `{ title, instructions? }` and builds the system prompt.

- Role: "You are a company research analyst. You help users gather and synthesize information about companies."
- Company context: `title`
- The agent's tools already include `write_file` — instruct it to write `REPORT.md` after each significant finding:
  ```
  After gathering new information, update REPORT.md in the current directory.
  The report should be structured with these pillars (user can override):
  1. Business Model
  2. Leadership & Team
  3. Product & Technology
  4. Market & Competition
  5. Funding & Financials
  6. Culture & Values
  7. Hiring & Interview Process
  8. News & Risks
  ```
- Default sources (injected into system prompt, not stored per session):
  ```
  Prioritize these sources:
  - Company website (about, careers, blog)
  - Crunchbase
  - LinkedIn
  - Glassdoor
  - Levels.fyi
  - TechCrunch / industry news
  ```
- If user provides custom instructions, prepend them at the top: "The user has provided these custom research instructions: ..."
- Tool guidance: use `web_fetch` extensively, use `write_file` to save REPORT.md
- If user hasn't specified pillars/sources, use defaults (embedded in prompt) but mention you're using defaults
- Be conversational — ask clarifying questions if needed

---

### 4. Research Agent Orchestrator — `server/src/agent/research-orchestrator.ts` (~100 LOC)

Nearly identical to existing `orchestrator.ts` with these differences:

- Uses `buildResearchSystemPrompt()` instead of `buildSystemPrompt()`
- Sets the research workspace as working directory so `write_file` saves `REPORT.md` relative to the session:
  ```
  session workspace = ~/.lean-switch/{userId}/research/{sessionId}/
  ```
- Extends existing tools to resolve paths relative to research workspace (or reuses existing tool factory with different workspace root)
- `stopWhen: isStepCount(30)` (research needs more steps)
- SSE events: `tool_call`, `tool_result`, `message`, `done`, `error`
- No separate "report update" pass — agent writes REPORT.md itself via `write_file` tool, which is the simpler approach
- After `done`, the client can fetch the updated REPORT.md

**Path resolution for research tools:**
Modify `createTools(userId)` to accept an optional `workspaceSubPath` parameter:
```typescript
createTools(userId, "research/{sessionId}")
```
This makes `write_file("REPORT.md", ...)` resolve to `~/.lean-switch/{userId}/research/{sessionId}/REPORT.md`.

If we don't want to modify the existing tools, create a thin wrapper:
```typescript
function createResearchTools(userId: string, sessionId: string) { ... }
```
Same tool definitions, but resolves paths against the research session directory.

---

### 5. Research Routes — `server/src/agent/research-routes.ts` (~250 LOC)

Two routers (same pattern as existing agent routes):

**`researchRouter` (JWT authenticated):**

| Method | Path | Body/Query | Response |
|--------|------|-----------|----------|
| POST | `/api/research/sessions` | `{ message, provider?, model? }` | `{ sessionId, sessionToken }` |
| GET | `/api/research/sessions` | — | `ResearchSessionSummary[]` |
| GET | `/api/research/sessions/:id` | — | `{ id, title, messages, createdAt, sessionToken }` |
| DELETE | `/api/research/sessions/:id` | `{ token }` | `{ success: true }` |
| POST | `/api/research/sessions/:id/messages` | `{ message, token }` | `{ success: true }` |
| GET | `/api/research/sessions/:id/report` | — | `{ content: string, lastModified: number }` |
| GET | `/api/research/instructions` | — | `{ instructions: string \| null }` |
| PUT | `/api/research/instructions` | `{ instructions: string \| null }` | `{ instructions: string \| null }` |

**`researchStreamRouter` (no JWT auth, token-based):**

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/api/research/sessions/:id/stream` | `?token=...` | SSE stream |

**Session creation flow:**
1. User sends message (e.g. "Research Stripe" or "Tell me about Stripe's business model")
2. Extract title from first message (first 80 chars, or use as-is)
3. Fetch user's research instructions from DB
4. Build system prompt with title + instructions
5. Create `ResearchSession`
6. Return `{ sessionId, sessionToken }`

---

### 6. Register Routes in Server — `server/src/index.ts` (~15 LOC)

```typescript
import researchRoutes, { researchStreamRouter } from "./agent/research-routes";

// Stream router first (no JWT auth, token-based):
app.use("/api/research", researchStreamRouter);
// Then JWT-authenticated routes:
app.use("/api/research", authMiddleware, researchRoutes);
```

---

### 7. Research Store (Zustand) — `client/src/stores/researchStore.ts` (~150 LOC)

```typescript
interface ResearchStore {
  // Session list
  sessions: ResearchSessionSummary[];
  loadingSessions: boolean;

  // Active session
  sessionId: string | null;
  sessionToken: string | null;
  title: string;

  // Chat
  messages: LogEntry[];     // reuse LogEntry types from AgentPanel
  status: "idle" | "running" | "done" | "error";

  // Report (separate from session — loaded on demand)
  reportContent: string;
  reportLastModified: number | null;
  reportPanelOpen: boolean;
  loadingReport: boolean;

  // Instructions
  instructions: string | null;
  loadingInstructions: boolean;

  // Model
  selectedModel: string;

  // Actions
  loadSessions: () => Promise<void>;
  createSession: (message: string) => Promise<{ sessionId: string; sessionToken: string }>;
  loadSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  connectSSE: (id: string, token: string) => void;
  startNewSession: () => void;

  // Report
  openReportPanel: () => void;
  closeReportPanel: () => void;
  loadReport: () => Promise<void>;  // loads REPORT.md for current session

  // Instructions
  loadInstructions: () => Promise<void>;
  saveInstructions: (instructions: string | null) => Promise<void>;
}
```

**localStorage keys:**
```
switch_research_sessions  →  { [sessionId]: sessionToken }
switch_research_last      →  { sessionId, sessionToken }
```
Same pattern as AgentPanel's LSPersist.

---

### 8. Sidebar Nav + Route — `client/src/components/Sidebar.tsx` + `client/src/App.tsx` (~25 LOC)

**Sidebar:**
- Add `FlaskConical` (from lucide-react) to imports
- Add nav item: `{ to: "/research", icon: FlaskConical, label: "Research" }`

**App.tsx:**
- Import `ResearchView` from `./views/ResearchView`
- Add route: `<Route path="/research" element={<ResearchView />} />`

---

### 9. Research View (Main Page) — `client/src/views/ResearchView.tsx` (~400 LOC)

Two-panel layout + collapsible right panel (not resizable — simpler):

```
┌──────────────┬──────────────────────────────────────┬─┐
│   Sessions   │              Chat                    │R│  ← toggle button
│   (sidebar)  │                                      │e│
│              │  [model selector]                    │p│
│  + New       │                                      │o│
│  ─────────   │  User: Research Stripe               │r│
│  Stripe      │                                      │t│
│  2h ago      │  Agent: I'll research Stripe...      │ │
│              │                                      │ │
│  Verve       │  [tool calls expanded]               │ │
│  1d ago      │                                      │ │
│              │  [input box]                         │ │
│  ...         │                                      │ │
└──────────────┴──────────────────────────────────────┴─┘
```

When report panel is open:
```
┌──────────────┬─────────────────────────┬──────────────┐
│   Sessions   │         Chat            │   Report     │
│              │                         │              │
│              │                         │ Last updated │
│              │                         │ 2 min ago    │
│              │                         │ [Refresh]    │
│              │                         │              │
│              │                         │ ## Business  │
│              │                         │ Model...     │
└──────────────┴─────────────────────────┴──────────────┘
```

**States:**
1. **Empty (no sessions):** "Research companies to prepare for interviews." + input to start
2. **Session list (no active):** Left panel shows history, center shows welcome + input
3. **Active session (streaming):** Chat streams messages, report not loaded (stale until user opens it)
4. **Active session (done):** Chat complete, input enabled for follow-ups

**Key behaviors:**
- "New Research" button at top of session list
- Click past session → loads messages + session metadata (does NOT auto-load report)
- Report panel: toggle button on right edge → opens, calls `GET /api/research/sessions/:id/report`, shows last modified + refresh
- Model selector in chat header (same dropdown as AgentPanel)
- Instructions button (gear icon) → opens modal
- Input box with simple send (Enter)

**No pillars/sources UI in this view.** They live only in:
1. Defaults embedded in system prompt
2. User's instructions (if they want to customize pillars/sources)
3. Conversation (user can say "focus on culture and funding")

---

### 10. Report Panel Component — `client/src/components/research/ReportPanel.tsx` (~150 LOC)

Right-side panel, collapsed by default.

**Props:** `{ sessionId: string | null }`

**States:**
- **No session:** Empty panel or hidden
- **Loading:** Spinner while fetching REPORT.md
- **No report yet:** "No report generated yet. Continue the conversation and the agent will create one."
- **Report loaded:** Render markdown via `MarkdownRenderer` (existing)

**Header:**
- "Report" title
- Last updated timestamp (from API response `lastModified`)
- Refresh button (re-fetches REPORT.md)
- Close/collapse button

**Fetch behavior:**
- Called when panel opens (no auto-polling)
- User clicks refresh to manually update
- Can also auto-refresh when SSE stream finishes (`done` event → trigger refresh if panel open)

---

### 11. Research Instructions Modal — `client/src/components/research/InstructionsModal.tsx` (~100 LOC)

**Trigger:** Gear icon button in ResearchView header area.

**Modal:**
- Title: "Research Instructions"
- Description: "These instructions are prepended to every research conversation. Use them to customize how the agent researches companies."
- Textarea: multiline, full-width, 8+ rows
- Placeholder: `e.g. "Always check Glassdoor for employee reviews. Focus on EU market presence. Use official sources only."`
- Footer: Save button (PUT `/api/research/instructions`) + Cancel
- Secondary action: "Clear instructions" button (text link, sets to null)

**Indicator:** If instructions exist, show a small badge/dot on the gear icon.

---

### 12. Shared Types — `client/src/types.ts` (~25 LOC)

```typescript
export interface ResearchSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  lastActivityAt: number;
  messageCount: number;
}

export interface ResearchSessionDetail {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: number;
  lastActivityAt: number;
  sessionToken: string;
}

export interface ResearchReport {
  content: string;
  lastModified: number | null;
}
```

---

### 13. Research API Helpers — `client/src/lib/api.ts` (~40 LOC)

```typescript
export function createResearchSession(data: { message: string; provider?: string; model?: string }): Promise<{ sessionId: string; sessionToken: string }>
export function listResearchSessions(): Promise<ResearchSessionSummary[]>
export function getResearchSession(id: string): Promise<ResearchSessionDetail>
export function deleteResearchSession(id: string, token: string): Promise<{ success: boolean }>
export function sendResearchMessage(id: string, message: string, token: string): Promise<{ success: boolean }>
export function getResearchReport(id: string): Promise<ResearchReport>
export function getResearchInstructions(): Promise<{ instructions: string | null }>
export function saveResearchInstructions(instructions: string | null): Promise<{ instructions: string | null }>
```

---

## File Summary

| File | Task | Est. LOC |
|------|------|----------|
| `server/src/db/schema.ts` | Add `research_instructions` column | 5 |
| `server/src/workspace.ts` | Add `ensureResearchInstructionsColumn()` migration | 15 |
| `server/src/agent/research-session-store.ts` | Session CRUD + file persistence + instructions get/set | 200 |
| `server/src/agent/research-system-prompt.ts` | Research-specific system prompt builder | 80 |
| `server/src/agent/research-orchestrator.ts` | StreamText loop with research workspace | 100 |
| `server/src/agent/research-routes.ts` | REST routes + SSE stream route + report endpoint | 250 |
| `server/src/index.ts` | Register research routes | 15 |
| `client/src/stores/researchStore.ts` | Zustand store | 150 |
| `client/src/components/Sidebar.tsx` | Add FlaskConical nav item | 10 |
| `client/src/App.tsx` | Add /research route | 10 |
| `client/src/views/ResearchView.tsx` | Main page: session list + chat + report toggle | 400 |
| `client/src/components/research/ReportPanel.tsx` | Collapsible report panel, loads REPORT.md on open | 150 |
| `client/src/components/research/InstructionsModal.tsx` | Instructions editor modal | 100 |
| `client/src/types.ts` | Shared TypeScript types | 25 |
| `client/src/lib/api.ts` | API helper functions | 40 |

**Total estimated: ~1,550 LOC across 15 files (12 new, 3 modified)**

---

## Execution Order

**Phase 1 — Backend (tasks 1-6):**
1. DB column + migration
2. Research session store
3. Research system prompt
4. Research orchestrator
5. Research routes
6. Register in server index

**Phase 2 — Frontend (tasks 7-13):**
7. Research store
8. Sidebar + route
9. Research view (main page)
10. Report panel
11. Instructions modal
12. Types
13. API helpers

---

## Defaults (embedded in system prompt, not stored)

### Default Research Pillars
1. **Business Model** — Revenue streams, pricing, unit economics
2. **Leadership & Team** — Key executives, founders, board
3. **Product & Technology** — Core products, tech stack, differentiators
4. **Market & Competition** — Market position, competitors, TAM, growth
5. **Funding & Financials** — Funding rounds, investors, valuation, revenue
6. **Culture & Values** — Mission, values, employee sentiment, DEI, remote policy
7. **Hiring & Interview Process** — Interview patterns, roles, compensation
8. **News & Risks** — Recent news, controversies, regulatory risks

### Default Research Sources
- Company website (about, careers, blog, product pages)
- Crunchbase
- LinkedIn
- Glassdoor
- Levels.fyi
- TechCrunch / industry news

---

## Storage Example

After researching Stripe:
```
~/.lean-switch/{userId}/research/
├── index.json                              # [{ id, title, createdAt, lastActivityAt }, ...]
├── a1b2c3d4-...
│   ├── session.json                        # { id, userId, sessionToken, title, messages[], ... }
│   └── REPORT.md                           # # Stripe — Research Report\n\n## Business Model\n...
└── e5f6g7h8-...
    ├── session.json
    └── REPORT.md
```
