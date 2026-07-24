# Job Switch Portal — Design Document

## Overview

A local-first web portal for managing job applications. Two core modules:

1. **Kanban Board** — track job applications across pipeline stages
2. **Resume Editor** — Overleaf-style LaTeX editor with an AI agent that tailors resumes to specific job postings

Multi-user via Google OAuth. Resumes on local filesystem (per-user), kanban data in PostgreSQL (Supabase free tier). User-provided LLM API key (per-user). Auth via Supabase Auth + JWT middleware.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    BROWSER (SPA)                      │
│  ┌──────────────────────────────────────────────┐     │
│  │  Auth Layer (Google OAuth via Supabase)      │     │
│  │  - Login page with "Sign in with Google"     │     │
│  │  - AuthContext provides user + JWT to all    │     │
│  │    API calls via Authorization header        │     │
│  └──────────────────────────────────────────────┘     │
│  ┌─────────────────┐    ┌──────────────────────────┐ │
│  │   KANBAN VIEW   │    │     RESUME EDITOR VIEW   │ │
│  │                  │    │  ┌────────┬────────────┐ │ │
│  │  columns + cards │    │  │file    │ monaco     │ │ │
│  │  drag & drop     │    │  │tree    │ editor     │ │ │
│  │                  │    │  │        │            │ │ │
│  │                  │    │  │        ├────────────┤ │ │
│  │                  │    │  │        │ pdf preview│ │ │
│  │                  │    │  └────────┴────────────┘ │ │
│  │                  │    │  ┌──────────────────────┐ │ │
│  │                  │    │  │   agent chat panel   │ │ │
│  │                  │    │  └──────────────────────┘ │ │
│  └─────────────────┘    └──────────────────────────┘ │
└───────────────────────┬──────────────────────────────┘
                        │ REST + SSE  (JWT Bearer header)
