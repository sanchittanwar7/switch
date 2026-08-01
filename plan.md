# Calendar Feature Plan

Interview scheduling calendar with day/week/month views. Users manage events (name, description, time, company, role, round, resume, job URL).

---

## Subtask 1 — DB Schema & Migration (~40 LOC)

**File**: `server/src/db/schema.ts`

Add `events` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK, `defaultRandom()` | |
| `userId` | `uuid` FK → `users.id` | Indexed, scoped in all queries |
| `name` | `text` | Required |
| `description` | `text` | Optional |
| `startTime` | `timestamp with tz` | Required |
| `endTime` | `timestamp with tz` | Required. Check: `startTime < endTime` validated in route |
| `company` | `text` | Optional |
| `role` | `text` | Optional |
| `roundName` | `text` | Optional (e.g., "Phone Screen", "On-site Round 2") |
| `resumePath` | `text` | Optional. Path relative to `~/.lean-switch/{userId}/resumes/` |
| `jobUrl` | `text` | Optional |
| `createdAt` | `timestamp with tz` | `defaultNow()` |
| `updatedAt` | `timestamp with tz` | `defaultNow()` |

Index: composite unique on `(userId, id)` via Drizzle second-arg callback.

Run `npm run db:generate -w server` to produce migration SQL.

**Acceptance**:
- [x] Table defined in `server/src/db/schema.ts`
- [x] Migration SQL generated under `server/src/db/migrations/`
- [x] `npm run build -w server` passes

---

## Subtask 2 — Server: Calendar API Routes (~250 LOC)

**File**: `server/src/routes/calendar.ts`

Mount in `server/src/index.ts`: `app.use("/api/calendar", authMiddleware, calendarRoutes);`

All routes use `getUserId(req)` helper + ownership filtering `eq(events.userId, userId)`.

| Method | Path | Body / Query | Response |
|--------|------|-------------|----------|
| `GET` | `/` | Query: `start` (ISO string, required), `end` (ISO string, required) | `Event[]` within date range, sorted by `startTime` |
| `POST` | `/` | JSON: `{ name, description?, startTime, endTime, company?, role?, roundName?, resumePath?, jobUrl? }` | Created `Event` (201) |
| `PATCH` | `/:id` | JSON: partial event fields | Updated `Event` |
| `DELETE` | `/:id` | — | `{ success: true }` |

**Validation**:
- `startTime` before `endTime` (400 if not)
- Required `name` present (400 if missing)
- Event exists + belongs to user (404 if not owned/missing)

**GET range filtering**: Use `gte(events.startTime, rangeStart)` and `lte(events.startTime, rangeEnd)` or overlap logic.

Register in `server/src/index.ts`:
```ts
import calendarRoutes from "./routes/calendar.js";
app.use("/api/calendar", authMiddleware, calendarRoutes);
```

**Acceptance**:
- [x] `POST /api/calendar` creates event, returns 201
- [x] `GET /api/calendar?start=...&end=...` returns events in range
- [x] `PATCH /api/calendar/:id` updates event
- [x] `DELETE /api/calendar/:id` deletes event
- [x] All routes enforce user ownership
- [x] `npm run build -w server` passes

---

## Subtask 3 — Client: Calendar Types & API Layer (~50 LOC)

**File**: `client/src/types.ts` (append)

```ts
export type ViewMode = "day" | "week" | "month";

export interface CalendarEvent {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  startTime: string;  // ISO 8601
  endTime: string;    // ISO 8601
  company: string | null;
  role: string | null;
  roundName: string | null;
  resumePath: string | null;
  jobUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  company?: string;
  role?: string;
  roundName?: string;
  resumePath?: string;
  jobUrl?: string;
}

export type UpdateEventInput = Partial<CreateEventInput>;
```

**Acceptance**:
- [x] Types added to `client/src/types.ts`
- [x] `npm run build -w client` passes

---

## Subtask 4 — Client: Calendar Zustand Store (~150 LOC)

**File**: `client/src/stores/calendarStore.ts`

