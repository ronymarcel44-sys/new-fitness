// fitai-backend/src/routes/coach.routes.ts
//
// All coach endpoints — require role=coach.
// A coach can only access users assigned to them.
//
// Endpoints:
//   GET    /coach/users                          → all users assigned to this coach
//   GET    /coach/users/:userId/workout          → view one user's workout plan
//   GET    /coach/users/:userId/nutrition        → view one user's nutrition plan
//   GET    /coach/notes/exercises?userId=        → coach's notes on that user's exercises
//   POST   /coach/notes/exercises                → add/update a note on an exercise
//   DELETE /coach/notes/exercises/:id            → delete an exercise note
//   GET    /coach/notes/meals?userId=            → coach's notes on that user's meals
//   POST   /coach/notes/meals                    → add/update a note on a meal
//   DELETE /coach/notes/meals/:id                → delete a meal note

import { Router, Request, Response, NextFunction } from "express";
import { prisma }       from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole }  from "../middleware/role";
import { notify }       from "./notifications.routes";

const router = Router();
router.use(authenticate, requireRole("coach"));

// ── GET /coach/me ───────────────────────────────────────────────────────────────
// The logged-in coach's own profile, including verification status. NOT gated by
// status — a pending/rejected coach calls this to know which screen to show.
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  const coach = await prisma.coach.findUnique({
    where:  { id: req.user!.userId },
    select: {
      id: true, name: true, email: true, specialty: true, status: true,
      bio: true, yearsExperience: true, certification: true, profileImage: true,
    },
  });
  if (!coach) {
    res.status(404).json({ error: "Coach not found" });
    return;
  }
  res.json(coach);
});

// ── PATCH /coach/me ─────────────────────────────────────────────────────────────
// Coach edits their own profile (bio, specialty, experience, certification, photo).
// Ungated so a coach can keep their profile current regardless of status.
router.patch("/me", async (req: Request, res: Response): Promise<void> => {
  const { name, bio, specialty, yearsExperience, certification, profileImage } = req.body;

  const updated = await prisma.coach.update({
    where: { id: req.user!.userId },
    data: {
      ...(name            !== undefined && { name }),
      ...(bio             !== undefined && { bio: bio || null }),
      ...(specialty       !== undefined && { specialty }),
      ...(yearsExperience !== undefined && { yearsExperience: yearsExperience != null && yearsExperience !== "" ? Number(yearsExperience) : null }),
      ...(certification   !== undefined && { certification: certification || null }),
      ...(profileImage    !== undefined && { profileImage: profileImage || null }),
    },
    select: {
      id: true, name: true, email: true, specialty: true, status: true,
      bio: true, yearsExperience: true, certification: true, profileImage: true,
    },
  });
  res.json(updated);
});

// ── Guard — only verified (active) coaches may reach client data below ──────────
// A pending or rejected coach is blocked from every route declared after this.
async function requireActiveCoach(req: Request, res: Response, next: NextFunction): Promise<void> {
  const coach = await prisma.coach.findUnique({
    where:  { id: req.user!.userId },
    select: { status: true },
  });
  if (coach?.status !== "active") {
    res.status(403).json({ error: "Coach account is not active" });
    return;
  }
  next();
}
router.use(requireActiveCoach);

// Helper — verify the target user is actually assigned to this coach
async function isAssigned(coachId: string, userId: string): Promise<boolean> {
  const assignment = await prisma.coachAssignment.findFirst({
    where: { coachId, userId },
  });
  return !!assignment;
}

// ── Users ─────────────────────────────────────────────────────────────────────
router.get("/users", async (req: Request, res: Response): Promise<void> => {
  const assignments = await prisma.coachAssignment.findMany({
    where:   { coachId: req.user!.userId },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, plan: true, status: true,
          weight: true, goal: true, fitnessLevel: true,
          _count: { select: { workoutPlans: true, dietPlans: true } },
        },
      },
    },
  });

  // Unread message counts per client (messages the client sent, not yet read)
  const unreadGroups = await prisma.message.groupBy({
    by:    ["userId"],
    where: { coachId: req.user!.userId, senderRole: "user", read: false },
    _count: true,
  });
  const unreadByUser = Object.fromEntries(unreadGroups.map((g) => [g.userId, g._count]));

  res.json(assignments.map((a) => ({
    id:             a.user.id,
    name:           a.user.name,
    email:          a.user.email,
    plan:           a.user.plan,
    status:         a.user.status,
    weight:         a.user.weight,
    goal:           a.user.goal,
    fitnessLevel:   a.user.fitnessLevel,
    hasWorkout:     a.user._count.workoutPlans > 0,
    hasNutrition:   a.user._count.dietPlans > 0,
    unreadMessages: unreadByUser[a.user.id] ?? 0,
  })));
});

