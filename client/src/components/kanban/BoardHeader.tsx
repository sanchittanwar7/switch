import { useKanbanStore } from "../../stores/kanbanStore";

export default function BoardHeader() {
  const cards = useKanbanStore((s) => s.cards);
  const cardCount = Object.keys(cards).length;

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold text-white tracking-tight">
        Job Pipeline
      </h1>
      <span className="text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
        {cardCount} {cardCount === 1 ? "application" : "applications"}
      </span>
    </div>
  );
}
