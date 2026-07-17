// fitai-backend/src/lib/bodyFat.ts
//
// Task 2 — Navy Body Fat Formula Utility.
// Pure calculation functions only: no DB access, no Express req/res.
// Callers (routes, other lib files) are responsible for fetching whatever
// data these functions need (latest ProgressEntry, User row, etc.).

// ─── Shared types ───────────────────────────────────────────────────────────

export type Gender = "male" | "female";

export type FitnessLevel = "beginner" | "intermediate" | "advanced";

// Mirrors the 7 GoalKey values in fitai-frontend/src/types/index.ts and the
// GOAL_AR map in fitai-backend/src/lib/userContext.ts — keep in sync if either changes.
export type GoalKey =
  | "fat_loss"
  | "muscle_gain"
  | "body_recomposition"
  | "toning"
  | "strength"
  | "general_fitness"
  | "endurance";

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

// ─── recommendGoalTargets ───────────────────────────────────────────────────
//
// Per-goal policy, agreed in the Task 2 design discussion:
//   fat_loss            → targetBodyFatPct   (safer -5pp / ambitious -8pp)
//   toning               → targetBodyFatPct   (safer -3pp / ambitious -5pp, lighter than fat_loss)
//   body_recomposition   → targetBodyFatPct + targetLeanMass (safer -4pp/+1kg, ambitious -6pp/+2kg)
//   muscle_gain          → targetLeanMass     (safer +2kg / ambitious +4kg)
//   strength             → targetBenchPress/Squat/Deadlift, as bodyweight multiples
//                           (no prior lift data exists at onboarding time)
//   endurance            → targetCardioDuration, scaled by fitnessLevel
//   general_fitness      → no numeric field is persisted (there isn't one in the
//                           schema); returns a text-only session-frequency note
//                           for the AI to phrase in chat, measured instead by the
//                           existing streak/bestStreak fields
//
// Body-fat targets are clamped so they never recommend below essential-fat
// levels (10% male / 18% female) — the Navy formula also gets unreliable
// near those levels, so this is a floor, not just a health guideline.

const BODY_FAT_FLOOR: Record<Gender, number> = {
  male: 10,
  female: 18,
};

const FAT_LOSS_DELTA = { safer: 5, ambitious: 8 };
const TONING_DELTA = { safer: 3, ambitious: 5 };
const RECOMP_FAT_DELTA = { safer: 4, ambitious: 6 };
const RECOMP_LEAN_GAIN = { safer: 1, ambitious: 2 };
const MUSCLE_GAIN_LEAN_GAIN = { safer: 2, ambitious: 4 };

// Bodyweight multiples for strength targets (no baseline lift data at onboarding)
const STRENGTH_MULTIPLES = {
  safer: { bench: 0.75, squat: 1, deadlift: 1.25 },
  ambitious: { bench: 1, squat: 1.5, deadlift: 1.75 },
};

// Cardio session length (minutes) by fitness level
const ENDURANCE_MINUTES: Record<
  FitnessLevel,
  { safer: number; ambitious: number }
> = {
  beginner: { safer: 20, ambitious: 30 },
  intermediate: { safer: 30, ambitious: 45 },
  advanced: { safer: 45, ambitious: 60 },
};

const GENERAL_FITNESS_SESSIONS = { safer: 3, ambitious: 5 };

export interface GoalTargetInput {
  goal: GoalKey;
  gender: Gender;
  weightKg: number;
  fitnessLevel: FitnessLevel;
  // Computed by the caller via calculateBodyFat() + the user's latest
  // ProgressEntry — this function does not fetch or compute it itself.
  // Required for fat_loss / toning / body_recomposition / muscle_gain.
  currentBodyFatPct?: number | null;
}

// Fields are optional because each goal only populates the ones relevant to it.
export interface GoalTargetSet {
  targetBodyFatPct?: number;
  targetLeanMass?: number;
  targetBenchPress?: number;
  targetSquat?: number;
  targetDeadlift?: number;
  targetCardioDuration?: number;
  // Human-readable Arabic suggestion for goals with no numeric DB field
  // (currently only general_fitness). Not persisted to the User row.
  note?: string;
}

export interface GoalTargetRecommendation {
  safer: GoalTargetSet;
  ambitious: GoalTargetSet;
}

