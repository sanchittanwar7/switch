# Questions Sharing Feature — Implementation Plan

## Overview

Add "share my questions" toggle to Settings. When ON, all user's interview questions become publicly visible to other sharing users. When OFF, already-shared questions remain public; new questions stay private. Re-enabling makes ALL questions (public + private) public again.

Question Bank page gains two sections: "My Questions" (existing) and "All Questions" (shared by all users). "All Questions" section is gated — only visible to users who have sharing enabled themselves.

An "All Questions" card shows company name, round type, date, and question text only. It does NOT link to the application detail page (which is owner-only).

---

## Subtask 1: Database Schema Migration

**Scope**: `server/src/db/schema.ts`, `server/src/workspace.ts`  
**Estimated LOC**: ~330 lines

### Changes

1. Add `share_questions` column to `user_settings` Drizzle schema (line ~20):
   ```ts
   shareQuestions: boolean("share_questions").notNull().default(false),
   ```

2. Add `shared` column to `interviews` Drizzle schema (line ~80):
   ```ts
   shared: boolean("shared").notNull().default(false),
   ```

3. Add `ensureShareQuestionsColumn()` in `workspace.ts` — uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` raw SQL pattern (same pattern as `ensureInterviewsTable` at line 14-41). Must handle the case where column already exists gracefully.

4. Add `ensureSharedColumn()` in `workspace.ts` — same `ALTER TABLE ADD COLUMN IF NOT EXISTS` pattern for `interviews.shared`. Also creates an index on `(shared)` for the shared questions query — `CREATE INDEX IF NOT EXISTS interviews_shared_idx ON interviews(shared)`.

5. Update `initializeDatabase()` (line ~43-51) to call both new `ensure*` functions after `ensureInterviewsTable()`.

6. Run `npm run db:generate -w server` to generate the Drizzle migration SQL file. Verify the generated migration contains both `ALTER TABLE` statements.

### Key code patterns

- Database schema updates follow the existing dual-track pattern: Drizzle schema for type inference + raw SQL `ensure*` functions for actual DDL (because the codebase uses `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` instead of full Drizzle migrations exclusively).
- All new columns get `NOT NULL DEFAULT false` to be backward-compatible with existing rows.
- The `shared` index on `interviews` is needed because `GET /api/questions/shared` will query `WHERE shared = true` across all users.

### Verification

- Start server → check that new columns exist in `user_settings` and `interviews`
- Insert a row manually → verify defaults are `false`

---

## Subtask 2: Server Settings API — Share Toggle with Cascade Logic

**Scope**: `server/src/routes/settings.ts`, `server/src/settings.ts`  
**Estimated LOC**: ~380 lines

### Changes

#### A. `server/src/settings.ts` — New helper functions

1. `getSharePreference(userId: string): Promise<boolean>` — queries `user_settings.share_questions` for the user, returns `false` if no settings row exists.

2. `setSharePreference(userId: string, share: boolean): Promise<void>` — upserts `user_settings` with `shareQuestions` value. **Contains the cascade logic:**
   - If `share === true`: batch-update ALL of user's interviews to `shared = true` — including both currently public and currently private ones. SQL: `UPDATE interviews SET shared = true, updated_at = NOW() WHERE application_id IN (SELECT id FROM applications WHERE user_id = $1)`.
   - If `share === false`: NO batch update. Existing `shared = true` rows stay true. New interviews created going forward will default to `shared = false` (handled in Subtask 4).

#### B. `server/src/routes/settings.ts` — Route updates

3. Update `GET /` (line 27-46): After the existing query, call `getSharePreference(userId)` and include `shareQuestions` in the response JSON. If no settings row exists, return `false`.

   Response shape becomes:
   ```json
   {
     "provider": "...",
     "apiKey": "...",
     "baseUrl": "...",
     "model": "...",
     "shareQuestions": false
   }
   ```

4. Update `PUT /` (line 48-84): Accept `shareQuestions` in `req.body`. After upserting the settings row, call `setSharePreference(userId, shareQuestions)` to trigger the cascade. Include `shareQuestions` in the response.

   The existing `onConflictDoUpdate` upsert pattern is extended to include `shareQuestions` in the values object:
   ```ts
   const values = {
     userId,
     provider: provider || "openai",
     apiKey: effectiveApiKey,
     baseUrl: baseUrl || null,
     model: model || null,
     shareQuestions: shareQuestions ?? false,
     updatedAt: new Date(),
   };
   ```

### Key design decisions

- **Why cascade on PUT, not GET**: The toggle state change is the trigger point. When user flips the switch to ON, all their questions become public immediately. GET is read-only.
- **Why batch UPDATE all, not per-row**: Simpler, faster. When user re-enables sharing after being OFF, both old-public and new-private questions become public.
- **Why no cascade on OFF**: Existing public questions stay public. This is explicitly required. No DB change needed — just the `share_questions` flag flips to `false`, and new interviews will default to `shared = false` (Subtask 4).

### Verification

- PUT with `shareQuestions: true` → check all user's interviews have `shared = true`
- PUT with `shareQuestions: false` → check existing interviews with `shared = true` remain true
- Create new interview while OFF → check `shared = false` (Subtask 4)
- PUT with `shareQuestions: true` again → check newly-created interview (was false) becomes true

---

## Subtask 3: Server Questions API — Shared Questions Endpoint + Interview Creation Update

**Scope**: `server/src/routes/questions.ts` (new endpoint), `server/src/routes/applications.ts` (modify POST), `client/src/types.ts`  
**Estimated LOC**: ~420 lines

### Changes

#### A. New route: `GET /api/questions/shared`

New route handler in `server/src/routes/questions.ts` (appended after line 54):

```ts
router.get("/shared", async (req, res) => {
  const userId = getUserId(req);
  // Gate: user must have sharing enabled to view shared questions
  const [settings] = await db
    .select({ shareQuestions: userSettings.shareQuestions })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  
  if (!settings?.shareQuestions) {
    res.status(403).json({ error: "Enable question sharing in Settings to view shared questions." });
    return;
  }

  const { type, company, search } = req.query;
  // ... filter conditions ...
  // Query: interviews JOIN applications WHERE interviews.shared = true
  //        AND interviews.question_title IS NOT NULL
  //        AND applications.user_id != current user (optional: exclude self)
  // ... optional type/company/search filters ...
  // Response: { interviews: SharedQuestionEntry[] }
});
```

Key differences from existing `GET /`:
- No `applicationId` in response — prevents navigation to owner's application
- No `userId` exposed
- Returns `company`, `type` (round type string), `questionTitle`, `createdAt` only
- Joins `interviews → applications` to get `company`
- Filters `interviews.question_title IS NOT NULL` (only questions with text)
- Gates access behind user's own `share_questions` setting

#### B. Type definition: `SharedQuestionEntry`

Add to `client/src/types.ts`:

```ts
export interface SharedQuestionEntry {
  interviewId: string;
  type: InterviewType;
  questionTitle: string;
  company: string;
  createdAt: string;
}
```

#### C. Modify `POST /api/applications/:id/interviews` (server/src/routes/applications.ts, ~line 87)

After creating the interview, check user's `share_questions` preference. If `true`, set `shared: true` on the inserted row:

```ts
const [shareSettings] = await db
  .select({ share: userSettings.shareQuestions })
  .from(userSettings)
  .where(eq(userSettings.userId, userId));

