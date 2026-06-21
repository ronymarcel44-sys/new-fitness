// fitai-backend/src/routes/chat.routes.ts
//
// Endpoints:
//   GET    /chat  → get full message history for the user (oldest first)
//   POST   /chat  → save a new message (user or AI)
//   DELETE /chat  → clear the user's entire chat history

import { Router, Request, Response } from "express";
import { prisma }       from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// ── GET /chat ─────────────────────────────────────────────────────────────────
// Returns all messages for this user, oldest first so the chat renders correctly.
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const messages = await prisma.chatMessage.findMany({
    where:   { userId: req.user!.userId },
    orderBy: { timestamp: "asc" },
  });

  res.json(messages);
});

// ── POST /chat ────────────────────────────────────────────────────────────────
// Saves a single message to the user's conversation.
// Called once for every user message AND once for every AI reply.
// Body: { role: "user" | "assistant", content: string }
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { role, content } = req.body;

  if (!role || !content) {
    res.status(400).json({ error: "role and content are required" });
    return;
  }

  if (role !== "user" && role !== "assistant") {
    res.status(400).json({ error: "role must be 'user' or 'assistant'" });
    return;
  }

  const message = await prisma.chatMessage.create({
    data: {
      userId:  req.user!.userId,
      role,
      content,
    },
  });

  res.status(201).json(message);
});

// ── DELETE /chat ──────────────────────────────────────────────────────────────
// Clears the user's entire chat history.
// Called when the user clicks "مسح" in the chat UI.
router.delete("/", async (req: Request, res: Response): Promise<void> => {
  await prisma.chatMessage.deleteMany({
    where: { userId: req.user!.userId },
  });

  res.json({ success: true });
});

export default router;