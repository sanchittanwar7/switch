import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { useSettingsStore } from "./stores/settingsStore";
import Sidebar from "./components/Sidebar";
import KanbanView from "./views/KanbanView";
import EditorView from "./views/EditorView";
import ResumeListView from "./views/ResumeListView";
import SettingsView from "./views/SettingsView";
import LoginPage from "./views/LoginPage";

function ProtectedLayout() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  return (
    <div className="flex h-screen bg-brand-canvas-soft">
      <Sidebar />
      <main className="ml-56 flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<KanbanView />} />
          <Route path="/resumes" element={<ResumeListView />} />
          <Route path="/resume" element={<EditorView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-canvas">
        <div className="text-sm text-brand-mute">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<ProtectedLayout />} />
    </Routes>
  );
}

export default function App() {
  return <AuthGate />;
}
