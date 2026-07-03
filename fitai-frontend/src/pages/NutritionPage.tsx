// src/pages/NutritionPage.tsx
//
// Add-meal supports two modes:
// - AI analyzer (default): type a food name → /ai/analyze-meal returns portion
//   options → pick portions into a cart → log them all as one meal.
// - Manual: type the macros yourself.

import { useState } from "react";
import { Plus, X, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logMealThunk, removeMealLogThunk } from "@/features/nutrition/nutritionSlice";
import { apiRequest } from "@/lib/api";
import { WaterTracker } from "@/components/nutrition/WaterTracker";
import { WeeklyNutritionSummary } from "@/components/nutrition/WeeklyNutritionSummary";
import type { Meal } from "@/types";

const EMOJIS = ["🍳","🥗","🍚","🍗","🥩","🐟","🥦","🍎","🥜","🧃","🍽️"];

interface Portion {
  label:    string;
  grams:    number;
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

interface CartItem {
  name:     string;
  label:    string;
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

export function NutritionPage() {
  const dispatch = useAppDispatch();
  const { plan, dailyLog } = useAppSelector((s) => s.nutrition);
  const coachMealNotes = useAppSelector((s) => s.user.coachMealNotes);
  const DAYS_AR_NUT = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const todayName   = DAYS_AR_NUT[new Date().getDay()];

  // Today vs week tab
  const [activeTab, setActiveTab] = useState<"today" | "week">("today");

  // Form visibility + mode
  const [showForm, setShowForm]     = useState(false);
  const [manualMode, setManualMode] = useState(false);

  // Manual form state
  const [form, setForm] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", emoji: "🍽️" });

  // AI analyzer state
  const [analyzeStep,  setAnalyzeStep]  = useState<"idle" | "loading" | "portions">("idle");
  const [foodName,     setFoodName]     = useState("");
  const [portions,     setPortions]     = useState<Portion[]>([]);
  const [analyzeError, setAnalyzeError] = useState("");

  // Cart state
  const [cart,        setCart]        = useState<CartItem[]>([]);
  const [cartLogging, setCartLogging] = useState(false);

  if (!plan) {
    return (
      <div className="mx-auto max-w-4xl px-6 pt-28">
        <h1 className="mb-2 text-4xl font-black">التغذية 🍎</h1>
        <EmptyState icon="🥗" title="لا توجد خطة غذائية بعد" desc="تحدّث مع المساعد الذكي ليبني لك خطة غذائية مخصصة." />
      </div>
    );
  }

  const consumed = {
    calories: dailyLog.reduce((s, m) => s + m.calories, 0),
    protein:  dailyLog.reduce((s, m) => s + m.protein,  0),
    carbs:    dailyLog.reduce((s, m) => s + m.carbs,    0),
    fat:      dailyLog.reduce((s, m) => s + m.fat,      0),
  };

  const macros = [
    { label: "بروتين",     current: consumed.protein, target: plan.protein, unit: "g", color: "bg-accent"       },
    { label: "كربوهيدرات", current: consumed.carbs,   target: plan.carbs,   unit: "g", color: "bg-brand-blue"   },
    { label: "دهون",       current: consumed.fat,     target: plan.fat,     unit: "g", color: "bg-brand-orange" },
  ];

  const warnings: { label: string; over: number; unit: string }[] = [];
  if (consumed.calories > plan.totalCalories)
    warnings.push({ label: "السعرات",      over: consumed.calories - plan.totalCalories, unit: "kcal" });
  if (consumed.protein > plan.protein)
    warnings.push({ label: "البروتين",     over: consumed.protein  - plan.protein,       unit: "g"    });
  if (consumed.carbs > plan.carbs)
    warnings.push({ label: "الكربوهيدرات", over: consumed.carbs    - plan.carbs,         unit: "g"    });
  if (consumed.fat > plan.fat)
    warnings.push({ label: "الدهون",       over: consumed.fat      - plan.fat,           unit: "g"    });

  const allGood = dailyLog.length > 0 && warnings.length === 0;

  // Names already logged today — used to flip a suggested meal's button to its
  // "added" state (survives refresh because dailyLog is reloaded from the API).
  const loggedNames = new Set(dailyLog.map((m) => m.name));

  // ── Handlers ────────────────────────────────────────────────────────────────

  const closeForm = () => {
    setShowForm(false);
    setManualMode(false);
    setAnalyzeStep("idle");
    setFoodName("");
    setPortions([]);
    setAnalyzeError("");
    setCart([]);
    setForm({ name: "", calories: "", protein: "", carbs: "", fat: "", emoji: "🍽️" });
  };

  // Manual entry — type the macros yourself
  const handleAdd = () => {
    if (!form.name.trim() || !form.calories) return;
    const meal: Meal = {
      id:       crypto.randomUUID(),
      name:     form.name,
      calories: Number(form.calories),
      protein:  Number(form.protein  || 0),
      carbs:    Number(form.carbs    || 0),
      fat:      Number(form.fat      || 0),
      time:     new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
      items:    [],
      emoji:    form.emoji,
      source:   "manual",
    };
    dispatch(logMealThunk(meal));
    closeForm();
  };

  // AI analyzer — ask the backend for portion options for a food name
  const handleAnalyze = async () => {
    if (!foodName.trim()) return;
    setAnalyzeStep("loading");
    setAnalyzeError("");
    setPortions([]);
    try {
      const data = await apiRequest<{ portions: Portion[] }>(
        "POST", "/ai/analyze-meal", { foodName: foodName.trim() }
      );
      if (!data.portions?.length) throw new Error("empty");
      setPortions(data.portions);
      setAnalyzeStep("portions");
    } catch {
      setAnalyzeError("فشل التحليل، حاول مرة أخرى");
      setAnalyzeStep("idle");
    }
  };

  const handleAddToCart = (p: Portion) => {
    setCart((prev) => [...prev, {
      name:     foodName.trim(),
      label:    p.label,
      calories: p.calories,
      protein:  p.protein,
      carbs:    p.carbs,
      fat:      p.fat,
    }]);
    setAnalyzeStep("idle");
    setFoodName("");
    setPortions([]);
  };

  const handleRemoveFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLogCart = async () => {
    if (!cart.length) return;
    setCartLogging(true);
    const name = cart.length === 1
      ? cart[0].name
      : cart.map((i) => i.name).join(" + ");
    const meal: Meal = {
      id:       crypto.randomUUID(),
      name,
      time:     new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
      calories: cart.reduce((s, i) => s + i.calories, 0),
      protein:  cart.reduce((s, i) => s + i.protein,  0),
      carbs:    cart.reduce((s, i) => s + i.carbs,    0),
      fat:      cart.reduce((s, i) => s + i.fat,      0),
      items:    cart.map((i) => `${i.name} — ${i.label}`),
      emoji:    "🍽️",
      source:   "ai_analyzer",
    };
    await dispatch(logMealThunk(meal));
    setCartLogging(false);
    closeForm();
  };

  // Add a suggested plan meal to today's log — a copy with a fresh id, keeping
  // the plan's own time. "Already added" is matched by name (see loggedNames)
  // so the button stays disabled after a refresh.
  const handleAddSuggested = (meal: Meal) => {
    dispatch(logMealThunk({ ...meal, id: crypto.randomUUID(), source: "plan" }));
  };

  return (
    <div className="mx-auto max-w-4xl px-6 pb-20 pt-28">
      <h1 className="mb-2 text-4xl font-black">الخطة الغذائية 🍎</h1>
      <p className="mb-6 text-slate-400">خطة مخصصة من الـ AI — سجّل وجباتك اليومية لتتبع تقدمك</p>

      {/* Today / Week tabs */}
      <div className="mb-6 flex gap-2">
        {([["today", "اليوم"], ["week", "الأسبوع"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === key
                ? "border border-accent/30 bg-accent/15 text-accent"
                : "border border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "week" && <WeeklyNutritionSummary />}

      {activeTab === "today" && (
        <>
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="font-bold">تجاوزت حدودك اليومية!</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {warnings.map((w) => (
              <span key={w.label} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
                {w.label} +{w.over} {w.unit}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-red-400/70">
            حاول تقليل وجباتك القادمة أو تعديل نظامك الغذائي
          </p>
        </div>
      )}

      {allGood && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="font-bold text-accent">أنت في المسار الصح! 🎉</p>
            <p className="text-xs text-accent/70">تغذيتك اليوم ضمن الحدود المثالية</p>
          </div>
        </div>
      )}

      {/* Daily targets */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "السعرات المستهدفة", val: plan.totalCalories, unit: "kcal", color: "text-brand-orange" },
          { label: "بروتين",            val: plan.protein,       unit: "g",    color: "text-accent"       },
          { label: "كربوهيدرات",        val: plan.carbs,         unit: "g",    color: "text-brand-blue"   },
          { label: "دهون",              val: plan.fat,           unit: "g",    color: "text-brand-purple" },
        ].map(({ label, val, unit, color }) => (
          <Card key={label} className="text-center">
            <div className={`text-2xl font-black ${color}`}>{val}</div>
            <div className="text-xs text-slate-600">{unit}</div>
            <div className="mt-1 text-xs text-slate-500">{label}</div>
          </Card>
        ))}
      </div>

      {/* Daily progress */}
      <Card className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">تقدمك اليوم 📊</h3>
          <span className={`text-sm font-semibold ${consumed.calories > plan.totalCalories ? "text-red-400" : "text-brand-orange"}`}>
            {consumed.calories} / {plan.totalCalories} kcal
          </span>
        </div>
        {macros.map((m) => (
          <ProgressBar key={m.label} {...m} color={m.current > m.target ? "bg-red-500" : m.color} />
        ))}
      </Card>

      {/* Suggested meals from the plan */}
      <Card className="mb-6">
        <h3 className="mb-4 font-bold">الوجبات المقترحة (من خطتك) 🍽️</h3>
        <div className="space-y-3">
          {plan.meals.filter((m) => !m.dayOfWeek || m.dayOfWeek === todayName).map((meal) => (
            <div key={meal.id} className="flex items-center gap-4 rounded-xl border border-white/5 bg-bg p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-xl">
                {meal.emoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {meal.name}
                    {meal.coachEdited && <span className="mr-2 text-xs font-normal text-brand-purple">✨ عدّلها مدربك</span>}
                  </span>
                  <span className="text-sm text-brand-orange">{meal.calories} kcal</span>
                </div>
                <div className="mt-1 flex gap-3 text-xs text-slate-500">
                  <span>🕐 {meal.time}</span>
                  <span>💪 {meal.protein}g</span>
                  <span>🍞 {meal.carbs}g</span>
                  <span>🥑 {meal.fat}g</span>
                </div>
                {coachMealNotes[meal.id] && (
                  <div className="mt-2 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-3 py-2">
                    <p className="mb-0.5 text-[11px] font-bold text-brand-purple">👨‍🏫 ملاحظة من مدربك</p>
                    <p className="text-xs leading-relaxed text-slate-300">{coachMealNotes[meal.id]}</p>
                  </div>
                )}
                {meal.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {meal.items.map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-bg-card px-2 py-0.5 text-xs text-slate-400">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {loggedNames.has(meal.name) ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> تمت الإضافة
                </span>
              ) : (
                <button
                  onClick={() => handleAddSuggested(meal)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent transition-all hover:bg-accent/25"
                >
                  <Plus className="h-4 w-4" /> إضافة لليوم
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Water tracker */}
      <WaterTracker />

      {/* Today's logged meals */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold">وجبات اليوم 📝</h3>
        <button onClick={() => showForm ? closeForm() : setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> إضافة وجبة
        </button>
      </div>

      {showForm && (
        <Card className="mb-6 border-accent/30">
          {!manualMode ? (
            /* ── AI Analyzer ── */
            <>
              <p className="mb-3 text-sm font-semibold text-slate-300">تحليل ذكي 🤖</p>
              <label className="mb-1 block text-xs text-slate-400">اكتب اسم الطعام</label>
              <div className="flex gap-2">
                <input
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="مثال: أرز، بيضة، عصير برتقال..."
                  className="input-base flex-1"
                  disabled={analyzeStep === "loading"}
                  autoFocus={cart.length === 0}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={analyzeStep === "loading" || !foodName.trim()}
                  className="btn-primary flex shrink-0 items-center gap-2 px-4 text-sm disabled:opacity-50"
                >
                  {analyzeStep === "loading"
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : "تحليل 🔍"}
                </button>
              </div>
              {analyzeError && <p className="mt-2 text-xs text-red-400">{analyzeError}</p>}

              {/* Portion cards */}
              {analyzeStep === "portions" && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-slate-400">اختر الحصة لإضافتها للسلة:</p>
                  <div className="space-y-2">
                    {portions.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleAddToCart(p)}
                        className="w-full rounded-xl border border-white/10 bg-bg p-3 text-right transition-all hover:border-accent/50 hover:bg-accent/5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{p.label}</span>
                          <span className="font-bold text-brand-orange">{p.calories} kcal</span>
                        </div>
                        <div className="mt-1 flex gap-3 text-xs text-slate-500">
                          <span>{p.grams}غ</span>
                          <span>بروتين: {p.protein}غ</span>
                          <span>كارب: {p.carbs}غ</span>
                          <span>دهون: {p.fat}غ</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setAnalyzeStep("idle"); setPortions([]); }}
                    className="mt-2 text-xs text-slate-500 underline hover:text-slate-400"
                  >
                    ← رجوع
                  </button>
                </div>
              )}

              {/* Cart */}
              {cart.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-bg p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-400">سلة الوجبة ({cart.length})</p>
                  <div className="space-y-2">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg bg-bg-card px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{item.name}</span>
                            <span className="shrink-0 text-xs text-slate-500">{item.label}</span>
                          </div>
                          <div className="mt-0.5 flex gap-2 text-xs text-slate-500">
                            <span>بروتين: {item.protein}غ</span>
                            <span>كارب: {item.carbs}غ</span>
                            <span>دهون: {item.fat}غ</span>
                          </div>
                        </div>
                        <div className="mr-3 flex shrink-0 items-center gap-3">
                          <span className="text-sm font-bold text-brand-orange">{item.calories} kcal</span>
                          <button
                            onClick={() => handleRemoveFromCart(idx)}
                            className="text-slate-500 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
                    <div>
                      <span className="text-sm font-bold text-slate-300">المجموع</span>
                      <div className="mt-0.5 flex gap-2 text-xs text-slate-500">
                        <span>بروتين: {cart.reduce((s, i) => s + i.protein, 0)}غ</span>
                        <span>كارب: {cart.reduce((s, i) => s + i.carbs, 0)}غ</span>
                        <span>دهون: {cart.reduce((s, i) => s + i.fat, 0)}غ</span>
                      </div>
                    </div>
                    <span className="font-black text-brand-orange">
                      {cart.reduce((s, i) => s + i.calories, 0)} kcal
                    </span>
                  </div>
                  <button
                    onClick={handleLogCart}
                    disabled={cartLogging}
                    className="btn-primary mt-3 flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {cartLogging ? <Loader2 className="h-4 w-4 animate-spin" /> : "سجل الوجبة ✅"}
                  </button>
                </div>
              )}

              <button
                onClick={() => setManualMode(true)}
                className="mt-4 text-xs text-slate-500 underline hover:text-slate-400"
              >
                أو إدخال يدوي ✏️
              </button>
            </>
          ) : (
            /* ── Manual Form ── */
            <>
              <p className="mb-3 text-sm font-semibold text-slate-300">إدخال يدوي ✏️</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
                      form.emoji === e ? "border-accent bg-accent/10" : "border-white/10 bg-bg hover:border-white/20"
                    }`}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">اسم الوجبة *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="مثال: صدر دجاج مشوي مع أرز" className="input-base" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">السعرات (kcal) *</label>
                  <input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })}
                    placeholder="500" className="input-base" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">بروتين (g)</label>
                  <input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })}
                    placeholder="30" className="input-base" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">كربوهيدرات (g)</label>
                  <input type="number" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })}
                    placeholder="60" className="input-base" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">دهون (g)</label>
                  <input type="number" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })}
                    placeholder="15" className="input-base" />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={handleAdd} className="btn-primary flex-1 text-center text-sm">تسجيل الوجبة ✅</button>
                <button onClick={closeForm} className="btn-secondary px-4 text-sm">إلغاء</button>
              </div>
              <button
                onClick={() => setManualMode(false)}
                className="mt-3 text-xs text-slate-500 underline hover:text-slate-400"
              >
                ← تحليل ذكي
              </button>
            </>
          )}
        </Card>
      )}

      {dailyLog.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-slate-600">
          لم تسجّل أي وجبة اليوم بعد
        </div>
      ) : (
        <div className="space-y-3">
          {dailyLog.map((meal) => (
            <Card key={meal.id} className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-bg text-xl">
                {meal.emoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{meal.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-brand-orange">{meal.calories} kcal</span>
                    <button onClick={() => dispatch(removeMealLogThunk(meal.id))}
                      className="rounded-lg p-1 text-slate-600 hover:text-red-400 transition-all">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex gap-3 text-xs text-slate-500">
                  <span>🕐 {meal.time}</span>
                  {meal.protein > 0 && <span>💪 {meal.protein}g بروتين</span>}
                  {meal.carbs > 0 && <span>🍞 {meal.carbs}g كارب</span>}
                  {meal.fat > 0 && <span>🥑 {meal.fat}g دهون</span>}
                </div>
                {meal.items && meal.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {meal.items.map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-bg-card px-2 py-0.5 text-xs text-slate-400">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
          <Card className="border-accent/20 bg-accent/5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-accent">المجموع اليوم</span>
              <span className={`font-black ${consumed.calories > plan.totalCalories ? "text-red-400" : "text-brand-orange"}`}>
                {consumed.calories} kcal
              </span>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-400">
              <span>💪 {consumed.protein}g بروتين</span>
              <span>🍞 {consumed.carbs}g كارب</span>
              <span>🥑 {consumed.fat}g دهون</span>
            </div>
          </Card>
        </div>
      )}
        </>
      )}
    </div>
  );
}
