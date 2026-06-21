// src/pages/coach/CoachDashboard.tsx
import { Link } from "react-router-dom";
import { Dumbbell, Utensils, User, Loader2, MessageCircle, TrendingUp } from "lucide-react";
import { useAppSelector } from "@/app/hooks";
import { getGoalLabel } from "@/lib/goalLabels";

export function CoachDashboard() {
  const { displayName } = useAppSelector((s) => s.auth);
  // Real assigned clients — loaded by CoachLayout via GET /coach/users
  const { users: assignedUsers, isLoading } = useAppSelector((s) => s.coach);

  return (
    <div>
      {/* رأس الصفحة */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Coach Portal</p>
        <h1 className="mt-1 text-3xl font-black">مرحباً، {displayName} 👋</h1>
        <p className="mt-1 text-sm text-slate-500">
          لديك <span className="text-white font-semibold">{assignedUsers.length}</span> مستخدمين مُعيَّنين لك
        </p>
      </div>

      {/* حالة التحميل */}
      {isLoading && assignedUsers.length === 0 && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      )}

      {/* بطاقات المستخدمين */}
      <div className="grid gap-4 sm:grid-cols-2">
        {assignedUsers.map((user) => (
          <div key={user.id} className="card flex flex-col gap-4">
            {/* معلومات المستخدم */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-xl font-black text-accent">
                {user.name[0]}
              </div>
              <div>
                <p className="font-bold text-white">{user.name}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {user.plan === "premium" && (
                    <span className="rounded-full bg-brand-purple/20 px-2 py-0.5 text-xs font-semibold text-brand-purple">
                      💎 بريميوم
                    </span>
                  )}
                  {user.goal && (
                    <span className="text-xs text-slate-500">🎯 {getGoalLabel(user.goal)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <p className="text-slate-500">خطة تمارين</p>
                <p className="mt-0.5 font-semibold text-accent">{user.hasWorkout ? "✓ نشطة" : "لا يوجد"}</p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <p className="text-slate-500">خطة تغذية</p>
                <p className="mt-0.5 font-semibold text-brand-blue">{user.hasNutrition ? "✓ نشطة" : "لا يوجد"}</p>
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className="grid grid-cols-2 gap-2">
              <Link
                to={`/coach/workout?user=${user.id}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/5 py-2 text-xs font-semibold text-accent transition-all hover:bg-accent/10"
              >
                <Dumbbell className="h-3.5 w-3.5" />
                خطة التمارين
              </Link>
              <Link
                to={`/coach/nutrition?user=${user.id}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-brand-blue/20 bg-brand-blue/5 py-2 text-xs font-semibold text-brand-blue transition-all hover:bg-brand-blue/10"
              >
                <Utensils className="h-3.5 w-3.5" />
                خطة التغذية
              </Link>
              <Link
                to={`/coach/progress?user=${user.id}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-2 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/10"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                التقدم
              </Link>
              <Link
                to={`/coach/chat?user=${user.id}`}
                className="relative flex items-center justify-center gap-2 rounded-xl border border-brand-purple/20 bg-brand-purple/5 py-2 text-xs font-semibold text-brand-purple transition-all hover:bg-brand-purple/10"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                محادثة
                {user.unreadMessages > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {user.unreadMessages > 9 ? "9+" : user.unreadMessages}
                  </span>
                )}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* رسالة إذا لم يكن هناك مستخدمون */}
      {!isLoading && assignedUsers.length === 0 && (
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <User className="mb-4 h-12 w-12 text-slate-700" />
          <p className="text-slate-400">لم يتم تعيين أي مستخدمين لك بعد</p>
          <p className="mt-1 text-xs text-slate-600">سيظهر المستخدمون هنا بمجرد أن يختاروك كمدرب</p>
        </div>
      )}
    </div>
  );
}
