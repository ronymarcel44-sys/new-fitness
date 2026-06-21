// src/pages/admin/AdminUserDetail.tsx

import { useParams, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { assignCoachThunk, updateUserPlanThunk, updateUserStatusThunk } from "@/features/admin/adminSlice";

export function AdminUserDetail() {
  const { id }   = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { users, coaches } = useAppSelector((s) => s.admin);

  const user  = users.find((u) => u.id === id);
  const coach = coaches.find((c) => c.id === user?.coachId);

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4" dir="rtl">
      <p className="text-slate-400">المستخدم غير موجود</p>
      <button onClick={() => navigate("/admin/users")} className="text-accent hover:underline text-sm">العودة للقائمة</button>
    </div>
  );

  const DETAIL_ROWS = [
    { label: "الاسم",        value: user.name },
    { label: "الإيميل",      value: user.email },
    { label: "الدور",        value: user.role },
    { label: "تاريخ الانضمام", value: user.joinedAt },
    { label: "آخر نشاط",    value: user.lastActive },
    { label: "لديه خطة تدريب", value: user.hasWorkoutPlan ? "✅ نعم" : "❌ لا" },
    { label: "السلسلة",      value: `🔥 ${user.streak} يوم` },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl" dir="rtl">
      {/* Back */}
      <button onClick={() => navigate("/admin/users")} className="text-accent hover:underline text-sm w-fit">← العودة للمستخدمين</button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-2xl font-black text-accent">
          {user.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">{user.name}</h1>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${user.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {user.status === "active" ? "● نشط" : "● موقوف"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${user.plan === "premium" ? "bg-yellow-500/20 text-yellow-400" : "bg-slate-700 text-slate-400"}`}>
              {user.plan === "premium" ? "💎 بريميوم" : "مجاني"}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-bg-card rounded-2xl border border-white/5 divide-y divide-white/5">
        {DETAIL_ROWS.map((row) => (
          <div key={row.label} className="flex justify-between p-4">
            <span className="text-slate-500 text-sm">{row.label}</span>
            <span className="text-white text-sm font-medium">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Assign Coach */}
        <div className="bg-bg-card rounded-2xl border border-white/5 p-5">
          <h3 className="font-bold text-white mb-3">تعيين مدرب</h3>
          <p className="text-xs text-slate-500 mb-3">المدرب الحالي: <span className="text-slate-300">{coach?.name ?? "لا يوجد"}</span></p>
          <select
            value={user.coachId ?? ""}
            onChange={(e) => dispatch(assignCoachThunk({ userId: user.id, coachId: e.target.value }))}
            className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
          >
            <option value="">بدون مدرب</option>
            {coaches.filter((c) => c.status === "active").map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.specialty}</option>
            ))}
          </select>
        </div>

        {/* Quick actions */}
        <div className="bg-bg-card rounded-2xl border border-white/5 p-5">
          <h3 className="font-bold text-white mb-3">إجراءات سريعة</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => dispatch(updateUserPlanThunk({ id: user.id, plan: user.plan === "free" ? "premium" : "free" }))}
              className="w-full text-sm py-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 transition-colors"
            >
              {user.plan === "free" ? "⬆️ ترقية للبريميوم" : "⬇️ تخفيض للمجاني"}
            </button>
            <button
              onClick={() => dispatch(updateUserStatusThunk({ id: user.id, status: user.status === "active" ? "disabled" : "active" }))}
              className={`w-full text-sm py-2 rounded-xl transition-colors ${
                user.status === "active"
                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
                  : "bg-green-500/10 hover:bg-green-500/20 text-green-400"
              }`}
            >
              {user.status === "active" ? "🚫 إيقاف الحساب" : "✅ تفعيل الحساب"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
