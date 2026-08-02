// src/pages/GoalDetailsPage.tsx
//
// NEW (goal redesign) — full breakdown of every metric for the user's
// confirmed goal, reachable by tapping the main bar on ConfirmedGoalCard.
// Same data as the compact card (GoalProgress from Redux, already loaded on
// app startup — no extra fetch here), just shown in more detail: milestones
// per metric, and full Start/Current/Target numbers laid out clearly.

import { useNavigate } from "react-router-dom";
import { ArrowRight, Target } from "lucide-react";
import { useAppSelector } from "@/app/hooks";
import { Card } from "@/components/ui/Card";
import { getGoalLabel } from "@/lib/goalLabels";
import { computeMilestones, motivationMessage } from "@/lib/goalTracker";
import type { GoalMetricData } from "@/features/progress/progressSlice";

function MetricDetail({ metric }: { metric: GoalMetricData }) {
  const pct = metric.progressPct;
  const hasFullData = metric.start != null && metric.current != null && metric.target != null;
  const milestones = hasFullData
    ? computeMilestones(metric.start as number, metric.target as number, metric.current as number, metric.direction)
    : [];
  const nextIdx = milestones.findIndex((m) => !m.reached);

  return (
    <Card className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-300">{metric.label}</span>
        <span className="text-base font-black text-accent">
          {pct != null ? `${pct}%` : "لا توجد بيانات كافية بعد"}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="text-center">
          <div className="text-xs text-slate-500">البداية</div>
          <div className="font-bold text-slate-300">
            {metric.start != null ? `${metric.start} ${metric.unit}` : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500">الحالي</div>
          <div className="text-xl font-black text-accent">
            {metric.current != null ? `${metric.current} ${metric.unit}` : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500">الهدف</div>
          <div className="font-bold text-brand-orange">
            {metric.target != null ? `${metric.target} ${metric.unit}` : "—"}
          </div>
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {milestones.map((m, i) => (
            <span
              key={m.value}
              className={
                "rounded-full border px-3 py-1 text-xs font-semibold transition-all " +
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
    </Card>
  );
}

export function GoalDetailsPage() {
  const navigate = useNavigate();
  const { profile } = useAppSelector((s) => s.user);
  const { streak, goalSummary } = useAppSelector((s) => s.progress);

  const goal = profile.goal;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button
        onClick={() => navigate("/progress")}
        className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-accent"
      >
        <ArrowRight className="h-4 w-4" /> رجوع للتقدّم
      </button>

      <div className="mb-6 flex items-center gap-2">
        <Target className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-bold">تفاصيل هدفك — {getGoalLabel(goal)}</h1>
      </div>

      {!profile.goalConfirmedByAI || !goalSummary ? (
        <Card>
          <p className="text-sm text-slate-400">
            لسا ما أكّدت هدفك مع المساعد الذكي — أكمل محادثة الإعداد الأولى عشان نقدر نتابع تقدّمك بالتفصيل.
          </p>
        </Card>
      ) : goalSummary.overallPct == null ? (
        <Card>
          <p className="text-sm text-slate-400">أضف قياساتك في صفحة التقدّم لنبدأ تتبّع هدفك 📏</p>
        </Card>
      ) : (
        <>
          {/* Overall — equal-weight average, computed server-side */}
          <Card className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300">التقدّم الكلي</span>
              <span className="text-2xl font-black text-accent">{goalSummary.overallPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700"
                style={{ width: `${goalSummary.overallPct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {motivationMessage(goalSummary.overallPct, goalSummary.overallPct >= 100, streak)}
            </p>
          </Card>

          {goalSummary.metrics.map((m) => (
            <MetricDetail key={m.label} metric={m} />
          ))}

          {goalSummary.reference.length > 0 && (
            <Card>
              <span className="mb-3 block text-sm font-bold text-slate-300">قياسات إضافية (مرجعية، بدون هدف محدد)</span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {goalSummary.reference.map((r) => (
                  <div key={r.label} className="rounded-lg bg-white/5 px-3 py-2 text-center">
                    <div className="text-xs text-slate-500">{r.label}</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {r.current != null ? `${r.current} ${r.unit}` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