const shared = shareSettings?.share ?? false;

const [interview] = await db
  .insert(interviews)
  .values({ applicationId, type, status, scheduledAt, questionTitle, feedback, questionDetail, shared })
  .returning();
```

This is the mechanism that makes "new questions become public when sharing is ON" and "new questions become private when sharing is OFF".

#### D. Client API helper

Add to `client/src/lib/api.ts`:

```ts
export function getSharedQuestions(filters?: { type?: string; company?: string; search?: string }): Promise<{ interviews: SharedQuestionEntry[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.company) params.set("company", filters.company);
  if (filters?.search) params.set("search", filters.search);
  return apiGet(`/api/questions/shared?${params.toString()}`);
}
```

### Key design decisions

- **Self-exclusion**: The shared endpoint should ideally exclude the requesting user's own questions from "All Questions" (since their own questions are already in "My Questions"). Add `neq(applications.userId, userId)` to conditions.
- **403 gate**: If user hasn't enabled sharing, return 403. The frontend should also hide the tab (handled in Subtask 5), but server-side enforcement is critical.
- **No applicationId leak**: The response type omits `applicationId` to prevent frontend from constructing links to owner's application detail page.

### Verification

- With sharing ON: GET `/api/questions/shared` returns non-empty results when other users have shared questions
- With sharing OFF: GET returns 403
- Create interview while sharing ON: new interview has `shared = true`
- Create interview while sharing OFF: new interview has `shared = false`

---

## Subtask 4: Frontend Settings Page — Share Toggle

**Scope**: `client/src/stores/settingsStore.ts`, `client/src/views/SettingsView.tsx`, `client/src/lib/api.ts`  
**Estimated LOC**: ~380 lines

### Changes

#### A. Update `SettingsData` interface and store

In `client/src/stores/settingsStore.ts` (line 4-9):

```ts
export interface SettingsData {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  shareQuestions: boolean;  // NEW
}
```

No changes to `loadSettings` or `saveSettings` — they already pass through `apiGet`/`apiPut` generically. The new field is returned by the server (Subtask 2). Add `shareQuestions: false` as default in `SettingsStore` initial state.

#### B. Add share toggle to SettingsView

In `client/src/views/SettingsView.tsx`, add a new `<section>` before the "Providers" section (around line 117). The section includes:

1. **Section header**: "Sharing" with description text
2. **Toggle switch**: A custom pill-shaped toggle — follows the project's design tokens:
   - Track: `bg-brand-canvas-soft-2 border border-brand-hairline rounded-full w-11 h-6`
   - Knob: `bg-brand-ink rounded-full w-4 h-4` — transitions left (OFF) to right (ON) with `translate-x`
   - Uses `useSettingsStore` to read `settings.shareQuestions` and call `saveSettings({ shareQuestions: newValue })`
3. **Status text**: Shows current state — "Your questions are visible to other users" / "Your questions are private"
4. **Loading state**: While `saveSettings` is in flight, toggle is disabled with a spinner
5. **Description**: Explains the behavior — existing shared questions stay public when turned off

Toggle JSX pattern:
```tsx
<button
  onClick={handleToggle}
  disabled={saving}
  className={`relative inline-flex items-center w-11 h-6 rounded-full border transition-colors ${
    settings.shareQuestions
      ? "bg-brand-link border-brand-link/30"
      : "bg-brand-canvas-soft-2 border-brand-hairline"
  }`}