┌───────────────────────┴──────────────────────────────┐
│                 BACKEND (Node.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ jwt auth │  │ auth     │  │  agent orchestrator│  │
│  │ middleware│  │ routes   │  │  (tool-calling loop)│  │ <- express
│  └──────────┘  └──────────┘  └────────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ kanban   │  │ filesys  │  │  latex compiler    │  │
│  │ routes   │  │ routes   │  │                     │  │
│  └──────────┘  └──────────┘  └────────────────────┘  │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────────┐
│         LOCAL FILESYSTEM + REMOTE DB                  │
│  ~/.switch/{user_id}/                             │
│  ├── resumes/            (latex project dirs)         │
│  └── settings/            (per-user LLM prefs in DB)  │
│                                                       │
│  Supabase (free tier)                                 │
│  ├── Auth: Google OAuth, JWT issuance                 │
│  ├── DB: users, columns, cards, comments, settings    │
│  │   (all tables scoped by user_id)                   │
│  └── RLS: optional, enforced by backend middleware     │
└──────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend framework | React + Vite | SPA. No SSR needed. |
| Routing | React Router v7 | — |
| State management | Zustand | Stores: kanban, editor, auth. |
| Auth (frontend) | @supabase/supabase-js | Google OAuth. JWT in Authorization header. |
| Auth (backend) | @supabase/supabase-js (service key) | JWT verification middleware. Extract user_id. |
| Drag & drop | @hello-pangea/dnd | Maintained fork of react-beautiful-dnd. |
| Code editor | Monaco Editor (`@monaco-editor/react`) | LaTeX syntax via monarch tokens. |
| PDF preview | react-pdf (pdf.js wrapper) | Canvas rendering. |
| CSS | Tailwind CSS | Utility-first. |
| Backend runtime | Node.js + Express | Single language across stack. |
| LaTeX compile | child_process.exec → `pdflatex` | Requires texlive installed locally. |
| LLM calls | openai npm SDK | Works with any OpenAI-compatible endpoint. |
| SSE streaming | Express raw response | `text/event-stream` content-type. |
| Database | PostgreSQL (Supabase) + Drizzle ORM | Kanban + settings. Authed via user_id FK on all tables. |
| File storage | Native `fs` module | Per-user scoped: `~/.switch/{user_id}/resumes/`. |
| Web fetch (agent) | fetch + @mozilla/readability | Extract article text, convert to markdown. |

---

## File System Layout

```
~/.switch/{user_id}/
├── resumes/
│   ├── default/                   # "master" resume (user maintains)
│   │   ├── main.tex
│   │   ├── sections/
│   │   │   ├── education.tex
│   │   │   ├── experience.tex
│   │   │   └── skills.tex
│   │   └── style/
│   │       └── resume.cls
│   └── tailored/                   # agent writes per-job copies
│       └── acme-corp/
│           └── abc123/            # job_id
│               ├── main.tex
│               └── sections/
│                   ├── education.tex
│                   ├── experience.tex
│                   └── skills.tex
```

**Rules:**
- One resume project = one directory under `resumes/`.
- Agent always copies master into `tailored/{company}/{job_id}/` before editing. Master stays pristine.
- `@mozilla/readability` used to strip boilerplate from fetched pages. Returns clean markdown.
- Workspace root: `~/.switch/{user_id}/`. User is derived from JWT. No cross-user file access.
- `settings.json` removed — LLM settings stored in DB per user.

---

## Data Models

### PostgreSQL Schema (Supabase)

All tables scoped by `user_id`. Supabase Auth issues JWT; backend middleware extracts `user.sub` → `user_id`.

```sql
-- Users table (synced from Supabase Auth on first login)
CREATE TABLE users (
  id         TEXT PRIMARY KEY,           -- UUID from Supabase Auth `auth.users`
  email      TEXT NOT NULL,
  name       TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user LLM settings (replaces settings.json)
CREATE TABLE user_settings (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL DEFAULT 'openai',
  api_key    TEXT NOT NULL DEFAULT '',
  base_url   TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  model      TEXT NOT NULL DEFAULT 'gpt-4o',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7 fixed pipeline stages (not per-user — shared definition)
CREATE TABLE columns (
  id       TEXT PRIMARY KEY,
  title    TEXT NOT NULL,
  position INTEGER NOT NULL
);

-- Job application cards (per-user)
CREATE TABLE cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company     TEXT NOT NULL,
  role        TEXT NOT NULL,
  job_url     TEXT,
  resume_path TEXT,
  tags        TEXT[],
  column_id   TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cards_user_id ON cards(user_id);

-- Card comments (per-user)
CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API response shape (GET /api/kanban) unchanged
-- Backend middleware adds `WHERE user_id = $current_user` to all queries
```

All write/read queries include `user_id` filter. Users can only see their own cards, comments, and settings. Columns table is shared (fixed 7 stages) but `cardIds` differ per user.

---

## API Design

All routes (except `/api/auth/*` and `/api/health`) require `Authorization: Bearer <jwt>` header. JWT verified via Supabase Auth service key. User ID extracted from `sub` claim and attached to `req.userId`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Returns current user `{ id, email, name, avatarUrl }`. Upserts into `users` table on first call. |
| POST | `/api/auth/refresh` | Exchange Supabase refresh token (from client) for fresh session. |

Client: `@supabase/supabase-js` handles Google OAuth redirect flow. Client stores session + JWT in `localStorage`. On each API call, client attaches `Authorization: Bearer <token>`. On page load, client checks Supabase session; if expired, redirects to `/login`.

### Settings (per-user, in DB)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Returns user's LLM settings (API key masked). From `user_settings` table. |
| PUT | `/api/settings` | Upsert user's LLM settings. |

### Kanban

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kanban` | Returns `{ columns, cards }`. Cards include nested `comments[]`. Scoped to current user. |
| PUT | `/api/kanban` | Save reorder. Body: `{ columns: [{ id, cardIds[] }] }`. Updates `column_id` + `position` per card. |
| POST | `/api/kanban/cards` | Create card. Body: `{ company, role, columnId, jobUrl?, resumePath?, tags? }`. `user_id` set from JWT. |
| PATCH | `/api/kanban/cards/:id` | Update card fields. Only if `card.user_id === req.userId`. |
| DELETE | `/api/kanban/cards/:id` | Delete card + cascade-delete comments. Ownership check. |
| POST | `/api/kanban/cards/:id/comments` | Add comment. Body: `{ text }`. `user_id` set from JWT. |
| DELETE | `/api/kanban/comments/:id` | Delete single comment. Ownership check. |

### Filesystem

All paths are relative to workspace root. Backend rejects `..` traversal.

| Method | Path | Body / Query | Response |
|--------|------|-------------|----------|
| GET | `/api/fs/list` | `?path=resumes/default` | `[{ name, type: "file" \| "dir" }]` |
| GET | `/api/fs/read` | `?path=resumes/default/main.tex` | `{ content }` |
| PUT | `/api/fs/write` | `{ path, content }` | 200 ok |
| DELETE | `/api/fs/delete` | `?path=resumes/default/old.tex` | 200 ok |
| POST | `/api/fs/mkdir` | `{ path }` | 200 ok |
| POST | `/api/fs/rename` | `{ oldPath, newPath }` | 200 ok |

### LaTeX

| Method | Path | Body / Query | Response |
|--------|------|-------------|----------|
| POST | `/api/latex/compile` | `{ projectPath: "resumes/default" }` | Success: `{ pdfUrl }` / Failure: `{ errors: [{ file, line, message }] }` |
| GET | `/api/latex/download` | `?projectPath=resumes/default` | PDF binary (`Content-Disposition: attachment`) |

Compilation runs `pdflatex` twice (for ToC/references) inside the project directory. Errors parsed from `.log` file — matched against `! ... l.<num>` pattern.

**PDF rendering in UI:** After successful compile, the PDF is rendered inline using `react-pdf` (pdf.js wrapper). The `pdfUrl` from the compile response points to a static file served by Express from the project directory.

### Agent

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/agent/tailor` | `{ jobUrl, resumeProjectPath, apiKey?, model? }` | `{ sessionId }` |
| GET | `/api/agent/sessions/:id/stream` | — | SSE stream |

**SSE Event Types:**

| Event | Data | Description |
|-------|------|-------------|
| `tool_call` | `{ tool: string, args: object }` | Agent is about to call a tool |
| `tool_result` | `{ tool: string, summary: string }` | Result of the tool call (truncated) |
| `message` | `{ content: string }` | Text from the agent |
| `done` | `{ outputPaths: string[] }` | Tailoring complete, paths to new files |
| `error` | `{ message: string }` | Something went wrong |

---

## Frontend Component Tree

```
<App>
  <AuthContext>
    <Routes>
      <Route path="/login" → <LoginPage />

      {/* Protected routes — redirect to /login if no session */}
      <Route element={<ProtectedRoute />}>
        <Sidebar>
          <NavItem icon="board"    to="/board" />
          <NavItem icon="resume"   to="/editor" />
          <NavItem icon="settings" to="/settings" />
          <UserAvatar />           ← click to logout
        </Sidebar>

        <Route path="/board"    → <KanbanView />
        <Route path="/editor"   → <EditorView />
        <Route path="/settings" → <SettingsView />
      </Route>
    </Routes>
  </AuthContext>
</App>
```

### KanbanView

```
<KanbanView>
  <BoardHeader title="Job Pipeline" />
  <ColumnList>
    <Column key="wishlist">
      <Card />  ← draggable, click to open CardModal
    </Column>
    <Column key="applied">...</Column>
    ...
  </ColumnList>
  <AddCardButton />
  <CardModal>
    <Field label="Company" />
    <Field label="Role" />
    <Field label="Job URL" />
    <Field label="Resume" (file picker → sets resumePath) />
    <Field label="Tags" (tag input) />
    <CommentsSection>
      <Comment />           ← timestamped, ordered list
      <AddCommentForm />
    </CommentsSection>
  </CardModal>
</KanbanView>
```

### EditorView

```
<EditorView>
  <ResizablePanel direction="horizontal">
    <FileTree projectPath="resumes/default">
      <FileNode />  ← recursive, click to open, right-click context menu
    </FileTree>

    <ResizablePanel direction="vertical">
      <EditorToolbar>
        <CompileButton />                  ← triggers compile → updates pdf preview
        <DownloadPdfButton />              ← GET /api/latex/download → browser download
        <CompileStatus />                  ← "Compiling..." | "✓ Compiled" | error badge
      </EditorToolbar>
      <MonacoEditor file={activeFile} />   ← LaTeX syntax, dirty tracking
      <PdfPreview pdfUrl={compiledPdfUrl}  ← react-pdf canvas, auto-refresh on compile
                   errors={latexErrors} />    error markers mapped to editor
    </ResizablePanel>

    <AgentPanel collapsed={!agentActive}>
      <JobUrlInput />
      <StartButton />
      <StreamLog>                          ← live tool calls + messages
        <ToolCallEntry />
        <MessageEntry />
      </StreamLog>
      <CreateCardButton />                 ← appears after "done"
    </AgentPanel>
  </ResizablePanel>
</EditorView>
```

### SettingsView

```
<SettingsView>
  <FormSection title="LLM Configuration">
    <Field label="Provider" />
    <Field label="API Key" type="password" />
    <Field label="Base URL" />
    <Field label="Model" />
  </FormSection>
</SettingsView>
```

### LoginPage

```
<LoginPage>
  <Card>
    <Logo />
    <h1>Job Switch Portal</h1>
    <p>Track job applications. Tailor resumes with AI.</p>
    <GoogleSignInButton />    ← triggers Supabase OAuth
  </Card>
</LoginPage>
```

---

## Agent Design

### System Prompt (Outline)

```
You are a professional resume writer. You have these tools:
- read_file(path): read a file from the resume project
- write_file(path, content): write content to a file
- list_dir(path): list files and directories
- web_fetch(url): fetch a web page and return its content as markdown

Steps:
1. Fetch the job posting URL to understand the role, requirements, and keywords.
2. Optionally fetch the company's about/careers page for culture and mission info.
3. Read the current resume project — start with main.tex, then section files.
4. Tailor the resume: reorder bullets to match job requirements, emphasize
   matching skills, incorporate relevant keywords, adjust the professional summary.
   Preserve the LaTeX structure and formatting.
5. Write the tailored version to a new directory under tailored/.
   Use format: `tailored/{company}/{job_id}/`
   Example: if master is at `resumes/default/` and job is `acme-corp/abc123`,
   write to `resumes/tailored/acme-corp/abc123/`
6. Report a summary of what you changed and why.
```

### Orchestration Loop

```
tools = [read_file, write_file, list_dir, web_fetch]
messages = [system_prompt, user_message("Tailor resume at {path} for job: {url}")]

loop:
    response = llm.chat(messages, tools)

    if response has tool_calls:
        for each call in response.tool_calls:
            emit SSE: { type: "tool_call", tool: call.name, args: call.args }
            result = execute_tool(call)
            emit SSE: { type: "tool_result", summary: truncate(result) }
            messages.push({ role: "tool", content: result, tool_call_id: call.id })
        continue

    if response has content:
        emit SSE: { type: "message", content: response.content }
        break

emit SSE: { type: "done", outputPaths: [...] }
```

### Tool Implementations (Backend)

| Tool | Implementation |
|------|---------------|
| `read_file(path)` | Resolve path relative to workspace root, `fs.readFile`. Block `..` traversal. |
| `write_file(path, content)` | Resolve path, `fs.writeFile` with `recursive: true` for parent dirs. Block `..` traversal. |
| `list_dir(path)` | Resolve path, `fs.readdir`, return `[{ name, type }]`. |
| `web_fetch(url)` | `fetch(url)` → @mozilla/readability to extract article → convert to markdown. |

All file paths are relative to workspace root. Backend prepends root and validates no escapes.

---

## Component Contract (Cross-Module Links)

### Kanban → Editor

- Card modal has a "Resume" field — file picker or manual path input.
- Clicking a linked resume navigates to `/editor?project={resumePath}`, preloading the file tree.

### Editor → Kanban

- When agent finishes (`done` event), the agent panel shows a "Create Card" button.
- Click pre-fills a card with company/role extracted from the JD, links the tailored resume path.
- Saves card via `POST /api/kanban/cards`.

### LaTeX Errors → Editor

- Backend parses `.log` for `! ... l.<line>` patterns.
- Returns `[{ file, line, message }]`.
- Frontend sets Monaco markers on the offending file at the reported line.

---

## Key Design Decisions

1. **Multi-user via Google OAuth.** No passwords. Supabase Auth issues JWT. All DB tables scoped by `user_id`. Filesystem scoped by `~/.switch/{user_id}/`.
2. **JWT verification server-side.** Backend Express middleware verifies Supabase JWT using service key. Rejects unauthenticated requests (except health + auth routes).
3. **Agent tools are backend-only.** Agent loop runs server-side. API keys never exposed to browser after initial submit.
4. **Master resume is read-only to agent.** Always copies to `tailored/{company}/{job_id}/` before editing.
5. **Kanban ↔ Resume link is one-way.** Card stores `resumePath`. From board, click to open that resume in the editor.
6. **Compilation is synchronous per request.** `pdflatex` runs twice in the project dir. PDF served as static file.
7. **Settings in DB per-user.** `settings.json` removed. LLM config in `user_settings` table. Database credentials via `DATABASE_URL` + `SUPABASE_SERVICE_KEY` env vars.
8. **Migrations automatic.** Drizzle migrations run on server startup. Columns table seeded if empty.
