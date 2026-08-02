// fitai-backend/src/lib/bodyFat.ts
//
// Navy Body Fat Formula utility + small shared body-composition math.
// Pure calculation functions only: no DB access, no Express req/res.
// Callers (routes, other lib files) are responsible for fetching whatever
// data these functions need (latest ProgressEntry, User row, etc.).

// ─── Shared types ───────────────────────────────────────────────────────────

export type Gender = "male" | "female";

// CLEANUP (goal redesign) — synced to the final 5-goal list. Mirrors the
// GoalKey union in fitai-frontend/src/types/index.ts and the GOAL_AR map in
// fitai-backend/src/lib/userContext.ts — keep all three in sync if this changes.
// `toning` / `general_fitness` / `endurance` were removed from the product;
// `bodybuilding` was added.
export type GoalKey =
  | "fat_loss"
  | "muscle_gain"
  | "bodybuilding"
  | "body_recomposition"
  | "strength";

// ─── calculateBodyFat — Navy formula ────────────────────────────────────────

export interface BodyFatInput {
  gender: Gender;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipsCm?: number; // required for female, ignored for male
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Body fat % via the US Navy circumference method.
// Male:   495 / (1.0324 - 0.19077*log10(waist-neck) + 0.15456*log10(height)) - 450
// Female: 495 / (1.29579 - 0.35004*log10(waist+hip-neck) + 0.22100*log10(height)) - 450
// All measurements in centimeters.
export function calculateBodyFat(input: BodyFatInput): number {
  const { gender, heightCm, waistCm, neckCm, hipsCm } = input;

  if (gender === "male") {
    const bfp =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waistCm - neckCm) +
          0.15456 * Math.log10(heightCm)) -
      450;
    return round1(bfp);
  }

  if (gender === "female") {
    if (hipsCm == null) {
      throw new Error(
        "calculateBodyFat: hipsCm is required for the female Navy formula"
      );
    }
    const bfp =
      495 /
        (1.29579 -
          0.35004 * Math.log10(waistCm + hipsCm - neckCm) +
          0.221 * Math.log10(heightCm)) -
      450;
    return round1(bfp);
  }

  throw new Error(`calculateBodyFat: unsupported gender "${gender}"`);
}

// ─── leanMassFromBodyFat ─────────────────────────────────────────────────
//
// Shared by progressReader.ts for both the Muscle Mass metric's Start/Current
// values (fat_loss's currentBodyFatPct feeds this) and the auto-calculated
// Muscle Mass / Weight targets for muscle_gain and body_recomposition — kept
// here as the single canonical implementation rather than duplicated.
export function leanMassFromBodyFat(weightKg: number, bodyFatPct: number): number {
  return round1(weightKg * (1 - bodyFatPct / 100));
}

// CLEANUP (goal redesign) — the old recommendGoalTargets() safer/ambitious
// recommendation engine was removed here. It was never called by the live AI
// flow (the AI negotiates the single main target directly in conversation,
// per goal-tracking-redesign-plan.md Part A), and its goal list (toning/
// endurance/general_fitness, no bodybuilding) no longer matches the product.
// calculateBodyFat() and leanMassFromBodyFat() above are the only pieces of
// this file that were actually in use, and both are kept.
