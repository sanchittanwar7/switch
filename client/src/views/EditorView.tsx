import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { FolderOpen, Bot, PanelLeft } from "lucide-react";
import FileTree from "../components/editor/FileTree";
import MonacoEditor from "../components/editor/MonacoEditor";
import EditorToolbar from "../components/editor/EditorToolbar";
import PdfPreview from "../components/editor/PdfPreview";
import AgentPanel from "../components/editor/AgentPanel";
import { useEditorStore } from "../stores/editorStore";

type LeftPanel = "files" | "agent";

export default function EditorView() {
  const [searchParams] = useSearchParams();
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("files");
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const projectPath = searchParams.get("project");
  const pdfUrl = useEditorStore((s) => s.pdfUrl);

  if (!projectPath) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-brand-mute">Select a resume to edit.</div>
      </div>
    );
  }

  const resolvedPath = projectPath.startsWith("resumes/")
    ? projectPath
    : `resumes/${projectPath}`;

  return (
    <div className="h-full flex">
      <PanelGroup direction="horizontal">
        {!sideCollapsed ? (
          <Panel defaultSize={20} minSize={12} maxSize={30}>
            <div className="h-full flex flex-col">
              <div className="flex items-center px-4 py-2 border-b border-brand-hairline bg-brand-canvas-soft">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLeftPanel("files")}
                    className={`p-1 rounded-sm transition-colors ${
                      leftPanel === "files"
                        ? "bg-brand-canvas-soft-2 text-brand-ink"
                        : "text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2"
                    }`}
                    title="File Explorer"
                  >
                    <FolderOpen size={16} />
                  </button>
                  <button
                    onClick={() => setLeftPanel("agent")}
                    className={`p-1 rounded-sm transition-colors ${
                      leftPanel === "agent"
                        ? "bg-brand-canvas-soft-2 text-brand-ink"
                        : "text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2"
                    }`}
                    title="Agent"
                  >
                    <Bot size={16} />
                  </button>
                </div>
                <button
                  onClick={() => setSideCollapsed(true)}
                  className="ml-auto p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors"
                  title="Hide sidebar"
                >
                  <PanelLeft size={14} />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {leftPanel === "files" ? (
                  <FileTree projectPath={resolvedPath} />
                ) : (
                  <AgentPanel projectPath={resolvedPath} />
                )}
              </div>
            </div>
          </Panel>
        ) : (
          <div className="w-7 shrink-0 flex flex-col items-center pt-2 border-r border-brand-hairline bg-brand-canvas-soft">
            <button
              onClick={() => setSideCollapsed(false)}
              className="p-1 text-brand-mute hover:text-brand-ink rounded-sm transition-colors"
              title="Show sidebar"
            >
              <PanelLeft size={14} className="rotate-180" />
            </button>
          </div>
        )}
        {!sideCollapsed && (
          <PanelResizeHandle className="w-px bg-brand-hairline hover:bg-brand-link active:bg-brand-link transition-colors cursor-col-resize" />
        )}
        <Panel>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={50} minSize={25}>
              <div className="h-full flex flex-col">
                <EditorToolbar projectPath={resolvedPath} />
                <MonacoEditor />
              </div>
            </Panel>
            <PanelResizeHandle className="w-px bg-brand-hairline hover:bg-brand-link active:bg-brand-link transition-colors cursor-col-resize" />
            <Panel defaultSize={50} minSize={25}>
              <PdfPreview pdfUrl={pdfUrl} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
