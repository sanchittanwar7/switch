import { useState, useEffect } from "react";
import { MapPin, Sparkles, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { useProfileStore, type Skill } from "../stores/profileStore";

const EXPERTISE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
] as const;

export default function ProfileView() {
  const {
    location,
    skills,
    loading,
    error,
    formLoading,
    loadProfile,
    updateLocation,
    addSkill,
    updateSkill,
    deleteSkill,
    clearError,
  } = useProfileStore();

  const [editingLocation, setEditingLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({ city: "", country: "", isRemote: false });
  const [locationError, setLocationError] = useState<string | null>(null);

  const [skillFormVisible, setSkillFormVisible] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillForm, setSkillForm] = useState({ name: "", expertise: "intermediate" as Skill["expertise"] });
  const [skillError, setSkillError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (location) {
      setLocationForm({
        city: location.city || "",
        country: location.country || "",
        isRemote: location.isRemote,
      });
    }
  }, [location]);

  async function handleLocationSave() {
    setLocationError(null);
    try {
      await updateLocation(locationForm);
      setEditingLocation(false);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Failed to save location");
    }
  }

  function handleLocationCancel() {
    if (location) {
      setLocationForm({
        city: location.city || "",
        country: location.country || "",
        isRemote: location.isRemote,
      });
    } else {
      setLocationForm({ city: "", country: "", isRemote: false });
    }
    setEditingLocation(false);
    setLocationError(null);
  }

  function openAddSkill() {
    setSkillForm({ name: "", expertise: "intermediate" });
    setEditingSkillId(null);
    setSkillFormVisible(true);
    setSkillError(null);
  }

  function openEditSkill(skill: Skill) {
    setSkillForm({ name: skill.name, expertise: skill.expertise });
    setEditingSkillId(skill.id);
    setSkillFormVisible(true);
    setSkillError(null);
  }

  function cancelSkillForm() {
    setSkillFormVisible(false);
    setEditingSkillId(null);
    setSkillForm({ name: "", expertise: "intermediate" });
    setSkillError(null);
  }

  async function handleSkillSave() {
    if (!skillForm.name.trim()) {
      setSkillError("Skill name is required");
      return;
    }

    setSkillError(null);
    try {
      if (editingSkillId) {
        await updateSkill(editingSkillId, skillForm);
      } else {
        await addSkill(skillForm);
      }
      setSkillFormVisible(false);
      setEditingSkillId(null);
      setSkillForm({ name: "", expertise: "intermediate" });
    } catch (err) {
      setSkillError(err instanceof Error ? err.message : "Failed to save skill");
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-canvas-soft">
        <Loader2 size={24} className="animate-spin text-brand-mute" />
      </div>
    );
  }

  return (
    <div className="h-full bg-brand-canvas-soft overflow-auto">
      <div className="max-w-[640px] mx-auto py-16 px-6">
        <h2 className="mb-10 text-[24px] font-semibold leading-[32px] tracking-[-0.96px] text-brand-ink">
          Profile.
        </h2>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[14px] leading-[20px] text-brand-error">
            <AlertCircle size={16} />
            {error}
            <button
              onClick={clearError}
              className="ml-auto text-brand-mute hover:text-brand-ink"
            >
              x
            </button>
          </div>
        )}

        <div className="space-y-8">
          <section>
            <h3 className="text-[13px] font-medium text-brand-mute mb-4">Location</h3>

            <div className="rounded-xl bg-brand-canvas border border-brand-hairline p-6">
              {!editingLocation ? (
                location ? (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <MapPin size={18} className="text-brand-body shrink-0" />
                      <div>
                        <p className="text-[14px] text-brand-ink">
                          {location.city}{location.city && location.country ? ", " : ""}{location.country}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[11px] text-brand-mute bg-brand-canvas-soft-2 rounded-full px-2.5 py-0.5 mt-1">
                          {location.isRemote ? "Remote" : "On-site"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingLocation(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-canvas border border-brand-hairline px-3 py-1.5 text-[12px] font-medium text-brand-body hover:text-brand-ink hover:border-brand-hairline-strong transition-colors"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8">
                    <MapPin size={32} className="text-brand-mute mb-3" />
                    <p className="text-[14px] text-brand-body mb-4">No location set yet.</p>
                    <button
                      onClick={() => setEditingLocation(true)}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-5 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity"
                    >
                      Set Location
                    </button>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                      City
                    </span>
                    <input
                      type="text"
                      value={locationForm.city}
                      onChange={(e) => setLocationForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="San Francisco"
                      className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                      Country
                    </span>
                    <input
                      type="text"
                      value={locationForm.country}
                      onChange={(e) => setLocationForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="United States"
                      className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-[14px] leading-[20px] text-brand-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={locationForm.isRemote}
                      onChange={(e) => setLocationForm((f) => ({ ...f, isRemote: e.target.checked }))}
                      className="rounded border-brand-hairline bg-brand-canvas text-brand-link focus:ring-brand-link/20"
                    />
                    Remote
                  </label>

                  {locationError && (
                    <div className="flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[13px] text-brand-error">
                      <AlertCircle size={14} />
                      {locationError}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleLocationSave}
                      disabled={formLoading}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      {formLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                      Save
                    </button>
                    <button
                      onClick={handleLocationCancel}
                      disabled={formLoading}
                      className="text-[14px] leading-[20px] text-brand-body hover:text-brand-ink disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[13px] font-medium text-brand-mute">
                Skills{skills.length > 0 && ` (${skills.length})`}
              </h3>
              {!skillFormVisible && (
                <button
                  onClick={openAddSkill}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-canvas border border-brand-hairline px-3 py-1.5 text-[12px] font-medium text-brand-body hover:text-brand-ink hover:border-brand-hairline-strong transition-colors"
                >
                  <Pencil size={12} />
                  Add Skill
                </button>
              )}
            </div>

            <div className="rounded-xl bg-brand-canvas border border-brand-hairline p-6">
              {skillFormVisible && (
                <div className="mb-5 pb-5 border-b border-brand-hairline">
                  {skillError && (
                    <div className="mb-4 flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[13px] text-brand-error">
                      <AlertCircle size={14} />
                      {skillError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Skill Name
                      </span>
                      <input
                        type="text"
                        value={skillForm.name}
                        onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="React"
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSkillSave();
                        }}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Expertise
                      </span>
                      <select
                        value={skillForm.expertise}
                        onChange={(e) => setSkillForm((f) => ({ ...f, expertise: e.target.value as Skill["expertise"] }))}
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link appearance-none"
                      >
                        {EXPERTISE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={handleSkillSave}
                        disabled={formLoading}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        {formLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        {editingSkillId ? "Update" : "Add"}
                      </button>
                      <button
                        onClick={cancelSkillForm}
                        disabled={formLoading}
                        className="text-[14px] leading-[20px] text-brand-body hover:text-brand-ink disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {skills.length === 0 && !skillFormVisible ? (
                <div className="flex flex-col items-center py-8">
                  <Sparkles size={32} className="text-brand-mute mb-3" />
                  <p className="text-[14px] text-brand-body mb-1">No skills added yet.</p>
                  <p className="text-[13px] text-brand-mute mb-4">
                    Add skills to highlight your expertise.
                  </p>
                  <button
                    onClick={openAddSkill}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-5 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity"
                  >
                    Add Skill
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-canvas-soft-2 border border-brand-hairline text-[14px] text-brand-ink"
                    >
                      <span>{skill.name}</span>
                      <span className="text-[11px] font-medium text-brand-mute bg-brand-canvas px-1.5 py-0.5 rounded">
                        {skill.expertise}
                      </span>
                      <button
                        onClick={() => openEditSkill(skill)}
                        className="hidden group-hover:inline-flex p-0.5 rounded text-brand-mute hover:text-brand-ink transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => deleteSkill(skill.id)}
                        disabled={formLoading}
                        className="hidden group-hover:inline-flex p-0.5 rounded text-brand-mute hover:text-brand-error transition-colors disabled:opacity-50"
                      >
                        {formLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
