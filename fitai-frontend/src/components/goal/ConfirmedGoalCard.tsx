// src/components/goal/ConfirmedGoalCard.tsx
//
// NEW (Task 6) — replaces GoalJourneyCard's old weight/waist journey for any
// user with goalConfirmedByAI === true (i.e. went through the Task 4 chat
// negotiation). Shows TWO tiers, per goal type:
//   • main — the long-distance destination (big headline indicator)
//   • mini — the near-term motivational step (secondary, below)
// Pre-existing users who never went through that flow keep seeing the old
// card unchanged — see the branch in GoalJourneyCard.tsx.

import { Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getGoalLabel } from "@/lib/goalLabels";
import { computeJourney, computeMilestones, motivationMessage, ratioPct } from "@/lib/goalTracker";
import type { GoalMetric, GoalSummary } from "@/features/progress/progressSlice";

// ── A single "journey" metric (body fat %, weight, lean mass) — has a real
// start point, so it gets the full journey treatment (bar + milestones).
function JourneyRow({
  metric, title, big, streak,
}: { metric: Extract<GoalMetric, { kind: "journey" }>; title: string; big?: boolean; streak: number }) {
  const j = computeJourney(metric.start, metric.current, metric.target, metric.direction);
  const milestones = big ? [] : computeMilestones(metric.start, metric.target, metric.current, metric.direction);
  const nextIdx = milestones.findIndex((m) => !m.reached);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={big ? "text-sm font-bold text-slate-300" : "text-xs text-slate-500"}>{title}</span>
        <span className={big ? "text-lg font-black text-accent" : "text-xs font-semibold text-accent"}>{j.pct}%</span>
      </div>
      <div className={big ? "h-3 w-full overflow-hidden rounded-full bg-white/5" : "h-2 w-full overflow-hidden rounded-full bg-white/5"}>
        <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${j.pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-400">
        <span>{metric.current} {metric.unit}</span>
        <span>{j.reached ? "🎉 وصلت لهدفك!" : `الهدف ${metric.target} ${metric.unit}`}</span>
      </div>
      {milestones.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {milestones.map((m, i) => (
            <span
              key={m.value}
              className={
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all " +
                (m.reached
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : i === nextIdx
                  ? "border-brand-orange/30 text-brand-orange"
                  : "border-white/10 text-slate-600")
              }
            >
              {m.reached ? "✓ " : i === nextIdx ? "🎯 " : ""}{m.value} {metric.unit}
            </span>
          ))}
        </div>
      )}
      {big && <p className="mt-3 text-sm text-slate-300">{motivationMessage(j.pct, j.reached, streak)}</p>}
    </div>
  );
}

// ── A "ratio" metric (endurance) — no start point, just current vs target.
function RatioRow({ metric, title, big }: { metric: Extract<GoalMetric, { kind: "ratio" }>; title: string; big?: boolean }) {
  const pct = ratioPct(metric.current, metric.target);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={big ? "text-sm font-bold text-slate-300" : "text-xs text-slate-500"}>{title}</span>
        <span className={big ? "text-lg font-black text-accent" : "text-xs font-semibold text-accent"}>{pct}%</span>
      </div>
      <div className={big ? "h-3 w-full overflow-hidden rounded-full bg-white/5" : "h-2 w-full overflow-hidden rounded-full bg-white/5"}>
        <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-400">
        <span>{metric.current} {metric.unit}</span>
        <span>{pct >= 100 ? "🎉 وصلت لهدفك!" : `الهدف ${metric.target} ${metric.unit}`}</span>
      </div>
    </div>
  );
}

// ── A "lifts" metric (strength) — three simultaneous ratio bars.
function LiftsRow({ metric, title }: { metric: Extract<GoalMetric, { kind: "lifts" }>; title: string }) {
  return (
    <div>
      <span className="mb-2 block text-xs text-slate-500">{title}</span>
      <div className="space-y-3">
        {metric.lifts.map((lift) => {
          const pct = ratioPct(lift.current, lift.target);
          return (
            <div key={lift.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-300">{lift.label}</span>
                <span className="font-semibold text-accent">{lift.current}/{lift.target} {metric.unit} ({pct}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricSection({ metric, title, big, streak }: { metric: GoalMetric; title: string; big?: boolean; streak: number }) {
  if (metric.kind === "journey") return <JourneyRow metric={metric} title={title} big={big} streak={streak} />;
  if (metric.kind === "ratio")   return <RatioRow   metric={metric} title={title} big={big} />;
  return <LiftsRow metric={metric} title={title} />;
}

export function ConfirmedGoalCard({ goal, summary, streak }: { goal: string; summary: GoalSummary; streak: number }) {
  const { main, mini } = summary;

  // No data yet for either tier (e.g. muscle_gain's lean-mass mini needs body-fat
  // data that isn't in yet) — gentle prompt, same tone as the old card's empty state.
  if (!main && !mini) {
    return (
      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" />
          <h3 className="font-bold">رحلة هدفك — {getGoalLabel(goal)}</h3>
        </div>
        <p className="mt-3 text-sm text-slate-400">أضف قياساتك في صفحة التقدّم لنبدأ تتبّع هدفك 📏</p>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-accent" />
        <h3 className="font-bold">رحلة هدفك — {getGoalLabel(goal)}</h3>
      </div>

      {main && <MetricSection metric={main} title="هدفك النهائي" big streak={streak} />}

      {main && mini && <div className="my-4 border-t border-white/5" />}

      {mini && <MetricSection metric={mini} title="الخطوة القريبة" streak={streak} />}
    </Card>
  );
}
