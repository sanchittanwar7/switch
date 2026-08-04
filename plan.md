# Interview Loop Tracking — Implementation Plan

**Goal:** Rename `card` → `application` everywhere, add interview tracking per application, plus a cross-application question bank.

---

## Data Model

Three entities:

```
users ──< applications ──< interviews
```

- **`applications`** (renamed from `cards`) stores company, role, job URL, resume path, tags, kanban pipeline stage (columnId).  
- **`interviews`** (new) links to an application via `application_id`. Each interview captures type, status, question asked, feedback, notes.  
- **Cross-application queries** work via `interviews JOIN applications`: filter by interview type, company, or text search on question — all scoped to user.

---

## Subtask 0: Rename `card` → `application` across full codebase

**Why first:** Do this before adding `interviews` table to avoid double-rename of FK columns.

### 0a: Database — Rename table and columns

**File:** `server/src/db/schema.ts`

```typescript
// Rename export
export const applications = pgTable("applications", { ... });  // was "cards"
export const cards = applications;  // keep alias temporarily? No, full rename.

// In comments table:
cardId → applicationId
"card_id" → "application_id"
```

**Manual migration steps:**

1. Update `server/src/db/schema.ts`: rename `cards` export → `applications`, rename column `"card_id"` → `"application_id"` in comments table, rename FK reference to `() => applications.id`.
2. Delete `server/drizzle/meta/` — Drizzle will re-generate fresh snapshots from updated schema.
3. Create manual migration file:

```
server/drizzle/0007_rename_cards_to_applications.sql
```

```sql
ALTER TABLE cards RENAME TO applications;
ALTER TABLE comments RENAME COLUMN card_id TO application_id;
```

4. On next server start, `runMigrations()` in `server/src/db/migrate.ts` picks up the new file and executes it. Drizzle's internal `__drizzle_migrations` table tracks that 0007 executed.
5. Verify: `npm run db:generate -w server` should produce no diff (schema now matches DB).

**Why manual:** Drizzle's auto-generated migration cannot detect renames. It would produce `DROP TABLE cards; CREATE TABLE applications;` — all data lost. `ALTER TABLE RENAME` preserves data, indexes, and constraints. FK constraints auto-update when the referenced table is renamed.

**Estimated lines:** ~5 schema change + ~10 migration SQL

### 0b: Server — Rename in kanban routes

**File:** `server/src/routes/kanban.ts`

| Before | After |
|--------|-------|
| `import { columns, cards, comments }` | `import { columns, applications, comments }` |
| `from(cards)` | `from(applications)` |
| `cards.userId`, `cards.id`, etc. | `applications.userId`, `applications.id`, etc. |
| `POST/PATCH/DELETE "/cards"` | `POST/PATCH/DELETE "/applications"` |
| `"/cards/:id/comments"` | `"/applications/:id/comments"` |
| Variable `card` | `application` |
| Response key `"cards"` | `"applications"` |

**Estimated lines:** full file rewrite (~212 lines, same structure)

### 0c: Client — Rename in types

**File:** `client/src/types.ts`

| Before | After |
|--------|-------|
| `interface Card { ... cardId ... }` | `interface Application { ... applicationId ... }` |
| `interface Comment { cardId }` | `interface Comment { applicationId }` |
| `interface Column { cardIds }` | `interface Column { applicationIds }` |

**Estimated lines:** ~30 (rewrite affected types)

### 0d: Client — Rename in API helpers

**File:** `client/src/lib/api.ts`

All `/api/kanban/cards/...` URL paths → `/api/kanban/applications/...`

**Estimated lines:** ~5

### 0e: Client — Rename in kanbanStore

**File:** `client/src/stores/kanbanStore.ts`

| Before | After |
|--------|-------|
| `cards: Record<string, Card>` | `applications: Record<string, Application>` |
| `Card` type | `Application` type |
| Variable `card` | `application` |
| State key `cards` | `applications` |
| URL paths `/api/kanban/cards/...` | `/api/kanban/applications/...` |

Full file rewrite (~125 lines, same structure).

### 0f: Client — Rename in kanban components

