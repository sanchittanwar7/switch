import { Droppable } from "@hello-pangea/dnd";
import type { Column as ColumnType, Card } from "../../types";
import CardComponent from "./Card";
import AddCardButton from "./AddCardButton";

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
  onCardClick?: (cardId: string) => void;
}

export default function Column({ column, cards, onCardClick }: ColumnProps) {
  return (
    <div className="flex-shrink-0 w-[272px] flex flex-col bg-brand-canvas-soft rounded-lg border border-brand-hairline max-h-full">
      <div className="px-4 py-3 border-b border-brand-hairline">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-brand-ink">
            {column.title}
          </h3>
          <span className="text-xs text-brand-mute bg-brand-canvas-soft-2 px-2 py-0.5 rounded-full">
            {column.cardIds.length}
          </span>
        </div>
      </div>

      <Droppable droppableId={column.id} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-2 min-h-[100px] transition-colors rounded-b-lg ${
              snapshot.isDraggingOver ? "bg-brand-canvas-soft-2" : ""
            }`}
          >
            {cards.map((card, index) => (
              <CardComponent
                key={card.id}
                card={card}
                index={index}
                onClick={
                  onCardClick ? () => onCardClick(card.id) : undefined
                }
              />
            ))}
            {cards.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-20 text-xs text-brand-mute">
                No cards yet
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="px-2 pb-2">
        <AddCardButton columnId={column.id} />
      </div>
    </div>
  );
}
