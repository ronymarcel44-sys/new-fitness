// fitai-backend/src/routes/notifications.routes.ts
//
// Notifications for the logged-in account (works for both users and coaches —
// the recipient is matched by id + role). Events are created elsewhere (message
// send, coach pick); this file only reads and marks them read.
//
//   GET  /notifications              → recent notifications (newest first)
//   GET  /notifications/unread-count → number of unread (drives the bell badge)
//   POST /notifications/mark-read    → mark all the account's notifications read

import { Router, Request, Response } from "express";
import { prisma }       from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// Helper used by other routes to emit a notification
export async function notify(opts: {
  recipientId: string;
  recipientRole: "user" | "coach";
  type: string;
  text: string;
  link?: string | null;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      recipientId:   opts.recipientId,
      recipientRole: opts.recipientRole,
      type:          opts.type,
      text:          opts.text,
      link:          opts.link ?? null,
    },
  });
}

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const items = await prisma.notification.findMany({
    where:   { recipientId: req.user!.userId, recipientRole: req.user!.role },
    orderBy: { createdAt: "desc" },
    take:    30,
  });
  res.json(items);
});

router.get("/unread-count", async (req: Request, res: Response): Promise<void> => {
  const count = await prisma.notification.count({
    where: { recipientId: req.user!.userId, recipientRole: req.user!.role, read: false },
  });
  res.json({ count });
});

router.post("/mark-read", async (req: Request, res: Response): Promise<void> => {
  await prisma.notification.updateMany({
    where: { recipientId: req.user!.userId, recipientRole: req.user!.role, read: false },
    data:  { read: true },
  });
  res.json({ success: true });
});

export default router;
