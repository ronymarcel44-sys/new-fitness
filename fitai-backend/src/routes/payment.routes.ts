// fitai-backend/src/routes/payment.routes.ts
//
// Stripe Checkout (test mode) for upgrading a user to premium.
//
// Flow (no webhook — works on localhost):
//   1. POST /payment/create-checkout-session → creates a hosted Stripe Checkout
//      session and returns its URL. The frontend redirects the browser there.
//   2. Stripe sends the user back to FRONTEND_URL/premium?session_id={...} on
//      success. The frontend then calls GET /payment/confirm?session_id=... which
//      verifies the payment server-side and flips User.plan to "premium".
//
// Pricing is defined inline via price_data, so no products need to be created
// in the Stripe dashboard. Only STRIPE_SECRET_KEY (sk_test_...) is required.

import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { prisma }       from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// Billing options — amounts in cents (USD). Annual = $10 × 12 × 0.70 = $84.
const PRICES = {
  monthly: { unit_amount: 1000, interval: "month" as const, label: "FitAI Premium (شهري)" },
  annual:  { unit_amount: 8400, interval: "year"  as const, label: "FitAI Premium (سنوي)" },
};

// ── POST /payment/create-checkout-session ──────────────────────────────────────
router.post("/create-checkout-session", async (req: Request, res: Response): Promise<void> => {
  const interval = req.body.interval === "annual" ? "annual" : "monthly";
  const price    = PRICES[interval];

  const user = await prisma.user.findUnique({
    where:  { id: req.user!.userId },
    select: { email: true, plan: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.plan === "premium") {
    res.status(400).json({ error: "Already premium" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode:           "subscription",
      customer_email: user.email,
      metadata:       { userId: req.user!.userId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency:    "usd",
            unit_amount: price.unit_amount,
            recurring:   { interval: price.interval },
            product_data: { name: price.label },
          },
        },
      ],
      success_url: `${FRONTEND_URL}/premium?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${FRONTEND_URL}/premium?canceled=1`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    res.status(500).json({ error: "Failed to start checkout" });
  }
});

// ── GET /payment/confirm?session_id=... ─────────────────────────────────────────
// Verifies the session belongs to this user and was paid, then upgrades the plan.
// Idempotent: if the user is already premium, just report success.
router.get("/confirm", async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId) {
    res.status(400).json({ error: "Missing session_id" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== req.user!.userId) {
      res.status(403).json({ error: "Session does not belong to this user" });
      return;
    }
    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment not completed" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data:  { plan: "premium" },
      select: { plan: true },
    });

    res.json(updated);
  } catch (err) {
    console.error("Stripe confirm error:", err);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});

export default router;
