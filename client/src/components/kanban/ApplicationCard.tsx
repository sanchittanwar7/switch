import { Draggable } from "@hello-pangea/dnd";
import { Wand, Loader2 } from "lucide-react";
import { useKanbanStore } from "../../stores/kanbanStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Application as ApplicationType } from "../../types";

interface ApplicationCardProps {
  application: ApplicationType;
  index: number;
  onClick?: () => void;
}

export default function ApplicationCard({ application, index, onClick }: ApplicationCardProps) {
  const lastComment = application.comments?.[application.comments.length - 1];
  const { generatingCards, generatingStatus, autoGenerateResume } = useKanbanStore();
  const { defaultResumeName } = useSettingsStore();

  const isWishlist = application.columnId === "wishlist";
  const isGenerating = generatingCards.has(application.id);
  const genStatus = generatingStatus[application.id];
  const hasDefaultResume = !!defaultResumeName;

  return (
    <Draggable draggableId={application.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 rounded-lg border transition-all flex min-w-0 ${
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
            <h4 className="text-sm font-medium text-brand-ink truncate" title={application.company}>
              {application.company}
            </h4>
            <p className="text-xs text-brand-body mt-0.5 truncate" title={application.role}>
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

            {isGenerating && genStatus && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-brand-link">
                <Loader2 size={12} className="animate-spin" />
                <span className="truncate">
                  {genStatus.error ? genStatus.error : genStatus.step}
                </span>
                {!genStatus.error && (
                  <span className="text-brand-mute shrink-0">({genStatus.toolCalls} steps)</span>
                )}
              </div>
            )}

            {isWishlist && !isGenerating && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasDefaultResume || !application.jobUrl) return;
                  autoGenerateResume(application.id);
                }}
                disabled={!hasDefaultResume || !application.jobUrl}
                className={`flex items-center gap-1 mt-2 text-xs transition-colors ${
                  !hasDefaultResume || !application.jobUrl
                    ? "text-brand-mute/50 cursor-not-allowed"
                    : "text-brand-link hover:text-brand-link-deep"
                }`}
                title={
                  !application.jobUrl && !hasDefaultResume
                    ? "Add a job URL and set a default resume first"
                    : !application.jobUrl
                      ? "Add a job URL first"
                      : !hasDefaultResume
                        ? "Set a default resume first"
                        : "Auto-generate tailored resume"
                }
              >
                <Wand size={12} />
                Auto-generate
              </button>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
