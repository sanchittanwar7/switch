import { useEffect, useState } from "react";
import { X, Loader2, AlertCircle, Users, Building2 } from "lucide-react";
import { useBoardStore } from "../../stores/boardStore";
import type {
  BoardListing,
  BoardListingKind,
  BoardListingInput,
  BoardCreateResponse,
} from "../../types";

const LINKEDIN_URL_RE = /^https:\/\/www\.linkedin\.com\/in\/[A-Za-z0-9\-_]+\/?$/;

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface FormState {
  kind: BoardListingKind;
  linkedinUrl: string;
  name: string;
  company: string;
  locations: string;
  resumeUrl: string;
  xUrl: string;
  githubUrl: string;
  yearsExperience: string;
  skills: string;
  jdUrl: string;
  role: string;
  salaryMin: string;
  salaryMax: string;
  yearsExperienceMin: string;
  yearsExperienceMax: string;
}

const EMPTY_FORM: FormState = {
  kind: "candidate",
  linkedinUrl: "",
  name: "",
  company: "",
  locations: "",
  resumeUrl: "",
  xUrl: "",
  githubUrl: "",
  yearsExperience: "",
  skills: "",
  jdUrl: "",
  role: "",
  salaryMin: "",
  salaryMax: "",
  yearsExperienceMin: "",
  yearsExperienceMax: "",
};

interface ListingFormModalProps {
  open: boolean;
  listing?: BoardListing | null;
  onClose: () => void;
  onCreated: (res: BoardCreateResponse) => void;
  onUpdated?: () => void;
}

