# Switch

## Workflow

- Do not commit or push unless user explicitly requests it.
- Node.js 22+ required. Install dependencies with `npm install` at repository root; this is an npm-workspaces monorepo (`client`, `server`).
- `npm run dev` starts Express on `3000` and Vite on `5173`. Run one side with `npm run dev -w client` or `npm run dev -w server`.
- `npm run lint` is TypeScript-only (`tsc --noEmit`) for both workspaces; no test, ESLint, or Prettier scripts exist. Use `npm run lint -w <client|server>` for focused verification.
- `npm run build` builds client before server. Preserve that order.
- Server development loads `server/.env` via `tsx --env-file=.env`; client values must use `VITE_` prefix.
- Drizzle schema is `server/src/db/schema.ts`; migrations are generated into `server/drizzle/`. Server startup runs migrations and seeds board columns, so do not add duplicate startup DDL without checking `server/src/workspace.ts`.

## Architecture

- Server entrypoint: `server/src/index.ts`. Client entrypoint/routes: `client/src/main.tsx`, `client/src/App.tsx`.
- Client requests go through `client/src/lib/api.ts`; helpers attach Supabase bearer tokens. Do not use bare `fetch` for authenticated API calls.
- Most API routes require Supabase JWT middleware. Agent and research SSE streams instead authenticate with session tokens; preserve their two-step session-then-stream flow.
- User filesystem paths must stay relative and go through `resolvePath()` in `server/src/utils/paths.ts`; default per-user root is `~/.lean-switch/{userId}` and traversal is rejected.
- Resume tailoring and company research live under `server/src/agent/`; each uses separate session/orchestrator/stream routes. Research reports are stored in that session's user workspace.
- The client proxies `/api` and `/pdfs` only in Vite development. Production routing is defined in `vercel.json`.

## UI

- Tailwind v4 tokens are defined in `client/src/index.css`. App is dark despite light defaults in `docs/vercel/DESIGN.md`; use `brand-*` tokens, not ad-hoc colors.
- Follow existing components for styling. Use Lucide for new icons.

## Integration Notes

- `web_search` uses Tavily. Keep `TAVILY_API_KEY` server-only; never expose it through `VITE_` variables or client code.
- LaTeX compilation needs a local TeX engine and runs twice; it selects `pdflatex`, `xelatex`, or `lualatex` from document features. PDFs are served only through authenticated `/pdfs` routes.