```ts
import { create } from "zustand";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import type { CalendarEvent, CreateEventInput, UpdateEventInput, ViewMode } from "../types";

interface CalendarStore {
  events: CalendarEvent[];
  loading: boolean;
  viewMode: ViewMode;
  selectedDate: string;       // ISO date string for the calendar "cursor"

  setViewMode: (mode: ViewMode) => void;
  setSelectedDate: (date: string) => void;
  navigateBack: () => void;   // prev week/month/day
  navigateForward: () => void;
  navigateToday: () => void;

  fetchEvents: (rangeStart: string, rangeEnd: string) => Promise<void>;
  createEvent: (input: CreateEventInput) => Promise<CalendarEvent>;
  updateEvent: (id: string, input: UpdateEventInput) => Promise<CalendarEvent>;
  deleteEvent: (id: string) => Promise<void>;
}
```

Key details:
- `fetchEvents` deduplicates — merges new range into `events`, removes stale entries outside current window (or just replaces `events` with API response for simplicity)
- `createEvent` appends to `events` array after API success
- `updateEvent` replaces event in array by `id`
- `deleteEvent` filters out by `id`
- `navigateBack/Forward` computes new date using `date-fns` helpers (`addDays`, `addWeeks`, `addMonths`) based on `viewMode`
- `navigateToday` sets `selectedDate` to `new Date().toISOString()`

Install `date-fns` if not already in deps:
```bash
npm install date-fns -w client
```

**Acceptance**:
- [x] Store created with all actions
- [x] `fetchEvents` calls `GET /api/calendar?start=X&end=Y`
- [x] CRUD actions call correct API endpoints
- [x] Navigation helpers work for all 3 view modes
- [x] `npm run lint` passes (tsc)

---

## Subtask 5 — Client: Event Form Modal (~350 LOC)

**File**: `client/src/components/calendar/EventModal.tsx`

Modal component for creating and editing events. Uses `brand-canvas` background, `rounded-xl`, `p-8`, backdrop blur per DESIGN.md.

**Props**:
```ts
interface EventModalProps {
  event?: CalendarEvent | null;     // null = create mode, event = edit mode
  initialStart?: string;            // pre-fill start time (from clicking a time slot)
  initialEnd?: string;              // pre-fill end time
  onClose: () => void;
  onSave: (input: CreateEventInput | UpdateEventInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}
```

**Form fields** (all `bg-brand-canvas text-brand-ink border-brand-hairline rounded-md h-10 body-sm`):
- `name` (text input, required)
- `description` (textarea, optional)
- `startTime` (datetime-local input, required)
- `endTime` (datetime-local input, required)
- `company` (text input, optional)
- `role` (text input, optional)
- `roundName` (text input, optional)
- `resumePath` (text input, optional)
- `jobUrl` (text input, optional)

**Layout**:
- Header: "New Event" or "Edit Event"
- Two-column grid for time fields (start/end side by side)
- Single-column for remaining fields
- Footer: Cancel button (secondary/ghost), Delete button (in edit mode, `brand-error`), Save button (primary, pill, `bg-brand-ink text-brand-canvas`)
- Backdrop with blur, click-outside closes modal

**Validation**:
- Name required
- Start before end

**States**: loading spinner on Save while API call in flight, error display if API fails.

**Acceptance**:
- [ ] Modal opens in create mode (empty form) and edit mode (pre-filled)
- [ ] Creates event via `onSave` callback
- [ ] Updates event via `onSave` callback
- [ ] Deletes event via `onDelete` callback in edit mode
- [ ] Form validation (name required, start < end)
- [ ] Matches DESIGN.md (dark theme, brand tokens, pill buttons, rounded-xl modal)
- [ ] Click-outside closes modal

---

## Subtask 6 — Client: Month View Component (~350 LOC)

**File**: `client/src/components/calendar/MonthView.tsx`

Renders a month grid given `selectedDate` + `events[]`.

**Grid layout**:
- 7-column CSS grid (Sun–Mon or Mon–Sun header row)
- 5–6 rows depending on month
- Each cell shows day number + up to 3 event pills (with "+N more" overflow)

**Props**:
```ts
interface MonthViewProps {
  events: CalendarEvent[];
  selectedDate: string;          // any date in the displayed month
  onDateClick: (date: string) => void;     // navigate to day view on that date
  onEventClick: (event: CalendarEvent) => void;  // open edit modal
  onSlotClick: (date: string) => void;     // open create modal for that date
}
```

**Logic**:
1. Compute month start/end from `selectedDate` using `date-fns` (`startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`)
2. Build 2D array of weeks × days for the grid
3. For each day cell, filter events that fall on that date
4. Render day number in top-left, event pills below
5. Today's cell highlighted with `brand-link` border or subtle background
6. Non-current-month days rendered muted (`brand-mute`)

