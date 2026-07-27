## Critical Rules

- **NEVER commit or push automatically.** Only commit/push when user explicitly asks.
- **NEVER generate or guess URLs** unless they are for documentation or code references.

## Architecture & Design

Refer to `docs/ARCHITECTURE.md` for system design, component contracts, data models, API design, agent design, and file system layout.

All UI work must follow design patterns from `docs/vercel/DESIGN.md`. Key rules (full spec in that file):

- **Dark theme**: Actual CSS theme (`client/src/index.css`) uses dark tokens (canvas `#0a0a0a`, ink `#ededed`), not DESIGN.md's light defaults. Invert light values for dark mode but keep token names and spacing/typography/component patterns.
- **Colors**: Only use `brand-*` tokens from `@theme` block. No ad-hoc hex values. Canvas ladder: `brand-canvas` (cards) → `brand-canvas-soft` (page bg) → `brand-canvas-soft-2` (inset regions). Text: `brand-ink` (headings), `brand-body` (secondary), `brand-mute` (placeholder/legal). Semantic: `brand-link`, `brand-error`, `brand-error-soft`, `brand-warning`, `brand-warning-soft`. Borders/dividers: `brand-hairline`, `brand-hairline-strong`.
- **Typography**: Font: Inter (substitute for Geist). Weights: 400 body, 500 strong, 600 display (never 700+). Mono: JetBrains Mono (substitute for Geist Mono) — code blocks and technical labels only, never body text. Display sizes use negative tracking (`tracking-[-0.02em]` to `tracking-[-0.05em]`). Headlines sentence-case, period-terminated.
- **Spacing**: Base unit 4px. Use multiples: 8, 12, 16, 24, 32, 40, 48, 64 px (Tailwind `p-2` through `p-16` roughly). Cards: `p-6` to `p-8` interior padding. Section gaps generous (64-96px); interior stacks tight (8-12px between heading and body).
- **Buttons**: Primary: `bg-brand-ink text-brand-canvas rounded-full` (pill shape). Secondary: ghost/text style. Height: 40-48px for main actions, 28-32px for compact (nav/table). No sharp corners on CTAs.
- **Cards**: `bg-brand-canvas` with `border border-brand-hairline`. Rounded: `rounded-lg` (8px) or `rounded-xl` (12px). Stacked shadows (inset hairline + subtle drop), never a single heavy `shadow-lg`.
- **Inputs**: `bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md`, height 40px (`h-10`). `body-sm` sized text. Focus ring: `brand-link`.
- **Elevation**: Flat → hairline border → subtle stacked shadow → modal overlay. No heavy material-style drop shadows.
- **Modals**: `bg-brand-canvas` + inset hairline + multi-stop shadow + backdrop blur. `rounded-xl`, `p-8`.
- **Empty states**: Generous padding (`p-12`+), `brand-canvas-soft` background, muted body text. Use brand tokens, never introduce new colors.
- **Headlines**: Never all-caps. Negative tracking on display sizes. Weight 600 max. Calendar-style tab pills: `rounded-full` with 64px+ radius.
- **Icons**: Lucide React (`lucide-react` already installed). Size: 16-20px for UI, 24px for standalone.

Follow existing components in `client/src/components/` as reference implementations.

## Commands

```
npm run dev           # starts both server (port 3000) and client (port 5173) via concurrently
npm run build         # tsc + vite build (client first, then server)
npm run lint          # tsc --noEmit (both workspaces; no ESLint configured)
npm run db:generate -w server   # drizzle-kit generate (schema → migration SQL)
npm run db:migrate -w server    # run drizzle migrations manually (auto-runs on server start)
```

Run workspace-scoped commands via `-w <workspace>` flag (npm workspaces).

## Monorepo Structure

- Root `package.json` declares workspaces: `client`, `server`
- Both packages: `"type": "module"` (ESM), TypeScript strict mode
- **No test suite** in the repo
- **No ESLint or prettier config** — `lint` script in each workspace is `tsc --noEmit` only
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin and CSS `@theme` block (`client/src/index.css`)
- **Build order matters**: client before server (`npm run build -w client && npm run build -w server`)

