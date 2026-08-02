// fitai-backend/src/lib/progressReader.ts
//
// Reads a user's REAL logged progress (no separate log tables — scans data
// that already exists: WorkoutExercise.actualWeightKg across every
// WorkoutPlan, and the latest ProgressEntry for body composition) and
// packages it against their confirmed goal target(s) as a set of weighted
// progress bars. See goal-tracking-redesign-plan.md Part A for the full spec
// this file implements.
//
// REWRITE (goal redesign) — replaces the old main/mini two-tier version.
// There is now only ONE target per metric. Auto-calculated companion targets
// (fat_loss's Waist/Hips/Neck, muscle_gain's Muscle Mass, etc.) are computed
// ONCE and written to the DB by user.routes.ts at goal-confirmation time —
// this file only READS what's already stored, it never computes a target.

import { prisma } from "./prisma";
import { calculateBodyFat, leanMassFromBodyFat } from "./bodyFat";

// ── Shapes ───────────────────────────────────────────────────────────────

export interface Metric {
  label:       string;
  unit:        string;
  direction:   "up" | "down";
  start:       number | null;
  current:     number | null;
  target:      number | null;
  progressPct: number | null; // null = not enough data yet to compute
  primary:     boolean;        // true = AI-negotiated target (main tab); false = auto-calc/supporting
}

// Shown for context but has no target defined for it, so no bar/percentage —
// e.g. chest/arm size for a muscle_gain user (see the plan doc's A3 table).
export interface ReferenceMeasurement {
  label:   string;
  unit:    string;
  current: number | null;
}

// A measurement shown as start → current (+ change), with NO target — e.g. body
// fat on a bulk, or a lift's progress on a physique goal. Never in overallPct.
export interface InformationalMetric {
  label:     string;
  unit:      string;
  direction: "up" | "down"; // which way is "good" (down = leaner, up = stronger)
  start:     number | null;
  current:   number | null;
}

export interface GoalProgress {
  goal:          string;
  metrics:       Metric[];
  informational: InformationalMetric[]; // start→current rows, no target
  reference:     ReferenceMeasurement[];
  overallPct:    number | null;         // avg of PRIMARY metrics only
}

// ── Progress calculation rules — canonical, see goal-tracking-redesign-plan.md A4 ──

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function computeProgressPct(
  start: number, current: number, target: number, direction: "up" | "down"
): number {
  const raw =
    direction === "up"
      ? (target === start ? 100 : ((current - start) / (target - start)) * 100)
      : (start === target ? 100 : ((start - current) / (start - target)) * 100);
  return Math.max(0, Math.min(100, raw));
}

function buildMetric(
  label: string, unit: string, direction: "up" | "down",
  start: number | null, current: number | null, target: number | null,
  primary: boolean
): Metric {
  const progressPct =
    start != null && current != null && target != null
      ? round1(computeProgressPct(start, current, target, direction))
      : null;
  return { label, unit, direction, start, current, target, progressPct, primary };
}

// Equal-weight average (per the user's confirmed choice — see plan doc A4) of
// every metric that actually has data. A metric with no data yet (e.g. an
// unlogged lift) is excluded rather than counted as 0%, so it doesn't
// unfairly drag down the whole goal's percentage before the user has even
// had a chance to log it.
function overallProgress(metrics: Metric[]): number | null {
  const valid = metrics
    .filter(m => m.primary)
    .map(m => m.progressPct)
    .filter((p): p is number => p != null);
  if (valid.length === 0) return null;
  return round1(valid.reduce((sum, p) => sum + p, 0) / valid.length);
}

// ── Strength: heaviest / first-ever actualWeightKg logged per lift ─────────
// Across ALL plans (both isActive true/false — an old plan's PR still
// counts). Matched by nameEn since the AI generates exercise names freely —
// case-insensitive substring match on the standard lift names.

// "Current" = the heaviest weight ever logged for this lift (unchanged from
// the previous version of this file).
async function maxLiftEver(userId: string, keyword: string): Promise<number | null> {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      plan: { userId }, exerciseType: "strength",
      actualWeightKg: { not: null },
      nameEn: { contains: keyword, mode: "insensitive" },
    },
    select: { actualWeightKg: true },
    orderBy: { actualWeightKg: "desc" },
    take: 1,
  });
  return rows[0]?.actualWeightKg ?? null;
}