| File | Changes |
|------|---------|
| `Card.tsx` → `ApplicationCard.tsx` | Component rename, prop `card` → `application`, type `CardType` → `Application` |
| `Column.tsx` | Prop `cards: Card[]` → `applications: Application[]`, slot name `card` → `application` |
| `CardModal.tsx` → `ApplicationModal.tsx` | Component rename, prop `card` → `application`, all field references, "Edit Card" → "Edit Application", "Delete this card?" → "Delete this application?" |
| `AddCardButton.tsx` → `AddApplicationButton.tsx` | Component rename, button text "Add card" → "Add application" |
| `BoardHeader.tsx` | `cards` → `applications`, `cardCount` → `applicationCount` |

**Estimated lines:** ~400 total across 5 files

### 0g: Client — Rename in views

| File | Changes |
|------|---------|
| `KanbanView.tsx` | `cards` → `applications`, `selectedCardId` → `selectedApplicationId`, `selectedCard` → `selectedApplication`, slot name `cards` → `applications` |
| `LandingPage.tsx` | Text "The card stores" → "The application stores" |

**Estimated lines:** ~90

### 0h: Client — Rename imports in App.tsx

Update import paths to match renamed component files.

**Estimated lines:** ~5

**Complete rename summary:** ~10 files changed, ~900 lines total but all are mechanical renames — no logic changes.

---

## Subtask 1: Database — Add `interviews` table

**File:** `server/src/db/schema.ts`  
**Migration:** Run `npm run db:generate -w server` after schema change  

Add new `interviews` table:

```typescript
export const interviews = pgTable("interviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  type: text("type").notNull(),          // phone_screen, coding, technical, system_design, behavioral, onsite, final, take_home, other
  status: text("status").notNull().default("scheduled"),  // scheduled, completed, passed, failed
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  question: text("question"),            // question asked in the interview
  feedback: text("feedback"),            // feedback received
  notes: text("notes"),                  // personal notes
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Estimated lines:** ~20-25 additions to schema.ts

---

## Subtask 2: Server — Application detail endpoint

**File:** `server/src/routes/applications.ts` (new)

`GET /:id` — returns a single application with comments and interviews:

```typescript
// 1. Fetch application scoped to userId (join columns for stage title)
// 2. Fetch comments for application
// 3. Fetch interviews for application ordered by created_at
// 4. Return { ...application, columnTitle, comments, interviews }
```

**Estimated lines:** ~50

---

## Subtask 3: Server — Interview CRUD endpoints

**File:** `server/src/routes/applications.ts` (same file as subtask 2)

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/:id/interviews` | List all interviews for application |
| `POST` | `/:id/interviews` | Create interview (type, status, scheduledAt, question, feedback, notes) |
| `PATCH` | `/:id/interviews/:interviewId` | Update interview fields |
| `DELETE` | `/:id/interviews/:interviewId` | Delete interview |

All routes verify application ownership (userId scoping via application). Patch uses allowed-fields whitelist pattern matching existing kanban code.

**Estimated lines:** ~120-150

---

## Subtask 4: Server — Mount application + questions routers

**File:** `server/src/index.ts`

```typescript
import applicationsRouter from "./routes/applications";
import questionsRouter from "./routes/questions";

app.use("/api/applications", authMiddleware, applicationsRouter);
app.use("/api/questions", authMiddleware, questionsRouter);
```

**Estimated lines:** ~6

---

## Subtask 5: Client — Add Interview type

**File:** `client/src/types.ts`

```typescript
export type InterviewType = "phone_screen" | "coding" | "technical" | "system_design" | "behavioral" | "onsite" | "final" | "take_home" | "other";
export type InterviewStatus = "scheduled" | "completed" | "passed" | "failed";

export interface Interview {
  id: string;
  applicationId: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string | null;
  question: string | null;
  feedback: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionBankEntry {
  interviewId: string;
  type: InterviewType;
  question: string;
  company: string;
  role: string;
  applicationId: string;
  createdAt: string;
}
```

Also add `interviews?: Interview[]` and `columnTitle?: string` to the `Application` interface (optional, populated by detail endpoint).

**Estimated lines:** ~15-20

---

## Subtask 6: Client — Application API helpers

**File:** `client/src/lib/api.ts`

