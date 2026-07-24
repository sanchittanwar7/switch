import { Draggable } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import type { Card as CardType } from "../../types";

interface CardProps {
  card: CardType;
  index: number;
  onClick?: () => void;
}

export default function Card({ card, index, onClick }: CardProps) {
  const lastComment = card.comments?.[card.comments.length - 1];

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`mb-2 rounded-md border transition-shadow flex ${
            snapshot.isDragging
              ? "border-white/20 shadow-lg ring-1 ring-white/20 bg-white/15"
              : "border-white/5 hover:border-white/10 bg-white/10"
          }`}
        >
          <div
            onClick={onClick}
            className="flex-1 p-3 cursor-pointer min-w-0"
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

          <div
            {...provided.dragHandleProps}
            className="flex items-center px-1 text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical size={16} />
          </div>
        </div>
      )}
    </Draggable>
  );
}
