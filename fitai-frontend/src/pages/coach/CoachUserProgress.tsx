// src/pages/coach/CoachUserProgress.tsx
// Coach's read-only view of a client's progress + adherence (?user=<id>).

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, TrendingDown, TrendingUp, Minus, Dumbbell, Utensils } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { fetchCoachUserProgressThunk } from "@/features/coach/coachSlice";

export function CoachUserProgress() {
  const [searchParams] = useSearchParams();
  const dispatch       = useAppDispatch();
  const userId         = searchParams.get("user") ?? "";

  const { users, selectedUserProgress: p } = useAppSelector((s) => s.coach);
  const userName = users.find((u) => u.id === userId)?.name ?? "المستخدم";

  useEffect(() => {
    if (userId) dispatch(fetchCoachUserProgressThunk(userId));
  }, [userId, dispatch]);

  if (!p) {
    return (
      <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
    );
  }

  const delta = p.startWeight != null && p.latestWeight != null ? p.latestWeight - p.startWeight : null;
  const workoutPct = p.workout.total > 0 ? Math.round((p.workout.done / p.workout.total) * 100) : 0;

  return (
    <div>
      {/* رأس الصفحة */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Coach Portal</p>
        <h1 className="mt-1 text-2xl font-black">تقدم — {userName}</h1>
        <p className="mt-1 text-sm text-slate-500">نظرة على وزن المتدرب والتزامه بالخطة</p>
      </div>

      {/* بطاقات الملخص */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* الوزن */}
        <div className="card">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-slate-500">الوزن الحالي</p>
            {delta != null && (
              <span className={`flex items-center gap-1 text-xs font-bold ${
                delta < 0 ? "text-accent" : delta > 0 ? "text-brand-orange" : "text-slate-400"
              }`}>
                {delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                {delta > 0 ? "+" : ""}{delta.toFixed(1)} كغ
              </span>
            )}
          </div>
          <p className="text-3xl font-black text-white">{p.latestWeight ?? "—"}<span className="text-base font-normal text-slate-500"> كغ</span></p>
          {p.startWeight != null && <p className="mt-1 text-xs text-slate-600">البداية: {p.startWeight} كغ</p>}
        </div>

        {/* التزام التمارين */}
        <div className="card">
          <div className="mb-2 flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-accent" />
            <p className="text-xs text-slate-500">التزام التمارين</p>
          </div>
          <p className="text-3xl font-black text-white">{p.workout.done}<span className="text-base font-normal text-slate-500"> / {p.workout.total}</span></p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${workoutPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">{workoutPct}% من التمارين مكتملة</p>
        </div>

        {/* التزام التغذية */}
        <div className="card">
          <div className="mb-2 flex items-center gap-2">
            <Utensils className="h-4 w-4 text-brand-blue" />
            <p className="text-xs text-slate-500">تسجيل الوجبات</p>
          </div>
          <p className="text-3xl font-black text-white">{p.mealLogDays}<span className="text-base font-normal text-slate-500"> / 7 أيام</span></p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-blue" style={{ width: `${Math.round((p.mealLogDays / 7) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">سجّل وجباته في {p.mealLogDays} من آخر 7 أيام</p>
        </div>
      </div>

      {/* مخطط الوزن */}
      <div className="card">
        <h3 className="mb-4 font-bold">منحنى الوزن 📉</h3>
        {p.weightHistory.length < 2 ? (
          <div className="flex h-48 items-center justify-center text-center text-sm text-slate-500">
            لا توجد بيانات وزن كافية بعد — يحتاج المتدرب لتسجيل وزنه عدة مرات
          </div>
        ) : (
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={p.weightHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Line type="monotone" dataKey="weight" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3, fill: "#34d399" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
