// src/components/layout/CoachSidebar.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Users, LogOut, Zap, ChevronLeft, UserCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { NotificationBell } from "@/components/notifications/NotificationBell";

// روابط الـ sidebar الخاصة بالمدرب
// ملاحظة: خطة التمارين/التغذية والتقدم والمحادثة تُفتح لكل متدرب من بطاقته في
// صفحة "مستخدموي" (تحتاج ?user=)، لذلك لا توضع كروابط عامة في الشريط الجانبي.
const COACH_NAV = [
  { path: "/coach",            label: "مستخدموي",        icon: Users      },
  { path: "/coach/earnings",   label: "الأرباح",         icon: Wallet     },
  { path: "/coach/profile",    label: "ملفي الشخصي",     icon: UserCircle },
];

export function CoachSidebar() {
  const { pathname }   = useLocation();
  const navigate       = useNavigate();
  const dispatch       = useAppDispatch();
  const { displayName } = useAppSelector((s) => s.auth);

  const handleLogout = () => {
    dispatch(logout());
    localStorage.clear();
    navigate("/login");
  };

  return (
    <aside className="w-64 min-h-screen shrink-0 flex flex-col border-l border-white/10 bg-bg-card">
      {/* شعار التطبيق */}
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero">
          <Zap className="h-5 w-5 text-bg" />
        </div>
        <div>
          <span className="text-lg font-black">فِيت<span className="text-accent">AI</span></span>
          <p className="text-[10px] text-slate-500 leading-none">بوابة المدرب</p>
        </div>
      </div>

      {/* اسم المدرب */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-xs text-slate-500">مرحباً،</p>
          <p className="font-bold text-white">{displayName}</p>
        </div>
        <NotificationBell />
      </div>

      {/* الروابط */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {COACH_NAV.map(({ path, label, icon: Icon }) => {
          // نعتبر المسار نشطاً إذا تطابق تماماً أو بدأ به
          const isActive = path === "/coach"
            ? pathname === "/coach"
            : pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "border border-accent/30 bg-accent/10 text-accent"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* زر تسجيل الخروج */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
