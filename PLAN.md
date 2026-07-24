# Implementation Plan

Each task ≤~500 LOC. Check off items as completed across sessions.

---

## Phase 1: Project Scaffold & Foundation

- [ ] **1.1 Monorepo scaffold**
  - `package.json` with workspaces (`client/`, `server/`)
  - Vite + React + TypeScript for `client/`
  - Express + TypeScript for `server/`
  - Tailwind CSS configured
  - Shared tsconfig, eslint, prettier
  - Dev script: `concurrently` runs Vite dev server + Express with tsx watch
  - **~150 LOC**

- [ ] **1.2 Backend foundation**
  - Express server with JSON body parser, CORS, error handler
  - Workspace init: on startup, ensure `~/.job-portal/{resumes,kanban.json,settings.json}` exist
  - Settings read/write helpers (`getSettings()`, `updateSettings()`)
  - Path resolution utility: resolve relative path → absolute under workspace root, block `..`
  - **~200 LOC**

- [ ] **1.3 Frontend shell**
  - `App.tsx` with `<BrowserRouter>` + `<Routes>`
  - `<Sidebar>` with 3 nav items: Board, Editor, Settings (use Lucide icons)
  - `<KanbanView>`, `<EditorView>`, `<SettingsView>` as empty placeholder pages
  - Base layout CSS: sidebar fixed left, content area fills remaining
  - **~200 LOC**

---

## Phase 2: Backend API Routes

- [ ] **2.1 Filesystem API**
  - `GET /api/fs/list` — `fs.readdir` with stats, returns `[{ name, type }]`
  - `GET /api/fs/read` — `fs.readFile`, returns `{ content }`
  - `PUT /api/fs/write` — `fs.writeFile` with `recursive: true`
  - `DELETE /api/fs/delete` — `fs.rm` (file) or `fs.rmdir` (empty dir)
  - `POST /api/fs/mkdir` — `fs.mkdir` with `recursive: true`
  - `POST /api/fs/rename` — `fs.rename`
  - **~200 LOC**

- [ ] **2.2 Kanban API**
  - `kanbanStore.ts` helper: read/parse `kanban.json`, write atomically
  - `GET /api/kanban` — return `{ columns, cards }`
  - `PUT /api/kanban` — save full board (drag-drop reorder)
  - `POST /api/kanban/cards` — generate UUID, create card, append to column's `cardIds`
  - `PATCH /api/kanban/cards/:id` — merge update card fields
  - `DELETE /api/kanban/cards/:id` — remove card + filter from column `cardIds`
  - Initialize `kanban.json` with default 7 columns on first run
  - **~200 LOC**

- [ ] **2.3 LaTeX compile + download**
  - `POST /api/latex/compile` — run `pdflatex` twice in project dir, parse `.log` for errors
  - `GET /api/latex/download` — serve compiled PDF as attachment
  - Serve static PDF files from workspace under `/pdfs/` route
  - **~150 LOC**

---

## Phase 3: Agent Backend

- [ ] **3.1 Agent tools**
  - `read_file(path)` — resolve + `fs.readFile`
  - `write_file(path, content)` — resolve + `fs.writeFile` (recursive)
  - `list_dir(path)` — resolve + `fs.readdir` with type
  - `web_fetch(url)` — `fetch` + `@mozilla/readability` → markdown
  - All enforce `..` traversal block
  - **~200 LOC**

- [ ] **3.2 Agent orchestrator**
  - `POST /api/agent/tailor` — accept `{ jobUrl, resumeProjectPath, apiKey?, model? }`, return `{ sessionId }`
  - `GET /api/agent/sessions/:id/stream` — SSE stream
  - Orchestration loop: read settings for API key, call LLM with tools, execute tool calls, loop
  - Session store (in-memory Map, session expires after 15 min idle)
  - System prompt construction (as defined in ARCHITECTURE.md §Agent Design)
  - SSE event types: `tool_call`, `tool_result`, `message`, `done`, `error`
  - **~350 LOC**

---

## Phase 4: Settings & State

- [ ] **4.1 Settings page (frontend + backend)**
  - `GET /api/settings` — return current settings (mask API key)
  - `PUT /api/settings` — save settings
  - `<SettingsView>` with form: Provider, API Key (password input), Base URL, Model, Workspace Root
  - Save button → `PUT /api/settings`, show success toast
  - **~150 LOC**

- [ ] **4.2 Frontend stores (Zustand)**
  - `kanbanStore`: columns, cards, fetchBoard, createCard, updateCard, deleteCard, moveCard, addComment
  - `editorStore`: activeFile, openFiles, fileTree, isDirty, compileStatus, pdfUrl, agentSession
  - API client helper: thin wrapper around `fetch` with base URL, JSON handling
  - **~200 LOC**

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
  - On backend startup, if `~/.job-portal/` doesn't exist, create directory structure
  - Seed `resumes/default/` with a basic LaTeX resume template (`main.tex` + sections)
  - Seed `kanban.json` with default 7 columns (empty)
  - Seed `settings.json` with defaults (empty API key, `gpt-4o`, default workspace path)
  - On frontend first load, if settings have no API key, redirect to `/settings`
  - **~150 LOC**

---

## Summary

| Phase | Tasks | Total LOC (est.) |
|-------|-------|------------------|
| 1. Scaffold & Foundation | 3 | ~550 |
| 2. Backend APIs | 3 | ~550 |
| 3. Agent Backend | 2 | ~550 |
| 4. Settings & State | 2 | ~350 |
| 5. Kanban Frontend | 3 | ~750 |
| 6. Editor Frontend | 4 | ~1150 |
| 7. Integration & Polish | 3 | ~400 |
| **Total** | **20** | **~4300** |
