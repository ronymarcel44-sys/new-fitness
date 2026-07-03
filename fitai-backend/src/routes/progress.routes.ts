// fitai-backend/src/routes/progress.routes.ts
//
// Endpoints:
//   GET  /progress           → get all weight entries for the user, ordered by date
//   POST /progress           → save a new weight entry for today
//   GET  /progress/activity  → current commitment streak (for startup load)
//   POST /progress/activity  → mark the user active today, return the new streak
//
// The streak ("أيام الالتزام") is persisted on the User row and incremented
// server-side, so it survives a page refresh and is the single source of truth.

import { Router, Request, Response } from "express";
import { prisma }       from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// ── GET /progress ─────────────────────────────────────────────────────────────
// Returns all progress entries for this user, oldest first.
// Used to populate the weight chart on ProgressPage and DashboardPage.
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const entries = await prisma.progressEntry.findMany({
    where:   { userId: req.user!.userId },
    orderBy: { entryDate: "asc" },
  });

  res.json(entries);
});

// ── POST /progress ────────────────────────────────────────────────────────────
// Save a new weight entry. If an entry for today already exists, update it
// instead of creating a duplicate (the DB has a unique constraint on userId+date).
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { weight, chest, waist, hips, arms, legs, notes } = req.body;

  if (weight === undefined) {
    res.status(400).json({ error: "weight is required" });
    return;
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Upsert: update if today's entry exists, otherwise create a new one
  const entry = await prisma.progressEntry.upsert({
    where: {
      userId_entryDate: {
        userId:    req.user!.userId,
        entryDate: todayStart,
      },
    },
    update: {
      weight: Number(weight),
      ...(chest !== undefined && { chest: chest ? Number(chest) : null }),
      ...(waist !== undefined && { waist: waist ? Number(waist) : null }),
      ...(hips  !== undefined && { hips:  hips  ? Number(hips)  : null }),
      ...(arms  !== undefined && { arms:  arms  ? Number(arms)  : null }),
      ...(legs  !== undefined && { legs:  legs  ? Number(legs)  : null }),
      ...(notes !== undefined && { notes }),
    },
    create: {
      userId:    req.user!.userId,
      entryDate: todayStart,
      weight:    Number(weight),
      chest:     chest ? Number(chest) : null,
      waist:     waist ? Number(waist) : null,
      hips:      hips  ? Number(hips)  : null,
      arms:      arms  ? Number(arms)  : null,
      legs:      legs  ? Number(legs)  : null,
      notes:     notes || null,
    },
  });

  res.status(201).json(entry);
});

// ── Activity / streak ─────────────────────────────────────────────────────────
// Day boundaries use the UTC date string (matches how the client computed it).
function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Arabic weekday names indexed by getUTCDay() (0 = Sunday … 6 = Saturday),
// matching the frontend DAYS_ORDER so we can find "today's" plan exercises.
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// GET /progress/activity — read the current streak (used on app startup).
router.get("/activity", async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user!.userId },
    select: { streak: true, lastActiveDate: true, bestStreak: true },
  });
  res.json({
    streak:         user?.streak ?? 0,
    lastActiveDate: user?.lastActiveDate ?? "",
    bestStreak:     user?.bestStreak ?? 0,
  });
});

// POST /progress/activity — mark the user active today and return the new streak.
// Same-day calls are idempotent; a one-day gap continues the streak; a bigger
// gap resets it to 1.
router.post("/activity", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const today        = dayStr(new Date());
  const yesterday    = dayStr(new Date(Date.now() - 86_400_000));
  const todayStart    = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const todayName     = DAYS_AR[new Date().getUTCDay()];

  // ── Condition 1 — meals: today's logged calories ≥ 90% of the daily target ──
  const diet = await prisma.dietPlan.findFirst({
    where:  { userId, isActive: true },
    select: { totalCalories: true },
  });
  const mealAgg = await prisma.dailyMealLog.aggregate({
    where: { userId, logDate: { gte: todayStart, lt: tomorrowStart } },
    _sum:  { calories: true },
  });
  const consumed  = mealAgg._sum.calories ?? 0;
  const target    = diet?.totalCalories ?? 0;
  const mealsDone = target > 0 ? consumed >= 0.9 * target : consumed > 0;

  // ── Condition 2 — workout: all of today's training exercises done today ──
  // A rest day has no training rows → every() over [] is true → auto-satisfied.
  const todayTraining = await prisma.workoutExercise.findMany({
    where:  { plan: { userId, isActive: true }, dayOfWeek: todayName, dayType: "training" },
    select: { doneAt: true },
  });
  const workoutDone = todayTraining.every(
    (e) => e.doneAt != null && e.doneAt >= todayStart && e.doneAt < tomorrowStart
  );

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { streak: true, lastActiveDate: true, bestStreak: true },
  });
  let streak         = user?.streak ?? 0;
  let bestStreak     = user?.bestStreak ?? 0;
  let lastActiveDate = user?.lastActiveDate ?? "";

  // Count the day only when BOTH are done (and it isn't already counted today).
  if (mealsDone && workoutDone && lastActiveDate !== today) {
    streak         = lastActiveDate === yesterday ? streak + 1 : 1;
    bestStreak     = Math.max(bestStreak, streak);
    lastActiveDate = today;
    await prisma.user.update({
      where: { id: userId },
      data:  { streak, lastActiveDate, bestStreak },
    });
  }

  res.json({ streak, lastActiveDate, bestStreak });
});

export default router;