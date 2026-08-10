import { useRef, useCallback, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEditorStore } from "../../stores/editorStore";

export default function MonacoEditor() {
  const {
    activeFile,
    openFiles,
    fileContents,
    setFileContent,
    saveFile,
    setActiveFile,
    closeFile,
    isDirty,
  } = useEditorStore();

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMount: OnMount = useCallback(
    (editorInst, monaco) => {
      editorRef.current = editorInst;

      editorInst.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          const file = useEditorStore.getState().activeFile;
          if (file) useEditorStore.getState().saveFile(file);
        },
      );

      editorInst.onDidBlurEditorText(() => {
        const file = useEditorStore.getState().activeFile;
        if (file && useEditorStore.getState().isDirty) {
          useEditorStore.getState().saveFile(file);
        }
      });
    },
    [],
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (activeFile && value !== undefined) {
        setFileContent(activeFile, value);
      }
    },
    [activeFile, setFileContent],
  );

  useEffect(() => {
    if (activeFile && isDirty) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const state = useEditorStore.getState();
        if (state.activeFile && state.isDirty) {
          state.saveFile(state.activeFile);
        }
      }, 1500);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [activeFile, isDirty]);

  const content = activeFile ? (fileContents[activeFile] ?? "") : "";

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-brand-canvas">
        <span className="text-sm text-brand-mute">
          Select a file to edit
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex bg-brand-canvas-soft border-b border-brand-hairline overflow-x-auto">
        {openFiles.map((file) => (
          <div
            key={file}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-r border-brand-hairline shrink-0 select-none transition-colors ${
              file === activeFile
                ? "bg-brand-canvas text-brand-ink"
                : "text-brand-body hover:bg-brand-canvas-soft-2 hover:text-brand-ink"
            }`}
            onClick={() => setActiveFile(file)}
          >
            <span className="truncate max-w-[140px]">
              {file.split("/").pop()}
            </span>
            {file === activeFile && isDirty && (
              <span className="text-brand-link text-[10px]">●</span>
            )}
            <button
              className="ml-0.5 p-0.5 rounded-sm hover:bg-brand-canvas-soft-2 text-brand-mute hover:text-brand-ink transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <Editor
        height="100%"
        language="latex"
        theme="vs-dark"
        value={content}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily:
            "'Geist Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          padding: { top: 12 },
          guides: { indentation: false },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
        }}
      />
    </div>
  );
}
