import { useState, useEffect, useCallback } from "react";
import { useCalendarStore } from "../stores/calendarStore";
import CalendarHeader from "../components/calendar/CalendarHeader";
import MonthView from "../components/calendar/MonthView";
import WeekView from "../components/calendar/WeekView";
import DayView from "../components/calendar/DayView";
import EventModal from "../components/calendar/EventModal";
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from "../types";

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
    initialize,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useCalendarStore();

  const [modalEvent, setModalEvent] = useState<CalendarEvent | null | undefined>(undefined);
  const [modalInitialTimes, setModalInitialTimes] = useState<{ start?: string; end?: string }>({});

  useEffect(() => {
    initialize();
  }, []);

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

  const showLoader = loading && events.length === 0;

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

      <div className="flex-1 overflow-hidden relative">
        {showLoader && (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-canvas-soft z-10">
            <span className="text-sm text-brand-mute">Loading...</span>
          </div>
        )}

        {viewMode === "month" && (
          <MonthView
            events={events}
            selectedDate={selectedDate}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onSlotClick={(date) => handleSlotClick(date)}
          />
        )}

        {viewMode === "week" && (
          <WeekView
            events={events}
            selectedDate={selectedDate}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        )}

        {viewMode === "day" && (
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
