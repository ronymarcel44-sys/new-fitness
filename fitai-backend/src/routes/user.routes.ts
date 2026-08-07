// fitai-backend/src/routes/user.routes.ts
// (profile now carries frozen baseline start* fields for progress tracking)
//
// All routes here require a valid JWT — protected by the authenticate middleware.
// Users can only access their own data because we always use req.user.userId
// to query the database, never a userId from the request body or params.
//
// Endpoints:
//   GET  /users/me         → get the logged-in user's full profile
//   PUT  /users/me         → update the logged-in user's profile
//   GET  /users/me/coach   → get the coach assigned to this user (null if free plan)
//   GET  /users/coaches    → list active coaches the user can choose from (premium picker)
//   POST /users/me/coach   → premium user picks their own coach (creates assignment)

import { Router, Request, Response } from "express";
import { prisma }       from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { notify }       from "./notifications.routes";
import { calculateBodyFat } from "../lib/bodyFat";
import { normalizeCertifications, stripCertNumbers } from "../lib/certs";

const router = Router();

// Apply auth middleware to every route in this file
router.use(authenticate);

// ── GET /users/me ─────────────────────────────────────────────────────────────
// Returns the full profile of the currently logged-in user.
// Called by the frontend on page load to hydrate the Redux user state.
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    // Never send the password hash to the client
    select: {
      id:          true,
      name:        true,
      email:       true,
      role:        true,
      plan:        true,
      status:      true,
      hasSetup:    true,
      age:         true,
      height:      true,
      weight:      true,
      fitnessLevel:true,
      goal:        true,
      diseases:    true,
      gender:      true,
      chest:       true,
      waist:       true,
      hips:        true,
      arms:        true,
      legs:        true,
      neck:        true,
      targetWeight:true,
      // Single target per metric (goal redesign — no more mini/main tiers).
      // targetLeanMass has no "main" counterpart — see schema.prisma's comment.
      targetLeanMass:           true,
      goalConfirmedByAI:        true,
      mainTargetWeight:         true,
      mainTargetBodyFatPct:     true,
      mainTargetWaist:          true, // NEW (goal redesign)
      mainTargetHips:           true, // NEW (goal redesign)
      mainTargetNeck:           true, // NEW (goal redesign)
      mainTargetBenchPress:     true,
      mainTargetSquat:          true,
      mainTargetDeadlift:       true,
      mainTargetOverheadPress:  true, // NEW (goal redesign)
      startWeight: true,
      startChest:  true,
      startWaist:  true,
      startHips:   true,
      startArms:   true,
      startLegs:   true,
      startNeck:   true, // NEW (goal redesign)
      createdAt:   true,
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

// ── PUT /users/me ─────────────────────────────────────────────────────────────
// Updates the logged-in user's profile.
// Only updates fields that are actually sent in the request body —
// undefined fields are ignored so a partial update won't wipe other data.
// Called after the AI generates a plan (to save body data) and after
// the user manually updates their measurements.
//
// REWRITE (goal redesign) — the mini-tier fields (targetBodyFatPct,
// targetBenchPress, targetSquat, targetDeadlift, targetCardioDuration) are
// deprecated: no longer read from the request or written. targetLeanMass is
// the one exception, kept active. This handler now also computes the
// auto-calculated companion targets (waist/hips/neck for fat_loss, muscle
// mass for muscle_gain/body_recomposition, weight for body_recomposition) —
// see goal-tracking-redesign-plan.md Part A5 for the formulas.
router.put("/me", async (req: Request, res: Response): Promise<void> => {
  const {
    name, age, height, weight,
    fitnessLevel, goal, diseases,
    gender,
    chest, waist, hips, arms, legs,
    neck,
    targetWeight,
    targetLeanMass,
    goalConfirmedByAI,
    mainTargetWeight, mainTargetBodyFatPct,
    mainTargetWaist, mainTargetHips, mainTargetNeck,             // NEW (goal redesign)
    mainTargetBenchPress, mainTargetSquat, mainTargetDeadlift,
    mainTargetOverheadPress,                                     // NEW (goal redesign)
    startBench, startSquat, startDeadlift, startOverheadPress,   // NEW (Phase 2) — lift baselines
    hasSetup,
  } = req.body;

  // Read current values + existing baselines so we can freeze each metric's
  // "start" value the FIRST time it's recorded — and never overwrite it after
  // (this is what keeps the goal/measurement progress anchored to a real start).
  const existing = await prisma.user.findUnique({
    where:  { id: req.user!.userId },
    select: {
      weight: true, chest: true, waist: true, hips: true, arms: true, legs: true, neck: true,
      startWeight: true, startChest: true, startWaist: true, startHips: true,
      startArms: true, startLegs: true, startNeck: true,
      startBench: true, startSquat: true, startDeadlift: true, startOverheadPress: true, // NEW (Phase 2)
      gender: true, height: true, startBodyFatPct: true,
      goal: true, // needed to know which auto-calc branch applies below
      fitnessLevel: true, // NEW — drives the level-based muscle-gain lean ratio
      mainTargetBodyFatPct: true, // NEW — so recomp can backfill a target if the AI gave none
    },
  });

  // Freeze a baseline only while it's still null. Prefer the value the user had
  // BEFORE this update (so the very first change already shows progress); fall
  // back to the incoming value when the metric has never been recorded.
  const freeze = (
    startVal: number | null | undefined,
    prevVal:  number | null | undefined,
    incoming: unknown,
  ): number | undefined => {
    if (startVal != null) return undefined;                          // already frozen
    if (prevVal  != null) return prevVal;                            // baseline = pre-update value
    if (incoming !== undefined && incoming) return Number(incoming); // brand-new metric
    return undefined;
  };

  const sWeight = freeze(existing?.startWeight, existing?.weight, weight);
  const sChest  = freeze(existing?.startChest,  existing?.chest,  chest);
  const sWaist  = freeze(existing?.startWaist,  existing?.waist,  waist);
  const sHips   = freeze(existing?.startHips,   existing?.hips,   hips);
  const sArms   = freeze(existing?.startArms,   existing?.arms,   arms);
  const sLegs   = freeze(existing?.startLegs,   existing?.legs,   legs);
  const sNeck   = freeze(existing?.startNeck,   existing?.neck,   neck); // NEW (goal redesign)
  // NEW (Phase 2) — lifts have no "current" column, so freeze straight from the
  // AI-supplied incoming value (prevVal undefined). Never overwrites once set.
  const sBench    = freeze(existing?.startBench,         undefined, startBench);
  const sSquat    = freeze(existing?.startSquat,         undefined, startSquat);
  const sDeadlift = freeze(existing?.startDeadlift,      undefined, startDeadlift);
  const sOHP      = freeze(existing?.startOverheadPress, undefined, startOverheadPress);

  // liveBodyFatPct — computed from whichever values are freshest (this
  // request's incoming gender/height/waist/neck/hips, falling back to what's
  // already on the row). Always computed (not just when unfrozen) because the
  // body_recomposition auto-calc below needs the CURRENT number, not
  // necessarily the frozen start.
  const finalGender = gender !== undefined ? gender : existing?.gender;
  const finalHeight = height !== undefined ? Number(height) : existing?.height;
  const finalWaist  = waist  !== undefined ? (waist ? Number(waist) : null) : existing?.waist;
  const finalNeck   = neck   !== undefined ? (neck  ? Number(neck)  : null) : existing?.neck;
  const finalHips   = hips   !== undefined ? (hips  ? Number(hips)  : null) : existing?.hips;
  let liveBodyFatPct: number | undefined;
  if ((finalGender === "male" || finalGender === "female") && finalHeight != null && finalWaist != null && finalNeck != null) {
    try {
      liveBodyFatPct = calculateBodyFat({
        gender: finalGender, heightCm: finalHeight, waistCm: finalWaist, neckCm: finalNeck,
        hipsCm: finalHips ?? undefined,
      });
    } catch {
      liveBodyFatPct = undefined; // e.g. female without hips yet
    }
  }
  // Freeze startBodyFatPct the first time it becomes available (unchanged behavior)
  const sBodyFatPct = existing?.startBodyFatPct == null ? liveBodyFatPct : undefined;

  // ── Auto-calculated companion targets (goal redesign — see plan doc A5) ──
  // Only ever fire when the AI's "asked" number for that goal arrives THIS
  // request, and only when the prerequisite start/current values are
  // available (falls back to undefined otherwise — the field just doesn't
  // get set yet, same graceful-degradation pattern used everywhere else).
  const effectiveGoal = goal !== undefined ? goal : existing?.goal;

  let autoTargetLeanMass:    number | undefined;
  let autoMainTargetWeight:  number | undefined; // body_recomposition only
  if ((effectiveGoal === "muscle_gain" || effectiveGoal === "bodybuilding") && mainTargetWeight !== undefined) {
    const baseStartWeight = existing?.startWeight ?? sWeight;
    const baseStartBF     = existing?.startBodyFatPct ?? sBodyFatPct;
    if (baseStartWeight != null && baseStartBF != null) {
      const effectiveLevel = fitnessLevel !== undefined ? fitnessLevel : existing?.fitnessLevel;
      const leanRatio = effectiveLevel === "مبتدئ" ? 0.6 : effectiveLevel === "متقدم" ? 0.3 : 0.45;
      const weightGain = Number(mainTargetWeight) - baseStartWeight;
      const startLean  = baseStartWeight * (1 - baseStartBF / 100);
      autoTargetLeanMass = Math.round((startLean + leanRatio * weightGain) * 10) / 10;
    }
  }
  // Recomp safety net: the AI sometimes mis-frames recomposition as a weight goal
  // and leaves the body-fat target empty. When the goal is recomp and there's no
  // target yet, auto-derive one — current bodyfat − 3, floored at a healthy
  // athletic level (~10% men / 18% women) — so the goal is always trackable.
  const incomingBF =
    mainTargetBodyFatPct !== undefined && mainTargetBodyFatPct !== null && mainTargetBodyFatPct !== ""
      ? Number(mainTargetBodyFatPct) : undefined;
  let recompFallbackBF: number | undefined;
  if (effectiveGoal === "body_recomposition" && incomingBF === undefined && existing?.mainTargetBodyFatPct == null) {
    const curBF = liveBodyFatPct ?? existing?.startBodyFatPct;
    if (curBF != null) {
      const floor = finalGender === "female" ? 18 : 10;
      recompFallbackBF = Math.max(floor, Math.round((curBF - 3) * 10) / 10);
    }
  }
  const effectiveTargetBF = incomingBF ?? recompFallbackBF;

  if (effectiveGoal === "body_recomposition" && effectiveTargetBF !== undefined) {
    const currentWeightVal = weight !== undefined ? Number(weight) : existing?.weight;
    const currentBFVal     = liveBodyFatPct ?? existing?.startBodyFatPct;
    if (currentWeightVal != null && currentBFVal != null) {
      const currentLean = currentWeightVal * (1 - currentBFVal / 100);
      autoTargetLeanMass = Math.round(currentLean * 1.03 * 10) / 10; // aim for ~+3% lean (recomp = fat down, muscle up)
      if (effectiveTargetBF < 100) {
        autoMainTargetWeight = Math.round((currentLean / (1 - effectiveTargetBF / 100)) * 10) / 10;
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      // Spread only the fields that were sent — undefined means "don't change"
      ...(name         !== undefined && { name }),
      ...(age          !== undefined && { age:          Number(age) }),
      ...(height       !== undefined && { height:       Number(height) }),
      ...(weight       !== undefined && { weight:       Number(weight) }),
      ...(fitnessLevel !== undefined && { fitnessLevel }),
      ...(goal         !== undefined && { goal }),
      ...(diseases     !== undefined && { diseases }),
      ...(gender       !== undefined && { gender }),
      ...(chest        !== undefined && { chest:        chest ? Number(chest) : null }),
      ...(waist        !== undefined && { waist:        waist ? Number(waist) : null }),
      ...(hips         !== undefined && { hips:         hips  ? Number(hips)  : null }),
      ...(arms         !== undefined && { arms:         arms  ? Number(arms)  : null }),
      ...(legs         !== undefined && { legs:         legs  ? Number(legs)  : null }),
      ...(neck         !== undefined && { neck:         neck  ? Number(neck)  : null }),
      ...(targetWeight !== undefined && { targetWeight: targetWeight ? Number(targetWeight) : null }),
      // Directly-AI-set targets (each only ever sent when confirmedGoal
      // actually included it, so a plain Number() is safe here)
      ...(mainTargetWeight        !== undefined && { mainTargetWeight:        Number(mainTargetWeight) }),
      ...(mainTargetBodyFatPct    !== undefined && { mainTargetBodyFatPct:    Number(mainTargetBodyFatPct) }),
      // Recomp fallback body-fat target (only when the AI supplied none)
      ...(recompFallbackBF !== undefined && mainTargetBodyFatPct === undefined && { mainTargetBodyFatPct: recompFallbackBF }),
      ...(mainTargetBenchPress    !== undefined && { mainTargetBenchPress:    Number(mainTargetBenchPress) }),
      ...(mainTargetSquat         !== undefined && { mainTargetSquat:         Number(mainTargetSquat) }),
      ...(mainTargetDeadlift      !== undefined && { mainTargetDeadlift:      Number(mainTargetDeadlift) }),
      ...(mainTargetOverheadPress !== undefined && { mainTargetOverheadPress: Number(mainTargetOverheadPress) }),
      // Auto-calculated targets — prefer an explicit value if one was ever
      // sent directly (future-proofing / manual override), else use what was
      // computed above. Only one source is ever populated per goal in practice.
      ...((targetLeanMass  !== undefined || autoTargetLeanMass  !== undefined) &&
        { targetLeanMass:  Number(targetLeanMass  ?? autoTargetLeanMass) }),
      // body_recomposition's derived weight target — merges into the SAME
      // mainTargetWeight field fat_loss/muscle_gain/bodybuilding set directly
      // above; only one goal's branch ever fires per request.
      ...(autoMainTargetWeight !== undefined && mainTargetWeight === undefined &&
        { mainTargetWeight: autoMainTargetWeight }),
      ...(goalConfirmedByAI !== undefined && { goalConfirmedByAI: Boolean(goalConfirmedByAI) }),
      ...(hasSetup          !== undefined && { hasSetup:          Boolean(hasSetup) }),
      // Freeze baselines the first time each metric is recorded (see freeze())
      ...(sWeight     !== undefined && { startWeight:     sWeight }),
      ...(sChest      !== undefined && { startChest:      sChest }),
      ...(sWaist      !== undefined && { startWaist:      sWaist }),
      ...(sHips       !== undefined && { startHips:       sHips }),
      ...(sArms       !== undefined && { startArms:       sArms }),
      ...(sLegs       !== undefined && { startLegs:       sLegs }),
      ...(sNeck       !== undefined && { startNeck:       sNeck }),      // NEW (goal redesign)
      ...(sBodyFatPct !== undefined && { startBodyFatPct: sBodyFatPct }),
      ...(sBench    !== undefined && { startBench:         sBench }),      // NEW (Phase 2)
      ...(sSquat    !== undefined && { startSquat:         sSquat }),
      ...(sDeadlift !== undefined && { startDeadlift:      sDeadlift }),
      ...(sOHP      !== undefined && { startOverheadPress: sOHP }),
    },
    select: {
      id:          true,
      name:        true,
      email:       true,
      role:        true,
      plan:        true,
      hasSetup:    true,
      age:         true,
      height:      true,
      weight:      true,
      fitnessLevel:true,
      goal:        true,
      diseases:    true,
      gender:      true,
      chest:       true,
      waist:       true,
      hips:        true,
      arms:        true,
      legs:        true,
      neck:        true,
      targetWeight:true,
      targetLeanMass:           true,
      goalConfirmedByAI:        true,
      mainTargetWeight:         true,
      mainTargetBodyFatPct:     true,
      mainTargetWaist:          true,
      mainTargetHips:           true,
      mainTargetNeck:           true,
      mainTargetBenchPress:     true,
      mainTargetSquat:          true,
      mainTargetDeadlift:       true,
      mainTargetOverheadPress:  true,
      startWeight: true,
      startChest:  true,
      startWaist:  true,
      startHips:   true,
      startArms:   true,
      startLegs:   true,
      startNeck:   true,
    },
  });

  res.json(updated);
});

// ── GET /users/me/coach ───────────────────────────────────────────────────────
// Returns the coach assigned to this user, or null if no coach is assigned.
// Used by the premium page and dashboard to show coach info.
router.get("/me/coach", async (req: Request, res: Response): Promise<void> => {
  const assignment = await prisma.coachAssignment.findUnique({
    where:   { userId: req.user!.userId },
    include: {
      coach: {
        select: {
          id: true, name: true, email: true, specialty: true, status: true,
          bio: true, yearsExperience: true, certification: true, certifications: true, profileImage: true,
          _count: { select: { assignments: true } },
        },
      },
    },
  });

  // Return null if the user has no coach — frontend handles this gracefully.
  // Certificate numbers are private → stripped; expose only the certificate types.
  const coach = assignment?.coach;
  res.json(coach ? {
    ...coach,
    _count: undefined,
    clientCount:    coach._count.assignments,
    certifications: stripCertNumbers(normalizeCertifications(coach.certifications)),
  } : null);
});

// ── GET /users/me/coach-notes ───────────────────────────────────────────────────
// All notes the user's coach has left on their exercises and meals, so the user
// can see their coach's feedback inline on the relevant exercise/meal.
// Keyed by exerciseId / mealId on the frontend for quick lookup.
router.get("/me/coach-notes", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const [exerciseNotes, mealNotes] = await Promise.all([
    prisma.exerciseNote.findMany({
      where:  { userId },
      select: { exerciseId: true, noteText: true },
    }),
    prisma.mealNote.findMany({
      where:  { userId },
      select: { mealId: true, noteText: true },
    }),
  ]);

  res.json({ exerciseNotes, mealNotes });
});

