# Implementation Plan

Each task ≤~500 LOC. Check off items as completed across sessions.

---

## Phase 1: Project Scaffold & Foundation

- [x] **1.1 Monorepo scaffold**
  - `package.json` with workspaces (`client/`, `server/`)
  - Vite + React + TypeScript for `client/`
  - Express + TypeScript for `server/`
  - Tailwind CSS configured
  - Shared tsconfig, eslint, prettier
  - Dev script: `concurrently` runs Vite dev server + Express with tsx watch
  - **~150 LOC**

- [x] **1.2 Backend foundation**
  - Express server with JSON body parser, CORS, error handler
  - Workspace init: on startup, ensure `~/.switch/{user_id}/{resumes}` exist (per-user)
  - Settings read/write helpers (`getSettings()`, `updateSettings()`)
  - Path resolution utility: resolve relative path → absolute under user's workspace root, block `..`
  - **~200 LOC**

- [x] **1.3 Frontend shell**
  - `App.tsx` with `<BrowserRouter>` + `<Routes>`
  - `<Sidebar>` with 3 nav items: Board, Editor, Settings (use Lucide icons)
  - `<KanbanView>`, `<EditorView>`, `<SettingsView>` as empty placeholder pages
  - Base layout CSS: sidebar fixed left, content area fills remaining
  - **~200 LOC**

- [x] **1.4 Google Auth + User Scoping**
  - Install `@supabase/supabase-js` on client + server
  - `<LoginPage>` with "Sign in with Google" button → Supabase OAuth redirect flow
  - `<AuthContext>` — React context providing `user`, `session`, `login`, `logout`
  - `supabaseClient` utility on frontend for session management
  - `JWT middleware` on server: verify Supabase JWT using service key, extract `user_id` → `req.userId`
  - `ensureUser` on first call: upsert into `users` table (sync from Supabase Auth)
  - `GET /api/auth/me` — return current user profile
  - Protected routes: redirect to `/login` if no valid session
  - File paths scoped: `~/.switch/{user_id}/` instead of `~/.switch/`
  - **~250 LOC**

---

## Phase 2: Backend API Routes

- [x] **2.1 Filesystem API**
  - `GET /api/fs/list` — `fs.readdir` with stats, returns `[{ name, type }]`
  - `GET /api/fs/read` — `fs.readFile`, returns `{ content }`
  - `PUT /api/fs/write` — `fs.writeFile` with `recursive: true`
  - `DELETE /api/fs/delete` — `fs.rm` (file) or `fs.rmdir` (empty dir)
  - `POST /api/fs/mkdir` — `fs.mkdir` with `recursive: true`
  - `POST /api/fs/rename` — `fs.rename`
  - **~200 LOC**

- [x] **2.2 Kanban API**
  - PostgreSQL via Supabase (free tier). Drizzle ORM for schema + migrations.
  - `server/src/db/schema.ts` — tables: `columns`, `cards`, `comments` (all scoped to `user_id`)
  - `server/src/db/seed.ts` — seeds 7 default columns on startup (shared, not per-user)
  - All queries filtered by `req.userId` from JWT middleware
  - `GET /api/kanban` — return `{ columns, cards }` with comments nested under cards (current user only)
  - `PUT /api/kanban` — save reorder (body: `{ columns: [{ id, cardIds[] }] }`)
  - `POST /api/kanban/cards` — create card, `user_id` from JWT, auto-assign position
  - `PATCH /api/kanban/cards/:id` — update card fields (ownership check)
  - `DELETE /api/kanban/cards/:id` — delete card (ON DELETE CASCADE), ownership check
  - `POST /api/kanban/cards/:id/comments` — add comment, `user_id` from JWT
  - `DELETE /api/kanban/comments/:id` — delete single comment, ownership check
  - Migrations run automatically on server start via drizzle-kit
  - Requires `DATABASE_URL` + `SUPABASE_SERVICE_KEY` env vars
  - **~350 LOC**

- [x] **2.3 LaTeX compile + download**
  - `POST /api/latex/compile` — run `pdflatex` twice in project dir, parse `.log` for errors
  - `GET /api/latex/download` — serve compiled PDF as attachment
  - Serve static PDF files from workspace under `/pdfs/` route
  - **~150 LOC**