>
  <span
    className={`inline-block w-4 h-4 rounded-full bg-brand-ink transition-transform ${
      settings.shareQuestions ? "translate-x-5" : "translate-x-1"
    }`}
  />
</button>
```

#### C. CSS considerations

All colors use brand tokens from `client/src/index.css` `@theme` block: `bg-brand-canvas`, `border-brand-hairline`, `text-brand-ink`, `text-brand-body`, `text-brand-mute`, `bg-brand-link`, `text-brand-link`. No ad-hoc hex values.

Spacing follows the 4px base unit pattern: `p-6`, `gap-3`, `mb-4`, etc.

### Key design decisions

- **Toggle shape**: Pill (rounded-full) — matches the project's button design language (primary buttons are pill-shaped).
- **No separate store action**: `saveSettings` already exists and handles the API call generically. The toggle just calls it with the partial update. The store's `saveSettings` does `apiPut<SettingsData>` and updates state.
- **Optimistic UI or loading state**: Since this triggers a cascade DB update (Subtask 2), use a loading state on the toggle rather than optimistic UI — the cascade might take a moment for users with many interviews.

### Verification

- Toggle ON → PUT request sent with `shareQuestions: true` → all user's interviews get `shared = true`
- Toggle OFF → PUT request sent with `shareQuestions: false` → no batch update
- Toggle ON → OFF → ON → verify all interviews (including ones created while OFF) are `shared = true`
- Page reload → toggle reflects server state

---

## Subtask 5: Frontend Question Bank — Dual Section Layout

**Scope**: `client/src/views/QuestionBankView.tsx`, `client/src/lib/api.ts` (minor)  
**Estimated LOC**: ~490 lines

### Changes

Refactor `QuestionBankView.tsx` (267 lines current → ~490 lines after). This is the largest subtask.

#### A. Fetch settings on mount

The component needs to know if `shareQuestions` is enabled. Import `useSettingsStore` and read `settings.shareQuestions`. If settings aren't loaded yet, trigger `loadSettings()`.

#### B. Tab navigation

Add two tabs above the filter bar:

```tsx
const [activeTab, setActiveTab] = useState<"mine" | "all">("mine");
```

Tab styling:
```
<button className={`px-4 py-2 text-sm rounded-full transition-colors ${
  activeTab === "mine" 
    ? "bg-brand-canvas text-brand-ink border border-brand-hairline"
    : "text-brand-mute hover:text-brand-body"
}`}>
  My Questions
