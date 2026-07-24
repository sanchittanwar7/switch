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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-base font-semibold text-gray-100">Edit Card</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/20 placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/20 placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Job URL
            </label>
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/20 placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Resume Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={resumePath}
                onChange={(e) => setResumePath(e.target.value)}
                placeholder="resumes/default"
                className="flex-1 px-3 py-2 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/20 placeholder:text-gray-500"
              />
              {card.resumePath && (
                <button
                  onClick={() =>
                    navigate(`/editor?project=${card.resumePath}`)
                  }
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-colors shrink-0"
                  title="Open resume in editor"
                >
                  <ExternalLink size={13} />
                  Open
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Tags
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="remote, frontend, senior"
              className="w-full px-3 py-2 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/20 placeholder:text-gray-500"
            />
            {parsedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {parsedTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/5">
            <h3 className="text-xs font-medium text-gray-400 mb-3">
              Comments
            </h3>
            {card.comments.length === 0 ? (
              <p className="text-xs text-gray-600">No comments yet.</p>
            ) : (
              <div className="space-y-2.5 mb-3">
                {card.comments.map((comment) => (
                  <div key={comment.id} className="text-xs">
                    <p className="text-gray-300">{comment.text}</p>
                    <p className="text-gray-600 mt-0.5">
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
                className="flex-1 px-3 py-2 text-xs text-gray-200 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/20 placeholder:text-gray-500"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || commenting}
                className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-30"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                Delete this card?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
              >
                {deleting ? "Deleting..." : "Yes"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-300 rounded transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!company.trim() || !role.trim() || saving}
            className="px-4 py-1.5 text-xs font-medium text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
