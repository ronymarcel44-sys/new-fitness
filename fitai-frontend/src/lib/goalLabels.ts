// Single source of truth for Arabic display strings of the 5 goal types
// (goal redesign — was 7, `toning`/`general_fitness`/`endurance` removed,
// `bodybuilding` added). Used wherever the UI shows a goal label. The backend
// has a mirror map in src/lib/userContext.ts — keep them in sync if either
// changes.

import type { GoalKey } from "../types";

export const GOAL_LABEL_AR: Record<GoalKey, string> = {
  fat_loss:           "خسارة دهون",
  muscle_gain:        "بناء عضلات",
  bodybuilding:       "تضخيم عضلي",
  body_recomposition: "إعادة تشكيل الجسم",
  strength:           "زيادة القوة",
};

// Returns the Arabic label for a goal key, or "—" if the value is empty
// or unrecognized. Defensive against stale Redux caches that might still
// hold an old free-text value from before Phase 2B.0, or one of the 3
// removed goals from an older account.
export function getGoalLabel(goal: string): string {
  if (!goal) return "—";
  return GOAL_LABEL_AR[goal as GoalKey] ?? "—";
}
