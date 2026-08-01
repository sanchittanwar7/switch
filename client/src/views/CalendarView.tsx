import { useState, useEffect, useCallback } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from "date-fns";
import { useCalendarStore } from "../stores/calendarStore";
import CalendarHeader from "../components/calendar/CalendarHeader";
import MonthView from "../components/calendar/MonthView";
import WeekView from "../components/calendar/WeekView";
import DayView from "../components/calendar/DayView";
import EventModal from "../components/calendar/EventModal";
import type { CalendarEvent, CreateEventInput, UpdateEventInput, ViewMode } from "../types";

function computeRange(mode: ViewMode, isoDate: string): { start: string; end: string } {
  const d = parseISO(isoDate);
  switch (mode) {
    case "day":
      return { start: startOfDay(d).toISOString(), end: endOfDay(d).toISOString() };
    case "week":
      return {
        start: startOfWeek(d, { weekStartsOn: 1 }).toISOString(),
        end: endOfWeek(d, { weekStartsOn: 1 }).toISOString(),
      };
    case "month": {
      const monthStart = startOfMonth(d);
      const monthEnd = endOfMonth(d);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return { start: gridStart.toISOString(), end: gridEnd.toISOString() };
    }
  }
}

export default function CalendarView() {
  const {
    events,
    loading,
    viewMode,
    selectedDate,
    setViewMode,
    setSelectedDate,
    navigateBack,
    navigateForward,
    navigateToday,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useCalendarStore();

  const [modalEvent, setModalEvent] = useState<CalendarEvent | null | undefined>(undefined);
  const [modalInitialTimes, setModalInitialTimes] = useState<{ start?: string; end?: string }>({});

  useEffect(() => {
    const { start, end } = computeRange(viewMode, selectedDate);
    fetchEvents(start, end);
  }, [viewMode, selectedDate, fetchEvents]);

  const handleSlotClick = useCallback(
    (start: string, end?: string) => {
      setModalEvent(null);
      setModalInitialTimes({ start, end });
    },
    [],
  );

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setModalEvent(event);
    setModalInitialTimes({});
  }, []);

  const handleDateClick = useCallback(
    (date: string) => {
      setViewMode("day");
      setSelectedDate(date);
    },
    [setViewMode, setSelectedDate],
  );

  const handleSave = useCallback(
    async (input: CreateEventInput | UpdateEventInput) => {
      if (modalEvent && "id" in modalEvent) {
        await updateEvent(modalEvent.id, input as UpdateEventInput);
      } else {
        await createEvent(input as CreateEventInput);
      }
    },
    [modalEvent, createEvent, updateEvent],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteEvent(id);
    },
    [deleteEvent],
  );

  const handleAddEvent = useCallback(() => {
    setModalEvent(null);
    setModalInitialTimes({});
  }, []);

  return (
    <div className="h-full flex flex-col bg-brand-canvas-soft">
      <CalendarHeader
        viewMode={viewMode}
        selectedDate={selectedDate}
        onViewModeChange={setViewMode}
        onNavigateBack={navigateBack}
        onNavigateForward={navigateForward}
        onNavigateToday={navigateToday}
        onAddEvent={handleAddEvent}
      />

      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <span className="text-sm text-brand-mute">Loading...</span>
          </div>
        )}

        {!loading && viewMode === "month" && (
          <MonthView
            events={events}
            selectedDate={selectedDate}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onSlotClick={(date) => handleSlotClick(date)}
          />
        )}

        {!loading && viewMode === "week" && (
          <WeekView
            events={events}
            selectedDate={selectedDate}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        )}

        {!loading && viewMode === "day" && (
          <DayView
            events={events}
            selectedDate={selectedDate}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        )}
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