Add functions:

```typescript
export function getApplication(id: string): Promise<Application & { interviews: Interview[]; columnTitle: string }> {
  return apiGet(`/api/applications/${id}`);
}

export function createInterview(appId: string, data: { type: InterviewType; status: InterviewStatus; scheduledAt?: string; question?: string; feedback?: string; notes?: string }): Promise<Interview> {
  return apiPost(`/api/applications/${appId}/interviews`, data);
}

export function updateInterview(appId: string, interviewId: string, data: Partial<Interview>): Promise<Interview> {
  return apiPatch(`/api/applications/${appId}/interviews/${interviewId}`, data);
}

export function deleteInterview(appId: string, interviewId: string): Promise<void> {
  return apiDelete(`/api/applications/${appId}/interviews/${interviewId}`);
}
```

**Estimated lines:** ~30-35

---

## Subtask 7: ApplicationModal — Add "Open in new tab" button

**File:** `client/src/components/kanban/ApplicationModal.tsx` (renamed from CardModal.tsx)

In the header row, add an `ExternalLink` icon button next to the X close button:

```tsx
<button
  onClick={() => window.open(`/application/${application.id}`, "_blank")}
  className="p-1 rounded-full text-brand-mute hover:text-brand-link hover:bg-brand-canvas-soft-2 transition-colors"
  title="Open in new tab"
>
  <ExternalLink size={18} />
</button>
```

`ExternalLink` is already imported in ApplicationModal.

**Estimated lines:** ~5

---

## Subtask 8: Client — Add `/application/:id` route

**File:** `client/src/App.tsx`

1. Import `ApplicationView` 
2. Add route inside `<ProtectedLayout>`:

```tsx
<Route path="/application/:id" element={<ApplicationView />} />
```

**Estimated lines:** ~5

---

## Subtask 9: Client — ApplicationView page

**File:** `client/src/views/ApplicationView.tsx` (new)

Top-level page component:
1. Reads `id` from `useParams()`
2. Fetches application data via `getApplication(id)` on mount
3. Renders:
   - Back button (navigates to `/board`)
   - Page heading with company + role
   - `ApplicationDetailCard` — shows company, role, job URL, resume, tags, column status, comments
    - `InterviewsSection` — interview list + add/edit
4. Loading/error/not-found states

**Estimated lines:** ~150-180

---

## Subtask 10: Client — ApplicationDetailCard component

**File:** `client/src/components/application/ApplicationDetailCard.tsx` (new)

Displays application info in a card layout:
- Company name (heading)
- Role (subheading)
- Status badge (kanban column title, joined from columns table)
- Job URL (clickable link, opens in new tab)
- Resume path (with "Open in Editor" link to `/resume?project=<path>`)
- Tags (pill badges)
- Comments section — lists existing comments + inline add-comment form. Reuses pattern from ApplicationModal (textarea + Submit, Ctrl+Enter shortcut). Deleting comments not needed here (can do from board modal).

**Estimated lines:** ~130-160

---

## Subtask 11: Client — InterviewsSection component

**File:** `client/src/components/application/InterviewsSection.tsx` (new)

Interview list with timeline display:
- Section header: "Interviews" + "Add Interview" button
- Interview list rendered chronologically (newest first)
- Each interview displays as a card showing:
  - Type badge (colored per type)
  - Status badge
  - Scheduled date (if set)
  - Question text (if set)
  - Feedback text (if set)
  - Notes text (if set)
- Edit button → opens `InterviewForm` in edit mode
- Delete button with confirmation
- Empty state: "No interviews tracked yet. Add your first interview."

**Estimated lines:** ~200-250

---

## Subtask 12: Client — InterviewForm component

**File:** `client/src/components/application/InterviewForm.tsx` (new)

Inline form or small modal for adding/editing an interview:

Fields:
- **Type** — dropdown: Phone Screen, Coding, Technical, System Design, Behavioral, Onsite, Final, Take Home, Other
- **Status** — dropdown: Scheduled, Completed, Passed, Failed
- **Scheduled At** — datetime-local input
- **Question** — textarea ("What was asked?")
- **Feedback** — textarea ("What feedback did you receive?")
- **Notes** — textarea ("Your personal notes")
- Cancel + Save buttons

