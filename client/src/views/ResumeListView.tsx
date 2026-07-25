import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Trash2, Pencil, Copy, Check, X } from "lucide-react";
import { apiGet, apiPost, apiDelete } from "../lib/api";

interface ResumeEntry {
  name: string;
  mtime: string;
}

export default function ResumeListView() {
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchResumes = async () => {
    try {
      const data = await apiGet<ResumeEntry[]>("/api/fs/resumes");
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

  const handleDelete = async () => {
    if (!deletingName) return;
    await apiDelete("/api/fs/delete", { path: `resumes/${deletingName}` });
    setDeletingName(null);
    await fetchResumes();
  };

  const handleRename = async (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingName(null);
      return;
    }
    await apiPost("/api/fs/rename", {
      oldPath: `resumes/${oldName}`,
      newPath: `resumes/${trimmed}`,
    });
    setEditingName(null);
    await fetchResumes();
  };

  const handleCopy = async (sourceName: string) => {
    const destName = `${sourceName}'s copy`;
    await apiPost("/api/fs/copy", {
      sourcePath: `resumes/${sourceName}`,
      destPath: `resumes/${destName}`,
    });
    await fetchResumes();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
      <div className="max-w-4xl mx-auto py-16 px-8">
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

        {resumes.length > 0 && (
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-brand-hairline">
                <th className="text-left py-2 px-3 text-[11px] font-medium text-brand-mute uppercase tracking-widest font-mono w-1/2">
                  Name
                </th>
                <th className="text-left py-2 px-3 text-[11px] font-medium text-brand-mute uppercase tracking-widest font-mono w-1/4">
                  Last Modified
                </th>
                <th className="text-right py-2 px-3 text-[11px] font-medium text-brand-mute uppercase tracking-widest font-mono w-1/4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {resumes.map((r) => (
                <tr
                  key={r.name}
                  className="border-b border-brand-hairline hover:bg-brand-canvas-soft-2 transition-colors group"
                >
                  <td className="py-2.5 px-3">
                    {editingName === r.name ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          className="flex-1 bg-brand-canvas-soft-2 text-brand-ink text-[13px] px-2 py-1 rounded-sm border border-brand-link outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(r.name);
                            if (e.key === "Escape") setEditingName(null);
                          }}
                        />
                        <button
                          onClick={() => handleRename(r.name)}
                          className="p-0.5 text-brand-link hover:text-brand-link-deep rounded-sm"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingName(null)}
                          className="p-0.5 text-brand-mute hover:text-brand-ink rounded-sm"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate(`/resume?project=${r.name}`)}
                        className="flex items-center gap-2 text-[14px] leading-[20px] font-medium text-brand-ink truncate hover:text-brand-link transition-colors"
                      >
                        <FolderOpen size={16} className="text-brand-mute shrink-0" />
                        {r.name}
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[13px] text-brand-mute">
                    {formatDate(r.mtime)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingName(r.name);
                          setEditValue(r.name);
                        }}
                        className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft rounded-sm transition-colors"
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(r.name);
                        }}
                        className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft rounded-sm transition-colors"
                        title="Copy"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingName(r.name);
                        }}
                        className="p-1 text-brand-mute hover:text-brand-error hover:bg-brand-error-soft rounded-sm transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deletingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="bg-brand-canvas-soft border border-brand-hairline rounded-xl p-6 w-80"
            style={{
              boxShadow:
                "0px 1px 1px rgba(0,0,0,0.2), 0px 8px 16px -4px rgba(0,0,0,0.3), 0px 24px 32px -8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-sm text-brand-ink font-medium mb-4">
              Delete{" "}
              <span className="text-brand-body font-mono text-xs">
                {deletingName}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-1.5 text-sm font-medium text-brand-body hover:text-brand-ink rounded-full hover:bg-brand-canvas-soft-2 transition-colors"
                onClick={() => setDeletingName(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 text-sm font-medium bg-brand-error text-white rounded-full hover:opacity-90 transition-opacity"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
