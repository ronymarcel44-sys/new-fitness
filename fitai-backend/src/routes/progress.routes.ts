// fitai-backend/src/routes/progress.routes.ts
//
// Endpoints:
//   GET  /progress  → get all weight entries for the user, ordered by date
//   POST /progress  → save a new weight entry for today
//
// Streak and lastActiveDate stay in Redux for now — they're computed client-side
// from these entries plus workout activity.

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

export default router;