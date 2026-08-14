// src/pages/coach/CoachUserNutrition.tsx
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Save, X, MessageSquarePlus, ChevronDown, ChevronUp, Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  fetchCoachUserNutritionThunk,
  fetchMealNotesThunk,
  saveMealNoteThunk,
  removeMealNoteThunk,
  updateCoachMealThunk,
  addCoachMealThunk,
  removeCoachMealThunk,
} from "@/features/coach/coachSlice";
import { apiRequest } from "@/lib/api";
/////////////////////no edit
// Shape of a meal row as returned by GET /coach/users/:id/nutrition
interface BackendMeal {
  id:          string;
  mealName:    string;
  mealType:    string;
  dayOfWeek:   string | null;
  mealTime:    string;
  calories:    number;
  proteinG:    number;
  carbsG:      number;
  fatG:        number;
  items:       string[];
  emoji:       string | null;
  coachEdited: boolean;
}

interface MealEdit {
  mealName: string; mealTime: string;
  calories: string; proteinG: string; carbsG: string; fatG: string;
  items: string;
}

export function CoachUserNutrition() {
  const [searchParams] = useSearchParams(); 
  const dispatch       = useAppDispatch();
  const userId         = searchParams.get("user") ?? "";

  const { users, selectedUserNutrition, mealNotes, isLoading } = useAppSelector((s) => s.coach);
  const userName = users.find((u) => u.id === userId)?.name ?? "المستخدم";

  const [noteInputs, setNoteInputs]     = useState<Record<string, string>>({});
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [editInputs, setEditInputs]     = useState<Record<string, MealEdit>>({});
  const [editAnalyzingId, setEditAnalyzingId] = useState<string | null>(null);

  // Add-meal form state
  const [showAdd, setShowAdd]   = useState(false);
  const [newMeal, setNewMeal]   = useState({ name: "", time: "", calories: "", proteinG: "", carbsG: "", fatG: "" });
  const [newItems, setNewItems] = useState<string[]>([]);
  const [itemDraft, setItemDraft] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);   // macros come only from AI
  const [saving, setSaving]     = useState(false);
  const [addError, setAddError] = useState("");

  const resetAdd = () => {
    setShowAdd(false);
    setNewMeal({ name: "", time: "", calories: "", proteinG: "", carbsG: "", fatG: "" });
    setNewItems([]);
    setItemDraft("");
    setAnalyzed(false);
    setAddError("");
  };

  const addItem = () => {
    const v = itemDraft.trim();
    if (!v) return;
    setNewItems((prev) => [...prev, v]);
    setItemDraft("");
    setAnalyzed(false);   // ingredients changed → must re-analyze
  };

  const removeItem = (i: number) => {
    setNewItems((prev) => prev.filter((_, idx) => idx !== i));
    setAnalyzed(false);
  };

  // Ask the AI to total the macros of the listed items
  const handleAnalyze = async () => {
    if (newItems.length === 0) { setAddError("أضف مكوّنات الوجبة أولاً"); return; }
    setAnalyzing(true);
    setAddError("");
    try {
      const m = await apiRequest<{ calories: number; protein: number; carbs: number; fat: number }>(
        "POST", "/ai/analyze-full-meal", { items: newItems }
      );
      setNewMeal((prev) => ({
        ...prev,
        calories: String(m.calories), proteinG: String(m.protein),
        carbsG: String(m.carbs), fatG: String(m.fat),
      }));
      setAnalyzed(true);
    } catch {
      setAddError("تعذّر التحليل، حاول مرة أخرى");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddMeal = async () => {
    if (!newMeal.name.trim()) { setAddError("اسم الوجبة مطلوب"); return; }
    if (!analyzed)            { setAddError("حلّل القيم بالـ AI أولاً"); return; }
    setSaving(true);
    setAddError("");
    await dispatch(addCoachMealThunk({
      userId,
      data: {
        mealName: newMeal.name.trim(),
        mealTime: newMeal.time.trim(),
        calories: Number(newMeal.calories) || 0,
        proteinG: Number(newMeal.proteinG) || 0,
        carbsG:   Number(newMeal.carbsG)   || 0,
        fatG:     Number(newMeal.fatG)     || 0,
        items:    newItems,
      },
    }));
    setSaving(false);
    resetAdd();
  };

  const handleDeleteMeal = (mealId: string) => {
    dispatch(removeCoachMealThunk({ userId, mealId }));
  };

  // Load this client's real diet plan + the coach's existing meal notes
  useEffect(() => {
    if (userId) {
      dispatch(fetchCoachUserNutritionThunk(userId));
      dispatch(fetchMealNotesThunk(userId));
    }
  }, [userId, dispatch]);

  const plan  = selectedUserNutrition;
  const meals: BackendMeal[] = plan?.meals ?? [];

  const dayOrder = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const mealTypeOrder = ["breakfast", "lunch", "dinner", "snack", "pre_workout"];

  const groupedMeals = dayOrder.map((day) => ({
    day,
    items: meals
      .filter((meal) => (meal.dayOfWeek ?? "الأحد") === day)
      .sort((a, b) => {
        const aIndex = mealTypeOrder.indexOf(a.mealType || "breakfast");
        const bIndex = mealTypeOrder.indexOf(b.mealType || "breakfast");
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      }),
  })).filter((group) => group.items.length > 0);

  const getNoteFor = (mealId: string) =>
    (mealNotes[userId] || []).find((n) => n.mealId === mealId)?.noteText ?? "";

  const handleSaveNote = (mealId: string) => {
    const note = noteInputs[mealId]?.trim();
    if (!note) return;
    dispatch(saveMealNoteThunk({ mealId, userId, noteText: note }));
    setNoteInputs((prev) => ({ ...prev, [mealId]: "" }));
  };

  const handleRemoveNote = (mealId: string) => {
    const note = (mealNotes[userId] || []).find((n) => n.mealId === mealId);
    if (!note) return;
    dispatch(removeMealNoteThunk({ userId, noteId: note.id }));
  };

  // Edit form — current values come from the meal unless the coach changed a field
  const editFor = (meal: BackendMeal): MealEdit =>
    editInputs[meal.id] ?? {
      mealName: meal.mealName, mealTime: meal.mealTime,
      calories: String(meal.calories), proteinG: String(meal.proteinG),
      carbsG: String(meal.carbsG), fatG: String(meal.fatG),
      items: meal.items.join("، "),
    };

  const setEditField = (meal: BackendMeal, field: keyof MealEdit, value: string) =>
    setEditInputs((prev) => ({ ...prev, [meal.id]: { ...editFor(meal), ...prev[meal.id], [field]: value } }));

  // Re-analyze an edited meal's macros from its (possibly changed) items
  const handleAnalyzeEdit = async (meal: BackendMeal) => {
    const items = editFor(meal).items.split(/[،,\n]/).map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return;
    setEditAnalyzingId(meal.id);
    try {
      const m = await apiRequest<{ calories: number; protein: number; carbs: number; fat: number }>(
        "POST", "/ai/analyze-full-meal", { items }
      );
      setEditInputs((prev) => {
        const base = prev[meal.id] ?? editFor(meal);
        return { ...prev, [meal.id]: { ...base, calories: String(m.calories), proteinG: String(m.protein), carbsG: String(m.carbs), fatG: String(m.fat) } };
      });
    } catch {
      /* leave macros as-is on failure */
    } finally {
      setEditAnalyzingId(null);
    }
  };

  const handleSaveEdit = (meal: BackendMeal) => {
    const e = editFor(meal);
    dispatch(updateCoachMealThunk({
      userId,
      mealId: meal.id,
      data: {
        mealName: e.mealName,
        mealTime: e.mealTime,
        calories: Number(e.calories) || 0,
        proteinG: Number(e.proteinG) || 0,
        carbsG:   Number(e.carbsG)   || 0,
        fatG:     Number(e.fatG)     || 0,
        items:    e.items.split(/[،,\n]/).map((s) => s.trim()).filter(Boolean),
      },
    }));
    setEditInputs((prev) => { const next = { ...prev }; delete next[meal.id]; return next; });
  };

  return (
    <div>
      {/* رأس الصفحة */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Coach Portal</p>
        <h1 className="mt-1 text-2xl font-black">خطة التغذية — {userName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          راجع الخطة الغذائية واترك ملاحظات على كل وجبة
        </p>
      </div>

      {isLoading && !plan ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : !plan ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 text-5xl">🥗</span>
          <p className="text-slate-400">هذا المستخدم لم يُنشئ خطة غذائية بعد</p>
        </div>
      ) : (
        <>
          {/* ملخص الأهداف اليومية */}
          <div className="mb-6 grid grid-cols-4 gap-3">
            {[
              { label: "السعرات",    val: plan.totalCalories, unit: "kcal", color: "text-brand-orange" },
              { label: "بروتين",     val: plan.proteinGrams,  unit: "g",    color: "text-accent"       },
              { label: "كربوهيدرات", val: plan.carbsGrams,    unit: "g",    color: "text-brand-blue"   },
              { label: "دهون",       val: plan.fatGrams,      unit: "g",    color: "text-brand-purple" },
            ].map(({ label, val, unit, color }) => (
              <div key={label} className="card text-center">
                <p className={`text-xl font-black ${color}`}>{val}</p>
                <p className="mt-0.5 text-xs text-slate-500">{unit} {label}</p>
              </div>
            ))}
          </div>

          {/* إضافة وجبة */}
          <div className="mb-4">
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm font-semibold text-accent transition-all hover:bg-accent/10"
              >
                <Plus className="h-4 w-4" /> إضافة وجبة
              </button>
            ) : (
              <div className="card border-accent/30">
                <p className="mb-3 text-sm font-bold text-white">وجبة جديدة 🍽️</p>
                {addError && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{addError}</p>}

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-500">اسم الوجبة</label>
                    <input value={newMeal.name} onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })} placeholder="مثال: وجبة بروتين" className="input-base w-full py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-500">الوقت</label>
                    <input value={newMeal.time} onChange={(e) => setNewMeal({ ...newMeal, time: e.target.value })} placeholder="مثال: 6:00 م" className="input-base w-full py-1.5 text-sm" />
                  </div>
                </div>

                {/* المكونات — واحدة تلو الأخرى */}
                <label className="mb-1 block text-[10px] text-slate-500">المكونات</label>
                <div className="mb-2 flex gap-2">
                  <input
                    value={itemDraft}
                    onChange={(e) => setItemDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
                    placeholder="مثال: صدر دجاج مشوي 200غ"
                    className="input-base flex-1 py-1.5 text-sm"
                  />
                  <button onClick={addItem} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {newItems.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {newItems.map((it, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-lg border border-white/10 bg-bg px-2 py-1 text-xs text-slate-300">
                        {it}
                        <button onClick={() => removeItem(i)} className="text-slate-500 hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* تحليل AI */}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || newItems.length === 0}
                  className="mb-3 flex items-center gap-1.5 rounded-xl border border-brand-purple/30 bg-brand-purple/10 px-3 py-1.5 text-xs font-bold text-brand-purple transition-all hover:bg-brand-purple/20 disabled:opacity-40"
                >
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  تحليل القيم بالـ AI
                </button>

                {/* القيم الغذائية — يحسبها الـ AI فقط (للعرض) */}
                {analyzed ? (
                  <div className="mb-3 grid grid-cols-4 gap-2">
                    {([
                      ["calories", "سعرات",  "text-brand-orange"],
                      ["proteinG", "بروتين", "text-accent"],
                      ["carbsG",   "كارب",   "text-brand-blue"],
                      ["fatG",     "دهون",   "text-brand-purple"],
                    ] as const).map(([field, label, color]) => (
                      <div key={field} className="rounded-xl border border-white/5 bg-bg p-2 text-center">
                        <p className={`text-lg font-black ${color}`}>{newMeal[field] || 0}</p>
                        <p className="text-[10px] text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-3 rounded-xl border border-dashed border-white/10 px-3 py-2 text-center text-xs text-slate-500">
                    القيم الغذائية يحسبها الـ AI من المكوّنات — اضغط «تحليل القيم بالـ AI»
                  </p>
                )}

                <div className="flex gap-2">
                  <button onClick={handleAddMeal} disabled={saving || !analyzed} className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-bg hover:bg-accent/80 disabled:opacity-50">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} حفظ الوجبة
                  </button>
                  <button onClick={resetAdd} className="rounded-xl bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10">إلغاء</button>
                </div>
              </div>
            )}
          </div>

          {/* قائمة الوجبات مجمعة حسب اليوم */}
          <div className="space-y-4">
            {groupedMeals.map(({ day, items }) => (
              <div key={day} className="space-y-3">
                <h3 className="px-1 text-sm font-black text-accent">{day}</h3>

                {items.map((meal) => {
                  const existingNote = getNoteFor(meal.id);
                  const isExpanded = expandedMeal === meal.id;

                  return (
                    <div key={meal.id} className="card">
                      <div
                        className="flex cursor-pointer items-start justify-between"
                        onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{meal.emoji}</span>
                          <div>
                            <p className="font-bold text-white">
                              {meal.mealName}
                              {meal.coachEdited && <span className="mr-2 text-xs font-normal text-brand-purple">✨ معدّلة</span>}
                            </p>
                            <p className="text-xs text-slate-500">
                              {meal.mealType || "meal"} · {meal.mealTime} · {meal.calories} kcal
                            </p>
                            <div className="mt-0.5 flex gap-3 text-xs text-slate-600">
                              <span>بروتين {meal.proteinG}g</span>
                              <span>كارب {meal.carbsG}g</span>
                              <span>دهون {meal.fatG}g</span>
                            </div>
                            {existingNote && !isExpanded && (
                              <p className="mt-1 text-xs text-brand-purple">
                                💬 {existingNote.slice(0, 60)}{existingNote.length > 60 ? "..." : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteMeal(meal.id); }}
                            className="rounded-lg p-1 text-slate-600 transition-colors hover:text-red-400"
                            title="حذف الوجبة"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button className="text-slate-600 hover:text-slate-300">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 border-t border-white/10 pt-4">
                          <p className="mb-2 text-xs font-semibold text-slate-300">✏️ تعديل الوجبة</p>
                          <div className="mb-3 grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] text-slate-500">اسم الوجبة</label>
                              <input value={editFor(meal).mealName} onChange={(e) => setEditField(meal, "mealName", e.target.value)} className="input-base w-full py-1.5 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] text-slate-500">الوقت</label>
                              <input value={editFor(meal).mealTime} onChange={(e) => setEditField(meal, "mealTime", e.target.value)} className="input-base w-full py-1.5 text-sm" />
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="mb-1 block text-[10px] text-slate-500">المكونات (افصل بينها بفاصلة)</label>
                            <textarea value={editFor(meal).items} onChange={(e) => setEditField(meal, "items", e.target.value)} rows={2} className="input-base w-full resize-none py-1.5 text-sm" />
                          </div>
                          <button
                            onClick={() => handleAnalyzeEdit(meal)}
                            disabled={editAnalyzingId === meal.id}
                            className="mb-3 flex items-center gap-1.5 rounded-xl border border-brand-purple/30 bg-brand-purple/10 px-3 py-1.5 text-xs font-bold text-brand-purple transition-all hover:bg-brand-purple/20 disabled:opacity-40"
                          >
                            {editAnalyzingId === meal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            إعادة تحليل القيم بالـ AI
                          </button>
                          <div className="mb-3 grid grid-cols-4 gap-2">
                            {([
                              ["calories", "سعرات",  "text-brand-orange"],
                              ["proteinG", "بروتين", "text-accent"],
                              ["carbsG",   "كارب",   "text-brand-blue"],
                              ["fatG",     "دهون",   "text-brand-purple"],
                            ] as const).map(([field, label, color]) => (
                              <div key={field} className="rounded-xl border border-white/5 bg-bg p-2 text-center">
                                <p className={`text-lg font-black ${color}`}>{editFor(meal)[field] || 0}</p>
                                <p className="text-[10px] text-slate-500">{label}</p>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => handleSaveEdit(meal)}
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
                                onClick={() => handleRemoveNote(meal.id)}
                                className="mr-3 shrink-0 text-slate-600 hover:text-red-400"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={noteInputs[meal.id] ?? ""}
                              onChange={(e) => setNoteInputs((prev) => ({ ...prev, [meal.id]: e.target.value }))}
                              placeholder={existingNote ? "تعديل الملاحظة..." : "اكتب ملاحظة لهذه الوجبة..."}
                              className="input-base flex-1 py-2 text-sm"
                            />
                            <button
                              onClick={() => handleSaveNote(meal.id)}
                              disabled={!noteInputs[meal.id]?.trim()}
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
