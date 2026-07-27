import { useState, useRef } from "react";
import { X, FileText, Upload, FolderOpen, ArrowLeft, Check, Loader2 } from "lucide-react";
import { apiPost } from "../lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type Step = "choose" | "blank" | "upload";

export default function NewResumeModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setStep("choose");
    setName("");
    setUploading(false);
    setError(null);
    setSelectedFolderName(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreateBlank = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUploading(true);
    setError(null);
    try {
      await apiPost("/api/fs/create-blank-resume", { name: trimmed });
      reset();
      onCreated();
    } catch (e: any) {
      setError(e.message || "Failed to create resume");
    } finally {
      setUploading(false);
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploadFiles: Array<{ path: string; content: string }> = [];
    let folderName = "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = (file as any).webkitRelativePath || file.name;
      if (!folderName) {
        const parts = relativePath.split("/");
        folderName = parts.length > 1 ? parts[0] : "";
      }

      const slug = relativePath.split("/").slice(1).join("/");
      if (!slug) continue;

      try {
        const content = await file.text();
        uploadFiles.push({ path: slug, content });
      } catch {
        console.warn("Failed to read file:", relativePath);
      }
    }

    if (uploadFiles.length === 0) {
      setError("No readable files found in selected folder");
      return;
    }

    const resumeName = name.trim() || folderName || "uploaded-resume";
    setUploading(true);
    setError(null);

    try {
      await apiPost("/api/fs/upload-resume", { name: resumeName, files: uploadFiles });
      reset();
      onCreated();
    } catch (e: any) {
      setError(e.message || "Failed to upload resume");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openFolderPicker = () => {
    setStep("upload");
    setName("");
    setError(null);
    setSelectedFolderName(null);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="bg-brand-canvas-soft border border-brand-hairline rounded-xl p-8 w-[440px]"
        style={{
          boxShadow:
            "0px 1px 1px rgba(0,0,0,0.2), 0px 8px 16px -4px rgba(0,0,0,0.3), 0px 24px 32px -8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-brand-ink">
            {step === "choose" && "New Resume"}
            {step === "blank" && "Create Blank Template"}
            {step === "upload" && "Upload from Computer"}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-brand-error-soft border border-brand-error/20 px-3 py-2 text-xs text-brand-error">
            {error}
          </div>
        )}

        {step === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setStep("blank")}
              className="w-full flex items-center gap-3 rounded-lg border border-brand-hairline bg-brand-canvas px-4 py-3 text-sm text-brand-ink hover:border-brand-link/30 hover:bg-brand-canvas-soft-2 transition-colors text-left"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-brand-canvas-soft-2 text-brand-body shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <div className="font-medium">Create blank template</div>
                <div className="text-xs text-brand-mute mt-0.5">
                  Start fresh with an empty main.tex file
                </div>
              </div>
            </button>

            <button
              onClick={openFolderPicker}
              className="w-full flex items-center gap-3 rounded-lg border border-brand-hairline bg-brand-canvas px-4 py-3 text-sm text-brand-ink hover:border-brand-link/30 hover:bg-brand-canvas-soft-2 transition-colors text-left"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-brand-canvas-soft-2 text-brand-body shrink-0">
                <Upload size={16} />
              </div>
              <div>
                <div className="font-medium">Upload from computer</div>
                <div className="text-xs text-brand-mute mt-0.5">
                  Upload an existing LaTeX resume folder
                </div>
              </div>
            </button>
          </div>
        )}

        {step === "blank" && (
          <>
            <p className="text-xs text-brand-mute mb-3">
              Enter a name for your new resume project.
            </p>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBlank();
                if (e.key === "Escape") handleClose();
              }}
              placeholder="my-resume"
              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setStep("choose"); setError(null); }}
                className="inline-flex items-center gap-1 rounded-full px-4 h-9 text-sm font-medium text-brand-mute hover:text-brand-ink transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={handleCreateBlank}
                disabled={!name.trim() || uploading}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-link text-white px-4 h-9 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {uploading && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </>
        )}

        {step === "upload" && (
          <>
            <p className="text-xs text-brand-mute mb-3">
              Select a folder containing your LaTeX resume files. Name is optional — defaults to folder name.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-hairline bg-brand-canvas px-4 h-9 text-sm font-medium text-brand-ink hover:border-brand-link/30 hover:bg-brand-canvas-soft-2 transition-colors"
              >
                <FolderOpen size={14} />
                Choose Folder
              </button>
              {selectedFolderName && (
                <span className="text-xs text-brand-mute flex items-center gap-1">
                  <Check size={12} className="text-green-500" />
                  {selectedFolderName}
                </span>
              )}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleClose();
              }}
              placeholder="resume-name (optional)"
              className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
            />
            <input
              ref={fileInputRef}
              type="file"
              // @ts-ignore webkitdirectory is supported in all modern browsers
              webkitdirectory=""
              directory=""
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const firstPath = (files[0] as any).webkitRelativePath || files[0].name;
                  const folder = firstPath.split("/")[0];
                  setSelectedFolderName(folder);
                }
                handleFolderChange(e);
              }}
              className="hidden"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setStep("choose"); setError(null); setSelectedFolderName(null); }}
                className="inline-flex items-center gap-1 rounded-full px-4 h-9 text-sm font-medium text-brand-mute hover:text-brand-ink transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-link text-white px-4 h-9 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {uploading && <Loader2 size={14} className="animate-spin" />}
                Upload
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
