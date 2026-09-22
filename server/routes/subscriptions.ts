// server/routes/subscriptions.ts
import { Router } from "express";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { subscriptionHistory } from "../../shared/schema";
import { effectiveMarketplaceTier, paidCancellationUnavailableResponse, paidUpgradeUnavailableResponse } from "../lib/subscription-security";

const router = Router();

/**
 * SUBSCRIPTION TIER SYSTEM
 * ------------------------
 * Tiers:
 * - free: 10% commission, no features
 * - starter ($15/mo): 8% commission, basic store
 * - professional ($35/mo): 5% commission, full store builder
 * - enterprise ($75/mo): 3% commission, priority support
 * - premium_plus ($150/mo): 1% commission, white-label options
 */

export const SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    price: 0,
    commission: 10,
    features: [
      "List up to 5 products",
      "10% commission on sales",
      "Basic product listings",
      "Community support",
    ],
    limits: {
      maxProducts: 5,
      storeBuilder: false,
      analytics: false,
      priority: false,
    },
  },
  starter: {
    name: "Starter",
    price: 15,
    commission: 8,
    features: [
      "List up to 50 products",
      "8% commission on sales",
      "Custom store page",
      "Basic analytics",
      "Email support",
    ],
    limits: {
      maxProducts: 50,
      storeBuilder: true,
      analytics: true,
      priority: false,
    },
  },
  professional: {
    name: "Professional",
    price: 35,
    commission: 5,
    features: [
      "Unlimited products",
      "5% commission on sales",
      "Full store builder",
      "Advanced analytics",
      "Priority email support",
      "Custom domain option",
    ],
    limits: {
      maxProducts: -1, // unlimited
      storeBuilder: true,
      analytics: true,
      priority: false,
    },
  },
  enterprise: {
    name: "Enterprise",
    price: 75,
    commission: 3,
    features: [
      "Unlimited products",
      "3% commission on sales",
      "Full store builder",
      "Advanced analytics + exports",
      "Priority phone support",
      "Custom domain",
      "API access",
    ],
    limits: {
      maxProducts: -1,
      storeBuilder: true,
      analytics: true,
      priority: true,
    },
  },
  premium_plus: {
    name: "Premium Plus",
    price: 150,
    commission: 1,
    features: [
      "Unlimited products",
      "1% commission on sales",
      "Full store builder",
      "White-label options",
      "Dedicated account manager",
      "Custom integrations",
      "API access",
    ],
    limits: {
      maxProducts: -1,
      storeBuilder: true,
      analytics: true,
      priority: true,
    },
  },
} as const;

type TierKey = keyof typeof SUBSCRIPTION_TIERS;

function coerceTier(tier: string | null | undefined): TierKey {
  const t = (tier || "free") as TierKey;
  return SUBSCRIPTION_TIERS[t] ? t : "free";
}

async function ensureSubscriptionHistoryTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscription_history (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES users(id),
      tier TEXT NOT NULL,
      amount NUMERIC(8,2) NOT NULL,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP NOT NULL,
      status TEXT NOT NULL,
      payment_method TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS subscription_history_user_idx
      ON subscription_history(user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS subscription_history_created_at_idx
      ON subscription_history(created_at)
  `);
}

// GET /api/subscriptions/tiers - Get all available tiers
router.get("/tiers", async (_req, res) => {
  res.json({
    ok: true,
    tiers: SUBSCRIPTION_TIERS,
  });
});

// GET /api/subscriptions/my-tier - Get current user's tier
router.get("/my-tier", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const tierName = coerceTier(effectiveMarketplaceTier(user as any));
    const tier = SUBSCRIPTION_TIERS[tierName];

    res.json({
      ok: true,
      currentTier: tierName,
      tierInfo: tier,
      status: (user as any).subscriptionStatus || "active",
      endsAt: (user as any).subscriptionEndsAt || null,
      monthlyRevenue: (user as any).monthlyRevenue || 0,
    });
  } catch (error) {
    console.error("Error fetching user tier:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch subscription" });
  }
});

// GET /api/subscriptions/history - Get user's subscription history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    });

    const { limit } = schema.parse(req.query);

    await ensureSubscriptionHistoryTable();

    const rows = await db
      .select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.userId, userId))
      .orderBy(desc(subscriptionHistory.createdAt))
      .limit(limit);

    res.json({
      ok: true,
      history: rows.map((row: any) => {
        const rowTier = String(row.tier || "");
        const rowPaymentMethod = String(row.paymentMethod || "").toLowerCase();

        const subscriptionType =
          rowPaymentMethod === "nutrition" || rowTier.startsWith("nutrition_")
            ? "nutrition"
            : "marketplace";

        return {
          id: row.id,
          tier: row.tier,
          amount: row.amount,
          startDate: row.startDate,
          endDate: row.endDate,
          status: row.status,
          paymentMethod: row.paymentMethod || null,
          createdAt: row.createdAt,
          subscriptionType, // <-- additive field for UI labeling
        };
      }),
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid request", errors: error.issues });
    }
    console.error("Error fetching subscription history:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch subscription history" });
  }
});

// POST /api/subscriptions/upgrade
// No verified provider-to-account reconciliation exists. Client-selected paid tiers fail closed.
router.post("/upgrade", requireAuth, async (req, res) => {
  const schema = z.object({
    tier: z.enum(["starter", "professional", "enterprise", "premium_plus"]),
  }).strict();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid tier", errors: parsed.error.issues });
  }

  return res.status(503).json(paidUpgradeUnavailableResponse);
});

// POST /api/subscriptions/cancel
// Do not claim an external cancellation without provider confirmation.
router.post("/cancel", requireAuth, async (req, res) => {
  const user = await storage.getUser(req.user!.id);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });

  const currentTier = coerceTier((user as any).subscriptionTier || "free");
  if (currentTier === "free") {
    return res.json({ ok: true, message: "Subscription is already Free.", tier: "free" });
  }

  return res.status(503).json(paidCancellationUnavailableResponse);
});

// Paid-to-paid changes also require authoritative billing evidence.
router.post("/downgrade", requireAuth, async (req, res) => {
  const schema = z.object({
    tier: z.enum(["starter", "professional", "enterprise", "premium_plus"]),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid tier", errors: parsed.error.issues });
  }
  return res.status(503).json(paidUpgradeUnavailableResponse);
});

// GET /api/subscriptions/calculate-commission - Calculate commission for a sale
router.get("/calculate-commission", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const saleAmount = parseFloat(req.query.amount as string);

    if (!saleAmount || isNaN(saleAmount)) {
      return res.status(400).json({ ok: false, error: "Invalid sale amount" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const tierName = coerceTier(effectiveMarketplaceTier(user as any));
    const commissionRate = SUBSCRIPTION_TIERS[tierName].commission;

    const platformFee = (saleAmount * commissionRate) / 100;
    const sellerAmount = saleAmount - platformFee;

    res.json({
      ok: true,
      saleAmount,
      commissionRate,
      platformFee: platformFee.toFixed(2),
      sellerAmount: sellerAmount.toFixed(2),
      tier: tierName,
    });
  } catch (error) {
    console.error("Error calculating commission:", error);
    res.status(500).json({ ok: false, error: "Failed to calculate commission" });
  }
});

export default router;