</button>
<button className={`px-4 py-2 text-sm rounded-full transition-colors ${
  activeTab === "all"
    ? "bg-brand-canvas text-brand-ink border border-brand-hairline"
    : "text-brand-mute hover:text-brand-body"
}`}>
  All Questions
</button>
```

#### C. Visibility gate for "All Questions" tab

- If `settings.shareQuestions === false`: The "All Questions" tab is hidden. Instead, show a helper message below "My Questions": "Enable question sharing in Settings to browse questions from other users."
- If `settings.shareQuestions === true`: Both tabs visible.

#### D. Separate data fetching per tab

Use `useEffect` keyed on `[activeTab, typeFilter, companyFilter, statusFilter, appliedSearch]`:

- **"mine" tab**: Calls `getQuestions(filters)` — existing API, existing behavior. Cards are clickable, navigate to `/application/:id`. Shows `ExternalLink` icon.
- **"all" tab**: Calls `getSharedQuestions(filters)` — new API (Subtask 3). Cards are NOT clickable. No `ExternalLink`. No `applicationId` in data. Uses `SharedQuestionEntry` type.

Separate state variables:
```ts
const [myQuestions, setMyQuestions] = useState<QuestionBankEntry[]>([]);
const [sharedQuestions, setSharedQuestions] = useState<SharedQuestionEntry[]>([]);
const [loadingMine, setLoadingMine] = useState(true);
const [loadingShared, setLoadingShared] = useState(true);
const [errorMine, setErrorMine] = useState<string | null>(null);
const [errorShared, setErrorShared] = useState<string | null>(null);
```

Or, more elegantly, a single state object keyed by tab:
```ts
type TabData = {
  questions: (QuestionBankEntry | SharedQuestionEntry)[];
  loading: boolean;
  error: string | null;
};
const [tabState, setTabState] = useState<Record<"mine" | "all", TabData>>({...});
```

#### E. "All Questions" card component

Non-clickable card showing:
- **Company name** — `text-sm font-medium text-brand-ink`
- **Round type** — `TYPE_LABELS[q.type]` as a badge
- **Date** — `formatDate(q.createdAt)` in `text-xs text-brand-mute`
- **Question text** — `text-sm text-brand-body leading-relaxed`

NO `ExternalLink` icon. NO `role` badge. NO `status` badge. NO `onClick` handler. A plain `<div>` instead of `<button>`.

```tsx
<div className="bg-brand-canvas border border-brand-hairline rounded-lg p-6">
  <div className="flex items-center flex-wrap gap-2 mb-2">
    <h4 className="text-sm font-medium text-brand-ink">{q.company}</h4>
    <span className="inline-flex items-center text-xs text-brand-body bg-brand-canvas-soft px-1.5 py-0.5 rounded-full border border-brand-hairline">
      {TYPE_LABELS[q.type]}
    </span>
  </div>
  <p className="text-sm text-brand-body leading-relaxed">{q.questionTitle}</p>
  <p className="text-xs text-brand-mute mt-2">{formatDate(q.createdAt)}</p>
