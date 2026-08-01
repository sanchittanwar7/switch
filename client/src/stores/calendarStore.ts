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

  setViewMode: (mode: ViewMode) => void;
  setSelectedDate: (date: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  navigateToday: () => void;

  fetchEvents: (rangeStart: string, rangeEnd: string) => Promise<void>;
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

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: [],
  loading: false,
  viewMode: "month",
  selectedDate: new Date().toISOString(),

  setViewMode: (mode) => {
    set({ viewMode: mode });
    const { selectedDate } = get();
    const { start, end } = computeRangeForMode(mode, selectedDate);
    get().fetchEvents(start, end);
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    const { viewMode } = get();
    const { start, end } = computeRangeForMode(viewMode, date);
    get().fetchEvents(start, end);
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

  fetchEvents: async (rangeStart, rangeEnd) => {
    set({ loading: true });
    try {
      const events = await apiGet<CalendarEvent[]>(
        `/api/calendar?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`,
      );
      set({ events, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createEvent: async (input) => {
    const event = await apiPost<CalendarEvent>("/api/calendar", input);
    set((state) => ({ events: [...state.events, event] }));
    return event;
  },

  updateEvent: async (id, input) => {
    const updated = await apiPatch<CalendarEvent>(`/api/calendar/${id}`, input);
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? updated : e)),
    }));
    return updated;
  },

  deleteEvent: async (id) => {
    await apiDelete(`/api/calendar/${id}`);
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    }));
  },
}));
