// fitai-backend/src/routes/auth.routes.ts
//
// Public routes — no JWT required to call these
//
// POST /auth/register → create a new user account
// POST /auth/login    → login with email + password, returns access + refresh tokens
// POST /auth/refresh  → exchange a refresh token for a new access token
//
// These routes handle users, admins, and coaches all in one login endpoint
// by checking each table in sequence until a match is found

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/jwt";
import { normalizeCertifications } from "../lib/certs";

const router = Router();

// ── POST /auth/register ───────────────────────────────────────────────────────
// Creates a new user account with role "user" and plan "free" by default
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  // Make sure all required fields are present
  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }

  // Prevent duplicate email registrations
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "This email is already registered" });
    return;
  }

  // Hash the password before storing — never store plain text passwords
  // 12 rounds is the recommended minimum for bcrypt
  const passwordHash = await bcrypt.hash(password, 12);

  // Create the user in the database
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "user", plan: "free" },
    // Only return safe fields — never return passwordHash
    select: { id: true, name: true, email: true, role: true, plan: true },
  });

  // Sign tokens so the user is logged in immediately after registering
  const tokenPayload = { userId: user.id, role: user.role };

  res.status(201).json({
    user,
    accessToken:  signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  });
});

// ── POST /auth/register-coach ─────────────────────────────────────────────────
// A trainer signs themselves up. The account starts as status "pending" and is
// invisible/unassignable to users until an admin verifies and approves it.
// On success the coach is logged in immediately and lands on the "under review"
// screen (the frontend gates the dashboard on status).
router.post("/register-coach", async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, specialty, bio, yearsExperience, certifications } = req.body;

  if (!name || !email || !password || !specialty) {
    res.status(400).json({ error: "Name, email, password, and specialty are required" });
    return;
  }

  // At least one complete certificate (type + number) is required for self-registration.
  const certs = normalizeCertifications(certifications);
  if (certs.length === 0) {
    res.status(400).json({ error: "At least one certificate (type + number) is required" });
    return;
  }

  // Email must be unique across all account tables — login checks users → admins →
  // coaches in order, so a coach sharing an email with a user could never log in.
  const [existingUser, existingAdmin, existingCoach] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.admin.findUnique({ where: { email } }),
    prisma.coach.findUnique({ where: { email } }),
  ]);
  if (existingUser || existingAdmin || existingCoach) {
    res.status(409).json({ error: "This email is already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const coach = await prisma.coach.create({
    data: {
      name,
      email,
      passwordHash,
      specialty,
      status:          "pending",
      bio:             bio || null,
      yearsExperience: yearsExperience != null && yearsExperience !== "" ? Number(yearsExperience) : null,
      certifications:  certs,
    },
    select: { id: true, name: true, email: true },
  });

  // Auto-login so the trainer sees the "under review" screen right away
  const tokenPayload = { userId: coach.id, role: "coach" };

  res.status(201).json({
    user:         { ...coach, role: "coach" },
    accessToken:  signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
// Works for users, admins, and coaches — tries each table until a match is found
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  // We need a common shape to work with regardless of which table the account is in
  let account: {
    id:           string;
    name:         string;
    role:         string;
    passwordHash: string;
  } | null = null;

  // 1. Check the users table first (most common case)
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    account = { id: user.id, name: user.name, role: user.role, passwordHash: user.passwordHash };
  }

  // 2. If not found in users, check admins table
  if (!account) {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (admin) {
      account = { id: admin.id, name: admin.name, role: "admin", passwordHash: admin.passwordHash };
    }
  }

  // 3. If not found in admins, check coaches table
  if (!account) {
    const coach = await prisma.coach.findUnique({ where: { email } });
    if (coach) {
      account = { id: coach.id, name: coach.name, role: "coach", passwordHash: coach.passwordHash };
    }
  }

  // Email not found in any table — use a generic error (don't reveal which table was checked)
  if (!account) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Compare the submitted password against the stored hash
  const passwordValid = await bcrypt.compare(password, account.passwordHash);
  if (!passwordValid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Build the token payload and sign both tokens
  const tokenPayload = { userId: account.id, role: account.role };

  res.json({
    // Return enough user info for Redux to set auth state
    user: { id: account.id, name: account.name, email, role: account.role },
    accessToken:  signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────
// The frontend sends the refresh token when the access token expires
// Returns a new access token without requiring the user to log in again
router.post("/refresh", (req: Request, res: Response): void => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token is required" });
    return;
  }

  try {
    // Verify the refresh token — throws if expired or invalid
    const payload = verifyToken(refreshToken);

    // Issue a fresh access token with the same user info
    res.json({
      accessToken: signAccessToken({ userId: payload.userId, role: payload.role }),
    });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token — please log in again" });
  }
});

export default router;
