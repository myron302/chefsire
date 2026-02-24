import { Router } from "express";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { requireAuth } from "../middleware";
import { subscriptionHistory } from "../../shared/schema";

const r = Router();

/**
 * Vendor subscription is separate from Marketplace (seller) subscription.
 *
 * This is intended for Wedding Vendors who want enhanced listings + leads.
 *
 * Tiers:
 * - free (Basic)
 * - professional ($99/mo)
 * - premium ($299/mo)
 */
export const VENDOR_SUBSCRIPTION_TIERS = {
  free: {
    name: "Basic",
    price: 0,
    features: [
      "1 vendor listing",
      "Up to 5 photos",
      "Up to 3 leads / month",
      "25% commission",
    ],
  },
  professional: {
    name: "Professional",
    price: 99,
    features: [
      "Up to 3 listings",
      "Up to 20 photos",
      "Up to 50 leads / month",
      "Messaging enabled",
      "Analytics",
      "15% commission",
    ],
  },
  premium: {
    name: "Premium",
    price: 299,
    features: [
      "Unlimited listings",
      "Unlimited photos",
      "Unlimited leads",
      "Featured placement",
      "Priority support",
      "Messaging + analytics",
      "10% commission",
    ],
  },
} as const;

type VendorTierKey = keyof typeof VENDOR_SUBSCRIPTION_TIERS;

const VENDOR_TIER_ORDER: VendorTierKey[] = ["free", "professional", "premium"];

function coerceVendorTier(tier: string | null | undefined): VendorTierKey {
  const t = (tier || "free") as VendorTierKey;
  return (VENDOR_SUBSCRIPTION_TIERS as any)[t] ? t : "free";
}

function vendorTierRank(tier: string | null | undefined): number {
  const idx = VENDOR_TIER_ORDER.indexOf(coerceVendorTier(tier));
  return idx === -1 ? 0 : idx;
}

function tierPriceAsString(tier: VendorTierKey): string {
  const price = (VENDOR_SUBSCRIPTION_TIERS as any)[tier]?.price ?? 0;
  return Number(price).toFixed(2);
}

