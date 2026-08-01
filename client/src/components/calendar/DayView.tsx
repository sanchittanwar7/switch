import { useMemo } from "react";
import {
  isSameDay,
  parseISO,
  format,
  setHours,
  setMinutes,
  differenceInMinutes,
  areIntervalsOverlapping,
} from "date-fns";
import type { CalendarEvent } from "../../types";

interface DayViewProps {
  events: CalendarEvent[];
  selectedDate: string;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (start: string, end: string) => void;
}

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 60;
const TOTAL_HOURS = END_HOUR - START_HOUR;

function eventStyle(
  event: CalendarEvent,
  column: number,
  totalColumns: number,
): React.CSSProperties {
  const start = parseISO(event.startTime);
  const end = parseISO(event.endTime);
  const startOfRange = setMinutes(setHours(start, START_HOUR), 0);
  const topMinutes = differenceInMinutes(start, startOfRange);
  const durationMinutes = differenceInMinutes(end, start);

  const top = (topMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20);
  const width = totalColumns > 1 ? `${(1 / totalColumns) * 100}%` : "100%";
  const left = totalColumns > 1 ? `${(column / totalColumns) * 100}%` : "0";

  return {
    position: "absolute",
    top: `${top}px`,
    height: `${height}px`,
    width,
    left,
    zIndex: 10,
  };
}

function computeOverlapColumns(dayEvents: CalendarEvent[]): Map<string, { col: number; total: number }> {
  const result = new Map<string, { col: number; total: number }>();

  for (const event of dayEvents) {
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    const overlapping = dayEvents.filter((other) => {
      if (other.id === event.id) return false;
      return areIntervalsOverlapping(
        { start: parseISO(other.startTime), end: parseISO(other.endTime) },
        { start, end },
      );
    });

    const takenCols = new Set<number>();
    for (const other of overlapping) {
      const existing = result.get(other.id);
      if (existing) takenCols.add(existing.col);
    }

    let col = 0;
    while (takenCols.has(col)) col++;
    const total = Math.max(col + 1, overlapping.length + 1);

    for (const other of overlapping) {
      const existing = result.get(other.id);
      if (existing) {
        result.set(other.id, { ...existing, total: Math.max(existing.total, total) });
      }
    }

    result.set(event.id, { col, total });
  }

  return result;
}

export default function DayView({
  events,
  selectedDate,
  onEventClick,
  onSlotClick,
}: DayViewProps) {
  const day = useMemo(() => parseISO(selectedDate), [selectedDate]);

  const dayEvents = useMemo(
    () =>
      events.filter((e) => {
        const es = parseISO(e.startTime);
        return isSameDay(es, day);
      }),
    [events, day],
  );

  const hours = useMemo(
    () => Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i),
    [],
  );

  const now = new Date();
  const isToday = isSameDay(day, now);
  const nowMinutesSinceStart =
    isToday
      ? (now.getHours() - START_HOUR) * 60 + now.getMinutes()
      : null;

  const overlapMap = useMemo(
    () => computeOverlapColumns(dayEvents),
    [dayEvents],
  );

  const handleGridClick = (hour: number) => {
    const start = setMinutes(setHours(day, hour), 0);
    const end = setMinutes(setHours(day, hour), 60);
    onSlotClick(start.toISOString(), end.toISOString());
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-center py-3 border-b border-brand-hairline shrink-0">
        <span className="text-sm font-semibold text-brand-ink">
          {format(day, "EEEE, MMMM d, yyyy")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-brand-hairline"
              style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
            />
          ))}

          {nowMinutesSinceStart !== null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: `${(nowMinutesSinceStart / 60) * HOUR_HEIGHT}px` }}
            >
              <div className="border-t border-brand-error" />
            </div>
          )}

          <div className="flex relative z-10">
            <div className="w-14 shrink-0">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex items-start justify-end pr-2"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="text-[10px] text-brand-mute -mt-1.5">
                    {format(setHours(new Date(), hour), "ha")}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 relative border-l border-brand-hairline" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="hover:bg-brand-canvas-soft-2/30 cursor-pointer transition-colors"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                  onClick={() => handleGridClick(hour)}
                />
              ))}

              {dayEvents.map((event) => {
                    const layout = overlapMap.get(event.id) ?? { col: 0, total: 1 };
                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className="bg-brand-ink text-brand-canvas rounded-md p-1.5 text-[10px] cursor-pointer border border-brand-hairline hover:opacity-80 transition-opacity overflow-hidden"
                        style={eventStyle(event, layout.col, layout.total)}
                      >
                        <div className="truncate">
                          <span className="text-brand-mute">
                            {format(parseISO(event.startTime), "h:mm a")}
                          </span>{" "}
                          <span>{event.name}</span>
                        </div>
                        {(event.company || event.roundName) && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {event.company && (
                              <span className="inline-block bg-brand-canvas-soft-2 text-brand-ink rounded-full text-[8px] px-1.5 py-px">
                                {event.company}
                              </span>
                            )}
                            {event.roundName && (
                              <span className="inline-block bg-brand-canvas-soft-2 text-brand-ink rounded-full text-[8px] px-1.5 py-px">
                                {event.roundName}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
