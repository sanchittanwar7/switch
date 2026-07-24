# Job Switch Portal — Design Document

## Overview

A local-first web portal for managing job applications. Two core modules:

1. **Kanban Board** — track job applications across pipeline stages
2. **Resume Editor** — Overleaf-style LaTeX editor with an AI agent that tailors resumes to specific job postings

Single user, local filesystem storage, user-provided LLM API key.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    BROWSER (SPA)                      │
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
                        │ REST + SSE
┌───────────────────────┴──────────────────────────────┐
│                 BACKEND (Node.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ kanban   │  │ filesys  │  │  agent orchestrator│  │
│  │ routes   │  │ routes   │  │  (tool-calling loop)│  │
│  └──────────┘  └──────────┘  └────────────────────┘  │
│  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │ latex    │  │  tools: fs_read, fs_write,        │  │
│  │ compiler │  │  fs_list, web_fetch               │  │
│  └──────────┘  └──────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────────┐
│              LOCAL FILESYSTEM                         │
│  ~/.job-portal/                                       │
│  ├── resumes/            (latex project dirs)         │
│  ├── kanban.json         (board state)                │
│  └── settings.json       (LLM keys, prefs)            │
└──────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend framework | React + Vite | SPA. No SSR needed. |
| Routing | React Router v7 | — |
| State management | Zustand | One store for kanban, one for editor. |
| Drag & drop | @hello-pangea/dnd | Maintained fork of react-beautiful-dnd. |
| Code editor | Monaco Editor (`@monaco-editor/react`) | LaTeX syntax via monarch tokens. |
| PDF preview | react-pdf (pdf.js wrapper) | Canvas rendering. |
| CSS | Tailwind CSS | Utility-first. |
| Backend runtime | Node.js + Express | Single language across stack. |
| LaTeX compile | child_process.exec → `pdflatex` | Requires texlive installed locally. |
| LLM calls | openai npm SDK | Works with any OpenAI-compatible endpoint. |
| SSE streaming | Express raw response | `text/event-stream` content-type. |
| File storage | Native `fs` module | Direct local disk. |
| Web fetch (agent) | fetch + @mozilla/readability | Extract article text, convert to markdown. |

---

## File System Layout

```
~/.job-portal/
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
├── kanban.json
└── settings.json
```

**Rules:**
- One resume project = one directory under `resumes/`.
- Agent always copies master into `tailored/{company}/{job_id}/` before editing. Master stays pristine.
- `@mozilla/readability` used to strip boilerplate from fetched pages. Returns clean markdown.

---

## Data Models

### kanban.json

```json
{
  "columns": [
    { "id": "wishlist",    "title": "Wishlist",    "cardIds": [] },
    { "id": "applied",     "title": "Applied",     "cardIds": [] },
    { "id": "screening",   "title": "Screening",   "cardIds": [] },
    { "id": "interview",   "title": "Interview",   "cardIds": [] },
    { "id": "offer",       "title": "Offer",       "cardIds": [] },
    { "id": "accepted",    "title": "Accepted",    "cardIds": [] },
    { "id": "rejected",    "title": "Rejected",    "cardIds": [] }
  ],
  "cards": {
    "<uuid>": {
      "company": "Acme Corp",
      "role": "Senior Engineer",
      "jobUrl": "https://acme.com/careers/123",
      "resumePath": "resumes/tailored/acme-corp/abc123/",
      "comments": [
        { "text": "Recruiter reached out on LinkedIn.", "createdAt": "2026-07-24T00:00:00Z" }
      ],
      "tags": ["remote", "startup"],
      "createdAt": "2026-07-24T00:00:00Z",
      "updatedAt": "2026-07-24T00:00:00Z",
      "columnId": "applied"
    }
  }
}
```

Columns are fixed. Cards are keyed by UUID. Column `cardIds` arrays define ordering. Drag-and-drop reorders `cardIds` within the source/target column.

### settings.json

```json
{
  "llm": {
    "provider": "openai",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o"
  },
  "workspaceRoot": "~/.job-portal"
}
```

---

## API Design

### Kanban

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kanban` | Returns `{ columns, cards }` |
| PUT | `/api/kanban` | Save full board state (body: `{ columns, cards }`) |
| POST | `/api/kanban/cards` | Create card, returns card |
| PATCH | `/api/kanban/cards/:id` | Update card fields |
| DELETE | `/api/kanban/cards/:id` | Delete card + remove from column cardIds |

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
  <Sidebar>
    <NavItem icon="board"    to="/board" />
    <NavItem icon="resume"   to="/editor" />
    <NavItem icon="settings" to="/settings" />
  </Sidebar>

  <Routes>
    <Route path="/board"    → <KanbanView />
    <Route path="/editor"   → <EditorView />
    <Route path="/settings" → <SettingsView />
  </Routes>
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
  <FormSection title="Workspace">
    <Field label="Workspace Root" />
  </FormSection>
</SettingsView>
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
- Saves card to `kanban.json` at the same `resumePath`.

### LaTeX Errors → Editor

- Backend parses `.log` for `! ... l.<line>` patterns.
- Returns `[{ file, line, message }]`.
- Frontend sets Monaco markers on the offending file at the reported line.

---

## Key Design Decisions

1. **Single user, local-first.** No auth, no database server, no cloud. Everything on disk.
2. **Agent tools are backend-only.** Agent loop runs server-side. API keys never exposed to browser after initial submit.
3. **Master resume is read-only to agent.** Always copies to `tailored/{company}/{job_id}/` before editing.
4. **Kanban ↔ Resume link is one-way.** Card stores `resumePath`. From board, click to open that resume in the editor.
5. **Compilation is synchronous per request.** `pdflatex` runs twice in the project dir. PDF served as static file.
6. **Settings persisted in `settings.json`.** API key stored on disk. File excluded from git.
