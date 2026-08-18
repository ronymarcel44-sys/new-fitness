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
  model:        "openai/gpt-oss-120b",
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

// ── Profit report (admin-only) ───────────────────────────────────────────────
// GET /admin/profit?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns daily rows with: date, subscriptionsCount, grossRevenue, stripeFees,
// refunds (always 0 for now), netProfit, coachShare, adminShare
router.get("/profit", async (req: Request, res: Response): Promise<void> => {
  try {
    const qStart = String(req.query.start || "");
    const qEnd = String(req.query.end || "");

    const today = new Date();
    // Default range = last 30 days (including today)
    let endDate = qEnd ? new Date(qEnd) : today;
    endDate.setUTCHours(0, 0, 0, 0);
    let startDate = qStart ? new Date(qStart) : new Date(endDate);
    if (!qStart) startDate.setUTCDate(endDate.getUTCDate() - 29);
    startDate.setUTCHours(0, 0, 0, 0);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const rows: any[] = [];
    const DAY_PRICE = 10; // $10 per monthly premium (matches payment.routes pricing)

    // iterate day by day (inclusive)
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
      const nextDay = new Date(dayStart);
      nextDay.setUTCDate(dayStart.getUTCDate() + 1);

      // Count users who were upgraded to premium on this day (heuristic: plan === 'premium' and updatedAt in day)
      const subscriptionsCount = await prisma.user.count({
        where: {
          plan: "premium",
          updatedAt: { gte: dayStart, lt: nextDay },
        },
      });

      const grossRevenue = subscriptionsCount * DAY_PRICE;
      const stripeFees = Number((grossRevenue * 0.029 + subscriptionsCount * 0.3).toFixed(2));
      const refunds = 0;
      const netProfit = Number((grossRevenue - stripeFees - refunds).toFixed(2));
      const coachShare = Number((netProfit * 0.5).toFixed(2));
      const adminShare = Number((netProfit - coachShare).toFixed(2));

      rows.push({
        date: dayStart.toISOString().slice(0, 10),
        subscriptionsCount,
        grossRevenue,
        stripeFees,
        refunds,
        netProfit,
        coachShare,
        adminShare,
      });
    }

    // totals
    const totals = rows.reduce((acc, r) => {
      acc.subscriptionsCount += r.subscriptionsCount;
      acc.grossRevenue += r.grossRevenue;
      acc.stripeFees += r.stripeFees;
      acc.refunds += r.refunds;
      acc.netProfit += r.netProfit;
      acc.coachShare += r.coachShare;
      acc.adminShare += r.adminShare;
      return acc;
    }, { subscriptionsCount: 0, grossRevenue: 0, stripeFees: 0, refunds: 0, netProfit: 0, coachShare: 0, adminShare: 0 });

    // Round totals
    for (const k of ["grossRevenue", "stripeFees", "refunds", "netProfit", "coachShare", "adminShare"]) {
      // @ts-ignore
      totals[k] = Number(totals[k].toFixed ? totals[k].toFixed(2) : totals[k]);
    }

    res.json({ rows, totals });
  } catch (err) {
    console.error("/admin/profit error:", err);
    res.status(500).json({ error: "Failed to compute profit report" });
  }
});

export default router;
