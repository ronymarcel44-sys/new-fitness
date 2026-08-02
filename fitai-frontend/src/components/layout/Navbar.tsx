// src/components/layout/Navbar.tsx
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Zap, Menu, X, LogOut, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/lib/constants";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { resetProfile } from "@/features/user/userSlice";
import { resetPlan as resetWorkout } from "@/features/workout/workoutSlice";
import { resetPlan as resetNutrition } from "@/features/nutrition/nutritionSlice";
import { clearChat } from "@/features/chat/chatSlice";
import { resetProgress } from "@/features/progress/progressSlice";

export function Navbar() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const dispatch     = useAppDispatch();

  const { displayName, role } = useAppSelector((s) => s.auth);

  // باقة المستخدم تأتي من ملفه الشخصي الحقيقي (GET /users/me)
  const isPremium = useAppSelector((s) => s.user.profile.plan) === "premium";
  // اسم المستخدم من ملفه الحقيقي — يبقى متزامناً بعد تعديله في صفحة الحساب
  const profileName = useAppSelector((s) => s.user.profile.name);

  const [scrolled, setScrolled] = useState(false);
  const [open,     setOpen]     = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const handleLogout = () => {
    // مسح كل البيانات من Redux
    dispatch(logout());
    dispatch(resetProfile());
    dispatch(resetWorkout());
    dispatch(resetNutrition());
    dispatch(clearChat());
    dispatch(resetProgress());
    // مسح localStorage كاملاً
    localStorage.clear();
    navigate("/login");
  };

  return (
    <nav className={cn(
      "fixed inset-x-0 top-0 z-50 transition-all duration-500",
      scrolled ? "border-b border-white/10 bg-bg/90 backdrop-blur-xl" : "bg-bg/80 backdrop-blur-md"
    )}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero shadow-accent">
            <Zap className="h-5 w-5 text-bg" />
          </div>
          <span className="text-xl font-black">فِيت<span className="text-accent">AI</span></span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ path, label }) => (
            <Link key={path} to={path} className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200",
              pathname === path ? "border border-accent/30 bg-accent/10 text-accent" : "text-slate-400 hover:text-white"
            )}>{label}</Link>
          ))}

          {/* رابط البريميوم — للمجاني: ترقية، وللبريميوم: مدربي وعضويتي */}
          {role === "user" && (
            <Link
              to="/premium"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200",
                pathname === "/premium"
                  ? "border border-brand-purple/40 bg-brand-purple/10 text-brand-purple"
                  : "text-brand-purple/70 hover:text-brand-purple"
              )}
            >
              <Crown className="h-3.5 w-3.5" />
              {isPremium ? "مدربي" : "بريميوم"}
            </Link>
          )}
        </div>

        {/* Notifications bell — visible on all sizes for users */}
        {role === "user" && (
          <div className="mr-auto flex items-center md:mr-0 md:ml-3">
            <NotificationBell />
          </div>
        )}

        {/* Desktop right side */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-slate-400">{profileName || displayName}</span>

          {/* [جديد] رابط لوحة التحكم للأدمن */}
          {role === "admin" && (
            <Link
              to="/admin"
              className="rounded-lg border border-brand-purple/30 bg-brand-purple/10 px-3 py-2 text-xs font-semibold text-brand-purple transition-all hover:bg-brand-purple/20"
            >
              لوحة التحكم
            </Link>
          )}

          <button onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400">
            <LogOut className="h-3.5 w-3.5" /> خروج
          </button>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-white">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 bg-bg px-6 py-4 md:hidden">
          {NAV_LINKS.map(({ path, label }) => (
            <Link key={path} to={path} onClick={() => setOpen(false)}
              className={cn("block rounded-lg px-4 py-3 text-sm font-medium",
                pathname === path ? "text-accent" : "text-slate-400")}>
              {label}
            </Link>
          ))}

          {/* رابط البريميوم في الموبايل */}
          {role === "user" && (
            <Link to="/premium" onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-brand-purple/80">
              <Crown className="h-4 w-4" /> {isPremium ? "مدربي وعضويتي" : "ترقية للبريميوم"}
            </Link>
          )}

          <button onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm text-red-400">
            <LogOut className="h-4 w-4" /> تسجيل الخروج
          </button>
        </div>
      )}
    </nav>
  );
}