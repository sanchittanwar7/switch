import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, Settings } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Board" },
  { to: "/editor", icon: FileText, label: "Editor" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-gray-900 text-gray-300 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white tracking-tight">
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
                  ? "bg-gray-800 text-white"
                  : "hover:bg-gray-800 hover:text-white"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">
        v0.1.0
      </div>
    </aside>
  );
}
