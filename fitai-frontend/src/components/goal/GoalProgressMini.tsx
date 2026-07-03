// src/components/goal/GoalProgressMini.tsx
//
// A compact at-a-glance version of the goal journeys for the Dashboard: the
// universal streak bar, plus the weight/waist goal bar when applicable. Links
// to the full Progress page.

import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { useAppSelector } from "@/app/hooks";
import { getGoalLabel } from "@/lib/goalLabels";
import { streakJourney, resolveMetricJourney } from "@/lib/goalTracker";

export function GoalProgressMini() {
  const { profile }                       = useAppSelector((s) => s.user);
  const { streak, weightData, waistData } = useAppSelector((s) => s.progress);

  if (!profile.goal) return null;

  const sj = streakJourney(streak);
  const mj = resolveMetricJourney(profile.goal, {
    weight:       parseFloat(profile.weight || "") || weightData[weightData.length - 1]?.weight,
    waist:        parseFloat(profile.waist  || "") || waistData[waistData.length - 1],
    startWeight:  parseFloat(profile.startWeight || "") || weightData[0]?.weight,
    startWaist:   parseFloat(profile.startWaist  || "") || waistData[0],
    targetWeight: profile.targetWeight ? parseFloat(profile.targetWeight) : null,
  });

  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">🎯 رحلتك</h3>
        <Link to="/progress" className="text-xs text-accent hover:underline">التفاصيل ←</Link>
      </div>

      {/* streak (universal) */}
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-400">🔥 الالتزام</span>
        <span className="font-semibold text-brand-orange">{streak} / {sj.target} يوم</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-brand-orange transition-all duration-700" style={{ width: `${sj.pct}%` }} />
      </div>

      {/* weight / waist goal */}
      {mj && (
        <>
          <div className="mb-1 mt-3 flex justify-between text-xs">
            <span className="text-slate-400">🎯 {getGoalLabel(profile.goal)}</span>
            <span className="font-semibold text-accent">
              {mj.journey.reached ? "تم! 🎉" : `باقي ${mj.journey.remaining} ${mj.unit}`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${mj.journey.pct}%` }} />
          </div>
        </>
      )}
    </Card>
  );
}
