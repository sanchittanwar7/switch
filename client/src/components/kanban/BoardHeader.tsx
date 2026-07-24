import { useKanbanStore } from "../../stores/kanbanStore";

export default function BoardHeader() {
  const cards = useKanbanStore((s) => s.cards);
  const cardCount = Object.keys(cards).length;

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-[24px] font-semibold leading-[32px] tracking-[-0.96px] text-brand-ink">
        Job Pipeline
      </h1>
      <span className="text-sm text-brand-body bg-brand-canvas-soft-2 px-3 py-1 rounded-full border border-brand-hairline">
        {cardCount} {cardCount === 1 ? "application" : "applications"}
      </span>
    </div>
  );
}
