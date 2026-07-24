import { useEffect, useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { useKanbanStore } from "../stores/kanbanStore";
import BoardHeader from "../components/kanban/BoardHeader";
import Column from "../components/kanban/Column";
import CardModal from "../components/kanban/CardModal";

export default function KanbanView() {
  const { columns, cards, loading, fetchBoard, moveCard } = useKanbanStore();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const selectedCard = selectedCardId ? cards[selectedCardId] : null;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const newColumns = columns.map((col) => ({
      id: col.id,
      cardIds: [...col.cardIds],
    }));

    const sourceCol = newColumns.find(
      (c) => c.id === source.droppableId,
    );
    const destCol = newColumns.find(
      (c) => c.id === destination.droppableId,
    );
    if (!sourceCol || !destCol) return;

    sourceCol.cardIds.splice(source.index, 1);
    destCol.cardIds.splice(destination.index, 0, draggableId);

    moveCard(newColumns);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-brand-mute">Loading board...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <BoardHeader />
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {columns
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((col) => (
              <Column
                key={col.id}
                column={col}
                cards={col.cardIds
                  .map((id) => cards[id])
                  .filter(Boolean)}
                onCardClick={setSelectedCardId}
              />
            ))}
        </div>
      </DragDropContext>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </div>
  );
}
