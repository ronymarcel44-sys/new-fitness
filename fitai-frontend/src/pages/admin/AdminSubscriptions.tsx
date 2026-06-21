// src/pages/admin/AdminSubscriptions.tsx

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { updateUserPlanThunk } from "@/features/admin/adminSlice";
import type { AdminUser } from "@/types";

export function AdminSubscriptions() {
  const dispatch = useAppDispatch();
  const { users, stats } = useAppSelector((s) => s.admin);

  const premiumUsers = users.filter((u) => u.plan === "premium");
  const freeUsers    = users.filter((u) => u.plan === "free");
  const premiumPct   = Math.round((stats.premiumUsers / stats.totalUsers) * 100);

  const handleToggle = (user: AdminUser) => {
    dispatch(updateUserPlanThunk({ id: user.id, plan: user.plan === "free" ? "premium" : "free" }));
  };

  const UserRow = ({ user }: { user: AdminUser }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
          {user.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm text-white font-medium">{user.name}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
      </div>
      <button onClick={() => handleToggle(user)}
        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
          user.plan === "premium"
            ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
            : "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400"
        }`}>
        {user.plan === "premium" ? "⬇️ تخفيض" : "⬆️ ترقية"}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-white">الاشتراكات</h1>
        <p className="text-slate-400 mt-1">إدارة باقات المستخدمين</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-bg-card rounded-2xl border border-white/5 p-5 text-center">
          <p className="text-4xl font-black text-accent">{stats.premiumUsers}</p>
          <p className="text-slate-400 text-sm mt-1">مشترك بريميوم</p>
        </div>
        <div className="bg-bg-card rounded-2xl border border-white/5 p-5 text-center">
          <p className="text-4xl font-black text-slate-300">{stats.totalUsers - stats.premiumUsers}</p>
          <p className="text-slate-400 text-sm mt-1">مستخدم مجاني</p>
        </div>
        <div className="bg-bg-card rounded-2xl border border-white/5 p-5 text-center">
          <p className="text-4xl font-black text-yellow-400">{premiumPct}%</p>
          <p className="text-slate-400 text-sm mt-1">معدل التحويل</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-bg-card rounded-2xl border border-white/5 p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">نسبة البريميوم</span>
          <span className="text-yellow-400 font-bold">{premiumPct}%</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-l from-yellow-400 to-yellow-600 rounded-full transition-all" style={{ width: `${premiumPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-2">
          <span>مجاني</span>
          <span>بريميوم</span>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-card rounded-2xl border border-white/5 p-5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <span>💎</span> مشتركو البريميوم ({premiumUsers.length})
          </h2>
          {premiumUsers.length === 0
            ? <p className="text-slate-500 text-sm">لا يوجد</p>
            : premiumUsers.map((u) => <UserRow key={u.id} user={u} />)
          }
        </div>
        <div className="bg-bg-card rounded-2xl border border-white/5 p-5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <span>🆓</span> المستخدمون المجانيون ({freeUsers.length})
          </h2>
          {freeUsers.length === 0
            ? <p className="text-slate-500 text-sm">لا يوجد</p>
            : freeUsers.map((u) => <UserRow key={u.id} user={u} />)
          }
        </div>
      </div>
    </div>
  );
}