// ── GET /users/me/messages ──────────────────────────────────────────────────────
// The full chat thread with the user's coach. Opening the thread marks the
// coach's messages as read.
router.get("/me/messages", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const assignment = await prisma.coachAssignment.findUnique({ where: { userId } });
  if (!assignment) {
    res.json([]);
    return;
  }

  // Mark coach → user messages as read now that the user is viewing them
  await prisma.message.updateMany({
    where: { userId, senderRole: "coach", read: false },
    data:  { read: true },
  });

  const messages = await prisma.message.findMany({
    where:   { userId },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});

// ── GET /users/me/messages/unread-count ─────────────────────────────────────────
// Number of unread coach messages — drives the chat-bubble badge without
// marking anything read.
router.get("/me/messages/unread-count", async (req: Request, res: Response): Promise<void> => {
  const count = await prisma.message.count({
    where: { userId: req.user!.userId, senderRole: "coach", read: false },
  });
  res.json({ count });
});

// ── POST /users/me/messages ─────────────────────────────────────────────────────
// Send a message to the user's coach. Requires an assigned coach (premium).
router.post("/me/messages", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const text   = (req.body.text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "Message text is required" });
    return;
  }

  const assignment = await prisma.coachAssignment.findUnique({ where: { userId } });
  if (!assignment) {
    res.status(403).json({ error: "No coach assigned" });
    return;
  }

  const message = await prisma.message.create({
    data: { userId, coachId: assignment.coachId, senderRole: "user", text },
  });

  // Notify the coach of the new message
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  await notify({
    recipientId:   assignment.coachId,
    recipientRole: "coach",
    type:          "new_message",
    text:          `رسالة جديدة من ${me?.name ?? "متدرب"}`,
    link:          `/coach/chat?user=${userId}`,
  });

  res.status(201).json(message);
});

