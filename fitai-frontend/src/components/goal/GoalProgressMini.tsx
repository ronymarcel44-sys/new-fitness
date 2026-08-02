// src/components/goal/GoalProgressMini.tsx
//
// A compact at-a-glance version of the goal journeys for the Dashboard: the
// universal streak bar, plus a goal-progress bar. Links to the full Progress
// page (and, for confirmed goals, further to the new Goal Details page).
//
// UPDATE (goal redesign) — the goal-progress bar now branches: users who
// confirmed a goal via the AI chat (goalConfirmedByAI) see the new overall
// weighted percentage; everyone else keeps seeing the old weight/waist bar,
// unchanged. This was the missing piece from the original Task 8 — the
// widget that was meant to fill this spot (ConfirmedGoalMini.tsx) was built
// against the old data shape and never wired up here; rather than resurrect
// it, this file now handles both cases itself, matching how
// GoalJourneyCard.tsx already branches for the full Progress-page card.

import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { useAppSelector } from "@/app/hooks";
import { getGoalLabel } from "@/lib/goalLabels";
import { streakJourney, resolveMetricJourney } from "@/lib/goalTracker";

export function GoalProgressMini() {
  const navigate = useNavigate();
  const { profile }                                  = useAppSelector((s) => s.user);
  const { streak, weightData, waistData, goalSummary } = useAppSelector((s) => s.progress);

  if (!profile.goal) return null;

  const sj = streakJourney(streak);
  const confirmed = profile.goalConfirmedByAI && goalSummary && goalSummary.overallPct != null;

  // Old weight/waist bar — only needed as a fallback for unconfirmed goals,
  // so skip computing it entirely once a confirmed goalSummary is available.
  const mj = confirmed ? null : resolveMetricJourney(profile.goal, {
    weight:       parseFloat(profile.weight || "") || weightData[weightData.length - 1]?.weight,
    waist:        parseFloat(profile.waist  || "") || waistData[waistData.length - 1],
    startWeight:  parseFloat(profile.startWeight || "") || weightData[0]?.weight,
    startWaist:   parseFloat(profile.startWaist  || "") || waistData[0],
    targetWeight: profile.targetWeight ? parseFloat(profile.targetWeight) : null,
  });

  return (
    <Card
      className={confirmed ? "mb-6 cursor-pointer" : "mb-6"}
      onClick={confirmed ? () => navigate("/goal-details") : undefined}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">🎯 رحلتك</h3>
        <Link to="/progress" className="text-xs text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
          التفاصيل ←
        </Link>
      </div>

      {/* streak (universal) */}
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-400">🔥 الالتزام</span>
        <span className="font-semibold text-brand-orange">{streak} / {sj.target} يوم</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-brand-orange transition-all duration-700" style={{ width: `${sj.pct}%` }} />
      </div>

      {/* goal progress — confirmed-goal overall %, or the old weight/waist bar */}
      {confirmed && goalSummary && (
        <>
          <div className="mb-1 mt-3 flex justify-between text-xs">
            <span className="text-slate-400">🎯 {getGoalLabel(profile.goal)}</span>
            <span className="font-semibold text-accent">
              {goalSummary.overallPct! >= 100 ? "تم! 🎉" : `${goalSummary.overallPct}%`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${goalSummary.overallPct}%` }} />
          </div>
        </>
      )}
      {!confirmed && mj && (
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
