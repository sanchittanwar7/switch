import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useResearchStore } from "../../stores/researchStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InstructionsModal({ open, onClose }: Props) {
  const { instructions, saveInstructions } = useResearchStore();
  const [text, setText] = useState(instructions || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(instructions || "");
  }, [instructions, open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveInstructions(text.trim() || null);
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await saveInstructions(null);
      setText("");
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[10vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-brand-canvas-soft border border-brand-hairline rounded-xl p-6 w-[520px] max-h-[80vh] flex flex-col"
        style={{
          boxShadow:
            "0px 1px 1px rgba(0,0,0,0.2), 0px 8px 16px -4px rgba(0,0,0,0.3), 0px 24px 32px -8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-brand-ink">
            Research Instructions
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-brand-mute mb-4">
          These instructions are prepended to every research conversation. Customize how the agent researches companies.
        </p>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
          }}
          placeholder="e.g. Always check Glassdoor for employee reviews. Focus on EU market presence. Use official sources only."
          rows={8}
          className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link resize-none"
        />

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-brand-hairline">
          <button
            onClick={handleClear}
            disabled={!instructions || saving}
            className="text-xs text-brand-mute hover:text-brand-error transition-colors disabled:opacity-30"
          >
            Clear instructions
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-full px-4 h-9 text-sm font-medium text-brand-mute hover:text-brand-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink text-brand-canvas px-4 h-9 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
