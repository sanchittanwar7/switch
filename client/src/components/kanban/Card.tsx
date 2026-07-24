import { Draggable } from "@hello-pangea/dnd";
import type { Card as CardType } from "../../types";

interface CardProps {
  card: CardType;
  index: number;
}

export default function Card({ card, index }: CardProps) {
  const lastComment = card.comments?.[card.comments.length - 1];

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 p-3 bg-white/10 rounded-md border cursor-pointer transition-shadow ${
            snapshot.isDragging
              ? "border-white/20 shadow-lg ring-1 ring-white/20"
              : "border-white/5 hover:border-white/10"
          }`}
        >
          <h4 className="text-sm font-medium text-gray-100 truncate">
            {card.company}
          </h4>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{card.role}</p>

          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {lastComment && (
            <p className="text-xs text-gray-500 mt-2 truncate">
              {lastComment.text}
            </p>
          )}
        </div>
      )}
    </Draggable>
  );
}