Reused for both create and edit modes (pass optional `interview` prop for edit).

**Estimated lines:** ~180-220

---

## Subtask 13: Server — Question bank API endpoint

**File:** `server/src/routes/questions.ts` (new)

Single endpoint with query params for filtering/search:

```
GET /api/questions?type=system_design
  → all interviews of given type across all user's applications
  → returns { interviews: [{ interviewId, type, question, company, role, applicationId, createdAt }] }

GET /api/questions?company=Google
  → all interviews across all applications for that company

GET /api/questions?search=docker
  → full-text search on interview.question using ILIKE `%search%`

GET /api/questions?type=system_design&company=Google
  → combined filters
```

Implementation: `interviews JOIN applications ON interviews.application_id = applications.id`, filter by `applications.user_id`, plus optional type/company/search WHERE clauses. Order by `interviews.created_at DESC`.

**Estimated lines:** ~60-80

---

## Subtask 14: Client — Add `/questions` route

**File:** `client/src/App.tsx`

1. Import `QuestionBankView`
2. Add route inside `<ProtectedLayout>`:

```tsx
<Route path="/questions" element={<QuestionBankView />} />
```

**Estimated lines:** ~5

---

## Subtask 15: Client — QuestionBankView page

**File:** `client/src/views/QuestionBankView.tsx` (new)

Browse/search all interview questions across applications:

1. Fetches all questions on mount: `GET /api/questions`
2. Filter bar at top:
   - **Type dropdown** — all interview types (phone_screen, coding, technical, system_design, behavioral, onsite, final, take_home, other)
   - **Company dropdown** — populated from distinct companies in user's applications (or free-text input)
   - **Search input** — free-text search on question text
   - Filters re-fetch from API with query params
3. Results displayed as cards:
   - Question text (primary)
   - Company + Role (with link to application detail)
   - Interview type badge (colored)
   - Date asked
4. Click on a question → navigates to `/application/{applicationId}` (scrolls to interviews section)
5. Empty state: "No questions recorded yet. Add interviews to your applications."
6. Loading/error states

**Estimated lines:** ~250-300

---

## Subtask 16: Client — Sidebar: Add "Question Bank" link

**File:** `client/src/components/Sidebar.tsx`

Add a nav item for `/questions` with an appropriate icon (e.g., `MessageSquareQuote` or `Search` from lucide-react).

**Estimated lines:** ~5-10

---

## Subtask 17: Client — API: Question bank helper

**File:** `client/src/lib/api.ts`

```typescript
export interface QuestionBankFilters {
  type?: string;
  company?: string;
  search?: string;
}

export function getQuestions(filters?: QuestionBankFilters): Promise<{ interviews: QuestionBankEntry[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.company) params.set("company", filters.company);
  if (filters?.search) params.set("search", filters.search);
  return apiGet(`/api/questions?${params.toString()}`);
}
```

**Estimated lines:** ~15-20

---

## File Change Summary

