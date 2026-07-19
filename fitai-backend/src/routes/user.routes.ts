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
import { calculateBodyFat } from "../lib/bodyFat"; // NEW (Task 6 fix)

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
      gender:      true,   // NEW (Task 3)
      chest:       true,
      waist:       true,
      hips:        true,
      arms:        true,
      legs:        true,
      neck:        true,   // NEW (Task 3)
      targetWeight:true,
      // NEW (Task 5) — confirmed goal targets from the AI onboarding flow
      targetBodyFatPct:     true,
      targetLeanMass:       true,
      targetBenchPress:     true,
      targetSquat:          true,
      targetDeadlift:       true,
      targetCardioDuration: true,
      goalConfirmedByAI:    true,
      // NEW (Task 6-prep) — long-distance "main" goal, parallel to the mini fields above
      mainTargetWeight:         true,
      mainTargetBodyFatPct:     true,
      mainTargetBenchPress:     true,
      mainTargetSquat:          true,
      mainTargetDeadlift:       true,
      mainTargetCardioDuration: true,
      startWeight: true,
      startChest:  true,
      startWaist:  true,
      startHips:   true,
      startArms:   true,
      startLegs:   true,
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
router.put("/me", async (req: Request, res: Response): Promise<void> => {
  const {
    name, age, height, weight,
    fitnessLevel, goal, diseases,
    gender,                          // NEW (Task 3)
    chest, waist, hips, arms, legs,
    neck,                            // NEW (Task 3)
    targetWeight,
    // NEW (Task 5) — confirmed goal targets from the AI onboarding flow
    targetBodyFatPct, targetLeanMass, targetBenchPress, targetSquat, targetDeadlift, targetCardioDuration,
    goalConfirmedByAI,
    // NEW (Task 6-prep) — the long-distance "main" goal
    mainTargetWeight, mainTargetBodyFatPct, mainTargetBenchPress, mainTargetSquat, mainTargetDeadlift, mainTargetCardioDuration,
    hasSetup,
  } = req.body;

  // Read current values + existing baselines so we can freeze each metric's
  // "start" value the FIRST time it's recorded — and never overwrite it after
  // (this is what keeps the goal/measurement progress anchored to a real start).
  const existing = await prisma.user.findUnique({
    where:  { id: req.user!.userId },
    select: {
      weight: true, chest: true, waist: true, hips: true, arms: true, legs: true,
      startWeight: true, startChest: true, startWaist: true, startHips: true, startArms: true, startLegs: true,
      gender: true, height: true, neck: true, startBodyFatPct: true, // NEW (Task 6 fix)
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

  // NEW (Task 6 fix) — startBodyFatPct is derived (gender+height+waist+neck),
  // not a directly-submitted field, so it can't reuse freeze() as-is. Merge
  // this update's incoming values with what's already on the row, and freeze
  // the FIRST TIME all four inputs happen to be available together (usually
  // right when the onboarding chat's measurements question gets answered).
  let sBodyFatPct: number | undefined;
  if (existing?.startBodyFatPct == null) {
    const finalGender = gender !== undefined ? gender : existing?.gender;
    const finalHeight = height !== undefined ? Number(height) : existing?.height;
    const finalWaist  = waist  !== undefined ? (waist ? Number(waist) : null) : existing?.waist;
    const finalNeck   = neck   !== undefined ? (neck  ? Number(neck)  : null) : existing?.neck;
    const finalHips   = hips   !== undefined ? (hips  ? Number(hips)  : null) : existing?.hips;
    if ((finalGender === "male" || finalGender === "female") && finalHeight != null && finalWaist != null && finalNeck != null) {
      try {
        sBodyFatPct = calculateBodyFat({
          gender: finalGender, heightCm: finalHeight, waistCm: finalWaist, neckCm: finalNeck,
          hipsCm: finalHips ?? undefined,
        });
      } catch {
        sBodyFatPct = undefined; // e.g. female without hips yet
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
      ...(gender       !== undefined && { gender }),                                    // NEW (Task 3)
      ...(chest        !== undefined && { chest:        chest ? Number(chest) : null }),
      ...(waist        !== undefined && { waist:        waist ? Number(waist) : null }),
      ...(hips         !== undefined && { hips:         hips  ? Number(hips)  : null }),
      ...(arms         !== undefined && { arms:         arms  ? Number(arms)  : null }),
      ...(legs         !== undefined && { legs:         legs  ? Number(legs)  : null }),
      ...(neck         !== undefined && { neck:         neck  ? Number(neck)  : null }), // NEW (Task 3)
      ...(targetWeight !== undefined && { targetWeight: targetWeight ? Number(targetWeight) : null }),
      // NEW (Task 5) — each is only ever sent by ChatPage when the AI's
      // confirmedGoal block actually included it, so a plain Number() is safe
      // (no "clear to null" use case here, unlike targetWeight).
      ...(targetBodyFatPct     !== undefined && { targetBodyFatPct:     Number(targetBodyFatPct) }),
      ...(targetLeanMass       !== undefined && { targetLeanMass:       Number(targetLeanMass) }),
      ...(targetBenchPress     !== undefined && { targetBenchPress:     Number(targetBenchPress) }),
      ...(targetSquat          !== undefined && { targetSquat:          Number(targetSquat) }),
      ...(targetDeadlift       !== undefined && { targetDeadlift:       Number(targetDeadlift) }),
      ...(targetCardioDuration !== undefined && { targetCardioDuration: Number(targetCardioDuration) }),
      ...(goalConfirmedByAI    !== undefined && { goalConfirmedByAI:    Boolean(goalConfirmedByAI) }),
      // NEW (Task 6-prep) — the long-distance "main" goal, same pattern as above
      ...(mainTargetWeight         !== undefined && { mainTargetWeight:         Number(mainTargetWeight) }),
      ...(mainTargetBodyFatPct     !== undefined && { mainTargetBodyFatPct:     Number(mainTargetBodyFatPct) }),
      ...(mainTargetBenchPress     !== undefined && { mainTargetBenchPress:     Number(mainTargetBenchPress) }),
      ...(mainTargetSquat          !== undefined && { mainTargetSquat:          Number(mainTargetSquat) }),
      ...(mainTargetDeadlift       !== undefined && { mainTargetDeadlift:       Number(mainTargetDeadlift) }),
      ...(mainTargetCardioDuration !== undefined && { mainTargetCardioDuration: Number(mainTargetCardioDuration) }),
      ...(hasSetup     !== undefined && { hasSetup:     Boolean(hasSetup) }),
      // Freeze baselines the first time each metric is recorded (see freeze())
      ...(sWeight !== undefined && { startWeight: sWeight }),
      ...(sChest  !== undefined && { startChest:  sChest }),
      ...(sWaist  !== undefined && { startWaist:  sWaist }),
      ...(sHips   !== undefined && { startHips:   sHips }),
      ...(sArms   !== undefined && { startArms:   sArms }),
      ...(sLegs   !== undefined && { startLegs:   sLegs }),
      ...(sBodyFatPct !== undefined && { startBodyFatPct: sBodyFatPct }), // NEW (Task 6 fix)
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
      gender:      true,   // NEW (Task 3)
      chest:       true,
      waist:       true,
      hips:        true,
      arms:        true,
      legs:        true,
      neck:        true,   // NEW (Task 3)
      targetWeight:true,
      // NEW (Task 5)
      targetBodyFatPct:     true,
      targetLeanMass:       true,
      targetBenchPress:     true,
      targetSquat:          true,
      targetDeadlift:       true,
      targetCardioDuration: true,
      goalConfirmedByAI:    true,
      // NEW (Task 6-prep)
      mainTargetWeight:         true,
      mainTargetBodyFatPct:     true,
      mainTargetBenchPress:     true,
      mainTargetSquat:          true,
      mainTargetDeadlift:       true,
      mainTargetCardioDuration: true,
      startWeight: true,
      startChest:  true,
      startWaist:  true,
      startHips:   true,
      startArms:   true,
      startLegs:   true,
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
          bio: true, yearsExperience: true, certification: true, profileImage: true,
        },
      },
    },
  });

  // Return null if the user has no coach — frontend handles this gracefully
  res.json(assignment?.coach ?? null);
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
      bio: true, yearsExperience: true, certification: true, profileImage: true,
    },
    orderBy: { name: "asc" },
  });
  res.json(coaches);
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