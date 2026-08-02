// fitai-backend/src/routes/admin.routes.ts
//
// All admin endpoints — require role=admin.
// Endpoints:
//   GET    /admin/stats                    → dashboard stats (real counts from DB)
//   GET    /admin/users                    → all users
//   PATCH  /admin/users/:id/status         → enable/disable user
//   PATCH  /admin/users/:id/plan           → change user plan
//   PATCH  /admin/users/:id/coach          → assign/unassign coach
//   DELETE /admin/users/:id                → delete user
//   GET    /admin/coaches                  → all coaches + assigned user IDs
//   POST   /admin/coaches                  → create new coach
//   PATCH  /admin/coaches/:id/status       → activate/deactivate coach
//   GET    /admin/exercises                → exercise library
//   POST   /admin/exercises                → add exercise
//   PUT    /admin/exercises/:id            → update exercise
//   DELETE /admin/exercises/:id            → delete exercise
//   GET    /admin/settings                 → AI settings (stored in memory for now)
//   PUT    /admin/settings                 → update AI settings

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma }       from "../lib/prisma";
import { normalizeCertifications } from "../lib/certs";
import { authenticate } from "../middleware/auth";
import { requireRole }  from "../middleware/role";

const router = Router();
router.use(authenticate, requireRole("admin"));

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // Run all counts in parallel for speed
  const [totalUsers, premiumUsers, totalPlans, aiToday, aiMonth] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: "premium" } }),
    prisma.workoutPlan.count(),
    prisma.chatMessage.count({ where: { timestamp: { gte: todayStart }, role: "assistant" } }),
    prisma.chatMessage.count({ where: { timestamp: { gte: monthStart }, role: "assistant" } }),
  ]);

  // activeToday = users with at least one chat message today
  const activeUsersToday = await prisma.chatMessage.findMany({
    where:  { timestamp: { gte: todayStart } },
    select: { userId: true },
    distinct: ["userId"],
  });

  res.json({
    totalUsers,
    activeToday:         activeUsersToday.length,
    premiumUsers,
    totalPlansGenerated: totalPlans,
    aiCallsToday:        aiToday,
    aiCallsThisMonth:    aiMonth,
  });
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get("/users", async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      coachAssignment:  { include: { coach: true } },
      _count:           { select: { workoutPlans: true } },
    },
  });

  // Reshape to the AdminUser structure the frontend expects
  res.json(users.map((u) => ({
    id:             u.id,
    name:           u.name,
    email:          u.email,
    role:           u.role,
    plan:           u.plan,
    status:         u.status,
    joinedAt:       u.createdAt.toISOString().slice(0, 10),
    lastActive:     u.lastActiveDate ?? u.updatedAt.toISOString().slice(0, 10),
    hasWorkoutPlan: u._count.workoutPlans > 0,
    streak:         u.streak,
    coachId:        u.coachAssignment?.coachId,
  })));
});

router.patch("/users/:id/status", async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data:  { status: req.body.status },
  });
  res.json(updated);
});

router.patch("/users/:id/plan", async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data:  { plan: req.body.plan },
  });
  res.json(updated);
});

router.patch("/users/:id/coach", async (req: Request, res: Response): Promise<void> => {
  const { coachId } = req.body;
  const userId      = req.params.id;

  // Remove any existing assignment first
  await prisma.coachAssignment.deleteMany({ where: { userId } });

  // If coachId provided, create new assignment
  if (coachId) {
    await prisma.coachAssignment.create({ data: { coachId, userId } });
  }

  res.json({ success: true });
});

router.delete("/users/:id", async (req: Request, res: Response): Promise<void> => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ── Coaches ───────────────────────────────────────────────────────────────────
router.get("/coaches", async (_req: Request, res: Response): Promise<void> => {
  const coaches = await prisma.coach.findMany({
    include: { assignments: { select: { userId: true } } },
  });
  res.json(coaches.map((c) => ({
    id:              c.id,
    name:            c.name,
    email:           c.email,
    specialty:       c.specialty,
    status:          c.status,
    bio:             c.bio,
    yearsExperience: c.yearsExperience,
    certification:   c.certification,
    certifications:  normalizeCertifications(c.certifications),
    assignedUsers:   c.assignments.map((a) => a.userId),
  })));
});

router.post("/coaches", async (req: Request, res: Response): Promise<void> => {
  const { name, email, specialty, status } = req.body;

  // Default password for new coach accounts — admin should share this
  // In production they'd get an email invite to set their own password
  const defaultPassword = "coach123";
  const passwordHash    = await bcrypt.hash(defaultPassword, 12);

  const coach = await prisma.coach.create({
    data: { name, email, specialty, status: status ?? "active", passwordHash },
  });
  res.status(201).json(coach);
});

router.patch("/coaches/:id/status", async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.coach.update({
    where: { id: req.params.id },
    data:  { status: req.body.status },
  });
  res.json(updated);
});

// ── Exercise Library ──────────────────────────────────────────────────────────
router.get("/exercises", async (_req: Request, res: Response): Promise<void> => {
  const exercises = await prisma.exerciseLibrary.findMany({ orderBy: { createdAt: "desc" } });
  res.json(exercises);
});

router.post("/exercises", async (req: Request, res: Response): Promise<void> => {
  const { nameAr, nameEn, muscleGroup, equipment, level, description } = req.body;
  const exercise = await prisma.exerciseLibrary.create({
    data: { nameAr, nameEn, muscleGroup, equipment, level, description: description || null },
  });
  res.status(201).json(exercise);
});

router.put("/exercises/:id", async (req: Request, res: Response): Promise<void> => {
  const updated = await prisma.exerciseLibrary.update({
    where: { id: req.params.id },
    data:  req.body,
  });
  res.json(updated);
});

router.delete("/exercises/:id", async (req: Request, res: Response): Promise<void> => {
  await prisma.exerciseLibrary.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ── AI Settings ───────────────────────────────────────────────────────────────
// Kept in-memory for simplicity. Could move to a settings table later.
let aiSettings = {
  model:        "llama-3.3-70b-versatile",
  maxTokens:    4000,
  temperature:  0.7,
  systemPrompt: "أنت مدرب لياقة بدنية محترف ومتخصص في التغذية الرياضية.",
};

router.get("/settings", (_req: Request, res: Response): void => {
  res.json(aiSettings);
});

router.put("/settings", (req: Request, res: Response): void => {
  aiSettings = { ...aiSettings, ...req.body };
  res.json(aiSettings);
});

export default router;
