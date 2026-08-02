// src/lib/goalTracker.ts
//
// Pure goal-tracking logic for the "رحلة هدفك" feature — no React, no Redux,
// so it's trivially testable. Two layers:
//   1) Streak journey  — the UNIVERSAL primary goal (every user, any goal type).
//   2) Weight journey  — a SECONDARY goal for weight-based goals (auto target,
//      rolling, with milestones).
// Plus achievements + motivational copy.

export type Direction = "up" | "down";

// ── Goal classification ───────────────────────────────────────────────────────
// Intentionally typed as string[], not GoalKey[] — these arrays exist to keep
// this OLD card's fallback working correctly for legacy accounts whose
// `goal` value is one of the 3 removed from the product (goal redesign).
// GoalKey itself no longer includes "toning", so it can't type these.
const WEIGHT_GOALS: string[] = ["fat_loss", "toning", "muscle_gain"];
const DOWN_GOALS:   string[] = ["fat_loss", "toning", "body_recomposition"];
const WEIGHT_CHUNK: Record<string, number> = { fat_loss: 5, toning: 5, muscle_gain: 3 };

export function isWeightGoal(goal: string): boolean {
  return WEIGHT_GOALS.includes(goal);
}

// Recomposition tracks waist, not weight.
export function isWaistGoal(goal: string): boolean {
  return goal === "body_recomposition";
}

// strength / endurance / general_fitness (and any unknown/empty goal) → the
// streak journey is the whole story.
export function isConsistencyGoal(goal: string): boolean {
  return !isWeightGoal(goal) && !isWaistGoal(goal);
}

export function goalDirection(goal: string): Direction {
  return DOWN_GOALS.includes(goal) ? "down" : "up";
}

// ── Weight journey ────────────────────────────────────────────────────────────

// Auto (rolling) target, anchored to the START weight so it always stays a
// reachable near-term goal. e.g. fat_loss start 80 → 75, then 70, then 65 …
export function autoTargetWeight(goal: string, start: number, current: number): number | null {
  if (!isWeightGoal(goal)) return null;
  const chunk = WEIGHT_CHUNK[goal] ?? 5;
  if (goalDirection(goal) === "down") {
    const passed = Math.floor(Math.max(0, start - current) / chunk);
    return round1(start - chunk * (passed + 1));
  }
  const passed = Math.floor(Math.max(0, current - start) / chunk);
  return round1(start + chunk * (passed + 1));
}

// Auto (rolling) waist target for body-recomposition — 4 cm chunks downward,
// anchored to the start waist so it stays reachable.
export function autoWaistTarget(start: number, current: number): number {
  const chunk = 4;
  const passed = Math.floor(Math.max(0, start - current) / chunk);
  return round1(start - chunk * (passed + 1));
}

// Goal-flavored encouragement for the consistency goals (no weight/waist metric).
export function consistencyFlavor(goal: string): string {
  switch (goal) {
    case "strength":        return "كل تمرين يقرّبك من قوة أكبر 💪";
    case "endurance":       return "الثبات يبني تحمّلك يوماً بعد يوم 🏃";
    case "general_fitness": return "الالتزام اليومي هو أساس لياقتك ⚡";
    default:                return "الثبات هو طريقك للنجاح 🔥";
  }
}

export interface Journey {
  pct:        number;   // 0..100
  remaining:  number;   // units still to go (>= 0)
  done:       number;   // units already covered (>= 0)
  reached:    boolean;
  start:      number;
  current:    number;
  target:     number;
  direction:  Direction;
}

export function computeJourney(
  start: number, current: number, target: number, direction: Direction,
): Journey {
  const total = direction === "down" ? start - target : target - start;
  const done  = direction === "down" ? start - current : current - start;
  const pct   = total > 0 ? clamp((done / total) * 100, 0, 100) : 0;
  const reached   = direction === "down" ? current <= target : current >= target;
  const remaining = Math.max(0, direction === "down" ? current - target : target - current);
  return {
    pct: Math.round(pct), remaining: round1(remaining), done: round1(Math.max(0, done)),
    reached, start, current, target, direction,
  };
}

export interface Milestone { value: number; reached: boolean; }

// Split the start→target range into ~1-unit checkpoints (capped at 6) — these
// are the "small goals" the user chases one at a time.
export function computeMilestones(
  start: number, target: number, current: number, direction: Direction,
): Milestone[] {
  const range = Math.abs(start - target);
  if (range <= 0) return [];
  const count = Math.min(6, Math.max(1, Math.round(range)));
  const step  = range / count;
  const out: Milestone[] = [];
  for (let i = 1; i <= count; i++) {
    const value   = direction === "down" ? round1(start - step * i) : round1(start + step * i);
    const reached = direction === "down" ? current <= value : current >= value;
    out.push({ value, reached });
  }
  return out;
}