// ── Access assigned user's workout plan ───────────────────────────────────────
router.get("/users/:userId/workout", async (req: Request, res: Response): Promise<void> => {
  if (!(await isAssigned(req.user!.userId, req.params.userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  const plan = await prisma.workoutPlan.findFirst({
    where:   { userId: req.params.userId, isActive: true },
    include: { exercises: { orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }] } },
  });
  res.json(plan ?? null);
});

// ── Access assigned user's nutrition plan ─────────────────────────────────────
router.get("/users/:userId/nutrition", async (req: Request, res: Response): Promise<void> => {
  if (!(await isAssigned(req.user!.userId, req.params.userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  const plan = await prisma.dietPlan.findFirst({
    where:   { userId: req.params.userId, isActive: true },
    include: { meals: true },
  });
  res.json(plan ?? null);
});

// ── GET /coach/users/:userId/progress ─────────────────────────────────────────
// The client's weight trend + adherence (workout completion, meal logging) so the
// coach can see how the client is actually doing, not just their static plan.
router.get("/users/:userId/progress", async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId;
  if (!(await isAssigned(req.user!.userId, userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  // Last 7 days window (date-only) for meal-logging adherence
  const weekAgo = new Date();
  weekAgo.setUTCHours(0, 0, 0, 0);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);

  const [weightEntries, totalExercises, doneExercises, mealLogDays] = await Promise.all([
    prisma.progressEntry.findMany({
      where:   { userId, weight: { not: null } },
      orderBy: { entryDate: "asc" },
      select:  { entryDate: true, weight: true },
    }),
    prisma.workoutExercise.count({ where: { plan: { userId, isActive: true } } }),
    prisma.workoutExercise.count({ where: { plan: { userId, isActive: true }, done: true } }),
    prisma.dailyMealLog.findMany({
      where:    { userId, logDate: { gte: weekAgo } },
      distinct: ["logDate"],
      select:   { logDate: true },
    }),
  ]);

  const weightHistory = weightEntries.map((e) => ({
    date:   e.entryDate.toISOString().slice(0, 10),
    weight: e.weight,
  }));

  res.json({
    weightHistory,
    startWeight:  weightHistory[0]?.weight ?? null,
    latestWeight: weightHistory[weightHistory.length - 1]?.weight ?? null,
    workout:      { done: doneExercises, total: totalExercises },
    mealLogDays:  mealLogDays.length,   // distinct days logged in the last 7
  });
});

// ── Edit an assigned user's exercise ──────────────────────────────────────────
// Coach personalizes the plan: update sets/reps/weight/rest on one exercise.
// Marks the exercise as coachEdited so the user sees an "edited by coach" badge.
router.patch("/users/:userId/exercises/:exerciseId", async (req: Request, res: Response): Promise<void> => {
  if (!(await isAssigned(req.user!.userId, req.params.userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  // The exercise must belong to this user's plan (defence in depth)
  const exercise = await prisma.workoutExercise.findFirst({
    where: { id: req.params.exerciseId, plan: { userId: req.params.userId } },
  });
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found for this user" });
    return;
  }

  const { sets, reps, weight, restSeconds } = req.body;
  const updated = await prisma.workoutExercise.update({
    where: { id: req.params.exerciseId },
    data: {
      ...(sets        !== undefined && { sets:        String(sets) }),
      ...(reps        !== undefined && { reps:        String(reps) }),
      ...(weight      !== undefined && { weight:      weight ? String(weight) : null }),
      ...(restSeconds !== undefined && { restSeconds: Number(restSeconds) || 60 }),
      coachEdited: true,
    },
  });
  res.json(updated);
});

// ── Edit an assigned user's meal ──────────────────────────────────────────────
router.patch("/users/:userId/meals/:mealId", async (req: Request, res: Response): Promise<void> => {
  if (!(await isAssigned(req.user!.userId, req.params.userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  const meal = await prisma.dietMeal.findFirst({
    where: { id: req.params.mealId, diet: { userId: req.params.userId } },
  });
  if (!meal) {
    res.status(404).json({ error: "Meal not found for this user" });
    return;
  }

  const { mealName, mealTime, calories, proteinG, carbsG, fatG, items } = req.body;
  const updated = await prisma.dietMeal.update({
    where: { id: req.params.mealId },
    data: {
      ...(mealName !== undefined && { mealName }),
      ...(mealTime !== undefined && { mealTime }),
      ...(calories !== undefined && { calories: Number(calories) || 0 }),
      ...(proteinG !== undefined && { proteinG: Number(proteinG) || 0 }),
      ...(carbsG   !== undefined && { carbsG:   Number(carbsG)   || 0 }),
      ...(fatG     !== undefined && { fatG:     Number(fatG)     || 0 }),
      ...(items    !== undefined && { items:    Array.isArray(items) ? items : [] }),
      coachEdited: true,
    },
  });
  res.json(updated);
});

// ── POST /coach/users/:userId/meals ───────────────────────────────────────────
// Coach adds a new meal to the client's active diet plan (macros usually from AI).
router.post("/users/:userId/meals", async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId;
  if (!(await isAssigned(req.user!.userId, userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  const plan = await prisma.dietPlan.findFirst({
    where:  { userId, isActive: true },
    select: { id: true },
  });
  if (!plan) {
    res.status(400).json({ error: "User has no active nutrition plan" });
    return;
  }

  const { mealName, mealTime, calories, proteinG, carbsG, fatG, items, emoji } = req.body;
  if (!mealName) {
    res.status(400).json({ error: "mealName is required" });
    return;
  }

  const meal = await prisma.dietMeal.create({
    data: {
      dietId:      plan.id,
      mealName,
      mealTime:    mealTime || "",
      mealType:    "snack",
      calories:    Number(calories) || 0,
      proteinG:    Number(proteinG) || 0,
      carbsG:      Number(carbsG)   || 0,
      fatG:        Number(fatG)     || 0,
      items:       Array.isArray(items) ? items : [],
      emoji:       emoji || "🍽️",
      coachEdited: true,
    },
  });
  res.status(201).json(meal);
});

// ── DELETE /coach/users/:userId/meals/:mealId ─────────────────────────────────
router.delete("/users/:userId/meals/:mealId", async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId;
  if (!(await isAssigned(req.user!.userId, userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  const meal = await prisma.dietMeal.findFirst({
    where: { id: req.params.mealId, diet: { userId } },
  });
  if (!meal) {
    res.status(404).json({ error: "Meal not found for this user" });
    return;
  }

  await prisma.dietMeal.delete({ where: { id: req.params.mealId } });
  res.json({ success: true });
});

// ── GET /coach/users/:userId/messages ─────────────────────────────────────────
// The chat thread with one assigned client. Opening it marks the client's
// messages as read.
router.get("/users/:userId/messages", async (req: Request, res: Response): Promise<void> => {
  const coachId = req.user!.userId;
  const userId  = req.params.userId;
  if (!(await isAssigned(coachId, userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  await prisma.message.updateMany({
    where: { userId, coachId, senderRole: "user", read: false },
    data:  { read: true },
  });

  const messages = await prisma.message.findMany({
    where:   { userId, coachId },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});

// ── POST /coach/users/:userId/messages ────────────────────────────────────────
router.post("/users/:userId/messages", async (req: Request, res: Response): Promise<void> => {
  const coachId = req.user!.userId;
  const userId  = req.params.userId;
  const text    = (req.body.text ?? "").trim();
  if (!(await isAssigned(coachId, userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }
  if (!text) {
    res.status(400).json({ error: "Message text is required" });
    return;
  }

  const message = await prisma.message.create({
    data: { userId, coachId, senderRole: "coach", text },
  });

  // Notify the client of the new message from their coach
  await notify({
    recipientId:   userId,
    recipientRole: "user",
    type:          "new_message",
    text:          "رسالة جديدة من مدربك 👨‍🏫",
    link:          null,   // null → the client's app opens the floating chat bubble
  });

  res.status(201).json(message);
});

// ── Earnings (simulated) ──────────────────────────────────────────────────────
// The coach earns a 50% share of each premium client's $10/month plan = $5/client.
const PER_CLIENT_MONTHLY = 5;
const SHARE_PCT          = 50;

async function computeEarnings(coachId: string) {
  const assignments = await prisma.coachAssignment.findMany({
    where:   { coachId },
    include: { user: { select: { id: true, name: true, plan: true } } },
  });
  const premium         = assignments.filter((a) => a.user.plan === "premium");
  const monthlyEarnings = premium.length * PER_CLIENT_MONTHLY;
  const withdrawals     = await prisma.withdrawal.findMany({ where: { coachId }, orderBy: { createdAt: "desc" } });
  const totalWithdrawn  = withdrawals.reduce((s, w) => s + w.amount, 0);
  const available       = Math.max(0, monthlyEarnings - totalWithdrawn);
  return { premium, monthlyEarnings, withdrawals, totalWithdrawn, available };
}

router.get("/earnings", async (req: Request, res: Response): Promise<void> => {
  const e = await computeEarnings(req.user!.userId);
  res.json({
    perClient:       PER_CLIENT_MONTHLY,
    sharePct:        SHARE_PCT,
    monthlyEarnings: e.monthlyEarnings,
    projectedYearly: e.monthlyEarnings * 12,
    available:       e.available,
    totalWithdrawn:  e.totalWithdrawn,
    clients:         e.premium.map((a) => ({ id: a.user.id, name: a.user.name, amount: PER_CLIENT_MONTHLY })),
    withdrawals:     e.withdrawals.map((w) => ({ id: w.id, amount: w.amount, method: w.method, createdAt: w.createdAt })),
  });
});

router.post("/withdraw", async (req: Request, res: Response): Promise<void> => {
  const amount = Number(req.body.amount);
  const method = (req.body.method as string) || "bank";

  const e = await computeEarnings(req.user!.userId);
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  if (amount > e.available) {
    res.status(400).json({ error: "Amount exceeds available balance" });
    return;
  }

  await prisma.withdrawal.create({ data: { coachId: req.user!.userId, amount, method } });
  const updated = await computeEarnings(req.user!.userId);
  res.json({ available: updated.available, totalWithdrawn: updated.totalWithdrawn });
});

// ── Exercise Notes ────────────────────────────────────────────────────────────
router.get("/notes/exercises", async (req: Request, res: Response): Promise<void> => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: "userId query param required" });
    return;
  }

  const notes = await prisma.exerciseNote.findMany({
    where: { coachId: req.user!.userId, userId },
  });
  res.json(notes);
});

// Upsert — create or update depending on whether a note already exists
router.post("/notes/exercises", async (req: Request, res: Response): Promise<void> => {
  const { exerciseId, userId, noteText } = req.body;
  const coachId = req.user!.userId;

  if (!(await isAssigned(coachId, userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  // Check for existing note by this coach on this exercise+user combo
  const existing = await prisma.exerciseNote.findFirst({
    where: { coachId, userId, exerciseId },
  });

  const note = existing
    ? await prisma.exerciseNote.update({ where: { id: existing.id }, data: { noteText } })
    : await prisma.exerciseNote.create({ data: { coachId, userId, exerciseId, noteText } });

  res.json(note);
});

router.delete("/notes/exercises/:id", async (req: Request, res: Response): Promise<void> => {
  // Make sure the coach owns this note
  const note = await prisma.exerciseNote.findFirst({
    where: { id: req.params.id, coachId: req.user!.userId },
  });
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  await prisma.exerciseNote.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ── Meal Notes (same pattern) ─────────────────────────────────────────────────
router.get("/notes/meals", async (req: Request, res: Response): Promise<void> => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: "userId query param required" });
    return;
  }

  const notes = await prisma.mealNote.findMany({
    where: { coachId: req.user!.userId, userId },
  });
  res.json(notes);
});

router.post("/notes/meals", async (req: Request, res: Response): Promise<void> => {
  const { mealId, userId, noteText } = req.body;
  const coachId = req.user!.userId;

  if (!(await isAssigned(coachId, userId))) {
    res.status(403).json({ error: "User not assigned to you" });
    return;
  }

  const existing = await prisma.mealNote.findFirst({
    where: { coachId, userId, mealId },
  });

  const note = existing
    ? await prisma.mealNote.update({ where: { id: existing.id }, data: { noteText } })
    : await prisma.mealNote.create({ data: { coachId, userId, mealId, noteText } });

  res.json(note);
});

router.delete("/notes/meals/:id", async (req: Request, res: Response): Promise<void> => {
  const note = await prisma.mealNote.findFirst({
    where: { id: req.params.id, coachId: req.user!.userId },
  });
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  await prisma.mealNote.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
