import { useState } from "react";
import { X } from "lucide-react";
import { createInterview, updateInterview } from "../../lib/api";
import type { Interview, InterviewType, InterviewStatus } from "../../types";

const INTERVIEW_TYPES: { value: InterviewType; label: string }[] = [
  { value: "phone_screen", label: "Phone Screen" },
  { value: "coding", label: "Coding" },
  { value: "technical", label: "Technical" },
  { value: "system_design", label: "System Design" },
  { value: "behavioral", label: "Behavioral" },
  { value: "onsite", label: "Onsite" },
  { value: "final", label: "Final" },
  { value: "take_home", label: "Take Home" },
  { value: "other", label: "Other" },
];

const INTERVIEW_STATUSES: { value: InterviewStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];

interface InterviewFormProps {
  applicationId: string;
  interview?: Interview;
  onSave: () => void;
  onCancel: () => void;
}

export default function InterviewForm({ applicationId, interview, onSave, onCancel }: InterviewFormProps) {
  const isEdit = Boolean(interview);
  const [type, setType] = useState<InterviewType>(interview?.type ?? "phone_screen");
  const [status, setStatus] = useState<InterviewStatus>(interview?.status ?? "scheduled");
  const [scheduledAt, setScheduledAt] = useState(interview?.scheduledAt ? toDatetimeLocal(interview.scheduledAt) : "");
  const [questionTitle, setQuestionTitle] = useState(interview?.questionTitle ?? "");
  const [feedback, setFeedback] = useState(interview?.feedback ?? "");
  const [questionDetail, setQuestionDetail] = useState(interview?.questionDetail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const data = {
      type,
      status,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      questionTitle: questionTitle.trim() || undefined,
      feedback: feedback.trim() || undefined,
      questionDetail: questionDetail.trim() || undefined,
    };

    try {
      if (isEdit) {
        await updateInterview(applicationId, interview!.id, data);
      } else {
        await createInterview(applicationId, data as { type: InterviewType; status?: InterviewStatus; scheduledAt?: string; question?: string; feedback?: string; notes?: string });
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save interview");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-brand-canvas border border-brand-hairline rounded-lg p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-ink">
          {isEdit ? "Edit Interview" : "Add Interview"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-full text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-brand-error bg-brand-error-soft px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-medium text-brand-body mb-1.5 block">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as InterviewType)}
            className="w-full px-3 h-10 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link appearance-none"
          >
            {INTERVIEW_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-brand-body mb-1.5 block">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InterviewStatus)}
            className="w-full px-3 h-10 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link appearance-none"
          >
            {INTERVIEW_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-brand-body mb-1.5 block">Scheduled At</span>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full px-3 h-10 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-brand-body mb-1.5 block">Question Title</span>
        <textarea
          value={questionTitle}
          onChange={(e) => setQuestionTitle(e.target.value)}
          placeholder="What was asked?"
          rows={2}
          className="w-full px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute resize-y"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-brand-body mb-1.5 block">Feedback</span>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What feedback did you receive?"
          rows={3}
          className="w-full px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute resize-y"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-brand-body mb-1.5 block">Question Detail</span>
        <textarea
          value={questionDetail}
          onChange={(e) => setQuestionDetail(e.target.value)}
          placeholder="Detailed question description"
          rows={4}
          className="w-full px-3 py-2 text-sm text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute resize-y"
        />
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-medium text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-full transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 text-xs font-medium text-brand-on-primary bg-brand-ink hover:opacity-90 rounded-full transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving..." : isEdit ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
