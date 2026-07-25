import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiPut, apiPost, apiDelete } from "../../lib/api";
import { useEditorStore } from "../../stores/editorStore";
import FileNode from "./FileNode";
import type { FileEntry } from "../../types";

interface FileTreeProps {
  projectPath: string;
}

type ContextMenuState = {
  x: number;
  y: number;
  path: string;
  isDir: boolean;
} | null;

type NewItemState = {
  parentPath: string;
  type: "file" | "folder";
} | null;

export default function FileTree({ projectPath }: FileTreeProps) {
  const {
    openFile,
    fetchFileTree,
  } = useEditorStore();

  const [treeData, setTreeData] = useState<Record<string, FileEntry[]>>({});
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [newItem, setNewItem] = useState<NewItemState>(null);
  const [newItemName, setNewItemName] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const rootPrefix = projectPath.endsWith("/")
    ? projectPath
    : `${projectPath}/`;

  const fetchDir = useCallback(async (prefix: string) => {
    try {
      const entries = await apiGet<FileEntry[]>(
        `/api/fs/list?dir=${encodeURIComponent(prefix)}`,
      );
      const normalized = entries.map((e) => ({
        ...e,
        name: prefix + e.name,
      }));
      setTreeData((prev) => ({ ...prev, [prefix]: normalized }));
    } catch {
      setTreeData((prev) => ({ ...prev, [prefix]: [] }));
    }
  }, []);

  useEffect(() => {
    setTreeData({});
    setExpandedDirs(new Set([projectPath]));
    setLoading(true);
    fetchDir(rootPrefix).finally(() => setLoading(false));
  }, [projectPath, rootPrefix, fetchDir]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const refreshTree = useCallback(async () => {
    const prefixes = [
      rootPrefix,
      ...Array.from(expandedDirs).map((d) => `${d}/`),
    ];
    await Promise.all(prefixes.map((p) => fetchDir(p)));
    fetchFileTree().catch(() => {});
  }, [rootPrefix, expandedDirs, fetchDir, fetchFileTree]);

  const handleToggleDir = useCallback(
    async (dirPath: string) => {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        if (next.has(dirPath)) {
          next.delete(dirPath);
        } else {
          next.add(dirPath);
        }
        return next;
      });
      const prefix = `${dirPath}/`;
      if (!treeData[prefix]) {
        await fetchDir(prefix);
      }
    },
    [treeData, fetchDir],
  );

  const handleClickFile = useCallback(
    (filePath: string) => {
      openFile(filePath);
    },
    [openFile],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, path: string, isDir: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, path, isDir });
    },
    [],
  );

  const parentPath = (childPath: string) =>
    childPath.split("/").slice(0, -1).join("/");

  const handleNew = (type: "file" | "folder") => {
    if (!contextMenu) return;
    const parent = contextMenu.isDir
      ? contextMenu.path
      : parentPath(contextMenu.path);
    setContextMenu(null);
    setNewItem({ parentPath: parent, type });
    setNewItemName("");
  };

  const submitNewItem = async () => {
    if (!newItem || !newItemName.trim()) {
      setNewItem(null);
      return;
    }
    const fullPath = `${newItem.parentPath}/${newItemName.trim()}`;
    try {
      if (newItem.type === "file") {
        await apiPut("/api/fs/write", { path: fullPath, content: "" });
      } else {
        await apiPost("/api/fs/mkdir", { path: fullPath });
      }
    } catch {}
    setNewItem(null);
    setNewItemName("");
    await refreshTree();
  };

  const handleRename = () => {
    if (!contextMenu) return;
    setContextMenu(null);
    setEditingPath(contextMenu.path);
    setEditValue(contextMenu.path.split("/").pop() || "");
  };

  const submitRename = async () => {
    if (!editingPath || !editValue.trim()) {
      setEditingPath(null);
      return;
    }
    const oldPath = editingPath;
    const newName = editValue.trim();
    const parent = parentPath(oldPath);
    const newPath = `${parent}/${newName}`;
    if (oldPath === newPath) {
      setEditingPath(null);
      return;
    }
    try {
      await apiPost("/api/fs/rename", { oldPath, newPath });
    } catch {}
    setEditingPath(null);
    await refreshTree();
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    setDeletingPath(contextMenu.path);
    setContextMenu(null);
  };

  const confirmDelete = async () => {
    if (!deletingPath) return;
    try {
      await apiDelete("/api/fs/delete", { path: deletingPath });
    } catch {}
    setDeletingPath(null);
    await refreshTree();
  };

  const rootEntries = treeData[rootPrefix] || [];

  const rootFolderEntry: FileEntry = { name: projectPath, type: "directory" };

  return (
    <div className="h-full flex flex-col bg-brand-canvas">
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-2 text-xs text-brand-mute">
            Loading...
          </div>
        ) : rootEntries.length === 0 ? (
          <div className="px-3 py-2 text-xs text-brand-mute">
            No files
          </div>
        ) : (
          <FileNode
            entry={rootFolderEntry}
            path={projectPath}
            depth={0}
            expandedDirs={expandedDirs}
            onToggleDir={handleToggleDir}
            onClickFile={handleClickFile}
            onContextMenu={handleContextMenu}
            treeData={treeData}
            editingPath={editingPath}
            editValue={editValue}
            onEditValueChange={setEditValue}
            onSubmitRename={submitRename}
            onCancelEdit={() => setEditingPath(null)}
          />
        )}

        {newItem && (
          <div
            className="flex items-center gap-1.5 px-3 py-0.5"
            style={{
              paddingLeft: `${
                12 +
                depthOf(newItem.parentPath, projectPath) * 16 +
                32
              }px`,
            }}
          >
            <span className="text-brand-link shrink-0 text-xs">*</span>
            <input
              autoFocus
              className="flex-1 bg-brand-canvas-soft-2 text-brand-ink text-xs px-2 py-0.5 rounded-sm border border-brand-link outline-none"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewItem();
                if (e.key === "Escape") setNewItem(null);
              }}
              onBlur={submitNewItem}
              placeholder={
                newItem.type === "file" ? "filename.tex" : "folder-name"
              }
            />
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-brand-canvas-soft border border-brand-hairline rounded-lg py-1 min-w-[140px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            boxShadow:
              "0px 1px 1px rgba(0,0,0,0.3), 0px 8px 16px -4px rgba(0,0,0,0.4), 0px 24px 32px -8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
            onClick={() => handleNew("file")}
          >
            New File
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
            onClick={() => handleNew("folder")}
          >
            New Folder
          </button>
          <div className="border-t border-brand-hairline my-0.5" />
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
            onClick={handleRename}
          >
            Rename
          </button>
          <div className="border-t border-brand-hairline my-0.5" />
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-brand-error hover:bg-brand-canvas-soft-2 transition-colors"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      )}

      {deletingPath && (
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
                {deletingPath.split("/").pop()}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-1.5 text-sm font-medium text-brand-body hover:text-brand-ink rounded-full hover:bg-brand-canvas-soft-2 transition-colors"
                onClick={() => setDeletingPath(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 text-sm font-medium bg-brand-error text-white rounded-full hover:opacity-90 transition-opacity"
                onClick={confirmDelete}
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

function depthOf(childPath: string, projectPath: string): number {
  const rel = childPath;
  if (rel === projectPath) return 0;
  const parts = rel.split("/");
  const base = projectPath.split("/").length;
  return Math.max(0, parts.length - base);
}
