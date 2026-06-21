// src/pages/coach/CoachUserWorkout.tsx
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Save, X, MessageSquarePlus, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  fetchCoachUserWorkoutThunk,
  fetchExerciseNotesThunk,
  saveExerciseNoteThunk,
  removeExerciseNoteThunk,
  updateCoachExerciseThunk,
} from "@/features/coach/coachSlice";
import { DAYS_ORDER, type DayName } from "@/types";
import { cn } from "@/lib/utils";

// Shape of an exercise row as returned by GET /coach/users/:id/workout
interface BackendExercise {
  id:          string;
  dayOfWeek:   string;
  nameAr:      string;
  nameEn:      string;
  sets:        string;
  reps:        string;
  weight:      string | null;
  restSeconds: number;
  muscleGroup: string;
  focus:       string | null;
  coachEdited: boolean;
}

export function CoachUserWorkout() {
  const [searchParams] = useSearchParams();
  const dispatch       = useAppDispatch();
  const userId         = searchParams.get("user") ?? "";

  const { users, selectedUserWorkout, exerciseNotes, isLoading } = useAppSelector((s) => s.coach);
  const userName = users.find((u) => u.id === userId)?.name ?? "المستخدم";

  const [selectedDay, setSelectedDay] = useState<DayName>(DAYS_ORDER[new Date().getDay()]);
  const [noteInputs, setNoteInputs]   = useState<Record<string, string>>({});
  const [expandedEx, setExpandedEx]   = useState<string | null>(null);
  const [editInputs, setEditInputs]   = useState<Record<string, { sets: string; reps: string; weight: string; rest: string }>>({});

  // Load this client's real plan + the coach's existing notes for them
  useEffect(() => {
    if (userId) {
      dispatch(fetchCoachUserWorkoutThunk(userId));
      dispatch(fetchExerciseNotesThunk(userId));
    }
  }, [userId, dispatch]);

  const exercises: BackendExercise[] = selectedUserWorkout?.exercises ?? [];

  // Group exercises by day; a day with no exercises is treated as a rest day
  const byDay = useMemo(() => {
    const map: Record<string, BackendExercise[]> = {};
    for (const ex of exercises) (map[ex.dayOfWeek] ??= []).push(ex);
    return map;
  }, [exercises]);

  const dayExercises = byDay[selectedDay] ?? [];
  const dayFocus     = dayExercises[0]?.focus;

  const getNoteFor = (exerciseId: string) =>
    (exerciseNotes[userId] || []).find((n) => n.exerciseId === exerciseId)?.noteText ?? "";

  const handleSaveNote = (exerciseId: string) => {
    const note = noteInputs[exerciseId]?.trim();
    if (!note) return;
    dispatch(saveExerciseNoteThunk({ exerciseId, userId, noteText: note }));
    setNoteInputs((prev) => ({ ...prev, [exerciseId]: "" }));
  };

  const handleRemoveNote = (exerciseId: string) => {
    const note = (exerciseNotes[userId] || []).find((n) => n.exerciseId === exerciseId);
    if (!note) return;
    dispatch(removeExerciseNoteThunk({ userId, noteId: note.id }));
  };

  // Edit form — current values come from the exercise unless the coach changed a field
  const editFor = (ex: BackendExercise) =>
    editInputs[ex.id] ?? { sets: ex.sets, reps: ex.reps, weight: ex.weight ?? "", rest: String(ex.restSeconds ?? 60) };

  const setEditField = (id: string, field: "sets" | "reps" | "weight" | "rest", value: string, ex: BackendExercise) =>
    setEditInputs((prev) => ({ ...prev, [id]: { ...editFor(ex), ...prev[id], [field]: value } }));

  const handleSaveEdit = (ex: BackendExercise) => {
    const e = editFor(ex);
    dispatch(updateCoachExerciseThunk({
      userId,
      exerciseId: ex.id,
      data: { sets: e.sets, reps: e.reps, weight: e.weight, restSeconds: Number(e.rest) || 60 },
    }));
    setEditInputs((prev) => { const next = { ...prev }; delete next[ex.id]; return next; });
  };

  return (
    <div>
      {/* رأس الصفحة */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Coach Portal</p>
        <h1 className="mt-1 text-2xl font-black">خطة تمارين — {userName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          يمكنك مراجعة الخطة وترك ملاحظات على كل تمرين
        </p>
      </div>

      {isLoading && !selectedUserWorkout ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : !selectedUserWorkout ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 text-5xl">📋</span>
          <p className="text-slate-400">هذا المستخدم لم يُنشئ خطة تمارين بعد</p>
        </div>
      ) : (
        <>
          {/* تبويبات الأيام */}
          <div className="mb-5 flex flex-wrap gap-2">
            {DAYS_ORDER.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                  selectedDay === day
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                )}
              >
                {day}
                {(byDay[day]?.length ?? 0) === 0 && <span className="mr-1 text-slate-600">🛌</span>}
              </button>
            ))}
          </div>

          {/* محتوى اليوم */}
          {dayExercises.length === 0 ? (
            <div className="card flex flex-col items-center py-12 text-center">
              <span className="mb-3 text-5xl">🛌</span>
              <p className="font-semibold text-slate-300">يوم راحة</p>
              <p className="mt-1 text-xs text-slate-500">لا تمارين مجدولة في هذا اليوم</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayFocus && (
                <p className="mb-4 text-sm text-slate-400">
                  التركيز: <span className="font-semibold text-white">{dayFocus}</span>
                </p>
              )}

              {dayExercises.map((ex) => {
                const existingNote = getNoteFor(ex.id);
                const isExpanded   = expandedEx === ex.id;

                return (
                  <div key={ex.id} className="card">
                    {/* معلومات التمرين */}
                    <div
                      className="flex cursor-pointer items-start justify-between"
                      onClick={() => setExpandedEx(isExpanded ? null : ex.id)}
                    >
                      <div>
                        <p className="font-bold text-white">
                          {ex.nameAr}
                          {ex.coachEdited && <span className="mr-2 text-xs font-normal text-brand-purple">✨ معدّلة</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ex.nameEn} · {ex.muscleGroup} · {ex.sets} سيت × {ex.reps}
                        </p>
                        {ex.weight && <p className="mt-0.5 text-xs text-accent">{ex.weight}</p>}
                        {existingNote && !isExpanded && (
                          <p className="mt-1 text-xs text-brand-purple">
                            💬 {existingNote.slice(0, 60)}{existingNote.length > 60 ? "..." : ""}
                          </p>
                        )}
                      </div>
                      <button className="text-slate-600 hover:text-slate-300">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* قسم التعديل + الملاحظة — يظهر عند التوسيع */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        {/* تعديل تفاصيل التمرين */}
                        <p className="mb-2 text-xs font-semibold text-slate-300">✏️ تعديل التمرين</p>
                        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {([
                            ["sets",   "سيتات"],
                            ["reps",   "تكرارات"],
                            ["weight", "الوزن"],
                            ["rest",   "راحة (ث)"],
                          ] as const).map(([field, label]) => (
                            <div key={field}>
                              <label className="mb-1 block text-[10px] text-slate-500">{label}</label>
                              <input
                                type={field === "rest" ? "number" : "text"}
                                value={editFor(ex)[field]}
                                onChange={(e) => setEditField(ex.id, field, e.target.value, ex)}
                                className="input-base w-full py-1.5 text-sm"
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleSaveEdit(ex)}
                          className="mb-4 flex items-center gap-1.5 rounded-xl border border-brand-purple/30 bg-brand-purple/10 px-3 py-1.5 text-xs font-bold text-brand-purple transition-all hover:bg-brand-purple/20"
                        >
                          <Save className="h-3.5 w-3.5" /> حفظ التعديلات
                        </button>

                        <div className="mb-2 flex items-center gap-2 border-t border-white/10 pt-4">
                          <MessageSquarePlus className="h-4 w-4 text-brand-purple" />
                          <p className="text-xs font-semibold text-slate-300">ملاحظة المدرب</p>
                        </div>

                        {existingNote && (
                          <div className="mb-3 flex items-start justify-between rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-3 py-2">
                            <p className="text-sm text-slate-300 leading-relaxed">{existingNote}</p>
                            <button
                              onClick={() => handleRemoveNote(ex.id)}
                              className="mr-3 shrink-0 text-slate-600 hover:text-red-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={noteInputs[ex.id] ?? ""}
                            onChange={(e) => setNoteInputs((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                            placeholder={existingNote ? "تعديل الملاحظة..." : "اكتب ملاحظة للمستخدم..."}
                            className="input-base flex-1 py-2 text-sm"
                          />
                          <button
                            onClick={() => handleSaveNote(ex.id)}
                            disabled={!noteInputs[ex.id]?.trim()}
                            className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-all hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Save className="h-3.5 w-3.5" />
                            حفظ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
