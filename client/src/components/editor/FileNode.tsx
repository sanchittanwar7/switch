import {
  File,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileImage,
} from "lucide-react";
import type { FileEntry } from "../../types";

interface FileNodeProps {
  entry: FileEntry;
  path: string;
  depth: number;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onClickFile: (path: string) => void;
  onContextMenu: (
    e: React.MouseEvent,
    path: string,
    isDir: boolean,
  ) => void;
  treeData: Record<string, FileEntry[]>;
  editingPath: string | null;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onSubmitRename: () => void;
  onCancelEdit: () => void;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tex":
    case "sty":
    case "cls":
      return <FileCode size={15} className="shrink-0 text-brand-link" />;
    case "pdf":
      return <FileImage size={15} className="shrink-0 text-brand-error" />;
    case "bib":
      return <FileText size={15} className="shrink-0 text-brand-success" />;
    default:
      return <File size={15} className="shrink-0 text-brand-mute" />;
  }
}

export default function FileNode({
  entry,
  path,
  depth,
  expandedDirs,
  onToggleDir,
  onClickFile,
  onContextMenu,
  treeData,
  editingPath,
  editValue,
  onEditValueChange,
  onSubmitRename,
  onCancelEdit,
}: FileNodeProps) {
  const isDir = entry.type === "directory";
  const isEditing = editingPath === path;
  const childPrefix = `${path}/`;
  const children = treeData[childPrefix] || [];
  const expanded = expandedDirs.has(path);

  const handleClick = () => {
    if (isDir) {
      onToggleDir(path);
    } else if (!isEditing) {
      onClickFile(path);
    }
  };

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1.5 py-0.5"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {isDir ? (
          <Folder size={15} className="shrink-0 text-brand-link" />
        ) : (
          getFileIcon(path.split("/").pop() || "")
        )}
        <input
          autoFocus
          className="flex-1 bg-brand-canvas-soft-2 text-brand-ink text-xs px-2 py-0.5 rounded-sm border border-brand-link outline-none mr-3"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmitRename();
            if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={onCancelEdit}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-brand-canvas-soft-2 text-sm text-brand-body select-none transition-colors"
        style={{
          paddingLeft: `${12 + depth * 16}px`,
          paddingRight: "12px",
        }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, path, isDir)}
      >
        {isDir ? (
          expanded ? (
            <FolderOpen
              size={15}
              className="shrink-0 text-brand-link"
            />
          ) : (
            <Folder size={15} className="shrink-0 text-brand-link" />
          )
        ) : (
          getFileIcon(path.split("/").pop() || "")
        )}
        <span className="truncate text-[13px] leading-5">
          {path.split("/").pop()}
        </span>
      </div>

      {isDir &&
        expanded &&
        children.map((child) => (
          <FileNode
            key={child.name}
            entry={child}
            path={child.name}
            depth={depth + 1}
            expandedDirs={expandedDirs}
            onToggleDir={onToggleDir}
            onClickFile={onClickFile}
            onContextMenu={onContextMenu}
            treeData={treeData}
            editingPath={editingPath}
            editValue={editValue}
            onEditValueChange={onEditValueChange}
            onSubmitRename={onSubmitRename}
            onCancelEdit={onCancelEdit}
          />
        ))}
    </div>
  );
}
