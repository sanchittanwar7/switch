# Job Switch

Local-first portal for managing job applications. Kanban board + Overleaf-style resume editor with AI agent.

## Setup

```bash
npm install
```

Requires Node.js ≥22.

## Dev

```bash
npm run dev
```

Starts both servers concurrently:
- **Client** — `http://localhost:5173` (Vite + React)
- **Server** — `http://localhost:3000` (Express API)

Vite proxies `/api` and `/pdfs` to the server.

## Individual dev

```bash
npm run dev -w client   # Vite only
npm run dev -w server   # Express only
```

## Type check

```bash
npm run lint -w client
npm run lint -w server
```

## Build

```bash
npm run build
```

## Docs

- `docs/ARCHITECTURE.md` — system design, data models, API spec
- `docs/vercel/DESIGN.md` — UI design rules
- `docs/PLAN.md` — implementation task list
