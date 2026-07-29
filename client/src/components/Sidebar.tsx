import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Settings, LogOut, User, PanelLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/board", icon: LayoutDashboard, label: "Board" },
  { to: "/resumes", icon: FileText, label: "Resumes" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-brand-canvas-soft text-brand-body flex flex-col border-r border-brand-hairline transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-5 border-b border-brand-hairline min-h-[56px]">
        {!collapsed && (
          <h1 className="text-lg font-semibold text-brand-ink tracking-tight">
            LS
          </h1>
        )}
        <button
          onClick={onToggle}
          className={`p-1 text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 rounded-sm transition-colors ${
            collapsed ? "mx-auto" : "ml-auto"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={16} className={collapsed ? "rotate-180" : ""} />
        </button>
      </div>

      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-sm text-sm font-medium transition-colors group relative ${
                collapsed ? "justify-center p-2" : "px-3 py-2"
              } ${
                isActive
                  ? "bg-brand-canvas-soft-2 text-brand-ink"
                  : "hover:bg-brand-canvas-soft-2 hover:text-brand-ink"
              }`
            }
          >
            <Icon size={18} />
            {!collapsed && label}
            {collapsed && (
              <span className="absolute left-full ml-3 px-2.5 py-1 text-xs font-medium text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-brand-hairline">
        {user && !collapsed && (
          <div className="px-5 py-3 flex items-center gap-2 text-sm text-brand-mute">
            <User size={16} />
            <span className="truncate">{user.email}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 text-sm text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft-2 transition-colors group relative ${
            collapsed ? "justify-center px-2 py-3" : "px-5 py-3"
          }`}
        >
          <LogOut size={18} />
          {!collapsed && "Sign out"}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1 text-xs font-medium text-brand-ink bg-brand-canvas border border-brand-hairline rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Sign out
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
