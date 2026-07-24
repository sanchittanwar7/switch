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
  const [submitting, setSubmitting] = useState(false);
  const createCard = useKanbanStore((s) => s.createCard);

  const handleSubmit = async () => {
    if (!company.trim() || !role.trim()) return;
    setSubmitting(true);
    await createCard({
      company: company.trim(),
      role: role.trim(),
      columnId,
    });
    setCompany("");
    setRole("");
    setOpen(false);
    setSubmitting(false);
  };

  const handleCancel = () => {
    setCompany("");
    setRole("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-1 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-md transition-colors flex items-center gap-1.5 justify-center"
      >
        <Plus size={14} />
        Add card
      </button>
    );
  }

  return (
    <div className="p-2 mt-1 bg-white/5 rounded-md border border-white/5">
      <input
        type="text"
        placeholder="Company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="w-full mb-2 px-2 py-1.5 text-xs text-gray-200 bg-white/10 border border-white/5 rounded focus:outline-none focus:border-white/20 placeholder:text-gray-500"
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
        className="w-full mb-2 px-2 py-1.5 text-xs text-gray-200 bg-white/10 border border-white/5 rounded focus:outline-none focus:border-white/20 placeholder:text-gray-500"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!company.trim() || !role.trim() || submitting}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-white/20 hover:bg-white/30 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