// ── GET /users/coaches ──────────────────────────────────────────────────────────
// Lists active coaches a premium user can choose from. Any logged-in user may read.
router.get("/coaches", async (_req: Request, res: Response): Promise<void> => {
  const coaches = await prisma.coach.findMany({
    where:   { status: "active" },
    select:  {
      id: true, name: true, specialty: true, status: true,
      bio: true, yearsExperience: true, certification: true, certifications: true, profileImage: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });
  // Certificate numbers are private → stripped; users see only the certificate
  // types plus a live count of the coach's current clients.
  res.json(coaches.map(({ _count, ...c }) => ({
    ...c,
    clientCount:    _count.assignments,
    certifications: stripCertNumbers(normalizeCertifications(c.certifications)),
  })));
});

// ── POST /users/me/coach ────────────────────────────────────────────────────────
// A premium user picks (or switches) their own coach. Mirrors the admin assign logic:
// one coach per user, so we clear any existing assignment first.
router.post("/me/coach", async (req: Request, res: Response): Promise<void> => {
  const { coachId } = req.body;
  const userId      = req.user!.userId;

  if (!coachId) {
    res.status(400).json({ error: "coachId is required" });
    return;
  }

  // Only premium users may have a human coach
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (user?.plan !== "premium") {
    res.status(403).json({ error: "Premium plan required" });
    return;
  }

  // Make sure the chosen coach exists and is active
  const coach = await prisma.coach.findFirst({
    where:  { id: coachId, status: "active" },
    select: {
      id: true, name: true, email: true, specialty: true, status: true,
      bio: true, yearsExperience: true, certification: true, profileImage: true,
    },
  });
  if (!coach) {
    res.status(404).json({ error: "Coach not found" });
    return;
  }

  // One coach per user — replace any existing assignment
  await prisma.coachAssignment.deleteMany({ where: { userId } });
  await prisma.coachAssignment.create({ data: { coachId, userId } });

  // Notify the coach they have a new client
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  await notify({
    recipientId:   coachId,
    recipientRole: "coach",
    type:          "new_client",
    text:          `متدرب جديد اختارك: ${me?.name ?? "مستخدم"}`,
    link:          "/coach",
  });

  res.json(coach);
});

// ── DELETE /users/me/coach ──────────────────────────────────────────────────────
// The user removes their assigned coach (goes coach-less until they pick again).
router.delete("/me/coach", async (req: Request, res: Response): Promise<void> => {
  await prisma.coachAssignment.deleteMany({ where: { userId: req.user!.userId } });
  res.json({ success: true });
});

export default router;