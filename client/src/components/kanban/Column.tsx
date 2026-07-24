import { Droppable } from "@hello-pangea/dnd";
import type { Column as ColumnType, Card } from "../../types";

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
}

export default function Column({ column, cards }: ColumnProps) {
  return (
    <div className="flex-shrink-0 w-[272px] flex flex-col bg-white/5 rounded-lg border border-white/5 max-h-full">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-200">
            {column.title}
          </h3>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
            {column.cardIds.length}
          </span>
        </div>
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-2 min-h-[100px] transition-colors rounded-b-lg ${
              snapshot.isDraggingOver ? "bg-white/[0.07]" : ""
            }`}
          >
            {cards.length === 0 && (
              <div className="flex items-center justify-center h-20 text-xs text-gray-600">
                No cards yet
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