// "Start" = the first-ever logged weight for this lift, by date — there's no
// frozen starting-lift field anywhere in the DB (⚠️ flagged assumption, see
// goal-tracking-redesign-plan.md A5).
async function firstLiftEver(userId: string, keyword: string): Promise<number | null> {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      plan: { userId }, exerciseType: "strength",
      actualWeightKg: { not: null },
      nameEn: { contains: keyword, mode: "insensitive" },
    },
    select: { actualWeightKg: true },
    orderBy: { doneAt: "asc" },
    take: 1,
  });
  return rows[0]?.actualWeightKg ?? null;
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

// ── Body-composition snapshot (drives muscle mass) ──────────────────────────
// Muscle mass = weight × (1 − bodyfat%). The Navy bodyfat formula uses waist/neck
// and IGNORES weight, so a weight-only update would credit every gained kg as pure
// muscle (a scale bump = a huge muscle "gain"). To keep muscle honest, this returns
// the weight + bodyfat from the most recent point where the user actually CHANGED a
// body measurement (waist/neck). Weight-only updates are skipped, so muscle mass
// holds until there's a real composition change. Falls back to the onboarding
// snapshot on the User row (weight + waist + neck arrive together there).
async function getCompositionSnapshot(
  userId: string
): Promise<{ weight: number; bodyFatPct: number } | null> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      gender: true, height: true, weight: true, waist: true, neck: true, hips: true,
      startWeight: true, startWaist: true, startNeck: true, startBodyFatPct: true,
    },
  });
  if (!user) return null;

  // Baseline snapshot = onboarding (frozen start values).
  let snapWeight = user.startWeight ?? user.weight ?? null;
  let snapWaist  = user.startWaist  ?? user.waist  ?? null;
  let snapNeck   = user.startNeck   ?? user.neck   ?? null;
  let snapBF     = user.startBodyFatPct ?? null;

  // Advance the snapshot only when an entry's waist/neck differ from the current
  // snapshot — i.e. a genuine composition change, not a weight-only update.
  const entries = await prisma.progressEntry.findMany({
    where:   { userId, weight: { not: null }, waist: { not: null }, neck: { not: null }, bodyFatPct: { not: null } },
    orderBy: { entryDate: "asc" },
    select:  { weight: true, waist: true, neck: true, bodyFatPct: true },
  });
  for (const e of entries) {
    if (e.waist !== snapWaist || e.neck !== snapNeck) {
      snapWeight = e.weight;
      snapWaist  = e.waist;
      snapNeck   = e.neck;
      snapBF     = e.bodyFatPct;
    }
  }

  // Fallback: no frozen start bodyfat → compute from the User row's own onboarding
  // measurements (a single consistent weight+waist+neck snapshot).
  if (snapBF == null) {
    if (user.gender !== "male" && user.gender !== "female") return null;
    if (user.height == null || user.waist == null || user.neck == null || user.weight == null) return null;
    try {
      snapBF     = calculateBodyFat({ gender: user.gender, heightCm: user.height, waistCm: user.waist, neckCm: user.neck, hipsCm: user.hips ?? undefined });
      snapWeight = user.weight;
    } catch {
      return null;
    }
  }
  if (snapWeight == null || snapBF == null) return null;
  return { weight: snapWeight, bodyFatPct: snapBF };
}

