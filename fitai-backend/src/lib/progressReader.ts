// fitai-backend/src/lib/progressReader.ts
//
// Task 6 — reads a user's REAL logged progress (no separate log tables — scans
// the data that already exists: WorkoutExercise.actualWeightKg/actualDuration
// across every WorkoutPlan, and the latest ProgressEntry for body composition)
// and packages it against their confirmed goal targets (Task 4/5) for the
// GoalJourneyCard.
//
// Design: this file returns RAW numbers only (start/current/target), no
// percentages or milestones — that logic already exists and is reused as-is
// on the frontend in src/lib/goalTracker.ts (computeJourney/computeMilestones),
// so we don't duplicate it here.

import { prisma } from "./prisma";
import { calculateBodyFat } from "./bodyFat";

// ── Shared metric shapes ────────────────────────────────────────────────────

// A "journey" metric has a real start point and moves in one direction
// (body fat %, weight, lean mass) — matches goalTracker.ts's Journey shape.
export interface JourneyMetric {
  kind:      "journey";
  unit:      string;
  direction: "up" | "down";
  start:     number;
  current:   number;
  target:    number;
}

// A "ratio" metric has no meaningful "start" (e.g. a PR you've never
// attempted before) — just current vs target.
export interface RatioMetric {
  kind:    "ratio";
  unit:    string;
  current: number;
  target:  number;
}

// Strength has three simultaneous lifts, not one number.
export interface LiftsMetric {
  kind:  "lifts";
  unit:  string;
  lifts: { label: string; current: number; target: number }[];
}

export type GoalMetric = JourneyMetric | RatioMetric | LiftsMetric;

export interface GoalProgress {
  goal:  string;
  main:  GoalMetric | null; // long-distance destination
  mini:  GoalMetric | null; // near-term motivational step
}

// ── Strength: max actualWeightKg ever logged per lift, across ALL plans ────
// (both isActive true/false — an old plan's PR still counts). Matched by
// nameEn since the AI generates exercise names freely — case-insensitive
// substring match on the standard lift names.
async function maxLiftEver(userId: string, keyword: string): Promise<number> {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      plan: { userId },
      exerciseType: "strength",
      actualWeightKg: { not: null },
      nameEn: { contains: keyword, mode: "insensitive" },
    },
    select: { actualWeightKg: true },
    orderBy: { actualWeightKg: "desc" },
    take: 1,
  });
  return rows[0]?.actualWeightKg ?? 0;
}

async function getStrengthProgress(userId: string): Promise<{
  bench: number; squat: number; deadlift: number;
}> {
  const [bench, squat, deadlift] = await Promise.all([
    maxLiftEver(userId, "bench"),
    maxLiftEver(userId, "squat"),
    maxLiftEver(userId, "deadlift"),
  ]);
  return { bench, squat, deadlift };
}

// ── Endurance: max actualDuration ever logged, across ALL plans ────────────
async function getEnduranceProgress(userId: string): Promise<number> {
  const rows = await prisma.workoutExercise.findMany({
    where: { plan: { userId }, exerciseType: "cardio", actualDuration: { not: null } },
    select: { actualDuration: true },
    orderBy: { actualDuration: "desc" },
    take: 1,
  });
  return rows[0]?.actualDuration ?? 0;
}

// ── Body composition: current body fat % ────────────────────────────────────
// Prefers the latest ProgressEntry (already has bodyFatPct computed and
// stored). Falls back to computing live from the User row's own
// gender/height/waist/neck — this matters because onboarding-chat
// measurements are saved straight to the User row and DON'T create a
// ProgressEntry (only the manual Progress-page form does that), so a user who
// just finished onboarding would otherwise show no body-fat data at all.
async function getCurrentBodyFatPct(userId: string): Promise<number | null> {
  const latestEntry = await prisma.progressEntry.findFirst({
    where:   { userId, bodyFatPct: { not: null } },
    orderBy: { entryDate: "desc" },
    select:  { bodyFatPct: true },
  });
  if (latestEntry?.bodyFatPct != null) return latestEntry.bodyFatPct;

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { gender: true, height: true, waist: true, neck: true, hips: true },
  });
  if (
    !user || (user.gender !== "male" && user.gender !== "female") ||
    user.height == null || user.waist == null || user.neck == null
  ) return null;

  try {
    return calculateBodyFat({
      gender:   user.gender,
      heightCm: user.height,
      waistCm:  user.waist,
      neckCm:   user.neck,
      hipsCm:   user.hips ?? undefined,
    });
  } catch {
    return null; // e.g. female without hips recorded
  }
}

