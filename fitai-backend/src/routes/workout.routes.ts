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
  const plan = await prisma.workoutPlan.findFirst({
    where:   { userId: req.user!.userId, isActive: true },
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
    dayOfWeek:   string;
    dayType:     string;
    focus:       string | null;
    nameAr:      string;
    nameEn:      string;
    sets:        string;
    reps:        string;
    restSeconds: number;
    weight:      string | null;
    notes:       string | null;
    muscleGroup: string;
    sortOrder:   number;
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
router.patch("/exercises/:id/done", async (req: Request, res: Response): Promise<void> => {
  const { id }   = req.params;
  // Verify the exercise belongs to this user before updating it
  const exercise = await prisma.workoutExercise.findFirst({
    where: { id, plan: { userId: req.user!.userId } },
  });

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const updated = await prisma.workoutExercise.update({
    where: { id },
    data: {
      done:   !exercise.done,
      doneAt: !exercise.done ? new Date() : null,
    },
  });

  res.json(updated);
});

export default router;