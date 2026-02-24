import { Router } from "express";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { requireAuth } from "../middleware";
import { subscriptionHistory } from "../../shared/schema";

const r = Router();

/**
 * Wedding Planner subscription is separate from Marketplace subscriptions.
 *
 * Tiers:
 * - free
 * - premium ($24.99/mo)
 * - elite ($49.99/mo)
 */
export const WEDDING_SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    price: 0,
    features: [
      "Browse unlimited vendors",
      "Save up to 10 vendors",
      "Basic budget calculator",
      "Planning checklist",
    ],
  },
  premium: {
    name: "Premium",
    price: 24.99,
    trialDays: 14,
    popular: true,
    features: [
      "Unlimited saved vendors",
      "Guest list up to 150",
      "Email invitations & RSVP tracking",
      "Registry hub with sharing",
      "Vendor messaging",
      "Planning calendar",
    ],
  },
  elite: {
    name: "Elite",
    price: 49.99,
    trialDays: 14,
    features: [
      "Everything in Premium",
      "Unlimited guests",
      "AI Wedding Planner",
      "Dynamic budget optimizer",
      "Priority vendor responses (2x faster)",
      "Dedicated wedding coordinator",
      "Custom wedding website",
      "Advanced analytics",
    ],
  },
} as const;

type WeddingTierKey = keyof typeof WEDDING_SUBSCRIPTION_TIERS;

const WEDDING_TIER_ORDER: WeddingTierKey[] = ["free", "premium", "elite"];

function coerceWeddingTier(tier: string | null | undefined): WeddingTierKey {
  const t = (tier || "free") as WeddingTierKey;
  return (WEDDING_SUBSCRIPTION_TIERS as any)[t] ? t : "free";
}

function weddingTierRank(tier: string | null | undefined): number {
  const idx = WEDDING_TIER_ORDER.indexOf(coerceWeddingTier(tier));
  return idx === -1 ? 0 : idx;
}

function tierPriceAsString(tier: WeddingTierKey): string {
  const price = (WEDDING_SUBSCRIPTION_TIERS as any)[tier]?.price ?? 0;
  return Number(price).toFixed(2);
}

