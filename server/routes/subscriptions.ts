// server/routes/subscriptions.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../middleware";

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
      "Community support"
    ],
    limits: {
      maxProducts: 5,
      storeBuilder: false,
      analytics: false,
      priority: false
    }
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
      "Email support"
    ],
    limits: {
      maxProducts: 50,
      storeBuilder: true,
      analytics: true,
      priority: false
    }
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
      "Custom domain option"
    ],
    limits: {
      maxProducts: -1, // unlimited
      storeBuilder: true,
      analytics: true,
      priority: false
    }
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
      "API access"
    ],
    limits: {
      maxProducts: -1,
      storeBuilder: true,
      analytics: true,
      priority: true
    }
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
      "API access"
    ],
    limits: {
      maxProducts: -1,
      storeBuilder: true,
      analytics: true,
      priority: true
    }
  }
} as const;

// GET /api/subscriptions/tiers - Get all available tiers
router.get("/tiers", async (_req, res) => {
  res.json({
    ok: true,
    tiers: SUBSCRIPTION_TIERS
  });
});

// GET /api/subscriptions/my-tier - Get current user's tier
router.get("/my-tier", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const tierName = (user as any).subscriptionTier || "free";
    const tier = SUBSCRIPTION_TIERS[tierName as keyof typeof SUBSCRIPTION_TIERS];

    res.json({
      ok: true,
      currentTier: tierName,
      tierInfo: tier,
      status: (user as any).subscriptionStatus,
      endsAt: (user as any).subscriptionEndsAt,
      monthlyRevenue: (user as any).monthlyRevenue || 0
    });
  } catch (error) {
    console.error("Error fetching user tier:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch subscription" });
  }
});

// POST /api/subscriptions/upgrade - Upgrade to a tier
router.post("/upgrade", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tier: z.enum(["starter", "professional", "enterprise", "premium_plus"]),
      paymentMethod: z.string().optional() // For future Stripe integration
    });

    const { tier } = schema.parse(req.body);
    const userId = req.user!.id;

    // Calculate subscription end date (30 days from now)
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 30);

    // Update user subscription
    const updated = await storage.updateUser(userId, {
      subscriptionTier: tier,
      subscriptionStatus: "active",
      subscriptionEndsAt: endsAt
    } as any);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    res.json({
      ok: true,
      message: `Successfully upgraded to ${SUBSCRIPTION_TIERS[tier].name}`,
      tier,
      tierInfo: SUBSCRIPTION_TIERS[tier],
      endsAt
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid tier", errors: error.issues });
    }
    console.error("Error upgrading subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to upgrade subscription" });
  }
});

// POST /api/subscriptions/cancel - Cancel subscription
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Update to free tier but keep subscription until end date
    const updated = await storage.updateUser(userId, {
      subscriptionStatus: "cancelled"
    } as any);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    res.json({
      ok: true,
      message: "Subscription cancelled. You'll retain access until the end of your billing period.",
      endsAt: (updated as any).subscriptionEndsAt
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to cancel subscription" });
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

    const tierName = (user as any).subscriptionTier || "free";
    const commissionRate = SUBSCRIPTION_TIERS[tierName as keyof typeof SUBSCRIPTION_TIERS].commission;

    const platformFee = (saleAmount * commissionRate) / 100;
    const sellerAmount = saleAmount - platformFee;

    res.json({
      ok: true,
      saleAmount,
      commissionRate,
      platformFee: platformFee.toFixed(2),
      sellerAmount: sellerAmount.toFixed(2),
      tier: tierName
    });
  } catch (error) {
    console.error("Error calculating commission:", error);
    res.status(500).json({ ok: false, error: "Failed to calculate commission" });
  }
});

export default router;
