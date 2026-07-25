import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Settings, LogOut, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Board" },
  { to: "/resumes", icon: FileText, label: "Resumes" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-brand-canvas-soft text-brand-body flex flex-col border-r border-brand-hairline">
      <div className="px-5 py-5 border-b border-brand-hairline">
        <h1 className="text-lg font-semibold text-brand-ink tracking-tight">
          Switch
        </h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-canvas-soft-2 text-brand-ink"
                  : "hover:bg-brand-canvas-soft-2 hover:text-brand-ink"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-brand-hairline">
        {user && (
          <div className="px-5 py-3 flex items-center gap-2 text-sm text-brand-mute">
            <User size={16} />
            <span className="truncate">{user.email}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-5 py-3 text-sm text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
