import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Trash2, Pencil, Copy, Check, X, HelpCircle, Star } from "lucide-react";
import { apiGet, apiPost, apiDelete } from "../lib/api";
import { useSettingsStore } from "../stores/settingsStore";
import NewResumeModal from "../components/NewResumeModal";

interface ResumeEntry {
  name: string;
  mtime: string;
}

export default function ResumeListView() {
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const { defaultResumeName, loadDefaultResume, setDefaultResume } = useSettingsStore();

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

  useEffect(() => {
    loadDefaultResume();
  }, []);

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-hairline text-brand-body px-4 h-9 text-sm font-medium hover:bg-brand-canvas-soft hover:text-brand-ink transition-colors"
            >
              <HelpCircle size={14} />
              Get Help
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink text-brand-on-primary px-4 h-9 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
              New Resume
            </button>
          </div>
        </div>

        {resumes.length === 0 && (
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
                <th className="text-left py-2 px-3 text-xs font-medium text-brand-mute font-mono w-12">
                  Def.
                </th>
                <th className="text-left py-2 px-3 text-xs font-medium text-brand-mute font-mono">
                  Name
                </th>
                <th className="text-left py-2 px-3 text-xs font-medium text-brand-mute font-mono w-1/4">
                  Last Modified
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-brand-mute font-mono w-1/4">
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefaultResume(defaultResumeName === r.name ? null : r.name);
                      }}
                      className="p-1 rounded-sm transition-colors"
                      title={defaultResumeName === r.name ? "Remove default" : "Set as default"}
                    >
                      <Star
                        size={16}
                        className={defaultResumeName === r.name ? "text-brand-warning fill-brand-warning" : "text-brand-mute"}
                      />
                    </button>
                  </td>
                  <td className="py-2.5 px-3">
                    {editingName === r.name ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          className="flex-1 bg-brand-canvas-soft-2 text-brand-ink text-sm px-2 py-1 rounded-sm border border-brand-link outline-none"
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
                        className="flex items-center gap-2 text-sm font-medium text-brand-ink truncate hover:text-brand-link transition-colors"
                      >
                        <FolderOpen size={16} className="text-brand-mute shrink-0" />
                        {r.name}
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-brand-mute">
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

      <NewResumeModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          fetchResumes();
        }}
      />

      {helpOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setHelpOpen(false)}
          />
          <div
            className="fixed top-0 right-0 bottom-0 z-50 w-1/2 bg-brand-canvas border-l border-brand-hairline overflow-y-auto"
            style={{
              boxShadow:
                "-8px 0px 32px -8px rgba(0,0,0,0.4), 0px 1px 1px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-brand-canvas border-b border-brand-hairline">
              <h3 className="text-sm font-semibold text-brand-ink tracking-[-0.02em]">
                How to upload a LaTeX resume
              </h3>
              <button
                onClick={() => setHelpOpen(false)}
                className="p-1 text-brand-mute hover:text-brand-ink rounded-sm transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-8">
              <div className="rounded-lg overflow-hidden border border-brand-hairline bg-brand-canvas-soft">
                <iframe
                  src="https://scribehow.com/embed/How_To_Upload_And_Compile_A_LaTeX_Resume_Template__08ZAMQbRQNae-6leFpGXtQ?scaleMode=cover&as=video"
                  width="100%"
                  height="800"
                  allow="fullscreen"
                  style={{ aspectRatio: "16 / 12", border: 0, minHeight: 480 }}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-brand-ink">
                  Import from Overleaf
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        Open your project in Overleaf
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        Go to your Overleaf dashboard and open the resume project
                        you want to import.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        Download the project as a .zip file
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        Click the <span className="text-brand-ink font-medium font-mono text-[11px]">Menu</span> button
                        in the top-left corner and select{" "}
                        <span className="text-brand-ink font-medium font-mono text-[11px]">Download as ZIP</span>.
                        Extract the downloaded .zip file on your computer.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md bg-brand-canvas-soft border border-brand-hairline">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-ink text-brand-canvas text-xs font-semibold shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        Create a new resume from your files
                      </p>
                      <p className="text-xs text-brand-body mt-0.5">
                        Click{" "}
                        <span className="text-brand-ink font-medium font-mono text-[11px]">New Resume</span>{" "}
                        above, select{" "}
                        <span className="text-brand-ink font-medium font-mono text-[11px]">Open from Computer</span>,
                        and upload all the extracted files. The folder structure
                        will be preserved automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
