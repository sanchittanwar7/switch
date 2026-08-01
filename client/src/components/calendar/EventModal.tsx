import { useState, useEffect } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { apiGet } from "../../lib/api";
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from "../../types";

interface ResumeEntry {
  name: string;
  mtime: string;
}

interface EventModalProps {
  event?: CalendarEvent | null;
  initialStart?: string;
  initialEnd?: string;
  onClose: () => void;
  onSave: (input: CreateEventInput | UpdateEventInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(dt: string): string {
  return new Date(dt).toISOString();
}

export default function EventModal({
  event,
  initialStart,
  initialEnd,
  onClose,
  onSave,
  onDelete,
}: EventModalProps) {
  const isEdit = !!event;
  const [name, setName] = useState(event?.name ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startTime, setStartTime] = useState(
    event ? toDatetimeLocal(event.startTime) : initialStart ? toDatetimeLocal(initialStart) : "",
  );
  const [endTime, setEndTime] = useState(
    event ? toDatetimeLocal(event.endTime) : initialEnd ? toDatetimeLocal(initialEnd) : "",
  );
  const [company, setCompany] = useState(event?.company ?? "");
  const [role, setRole] = useState(event?.role ?? "");
  const [roundName, setRoundName] = useState(event?.roundName ?? "");
  const [resumePath, setResumePath] = useState(event?.resumePath ?? "");
  const [jobUrl, setJobUrl] = useState(event?.jobUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);

  useEffect(() => {
    apiGet<ResumeEntry[]>("/api/fs/resumes")
      .then(setResumes)
      .catch(() => setResumes([]));
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const validate = (): string | null => {
    if (!name.trim()) return "Event name is required.";
    if (!startTime) return "Start time is required.";
    if (!endTime) return "End time is required.";
    if (new Date(startTime) >= new Date(endTime)) return "Start time must be before end time.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: CreateEventInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        startTime: fromDatetimeLocal(startTime),
        endTime: fromDatetimeLocal(endTime),
        company: company.trim() || undefined,
        role: role.trim() || undefined,
        roundName: roundName.trim() || undefined,
        resumePath: resumePath.trim() || undefined,
        jobUrl: jobUrl.trim() || undefined,
      };
      await onSave(input);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(event.id);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleBackdropClick}>
      <div
        className="bg-brand-canvas-soft border border-brand-hairline rounded-xl p-8 w-[520px] max-h-[90vh] overflow-y-auto"
        style={{
          boxShadow:
            "0px 1px 1px rgba(0,0,0,0.2), 0px 8px 16px -4px rgba(0,0,0,0.3), 0px 24px 32px -8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-brand-ink">
            {isEdit ? "Edit Event" : "New Event"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-brand-error-soft border border-brand-error/20 px-3 py-2 text-xs text-brand-error">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-brand-body mb-1.5">Name *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="Interview at Acme Corp"
              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-brand-body mb-1.5">Start *</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); setError(null); }}
                className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-body mb-1.5">End *</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); setError(null); }}
                className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-body mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-brand-body mb-1.5">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-body mb-1.5">Role</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Software Engineer"
                className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-body mb-1.5">Round</label>
            <input
              type="text"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              placeholder="Phone Screen"
              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-body mb-1.5">Resume</label>
            <select
              value={resumePath}
              onChange={(e) => setResumePath(e.target.value)}
              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
            >
              <option value="">None</option>
              {resumes.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-body mb-1.5">Job URL</label>
            <input
              type="text"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <div>
            {isEdit && onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting || saving}
                className="inline-flex items-center gap-1.5 rounded-full px-4 h-9 text-sm font-medium text-brand-error hover:bg-brand-error-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center rounded-full px-4 h-9 text-sm font-medium text-brand-mute hover:text-brand-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink text-brand-canvas px-5 h-10 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
