import { useState } from "react";
import { Send } from "lucide-react";
import { useKanbanStore } from "../../stores/kanbanStore";
import type { Application } from "../../types";

interface CommentsSectionProps {
  application: Application;
  onRefresh: () => void;
}

export default function CommentsSection({ application, onRefresh }: CommentsSectionProps) {
  const { addComment } = useKanbanStore();

  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [commentError, setCommentError] = useState("");

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setCommentError("");
    setCommenting(true);
    try {
      await addComment(application.id, commentText.trim());
      setCommentText("");
      onRefresh();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setCommenting(false);
    }
  };

  const sortedComments = [...application.comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div>
      <h2 className="text-sm font-semibold text-brand-ink mb-4">Comments</h2>

      {commentError && (
        <p className="text-xs text-brand-error bg-brand-error-soft px-3 py-2 rounded-md mb-3">
          {commentError}
        </p>
      )}

      {sortedComments.length === 0 && (
        <p className="text-xs text-brand-mute mb-3">No comments yet.</p>
      )}

      {sortedComments.length > 0 && (
        <div className="space-y-3 mb-4">
          {sortedComments.map((comment) => (
            <div key={comment.id} className="text-xs">
              <p className="text-brand-ink">{comment.text}</p>
              <p className="text-brand-mute mt-0.5">
                {new Date(comment.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
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
  );
}