**Event pill**: `bg-brand-ink text-brand-canvas rounded-full text-xs px-2 py-0.5 truncate`

**Interaction**:
- Click day number → `onDateClick` (switch to day view)
- Click empty space in cell → `onSlotClick` (new event on that date)
- Click event pill → `onEventClick` (edit modal)

Use `date-fns` throughout: `format`, `isSameMonth`, `isSameDay`, `isToday`.

**Acceptance**:
- [ ] Month grid renders correctly for any month
- [ ] Events displayed as pills in correct cells (max 3 + overflow)
- [ ] Day number click switches to day view
- [ ] Event click opens edit modal
- [ ] Empty slot click opens create modal
- [ ] Today highlighted
- [ ] Non-current-month days muted
- [ ] `npm run lint` passes

---

## Subtask 7 — Client: Week & Day View Components (~400 LOC)

**File**: `client/src/components/calendar/WeekView.tsx` (~200 LOC)
**File**: `client/src/components/calendar/DayView.tsx` (~200 LOC)

### WeekView

7-column time grid. Each column = one day of the week. Rows = hourly time slots (8 AM – 8 PM default, scrollable).

**Props**:
```ts
interface WeekViewProps {
  events: CalendarEvent[];
  selectedDate: string;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (start: string, end: string) => void;
}
```

**Layout**:
- Header row: day names + dates (e.g., "Mon 28", "Tue 29")
- Time gutter on left: hour labels (8 AM, 9 AM, ...) in `brand-mute` `body-sm`
- Grid: 7 columns, each ~120px wide, hour rows ~60px tall
- Scrollable vertically
- Events rendered as positioned blocks within their day column + time slot

### DayView

Single-column time grid with hour rows (8 AM – 8 PM default, scrollable). Events rendered as positioned blocks.

**Props**: Same shape as WeekView.

### Shared logic (internal to both):

**Time positioning**:
```ts
function eventStyle(event: CalendarEvent): React.CSSProperties {
  // Convert start/end times to pixel offsets from 8 AM
  // Each hour = 60px
  // top = (hours since 8 AM) * 60
  // height = duration in hours * 60
}
```

**Overlapping events**: For simplicity, stack side-by-side if overlap (compute columns). See if `date-fns` `areIntervalsOverlapping` helps. Max 3 columns before "+N more".

**Event block**: `bg-brand-ink text-brand-canvas rounded-md p-2 text-xs cursor-pointer border border-brand-hairline`. Shows event name + time range. Truncates if too short.

**Current time indicator**: Red/mauve horizontal line at current time position (`brand-error` or `brand-warning`).

**Acceptance**:
- [ ] WeekView renders 7-day grid with correct date headers
- [ ] DayView renders single-day time grid
- [ ] Both views show hourly slots 8 AM – 8 PM, scrollable
- [ ] Events positioned correctly by time (top offset + height)
- [ ] Event blocks clickable → edit modal
- [ ] Empty slot click → create modal (pre-fills time)
- [ ] Current time indicator shown
- [ ] Matches dark theme tokens
- [ ] `npm run lint` passes

---

## Subtask 8 — Client: Calendar Header & Navigation (~150 LOC)

**File**: `client/src/components/calendar/CalendarHeader.tsx`

Top bar for the calendar view. Contains navigation and view switcher.

**Props**:
```ts
interface CalendarHeaderProps {
  viewMode: ViewMode;
  selectedDate: string;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onNavigateToday: () => void;
  onAddEvent: () => void;
}
```

**Layout** (horizontal bar, `flex items-center justify-between p-4`):

Left side:
- "Today" button (secondary/ghost, rounded-full, h-8)
- `<` (back) and `>` (forward) navigation arrows (icon buttons, `lucide-react` ChevronLeft/ChevronRight, 24px)
- Date label (e.g., "July 2026" for month, "Jul 28 – Aug 3, 2026" for week, "Tuesday, Jul 28, 2026" for day) — use `date-fns` `format` with appropriate format strings

Right side:
- View mode toggle: 3-segment pill control (Day | Week | Month). Active segment `bg-brand-ink text-brand-canvas`, inactive `text-brand-body`. `rounded-full` pill wrapping them.
- "+ New Event" button (primary, pill, `bg-brand-ink text-brand-canvas`, h-10)