// ── Main orchestrator ───────────────────────────────────────────────────────
// Returns null if the user hasn't been through the AI goal-confirmation flow
// yet (goalConfirmedByAI === false), OR if their goal is one of the 3 removed
// from the product (toning/endurance/general_fitness) — the frontend falls
// back to the old weight/waist journey card in both cases, so old accounts
// keep working unchanged.
export async function getGoalProgress(userId: string): Promise<GoalProgress | null> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      goal: true, goalConfirmedByAI: true,
      weight: true, startWeight: true, mainTargetWeight: true,
      startBodyFatPct: true, mainTargetBodyFatPct: true,
      waist: true, startWaist: true, mainTargetWaist: true,
      hips: true, startHips: true, mainTargetHips: true,
      neck: true, startNeck: true, mainTargetNeck: true,
      startBench: true, startSquat: true, startDeadlift: true, startOverheadPress: true, // NEW (Phase 2)
      targetLeanMass: true,
      mainTargetBenchPress: true, mainTargetSquat: true,
      mainTargetDeadlift: true, mainTargetOverheadPress: true,
      chest: true, arms: true, legs: true,
    },
  });

  if (!user || !user.goalConfirmedByAI || !user.goal) return null;
  const goal = user.goal;

  // ── fat_loss: Body Fat % + Weight are the goal; waist/hips/neck are reference ──
  if (goal === "fat_loss") {
    const currentBF = await getCurrentBodyFatPct(userId);
    const metrics: Metric[] = [
      buildMetric("الوزن",       "كغ", "down", user.startWeight,     user.weight, user.mainTargetWeight, true),
      buildMetric("نسبة الدهون", "%",  "down", user.startBodyFatPct, currentBF,   user.mainTargetBodyFatPct, true),
    ];
    const reference: ReferenceMeasurement[] = [
      { label: "الخصر",   unit: "سم", current: user.waist ?? null },
      { label: "الأرداف", unit: "سم", current: user.hips  ?? null },
      { label: "الرقبة",  unit: "سم", current: user.neck  ?? null },
    ];
    return { goal, metrics, informational: [], reference, overallPct: overallProgress(metrics) };
  }

  // ── muscle_gain / bodybuilding: Muscle Mass is the goal; weight supports; body-fat + lifts are info ──
  if (goal === "muscle_gain" || goal === "bodybuilding") {
    // Muscle mass follows a real composition snapshot (weight paired with the bodyfat
    // from the last waist/neck change) — a weight-only update won't move it.
    const snap        = await getCompositionSnapshot(userId);
    const currentBF   = snap?.bodyFatPct ?? null;
    const startLean   = user.startWeight != null && user.startBodyFatPct != null
      ? leanMassFromBodyFat(user.startWeight, user.startBodyFatPct) : null;
    const currentLean = snap ? leanMassFromBodyFat(snap.weight, snap.bodyFatPct) : null;

    const metrics: Metric[] = [
      // Both are primary so the overall % is the AVERAGE of muscle progress and
      // weight progress — one noisy metric can't dominate the headline (a scale-only
      // update swings lean hard, so weight anchors it). See goal design 2026-08-01.
      buildMetric("كتلة العضل (وزن الجسم بدون دهون)", "كغ", "up", startLean,        currentLean, user.targetLeanMass,   true),
      buildMetric("الوزن",      "كغ", "up", user.startWeight, user.weight, user.mainTargetWeight, true),
    ];

    const [fb, mb, fs, ms, fd, md, fo, mo] = await Promise.all([
      firstLiftEver(userId, "bench"),    maxLiftEver(userId, "bench"),
      firstLiftEver(userId, "squat"),    maxLiftEver(userId, "squat"),
      firstLiftEver(userId, "deadlift"), maxLiftEver(userId, "deadlift"),
      firstLiftEver(userId, "overhead"), maxLiftEver(userId, "overhead"),
    ]);
    const informational: InformationalMetric[] = [
      { label: "نسبة الدهون", unit: "%",  direction: "down", start: user.startBodyFatPct, current: currentBF },
      { label: "بنش برس",     unit: "كغ", direction: "up",   start: user.startBench         ?? fb, current: mb },
      { label: "سكوات",       unit: "كغ", direction: "up",   start: user.startSquat         ?? fs, current: ms },
      { label: "رفعة ميتة",   unit: "كغ", direction: "up",   start: user.startDeadlift      ?? fd, current: md },
      { label: "بريس علوي",   unit: "كغ", direction: "up",   start: user.startOverheadPress ?? fo, current: mo },
    ];

    const reference: ReferenceMeasurement[] = [
      { label: "الصدر",    unit: "سم", current: user.chest ?? null },
      { label: "الذراعين", unit: "سم", current: user.arms  ?? null },
      { label: "الأرجل",   unit: "سم", current: user.legs  ?? null },
      ...(goal === "muscle_gain" ? [{ label: "الرقبة", unit: "سم", current: user.neck ?? null }] : []),
    ];

    return { goal, metrics, informational, reference, overallPct: overallProgress(metrics) };
  }

  // ── body_recomposition: Body Fat % + Muscle Mass are the goal; weight is reference (weight-neutral) ──
  if (goal === "body_recomposition") {
    // Weight-neutral goal: muscle mass (and body-fat) follow a real composition
    // snapshot, so a weight-only update never moves the goal.
    const snap        = await getCompositionSnapshot(userId);
    const currentBF   = snap?.bodyFatPct ?? null;
    const startLean   = user.startWeight != null && user.startBodyFatPct != null
      ? leanMassFromBodyFat(user.startWeight, user.startBodyFatPct) : null;
    const currentLean = snap ? leanMassFromBodyFat(snap.weight, snap.bodyFatPct) : null;

    const metrics: Metric[] = [
      buildMetric("نسبة الدهون", "%",  "down", user.startBodyFatPct, currentBF,   user.mainTargetBodyFatPct, true),
      buildMetric("كتلة العضل (وزن الجسم بدون دهون)",  "كغ", "up",   startLean,             currentLean, user.targetLeanMass,       true),
    ];
    const reference: ReferenceMeasurement[] = [
      { label: "الوزن",    unit: "كغ", current: user.weight ?? null },
      { label: "الصدر",    unit: "سم", current: user.chest ?? null },
      { label: "الخصر",    unit: "سم", current: user.waist ?? null },
      { label: "الأرداف",  unit: "سم", current: user.hips  ?? null },
      { label: "الذراعين", unit: "سم", current: user.arms  ?? null },
      { label: "الأرجل",   unit: "سم", current: user.legs  ?? null },
    ];
    return { goal, metrics, informational: [], reference, overallPct: overallProgress(metrics) };
  }

  // ── strength: 4 lifts + derived Relative Strength, no "Start" concept beyond first-logged ──
  if (goal === "strength") {
    const [firstBench, firstSquat, firstDeadlift, firstOHP] = await Promise.all([
      firstLiftEver(userId, "bench"), firstLiftEver(userId, "squat"),
      firstLiftEver(userId, "deadlift"), firstLiftEver(userId, "overhead"),
    ]);
    const [maxBench, maxSquat, maxDeadlift, maxOHP] = await Promise.all([
      maxLiftEver(userId, "bench"), maxLiftEver(userId, "squat"),
      maxLiftEver(userId, "deadlift"), maxLiftEver(userId, "overhead"),
    ]);

    // Prefer the frozen onboarding baseline (Phase 2); fall back to first-logged.
    const sBench    = user.startBench          ?? firstBench;
    const sSquat    = user.startSquat          ?? firstSquat;
    const sDeadlift = user.startDeadlift       ?? firstDeadlift;
    const sOHP      = user.startOverheadPress  ?? firstOHP;

    const metrics: Metric[] = [
      buildMetric("بنش برس",       "كغ", "up", sBench,    maxBench,    user.mainTargetBenchPress, true),
      buildMetric("سكوات",         "كغ", "up", sSquat,    maxSquat,    user.mainTargetSquat, true),
      buildMetric("رفعة ميتة",     "كغ", "up", sDeadlift, maxDeadlift, user.mainTargetDeadlift, true),
      buildMetric("بريس علوي",     "كغ", "up", sOHP,      maxOHP,      user.mainTargetOverheadPress, true),
    ];

    // Relative Strength = (sum of all 4 lifts) ÷ bodyweight — per the user's
    // confirmed formula. Uses current bodyweight as the denominator
    // throughout (no separate target bodyweight exists for this goal).
    const sum4 = (a: number | null, b: number | null, c: number | null, d: number | null) =>
      a != null && b != null && c != null && d != null ? a + b + c + d : null;

    const startSum   = sum4(sBench, sSquat, sDeadlift, sOHP);
    const startRel    = startSum != null && user.startWeight != null && user.startWeight > 0
      ? round1(startSum / user.startWeight) : null;

    const currentSum = sum4(maxBench, maxSquat, maxDeadlift, maxOHP);
    const currentRel  = currentSum != null && user.weight != null && user.weight > 0
      ? round1(currentSum / user.weight) : null;

    const targetSum  = sum4(user.mainTargetBenchPress, user.mainTargetSquat, user.mainTargetDeadlift, user.mainTargetOverheadPress);
    const targetRel   = targetSum != null && user.weight != null && user.weight > 0
      ? round1(targetSum / user.weight) : null;

    metrics.push(buildMetric("القوة النسبية", "× وزن الجسم", "up", startRel, currentRel, targetRel, true));

    const currentBF = await getCurrentBodyFatPct(userId);
    const informational: InformationalMetric[] = [
      { label: "نسبة الدهون", unit: "%", direction: "down", start: user.startBodyFatPct, current: currentBF },
    ];
    return { goal, metrics, informational, reference: [], overallPct: overallProgress(metrics) };
  }

  // Any other goal (toning / endurance / general_fitness, now removed from
  // the product, or any unexpected value) — no tracking here; the frontend
  // falls back to the old weight/waist widget, same as an unconfirmed goal.
  return null;
}