async function ensureVendorSubscriptionColumns() {
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS vendor_tier TEXT DEFAULT 'free';
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS vendor_status TEXT DEFAULT 'inactive';
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS vendor_ends_at TIMESTAMP;
  `);
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

async function logVendorSubscriptionHistory(params: {
  userId: string;
  tier: VendorTierKey;
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
    subscriptionType: "vendor",
  } as any);
}

// GET /api/vendors/subscription/tiers
r.get("/subscription/tiers", requireAuth, async (_req, res) => {
  res.json({ ok: true, tiers: VENDOR_SUBSCRIPTION_TIERS });
});

// GET /api/vendors/subscription
r.get("/subscription", requireAuth, async (req, res) => {
  try {
    await ensureVendorSubscriptionColumns();

    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const currentTier = coerceVendorTier((user as any).vendorTier);
    const status = String((user as any).vendorStatus || (currentTier === "free" ? "inactive" : "active"));
    const endsAt = (user as any).vendorEndsAt ?? null;

    res.json({
      ok: true,
      currentTier,
      status,
      endsAt,
      tierInfo: (VENDOR_SUBSCRIPTION_TIERS as any)[currentTier],
    });
  } catch (error) {
    console.error("Error fetching vendor subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch vendor subscription" });
  }
});

// POST /api/vendors/subscription/change
r.post("/subscription/change", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tier: z.enum(["free", "professional", "premium"]),
      paymentMethod: z.string().optional(),
    });

    const { tier, paymentMethod } = schema.parse(req.body);
    const userId = req.user!.id;

    await ensureVendorSubscriptionColumns();

    const existingUser = await storage.getUser(userId);
    if (!existingUser) return res.status(404).json({ ok: false, error: "User not found" });

    const previousTier = coerceVendorTier((existingUser as any).vendorTier);
    const previousStatus = String((existingUser as any).vendorStatus || (previousTier === "free" ? "inactive" : "active"));
    const previousEndsAtRaw = (existingUser as any).vendorEndsAt;
    const previousEndsAt =
      previousEndsAtRaw && !Number.isNaN(new Date(previousEndsAtRaw).getTime())
        ? new Date(previousEndsAtRaw)
        : null;

    if (
      previousTier === tier &&
      String(previousStatus).toLowerCase() === "active" &&
      previousEndsAt &&
      previousEndsAt.getTime() > Date.now()
    ) {
      return res.json({
        ok: true,
        message: `${(VENDOR_SUBSCRIPTION_TIERS as any)[tier].name} is already active.`,
        currentTier: tier,
        status: "active",
        endsAt: previousEndsAt,
        tierInfo: (VENDOR_SUBSCRIPTION_TIERS as any)[tier],
      });
    }

    const now = new Date();

    if (tier === "free") {
      const endsAt = previousEndsAt && previousEndsAt.getTime() > Date.now() ? previousEndsAt : now;

      await storage.updateUser(userId, {
        vendorTier: "free",
        vendorStatus: "inactive",
        vendorEndsAt: null,
      } as any);

      await logVendorSubscriptionHistory({
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
        message: "Vendor subscription downgraded to Basic.",
        currentTier: "free",
        status: "inactive",
        endsAt: null,
        tierInfo: (VENDOR_SUBSCRIPTION_TIERS as any).free,
      });
    }

    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 30);

    const updated = await storage.updateUser(userId, {
      vendorTier: tier,
      vendorStatus: "active",
      vendorEndsAt: endsAt,
    } as any);

    if (!updated) return res.status(404).json({ ok: false, error: "User not found" });

    await logVendorSubscriptionHistory({
      userId,
      tier,
      amount: tierPriceAsString(tier),
      startDate: now,
      endDate: endsAt,
      status: "active",
      paymentMethod: paymentMethod || null,
    });

    const action =
      vendorTierRank(tier) < vendorTierRank(previousTier)
        ? "downgraded"
        : vendorTierRank(tier) > vendorTierRank(previousTier)
        ? "upgraded"
        : "updated";

    res.json({
      ok: true,
      message: `Successfully ${action} to ${(VENDOR_SUBSCRIPTION_TIERS as any)[tier].name}`,
      currentTier: tier,
      status: "active",
      previousTier,
      endsAt,
      tierInfo: (VENDOR_SUBSCRIPTION_TIERS as any)[tier],
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid request", errors: error.issues });
    }
    console.error("Error changing vendor subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to update vendor subscription" });
  }
});

// POST /api/vendors/subscription/cancel
r.post("/subscription/cancel", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    await ensureVendorSubscriptionColumns();

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const currentTier = coerceVendorTier((user as any).vendorTier);
    const endsAtRaw = (user as any).vendorEndsAt;
    const endsAt =
      endsAtRaw && !Number.isNaN(new Date(endsAtRaw).getTime()) ? new Date(endsAtRaw) : new Date();

    if (currentTier === "free") {
      return res.json({
        ok: true,
        message: "Vendor subscription is already Basic.",
        currentTier: "free",
        status: "inactive",
        endsAt: null,
      });
    }

    const updated = await storage.updateUser(userId, {
      vendorStatus: "cancelled",
    } as any);

    if (!updated) return res.status(404).json({ ok: false, error: "User not found" });

    await logVendorSubscriptionHistory({
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
      message: "Vendor subscription cancelled. You'll retain access until the end of your billing period.",
      currentTier,
      status: "cancelled",
      endsAt: (updated as any).vendorEndsAt ?? endsAt,
    });
  } catch (error) {
    console.error("Error cancelling vendor subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to cancel vendor subscription" });
  }
});

// GET /api/vendors/subscription/history
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

    res.json({ ok: true, history: rows });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid request", errors: error.issues });
    }
    console.error("Error fetching vendor subscription history:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch vendor subscription history" });
  }
});

export default r;