export default function ListingFormModal({
  open,
  listing,
  onClose,
  onCreated,
  onUpdated,
}: ListingFormModalProps) {
  const createListing = useBoardStore((s) => s.createListing);
  const updateListing = useBoardStore((s) => s.updateListing);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!listing;

  useEffect(() => {
    if (!open) return;
    if (listing) {
      setForm({
        kind: listing.kind,
        linkedinUrl: listing.linkedinUrl ?? "",
        name: listing.name ?? "",
        company: listing.company ?? "",
        locations: listing.locations.join(", "),
        resumeUrl: listing.resumeUrl ?? "",
        xUrl: listing.xUrl ?? "",
        githubUrl: listing.githubUrl ?? "",
        yearsExperience: listing.yearsExperience?.toString() ?? "",
        skills: listing.skills.join(", "),
        jdUrl: listing.jdUrl ?? "",
        role: listing.role ?? "",
        salaryMin: listing.salaryMin?.toString() ?? "",
        salaryMax: listing.salaryMax?.toString() ?? "",
        yearsExperienceMin: listing.yearsExperienceMin?.toString() ?? "",
        yearsExperienceMax: listing.yearsExperienceMax?.toString() ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
    setSubmitting(false);
  }, [open, listing]);

  if (!open) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm(EMPTY_FORM);
    setError(null);
    setSubmitting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function validate(): string | null {
    if (form.kind === "candidate") {
      const linkedin = form.linkedinUrl.trim();
      if (!linkedin) return "LinkedIn URL is required.";
      if (!LINKEDIN_URL_RE.test(linkedin)) {
        return "Enter a valid LinkedIn profile URL: https://www.linkedin.com/in/username";
      }
    } else {
      const jdUrl = form.jdUrl.trim();
      if (!jdUrl) return "Job description URL is required.";
      if (!isValidHttpUrl(jdUrl)) return "Enter a valid job description URL (http/https).";
    }

    for (const [value, label] of [
      [form.resumeUrl, "Resume URL"],
      [form.xUrl, "X URL"],
      [form.githubUrl, "GitHub URL"],
    ] as const) {
      const v = value.trim();
      if (v && !isValidHttpUrl(v)) return `${label} must be a valid http(s) URL.`;
    }

    const skills = splitList(form.skills);
    if (skills.length > 5) return "Maximum 5 skills allowed.";

    const salaryMin = form.salaryMin === "" ? null : Number(form.salaryMin);
    const salaryMax = form.salaryMax === "" ? null : Number(form.salaryMax);
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      return "Minimum salary must be less than or equal to maximum salary.";
    }

    const expMin = form.yearsExperienceMin === "" ? null : Number(form.yearsExperienceMin);
    const expMax = form.yearsExperienceMax === "" ? null : Number(form.yearsExperienceMax);
    if (expMin !== null && expMax !== null && expMin > expMax) {
      return "Minimum experience must be less than or equal to maximum experience.";
    }

    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const input: BoardListingInput = {
        kind: form.kind,
        company: form.company.trim() || undefined,
        locations: splitList(form.locations),
        skills: splitList(form.skills),
      };

      if (form.kind === "candidate") {
        input.linkedinUrl = form.linkedinUrl.trim();
        input.name = form.name.trim() || undefined;
        input.role = form.role.trim() || undefined;
        input.resumeUrl = form.resumeUrl.trim() || undefined;
        input.xUrl = form.xUrl.trim() || undefined;
        input.githubUrl = form.githubUrl.trim() || undefined;
        input.yearsExperience =
          form.yearsExperience === "" ? undefined : Number(form.yearsExperience);
      } else {
        input.jdUrl = form.jdUrl.trim();
        input.role = form.role.trim() || undefined;
        input.salaryMin = form.salaryMin === "" ? undefined : Number(form.salaryMin);
        input.salaryMax = form.salaryMax === "" ? undefined : Number(form.salaryMax);
        input.yearsExperienceMin =
          form.yearsExperienceMin === "" ? undefined : Number(form.yearsExperienceMin);
        input.yearsExperienceMax =
          form.yearsExperienceMax === "" ? undefined : Number(form.yearsExperienceMax);
      }

      if (isEditing && listing) {
        await updateListing(listing.id, input);
        reset();
        onUpdated?.();
      } else {
        const res = await createListing(input);
        reset();
        onCreated(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing");
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link";
  const labelClass =
    "text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-xl bg-brand-canvas border border-brand-hairline p-8">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded text-brand-mute hover:text-brand-ink transition-colors"
        >
          <X size={16} />
        </button>

        <h3 className="text-[18px] font-semibold leading-[24px] tracking-[-0.36px] text-brand-ink mb-6">
          {isEditing ? "Edit listing." : "List yourself."}
        </h3>

        <div className="flex items-center gap-1 mb-6">
          <button
            onClick={() => set("kind", "candidate")}
            disabled={isEditing}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              form.kind === "candidate"
                ? "bg-brand-ink text-brand-canvas"
                : "text-brand-body hover:text-brand-ink hover:bg-brand-canvas-soft"
            } ${isEditing ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <Users size={15} />
            I'm a candidate
          </button>
          <button
            onClick={() => set("kind", "recruiter")}
            disabled={isEditing}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              form.kind === "recruiter"
                ? "bg-brand-ink text-brand-canvas"
                : "text-brand-body hover:text-brand-ink hover:bg-brand-canvas-soft"
            } ${isEditing ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <Building2 size={15} />
            I'm hiring
          </button>
        </div>

        <div className="space-y-4">
          {form.kind === "candidate" ? (
            <>
              <label className="block">
                <span className={labelClass}>Name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Jane Doe"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Role</span>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="Software Engineer"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Company</span>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="Acme Corp"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Company</span>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="Acme Corp"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Locations</span>
                <input
                  type="text"
                  value={form.locations}
                  onChange={(e) => set("locations", e.target.value)}
                  placeholder="San Francisco, Remote"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Resume URL</span>
                <input
                  type="text"
                  value={form.resumeUrl}
                  onChange={(e) => set("resumeUrl", e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>X URL</span>
                <input
                  type="text"
                  value={form.xUrl}
                  onChange={(e) => set("xUrl", e.target.value)}
                  placeholder="https://x.com/..."
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>GitHub URL</span>
                <input
                  type="text"
                  value={form.githubUrl}
                  onChange={(e) => set("githubUrl", e.target.value)}
                  placeholder="https://github.com/..."
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Years of experience</span>
                <input
                  type="number"
                  min={0}
                  value={form.yearsExperience}
                  onChange={(e) => set("yearsExperience", e.target.value)}
                  placeholder="5"
                  className={inputClass}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className={labelClass}>Job description URL *</span>
                <input
                  type="text"
                  value={form.jdUrl}
                  onChange={(e) => set("jdUrl", e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Company</span>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="Acme Corp"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Role</span>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="Software Engineer"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Locations</span>
                <input
                  type="text"
                  value={form.locations}
                  onChange={(e) => set("locations", e.target.value)}
                  placeholder="Bengaluru, Remote"
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>Salary min (₹)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.salaryMin}
                    onChange={(e) => set("salaryMin", e.target.value)}
                    placeholder="2000000"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Salary max (₹)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.salaryMax}
                    onChange={(e) => set("salaryMax", e.target.value)}
                    placeholder="3000000"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>Exp. min (yrs)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.yearsExperienceMin}
                    onChange={(e) => set("yearsExperienceMin", e.target.value)}
                    placeholder="3"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Exp. max (yrs)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.yearsExperienceMax}
                    onChange={(e) => set("yearsExperienceMax", e.target.value)}
                    placeholder="8"
                    className={inputClass}
                  />
                </label>
              </div>
            </>
          )}

          <label className="block">
            <span className={labelClass}>Skills (max 5)</span>
            <input
              type="text"
              value={form.skills}
              onChange={(e) => set("skills", e.target.value)}
              placeholder="React, TypeScript, Node.js"
              className={inputClass}
            />
          </label>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[13px] text-brand-error">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {isEditing ? "Save changes" : "Continue to payment"}
            </button>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="text-[14px] leading-[20px] text-brand-body hover:text-brand-ink disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
