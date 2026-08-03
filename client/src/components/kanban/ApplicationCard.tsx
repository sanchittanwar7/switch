import { Draggable } from "@hello-pangea/dnd";
import type { Application as ApplicationType } from "../../types";

interface ApplicationCardProps {
  application: ApplicationType;
  index: number;
  onClick?: () => void;
}

export default function ApplicationCard({ application, index, onClick }: ApplicationCardProps) {
  const lastComment = application.comments?.[application.comments.length - 1];

  return (
    <Draggable draggableId={application.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 rounded-lg border transition-all flex ${
            snapshot.isDragging
              ? "border-brand-hairline-strong bg-brand-canvas ring-1 ring-brand-ink/10"
              : "border-brand-hairline hover:border-brand-hairline-strong bg-brand-canvas"
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
              {application.company}
            </h4>
            <p className="text-xs text-brand-body mt-0.5 truncate">
              {application.role}
            </p>

            {application.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {application.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-brand-body bg-brand-canvas-soft-2 px-1.5 py-0.5 rounded-full border border-brand-hairline"
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
        </div>
      )}
    </Draggable>
  );
}
