import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppSelector } from "@/app/hooks";
import { DAYS_ORDER } from "@/types";
import { getGoalLabel } from "@/lib/goalLabels";
import { GoalProgressMini } from "@/components/goal/GoalProgressMini";

export function DashboardPage() {
  const { displayName }              = useAppSelector((s) => s.auth);
  const { profile }                  = useAppSelector((s) => s.user);
  const { weeklyPlan }               = useAppSelector((s) => s.workout);
  const { plan: nutritionPlan, dailyLog } = useAppSelector((s) => s.nutrition);
  const { streak }                   = useAppSelector((s) => s.progress);

  const todayName     = DAYS_ORDER[new Date().getDay()];
  const todaySchedule = weeklyPlan?.[todayName];
  const todayExercises =
    weeklyPlan && todaySchedule?.type === "تمرين"
      ? todaySchedule.exercises
      : [];
  const doneCount = todayExercises.filter((e) => e.done).length;

  const consumed = {
    calories: dailyLog.reduce((s, m) => s + m.calories, 0),
    protein:  dailyLog.reduce((s, m) => s + m.protein,  0),
    carbs:    dailyLog.reduce((s, m) => s + m.carbs,    0),
    fat:      dailyLog.reduce((s, m) => s + m.fat,      0),
  };

  const caloriesOver = !!(nutritionPlan && consumed.calories > nutritionPlan.totalCalories);

  if (!weeklyPlan && !nutritionPlan) {
    return (
      <div className="mx-auto max-w-4xl px-6 pt-28">
        <div className="mb-8">
          <p className="text-sm text-slate-500">مرحباً 👋</p>
          <h1 className="text-4xl font-black">{displayName}</h1>
        </div>
        <EmptyState
          icon="🤖"
          title="خطتك جاهزة للإنشاء!"
          desc="تحدّث مع المساعد الذكي وسيسألك بعض الأسئلة ثم يبني لك خطة تمارين وتغذية مخصصة تماماً."
        />
        <div className="mt-6 flex justify-center">
          <Link to="/chat" className="btn-primary glow flex items-center gap-2">
            🤖 ابدأ مع المساعد
          </Link>
        </div>
      </div>
    );
  }

  const macros = nutritionPlan
    ? [
        { label: "بروتين",     current: consumed.protein, target: nutritionPlan.protein, unit: "g", color: consumed.protein > nutritionPlan.protein ? "bg-red-500" : "bg-accent"       },
        { label: "كربوهيدرات", current: consumed.carbs,   target: nutritionPlan.carbs,   unit: "g", color: consumed.carbs   > nutritionPlan.carbs   ? "bg-red-500" : "bg-brand-blue"   },
        { label: "دهون",       current: consumed.fat,     target: nutritionPlan.fat,     unit: "g", color: consumed.fat     > nutritionPlan.fat     ? "bg-red-500" : "bg-brand-orange" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl px-6 pb-20 pt-28">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm text-slate-500">مرحباً بعودتك 👋</p>
          <h1 className="text-4xl font-black">{profile.name || displayName}</h1>
          {profile.goal && <p className="mt-1 text-sm text-accent">الهدف: {getGoalLabel(profile.goal)}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">خطتك نشطة ✅</span>
          <span className="text-xs text-slate-500">{todayName}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "السعرات اليوم",    val: `${consumed.calories}`, unit: `/ ${nutritionPlan?.totalCalories ?? 0} kcal`, icon: "🔥", color: caloriesOver ? "text-red-400" : "text-brand-orange" },
          { label: "تمارين اليوم",     val: `${doneCount}`,         unit: todaySchedule?.type === "راحة" ? "يوم راحة 🛌" : `/ ${todayExercises.length} تمارين`, icon: "💪", color: "text-accent" },
          { label: "الوزن الحالي",     val: profile.weight || "—",  unit: "كغ",  icon: "⚖️", color: "text-brand-blue"   },
          { label: "الالتزام",          val: `${streak}`,            unit: "يوم متتالي 🔥", icon: "🔥", color: "text-brand-orange" },
        ].map(({ label, val, unit, icon, color }) => (
          <Card key={label}>
            <div className="mb-3 flex items-start justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-2xl">{icon}</span>
            </div>
            <div className={`text-2xl font-black ${color}`}>{val}</div>
            <div className="mt-1 text-xs text-slate-600">{unit}</div>
          </Card>
        ))}
      </div>

      {/* Goal journey at a glance */}
      <GoalProgressMini />

      {/* تحذير تجاوز السعرات */}
      {caloriesOver && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-400">
          ⚠️ تجاوزت السعرات اليومية بـ {consumed.calories - nutritionPlan!.totalCalories} kcal
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* تمارين اليوم */}
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                {todaySchedule?.type === "راحة" ? "يوم راحة 🛌" : `تمارين ${todayName} 💪`}
              </h3>
              {todaySchedule?.focus && (
                <p className="text-xs text-slate-500 mt-0.5">التركيز: {todaySchedule.focus}</p>
              )}
            </div>
            <Link to="/workout" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              صفحة التمارين <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>

          {todaySchedule?.type === "راحة" ? (
            <div className="py-8 text-center">
              <div className="text-5xl mb-3">🛌</div>
              <p className="text-slate-400 text-sm">استرح وأعطِ جسمك وقت التعافي</p>
            </div>
          ) : todayExercises.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">لا توجد تمارين مجدولة اليوم</p>
          ) : (
            <>
              <div className="space-y-1 mb-4">
                {todayExercises.slice(0, 5).map((ex) => (
                  <Link key={ex.id}
                    to={`/exercise/${encodeURIComponent(todayName)}/${ex.id}`}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-bg">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${ex.done ? "border border-accent/30 bg-accent/10 text-accent" : "border border-white/10 bg-bg text-slate-600"}`}>
                      {ex.done ? "✓" : "○"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${ex.done ? "text-slate-400 line-through" : "text-white"}`}>{ex.name}</p>
                      <p className="text-xs text-slate-600">{ex.muscleGroup} · {ex.sets} سيت × {ex.reps}</p>
                    </div>
                  </Link>
                ))}
                {todayExercises.length > 5 && (
                  <p className="text-xs text-slate-500 text-center pt-1">+{todayExercises.length - 5} تمارين أخرى</p>
                )}
              </div>
              {/* شريط تقدم */}
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>التقدم</span>
                  <span className={doneCount === todayExercises.length ? "text-accent font-semibold" : ""}>
                    {doneCount === todayExercises.length && "🎉 "}{doneCount}/{todayExercises.length}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${todayExercises.length ? (doneCount / todayExercises.length) * 100 : 0}%` }} />
                </div>
              </div>
            </>
          )}
        </Card>

        {/* التغذية + المساعد */}
        <div className="flex flex-col gap-5">
          {nutritionPlan && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold">التغذية اليوم 🍎</h3>
                <Link to="/nutrition" className="text-xs text-accent hover:underline">التفاصيل →</Link>
              </div>
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">السعرات</span>
                <span className={`font-semibold ${caloriesOver ? "text-red-400" : "text-brand-orange"}`}>
                  {consumed.calories} / {nutritionPlan.totalCalories} kcal
                </span>
              </div>
              <div className="space-y-3">
                {macros.map((m) => <ProgressBar key={m.label} {...m} />)}
              </div>
              {dailyLog.length === 0 && (
                <p className="mt-3 text-xs text-slate-600 text-center">لم تسجّل أي وجبة اليوم</p>
              )}
            </Card>
          )}

          <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 to-transparent p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <span className="text-sm font-bold text-accent">المساعد الذكي</span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-slate-400">
              هل تريد تعديل خطتك أو لديك سؤال رياضي؟
            </p>
            <Link to="/chat" className="inline-flex items-center gap-1 rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 transition-all">
              تحدّث مع AI <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}