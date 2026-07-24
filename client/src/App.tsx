import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Sidebar from "./components/Sidebar";
import KanbanView from "./views/KanbanView";
import EditorView from "./views/EditorView";
import SettingsView from "./views/SettingsView";
import LoginPage from "./views/LoginPage";

function ProtectedLayout() {
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

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400">Loading...</div>
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
