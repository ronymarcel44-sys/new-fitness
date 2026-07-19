// fitai-backend/src/routes/workout.routes.ts
//
// Endpoints:
//   GET   /workout                    → get user's active plan + all exercises
//   POST  /workout                    → save a new AI-generated plan
//   PATCH /workout/exercises/:id/done → toggle one exercise done/undone

import { Router, Request, Response } from "express";
import { prisma }       from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// ── GET /workout ──────────────────────────────────────────────────────────────
// Returns the active workout plan so the frontend can reload it on page refresh.
// Returns null if the user has no active plan yet.
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  // Daily reset: a checkmark should reflect TODAY only. Clear `done` for any
  // exercise of the active plan completed before today (keep `doneAt` so the
  // 7-day "workouts completed" analytics in buildUserContext stay intact).
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const active = await prisma.workoutPlan.findFirst({
    where:  { userId, isActive: true },
    select: { id: true },
  });
  if (active) {
    await prisma.workoutExercise.updateMany({
      where: { planId: active.id, done: true, doneAt: { lt: todayStart } },
      data:  { done: false },
    });
  }

  const plan = await prisma.workoutPlan.findFirst({
    where:   { userId, isActive: true },
    include: {
      exercises: {
        orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  res.json(plan ?? null);
});

// ── POST /workout ─────────────────────────────────────────────────────────────
// Saves the AI-generated weeklyPlan to the database.
// Deactivates the previous plan first so only one plan is active at a time.
// Body: { weeklyPlan } — the exact object the AI returned
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { weeklyPlan } = req.body;

  if (!weeklyPlan) {
    res.status(400).json({ error: "weeklyPlan is required" });
    return;
  }

  // Deactivate all previous active plans for this user
  await prisma.workoutPlan.updateMany({
    where: { userId: req.user!.userId, isActive: true },
    data:  { isActive: false },
  });

  // Flatten the 7-day weeklyPlan object into individual exercise rows.
  // The AI returns { "الأحد": { type, focus, exercises: [...] }, ... }
  // We store each exercise as its own row linked to the plan.
  const exerciseRows: {
    dayOfWeek:      string;
    dayType:        string;
    focus:          string | null;
    nameAr:         string;
    nameEn:         string;
    sets:           string;
    reps:           string;
    restSeconds:    number;
    weight:         string | null;
    notes:          string | null;
    muscleGroup:    string;
    sortOrder:      number;
    exerciseType:   string;       // NEW (Task 4)
    durationMinutes: number | null; // NEW (Task 4)
  }[] = [];

  for (const [day, dayData] of Object.entries(weeklyPlan) as [string, any][]) {
    (dayData.exercises ?? []).forEach((ex: any, idx: number) => {
      exerciseRows.push({
        dayOfWeek:   day,
        dayType:     dayData.type === "تمرين" ? "training" : "rest",
        focus:       dayData.focus      || null,
        nameAr:      ex.name,
        nameEn:      ex.nameEn          || ex.name,
        // sets/reps/weight are String columns, but the AI sometimes returns them
        // as numbers (e.g. sets: 3). Coerce so Prisma doesn't reject the insert.
        sets:        String(ex.sets ?? ""),
        reps:        String(ex.reps ?? ""),
        restSeconds: parseInt(ex.rest)  || 60,
        weight:      ex.weight != null && ex.weight !== "" ? String(ex.weight) : null,
        notes:       ex.notes           || null,
        muscleGroup: ex.muscleGroup     || "",
        sortOrder:   idx,
        // NEW (Task 4) — falls back to "strength" if the AI omits the field
        // (matches the schema.prisma column default, so old-style plans still work)
        exerciseType: ex.exerciseType === "cardio" ? "cardio" : "strength",
        durationMinutes: ex.durationMinutes != null && ex.durationMinutes !== ""
          ? parseInt(ex.durationMinutes) || null
          : null,
      });
    });
  }

  // Create the plan and all exercises in one database operation
  const newPlan = await prisma.workoutPlan.create({
    data: {
      userId:    req.user!.userId,
      isActive:  true,
      exercises: { create: exerciseRows },
    },
    include: {
      exercises: { orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }] },
    },
  });

  res.status(201).json(newPlan);
});

// ── PATCH /workout/exercises/:id/done ─────────────────────────────────────────
// Toggles the done state of a single exercise.
// Called every time the user taps an exercise checkbox in the UI.
// NEW (Task 6) — marking a strength/cardio exercise DONE now requires the real
// value used (actualWeightKg / actualDuration) in the body, so progress
// tracking (progressReader.ts) has real data to read. Un-checking doesn't
// clear the last logged value — it stays as the PR record.
router.patch("/exercises/:id/done", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { actualWeightKg, actualDuration } = req.body as {
    actualWeightKg?: number;
    actualDuration?: number;
  };

  // Verify the exercise belongs to this user before updating it
  const exercise = await prisma.workoutExercise.findFirst({
    where: { id, plan: { userId: req.user!.userId } },
  });

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const willBeDone = !exercise.done;

  if (willBeDone && exercise.exerciseType === "strength") {
    const w = Number(actualWeightKg);
    if (!Number.isFinite(w) || w <= 0) {
      res.status(400).json({ error: "actualWeightKg is required to mark a strength exercise done" });
      return;
    }
  }
  if (willBeDone && exercise.exerciseType === "cardio") {
    const d = Number(actualDuration);
    if (!Number.isFinite(d) || d <= 0) {
      res.status(400).json({ error: "actualDuration is required to mark a cardio exercise done" });
      return;
    }
  }

  const updated = await prisma.workoutExercise.update({
    where: { id },
    data: {
      done:   willBeDone,
      doneAt: willBeDone ? new Date() : null,
      ...(willBeDone && exercise.exerciseType === "strength" && { actualWeightKg: Number(actualWeightKg) }),
      ...(willBeDone && exercise.exerciseType === "cardio"   && { actualDuration: Number(actualDuration) }),
    },
  });

  res.json(updated);
});

// ── PATCH /workout/days/type ──────────────────────────────────────────────────
// Switch a whole day between training and rest for the user's active plan.
// Updates the dayType of every exercise row on that day (the exercises stay —
// a "rest" day keeps its hidden workout so it can be switched back on).
// Body: { day, type } where type is the Arabic label ("تمرين" | "راحة").
router.patch("/days/type", async (req: Request, res: Response): Promise<void> => {
  const { day, type } = req.body as { day?: string; type?: string };

  if (!day || (type !== "تمرين" && type !== "راحة")) {
    res.status(400).json({ error: "day and a valid type (تمرين|راحة) are required" });
    return;
  }

  const plan = await prisma.workoutPlan.findFirst({
    where:  { userId: req.user!.userId, isActive: true },
    select: { id: true },
  });
  if (!plan) {
    res.status(404).json({ error: "No active plan" });
    return;
  }

  await prisma.workoutExercise.updateMany({
    where: { planId: plan.id, dayOfWeek: day },
    data:  { dayType: type === "تمرين" ? "training" : "rest" },
  });

  res.json({ ok: true });
});

export default router;