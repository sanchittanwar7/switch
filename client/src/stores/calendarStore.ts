import { create } from "zustand";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import type { CalendarEvent, CreateEventInput, UpdateEventInput, ViewMode } from "../types";
import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";

interface CalendarStore {
  events: CalendarEvent[];
  loading: boolean;
  viewMode: ViewMode;
  selectedDate: string;

  cachedEvents: CalendarEvent[];
  cachedRangeStart: string | null;
  cachedRangeEnd: string | null;

  setViewMode: (mode: ViewMode) => void;
  setSelectedDate: (date: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  navigateToday: () => void;

  initialize: () => void;
  prefetch: (date: string) => Promise<void>;
  applyViewFilter: () => void;

  createEvent: (input: CreateEventInput) => Promise<CalendarEvent>;
  updateEvent: (id: string, input: UpdateEventInput) => Promise<CalendarEvent>;
  deleteEvent: (id: string) => Promise<void>;
}

function computeRangeForMode(mode: ViewMode, isoDate: string): { start: string; end: string } {
  const d = parseISO(isoDate);
  switch (mode) {
    case "day":
      return { start: startOfDay(d).toISOString(), end: endOfDay(d).toISOString() };
    case "week":
      return { start: startOfWeek(d, { weekStartsOn: 1 }).toISOString(), end: endOfWeek(d, { weekStartsOn: 1 }).toISOString() };
    case "month": {
      const monthStart = startOfMonth(d);
      const monthEnd = endOfMonth(d);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return { start: gridStart.toISOString(), end: gridEnd.toISOString() };
    }
  }
}

function rangeCovers(cachedStart: string | null, cachedEnd: string | null, targetStart: string, targetEnd: string): boolean {
  if (!cachedStart || !cachedEnd) return false;
  return cachedStart <= targetStart && cachedEnd >= targetEnd;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: [],
  loading: false,
  viewMode: "month",
  selectedDate: new Date().toISOString(),

  cachedEvents: [],
  cachedRangeStart: null,
  cachedRangeEnd: null,

  applyViewFilter: () => {
    const { viewMode, selectedDate, cachedEvents } = get();
    const { start, end } = computeRangeForMode(viewMode, selectedDate);
    const viewStart = new Date(start).getTime();
    const viewEnd = new Date(end).getTime();

    const filtered = cachedEvents.filter((e) => {
      const eventStart = new Date(e.startTime).getTime();
      const eventEnd = new Date(e.endTime).getTime();
      return eventEnd >= viewStart && eventStart <= viewEnd;
    });

    set({ events: filtered });
  },

  prefetch: async (date) => {
    const d = parseISO(date);
    const cacheStart = startOfDay(startOfMonth(subMonths(d, 1)));
    const cacheEnd = endOfDay(endOfMonth(addMonths(d, 1)));
    const rangeStart = cacheStart.toISOString();
    const rangeEnd = cacheEnd.toISOString();

    const { cachedRangeStart, cachedRangeEnd } = get();
    if (rangeCovers(cachedRangeStart, cachedRangeEnd, rangeStart, rangeEnd)) {
      get().applyViewFilter();
      return;
    }

    const { cachedEvents, viewMode } = get();
    if (cachedEvents.length > 0) {
      get().applyViewFilter();
    }
    set({ loading: cachedEvents.length === 0 });

    try {
      const events = await apiGet<CalendarEvent[]>(
        `/api/calendar?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`,
      );
      set({
        cachedEvents: events,
        cachedRangeStart: rangeStart,
        cachedRangeEnd: rangeEnd,
        loading: false,
      });
      get().applyViewFilter();
    } catch {
      set({ loading: false });
    }
  },

  initialize: () => {
    get().prefetch(get().selectedDate);
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
    get().prefetch(get().selectedDate);
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().prefetch(date);
  },

  navigateBack: () => {
    const { viewMode, selectedDate } = get();
    const d = parseISO(selectedDate);
    let next: Date;
    switch (viewMode) {
      case "day":
        next = subDays(d, 1);
        break;
      case "week":
        next = subWeeks(d, 1);
        break;
      case "month":
        next = subMonths(d, 1);
        break;
    }
    get().setSelectedDate(next.toISOString());
  },

  navigateForward: () => {
    const { viewMode, selectedDate } = get();
    const d = parseISO(selectedDate);
    let next: Date;
    switch (viewMode) {
      case "day":
        next = addDays(d, 1);
        break;
      case "week":
        next = addWeeks(d, 1);
        break;
      case "month":
        next = addMonths(d, 1);
        break;
    }
    get().setSelectedDate(next.toISOString());
  },

  navigateToday: () => {
    get().setSelectedDate(new Date().toISOString());
  },

  createEvent: async (input) => {
    const event = await apiPost<CalendarEvent>("/api/calendar", input);
    set((state) => ({
      cachedEvents: [...state.cachedEvents, event],
    }));
    get().applyViewFilter();
    return event;
  },

  updateEvent: async (id, input) => {
    const updated = await apiPatch<CalendarEvent>(`/api/calendar/${id}`, input);
    set((state) => ({
      cachedEvents: state.cachedEvents.map((e) => (e.id === id ? updated : e)),
    }));
    get().applyViewFilter();
    return updated;
  },

  deleteEvent: async (id) => {
    await apiDelete(`/api/calendar/${id}`);
    set((state) => ({
      cachedEvents: state.cachedEvents.filter((e) => e.id !== id),
    }));
    get().applyViewFilter();
  },
}));
