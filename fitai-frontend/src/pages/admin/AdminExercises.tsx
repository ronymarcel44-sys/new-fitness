// src/pages/admin/AdminExercises.tsx

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addExerciseThunk, updateExerciseThunk, deleteExerciseThunk } from "@/features/admin/adminSlice";
import { Modal } from "@/components/ui/Modal";
import type { AdminExercise } from "@/types";

const MUSCLE_GROUPS = ["صدر","ظهر","أرجل","أكتاف","بايسبس","ترايسبس","بطن","كارديو"];
const LEVELS = ["مبتدئ","متوسط","متقدم"] as const;

const EMPTY_FORM: Omit<AdminExercise, "id"> = {
  nameAr: "", nameEn: "", muscleGroup: MUSCLE_GROUPS[0],
  level: "مبتدئ", equipment: "", description: "",
};

export function AdminExercises() {
  const dispatch = useAppDispatch();
  const { exercises } = useAppSelector((s) => s.admin);

  const [filterGroup, setFilterGroup] = useState("all");
  const [search,      setSearch]      = useState("");
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<AdminExercise | null>(null);
  const [form,        setForm]        = useState<Omit<AdminExercise, "id">>(EMPTY_FORM);
  const [deleteTarget,setDeleteTarget]= useState<AdminExercise | null>(null);

  const filtered = exercises.filter((e) => {
    const matchGroup = filterGroup === "all" || e.muscleGroup === filterGroup;
    const matchSearch = e.nameAr.includes(search) || e.nameEn.toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchSearch;
  });

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (ex: AdminExercise) => { setEditTarget(ex); setForm({ nameAr: ex.nameAr, nameEn: ex.nameEn, muscleGroup: ex.muscleGroup, level: ex.level, equipment: ex.equipment, description: ex.description }); setModalOpen(true); };

  const handleSave = () => {
    if (!form.nameAr || !form.nameEn) return;
    if (editTarget) {
      dispatch(updateExerciseThunk({ ...form, id: editTarget.id }));
    } else {
      dispatch(addExerciseThunk(form));
    }
    setModalOpen(false);
  };

  const LEVEL_COLORS: Record<string, string> = { "مبتدئ": "text-green-400 bg-green-500/10", "متوسط": "text-yellow-400 bg-yellow-500/10", "متقدم": "text-red-400 bg-red-500/10" };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">مكتبة التمارين</h1>
          <p className="text-slate-400 mt-1">{exercises.length} تمرين</p>
        </div>
        <button onClick={openAdd} className="bg-accent hover:bg-accent/80 text-bg font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">+ إضافة تمرين</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="🔍 بحث..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-card border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 flex-1 min-w-48" />
        <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}
          className="bg-bg-card border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none">
          <option value="all">كل العضلات</option>
          {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {["الاسم بالعربي","الاسم بالإنجليزي","المجموعة العضلية","المستوى","المعدات","إجراءات"].map((h) => (
                <th key={h} className="text-right p-4 text-slate-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ex) => (
              <tr key={ex.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-medium">{ex.nameAr}</td>
                <td className="p-4 text-slate-400 font-mono text-xs">{ex.nameEn}</td>
                <td className="p-4"><span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">{ex.muscleGroup}</span></td>
                <td className="p-4"><span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_COLORS[ex.level]}`}>{ex.level}</span></td>
                <td className="p-4 text-slate-400">{ex.equipment}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(ex)} className="text-xs bg-accent/10 hover:bg-accent/20 text-accent px-3 py-1.5 rounded-lg transition-colors">تعديل</button>
                    <button onClick={() => setDeleteTarget(ex)} className="text-xs bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "تعديل تمرين" : "إضافة تمرين جديد"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 text-sm transition-colors">إلغاء</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-bg font-bold text-sm transition-colors">حفظ</button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {[
            { label: "الاسم بالعربي *", key: "nameAr", placeholder: "مثل: بنش برس" },
            { label: "الاسم بالإنجليزي *", key: "nameEn", placeholder: "Bench Press" },
            { label: "المعدات", key: "equipment", placeholder: "بار، دمبل، وزن الجسم..." },
            { label: "الوصف", key: "description", placeholder: "وصف مختصر للتمرين" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-1 block">{label}</label>
              <input value={(form as Record<string, string>)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 placeholder-slate-600" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">المجموعة العضلية</label>
              <select value={form.muscleGroup} onChange={(e) => setForm((f) => ({ ...f, muscleGroup: e.target.value }))}
                className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
                {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">المستوى</label>
              <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as AdminExercise["level"] }))}
                className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="تأكيد الحذف"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 text-sm">إلغاء</button>
            <button onClick={() => { if (deleteTarget) { dispatch(deleteExerciseThunk(deleteTarget.id)); setDeleteTarget(null); } }}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium">حذف</button>
          </>
        }>
        <p className="text-slate-300">هل تريد حذف تمرين <span className="text-white font-bold">{deleteTarget?.nameAr}</span>؟</p>
      </Modal>
    </div>
  );
}
