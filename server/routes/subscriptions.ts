// server/routes/subscriptions.ts
import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { subscriptionHistory } from "../../shared/schema";

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

const TIER_ORDER: TierKey[] = ["free", "starter", "professional", "enterprise", "premium_plus"];

function tierRank(tier: string | null | undefined): number {
  const idx = TIER_ORDER.indexOf((tier || "free") as TierKey);
  return idx === -1 ? 0 : idx;
}

function coerceTier(tier: string | null | undefined): TierKey {
  const t = (tier || "free") as TierKey;
  return SUBSCRIPTION_TIERS[t] ? t : "free";
}

function tierPriceAsString(tier: TierKey): string {
  const price = SUBSCRIPTION_TIERS[tier]?.price ?? 0;
  return Number(price).toFixed(2);
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

async function logSubscriptionHistory(params: {
  userId: string;
  tier: TierKey;
  amount: string;
  startDate: Date;
  endDate: Date;
  status: string;
  paymentMethod?: string | null;
}) {
  await ensureSubscriptionHistoryTable();

  await db.insert(subscriptionHistory).values({
    userId: params.userId,
    tier: params.tier,
    amount: params.amount,
    startDate: params.startDate,
    endDate: params.endDate,
    status: params.status,
    paymentMethod: params.paymentMethod ?? null,
  } as any);
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

    const tierName = coerceTier((user as any).subscriptionTier || "free");
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
      history: rows.map((row: any) => ({
        id: row.id,
        tier: row.tier,
        amount: row.amount,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        paymentMethod: row.paymentMethod || null,
        createdAt: row.createdAt,
      })),
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid request", errors: error.issues });
    }
    console.error("Error fetching subscription history:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch subscription history" });
  }
});

// POST /api/subscriptions/upgrade - Upgrade OR downgrade to a paid tier
router.post("/upgrade", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tier: z.enum(["starter", "professional", "enterprise", "premium_plus"]),
      paymentMethod: z.string().optional(), // For future Stripe/Square integration
    });

    const { tier, paymentMethod } = schema.parse(req.body);
    const userId = req.user!.id;

    const existingUser = await storage.getUser(userId);
    if (!existingUser) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const previousTier = coerceTier((existingUser as any).subscriptionTier || "free");
    const previousStatus = (existingUser as any).subscriptionStatus || "active";
    const previousEndsAtRaw = (existingUser as any).subscriptionEndsAt;
    const previousEndsAt = previousEndsAtRaw ? new Date(previousEndsAtRaw) : null;

    // If same tier already active and still current, return a clean response (avoid duplicate history rows)
    if (
      previousTier === tier &&
      previousStatus === "active" &&
      previousEndsAt &&
      !Number.isNaN(previousEndsAt.getTime()) &&
      previousEndsAt.getTime() > Date.now()
    ) {
      return res.json({
        ok: true,
        message: `You are already on ${SUBSCRIPTION_TIERS[tier].name}.`,
        tier,
        tierInfo: SUBSCRIPTION_TIERS[tier],
        endsAt: previousEndsAt,
      });
    }

    // Calculate subscription end date (30 days from now)
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 30);

    // Update user subscription
    const updated = await storage.updateUser(userId, {
      subscriptionTier: tier,
      subscriptionStatus: "active",
      subscriptionEndsAt: endsAt,
    } as any);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Log history row
    await logSubscriptionHistory({
      userId,
      tier,
      amount: tierPriceAsString(tier),
      startDate: now,
      endDate: endsAt,
      status: "active",
      paymentMethod: paymentMethod || null,
    });

    const action =
      tierRank(tier) < tierRank(previousTier)
        ? "downgraded"
        : tierRank(tier) > tierRank(previousTier)
        ? "upgraded"
        : "updated";

    res.json({
      ok: true,
      message: `Successfully ${action} to ${SUBSCRIPTION_TIERS[tier].name}`,
      tier,
      tierInfo: SUBSCRIPTION_TIERS[tier],
      previousTier,
      endsAt,
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid tier", errors: error.issues });
    }
    console.error("Error updating subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to update subscription" });
  }
});

// POST /api/subscriptions/cancel - Cancel subscription (keeps access until end date)
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const currentTier = coerceTier((user as any).subscriptionTier || "free");
    const currentEndsAtRaw = (user as any).subscriptionEndsAt;
    const currentEndsAt =
      currentEndsAtRaw && !Number.isNaN(new Date(currentEndsAtRaw).getTime())
        ? new Date(currentEndsAtRaw)
        : new Date();

    // Update status only (do not force free immediately; user keeps access until period end)
    const updated = await storage.updateUser(userId, {
      subscriptionStatus: "cancelled",
    } as any);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Log cancellation event
    await logSubscriptionHistory({
      userId,
      tier: currentTier,
      amount: tierPriceAsString(currentTier),
      startDate: new Date(),
      endDate: currentEndsAt,
      status: "cancelled",
      paymentMethod: null,
    });

    res.json({
      ok: true,
      message: "Subscription cancelled. You'll retain access until the end of your billing period.",
      tier: currentTier,
      endsAt: (updated as any).subscriptionEndsAt || currentEndsAt,
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to cancel subscription" });
  }
});

// Optional explicit downgrade endpoint (routes to same logic as /upgrade expectations)
// Keeps your API flexible if you want a dedicated client action later.
router.post("/downgrade", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tier: z.enum(["starter", "professional", "enterprise", "premium_plus"]),
      paymentMethod: z.string().optional(),
    });

    const { tier, paymentMethod } = schema.parse(req.body);
    const userId = req.user!.id;

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const currentTier = coerceTier((user as any).subscriptionTier || "free");
    if (tierRank(tier) >= tierRank(currentTier)) {
      return res.status(400).json({
        ok: false,
        error: "Requested tier is not a downgrade",
        currentTier,
      });
    }

    // Reuse same behavior as update path
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 30);

    const updated = await storage.updateUser(userId, {
      subscriptionTier: tier,
      subscriptionStatus: "active",
      subscriptionEndsAt: endsAt,
    } as any);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    await logSubscriptionHistory({
      userId,
      tier,
      amount: tierPriceAsString(tier),
      startDate: now,
      endDate: endsAt,
      status: "active",
      paymentMethod: paymentMethod || null,
    });

    res.json({
      ok: true,
      message: `Successfully downgraded to ${SUBSCRIPTION_TIERS[tier].name}`,
      tier,
      tierInfo: SUBSCRIPTION_TIERS[tier],
      previousTier: currentTier,
      endsAt,
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid tier", errors: error.issues });
    }
    console.error("Error downgrading subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to downgrade subscription" });
  }
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

    const tierName = coerceTier((user as any).subscriptionTier || "free");
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
