import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { useSettingsStore } from "./stores/settingsStore";
import Sidebar from "./components/Sidebar";
import KanbanView from "./views/KanbanView";
import EditorView from "./views/EditorView";
import ResumeListView from "./views/ResumeListView";
import SettingsView from "./views/SettingsView";
import LoginPage from "./views/LoginPage";
import LandingPage from "./views/LandingPage";

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-brand-canvas">
      <div className="text-sm text-brand-mute">Loading...</div>
    </div>
  );
}

function ProtectedLayout() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="flex h-screen bg-brand-canvas-soft">
      <Sidebar />
      <main className="ml-56 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/board" replace /> : <LandingPage />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/board" replace /> : <LoginPage />}
      />

      <Route
        element={
          user ? <ProtectedLayout /> : <Navigate to="/login" replace />
        }
      >
        <Route path="/board" element={<KanbanView />} />
        <Route path="/resumes" element={<ResumeListView />} />
        <Route path="/resume" element={<EditorView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={user ? "/board" : "/"} replace />}
      />
    </Routes>
  );
}
