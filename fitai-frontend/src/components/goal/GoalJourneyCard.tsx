// src/components/goal/GoalJourneyCard.tsx
//
// The SECONDARY, goal-specific journey card, branching on the user's goal:
//   • weight goals (fat_loss/toning/muscle_gain) → weight journey, editable target
//   • body_recomposition                          → waist journey (auto target)
//   • strength/endurance/general_fitness          → goal-flavored copy (the streak
//     card above is their real journey)
// The universal streak card is rendered separately, above this one.

import { useState } from "react";
import { Target, Pencil, Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setProfile, saveProfileThunk } from "@/features/user/userSlice";
import { getGoalLabel } from "@/lib/goalLabels";
import { cn } from "@/lib/utils";
import {
  isWeightGoal, isWaistGoal, isConsistencyGoal, consistencyFlavor,
  resolveMetricJourney, motivationMessage,
} from "@/lib/goalTracker";
import { ConfirmedGoalCard } from "./ConfirmedGoalCard"; // NEW (Task 6)

const CONSISTENCY_GOALS = ["strength", "endurance", "general_fitness"];

export function GoalJourneyCard({ view = "primary" }: { view?: "primary" | "supporting" }) {
  const dispatch = useAppDispatch();
  const { profile }                                  = useAppSelector((s) => s.user);
  const { weightData, waistData, streak, goalSummary } = useAppSelector((s) => s.progress);

  const goal = profile.goal;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");

  // NEW (Task 6) — users who've been through the AI goal-confirmation flow get
  // the new main+mini card instead of the old weight/waist one. Pre-existing
  // users (goalConfirmedByAI still false) fall through to the unchanged code
  // below, so nothing breaks for anyone who hasn't done the new onboarding.
  if (profile.goalConfirmedByAI && goalSummary) {
    return <ConfirmedGoalCard goal={goal} summary={goalSummary} streak={streak} view={view} />;
  }

  // Legacy / unconfirmed accounts have no supporting split — their fallback
  // journey card belongs only on the main tab.
  if (view === "supporting") return null;

  // ── Consistency goals: the streak card above is their journey; show a flavor card.
  if (isConsistencyGoal(goal)) {
    if (!CONSISTENCY_GOALS.includes(goal)) return null;   // unknown/empty goal → nothing
    return (
      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" />
          <h3 className="font-bold">هدفك — {getGoalLabel(goal)}</h3>
        </div>
        <p className="mt-3 text-sm text-slate-300">{consistencyFlavor(goal)}</p>
        <p className="mt-1 text-xs text-slate-500">رحلتك تُقاس بالتزامك اليومي — حافظ على سلسلتك أعلاه 🔥</p>
      </Card>
    );
  }

  const waistMode = isWaistGoal(goal);
  if (!waistMode && !isWeightGoal(goal)) return null;

  const mj = resolveMetricJourney(goal, {
    weight:       parseFloat(profile.weight || "") || weightData[weightData.length - 1]?.weight,
    waist:        parseFloat(profile.waist  || "") || waistData[waistData.length - 1],
    startWeight:  parseFloat(profile.startWeight || "") || weightData[0]?.weight,
    startWaist:   parseFloat(profile.startWaist  || "") || waistData[0],
    targetWeight: profile.targetWeight ? parseFloat(profile.targetWeight) : null,
  });

  // No data yet — gentle prompt (waist is optional, weight is set at onboarding).
  if (!mj) {
    return (
      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" />
          <h3 className="font-bold">رحلة هدفك — {getGoalLabel(goal)}</h3>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          {waistMode ? "أضف قياس خصرك في الأسفل لنبدأ تتبّع هدفك 📏" : "أضف وزنك لنبدأ تتبّع هدفك ⚖️"}
        </p>
      </Card>
    );
  }

  const { unit, start, current, target, journey, milestones, userSetTarget } = mj;
  const nextIdx = milestones.findIndex((m) => !m.reached);
  const canEdit = !waistMode;   // only the weight target is user-editable in v1

  const saveTarget = () => {
    const val = draft.trim();   // "" → revert to auto target
    dispatch(setProfile({ targetWeight: val }));
    dispatch(saveProfileThunk({ ...profile, targetWeight: val }));
    setEditing(false);
  };

  return (
    <Card className="mb-6">
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" />
          <h3 className="font-bold">
            رحلة هدفك — {getGoalLabel(goal)}
            {waistMode && <span className="mr-2 text-xs font-normal text-slate-500">(محيط الخصر)</span>}
          </h3>
        </div>
        {canEdit && !editing && (
          <button
            onClick={() => { setDraft(userSetTarget ? String(target) : ""); setEditing(true); }}
            className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-accent"
          >
            <Pencil className="h-3 w-3" /> تعديل الهدف
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number" value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="الوزن المستهدف (كغ) — اتركه فارغاً للهدف التلقائي"
            className="input-base flex-1" autoFocus
          />
          <button onClick={saveTarget}
            className="rounded-xl border border-accent/30 bg-accent/15 p-2.5 text-accent transition-all hover:bg-accent/25">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => setEditing(false)}
            className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition-all hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          {/* start → current → target */}
          <div className="mb-3 flex items-end justify-between">
            <div className="text-center">
              <div className="text-xs text-slate-500">البداية</div>
              <div className="font-bold text-slate-300">{start} {unit}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500">الحالي</div>
              <div className="text-2xl font-black text-accent">{current} {unit}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500">الهدف{!userSetTarget && " (تلقائي)"}</div>
              <div className="font-bold text-brand-orange">{target} {unit}</div>
            </div>
          </div>

          {/* progress bar */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${journey.pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            <span className="text-slate-400">{journey.reached ? "🎉 وصلت لهدفك!" : `باقي ${journey.remaining} ${unit}`}</span>
            <span className="font-semibold text-accent">{journey.pct}%</span>
          </div>

          {/* milestones — the "small goals" */}
          {milestones.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {milestones.map((m, i) => (
                <span key={m.value} className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                  m.reached
                    ? "border-accent/40 bg-accent/15 text-accent"
                    : i === nextIdx
                    ? "border-brand-orange/30 text-brand-orange"
                    : "border-white/10 text-slate-600",
                )}>
                  {m.reached ? "✓ " : i === nextIdx ? "🎯 " : ""}{m.value} {unit}
                </span>
              ))}
            </div>
          )}

          {/* motivation */}
          <p className="mt-4 text-sm text-slate-300">{motivationMessage(journey.pct, journey.reached, streak)}</p>
        </>
      )}
    </Card>
  );
}