---

## Phase 3: Agent Backend

Uses [Vercel AI SDK](https://ai-sdk.dev) (`ai` + `@ai-sdk/*` providers) instead of custom orchestration. SDK handles:
- Provider unification (OpenAI, Anthropic, Gemini, DeepSeek — all first-party)
- Tool-calling loop via `streamText()` + `stopWhen: isStepCount(20)`
- Tool format normalization across providers (define once with Zod)

- [x] **3.1 Provider factory**
  - `server/src/agent/provider-factory.ts` — maps `LLMSettings` → AI SDK provider instance
  - OpenRouter: `@ai-sdk/openai` with custom `baseUrl` (default provider for flexibility)
  - OpenAI: `@ai-sdk/openai`
  - Gemini: `@ai-sdk/google`
  - Claude: `@ai-sdk/anthropic`
  - DeepSeek: `@ai-sdk/deepseek`
  - Qwen: `@ai-sdk/openai` with custom `baseUrl`
  - **~50 LOC**

- [x] **3.2 Agent tools**
  - `read_file(path)` — resolve + `fs.readFile`
  - `write_file(path, content)` — resolve + `fs.writeFile` (recursive)
  - `list_dir(path)` — resolve + `fs.readdir` with type
  - `web_fetch(url)` — `fetch` + `@mozilla/readability` → markdown
  - All enforce `..` traversal block
  - Defined as AI SDK tools with Zod schemas
  - **~200 LOC**

- [x] **3.3 Agent orchestrator + SSE**
  - `POST /api/agent/tailor` — accept `{ jobUrl, resumeProjectPath, apiKey?, model? }`, return `{ sessionId }`
  - `GET /api/agent/sessions/:id/stream` — SSE stream
  - Uses `streamText()` + `stopWhen: isStepCount(20)` for tool-calling loop
  - Lifecycle callbacks emit SSE events:
    - `onToolExecutionStart` → `tool_call` event
    - `onToolExecutionEnd` → `tool_result` event
    - `textStream` chunks → `message` events
    - stream end → `done` event
    - catch block → `error` event
  - Session store (in-memory Map, session expires after 15 min idle)
  - System prompt construction (as defined in ARCHITECTURE.md §Agent Design)
  - **~200 LOC**

Dependencies: `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/deepseek`, `zod`

---

## Phase 4: Settings & State

- [x] **4.1 Settings page (frontend + backend)**
  - `GET /api/settings` — return current user's LLM settings (API key masked) from `user_settings` table
  - `PUT /api/settings` — upsert user's LLM settings
  - `<SettingsView>` with form: Provider, API Key (password input), Base URL, Model
  - Save button → `PUT /api/settings`, show success toast
  - **~150 LOC**

- [ ] **4.2 Frontend stores (Zustand)**
  - `authStore`: user, session, isAuthenticated, login, logout, initFromSession
  - `kanbanStore`: columns, cards, fetchBoard, createCard, updateCard, deleteCard, moveCard, addComment
  - `editorStore`: activeFile, openFiles, fileTree, isDirty, compileStatus, pdfUrl, agentSession
  - API client helper: thin wrapper around `fetch` with base URL, auth header injection, JSON handling
  - **~250 LOC**

---

## Phase 5: Kanban Frontend

- [ ] **5.1 Board layout**
  - `<KanbanView>` — horizontal scroll container for columns
  - `<BoardHeader>` — "Job Pipeline" title + card count
  - `<Column>` — renders header + card list, droppable zone (via `@hello-pangea/dnd`)
  - Columns rendered from kanban store's column definitions
  - **~200 LOC**

- [ ] **5.2 Card + drag-and-drop**
  - `<Card>` — compact view: company, role, 1-line comment preview, tags as badges
  - Draggable wrapper (via `@hello-pangea/dnd` `Draggable`)
  - `onDragEnd` handler: update column's `cardIds` array, PUT to `/api/kanban`
  - `<AddCardButton>` — inline button at bottom of each column
  - **~250 LOC**

- [ ] **5.3 Card modal**
  - `<CardModal>` — overlay/modal triggered by clicking a card
  - Fields: Company, Role, Job URL, Resume (text input or file picker), Tags (comma-separated input)
  - `<CommentsSection>` — list of timestamped comments, `<AddCommentForm>` at bottom
  - Save → PATCH card, close modal. Delete button with confirm.
  - "Open Resume" link → navigates to `/editor?project={resumePath}`
  - **~300 LOC**

---

## Phase 6: Editor Frontend

- [ ] **6.1 File tree**
  - `<FileTree>` — fetches `GET /api/fs/list`, renders recursive `<FileNode>`
  - Icons: folder open/closed, file (by extension)
  - Click file → open in editor. Click folder → toggle expand.
  - Right-click context menu: New File, New Folder, Rename, Delete
  - New/Rename inline input. Delete with confirm dialog.
  - **~300 LOC**

- [ ] **6.2 Monaco editor**
  - `<MonacoEditor>` — `@monaco-editor/react`, LaTeX language mode
  - `activeFile` from Zustand store → load content via `GET /api/fs/read`
  - Dirty tracking: compare editor content to last saved state
  - Auto-save on blur or Ctrl+S → `PUT /api/fs/write`
  - File tabs for open files (multi-file workflow)
  - **~200 LOC**

- [ ] **6.3 Toolbar + PDF preview**
  - `<EditorToolbar>` — Compile button, Download PDF button, compile status badge
  - Compile → `POST /api/latex/compile`, show spinner → update `pdfUrl` or set `compileErrors`
  - `<PdfPreview>` — `react-pdf` `<Document>` + `<Page>`, canvas rendering
  - Resizable panel: editor top, PDF preview bottom
  - Download → `window.open('/api/latex/download?...')` triggers browser download
  - **~300 LOC**

- [ ] **6.4 Agent panel**
  - `<AgentPanel>` — collapsible right sidebar
  - Input: Job URL text field + "Tailor Resume" button
  - On start → `POST /api/agent/tailor`, connect to SSE stream via `EventSource`
  - `<StreamLog>` — scrollable log of events
    - `tool_call` → "🔧 Calling {tool}: {args}"
    - `tool_result` → "📄 Result: {summary}"
    - `message` → agent text bubble
    - `error` → red error banner
    - `done` → success banner + "Create Card" button
  - "Create Card" → pre-fill card modal with company/role from session, navigate to kanban
  - **~350 LOC**

---

## Phase 7: Integration & Polish

- [ ] **7.1 Cross-module navigation**
  - Kanban card "Open Resume" → `<Link to="/editor?project={resumePath}">`
  - Editor reads `?project=` query param, loads that project's file tree
  - Agent `done` event → show "Create Card" button that saves to kanban.json + navigates
  - **~150 LOC**

- [ ] **7.2 LaTeX error markers**
  - Parse compile response errors: `[{ file, line, message }]`
  - Map to Monaco markers on the corresponding open file tab
  - Highlight error lines, show hover message
  - If error file not open, show in compile status tooltip
  - **~100 LOC**

- [ ] **7.3 First-run experience**
  - On first login, sync user from Supabase Auth → `users` table
  - `ensureUser` creates workspace dir: `~/.switch/{user_id}/resumes/`
  - Seed `resumes/default/` with a basic LaTeX resume template (`main.tex` + sections)
  - Seed default LLM settings in `user_settings` (empty API key)
  - On frontend first load, if settings have no API key, redirect to `/settings`
  - **~150 LOC**

---

## Summary

| Phase | Tasks | Total LOC (est.) |
|-------|-------|------------------|
| 1. Scaffold & Foundation | 4 | ~800 |
| 2. Backend APIs | 3 | ~600 |
| 3. Agent Backend | 3 | ~450 |
| 4. Settings & State | 2 | ~400 |
| 5. Kanban Frontend | 3 | ~750 |
| 6. Editor Frontend | 4 | ~1150 |
| 7. Integration & Polish | 3 | ~400 |
| **Total** | **22** | **~4550** |
