// src/components/layout/AdminSidebar.tsx

import { NavLink, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { ADMIN_NAV_LINKS } from "@/lib/constants";

const NAV_ICONS: Record<string, string> = {
  "/admin":               "📊",
  "/admin/users":         "👥",
 // "/admin/exercises":     "🏋️",
  "/admin/coaches":       "🎯",
  "/admin/subscriptions": "💳",
  // settings removed
};

export function AdminSidebar() {
  const dispatch   = useAppDispatch();
  const navigate   = useNavigate();
  const { displayName } = useAppSelector((s) => s.auth);

  const handleLogout = () => {
    dispatch(logout());
    localStorage.clear();
    navigate("/login");
  };

  return (
    <aside className="w-64 min-h-screen bg-bg-card border-l border-white/10 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="font-bold text-accent text-lg leading-none">FitAI</p>
            <p className="text-xs text-slate-500 mt-0.5">لوحة الإدارة</p>
          </div>
        </div>
      </div>

      {/* Admin badge */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 bg-accent/10 rounded-xl p-3">
          <span className="text-xl">👤</span>
          <div>
            <p className="text-sm font-semibold text-white leading-none">{displayName}</p>
            <p className="text-xs text-accent mt-0.5">مدير النظام</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {ADMIN_NAV_LINKS.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === "/admin"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${isActive
                ? "bg-accent/15 text-accent border border-accent/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"}`
            }
          >
            <span className="text-lg">{NAV_ICONS[link.path]}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="p-4 border-t border-white/10 flex flex-col gap-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all w-full"
        >
          <span>🚪</span> تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