</div>
```

#### F. Filters for "All Questions" tab

The "All Questions" tab has different available filters:
- **Type filter**: Same as "My Questions" (all interview types)
- **Company filter**: Dynamically populated from `sharedQuestions` results (same pattern as existing `companies` useMemo)
- **Search**: Same text search on question content
- **NO status filter**: Shared questions don't show status (it's the owner's private info)

When switching tabs, clear filters that don't apply to the new tab (e.g., clear `statusFilter` when switching to "all").

#### G. Empty states

- "My Questions" with no results: "No questions recorded yet. Add interviews to your applications." (existing)
- "All Questions" with no results: "No shared questions available. When other users share their questions, they'll appear here."
- "All Questions" with filters active but no results: "No shared questions match your filters."

#### H. Companies list per tab

The company filter dropdown for "All Questions" is populated from the shared questions response, not from the user's own questions. Add a `sharedCompanies` useMemo that extracts unique companies from `sharedQuestions`.

#### I. Error handling

- 403 from shared endpoint: Show inline message "Enable question sharing in Settings to view shared questions." (server returns 403, client catches it as an error — display this specific message)
- Network errors: Show `text-brand-error` banner same as existing pattern

### Key design decisions

- **Tab state separation**: Each tab has independent loading/error/data states. Switching tabs doesn't clear the other tab's data (cached in memory).
- **Pill-shaped tabs**: Matches the calendar-style tab pattern from DESIGN.md ("Calendar-style tab pills: rounded-full with 64px+ radius").
- **No link on shared cards**: Explicitly use `<div>` not `<button>`. No `cursor-pointer`. No `hover:border-brand-hairline-strong`. This is intentional — application detail is owner-only.

### Verification

- With sharing OFF: "All Questions" tab hidden, helper message visible
- With sharing ON: Both tabs visible, "All Questions" shows shared questions from other users
- Click "My Questions" card → navigates to `/application/:id`
- Click "All Questions" card → no navigation
- Company filter on "All Questions" tab shows only companies from shared questions
- Type filter works on both tabs
- Search works on both tabs
- Status filter only appears on "My Questions" tab

---

## Subtask 6: Integration, Edge Cases & Wiring

**Scope**: `server/src/index.ts`, `server/src/routes/questions.ts`, `client/src/App.tsx`, `client/src/views/QuestionBankView.tsx` (final touches)  
**Estimated LOC**: ~310 lines

### Changes

#### A. Mount shared questions route on server

In `server/src/index.ts` (after line 31 where `questionsRouter` is already mounted):

No change needed — the `router.get("/shared", ...)` is added to the existing `questionsRouter` in Subtask 3. The route is already mounted at `/api/questions`. The new handler responds at `/api/questions/shared`.

#### B. Load settings containing shareQuestions in ProtectedLayout

In `client/src/App.tsx` (line 24-31): The `loadSettings()` call already exists in `ProtectedLayout`. Since `SettingsData` now includes `shareQuestions` (Subtask 4), it loads automatically. No code change needed.

However, `QuestionBankView` should verify settings are loaded before checking `shareQuestions`. If `settings` is `null` (not loaded yet), show loading state. Add:

```tsx
const settings = useSettingsStore((s) => s.settings);
const loadSettings = useSettingsStore((s) => s.loadSettings);

