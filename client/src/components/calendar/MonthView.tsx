import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  format,
} from "date-fns";
import type { CalendarEvent } from "../../types";

interface MonthViewProps {
  events: CalendarEvent[];
  selectedDate: string;
  onDateClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: string) => void;
}

const MAX_VISIBLE_EVENTS = 3;

function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter((e) => {
    const start = parseISO(e.startTime);
    return isSameDay(start, date);
  });
}

export default function MonthView({
  events,
  selectedDate,
  onDateClick,
  onEventClick,
  onSlotClick,
}: MonthViewProps) {
  const weeks = useMemo(() => {
    const d = parseISO(selectedDate);
    const monthStart = startOfMonth(d);
    const monthEnd = endOfMonth(d);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [selectedDate]);

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b border-brand-hairline">
        {dayNames.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-xs font-medium text-brand-mute uppercase tracking-wide"
          >
            {name}
          </div>
        ))}
      </div>

      <div
        className="flex-1 grid grid-cols-1"
        style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}
      >
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-brand-hairline last:border-b-0 min-h-0">
            {week.map((day, di) => {
              const inMonth = isSameMonth(day, parseISO(selectedDate));
              const today = isToday(day);
              const dayEvents = getEventsForDate(events, day);
              const dateStr = day.toISOString();

              return (
                <div
                  key={di}
                  className={`relative border-r border-brand-hairline last:border-r-0 p-1.5 min-h-[80px] cursor-pointer hover:bg-brand-canvas-soft-2/50 transition-colors ${
                    !inMonth ? "opacity-40" : ""
                  }`}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      onSlotClick(dateStr);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDateClick(dateStr);
                      }}
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        today
                          ? "bg-brand-link text-white"
                          : inMonth
                            ? "text-brand-ink hover:bg-brand-canvas-soft-2"
                            : "text-brand-mute"
                      }`}
                    >
                      {format(day, "d")}
                    </button>
                  </div>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className="w-full text-left bg-brand-ink text-brand-canvas rounded-full text-[10px] px-2 py-0.5 truncate hover:opacity-80 transition-opacity"
                      >
                        {event.name}
                      </button>
                    ))}
                    {dayEvents.length > MAX_VISIBLE_EVENTS && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDateClick(dateStr);
                        }}
                        className="w-full text-left text-[10px] text-brand-mute px-2 hover:text-brand-body transition-colors"
                      >
                        +{dayEvents.length - MAX_VISIBLE_EVENTS} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
