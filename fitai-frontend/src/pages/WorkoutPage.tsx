import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppSelector } from "@/app/hooks";
import { DAYS_ORDER } from "@/types";
import { cn } from "@/lib/utils";

const TODAY = DAYS_ORDER[new Date().getDay()];

export function WorkoutPage() {
  const { weeklyPlan } = useAppSelector((s) => s.workout);
  const coachExerciseNotes = useAppSelector((s) => s.user.coachExerciseNotes);

  if (!weeklyPlan) {
    return (
      <div className="mx-auto max-w-4xl px-6 pt-28">
        <h1 className="mb-2 text-4xl font-black">تمارين اليوم 💪</h1>
        <EmptyState icon="🏋️" title="لا توجد خطة تمارين بعد"
          desc="تحدّث مع المساعد الذكي ليبني لك خطة تمارين مخصصة." />
      </div>
    );
  }

  const dayData  = weeklyPlan[TODAY];
  const totalEx  = dayData?.exercises.length ?? 0;
  const doneEx   = dayData?.exercises.filter((e) => e.done).length ?? 0;
  const progress = totalEx > 0 ? Math.round((doneEx / totalEx) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-28">

      {/* رأس الصفحة */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{TODAY}</p>
          <h1 className="text-4xl font-black">تمارين اليوم 💪</h1>
          {dayData?.focus && (
            <p className="mt-1 text-sm text-accent">التركيز: {dayData.focus}</p>
          )}
        </div>
        <Link to="/weekly-plan"
          className="rounded-xl border border-white/10 bg-bg-card px-4 py-2 text-xs text-slate-400 hover:border-white/20 hover:text-white transition-all">
          📅 الجدول
        </Link>
      </div>

      {/* يوم راحة */}
      {dayData?.type === "راحة" ? (
        <Card className="mt-8 py-16 text-center">
          <div className="text-6xl mb-4">🛌</div>
          <p className="text-xl font-bold text-slate-300">يوم راحة</p>
          <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
            استرح وأعطِ عضلاتك وقت التعافي — الراحة جزء أساسي من التمرين
          </p>
          <Link to="/weekly-plan"
            className="mt-6 inline-block rounded-xl border border-white/10 px-5 py-2 text-sm text-slate-400 hover:text-white transition-all">
            شوف تمارين يوم ثاني →
          </Link>
        </Card>
      ) : (
        <>
          {/* شريط التقدم */}
          {totalEx > 0 && (
            <div className="mt-6 mb-6">
              <div className="mb-2 flex justify-between text-xs text-slate-500">
                <span>تقدم اليوم</span>
                <span className={doneEx === totalEx ? "font-bold text-accent" : ""}>
                  {doneEx === totalEx && totalEx > 0 ? "🎉 " : ""}{doneEx} / {totalEx} تمارين
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${progress}%` }} />
              </div>
              {doneEx === totalEx && totalEx > 0 && (
                <p className="mt-2 text-center text-xs text-accent">أحسنت! أنجزت كل تمارين اليوم 🏆</p>
              )}
            </div>
          )}

          {/* قائمة التمارين */}
          <div className="space-y-3">
            {dayData?.exercises.map((ex, i) => (
              <div key={ex.id}
                className={cn(
                  "group rounded-2xl border transition-all",
                  ex.done
                    ? "border-accent/20 bg-accent/5"
                    : "border-white/10 bg-bg-card hover:border-white/20"
                )}>
                <div className="flex items-center gap-4 p-4">
                  {/* حالة الإنجاز (عرض فقط — التسجيل من صفحة التمرين) */}
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                      ex.done
                        ? "bg-accent/20 text-accent"
                        : "bg-white/5 text-slate-600"
                    )}>
                    {ex.done ? "✓" : i + 1}
                  </div>

                  {/* معلومات التمرين */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-bold text-sm", ex.done ? "text-accent" : "text-white")}>
                      {ex.nameEn || ex.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ex.name}
                      {ex.coachEdited && <span className="mr-2 text-brand-purple">✨ عدّلها مدربك</span>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-500">
                        {ex.sets} × {ex.reps}
                      </span>
                      {ex.rest && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-500">
                          ⏱️ {ex.rest}
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-500">
                        {ex.muscleGroup}
                      </span>
                    </div>
                  </div>

                  {/* زر التفاصيل */}
                  <Link
                    to={`/exercise/${encodeURIComponent(TODAY)}/${ex.id}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-500 transition-all hover:border-accent/30 hover:text-accent"
                    onClick={(e) => e.stopPropagation()}>
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                </div>

                {/* ملاحظة */}
                {ex.notes && (
                  <div className="border-t border-white/5 px-4 pb-3 pt-2">
                    <p className="text-xs text-slate-500">💡 {ex.notes}</p>
                  </div>
                )}

                {/* ملاحظة من المدرب */}
                {coachExerciseNotes[ex.id] && (
                  <div className="border-t border-brand-purple/15 bg-brand-purple/5 px-4 pb-3 pt-2">
                    <p className="mb-0.5 text-[11px] font-bold text-brand-purple">👨‍🏫 ملاحظة من مدربك</p>
                    <p className="text-xs leading-relaxed text-slate-300">{coachExerciseNotes[ex.id]}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}