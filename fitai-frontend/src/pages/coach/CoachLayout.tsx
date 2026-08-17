// src/pages/coach/CoachLayout.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, XCircle, PauseCircle, Loader2, LogOut } from "lucide-react";
import { CoachSidebar } from "@/components/layout/CoachSidebar";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { fetchCoachUsersThunk, fetchCoachMeThunk } from "@/features/coach/coachSlice";

interface CoachLayoutProps {
  children: React.ReactNode;
}

// Shown to coaches who aren't yet verified/active (pending, rejected, inactive).
function CoachGateScreen({ status }: { status: string }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    localStorage.clear();
    navigate("/login");
  };

  const config = {
    pending: {
      icon:  <Clock className="h-12 w-12 text-brand-orange" />,
      tone:  "border-brand-orange/30 bg-brand-orange/5",
      title: "حسابك قيد المراجعة ⏳",
      desc:  "شكراً لتسجيلك كمدرب! يراجع فريقنا بياناتك وشهادتك الآن. سيتم تفعيل حسابك بمجرد الموافقة، وستتمكن حينها من استقبال المتدربين.",
    },
    rejected: {
      icon:  <XCircle className="h-12 w-12 text-red-400" />,
      tone:  "border-red-500/30 bg-red-500/5",
      title: "تم رفض طلب الانضمام",
      desc:  "للأسف لم تتم الموافقة على طلبك كمدرب. إذا كنت تعتقد أن هناك خطأ، تواصل مع إدارة المنصة لمراجعة حالتك.",
    },
    inactive: {
      icon:  <PauseCircle className="h-12 w-12 text-slate-400" />,
      tone:  "border-white/10 bg-white/5",
      title: "حسابك متوقف مؤقتاً",
      desc:  "تم إيقاف حسابك كمدرب من قبل الإدارة. تواصل معنا لإعادة التفعيل.",
    },
  }[status] ?? {
    icon:  <Clock className="h-12 w-12 text-brand-orange" />,
    tone:  "border-white/10 bg-white/5",
    title: "حسابك غير مفعّل",
    desc:  "لا يمكن الوصول إلى لوحة المدرب حالياً.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 font-tajawal text-slate-100" dir="rtl">
      <div className={`w-full max-w-md rounded-3xl border p-8 text-center ${config.tone}`}>
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-bg-card">
          {config.icon}
        </div>
        <h1 className="mb-3 text-2xl font-black">{config.title}</h1>
        <p className="text-sm leading-relaxed text-slate-400">{config.desc}</p>

        <button
          onClick={handleLogout}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

export function CoachLayout({ children }: CoachLayoutProps) {
  const dispatch = useAppDispatch();
  const { me, meLoaded } = useAppSelector((s) => s.coach);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load own verification status first
  useEffect(() => {
    dispatch(fetchCoachMeThunk());
  }, [dispatch]);

  // Only load assigned clients once we know the coach is active
  useEffect(() => {
    if (me?.status === "active") dispatch(fetchCoachUsersThunk());
  }, [me?.status, dispatch]);

  // Brief loading state until /coach/me resolves (avoids flashing the dashboard)
  if (!meLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Not verified/active → gate
  if (me && me.status !== "active") {
    return <CoachGateScreen status={me.status} />;
  }

  // Verified coach → normal portal
  return (
    <div className="min-h-screen bg-bg font-tajawal text-slate-100 flex flex-row-reverse" dir="rtl">
      <CoachSidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="mb-4 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white"
          >
            ☰ القائمة
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