// Rounds a lift target to the nearest 2.5kg — matches standard gym plate increments
function roundToPlate(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

function requireCurrentBodyFat(input: GoalTargetInput): number {
  if (input.currentBodyFatPct == null) {
    throw new Error(
      `recommendGoalTargets: currentBodyFatPct is required for goal "${input.goal}"`
    );
  }
  return input.currentBodyFatPct;
}

// current - delta, clamped to the essential-fat floor for the user's gender
function clampedFatTarget(
  current: number,
  delta: number,
  gender: Gender
): number {
  const floor = BODY_FAT_FLOOR[gender];
  return round1(Math.max(floor, current - delta));
}

function leanMassFromBodyFat(weightKg: number, bodyFatPct: number): number {
  return round1(weightKg * (1 - bodyFatPct / 100));
}

export function recommendGoalTargets(
  input: GoalTargetInput
): GoalTargetRecommendation {
  const { goal, gender, weightKg, fitnessLevel } = input;

  switch (goal) {
    case "fat_loss": {
      const current = requireCurrentBodyFat(input);
      return {
        safer: {
          targetBodyFatPct: clampedFatTarget(current, FAT_LOSS_DELTA.safer, gender),
        },
        ambitious: {
          targetBodyFatPct: clampedFatTarget(current, FAT_LOSS_DELTA.ambitious, gender),
        },
      };
    }

    case "toning": {
      const current = requireCurrentBodyFat(input);
      return {
        safer: {
          targetBodyFatPct: clampedFatTarget(current, TONING_DELTA.safer, gender),
        },
        ambitious: {
          targetBodyFatPct: clampedFatTarget(current, TONING_DELTA.ambitious, gender),
        },
      };
    }

    case "body_recomposition": {
      const current = requireCurrentBodyFat(input);
      const currentLean = leanMassFromBodyFat(weightKg, current);
      return {
        safer: {
          targetBodyFatPct: clampedFatTarget(current, RECOMP_FAT_DELTA.safer, gender),
          targetLeanMass: round1(currentLean + RECOMP_LEAN_GAIN.safer),
        },
        ambitious: {
          targetBodyFatPct: clampedFatTarget(current, RECOMP_FAT_DELTA.ambitious, gender),
          targetLeanMass: round1(currentLean + RECOMP_LEAN_GAIN.ambitious),
        },
      };
    }

    case "muscle_gain": {
      const current = requireCurrentBodyFat(input);
      const currentLean = leanMassFromBodyFat(weightKg, current);
      return {
        safer: {
          targetLeanMass: round1(currentLean + MUSCLE_GAIN_LEAN_GAIN.safer),
        },
        ambitious: {
          targetLeanMass: round1(currentLean + MUSCLE_GAIN_LEAN_GAIN.ambitious),
        },
      };
    }

    case "strength": {
      const s = STRENGTH_MULTIPLES.safer;
      const a = STRENGTH_MULTIPLES.ambitious;
      return {
        safer: {
          targetBenchPress: roundToPlate(weightKg * s.bench),
          targetSquat: roundToPlate(weightKg * s.squat),
          targetDeadlift: roundToPlate(weightKg * s.deadlift),
        },
        ambitious: {
          targetBenchPress: roundToPlate(weightKg * a.bench),
          targetSquat: roundToPlate(weightKg * a.squat),
          targetDeadlift: roundToPlate(weightKg * a.deadlift),
        },
      };
    }

    case "endurance": {
      const minutes = ENDURANCE_MINUTES[fitnessLevel];
      return {
        safer: { targetCardioDuration: minutes.safer },
        ambitious: { targetCardioDuration: minutes.ambitious },
      };
    }

    case "general_fitness": {
      return {
        safer: {
          note: `${GENERAL_FITNESS_SESSIONS.safer} حصص تمرين في الأسبوع`,
        },
        ambitious: {
          note: `${GENERAL_FITNESS_SESSIONS.ambitious} حصص تمرين في الأسبوع`,
        },
      };
    }

    default: {
      // Exhaustiveness check — if a new GoalKey is ever added without
      // handling it here, this will fail to compile.
      const _exhaustive: never = goal;
      throw new Error(`recommendGoalTargets: unhandled goal "${_exhaustive}"`);
    }
  }
}
