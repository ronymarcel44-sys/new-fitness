// src/components/goal/StreakJourneyCard.tsx
//
// The UNIVERSAL primary goal card ("رحلة الالتزام") — shown for every user
// regardless of their goal type. Tracks the consistency streak toward the next
// milestone badge. Reads streak + bestStreak from the progress slice.

import { Flame } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";
import { STREAK_LADDER, streakJourney, streakMessage } from "@/lib/goalTracker";

export function StreakJourneyCard() {
  const { streak, bestStreak } = useAppSelector((s) => s.progress);
  const { pct, remaining, target } = streakJourney(streak);

  return (
    <Card className="mb-6 border-brand-orange/20">
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-brand-orange" />
          <h3 className="font-bold">رحلة الالتزام</h3>
        </div>
        {bestStreak > 0 && (
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
            أطول سلسلة: {bestStreak} يوم
          </span>
        )}
      </div>

      {/* big streak number */}
      <div className="mb-4 flex items-end gap-2">
        <span className="text-5xl font-black text-brand-orange">{streak}</span>
        <span className="mb-1.5 text-sm text-slate-400">يوم متتالي 🔥</span>
      </div>

      {/* progress to next milestone */}
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-slate-400">الوسام القادم</span>
        <span className="font-semibold text-brand-orange">{streak} / {target} يوم</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-brand-orange transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* milestone ladder */}
      <div className="mt-4 flex flex-wrap gap-2">
        {STREAK_LADDER.map((m) => {
          const reached = streak >= m;
          const isNext  = m === target;
          return (
            <span
              key={m}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                reached
                  ? "border-brand-orange/40 bg-brand-orange/15 text-brand-orange"
                  : isNext
                  ? "border-brand-orange/30 text-brand-orange"
                  : "border-white/10 text-slate-600",
              )}
            >
              {reached ? "✓ " : isNext ? "🎯 " : ""}{m} يوم
            </span>
          );
        })}
      </div>

      {/* motivation line */}
      <p className="mt-4 text-sm text-slate-300">{streakMessage(streak, remaining)}</p>
    </Card>
  );
}
