// src/components/goal/AchievementsCard.tsx
//
// "إنجازاتك" — a universal badge grid. Badges are DERIVED from current data
// (weight history, milestones reached on the primary metric, goal reached,
// bestStreak), so there's nothing extra to persist.

import { Card } from "@/components/ui/Card";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";
import { resolveMetricJourney, computeAchievements } from "@/lib/goalTracker";

export function AchievementsCard() {
  const { profile }                           = useAppSelector((s) => s.user);
  const { weightData, waistData, bestStreak } = useAppSelector((s) => s.progress);
  const goal = profile.goal;

  // Milestone / goal progress on the primary metric (weight or waist). For
  // consistency goals this is null — those users earn the streak badges.
  const mj = resolveMetricJourney(goal, {
    weight:       parseFloat(profile.weight || "") || weightData[weightData.length - 1]?.weight,
    waist:        parseFloat(profile.waist  || "") || waistData[waistData.length - 1],
    startWeight:  parseFloat(profile.startWeight || "") || weightData[0]?.weight,
    startWaist:   parseFloat(profile.startWaist  || "") || waistData[0],
    targetWeight: profile.targetWeight ? parseFloat(profile.targetWeight) : null,
  });
  const milestonesReached = mj ? mj.milestones.filter((m) => m.reached).length : 0;
  const goalReached       = mj ? mj.journey.reached : false;

  const achievements = computeAchievements({
    hasWeightHistory: weightData.length >= 1,
    milestonesReached,
    goalReached,
    bestStreak,
  });

  return (
    <Card className="mb-6">
      <h3 className="mb-4 font-bold">🏆 إنجازاتك</h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {achievements.map((a) => (
          <div
            key={a.id}
            title={a.label}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all",
              a.unlocked ? "border-accent/30 bg-accent/5" : "border-white/5 opacity-40",
            )}
          >
            <span className={cn("text-3xl", !a.unlocked && "grayscale")}>{a.emoji}</span>
            <span className={cn("text-[11px] font-semibold leading-tight", a.unlocked ? "text-slate-200" : "text-slate-600")}>
              {a.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
