import { useState } from "react";
import { Plus } from "lucide-react";
import { useKanbanStore } from "../../stores/kanbanStore";

interface AddCardButtonProps {
  columnId: string;
}

export default function AddCardButton({ columnId }: AddCardButtonProps) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createCard = useKanbanStore((s) => s.createCard);

  const handleSubmit = async () => {
    if (!company.trim() || !role.trim()) return;
    setSubmitting(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await createCard({
      company: company.trim(),
      role: role.trim(),
      jobUrl: jobUrl.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      columnId,
    });
    setCompany("");
    setRole("");
    setJobUrl("");
    setTagsInput("");
    setOpen(false);
    setSubmitting(false);
  };

  const handleCancel = () => {
    setCompany("");
    setRole("");
    setJobUrl("");
    setTagsInput("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-1 px-3 py-2 text-xs text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-md transition-colors flex items-center gap-1.5 justify-center"
      >
        <Plus size={14} />
        Add card
      </button>
    );
  }

  return (
    <div className="p-2 mt-1 bg-brand-canvas-soft-2 rounded-md border border-brand-hairline">
      <input
        type="text"
        placeholder="Company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="w-full mb-2 px-2 py-1.5 text-xs text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
        autoFocus
      />
      <input
        type="text"
        placeholder="Role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && company.trim() && role.trim()) {
            handleSubmit();
          }
          if (e.key === "Escape") {
            handleCancel();
          }
        }}
        className="w-full mb-2 px-2 py-1.5 text-xs text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
      />
      <input
        type="url"
        placeholder="Job URL (optional)"
        value={jobUrl}
        onChange={(e) => setJobUrl(e.target.value)}
        className="w-full mb-2 px-2 py-1.5 text-xs text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
      />
      <input
        type="text"
        placeholder="Tags: remote, frontend (optional)"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        className="w-full mb-2 px-2 py-1.5 text-xs text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link placeholder:text-brand-mute"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!company.trim() || !role.trim() || submitting}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-brand-on-primary bg-brand-ink hover:opacity-90 rounded-full transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-xs font-medium text-brand-mute hover:text-brand-ink rounded-full transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
