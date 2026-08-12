import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Trash2, ExternalLink, Send, Wand } from "lucide-react";
import { useKanbanStore } from "../../stores/kanbanStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { apiGet } from "../../lib/api";
import type { Application } from "../../types";

interface ResumeEntry {
  name: string;
  mtime: string;
}

interface ApplicationModalProps {
  application: Application;
  onClose: () => void;
}

export default function ApplicationModal({ application, onClose }: ApplicationModalProps) {
  const navigate = useNavigate();
  const { updateApplication, deleteApplication, addComment, generatingCards, autoGenerateResume } = useKanbanStore();
  const { defaultResumeName } = useSettingsStore();

  const isWishlist = application.columnId === "wishlist";
  const isGenerating = generatingCards.has(application.id);
  const canGenerate = isWishlist && application.jobUrl && !isGenerating && !!defaultResumeName;

  const [company, setCompany] = useState(application.company);
  const [role, setRole] = useState(application.role);
  const [jobUrl, setJobUrl] = useState(application.jobUrl || "");
  const [resumePath, setResumePath] = useState(application.resumePath || "");
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [tagsInput, setTagsInput] = useState(application.tags.join(", "));
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [commenting, setCommenting] = useState(false);

  useEffect(() => {
    apiGet<ResumeEntry[]>("/api/fs/resumes")
      .then(setResumes)
      .catch(() => setResumes([]));
  }, []);

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const handleSave = async () => {
    if (!company.trim() || !role.trim()) return;
    setSaving(true);
    await updateApplication(application.id, {
      company: company.trim(),
      role: role.trim(),
      jobUrl: jobUrl.trim() || null,
      resumePath: resumePath.trim() || null,
      tags: parsedTags,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deleteApplication(application.id);
    onClose();
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setCommenting(true);
    await addComment(application.id, commentText.trim());
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
        className="w-full max-w-lg bg-brand-canvas border border-brand-hairline rounded-xl max-h-[80vh] flex flex-col"
        style={{
          boxShadow:
            "0px 1px 1px rgba(0,0,0,0.08), 0px 8px 16px -4px rgba(0,0,0,0.12), 0px 24px 32px -8px rgba(0,0,0,0.16), inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-hairline">
          <h2 className="text-base font-semibold text-brand-ink">
            Edit Application
          </h2>
          <div className="flex items-center gap-1">
            {canGenerate && (
              <button
                onClick={() => autoGenerateResume(application.id)}
                className="p-1 rounded-full text-brand-mute hover:text-brand-link hover:bg-brand-canvas-soft-2 transition-colors"
                title="Auto-generate tailored resume"
              >
                <Wand size={18} />
              </button>
            )}
            <button
              onClick={() => navigate(`/application/${application.id}`)}
              className="p-1 rounded-full text-brand-mute hover:text-brand-link hover:bg-brand-canvas-soft-2 transition-colors"
              title="Open application details"
            >
              <ExternalLink size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
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
              className="w-full px-3 h-10 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
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
              className="w-full px-3 h-10 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
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
              className="w-full px-3 h-10 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-brand-body mb-1.5 block">
              Resume Path
            </span>
            <div className="flex gap-2">
              <select
                value={resumePath}
                onChange={(e) => setResumePath(e.target.value)}
                className="flex-1 px-3 h-10 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
              >
                <option value="">None</option>
                {resumes.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
              {resumePath && (
                <button
                  onClick={() =>
                    navigate(`/resume?project=${resumePath}`)
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
              className="w-full px-3 h-10 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
            />
            {parsedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {parsedTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-brand-body bg-brand-canvas-soft-2 border border-brand-hairline px-1.5 py-0.5 rounded-full"
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
            {application.comments.length === 0 ? (
              <p className="text-xs text-brand-mute">No comments yet.</p>
            ) : (
              <div className="space-y-2.5 mb-3">
                {application.comments.map((comment) => (
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
            <div className="flex flex-col gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && commentText.trim()) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder="Add a comment..."
                rows={3}
                className="w-full px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute resize-y"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || commenting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-link hover:text-brand-link-deep bg-brand-canvas-soft-2 hover:bg-brand-canvas-soft border border-brand-hairline rounded-full transition-colors disabled:opacity-30"
                >
                  <Send size={12} />
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-brand-hairline">
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-mute">
                Delete this application?
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
