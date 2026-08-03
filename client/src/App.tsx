import { useState, useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useSettingsStore } from "./stores/settingsStore";
import Sidebar from "./components/Sidebar";
import KanbanView from "./views/KanbanView";
import EditorView from "./views/EditorView";
import ResumeListView from "./views/ResumeListView";
import SettingsView from "./views/SettingsView";
import CalendarView from "./views/CalendarView";
import ApplicationView from "./views/ApplicationView";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="flex h-screen bg-brand-canvas-soft">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <main
        className={`flex-1 overflow-auto transition-[margin] duration-200 ${
          sidebarCollapsed ? "ml-16" : "ml-56"
        }`}
      >
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
        <Route path="/application/:id" element={<ApplicationView />} />
        <Route path="/calendar" element={<CalendarView />} />
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