useEffect(() => {
  if (!settings) loadSettings();
}, [settings, loadSettings]);
```

#### C. Edge case: Interview created without question text

When an interview is created with `questionTitle: null` (e.g., user fills other fields but not the question title), the `shared` flag is still set based on the sharing preference. This is correct — if the user later adds a question title, it will either be already shared (if sharing was ON when created) or private (if sharing was OFF). No special handling needed.

When querying shared questions, the existing `isNotNull(interviews.questionTitle)` filter ensures only interviews with question text appear.

#### D. Edge case: User turns sharing ON with zero interviews

The `setSharePreference` batch UPDATE in Subtask 2 is a no-op when there are no matching rows. No error thrown. Settings row is still upserted with `share_questions = true`. Future interviews get `shared = true`.

#### E. Edge case: User deletes an application while questions are shared

The `interviews` table has `ON DELETE CASCADE` from `applications` (line 76 of schema.ts, and the raw SQL FK in workspace.ts line 36-37). Deleting an application automatically deletes its interviews. The shared question disappears from "All Questions" — correct behavior.

#### F. Edge case: Multiple rapid ON/OFF toggles

The toggle in Subtask 4 uses a loading/disabled state. Rapid clicks are prevented by the `disabled={saving}` prop. Each toggle action completes before the next is allowed.

#### G. Type exports from server to client

The `SharedQuestionEntry` type is defined in `client/src/types.ts` only (Subtask 3.C). The server response shape is structurally typed. If a shared type module is desired, define in `client/src/types.ts` and use a comment referencing the server shape.

#### H. Handle 403 from shared endpoint gracefully

In `QuestionBankView.tsx`, when the shared API call fails with a 403 status, display a user-friendly message rather than "Enable question sharing in Settings..." — this is already the gate behavior. But the component should catch this and show an inline info state, not an error banner. Parse the error message from the server response:

```ts
if (err.message?.includes("Enable question sharing")) {
  // Show inline helper, not error
  setGateMessage(err.message);
} else {
  setErrorShared(err.message);
}
```

#### I. Final verification checklist

- [ ] DB columns exist in both tables with correct defaults
- [ ] GET /api/settings returns `shareQuestions`
- [ ] PUT /api/settings with `shareQuestions: true` cascades to all user's interviews
- [ ] PUT /api/settings with `shareQuestions: false` does NOT affect existing interviews
- [ ] Re-enabling makes previously-private interviews public
- [ ] POST /api/applications/:id/interviews sets `shared` based on current setting
- [ ] GET /api/questions/shared returns 403 when user hasn't enabled sharing
- [ ] GET /api/questions/shared returns questions from other users (not self)
- [ ] Settings page has working toggle with loading state
- [ ] Question Bank has "My Questions" and "All Questions" tabs
- [ ] "All Questions" hidden when sharing is OFF
- [ ] "All Questions" cards are non-clickable, show correct fields
- [ ] Filters work independently per tab
- [ ] No `applicationId` exposed in shared questions response
- [ ] Deleting an application cascades to remove its interviews from shared view

---

## File Change Summary

| File | Subtask | Change Type |
|------|---------|-------------|
| `server/src/db/schema.ts` | 1 | Add 2 columns |
| `server/src/workspace.ts` | 1 | Add 2 ensure functions |
| `server/src/routes/settings.ts` | 2 | Update GET/PUT handlers |
| `server/src/settings.ts` | 2 | Add 2 helper functions |
| `server/src/routes/questions.ts` | 3 | Add shared endpoint |
| `server/src/routes/applications.ts` | 3 | Modify POST handler |
| `client/src/stores/settingsStore.ts` | 4 | Add shareQuestions field |
| `client/src/views/SettingsView.tsx` | 4 | Add toggle section |
| `client/src/types.ts` | 3, 5 | Add SharedQuestionEntry |
| `client/src/lib/api.ts` | 3, 5 | Add getSharedQuestions |
| `client/src/views/QuestionBankView.tsx` | 5, 6 | Major refactor |
| `client/src/App.tsx` | 6 | Minor — settings load check |