async function ensureWeddingSubscriptionColumns() {
  // Add columns lazily so existing DBs don't break.
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS wedding_tier TEXT DEFAULT 'free';
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS wedding_status TEXT DEFAULT 'inactive';
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS wedding_ends_at TIMESTAMP;
  `);
}

async function ensureSubscriptionHistoryTable() {
  // Keep compatible with older DBs but ensure the new column exists.
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
      subscription_type TEXT DEFAULT 'marketplace',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    ALTER TABLE subscription_history
      ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'marketplace';
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

async function logWeddingSubscriptionHistory(params: {
  userId: string;
  tier: WeddingTierKey;
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
    subscriptionType: "wedding",
  } as any);
}

// GET /api/wedding/subscription/tiers
r.get("/subscription/tiers", requireAuth, async (_req, res) => {
  res.json({ ok: true, tiers: WEDDING_SUBSCRIPTION_TIERS });
});

// GET /api/wedding/subscription
r.get("/subscription", requireAuth, async (req, res) => {
  try {
    await ensureWeddingSubscriptionColumns();

    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const currentTier = coerceWeddingTier((user as any).weddingTier);
    const status = String((user as any).weddingStatus || (currentTier === "free" ? "inactive" : "active"));
    const endsAt = (user as any).weddingEndsAt ?? null;

    res.json({
      ok: true,
      currentTier,
      status,
      endsAt,
      tierInfo: (WEDDING_SUBSCRIPTION_TIERS as any)[currentTier],
    });
  } catch (error) {
    console.error("Error fetching wedding subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch wedding subscription" });
  }
});

// POST /api/wedding/subscription/change
// Body: { tier: "free" | "premium" | "elite" }
r.post("/subscription/change", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tier: z.enum(["free", "premium", "elite"]),
      paymentMethod: z.string().optional(),
    });

    const { tier, paymentMethod } = schema.parse(req.body);
    const userId = req.user!.id;

    await ensureWeddingSubscriptionColumns();

    const existingUser = await storage.getUser(userId);
    if (!existingUser) return res.status(404).json({ ok: false, error: "User not found" });

    const previousTier = coerceWeddingTier((existingUser as any).weddingTier);
    const previousStatus = String((existingUser as any).weddingStatus || (previousTier === "free" ? "inactive" : "active"));
    const previousEndsAtRaw = (existingUser as any).weddingEndsAt;
    const previousEndsAt =
      previousEndsAtRaw && !Number.isNaN(new Date(previousEndsAtRaw).getTime())
        ? new Date(previousEndsAtRaw)
        : null;

    // No-op protection: same paid tier still active
    if (
      previousTier === tier &&
      String(previousStatus).toLowerCase() === "active" &&
      previousEndsAt &&
      previousEndsAt.getTime() > Date.now()
    ) {
      return res.json({
        ok: true,
        message: `${(WEDDING_SUBSCRIPTION_TIERS as any)[tier].name} is already active.`,
        currentTier: tier,
        status: "active",
        endsAt: previousEndsAt,
        tierInfo: (WEDDING_SUBSCRIPTION_TIERS as any)[tier],
      });
    }

    const now = new Date();

    // Free means cancel / downgrade.
    if (tier === "free") {
      const endsAt = previousEndsAt && previousEndsAt.getTime() > Date.now() ? previousEndsAt : now;

      const updated = await storage.updateUser(userId, {
        weddingTier: "free",
        weddingStatus: "inactive",
        weddingEndsAt: null,
      } as any);

      await logWeddingSubscriptionHistory({
        userId,
        tier: previousTier,
        amount: tierPriceAsString(previousTier),
        startDate: now,
        endDate: endsAt,
        status: "cancelled",
        paymentMethod: null,
      });

      return res.json({
        ok: true,
        message: "Wedding subscription downgraded to Free.",
        currentTier: "free",
        status: "inactive",
        endsAt: null,
        tierInfo: (WEDDING_SUBSCRIPTION_TIERS as any).free,
      });
    }

    // Activate paid tier for 30 days (trial can be handled on client; this sets endsAt so access works).
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 30);

    const updated = await storage.updateUser(userId, {
      weddingTier: tier,
      weddingStatus: "active",
      weddingEndsAt: endsAt,
    } as any);

    if (!updated) return res.status(404).json({ ok: false, error: "User not found" });

    await logWeddingSubscriptionHistory({
      userId,
      tier,
      amount: tierPriceAsString(tier),
      startDate: now,
      endDate: endsAt,
      status: "active",
      paymentMethod: paymentMethod || null,
    });

    const action =
      weddingTierRank(tier) < weddingTierRank(previousTier)
        ? "downgraded"
        : weddingTierRank(tier) > weddingTierRank(previousTier)
        ? "upgraded"
        : "updated";

    res.json({
      ok: true,
      message: `Successfully ${action} to ${(WEDDING_SUBSCRIPTION_TIERS as any)[tier].name}`,
      currentTier: tier,
      status: "active",
      previousTier,
      endsAt,
      tierInfo: (WEDDING_SUBSCRIPTION_TIERS as any)[tier],
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid request", errors: error.issues });
    }
    console.error("Error changing wedding subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to update wedding subscription" });
  }
});

// POST /api/wedding/subscription/cancel
r.post("/subscription/cancel", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    await ensureWeddingSubscriptionColumns();

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const currentTier = coerceWeddingTier((user as any).weddingTier);
    const endsAtRaw = (user as any).weddingEndsAt;
    const endsAt =
      endsAtRaw && !Number.isNaN(new Date(endsAtRaw).getTime()) ? new Date(endsAtRaw) : new Date();

    // If already free/inactive, keep idempotent.
    if (currentTier === "free") {
      return res.json({
        ok: true,
        message: "Wedding subscription is already Free.",
        currentTier: "free",
        status: "inactive",
        endsAt: null,
      });
    }

    const updated = await storage.updateUser(userId, {
      weddingStatus: "cancelled",
    } as any);

    if (!updated) return res.status(404).json({ ok: false, error: "User not found" });

    await logWeddingSubscriptionHistory({
      userId,
      tier: currentTier,
      amount: tierPriceAsString(currentTier),
      startDate: new Date(),
      endDate: endsAt,
      status: "cancelled",
      paymentMethod: null,
    });

    res.json({
      ok: true,
      message: "Wedding subscription cancelled. You'll retain access until the end of your billing period.",
      currentTier,
      status: "cancelled",
      endsAt: (updated as any).weddingEndsAt ?? endsAt,
    });
  } catch (error) {
    console.error("Error cancelling wedding subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to cancel wedding subscription" });
  }
});

// GET /api/wedding/subscription/history
r.get("/subscription/history", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    });

    const { limit } = schema.parse(req.query);

    await ensureSubscriptionHistoryTable();

    const rows = await db
      .select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.userId, req.user!.id))
      .orderBy(desc(subscriptionHistory.createdAt))
      .limit(limit);

    res.json({
      ok: true,
      history: rows,
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid request", errors: error.issues });
    }
    console.error("Error fetching wedding subscription history:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch wedding subscription history" });
  }
});

export default r;