**Date label formatting** per view mode:
- Day: `format(date, "EEEE, MMMM d, yyyy")` → "Tuesday, July 28, 2026"
- Week: compute week start/end via `startOfWeek`/`endOfWeek`, then format range
- Month: `format(date, "MMMM yyyy")` → "July 2026"

**Acceptance**:
- [ ] Navigation: today/back/forward buttons work
- [ ] Date label updates per view mode
- [ ] View mode toggle (Day/Week/Month) with active state
- [ ] "+ New Event" button emits `onAddEvent`
- [ ] Matches dark theme tokens
- [ ] `npm run lint` passes

---

## Subtask 9 — Client: CalendarView Page + Routing + Sidebar (~150 LOC)

**File**: `client/src/views/CalendarView.tsx`

Root page component that wires together all calendar sub-components.

```tsx
export default function CalendarView() {
  const {
    events, loading, viewMode, selectedDate,
    setViewMode, setSelectedDate, navigateBack, navigateForward, navigateToday,
    fetchEvents, createEvent, updateEvent, deleteEvent,
  } = useCalendarStore();

  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null);
  const [modalInitialTimes, setModalInitialTimes] = useState<{ start?: string; end?: string }>({});

  // Compute rangeStart/rangeEnd based on viewMode + selectedDate
  // Fetch events when range changes
  useEffect(() => {
    const { start, end } = computeRange(viewMode, selectedDate);
    fetchEvents(start, end);
  }, [viewMode, selectedDate, fetchEvents]);

  function handleSlotClick(start: string, end?: string) { ... }
  function handleEventClick(event: CalendarEvent) { ... }
  function handleSave(input: CreateEventInput | UpdateEventInput) { ... }
  function handleDelete(id: string) { ... }

  return (
    <div className="h-full flex flex-col bg-brand-canvas-soft">
      <CalendarHeader ... />
      <div className="flex-1 overflow-hidden">
        {viewMode === "month" && <MonthView ... />}
        {viewMode === "week" && <WeekView ... />}
        {viewMode === "day" && <DayView ... />}
      </div>
      {modalEvent !== undefined && (
        <EventModal
          event={modalEvent}
          initialStart={modalInitialTimes.start}
          initialEnd={modalInitialTimes.end}
          onClose={() => setModalEvent(undefined)}
          onSave={handleSave}
          onDelete={modalEvent ? handleDelete : undefined}
        />
      )}
    </div>
  );
}
```

**Helper**: `computeRange(viewMode, date)` returns `{ start, end }` ISO strings:
- Day: start of day → end of day
- Week: start of week → end of week
- Month: start of month → end of month (+ buffer days for grid padding — fetch full 6-week visible range)

**Routing** (`client/src/App.tsx`):
```tsx
import CalendarView from "./views/CalendarView";
// Inside ProtectedLayout:
<Route path="/calendar" element={<CalendarView />} />
```

**Sidebar** (`client/src/components/Sidebar.tsx`):
Add nav item:
```tsx
<NavLink to="/calendar">Calendar</NavLink>
```
Use `lucide-react` `Calendar` icon (16–20px).

**Acceptance**:
- [ ] `/calendar` route works, shows CalendarView
- [ ] Sidebar has Calendar link with icon
- [ ] View mode switching renders correct sub-view
- [ ] Date navigation works across all views
- [ ] Create/edit/delete event flow works end-to-end
- [ ] Events persist across page navigations (refetch on mount)
- [ ] `npm run build` passes (both client + server)
- [ ] `npm run lint` passes (both workspaces)

---

## Execution Order

1. Subtask 1 (DB schema) — foundation
2. Subtask 2 (API routes) — depends on #1
3. Subtask 3 (Types) — independent
4. Subtask 4 (Store) — depends on #3
5. Subtask 5 (EventModal) — depends on #3, #4
6. Subtask 6 (MonthView) — depends on #3
7. Subtask 7 (Week/Day views) — depends on #3
8. Subtask 8 (CalendarHeader) — depends on #3
9. Subtask 9 (CalendarView + routing) — depends on #4, #5, #6, #7, #8

Subtasks 3, 5, 6, 7, 8 can partially overlap once types are ready.

---

## Dependencies

- `date-fns` (install if not present: `npm install date-fns -w client`)
- `lucide-react` (already installed) — used for navigation arrows, calendar icon, close button, trash icon
- All existing infrastructure: Supabase auth, Drizzle ORM, Zustand, Express, Tailwind v4
