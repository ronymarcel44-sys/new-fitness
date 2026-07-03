// src/components/goal/MeasurementsProgressCard.tsx
//
// "تطوّر قياساتك" — shows how each body measurement has changed since the user's
// frozen baseline (البداية → الحالي → التغيّر). The change is colored green when
// it moves toward the user's goal direction, orange when away, grey when flat.

import { Card } from "@/components/ui/Card";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";
import { goalDirection } from "@/lib/goalTracker";
import type { UserProfile } from "@/types";

const MEASURES = [
  { key: "chest", startKey: "startChest", label: "الصدر",   emoji: "💪" },
  { key: "waist", startKey: "startWaist", label: "الخصر",   emoji: "📏" },
  { key: "hips",  startKey: "startHips",  label: "الأرداف", emoji: "🍑" },
  { key: "arms",  startKey: "startArms",  label: "الذراع",  emoji: "💪" },
  { key: "legs",  startKey: "startLegs",  label: "الساق",   emoji: "🦵" },
] as const;

const num = (v?: string) => {
  const n = parseFloat(v ?? "");
  return Number.isNaN(n) ? null : n;
};

export function MeasurementsProgressCard() {
  const { profile } = useAppSelector((s) => s.user);

  const rows = MEASURES
    .map((m) => ({
      ...m,
      current: num(profile[m.key as keyof UserProfile] as string | undefined),
      start:   num(profile[m.startKey as keyof UserProfile] as string | undefined),
    }))
    .filter((r) => r.current != null);

  if (rows.length === 0) return null;   // nothing recorded yet

  const dir = goalDirection(profile.goal);   // "down" | "up"

  return (
    <Card className="mb-6">
      <h3 className="mb-4 font-bold">تطوّر قياساتك 📏</h3>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const hasStart = r.start != null;
          const delta = hasStart ? Math.round((r.current! - r.start!) * 10) / 10 : 0;
          const good  = dir === "down" ? delta < 0 : delta > 0;
          const color = !hasStart || delta === 0 ? "text-slate-500" : good ? "text-accent" : "text-brand-orange";
          const arrow = delta === 0 ? "—" : delta < 0 ? "▼" : "▲";

          return (
            <div key={r.key} className="flex items-center gap-3 rounded-xl border border-white/5 bg-bg px-4 py-2.5">
              <span className="text-lg">{r.emoji}</span>
              <span className="w-16 shrink-0 text-sm font-semibold text-slate-300">{r.label}</span>
              <span className="flex-1 text-sm text-slate-400">
                {hasStart ? <>{r.start} <span className="text-slate-600">→</span> {r.current} سم</> : <>{r.current} سم</>}
              </span>
              <span className={cn("shrink-0 text-sm font-bold", color)}>
                {hasStart ? `${arrow} ${delta === 0 ? "" : Math.abs(delta)}`.trim() : "— البداية"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-600">القيم تُقاس منذ أول تسجيل لكل قياس.</p>
    </Card>
  );
}
