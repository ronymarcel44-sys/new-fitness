// src/components/goal/ConfirmedGoalCard.tsx
//
// Goal redesign — single target per metric. Now renders one of two VIEWS,
// driven by the Progress-page tabs:
//   • view="primary"    → overall % bar + motivation + the PRIMARY metric bars
//                         (the targets the user negotiated with the AI).
//   • view="supporting" → the SUPPORTING metric bars + reference chips, no
//                         overall bar. Renders nothing if there's nothing to show.
// The Goal Details page (tapped from the primary card) still shows everything.

import { useNavigate } from "react-router-dom";
import { Target, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getGoalLabel } from "@/lib/goalLabels";
import { motivationMessage } from "@/lib/goalTracker";
import type { GoalProgress, GoalMetricData, InformationalMetric } from "@/features/progress/progressSlice";

function MetricBar({ metric }: { metric: GoalMetricData }) {
  const pct = metric.progressPct;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-slate-500">{metric.label}</span>
        <span className="text-xs font-semibold text-accent">
          {pct != null ? `${pct}%` : "لا توجد بيانات كافية بعد"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      {/* Start → Current → Target — always the real numbers, not just the percentage */}
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
        <span>{metric.start   != null ? `البداية ${metric.start} ${metric.unit}`   : "—"}</span>
        <span>{metric.current != null ? `الحالي ${metric.current} ${metric.unit}`  : "—"}</span>
        <span>{metric.target  != null ? `الهدف ${metric.target} ${metric.unit}`    : "—"}</span>
      </div>
    </div>
  );
}

// Info row: a start → current measurement with no target (body fat, a lift on a
// physique goal). Change % is coloured by which direction is "good".
function InfoRow({ item }: { item: InformationalMetric }) {
  const { start, current, unit, direction } = item;
  const change = start != null && current != null ? Math.round((current - start) * 10) / 10 : null;
  const good   = change != null && (direction === "down" ? change < 0 : change > 0);
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-400">{item.label}</span>
      <span className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{start != null ? `البداية ${start}${unit}` : "—"}</span>
        <span className="font-semibold text-slate-200">{current != null ? `الحالي ${current}${unit}` : "—"}</span>
        {change != null && change !== 0 && (
          <span className={good ? "text-accent" : "text-brand-orange"}>
            {change < 0 ? "↓" : "↑"} {Math.abs(change)}{unit}
          </span>
        )}
      </span>
    </div>
  );
}

export function ConfirmedGoalCard({
  goal, summary, streak, view,
}: { goal: string; summary: GoalProgress; streak: number; view: "primary" | "supporting" }) {
  const navigate = useNavigate();
  const { metrics, reference, overallPct } = summary;

  const primaryMetrics    = metrics.filter((m) => m.primary);
  const supportingMetrics = metrics.filter((m) => !m.primary);

  // ── Supporting view: supporting bars + reference chips, no overall/motivation ──
  if (view === "supporting") {
    const informational = summary.informational ?? [];
    if (supportingMetrics.length === 0 && informational.length === 0 && reference.length === 0) return null;
    return (
      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" />
          <h3 className="font-bold">قياسات وأهداف داعمة</h3>
        </div>

        {informational.length > 0 && (
          <div className="space-y-3">
            {informational.map((it) => <InfoRow key={it.label} item={it} />)}
          </div>
        )}

        {supportingMetrics.length > 0 && (
          <>
            {informational.length > 0 && <div className="my-4 border-t border-white/5" />}
            <div className="space-y-4">
              {supportingMetrics.map((m) => <MetricBar key={m.label} metric={m} />)}
            </div>
          </>
        )}

        {reference.length > 0 && (
          <>
            {(informational.length > 0 || supportingMetrics.length > 0) && <div className="my-4 border-t border-white/5" />}
            <span className="mb-2 block text-xs text-slate-500">قياسات إضافية (مرجعية، بدون هدف محدد)</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {reference.map((r) => (
                <div key={r.label} className="rounded-lg bg-white/5 px-3 py-2 text-center">
                  <div className="text-xs text-slate-500">{r.label}</div>
                  <div className="text-sm font-semibold text-slate-200">
                    {r.current != null ? `${r.current} ${r.unit}` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    );
  }

  // ── Primary view: overall % + motivation + primary bars (tap → details) ──
  if (overallPct == null) {
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
    <Card
      className="mb-6 cursor-pointer"
      onClick={() => navigate("/goal-details")}
      role="button"
      aria-label="عرض تفاصيل هدفك"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-300">رحلة هدفك — {getGoalLabel(goal)}</h3>
        <ChevronLeft className="h-5 w-5 text-slate-500" />
      </div>

      {/* HUD ring — overall progress (equal-weight avg of primary metrics, plan A4) */}
      <div className="flex flex-col items-center pb-1 pt-2">
        <div
          className="relative grid h-[190px] w-[190px] place-items-center rounded-full transition-all duration-700"
          style={{
            background: `conic-gradient(#00E5A0 0% ${overallPct}%, rgba(255,255,255,0.06) ${overallPct}% 100%)`,
            filter: "drop-shadow(0 0 24px rgba(0,229,160,0.28))",
          }}
        >
          <div
            className="absolute inset-[13px] rounded-full"
            style={{ background: "radial-gradient(circle at 50% 32%, #131a2c, #0b1020)" }}
          />
          <div className="relative text-center">
            <div className="text-[52px] font-black leading-none">
              {overallPct}<span className="text-2xl text-accent">%</span>
            </div>
            <div className="mt-1.5 text-xs font-bold text-slate-500">التقدّم الكلي</div>
          </div>
        </div>
        <p className="mt-4 max-w-xs text-center text-sm leading-relaxed text-slate-300">
          {motivationMessage(overallPct, overallPct >= 100, streak)}
        </p>
      </div>

      <div className="my-4 border-t border-white/5" />

      <div className="space-y-4">
        {primaryMetrics.map((m) => (
          <MetricBar key={m.label} metric={m} />
        ))}
      </div>
    </Card>
  );
}