| # | File | Action | Est. Lines |
|---|------|--------|------------|
| 0a | `server/src/db/schema.ts` | Rename `cards` → `applications`, `card_id` → `application_id` | ~10 |
| 0b | `server/drizzle/` | Manual rename migration SQL (0007_rename_cards_to_applications.sql) | ~5 |
| 0c | `server/src/routes/kanban.ts` | Rename all card→application, update URL paths | ~212 (rewrite) |
| 0d | `client/src/types.ts` | Rename `Card` → `Application`, `cardId` → `applicationId` | ~30 |
| 0e | `client/src/stores/kanbanStore.ts` | Rename all card→application, state keys, URL paths | ~125 (rewrite) |
| 0f | `client/src/lib/api.ts` | Update URL paths /cards → /applications | ~5 |
| 0g | `client/src/components/kanban/*.tsx` | Rename 5 files: Card.tsx→ApplicationCard.tsx, CardModal.tsx→ApplicationModal.tsx, AddCardButton.tsx→AddApplicationButton.tsx; rename all internals | ~400 |
| 0h | `client/src/views/KanbanView.tsx` | Rename cards→applications, selectedCard→selectedApplication | ~90 |
| 0i | `client/src/views/LandingPage.tsx` | Text "card" → "application" | ~2 |
| 0j | `client/src/App.tsx` | Update kanban component imports | ~5 |
| 1 | `server/src/db/schema.ts` | Add `interviews` table | +25 |
| 2 | `server/drizzle/` | `db:generate` migration for interviews table (auto-generated) | auto |
| 3 | `server/src/routes/applications.ts` | **New** — detail + interview CRUD routes | ~200 |
| 4 | `server/src/routes/questions.ts` | **New** — question bank endpoint | ~80 |
| 5 | `server/src/index.ts` | Mount applications + questions routers | +6 |
| 6 | `client/src/types.ts` | Add `Interview`, `InterviewType`, `InterviewStatus`, `QuestionBankEntry` | +30 |
| 7 | `client/src/lib/api.ts` | Add `getApplication`, `createInterview`, `getQuestions`, etc. | +55 |
| 8 | `client/src/components/kanban/ApplicationModal.tsx` | Add "Open in new tab" button in header | +5 |
| 9 | `client/src/App.tsx` | Add `/application/:id` + `/questions` routes | +8 |
| 10 | `client/src/components/Sidebar.tsx` | Add "Question Bank" nav link | +8 |
| 11 | `client/src/views/ApplicationView.tsx` | **New** — application detail page | ~170 |
| 12 | `client/src/components/application/ApplicationDetailCard.tsx` | **New** — app info display | ~150 |
| 13 | `client/src/components/application/InterviewsSection.tsx` | **New** — interview list + timeline | ~230 |
| 14 | `client/src/components/application/InterviewForm.tsx` | **New** — add/edit interview form | ~200 |
| 15 | `client/src/views/QuestionBankView.tsx` | **New** — question bank page | ~280 |

**Total estimated:** ~2100 lines. Subtask 0 (rename) ~900 lines across 10 files — largest single piece but all mechanical. Subtask 15 (QuestionBankView) ~280 lines is the largest new file.

---

## Execution Order

1. **Rename (0a-0h):** DB migration → server routes → types → store → components → views → App.tsx imports
2. **DB `interviews` table (1-2):** schema + drizzle migration
3. **Server routes (2-3, 13):** application detail + interview CRUD + question bank — write all 3 router files
4. **Mount routers (4):** server/src/index.ts
5. **Client types (5):** Interview, InterviewType, QuestionBankEntry in types.ts
6. **Client API helpers (6, 17):** getApplication, createInterview, getQuestions — all in api.ts
7. **ApplicationModal button (7):** "Open in new tab" link
8. **App routing (8, 14):** /application/:id + /questions routes
9. **Sidebar link (16):** Question Bank nav item
10. **ApplicationView + components (9-12):** view → detail card → interviews section → interview form
11. **QuestionBankView (15):** question bank browse/search page

---

## Design Notes

- **Data model:** `applications` stores company/role/etc + kanban stage. `interviews` link via `application_id` FK. Cross-application queries join interviews → applications. No denormalization needed.
- **Auth:** All routes use `authMiddleware`. Interviews are user-scoped via application ownership check. Question bank filters by `applications.user_id`.
- **DB migration — rename:** Manual SQL (ALTER TABLE RENAME) required. Drizzle's auto-generated migration would drop+create, losing data.
- **DB migration — interviews table:** `db:generate` works normally for new tables. Migration runs automatically on server start.
- **No new stores:** Views use local `useState` + `useEffect` for data loading (matches existing patterns like ApplicationModal).
- **Status badge on detail page:** Include kanban column title in application detail response (join `columns`).
- **Interview type colors:** Map: coding=blue, system_design=purple, behavioral=green, technical=amber, phone_screen=neutral, onsite=red, final=brand-link, take_home=teal, other=gray.
- **Question bank linking:** Clicking a question navigates to `/application/{id}`. Pass hash fragment/query param to scroll to interviews section.
- **Sidebar icon:** Use `MessageSquareQuote` from lucide-react for "Question Bank" nav item.
- **Mobile:** All new views are full-page scrollable within ProtectedLayout. No special mobile handling needed.
