import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { parseISO, format, startOfWeek, endOfWeek } from "date-fns";
import type { ViewMode } from "../../types";

interface CalendarHeaderProps {
  viewMode: ViewMode;
  selectedDate: string;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onNavigateToday: () => void;
  onAddEvent: () => void;
}

const MODES: ViewMode[] = ["day", "week", "month"];

export default function CalendarHeader({
  viewMode,
  selectedDate,
  onViewModeChange,
  onNavigateBack,
  onNavigateForward,
  onNavigateToday,
  onAddEvent,
}: CalendarHeaderProps) {
  const dateLabel = useMemo(() => {
    const d = parseISO(selectedDate);
    switch (viewMode) {
      case "day":
        return format(d, "EEEE, MMMM d, yyyy");
      case "week": {
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        const we = endOfWeek(d, { weekStartsOn: 1 });
        const sameMonth = format(ws, "MMM") === format(we, "MMM");
        if (sameMonth) {
          return `${format(ws, "MMM d")} – ${format(we, "d, yyyy")}`;
        }
        return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
      }
      case "month":
        return format(d, "MMMM yyyy");
    }
  }, [viewMode, selectedDate]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-brand-hairline bg-brand-canvas shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={onNavigateToday}
          className="inline-flex items-center rounded-full px-3 h-8 text-sm font-medium text-brand-body hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
        >
          Today
        </button>

        <div className="flex items-center">
          <button
            onClick={onNavigateBack}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={onNavigateForward}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <h2 className="text-base font-semibold tracking-[-0.02em] text-brand-ink ml-2">
          {dateLabel}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-brand-hairline bg-brand-canvas-soft-2 p-0.5">
          {MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`px-3 h-7 text-xs font-medium rounded-full capitalize transition-colors ${
                viewMode === mode
                  ? "bg-brand-ink text-brand-canvas"
                  : "text-brand-body hover:text-brand-ink"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          onClick={onAddEvent}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink text-brand-canvas px-4 h-10 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Event
        </button>
      </div>
    </div>
  );
}