// ── Main orchestrator ───────────────────────────────────────────────────────
// Returns null if the user hasn't been through the AI goal-confirmation flow
// yet (goalConfirmedByAI === false) — the frontend falls back to the old
// weight/waist journey card in that case, so old accounts keep working
// unchanged.
export async function getGoalProgress(userId: string): Promise<GoalProgress | null> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      goal: true, goalConfirmedByAI: true,
      weight: true, startWeight: true,
      startBodyFatPct: true,
      targetBodyFatPct: true, targetLeanMass: true,
      targetBenchPress: true, targetSquat: true, targetDeadlift: true,
      targetCardioDuration: true,
      mainTargetWeight: true, mainTargetBodyFatPct: true,
      mainTargetBenchPress: true, mainTargetSquat: true, mainTargetDeadlift: true,
      mainTargetCardioDuration: true,
    },
  });

  if (!user || !user.goalConfirmedByAI || !user.goal) return null;

  const goal = user.goal;

  // fat_loss / toning / body_recomposition → body fat % is the metric for both tiers
  if (goal === "fat_loss" || goal === "toning" || goal === "body_recomposition") {
    const current = await getCurrentBodyFatPct(userId);
    if (current == null || user.startBodyFatPct == null) return { goal, main: null, mini: null };
    const base = { kind: "journey" as const, unit: "%", direction: "down" as const, start: user.startBodyFatPct, current };
    return {
      goal,
      main: user.mainTargetBodyFatPct != null ? { ...base, target: user.mainTargetBodyFatPct } : null,
      mini: user.targetBodyFatPct     != null ? { ...base, target: user.targetBodyFatPct }     : null,
    };
  }

  // muscle_gain → main = bodyweight, mini = estimated lean mass gained
  if (goal === "muscle_gain") {
    const currentWeight = user.weight ?? null;
    const main: GoalMetric | null =
      currentWeight != null && user.startWeight != null && user.mainTargetWeight != null
        ? { kind: "journey", unit: "كغ", direction: "up", start: user.startWeight, current: currentWeight, target: user.mainTargetWeight }
        : null;

    // Lean mass = weight * (1 - bodyFat/100) — only computable when body-fat %
    // is available for both the start and current point. Degrades to null
    // (frontend shows "no data yet") rather than a wrong estimate.
    let mini: GoalMetric | null = null;
    if (user.targetLeanMass != null && currentWeight != null && user.startWeight != null) {
      const currentBF = await getCurrentBodyFatPct(userId);
      if (currentBF != null && user.startBodyFatPct != null) {
        const startLean   = user.startWeight * (1 - user.startBodyFatPct / 100);
        const currentLean = currentWeight     * (1 - currentBF / 100);
        mini = { kind: "journey", unit: "كغ", direction: "up", start: startLean, current: currentLean, target: user.targetLeanMass };
      }
    }
    return { goal, main, mini };
  }

  // strength → 3 lifts at once, no "start" concept (a PR you've never attempted)
  if (goal === "strength") {
    const lifts = await getStrengthProgress(userId);
    const mainLifts = [
      user.mainTargetBenchPress != null && { label: "بنش برس",    current: lifts.bench,    target: user.mainTargetBenchPress },
      user.mainTargetSquat      != null && { label: "سكوات",      current: lifts.squat,    target: user.mainTargetSquat },
      user.mainTargetDeadlift   != null && { label: "رفعة ميتة",  current: lifts.deadlift, target: user.mainTargetDeadlift },
    ].filter(Boolean) as { label: string; current: number; target: number }[];
    const miniLifts = [
      user.targetBenchPress != null && { label: "بنش برس",   current: lifts.bench,    target: user.targetBenchPress },
      user.targetSquat      != null && { label: "سكوات",     current: lifts.squat,    target: user.targetSquat },
      user.targetDeadlift   != null && { label: "رفعة ميتة", current: lifts.deadlift, target: user.targetDeadlift },
    ].filter(Boolean) as { label: string; current: number; target: number }[];

    return {
      goal,
      main: mainLifts.length ? { kind: "lifts", unit: "كغ", lifts: mainLifts } : null,
      mini: miniLifts.length ? { kind: "lifts", unit: "كغ", lifts: miniLifts } : null,
    };
  }

  // endurance → longest continuous cardio session ever logged, no "start" concept
  if (goal === "endurance") {
    const longest = await getEnduranceProgress(userId);
    return {
      goal,
      main: user.mainTargetCardioDuration != null ? { kind: "ratio", unit: "دقيقة", current: longest, target: user.mainTargetCardioDuration } : null,
      mini: user.targetCardioDuration     != null ? { kind: "ratio", unit: "دقيقة", current: longest, target: user.targetCardioDuration }     : null,
    };
  }

  // general_fitness → no numeric target by design (see ai.routes.ts) — the
  // streak card is this goal's real journey, same as before this feature.
  return { goal, main: null, mini: null };
}