// Resolves the goal-specific metric journey (weight or waist) from raw inputs,
// so every card computes it identically. Returns null for consistency goals or
// when there's no data yet.
export interface MetricJourney {
  kind:          "weight" | "waist";
  unit:          string;
  start:         number;
  current:       number;
  target:        number;
  direction:     Direction;
  journey:       Journey;
  milestones:    Milestone[];
  userSetTarget: boolean;
}

export function resolveMetricJourney(
  goal: string,
  opts: { weight?: number; waist?: number; startWeight?: number; startWaist?: number; targetWeight?: number | null },
): MetricJourney | null {
  const waistMode = isWaistGoal(goal);
  if (!waistMode && !isWeightGoal(goal)) return null;

  const current = waistMode ? (opts.waist ?? 0) : (opts.weight ?? 0);
  if (current <= 0) return null;

  const start   = waistMode ? (opts.startWaist ?? current) : (opts.startWeight ?? current);
  const dir: Direction = waistMode ? "down" : goalDirection(goal);
  const userSet = !waistMode && !!opts.targetWeight && opts.targetWeight > 0;
  const target  = waistMode
    ? autoWaistTarget(start, current)
    : (userSet ? (opts.targetWeight as number) : (autoTargetWeight(goal, start, current) ?? current));

  return {
    kind: waistMode ? "waist" : "weight",
    unit: waistMode ? "سم" : "كغ",
    start, current, target, direction: dir,
    journey:    computeJourney(start, current, target, dir),
    milestones: computeMilestones(start, target, current, dir),
    userSetTarget: userSet,
  };
}

// ── Streak journey (universal) ────────────────────────────────────────────────
export const STREAK_LADDER = [7, 14, 30, 60, 90, 180, 365];

export function nextStreakMilestone(streak: number): number {
  for (const m of STREAK_LADDER) if (m > streak) return m;
  return Math.ceil((streak + 1) / 365) * 365;
}

export interface StreakJourney { pct: number; remaining: number; target: number; prev: number; }

export function streakJourney(streak: number): StreakJourney {
  const target = nextStreakMilestone(streak);
  let prev = 0;
  for (const m of STREAK_LADDER) if (m <= streak) prev = m;
  const span = target - prev;
  const pct  = span > 0 ? clamp(((streak - prev) / span) * 100, 0, 100) : 0;
  return { pct: Math.round(pct), remaining: Math.max(0, target - streak), target, prev };
}

// ── Achievements ──────────────────────────────────────────────────────────────
export interface Achievement { id: string; emoji: string; label: string; unlocked: boolean; }

export function computeAchievements(o: {
  hasWeightHistory: boolean;
  milestonesReached: number;
  goalReached: boolean;
  bestStreak: number;
}): Achievement[] {
  return [
    { id: "first_log",        emoji: "⭐", label: "أول قياس",     unlocked: o.hasWeightHistory },
    { id: "first_milestone",  emoji: "🎯", label: "محطة أولى",    unlocked: o.milestonesReached >= 1 },
    { id: "three_milestones", emoji: "🏅", label: "٣ محطات",      unlocked: o.milestonesReached >= 3 },
    { id: "reached_goal",     emoji: "🏆", label: "وصلت لهدفك",   unlocked: o.goalReached },
    { id: "week_streak",      emoji: "🔥", label: "أسبوع التزام", unlocked: o.bestStreak >= 7 },
    { id: "month_streak",     emoji: "👑", label: "شهر التزام",   unlocked: o.bestStreak >= 30 },
  ];
}

// ── Motivation copy ───────────────────────────────────────────────────────────
export function motivationMessage(pct: number, reached: boolean, streak: number): string {
  if (reached) return "وصلت لهدفك! 🎉 جاهز للتحدي القادم؟";
  let base: string;
  if      (pct >= 75) base = "اقتربت جداً، باقي القليل! 💪";
  else if (pct >= 50) base = "أنجزت نصف الطريق، استمر! 🔥";
  else if (pct >= 25) base = "بداية قوية، واصل التقدم 👏";
  else                base = "كل خطوة تقرّبك من هدفك 🚀";
  if (streak >= 3) base += ` · 🔥 ${streak} يوم التزام`;
  return base;
}

export function streakMessage(streak: number, remaining: number): string {
  if (streak === 0) return "ابدأ اليوم — سجّل أول يوم التزام! 🚀";
  if (remaining <= 2) return `باقي ${remaining} يوم فقط للوسام القادم! 💪`;
  return `🔥 ${streak} يوم متواصل — باقي ${remaining} يوم للوسام القادم`;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function clamp(n: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, n)); }
function round1(n: number): number { return Math.round(n * 10) / 10; }

// NEW (Task 6) — for metrics with no meaningful "start" (a lift PR you've never
// attempted, a cardio session you've never done): just current vs target.
export function ratioPct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round(clamp((current / target) * 100, 0, 100));
}
