import { Search, X } from "lucide-react";
import type { BoardListingKind, BoardFilters } from "../../types";

interface FilterBarProps {
  kind: BoardListingKind;
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
}

export default function FilterBar({ kind, filters, onChange }: FilterBarProps) {
  const skills = filters.skills?.join(", ") ?? "";
  const hasFilters =
    skills !== "" ||
    Boolean(filters.location) ||
    (kind === "candidate" && filters.yearsExperience !== undefined) ||
    Boolean(filters.role);

  function setSkills(value: string) {
    const arr = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...filters, skills: arr.length > 0 ? arr : undefined });
  }

  function clearFilters() {
    onChange({});
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {kind === "candidate" && (
        <div className="flex items-center">
          <input
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Skills (comma-separated)"
            className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link w-56 placeholder:text-brand-mute"
          />
        </div>
      )}

      {kind === "recruiter" && (
        <div className="flex items-center">
          <input
            type="text"
            value={filters.role ?? ""}
            onChange={(e) => onChange({ ...filters, role: e.target.value || undefined })}
            placeholder="Role"
            className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link w-48 placeholder:text-brand-mute"
          />
        </div>
      )}

      {kind === "recruiter" && (
        <div className="flex items-center">
          <input
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Skills (comma-separated)"
            className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link w-56 placeholder:text-brand-mute"
          />
        </div>
      )}

      <div className="flex items-center">
        <input
          type="text"
          value={filters.location ?? ""}
          onChange={(e) => onChange({ ...filters, location: e.target.value || undefined })}
          placeholder="Location"
          className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link w-40 placeholder:text-brand-mute"
        />
      </div>

      {kind === "candidate" && (
        <div className="flex items-center">
          <input
            type="number"
            min={0}
            value={filters.yearsExperience ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                yearsExperience:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            placeholder="Min years exp"
            className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link w-36 placeholder:text-brand-mute"
          />
        </div>
      )}

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 h-10 px-3 text-sm text-brand-link hover:text-brand-ink transition-colors"
        >
          <X size={14} />
          Clear
        </button>
      )}
    </div>
  );
}