## Server (`/server`)

- **Dev runtime**: `tsx --env-file=.env src/index.ts` — uses `.env` file directly, not dotenv
- **Framework**: Express 5.x with CORS and JSON body parser
- **Port**: 3000 (default, overridable via `PORT` env)
- **DB**: PostgreSQL via Drizzle ORM + `node-postgres`. Migrations and column seeding run automatically on `start()`. Schema: `server/src/db/schema.ts`
- **Required env vars**: `DATABASE_URL` (throws if missing), `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- **Auth**: Supabase JWT verification middleware (`server/src/middleware/auth.ts`). All routes (except `/api/auth/*` and `/api/health`) require `Authorization: Bearer <token>`. User ID extracted from `sub` claim, synced to `users` table on first request via `ensureUser()`.
- **Filesystem scope**: `~/.switch/{user_id}/resumes/` — per-user workspace. Path traversal (`..`) blocked in `resolvePath()`.
- **Agent**: Vercel AI SDK v7 (`ai` + `@ai-sdk/*`). Provider factory maps LLM settings to SDK providers. Tools: `read_file`, `write_file`, `list_dir`, `web_fetch` — all scoped to user workspace.

### Server directory map

| Directory | Purpose |
|-----------|---------|
| `server/src/agent/` | Agent orchestrator, tools, provider factory, system prompt, SSE routes, session store |
| `server/src/db/` | Drizzle schema, client, migrations, seed |
| `server/src/lib/` | Supabase admin client |
| `server/src/middleware/` | JWT auth middleware |
| `server/src/routes/` | REST routes: auth, fs, kanban, latex, settings |
| `server/src/utils/` | Path resolution (`resolvePath`, `getWorkspaceRoot`) |

## Client (`/client`)

- **Framework**: React 19 + Vite 6 + TypeScript
- **Routing**: React Router v7
- **State**: Zustand stores: `authStore`, `kanbanStore`, `editorStore`, `settingsStore`
- **Drag & drop**: `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd)
- **Editor**: Monaco Editor via `@monaco-editor/react`
- **PDF**: `react-pdf` (pdf.js wrapper)
- **Auth**: `@supabase/supabase-js` on client. `AuthContext` + `AuthProvider` subscribe to `onAuthStateChange`. JWT auto-attached to all API calls via `client/src/lib/api.ts` helper.
- **Vite proxy**: `/api` and `/pdfs` proxied to `http://localhost:3000`
- **Required env vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- **API client helpers**: `apiGet`, `apiPost`, `apiPatch`, `apiPut`, `apiDelete`, `apiGetBlob` — all auto-attach Bearer token via `getHeaders()`

### Client directory map

| Directory | Purpose |
|-----------|---------|
| `client/src/components/editor/` | Editor UI components (file tree, monaco, toolbar, PDF preview, agent panel) |
| `client/src/components/kanban/` | Kanban board components (columns, cards, modal, comments) |
| `client/src/contexts/` | AuthContext + AuthProvider |
| `client/src/lib/` | API client (`api.ts`), Supabase client (`supabase.ts`) |
| `client/src/stores/` | Zustand stores |
| `client/src/views/` | Page-level views: KanbanView, EditorView, ResumeListView, SettingsView, LoginPage |

## Key Conventions

- All API routes except auth and health require JWT. Client auto-attaches via `api.ts` helpers.
- File paths are always relative to user workspace root. Server prepends `~/.switch/{user_id}/`.
- Drizzle migrations auto-run on server start. No separate migration step needed for deploy.
- Agent copies master resume to `tailored/{company}/{job_id}/` before editing — never modifies master.
- LaTeX compilation runs `pdflatex` twice (needs `texlive` locally). PDFs served as static files under `/pdfs/`.
- Storage mode: local filesystem by default. `storage_mode` column in `user_settings` suggests cloud option planned but primarily local.
