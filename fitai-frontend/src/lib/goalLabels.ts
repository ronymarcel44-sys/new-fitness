// Single source of truth for Arabic display strings of the 7 goal types.
// Used wherever the UI shows a goal label. The backend has a mirror map in
// src/lib/userContext.ts — keep them in sync if either changes.

import type { GoalKey } from "../types";

export const GOAL_LABEL_AR: Record<GoalKey, string> = {
  fat_loss:           "خسارة دهون",
  muscle_gain:        "بناء عضلات",
  body_recomposition: "إعادة تشكيل الجسم",
  toning:             "نحت وتقوية",
  strength:           "زيادة القوة",
  general_fitness:    "لياقة عامة",
  endurance:          "تحمل ولياقة قلبية",
};

// Returns the Arabic label for a goal key, or "—" if the value is empty
// or unrecognized. Defensive against stale Redux caches that might still
// hold an old free-text value from before Phase 2B.0.
export function getGoalLabel(goal: string): string {
  if (!goal) return "—";
  return GOAL_LABEL_AR[goal as GoalKey] ?? "—";
}
