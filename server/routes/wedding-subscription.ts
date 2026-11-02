import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { requireAuth } from "../middleware";
import { subscriptionHistory } from "../../shared/schema";
import { hasAuthoritativePaidEntitlement, paidCancellationUnavailableResponse, paidUpgradeUnavailableResponse } from "../lib/subscription-security";

import { activateWeddingTrial, revokeWeddingTrial, weddingEntitlement } from "../lib/wedding-entitlement";
import { isWeddingPaidTier, quoteWeddingMonthlyBilling } from "../lib/wedding-square-billing-policy";
import { weddingSquareLegacyCancelGuard, WeddingSquareLegacyCancellationBlocked } from "../lib/wedding-square-legacy-cancel-guard";

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

// Authenticated, read-only quote. Does not tokenize a card, enroll a customer,
// create a Square subscription, or confer any paid entitlement.
// This exposes the exact first-charge calendar date before checkout consent.
r.get("/subscription/billing-quote", requireAuth, async (req, res) => {
  const tier = req.query.tier;
  if (!isWeddingPaidTier(tier)) {
    return res.status(400).json({ ok: false, error: "Choose Premium or Elite." });
  }
  try {
    const entitlement = await weddingEntitlement(req.user!.id);
    const expiry = entitlement.trial.status === "active" && entitlement.trial.expiresAt
      ? new Date(entitlement.trial.expiresAt) : null;
    return res.json({
      ok: true,
      billingAvailable: false,
      ...quoteWeddingMonthlyBilling({ tier, now: new Date(), trialExpiresAt: expiry }),
      message: "Square recurring checkout is not available yet. No payment method is collected.",
    });
  } catch {
    return res.status(503).json({ ok: false, error: "Unable to verify your trial billing date." });
  }
});

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

    const recordedTier = coerceWeddingTier((user as any).weddingTier);
    const entitlement = await weddingEntitlement(user.id, recordedTier);
    const { currentTier } = entitlement;

    // A Free default is not a selection. Successful changes already have durable,
    // Wedding-specific history, including legacy Free selections and cancellations.
    await ensureSubscriptionHistoryTable();
    const [selection] = await db.select({ id: subscriptionHistory.id })
      .from(subscriptionHistory)
      .where(and(eq(subscriptionHistory.userId, user.id), eq(subscriptionHistory.subscriptionType, "wedding")))
      .limit(1);

    res.json({
      ok: true,
      onboardingCompleted: Boolean(selection) || recordedTier !== "free" || !entitlement.trial.eligible,
      ...entitlement,
      tierInfo: (WEDDING_SUBSCRIPTION_TIERS as any)[currentTier],
    });
  } catch (error) {
    console.error("Error fetching wedding subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch wedding subscription" });
  }
});

// No payment information is accepted. Authentication supplies the only account ID.
r.post("/subscription/trial", requireAuth, async (req, res) => {
  try {
    const { tier } = z.object({ tier: z.enum(["premium", "elite"]) }).strict().parse(req.body);
    const trial = await activateWeddingTrial((req.user as { id: string }).id, tier);
    if (!trial) return res.status(409).json({ ok: false, code: "WEDDING_TRIAL_USED", error: "Your introductory Wedding trial has already been used. Choose Free or a paid upgrade when available." });
    return res.json({ ok: true, onboardingCompleted: true, currentTier: tier, status: "active", endsAt: trial.expiresAt, trial, tierInfo: WEDDING_SUBSCRIPTION_TIERS[tier], message: "Your 14-day trial is active. No credit card required and no automatic charge at expiration." });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ ok: false, error: "Invalid trial request" });
    console.error("Wedding trial activation failed:", error);
    return res.status(503).json({ ok: false, error: "Unable to activate your trial. Please try again." });
  }
});

// POST /api/wedding/subscription/change
// Body: { tier: "free" | "premium" | "elite" }
r.post("/subscription/change", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tier: z.enum(["free", "premium", "elite"]),
    });

    const { tier } = schema.strict().parse(req.body);
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
      hasAuthoritativePaidEntitlement() &&
      String(previousStatus).toLowerCase() === "active" &&
      previousEndsAt &&
      previousEndsAt.getTime() > Date.now()
    ) {
      return res.json({
        ok: true,
        message: `${(WEDDING_SUBSCRIPTION_TIERS as any)[tier].name} is already active.`,
        onboardingCompleted: true,
        currentTier: tier,
        status: "active",
        endsAt: previousEndsAt,
        tierInfo: (WEDDING_SUBSCRIPTION_TIERS as any)[tier],
      });
    }

    const now = new Date();

    // Free means cancel / downgrade.
    if (tier === "free") {
      // Legacy downgrade only cancels a cardless trial. It can NEVER silently
      // leave a live or ambiguously created Square subscription billing.
      await weddingSquareLegacyCancelGuard.assertCardlessOnly(userId);
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

      await revokeWeddingTrial(userId);

      return res.json({
        ok: true,
        ...(await weddingEntitlement(userId)),
        message: "Wedding subscription downgraded to Free. Your saved content is preserved.",
        onboardingCompleted: true,
        currentTier: "free",
        status: "inactive",
        endsAt: null,
        tierInfo: (WEDDING_SUBSCRIPTION_TIERS as any).free,
      });
    }

    // Paid changes require verified provider state; a requested tier/payment field is never evidence.
    return res.status(503).json(paidUpgradeUnavailableResponse);
  } catch (error: any) {
    if (error instanceof WeddingSquareLegacyCancellationBlocked) {
      return res.status(409).json({ok:false,code:"WEDDING_SQUARE_CANCEL_REQUIRES_PROVIDER",safeToAssumeCanceled:false});
    }
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

    const trialState = await weddingEntitlement(userId);
    // No successful local-only cancellation when Square recurring billing may
    // exist, even if a cardless trial is still concurrently active.
    await weddingSquareLegacyCancelGuard.assertCardlessOnly(userId);
    if (trialState.trial.status === "active") {
      await revokeWeddingTrial(userId);
      return res.json({ ok: true, onboardingCompleted: true, ...(await weddingEntitlement(userId)), message: "Trial cancelled. Your saved content is preserved." });
    }
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

    // No provider cancellation/reconciliation exists, so do not fabricate success or mutate legacy access.
    return res.status(503).json(paidCancellationUnavailableResponse);
  } catch (error) {
    if (error instanceof WeddingSquareLegacyCancellationBlocked) {
      return res.status(409).json({ok:false,code:"WEDDING_SQUARE_CANCEL_REQUIRES_PROVIDER",safeToAssumeCanceled:false});
    }
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
