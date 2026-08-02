// src/pages/admin/AdminCoaches.tsx

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addCoachThunk, updateCoachStatusThunk } from "@/features/admin/adminSlice";
import { Modal } from "@/components/ui/Modal";
import type { Coach, CoachSpecialty } from "@/types";

const SPECIALTIES: CoachSpecialty[] = ["قوة عضلية", "تخسيس", "لياقة عامة"];

const EMPTY_FORM = { name: "", email: "", specialty: SPECIALTIES[0] as CoachSpecialty, status: "active" as Coach["status"] };

export function AdminCoaches() {
  const dispatch = useAppDispatch();
  const { coaches, users } = useAppSelector((s) => s.admin);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!form.name || !form.email) { setError("يرجى تعبئة جميع الحقول"); return; }
    dispatch(addCoachThunk(form));
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const SPECIALTY_COLORS: Record<CoachSpecialty, string> = {
    "قوة عضلية":  "bg-blue-500/10 text-blue-400",
    "تخسيس":      "bg-orange-500/10 text-orange-400",
    "لياقة عامة": "bg-purple-500/10 text-purple-400",
  };

  const STATUS_BADGE: Record<Coach["status"], { label: string; cls: string }> = {
    pending:  { label: "● قيد المراجعة", cls: "bg-amber-500/20 text-amber-400" },
    active:   { label: "● نشط",          cls: "bg-green-500/20 text-green-400" },
    inactive: { label: "● غير نشط",      cls: "bg-slate-700 text-slate-500"   },
    rejected: { label: "● مرفوض",        cls: "bg-red-500/20 text-red-400"     },
  };

  const setStatus = (id: string, status: Coach["status"]) =>
    dispatch(updateCoachStatusThunk({ id, status }));

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">المدربون</h1>
          <p className="text-slate-400 mt-1">{coaches.length} مدرب</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="bg-accent hover:bg-accent/80 text-bg font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">+ إضافة مدرب</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coaches.map((coach) => {
          const assignedNames = coach.assignedUsers.map((uid) => users.find((u) => u.id === uid)?.name).filter(Boolean);
          return (
            <div key={coach.id} className="bg-bg-card rounded-2xl border border-white/5 p-5 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-lg font-black text-accent">
                  {coach.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{coach.name}</p>
                  <p className="text-xs text-slate-500 truncate">{coach.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[coach.status].cls}`}>
                  {STATUS_BADGE[coach.status].label}
                </span>
              </div>

              {/* Specialty */}
              <span className={`text-xs px-3 py-1 rounded-full w-fit font-medium ${SPECIALTY_COLORS[coach.specialty]}`}>
                {coach.specialty}
              </span>

              {/* Verification credentials (self-registered coaches) */}
              {((coach.certifications && coach.certifications.length > 0) || coach.certification || coach.bio || coach.yearsExperience != null) && (
                <div className="rounded-xl border border-white/5 bg-bg p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-400">بيانات التحقق</p>
                  {coach.certifications && coach.certifications.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-slate-500">الشهادات:</span>
                      {coach.certifications.map((c, i) => (
                        <p key={i} className="text-slate-300">
                          • {c.typeOther || c.type} <span className="text-slate-500">— رقم:</span> {c.number}
                        </p>
                      ))}
                    </div>
                  ) : coach.certification && (
                    <p className="text-slate-300"><span className="text-slate-500">الشهادة: </span>{coach.certification}</p>
                  )}
                  {coach.yearsExperience != null && (
                    <p className="text-slate-300"><span className="text-slate-500">الخبرة: </span>{coach.yearsExperience} سنوات</p>
                  )}
                  {coach.bio && <p className="text-slate-400 leading-relaxed">{coach.bio}</p>}
                </div>
              )}

              {/* Assigned users */}
              <div>
                <p className="text-xs text-slate-500 mb-2">المستخدمون المعيّنون ({assignedNames.length})</p>
                {assignedNames.length === 0
                  ? <p className="text-xs text-slate-600">لا يوجد مستخدمون</p>
                  : <div className="flex flex-wrap gap-1">
                      {assignedNames.map((name) => (
                        <span key={name} className="text-xs bg-white/5 text-slate-400 px-2 py-0.5 rounded-full">{name}</span>
                      ))}
                    </div>
                }
              </div>

              {/* Action — depends on verification status */}
              <div className="mt-auto flex gap-2">
                {coach.status === "pending" || coach.status === "rejected" ? (
                  <>
                    <button
                      onClick={() => setStatus(coach.id, "active")}
                      className="flex-1 text-sm py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                    >
                      قبول
                    </button>
                    {coach.status === "pending" && (
                      <button
                        onClick={() => setStatus(coach.id, "rejected")}
                        className="flex-1 text-sm py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      >
                        رفض
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setStatus(coach.id, coach.status === "active" ? "inactive" : "active")}
                    className={`w-full text-sm py-2 rounded-xl transition-colors ${
                      coach.status === "active"
                        ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
                        : "bg-green-500/10 hover:bg-green-500/20 text-green-400"
                    }`}
                  >
                    {coach.status === "active" ? "إيقاف" : "تفعيل"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setError(""); }} title="إضافة مدرب جديد"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 text-sm">إلغاء</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-bg font-bold text-sm">إضافة</button>
          </>
        }>
        <div className="flex flex-col gap-3">
          {error && <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          {[
            { label: "الاسم *", key: "name", placeholder: "اسم المدرب" },
            { label: "الإيميل *", key: "email", placeholder: "coach@example.com" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-1 block">{label}</label>
              <input value={(form as Record<string, string>)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 placeholder-slate-600" />
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">التخصص</label>
            <select value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value as CoachSpecialty }))}
              className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
