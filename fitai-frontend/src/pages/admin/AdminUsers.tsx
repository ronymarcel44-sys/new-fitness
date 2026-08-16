// src/pages/admin/AdminUsers.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { updateUserStatusThunk, updateUserPlanThunk, setSelectedUser, deleteUserThunk } from "@/features/admin/adminSlice";
import { Modal } from "@/components/ui/Modal";
import type { AdminUser, UserStatus, UserPlan } from "@/types";

type FilterPlan   = "all" | UserPlan;
type FilterStatus = "all" | UserStatus;

export function AdminUsers() {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const { users } = useAppSelector((s) => s.admin);

  const [search,       setSearch]       = useState("");
  const [filterPlan,   setFilterPlan]   = useState<FilterPlan>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const filtered = users.filter((u) => {
    const matchSearch = u.name.includes(search) || u.email.includes(search);
    const matchPlan   = filterPlan   === "all" || u.plan   === filterPlan;
    const matchStatus = filterStatus === "all" || u.status === filterStatus;
    return matchSearch && matchPlan && matchStatus;
  });

  const handleView = (user: AdminUser) => {
    dispatch(setSelectedUser(user.id));
    navigate(`/admin/users/${user.id}`);
  };

  const handleToggleStatus = (user: AdminUser) => {
    dispatch(updateUserStatusThunk({ id: user.id, status: user.status === "active" ? "disabled" : "active" }));
  };

  const handleTogglePlan = (user: AdminUser) => {
    dispatch(updateUserPlanThunk({ id: user.id, plan: user.plan === "free" ? "premium" : "free" }));
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      dispatch(deleteUserThunk(deleteTarget.id));
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white">المستخدمون</h1>
        <p className="text-slate-400 mt-1">{users.length} مستخدم مسجّل</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="🔍 ابحث بالاسم أو الإيميل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-card border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 flex-1 min-w-48"
        />
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value as FilterPlan)}
          className="bg-bg-card border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50">
          <option value="all">كل الباقات</option>
          <option value="free">مجاني</option>
          <option value="premium">بريميوم</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="bg-bg-card border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50">
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="disabled">موقوف</option>
        </select>
      </div>

      {/* Table (desktop) + Card list (mobile) */}
      <div className="rounded-2xl border border-white/10">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {['المستخدم','الإيميل','الباقة','الحالة','السلسلة','آخر نشاط','إجراءات'].map((h) => (
                  <th key={h} className="text-right p-4 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-8 text-slate-500">لا توجد نتائج</td></tr>
              ) : filtered.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                        {user.name.charAt(0)}
                      </div>
                      <span className="text-white font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">{user.email}</td>
                  <td className="p-4">
                    <button onClick={() => handleTogglePlan(user)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                        user.plan === 'premium' ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}>
                      {user.plan === 'premium' ? '💎 بريميوم' : 'مجاني'}
                    </button>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      user.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {user.status === 'active' ? '● نشط' : '● موقوف'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">🔥 {user.streak} يوم</td>
                  <td className="p-4 text-slate-500">{user.lastActive}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleView(user)} className="text-xs bg-accent/10 hover:bg-accent/20 text-accent px-3 py-1.5 rounded-lg transition-colors">عرض</button>
                      <button onClick={() => handleToggleStatus(user)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          user.status === 'active' ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'
                        }`}>
                        {user.status === 'active' ? 'إيقاف' : 'تفعيل'}
                      </button>
                      <button onClick={() => setDeleteTarget(user)} className="text-xs bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-3 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center p-6 text-slate-500">لا توجد نتائج</div>
          ) : filtered.map((user) => (
            <div key={user.id} className="bg-bg-card/40 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">{user.name.charAt(0)}</div>
                  <div>
                    <div className="text-white font-medium">{user.name}</div>
                    <div className="text-slate-400 text-sm">{user.email}</div>
                  </div>
                </div>
                <div className="text-slate-300 text-sm">{user.lastActive}</div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => handleTogglePlan(user)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    user.plan === 'premium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                  {user.plan === 'premium' ? '💎 بريميوم' : 'مجاني'}
                </button>

                <span className={`text-xs px-3 py-1 rounded-full ${user.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {user.status === 'active' ? '● نشط' : '● موقوف'}
                </span>

                <span className="text-xs px-3 py-1 rounded-full text-slate-300">🔥 {user.streak} يوم</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => handleView(user)} className="flex-1 text-sm bg-accent/10 hover:bg-accent/20 text-accent px-3 py-2 rounded-lg">عرض</button>
                <button onClick={() => handleToggleStatus(user)} className={`flex-1 text-sm px-3 py-2 rounded-lg ${user.status === 'active' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>{user.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
                <button onClick={() => setDeleteTarget(user)} className="flex-1 text-sm bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 px-3 py-2 rounded-lg">حذف</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="تأكيد الحذف"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors text-sm">إلغاء</button>
            <button onClick={handleConfirmDelete} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-medium">حذف نهائياً</button>
          </>
        }
      >
        <p className="text-slate-300">هل أنت متأكد من حذف المستخدم <span className="text-white font-bold">{deleteTarget?.name}</span>؟ هذا الإجراء لا يمكن التراجع عنه.</p>
      </Modal>
    </div>
  );
}
