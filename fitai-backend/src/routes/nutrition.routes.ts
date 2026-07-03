// fitai-backend/src/routes/nutrition.routes.ts
//
// Endpoints:
//   GET    /nutrition             → get active diet plan + all meals
//   POST   /nutrition              → save a new AI-generated diet plan
//   GET    /nutrition/logs         → get today's meal logs
//   POST   /nutrition/logs         → log a meal the user ate today
//   DELETE /nutrition/logs/:id     → remove a meal from today's log

import { Router, Request, Response } from "express";
import { prisma }       from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// ── GET /nutrition ────────────────────────────────────────────────────────────
// Returns the user's active diet plan including all meals
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const plan = await prisma.dietPlan.findFirst({
    where:   { userId: req.user!.userId, isActive: true },
    include: { meals: true },
  });
  res.json(plan ?? null);
});

// ── POST /nutrition ───────────────────────────────────────────────────────────
// Saves a new AI-generated nutrition plan
// Body: { totalCalories, protein, carbs, fat, meals: [...] }
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { totalCalories, protein, carbs, fat, meals } = req.body;

  if (!totalCalories || !meals) {
    res.status(400).json({ error: "totalCalories and meals are required" });
    return;
  }

  // Deactivate all previous active plans for this user
  await prisma.dietPlan.updateMany({
    where: { userId: req.user!.userId, isActive: true },
    data:  { isActive: false },
  });

  // Map AI meal shape to DB columns. AI sometimes omits mealType so fall back
  // based on the meal name / order.
  const mealRows = (meals as any[]).map((m, idx) => ({
    mealName: m.name,
    mealTime: m.time                                           || "",
    mealType: m.mealType                                       || inferMealType(m.name, idx),
    calories: Number(m.calories)                               || 0,
    proteinG: Number(m.protein)                                || 0,
    carbsG:   Number(m.carbs)                                  || 0,
    fatG:     Number(m.fat)                                    || 0,
    items:    Array.isArray(m.items) ? m.items                 : [],
    emoji:    m.emoji                                          || null,
  }));

  const newPlan = await prisma.dietPlan.create({
    data: {
      userId:        req.user!.userId,
      totalCalories: Number(totalCalories),
      proteinGrams:  Number(protein)   || 0,
      carbsGrams:    Number(carbs)     || 0,
      fatGrams:      Number(fat)       || 0,
      isActive:      true,
      meals:         { create: mealRows },
    },
    include: { meals: true },
  });

  res.status(201).json(newPlan);
});

// Helper: guess the meal type from its Arabic name
function inferMealType(name: string, idx: number): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("فطور") || n.includes("إفطار"))   return "breakfast";
  if (n.includes("غداء"))                          return "lunch";
  if (n.includes("عشاء"))                          return "dinner";
  if (n.includes("قبل التمرين"))                   return "pre_workout";
  if (n.includes("سناك") || n.includes("خفيفة"))   return "snack";
  // fallback by order: breakfast, lunch, dinner, snack
  return ["breakfast", "lunch", "dinner", "snack"][idx] || "snack";
}

// ── GET /nutrition/logs ───────────────────────────────────────────────────────
// Returns today's meal logs for the user
router.get("/logs", async (req: Request, res: Response): Promise<void> => {
  // Today's date at midnight UTC — match the @db.Date column type
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const logs = await prisma.dailyMealLog.findMany({
    where: {
      userId:  req.user!.userId,
      logDate: todayStart,
    },
    orderBy: { loggedAt: "asc" },
  });

  res.json(logs);
});

// ── POST /nutrition/logs ──────────────────────────────────────────────────────
// Adds a meal to today's log. Used when the user taps "log this meal"
// or manually adds a custom meal they ate.
router.post("/logs", async (req: Request, res: Response): Promise<void> => {
  const { mealId, name, source, calories, protein, carbs, fat } = req.body;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const log = await prisma.dailyMealLog.create({
    data: {
      userId:   req.user!.userId,
      mealId:   mealId || null,
      name:     name   || null,   // persist so the real name survives a refresh
      source:   source || null,
      logDate:  todayStart,
      calories: Number(calories)        || 0,
      proteinG: Number(protein)         || 0,
      carbsG:   Number(carbs)           || 0,
      fatG:     Number(fat)             || 0,
    },
  });

  res.status(201).json(log); // log now includes the stored name
});

// ── DELETE /nutrition/logs/:id ────────────────────────────────────────────────
// Removes a meal from today's log
router.delete("/logs/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Make sure the log belongs to this user
  const log = await prisma.dailyMealLog.findFirst({
    where: { id, userId: req.user!.userId },
  });

  if (!log) {
    res.status(404).json({ error: "Log entry not found" });
    return;
  }

  await prisma.dailyMealLog.delete({ where: { id } });
  res.json({ success: true });
});

export default router;