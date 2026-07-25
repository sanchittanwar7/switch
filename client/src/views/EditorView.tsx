import { useSearchParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import FileTree from "../components/editor/FileTree";
import MonacoEditor from "../components/editor/MonacoEditor";
import EditorToolbar from "../components/editor/EditorToolbar";
import PdfPreview from "../components/editor/PdfPreview";
import { useEditorStore } from "../stores/editorStore";

export default function EditorView() {
  const [searchParams] = useSearchParams();
  const projectPath = searchParams.get("project") || "resumes/default";
  const pdfUrl = useEditorStore((s) => s.pdfUrl);

  return (
    <div className="h-full flex">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={18} minSize={12} maxSize={30}>
          <FileTree projectPath={projectPath} />
        </Panel>
        <PanelResizeHandle className="w-px bg-brand-hairline hover:bg-brand-link active:bg-brand-link transition-colors cursor-col-resize" />
        <Panel>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={60} minSize={30}>
              <div className="h-full flex flex-col">
                <EditorToolbar projectPath={projectPath} />
                <MonacoEditor />
              </div>
            </Panel>
            <PanelResizeHandle className="w-px bg-brand-hairline hover:bg-brand-link active:bg-brand-link transition-colors cursor-col-resize" />
            <Panel defaultSize={40} minSize={20}>
              <PdfPreview pdfUrl={pdfUrl} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
