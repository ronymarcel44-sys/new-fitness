import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { toggleDone, setSelectedDay } from "@/features/workout/workoutSlice";
import { DAYS_ORDER, type DayName } from "@/types";
import { cn } from "@/lib/utils";

const TODAY_IDX = new Date().getDay();
const TODAY     = DAYS_ORDER[TODAY_IDX];

const DAY_EMOJIS: Record<DayName, string> = {
  "الأحد": "1️⃣", "الاثنين": "2️⃣", "الثلاثاء": "3️⃣",
  "الأربعاء": "4️⃣", "الخميس": "5️⃣", "الجمعة": "6️⃣", "السبت": "7️⃣",
};

export function WeeklyPlanPage() {
  const dispatch = useAppDispatch();
  const { weeklyPlan, selectedDay } = useAppSelector((s) => s.workout);

  if (!weeklyPlan) {
    return (
      <div className="mx-auto max-w-4xl px-6 pt-28">
        <h1 className="mb-2 text-4xl font-black">الجدول الأسبوعي 📅</h1>
        <EmptyState icon="📅" title="لا يوجد جدول بعد" desc="تحدّث مع المساعد الذكي لبناء خطة تمارين أولاً." />
      </div>
    );
  }

  // Guard every weeklyPlan[day] access: an AI-generated plan can occasionally
  // omit a day, and an unguarded `.type` / `.exercises` read crashes the page.
  const trainingDays = DAYS_ORDER.filter((d) => weeklyPlan[d]?.type === "تمرين").length;
  const restDays     = DAYS_ORDER.filter((d) => weeklyPlan[d]?.type === "راحة").length;

  const selectedDayData = weeklyPlan[selectedDay];
  const totalEx  = selectedDayData?.exercises?.length ?? 0;
  const doneEx   = selectedDayData?.exercises?.filter((e) => e.done).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-28">
      <h1 className="mb-2 text-4xl font-black">الجدول الأسبوعي 📅</h1>
      <p className="mb-8 text-slate-400">الأيام الماضية مقفلة — يمكنك تعديل اليوم والأيام القادمة فقط</p>

      {/* ملخص */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <Card className="text-center">
          <div className="text-3xl font-black text-accent">{trainingDays}</div>
          <div className="mt-1 text-xs text-slate-500">أيام تمرين</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-black text-brand-blue">{restDays}</div>
          <div className="mt-1 text-xs text-slate-500">أيام راحة</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-black text-brand-orange">
            {DAYS_ORDER.reduce((acc, d) => acc + (weeklyPlan[d]?.exercises?.filter(e => e.done).length ?? 0), 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">تمارين منجزة</div>
        </Card>
      </div>

      {/* أزرار الأيام */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {DAYS_ORDER.map((day, idx) => {
          const isPast    = idx < TODAY_IDX;
          const isToday   = day === TODAY;
          const isRest    = weeklyPlan[day]?.type === "راحة";
          const isSelected = day === selectedDay;

          return (
            <button key={day}
              onClick={() => dispatch(setSelectedDay(day))}
              className={cn(
                "relative flex shrink-0 flex-col items-center rounded-2xl border px-4 py-3 text-xs transition-all min-w-[72px]",
                isSelected
                  ? "border-accent bg-accent/15 text-accent"
                  : isPast
                  ? "border-white/5 bg-bg-card/40 text-slate-600"
                  : isRest
                  ? "border-white/5 bg-bg-card text-slate-500 hover:border-white/20"
                  : "border-white/10 bg-bg-card text-slate-300 hover:border-accent/30 hover:text-accent"
              )}>
              {isPast && <Lock className="absolute top-1.5 right-1.5 h-2.5 w-2.5 text-slate-600" />}
              <span className="text-base">{DAY_EMOJIS[day]}</span>
              <span className="mt-1 font-bold">{day}</span>
              {isToday && <span className="mt-0.5 text-[10px] text-accent">اليوم</span>}
              {!isToday && (
                <span className={cn("mt-0.5 text-[10px]", isRest ? "text-slate-600" : "text-slate-500")}>
                  {isRest ? "راحة" : `${weeklyPlan[day]?.exercises?.length ?? 0} تمارين`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* تفاصيل اليوم المختار */}
      {selectedDayData && (
        <div>
          {/* رأس اليوم */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">
                {selectedDay}
                {selectedDay === TODAY && (
                  <span className="mr-2 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent">اليوم</span>
                )}
              </h2>
              {selectedDayData.focus && (
                <p className="text-sm text-slate-400">التركيز: {selectedDayData.focus}</p>
              )}
            </div>

            {/* أيام الأسبوع ثابتة: 5 تمرين + يومان راحة — لا يمكن تبديل نوع اليوم */}
            {DAYS_ORDER.indexOf(selectedDay) < TODAY_IDX && (
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <Lock className="h-3 w-3" /> يوم مضى
              </span>
            )}
          </div>

          {/* تقدم اليوم */}
          {selectedDayData.type === "تمرين" && totalEx > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                <span>التقدم</span>
                <span>{doneEx} / {totalEx} تمارين</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${totalEx ? (doneEx / totalEx) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* التمارين أو رسالة الراحة */}
          {selectedDayData.type === "راحة" ? (
            <Card className="py-10 text-center">
              <div className="text-5xl mb-3">🛌</div>
              <p className="font-bold text-slate-300">يوم راحة</p>
              <p className="mt-1 text-sm text-slate-500">استرح وأعطِ عضلاتك وقت التعافي</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {(selectedDayData.exercises ?? []).map((ex, i) => {
                const isPastDay = DAYS_ORDER.indexOf(selectedDay) < TODAY_IDX;
                return (
                  <div key={ex.id}
                    onClick={() => !isPastDay && dispatch(toggleDone({ day: selectedDay, exerciseId: ex.id }))}
                    className={cn(
                      "rounded-2xl border p-4 transition-all",
                      isPastDay
                        ? "border-white/5 bg-bg-card/50 opacity-60 cursor-not-allowed"
                        : ex.done
                        ? "border-accent/20 bg-accent/5 cursor-pointer"
                        : "border-white/10 bg-bg-card cursor-pointer hover:border-white/20"
                    )}>
                    <div className="flex items-start gap-4">
                      {/* رقم التمرين أو علامة ✓ */}
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                        isPastDay
                          ? "bg-white/5 text-slate-600"
                          : ex.done
                          ? "bg-accent/20 text-accent"
                          : "bg-white/5 text-slate-500"
                      )}>
                        {isPastDay ? <Lock className="h-3.5 w-3.5" /> : ex.done ? "✓" : i + 1}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className={cn("font-bold", ex.done ? "text-accent" : isPastDay ? "text-slate-500" : "text-white")}>
                            {ex.name}
                          </h3>
                          <span className="rounded-full border border-white/10 bg-bg px-2 py-0.5 text-xs text-slate-500">
                            {ex.muscleGroup}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-accent/20 bg-accent/5 px-2.5 py-0.5 text-xs text-accent">
                            {ex.sets} سيت × {ex.reps}
                          </span>
                          {ex.rest && (
                            <span className="rounded-full border border-white/10 bg-bg px-2.5 py-0.5 text-xs text-slate-500">
                              ⏱️ راحة {ex.rest}
                            </span>
                          )}
                        </div>

                        {ex.notes && (
                          <p className="mt-2 text-xs text-slate-500">💡 {ex.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}