import { useState, useEffect } from "react";
import { MapPin, Sparkles, Pencil, Trash2, Loader2, AlertCircle, Briefcase, FolderGit2, Github, ExternalLink, GripVertical } from "lucide-react";
import { useProfileStore, type Skill, type WorkExperience, type Project } from "../stores/profileStore";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const EXPERTISE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
] as const;

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function ProfileView() {
  const {
    location,
    experiences,
    projects,
    skills,
    loading,
    error,
    formLoading,
    loadProfile,
    updateLocation,
    addExperience,
    updateExperience,
    deleteExperience,
    reorderExperience,
    addProject,
    updateProject,
    deleteProject,
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

  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [expFormVisible, setExpFormVisible] = useState(false);
  const [expForm, setExpForm] = useState({ company: "", role: "", teamName: "", description: "", startDate: "", endDate: "", isPresent: false, skills: "" });
  const [expError, setExpError] = useState<string | null>(null);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectFormVisible, setProjectFormVisible] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: "", description: "", github: "", url: "" });
  const [projectError, setProjectError] = useState<string | null>(null);

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

  function openAddExp() {
    setExpForm({ company: "", role: "", teamName: "", description: "", startDate: "", endDate: "", isPresent: false, skills: "" });
    setEditingExpId(null);
    setExpFormVisible(true);
    setExpError(null);
  }

  function openEditExp(exp: WorkExperience) {
    setExpForm({
      company: exp.company,
      role: exp.role,
      teamName: exp.teamName || "",
      description: exp.description || "",
      startDate: exp.startDate,
      endDate: exp.endDate || "",
      isPresent: exp.endDate === null,
      skills: exp.skills.join(", "),
    });
    setEditingExpId(exp.id);
    setExpFormVisible(true);
    setExpError(null);
  }

  function cancelExpForm() {
    setExpFormVisible(false);
    setEditingExpId(null);
    setExpForm({ company: "", role: "", teamName: "", description: "", startDate: "", endDate: "", isPresent: false, skills: "" });
    setExpError(null);
  }

  async function handleExpSave() {
    if (!expForm.company.trim() || !expForm.role.trim() || !expForm.startDate) {
      setExpError("Company, role, and start date are required");
      return;
    }
    if (!expForm.isPresent && !expForm.endDate) {
      setExpError("End date is required unless you currently work here");
      return;
    }

    setExpError(null);
    const skillsArray = expForm.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const data = {
      company: expForm.company.trim(),
      role: expForm.role.trim(),
      teamName: expForm.teamName.trim() || null,
      description: expForm.description.trim() || null,
      startDate: expForm.startDate,
      endDate: expForm.isPresent ? null : expForm.endDate,
      skills: skillsArray,
    };

    try {
      if (editingExpId) {
        await updateExperience(editingExpId, data);
      } else {
        await addExperience(data);
      }
      setExpFormVisible(false);
      setEditingExpId(null);
      setExpForm({ company: "", role: "", teamName: "", description: "", startDate: "", endDate: "", isPresent: false, skills: "" });
    } catch (err) {
      setExpError(err instanceof Error ? err.message : "Failed to save experience");
    }
  }

  function openAddProject() {
    setProjectForm({ title: "", description: "", github: "", url: "" });
    setEditingProjectId(null);
    setProjectFormVisible(true);
    setProjectError(null);
  }

  function openEditProject(project: Project) {
    setProjectForm({
      title: project.title,
      description: project.description || "",
      github: project.github || "",
      url: project.url || "",
    });
    setEditingProjectId(project.id);
    setProjectFormVisible(true);
    setProjectError(null);
  }

  function cancelProjectForm() {
    setProjectFormVisible(false);
    setEditingProjectId(null);
    setProjectForm({ title: "", description: "", github: "", url: "" });
    setProjectError(null);
  }

  async function handleProjectSave() {
    if (!projectForm.title.trim()) {
      setProjectError("Title is required");
      return;
    }

    setProjectError(null);
    const data = {
      title: projectForm.title.trim(),
      description: projectForm.description.trim() || undefined,
      github: projectForm.github.trim() || undefined,
      url: projectForm.url.trim() || undefined,
    };

    try {
      if (editingProjectId) {
        await updateProject(editingProjectId, data as any);
      } else {
        await addProject(data as any);
      }
      setProjectFormVisible(false);
      setEditingProjectId(null);
      setProjectForm({ title: "", description: "", github: "", url: "" });
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : "Failed to save project");
    }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const reordered = Array.from(experiences);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    const orderedIds = reordered.map((e) => e.id);
    reorderExperience(orderedIds);
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-canvas border border-brand-hairline px-3 py-1.5 text-[12px] font-medium text-brand-body hover:text-brand-ink hover:border-brand-hairline-strong transition-colors shrink-0"
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
                (() => {
                  const expertiseGroups = [
                    { key: "expert" as const, label: "Expert" },
                    { key: "intermediate" as const, label: "Intermediate" },
                    { key: "beginner" as const, label: "Beginner" },
                  ];

                  const grouped = skills.reduce(
                    (acc, skill) => {
                      (acc[skill.expertise] ??= []).push(skill);
                      return acc;
                    },
                    {} as Record<string, Skill[]>
                  );

                  return (
                    <div className="space-y-6">
                      {expertiseGroups.map(({ key, label }) => {
                        const list = (grouped[key] ?? []).sort((a, b) =>
                          a.name.localeCompare(b.name)
                        );
                        if (list.length === 0) return null;
                        return (
                          <div key={key}>
                            <h4 className="text-[11px] font-medium text-brand-mute uppercase tracking-wider mb-2">
                              {label}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {list.map((skill) => (
                                <div
                                  key={skill.id}
                                  className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-canvas-soft-2 border border-brand-hairline text-[14px] text-brand-ink"
                                >
                                  <span>{skill.name}</span>
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
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[13px] font-medium text-brand-mute">
                Work Experience{experiences.length > 0 && ` (${experiences.length})`}
              </h3>
              {!expFormVisible && (
                <button
                  onClick={openAddExp}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-canvas border border-brand-hairline px-3 py-1.5 text-[12px] font-medium text-brand-body hover:text-brand-ink hover:border-brand-hairline-strong transition-colors"
                >
                  <Pencil size={12} />
                  Add Experience
                </button>
              )}
            </div>

            <div className="rounded-xl bg-brand-canvas border border-brand-hairline p-6">
              {expFormVisible && (
                <div className="mb-5 pb-5 border-b border-brand-hairline">
                  {expError && (
                    <div className="mb-4 flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[13px] text-brand-error">
                      <AlertCircle size={14} />
                      {expError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Company
                      </span>
                      <input
                        type="text"
                        value={expForm.company}
                        onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))}
                        placeholder="Acme Corp"
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Role
                      </span>
                      <input
                        type="text"
                        value={expForm.role}
                        onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))}
                        placeholder="Software Engineer"
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Team
                      </span>
                      <input
                        type="text"
                        value={expForm.teamName}
                        onChange={(e) => setExpForm((f) => ({ ...f, teamName: e.target.value }))}
                        placeholder="Platform"
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Start Date
                      </span>
                      <input
                        type="date"
                        value={expForm.startDate}
                        onChange={(e) => setExpForm((f) => ({ ...f, startDate: e.target.value }))}
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      />
                    </label>

                    <label className="flex items-center gap-2 text-[14px] leading-[20px] text-brand-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={expForm.isPresent}
                        onChange={(e) => setExpForm((f) => ({ ...f, isPresent: e.target.checked }))}
                        className="rounded border-brand-hairline bg-brand-canvas text-brand-link focus:ring-brand-link/20"
                      />
                      I currently work here
                    </label>

                    {!expForm.isPresent && (
                      <label className="block">
                        <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                          End Date
                        </span>
                        <input
                          type="date"
                          value={expForm.endDate}
                          onChange={(e) => setExpForm((f) => ({ ...f, endDate: e.target.value }))}
                          className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                        />
                      </label>
                    )}

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Description
                      </span>
                      <textarea
                        value={expForm.description}
                        onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Led migration from monolith to microservices..."
                        rows={4}
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 py-2 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link resize-vertical"
                      />
                      <p className="text-[11px] text-brand-mute mt-1">Markdown supported</p>
                    </label>

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Skills
                      </span>
                      <input
                        type="text"
                        value={expForm.skills}
                        onChange={(e) => setExpForm((f) => ({ ...f, skills: e.target.value }))}
                        placeholder="React, TypeScript, Node.js"
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      />
                    </label>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={handleExpSave}
                        disabled={formLoading}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        {formLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        {editingExpId ? "Update" : "Add"}
                      </button>
                      <button
                        onClick={cancelExpForm}
                        disabled={formLoading}
                        className="text-[14px] leading-[20px] text-brand-body hover:text-brand-ink disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {experiences.length === 0 && !expFormVisible ? (
                <div className="flex flex-col items-center py-8">
                  <Briefcase size={32} className="text-brand-mute mb-3" />
                  <p className="text-[14px] text-brand-body mb-1">No work experience yet.</p>
                  <p className="text-[13px] text-brand-mute mb-4">
                    Add your professional experience.
                  </p>
                  <button
                    onClick={openAddExp}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-5 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity"
                  >
                    Add Experience
                  </button>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="experiences">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                        {experiences.map((exp, index) => (
                          <Draggable key={exp.id} draggableId={exp.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`group border border-brand-hairline rounded-lg p-4 bg-brand-canvas-soft relative ${snapshot.isDragging ? "opacity-60 shadow-lg" : ""}`}
                              >
                                <div {...provided.dragHandleProps} className="absolute top-3 left-3 hidden group-hover:flex text-brand-mute cursor-grab active:cursor-grabbing">
                                  <GripVertical size={14} />
                                </div>
                                <div className={editingExpId !== exp.id ? "pl-6" : ""}>
                                  {editingExpId === exp.id && expFormVisible ? (
                                    <div className="space-y-4">
                                      {expError && (
                                        <div className="flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[13px] text-brand-error">
                                          <AlertCircle size={14} />
                                          {expError}
                                        </div>
                                      )}
                                      <label className="block">
                                        <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                                          Company
                                        </span>
                                        <input
                                          type="text"
                                          value={expForm.company}
                                          onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))}
                                          className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                                          Role
                                        </span>
                                        <input
                                          type="text"
                                          value={expForm.role}
                                          onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))}
                                          className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                                          Team
                                        </span>
                                        <input
                                          type="text"
                                          value={expForm.teamName}
                                          onChange={(e) => setExpForm((f) => ({ ...f, teamName: e.target.value }))}
                                          placeholder="Platform"
                                          className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                                          Start Date
                                        </span>
                                        <input
                                          type="date"
                                          value={expForm.startDate}
                                          onChange={(e) => setExpForm((f) => ({ ...f, startDate: e.target.value }))}
                                          className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                                        />
                                      </label>
                                      <label className="flex items-center gap-2 text-[14px] leading-[20px] text-brand-ink cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={expForm.isPresent}
                                          onChange={(e) => setExpForm((f) => ({ ...f, isPresent: e.target.checked }))}
                                          className="rounded border-brand-hairline bg-brand-canvas text-brand-link focus:ring-brand-link/20"
                                        />
                                        I currently work here
                                      </label>
                                      {!expForm.isPresent && (
                                        <label className="block">
                                          <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                                            End Date
                                          </span>
                                          <input
                                            type="date"
                                            value={expForm.endDate}
                                            onChange={(e) => setExpForm((f) => ({ ...f, endDate: e.target.value }))}
                                            className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                                          />
                                        </label>
                                      )}
                                      <label className="block">
                                        <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                                          Description
                                        </span>
                                        <textarea
                                          value={expForm.description}
                                          onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))}
                                          placeholder="Led migration from monolith to microservices..."
                                          rows={4}
                                          className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 py-2 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link resize-vertical"
                                        />
                                        <p className="text-[11px] text-brand-mute mt-1">Markdown supported</p>
                                      </label>
                                      <label className="block">
                                        <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                                          Skills
                                        </span>
                                        <input
                                          type="text"
                                          value={expForm.skills}
                                          onChange={(e) => setExpForm((f) => ({ ...f, skills: e.target.value }))}
                                          placeholder="React, TypeScript, Node.js"
                                          className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                                        />
                                      </label>
                                      <div className="flex items-center gap-3 pt-1">
                                        <button
                                          onClick={handleExpSave}
                                          disabled={formLoading}
                                          className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                                        >
                                          {formLoading ? (
                                            <Loader2 size={14} className="animate-spin" />
                                          ) : null}
                                          Update
                                        </button>
                                        <button
                                          onClick={cancelExpForm}
                                          disabled={formLoading}
                                          className="text-[14px] leading-[20px] text-brand-body hover:text-brand-ink disabled:opacity-50 transition-colors"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <h4 className="text-[14px] font-medium text-brand-ink">{exp.company}</h4>
                                      <p className="text-[14px] text-brand-body">
                                        {exp.role}{exp.teamName ? ` | ${exp.teamName}` : ""}
                                      </p>
                                      <p className="text-[12px] text-brand-mute mt-1">
                                        {formatDate(exp.startDate)} — {exp.endDate ? formatDate(exp.endDate) : "Present"}
                                      </p>
                                      {exp.skills && exp.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                          {exp.skills.map((skill, i) => (
                                            <span
                                              key={i}
                                              className="text-[11px] bg-brand-canvas-soft-2 text-brand-body px-2 py-0.5 rounded-full border border-brand-hairline"
                                            >
                                              {skill}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {exp.description && (
                                        <div className="mt-3 text-[13px] text-brand-body leading-relaxed prose-sm [&_a]:text-brand-link [&_a]:underline [&_code]:bg-brand-canvas-soft-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_pre]:bg-brand-canvas-soft-2 [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:text-[12px] [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-hairline-strong [&_blockquote]:pl-3 [&_blockquote]:text-brand-mute">
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {exp.description}
                                          </ReactMarkdown>
                                        </div>
                                      )}
                                      <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                                        <button
                                          onClick={() => openEditExp(exp)}
                                          className="p-1 rounded text-brand-mute hover:text-brand-ink transition-colors"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                        <button
                                          onClick={() => deleteExperience(exp.id)}
                                          disabled={formLoading}
                                          className="p-1 rounded text-brand-mute hover:text-brand-error transition-colors disabled:opacity-50"
                                        >
                                          {formLoading ? (
                                            <Loader2 size={12} className="animate-spin" />
                                          ) : (
                                            <Trash2 size={12} />
                                          )}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[13px] font-medium text-brand-mute">
                Projects{projects.length > 0 && ` (${projects.length})`}
              </h3>
              {!projectFormVisible && (
                <button
                  onClick={openAddProject}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-canvas border border-brand-hairline px-3 py-1.5 text-[12px] font-medium text-brand-body hover:text-brand-ink hover:border-brand-hairline-strong transition-colors"
                >
                  <Pencil size={12} />
                  Add Project
                </button>
              )}
            </div>

            <div className="rounded-xl bg-brand-canvas border border-brand-hairline p-6">
              {projectFormVisible && (
                <div className="mb-5 pb-5 border-b border-brand-hairline">
                  {projectError && (
                    <div className="mb-4 flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[13px] text-brand-error">
                      <AlertCircle size={14} />
                      {projectError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Title
                      </span>
                      <input
                        type="text"
                        value={projectForm.title}
                        onChange={(e) => setProjectForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="My Project"
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Description
                      </span>
                      <textarea
                        value={projectForm.description}
                        onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="A brief description of the project"
                        rows={3}
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 py-2 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link resize-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        GitHub URL
                      </span>
                      <input
                        type="url"
                        value={projectForm.github}
                        onChange={(e) => setProjectForm((f) => ({ ...f, github: e.target.value }))}
                        placeholder="https://github.com/user/repo"
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                        Live URL
                      </span>
                      <input
                        type="url"
                        value={projectForm.url}
                        onChange={(e) => setProjectForm((f) => ({ ...f, url: e.target.value }))}
                        placeholder="https://example.com"
                        className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      />
                    </label>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={handleProjectSave}
                        disabled={formLoading}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        {formLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        {editingProjectId ? "Update" : "Add"}
                      </button>
                      <button
                        onClick={cancelProjectForm}
                        disabled={formLoading}
                        className="text-[14px] leading-[20px] text-brand-body hover:text-brand-ink disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {projects.length === 0 && !projectFormVisible ? (
                <div className="flex flex-col items-center py-8">
                  <FolderGit2 size={32} className="text-brand-mute mb-3" />
                  <p className="text-[14px] text-brand-body mb-1">No projects yet.</p>
                  <p className="text-[13px] text-brand-mute mb-4">
                    Showcase your work and side projects.
                  </p>
                  <button
                    onClick={openAddProject}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-5 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity"
                  >
                    Add Project
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="group border border-brand-hairline rounded-lg p-4 bg-brand-canvas-soft relative"
                    >
                      {editingProjectId === project.id && projectFormVisible ? (
                        <div className="space-y-4">
                          {projectError && (
                            <div className="flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[13px] text-brand-error">
                              <AlertCircle size={14} />
                              {projectError}
                            </div>
                          )}
                          <label className="block">
                            <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                              Title
                            </span>
                            <input
                              type="text"
                              value={projectForm.title}
                              onChange={(e) => setProjectForm((f) => ({ ...f, title: e.target.value }))}
                              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                              Description
                            </span>
                            <textarea
                              value={projectForm.description}
                              onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
                              rows={3}
                              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 py-2 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link resize-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                              GitHub URL
                            </span>
                            <input
                              type="url"
                              value={projectForm.github}
                              onChange={(e) => setProjectForm((f) => ({ ...f, github: e.target.value }))}
                              placeholder="https://github.com/user/repo"
                              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5 block">
                              Live URL
                            </span>
                            <input
                              type="url"
                              value={projectForm.url}
                              onChange={(e) => setProjectForm((f) => ({ ...f, url: e.target.value }))}
                              placeholder="https://example.com"
                              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                            />
                          </label>
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              onClick={handleProjectSave}
                              disabled={formLoading}
                              className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                              {formLoading ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : null}
                              Update
                            </button>
                            <button
                              onClick={cancelProjectForm}
                              disabled={formLoading}
                              className="text-[14px] leading-[20px] text-brand-body hover:text-brand-ink disabled:opacity-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-[14px] font-medium text-brand-ink">{project.title}</h4>
                          {project.description && (
                            <p className="text-[14px] text-brand-body mt-1 line-clamp-2">{project.description}</p>
                          )}
                          {(project.github || project.url) && (
                            <div className="flex items-center gap-3 mt-2">
                              {project.github && (
                                <a
                                  href={project.github}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[12px] text-brand-link hover:underline"
                                >
                                  <Github size={12} />
                                  GitHub
                                </a>
                              )}
                              {project.url && (
                                <a
                                  href={project.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[12px] text-brand-link hover:underline"
                                >
                                  <ExternalLink size={12} />
                                  Website
                                </a>
                              )}
                            </div>
                          )}
                          <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                            <button
                              onClick={() => openEditProject(project)}
                              className="p-1 rounded text-brand-mute hover:text-brand-ink transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteProject(project.id)}
                              disabled={formLoading}
                              className="p-1 rounded text-brand-mute hover:text-brand-error transition-colors disabled:opacity-50"
                            >
                              {formLoading ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                            </button>
                          </div>
                        </>
                      )}
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
