// src/pages/admin/AdminDashboard.tsx

import { useAppSelector } from "@/app/hooks";
import { StatCard } from "@/components/ui/StatCard";
import { useNavigate } from "react-router-dom";

export function AdminDashboard() {
  const { stats, users } = useAppSelector((s) => s.admin);
  const navigate = useNavigate();

  const premiumPct = Math.round((stats.premiumUsers / stats.totalUsers) * 100);
  const activePct  = Math.round((stats.activeToday / stats.totalUsers) * 100);

  const recentUsers = [...users]
    .sort((a, b) => b.lastActive.localeCompare(a.lastActive))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white">لوحة التحكم</h1>
        <p className="text-slate-400 mt-1">مرحباً — إليك نظرة عامة على النظام</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="إجمالي المستخدمين"    value={stats.totalUsers}          icon="👥" color="#00E5A0" trend={{ value: 12, label: "هذا الشهر" }} />
        <StatCard label="نشطون اليوم"           value={stats.activeToday}         icon="🟢" color="#3B82F6" trend={{ value: activePct, label: "من الإجمالي" }} />
        <StatCard label="مشتركون بريميوم"       value={stats.premiumUsers}        icon="💎" color="#F59E0B" trend={{ value: premiumPct, label: "نسبة التحويل" }} />
        <StatCard label="خطط تدريب مُنشأة"      value={stats.totalPlansGenerated} icon="📋" color="#8B5CF6" />
        <StatCard label="استدعاءات AI اليوم"    value={stats.aiCallsToday}        icon="🤖" color="#EC4899" />
        <StatCard label="استدعاءات AI الشهر"    value={stats.aiCallsThisMonth}    icon="📈" color="#F97316" />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent active users */}
        <div className="bg-bg-card rounded-2xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">آخر المستخدمين نشاطاً</h2>
            <button onClick={() => navigate("/admin/users")} className="text-xs text-accent hover:underline">عرض الكل</button>
          </div>
          <div className="flex flex-col gap-3">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.lastActive}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.plan === "premium" ? "bg-yellow-500/20 text-yellow-400" : "bg-slate-700 text-slate-400"}`}>
                  {u.plan === "premium" ? "بريميوم" : "مجاني"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="bg-bg-card rounded-2xl p-5 border border-white/5">
          <h2 className="font-bold text-white mb-4">إحصائيات سريعة</h2>
          <div className="flex flex-col gap-4">
            {[
              { label: "معدل التحويل للبريميوم", pct: premiumPct, color: "#F59E0B" },
              { label: "المستخدمون النشطون اليوم", pct: activePct, color: "#3B82F6" },
              { label: "لديهم خطة تدريب", pct: Math.round((users.filter(u => u.hasWorkoutPlan).length / users.length) * 100), color: "#00E5A0" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-white font-bold">{item.pct}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <button onClick={() => navigate("/admin/users")} className="bg-accent/10 hover:bg-accent/20 text-accent rounded-xl py-2 text-sm font-medium transition-colors">إدارة المستخدمين</button>
          </div>
        </div>
      </div>
    </div>
  );
}
