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
          className={`mb-2 rounded-lg border transition-all flex ${
            snapshot.isDragging
              ? "border-brand-hairline-strong shadow-lg bg-brand-canvas ring-1 ring-brand-ink/10"
              : "border-brand-hairline hover:border-brand-hairline-strong bg-brand-canvas-soft-2"
          }`}
          style={{
            ...provided.draggableProps.style,
            boxShadow: snapshot.isDragging
              ? "0px 1px 1px rgba(0,0,0,0.08), 0px 8px 16px -4px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.04)"
              : "0px 1px 1px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(0,0,0,0.04)",
          }}
        >
          <div
            onClick={onClick}
            className="flex-1 p-3 cursor-pointer min-w-0"
          >
            <h4 className="text-sm font-medium text-brand-ink truncate">
              {card.company}
            </h4>
            <p className="text-xs text-brand-body mt-0.5 truncate">
              {card.role}
            </p>

            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] text-brand-body bg-brand-canvas-soft px-1.5 py-0.5 rounded-full border border-brand-hairline"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {lastComment && (
              <p className="text-xs text-brand-mute mt-2 truncate">
                {lastComment.text}
              </p>
            )}
          </div>

          <div
            {...provided.dragHandleProps}
            className="flex items-center px-1 text-brand-mute/40 hover:text-brand-mute cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical size={16} />
          </div>
        </div>
      )}
    </Draggable>
  );
}
