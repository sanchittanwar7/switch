import { useState } from "react";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { deleteInterview } from "../../lib/api";
import InterviewForm from "./InterviewForm";
import type { Interview, InterviewType } from "../../types";

const TYPE_COLORS: Record<InterviewType, { bg: string; text: string }> = {
  phone_screen: { bg: "bg-brand-canvas-soft-2", text: "text-brand-body" },
  coding: { bg: "bg-blue-950/40", text: "text-blue-400" },
  technical: { bg: "bg-amber-950/40", text: "text-amber-400" },
  system_design: { bg: "bg-purple-950/40", text: "text-purple-400" },
  behavioral: { bg: "bg-green-950/40", text: "text-green-400" },
  onsite: { bg: "bg-red-950/40", text: "text-red-400" },
  final: { bg: "bg-brand-link/10", text: "text-brand-link" },
  take_home: { bg: "bg-teal-950/40", text: "text-teal-400" },
  other: { bg: "bg-brand-canvas-soft-2", text: "text-brand-mute" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "bg-brand-link/10", text: "text-brand-link" },
  completed: { bg: "bg-green-950/40", text: "text-green-400" },
  passed: { bg: "bg-green-950/40", text: "text-green-400" },
  failed: { bg: "bg-brand-error-soft", text: "text-brand-error" },
};

function formatType(type: InterviewType): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface InterviewsSectionProps {
  applicationId: string;
  interviews: Interview[];
  onRefresh: () => void;
}

export default function InterviewsSection({ applicationId, interviews, onRefresh }: InterviewsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const handleDelete = async (interviewId: string) => {
    setDeleteError("");
    setDeletingId(interviewId);
    try {
      await deleteInterview(applicationId, interviewId);
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingId(null);
    onRefresh();
  };

  const editingInterview = editingId ? interviews.find((i) => i.id === editingId) ?? null : null;

  const sortedInterviews = [...interviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-ink">Interviews</h2>
        {!showForm && !editingId && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-link hover:text-brand-link-deep bg-brand-canvas-soft-2 hover:bg-brand-canvas-soft border border-brand-hairline rounded-full transition-colors"
          >
            <Plus size={13} />
            Add Interview
          </button>
        )}
      </div>

      {deleteError && (
        <p className="text-xs text-brand-error bg-brand-error-soft px-3 py-2 rounded-md">
          {deleteError}
        </p>
      )}

      {showForm && (
        <InterviewForm
          applicationId={applicationId}
          onSave={handleFormSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingId && editingInterview && (
        <InterviewForm
          applicationId={applicationId}
          interview={editingInterview}
          onSave={handleFormSave}
          onCancel={() => setEditingId(null)}
        />
      )}

      {!showForm && !editingId && sortedInterviews.length === 0 && (
        <div className="bg-brand-canvas-soft rounded-lg p-12 text-center">
          <p className="text-sm text-brand-mute">
            No interviews tracked yet. Add your first interview.
          </p>
        </div>
      )}

      {!showForm && !editingId && sortedInterviews.length > 0 && (
        <div className="space-y-3">
          {sortedInterviews.map((interview) => {
            const typeStyle = TYPE_COLORS[interview.type];
            const statusStyle = STATUS_COLORS[interview.status] ?? STATUS_COLORS.scheduled;
            const isConfirming = deleteConfirmId === interview.id;
            const isDeleting = deletingId === interview.id;

            return (
              <div
                key={interview.id}
                className="bg-brand-canvas border border-brand-hairline rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}
                    >
                      {formatType(interview.type)}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                    >
                      {interview.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isConfirming ? (
                      <>
                        <span className="text-xs text-brand-mute">Delete?</span>
                        <button
                          onClick={() => handleDelete(interview.id)}
                          disabled={isDeleting}
                          className="px-2 py-0.5 text-xs font-medium text-brand-error hover:bg-brand-error-soft rounded-full transition-colors"
                        >
                          {isDeleting ? "..." : "Yes"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-0.5 text-xs font-medium text-brand-mute hover:text-brand-ink rounded-full transition-colors"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingId(interview.id)}
                          className="p-1 rounded-full text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
                          title="Edit interview"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(interview.id)}
                          className="p-1 rounded-full text-brand-mute hover:text-brand-error hover:bg-brand-error-soft transition-colors"
                          title="Delete interview"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {interview.scheduledAt && (
                  <div className="flex items-center gap-1.5 text-xs text-brand-body">
                    <Calendar size={12} />
                    <span>{formatDate(interview.scheduledAt)}</span>
                  </div>
                )}

                {interview.questionTitle && (
                  <div>
                    <p className="text-xs font-medium text-brand-body mb-1">
                      Question Title
                    </p>
                    <p className="text-sm text-brand-ink whitespace-pre-wrap">
                      {interview.questionTitle}
                    </p>
                  </div>
                )}

                {interview.feedback && (
                  <div>
                    <p className="text-xs font-medium text-brand-body mb-1">
                      Feedback
                    </p>
                    <p className="text-sm text-brand-ink whitespace-pre-wrap">
                      {interview.feedback}
                    </p>
                  </div>
                )}

                {interview.questionDetail && (
                  <div>
                    <p className="text-xs font-medium text-brand-body mb-1">
                      Question Detail
                    </p>
                    <p className="text-sm text-brand-ink whitespace-pre-wrap">
                      {interview.questionDetail}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
