import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Trash2, ExternalLink, Send } from "lucide-react";
import { useKanbanStore } from "../../stores/kanbanStore";
import type { Card as CardType } from "../../types";

interface CardModalProps {
  card: CardType;
  onClose: () => void;
}

export default function CardModal({ card, onClose }: CardModalProps) {
  const navigate = useNavigate();
  const { updateCard, deleteCard, addComment } = useKanbanStore();

  const [company, setCompany] = useState(card.company);
  const [role, setRole] = useState(card.role);
  const [jobUrl, setJobUrl] = useState(card.jobUrl || "");
  const [resumePath, setResumePath] = useState(card.resumePath || "");
  const [tagsInput, setTagsInput] = useState(card.tags.join(", "));
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [commenting, setCommenting] = useState(false);

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const handleSave = async () => {
    if (!company.trim() || !role.trim()) return;
    setSaving(true);
    await updateCard(card.id, {
      company: company.trim(),
      role: role.trim(),
      jobUrl: jobUrl.trim() || undefined,
      resumePath: resumePath.trim() || undefined,
      tags: parsedTags,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deleteCard(card.id);
    onClose();
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setCommenting(true);
    await addComment(card.id, commentText.trim());
    setCommentText("");
    setCommenting(false);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg bg-brand-canvas-soft border border-brand-hairline rounded-xl max-h-[80vh] flex flex-col"
        style={{
          boxShadow:
            "0px 1px 1px rgba(0,0,0,0.08), 0px 8px 16px -4px rgba(0,0,0,0.12), 0px 24px 32px -8px rgba(0,0,0,0.16), inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-hairline">
          <h2 className="text-base font-semibold text-brand-ink">
            Edit Card
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-brand-body mb-1.5 block">
              Company
            </span>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-brand-body mb-1.5 block">
              Role
            </span>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-brand-body mb-1.5 block">
              Job URL
            </span>
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-brand-body mb-1.5 block">
              Resume Path
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={resumePath}
                onChange={(e) => setResumePath(e.target.value)}
                placeholder="resumes/default"
                className="flex-1 px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
              />
              {card.resumePath && (
                <button
                  onClick={() =>
                    navigate(`/resume?project=${card.resumePath}`)
                  }
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-brand-link hover:text-brand-link-deep bg-brand-canvas-soft-2 hover:bg-brand-canvas-soft border border-brand-hairline rounded-full transition-colors shrink-0 font-medium"
                  title="Open resume in editor"
                >
                  <ExternalLink size={13} />
                  Open
                </button>
              )}
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-brand-body mb-1.5 block">
              Tags
            </span>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="remote, frontend, senior"
              className="w-full px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
            />
            {parsedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {parsedTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] text-brand-body bg-brand-canvas-soft-2 border border-brand-hairline px-1.5 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </label>

          <div className="pt-2 border-t border-brand-hairline">
            <h3 className="text-xs font-medium text-brand-body mb-3">
              Comments
            </h3>
            {card.comments.length === 0 ? (
              <p className="text-xs text-brand-mute">No comments yet.</p>
            ) : (
              <div className="space-y-2.5 mb-3">
                {card.comments.map((comment) => (
                  <div key={comment.id} className="text-xs">
                    <p className="text-brand-ink">{comment.text}</p>
                    <p className="text-brand-mute mt-0.5">
                      {new Date(comment.createdAt).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && commentText.trim()) {
                    handleAddComment();
                  }
                }}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 text-xs text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || commenting}
                className="p-2 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-full transition-colors disabled:opacity-30"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-brand-hairline">
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-mute">
                Delete this card?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1 text-xs font-medium text-brand-error hover:bg-brand-error-soft rounded-full transition-colors"
              >
                {deleting ? "Deleting..." : "Yes"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-1 text-xs font-medium text-brand-mute hover:text-brand-ink rounded-full transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-mute hover:text-brand-error hover:bg-brand-error-soft rounded-full transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!company.trim() || !role.trim() || saving}
            className="px-4 py-1.5 text-xs font-medium text-brand-on-primary bg-brand-ink hover:opacity-90 rounded-full transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
