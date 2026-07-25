import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";

export default function ResumeListView() {
  const [resumes, setResumes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const fetchResumes = async () => {
    try {
      const data = await apiGet<string[]>("/api/fs/resumes");
      setResumes(data);
    } catch {
      setResumes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await apiPost("/api/fs/mkdir", { path: `resumes/${trimmed}` });
    setNewName("");
    setCreating(false);
    await fetchResumes();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-brand-mute">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[640px] mx-auto py-16 px-6">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-[24px] font-semibold leading-[32px] tracking-[-0.96px] text-brand-ink">
            Resumes
          </h2>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-[100px] bg-brand-ink text-brand-on-primary px-4 h-9 text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
              New Resume
            </button>
          )}
        </div>

        {creating && (
          <div className="mb-6 flex items-center gap-3">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setNewName("");
                  setCreating(false);
                }
              }}
              placeholder="resume-name"
              className="flex-1 rounded-[6px] border border-brand-link bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded-[100px] bg-brand-link text-white px-4 h-9 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Create
            </button>
            <button
              onClick={() => {
                setNewName("");
                setCreating(false);
              }}
              className="rounded-[100px] px-4 h-9 text-[14px] leading-[20px] text-brand-mute hover:text-brand-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {resumes.length === 0 && !creating && (
          <div className="text-center py-16">
            <FolderOpen size={32} className="mx-auto mb-3 text-brand-mute" />
            <p className="text-sm text-brand-mute">
              No resumes yet. Create one to get started.
            </p>
          </div>
        )}

        <div className="space-y-1">
          {resumes.map((name) => (
            <button
              key={name}
              onClick={() => navigate(`/resume?project=${name}`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-[8px] hover:bg-brand-canvas-soft-2 transition-colors text-left cursor-pointer"
            >
              <FolderOpen size={18} className="text-brand-mute shrink-0" />
              <span className="text-[14px] leading-[20px] font-medium text-brand-ink truncate">
                {name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
