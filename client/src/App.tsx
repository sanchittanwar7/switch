import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import KanbanView from "./views/KanbanView";
import EditorView from "./views/EditorView";
import SettingsView from "./views/SettingsView";

export default function App() {
  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <main className="ml-56 flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<KanbanView />} />
          <Route path="/editor" element={<EditorView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
    </div>
  );
}
