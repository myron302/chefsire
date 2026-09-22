// server/routes/square.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware";
import { subscriptionCheckoutUnavailableResponse } from "../lib/subscription-security";

const router = Router();

/**
 * POST /api/square/subscription-link
 * Body: { tier: "pro" | "enterprise", trial?: boolean }
 *
 * Subscription checkout is intentionally disabled. ChefSire has no verified
 * provider-completion path that can safely turn a successful recurring charge
 * into account-owned entitlement.
 */
router.post("/subscription-link", requireAuth, async (req, res) => {
  const parsed = z.object({
    tier: z.enum(["pro", "enterprise"]),
    trial: z.boolean().optional(),
  }).strict().safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_SUBSCRIPTION_CHECKOUT",
      error: "Invalid subscription checkout request",
      errors: parsed.error.issues,
    });
  }

  // Stop before loading/calling Square. Configured credentials must not make a
  // chargeable checkout reachable while entitlement activation is unavailable.
  return res.status(503).json(subscriptionCheckoutUnavailableResponse);
});

// This diagnostic used the same subscription Square client. Keep it disabled
// with the incomplete subscription billing surface rather than initializing it.
router.get("/locations", async (_req, res) => {
  return res.status(503).json(subscriptionCheckoutUnavailableResponse);
});

export default router;
