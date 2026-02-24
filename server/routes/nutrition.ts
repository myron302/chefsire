// server/routes/nutrition.ts
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { storage } from "../storage";
import { requireAuth } from "../middleware";
import { db } from "../db";
import { subscriptionHistory } from "../../shared/schema";

const r = Router();

/**
 * Nutrition subscription tiers (separate from marketplace seller subscriptions)
 * These are intentionally separate so they don't get mixed into seller upgrades.
 */
const NUTRITION_SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    price: 0,
    features: [
      "Basic nutrition logging",
      "Daily calorie summary",
      "Set nutrition goals",
      "Manual meal entries",
    ],
  },
  premium: {
    name: "Premium",
    price: 9.99,
    features: [
      "Everything in Free",
      "Advanced nutrition insights",
      "Premium tracking tools",
      "Priority nutrition features",
      "Expanded reports/history",
    ],
  },
} as const;

type NutritionTierKey = keyof typeof NUTRITION_SUBSCRIPTION_TIERS;

function nutritionTierPriceAsString(tier: NutritionTierKey): string {
  const price = NUTRITION_SUBSCRIPTION_TIERS[tier]?.price ?? 0;
  return Number(price).toFixed(2);
}

function coerceNutritionTierFromUser(user: any): NutritionTierKey {
  return user?.nutritionPremium ? "premium" : "free";
}

function deriveNutritionStatus(user: any): "active" | "inactive" | "expired" {
  const isPremium = !!user?.nutritionPremium;
  const endsAtRaw = user?.nutritionTrialEndsAt;
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (!isPremium) return "inactive";
  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt.getTime() < Date.now()) return "expired";
  return "active";
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

async function logNutritionSubscriptionHistory(params: {
  userId: string;
  tier: NutritionTierKey;
  amount: string;
  startDate: Date;
  endDate: Date;
  status: string;
  paymentMethod?: string | null;
}) {
  await ensureSubscriptionHistoryTable();

  // Prefix tier values so shared /api/subscriptions/history can distinguish nutrition rows
  // without changing the subscription_history schema.
  const tierForHistory = `nutrition_${params.tier}`;

  await db.insert(subscriptionHistory).values({
    userId: params.userId,
    tier: tierForHistory,
    amount: params.amount,
    startDate: params.startDate,
    endDate: params.endDate,
    status: params.status,
    paymentMethod: params.paymentMethod ?? null,
    subscriptionType: "nutrition",
  } as any);
}

/**
 * ===========================
 * Existing nutrition endpoints
 * ===========================
 */

/**
 * POST /api/nutrition/users/:id/trial
 * Body: { days?: number }  (default 30)
 */
r.post("/users/:id/trial", async (req, res, next) => {
  try {
    const days = Number(req.body?.days ?? 30);
    const user = await storage.enableNutritionPremium(req.params.id, days);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Log trial activation as a nutrition premium event (amount 0.00 for trial)
    const now = new Date();
    const endsAt =
      (user as any)?.nutritionTrialEndsAt && !Number.isNaN(new Date((user as any).nutritionTrialEndsAt).getTime())
        ? new Date((user as any).nutritionTrialEndsAt)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await logNutritionSubscriptionHistory({
      userId: req.params.id,
      tier: "premium",
      amount: "0.00",
      startDate: now,
      endDate: endsAt,
      status: "active",
      paymentMethod: "trial",
    });

    res.json({
      message: "Nutrition premium trial activated",
      user,
      trialEndsAt: (user as any).nutritionTrialEndsAt ?? (user as any).nutritionTrialEnd ?? null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/nutrition/users/:id/goals
 * Body: { dailyCalorieGoal?, macroGoals?, dietaryRestrictions? }
 */
r.put("/users/:id/goals", async (req, res, next) => {
  try {
    const updated = await storage.updateNutritionGoals(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Nutrition goals updated", user: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/nutrition/log
 * Body: { userId, date, mealType, recipeId?, customFoodName?, servings, calories, protein?, carbs?, fat?, fiber?, imageUrl? }
 */
r.post("/log", async (req, res, next) => {
  try {
    const { userId, ...log } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const entry = await storage.logNutrition(String(userId), log);
    res.status(201).json({ message: "Nutrition logged successfully", log: entry });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/nutrition/users/:id/daily/:date
 * :date format YYYY-MM-DD
 */
r.get("/users/:id/daily/:date", async (req, res, next) => {
  try {
    const date = new Date(req.params.date);
    if (isNaN(date.getTime())) return res.status(400).json({ message: "Invalid date format" });

    const summary = await storage.getDailyNutritionSummary(req.params.id, date);
    const user = await storage.getUser(req.params.id);

    res.json({
      date: req.params.date,
      summary,
      goals: user
        ? { dailyCalorieGoal: (user as any).dailyCalorieGoal, macroGoals: (user as any).macroGoals }
        : null,
      progress:
        user && (user as any).dailyCalorieGoal
          ? {
              calorieProgress: Math.round(
                (Number(summary.totalCalories || 0) / Number((user as any).dailyCalorieGoal)) * 100
              ),
            }
          : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/nutrition/users/:id/logs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
r.get("/users/:id/logs", async (req, res, next) => {
  try {
    const startDate = new Date(String(req.query.startDate || ""));
    const endDate = new Date(String(req.query.endDate || ""));
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    const logs = await storage.getNutritionLogs(req.params.id, startDate, endDate);
    res.json({
      logs,
      dateRange: {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      },
      total: logs.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ==========================================
 * NEW: Nutrition subscription management API
 * ==========================================
 * These are separate from /api/subscriptions/*
 * so the settings UI can show separate tabs + actions.
 */

// GET /api/nutrition/subscription/tiers
r.get("/subscription/tiers", requireAuth, async (_req, res) => {
  res.json({
    ok: true,
    tiers: NUTRITION_SUBSCRIPTION_TIERS,
  });
});

// GET /api/nutrition/subscription
r.get("/subscription", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const currentTier = coerceNutritionTierFromUser(user);
    const status = deriveNutritionStatus(user);
    const endsAt = (user as any).nutritionTrialEndsAt ?? null;

    res.json({
      ok: true,
      currentTier,
      status,
      endsAt,
      tierInfo: NUTRITION_SUBSCRIPTION_TIERS[currentTier],
    });
  } catch (error) {
    console.error("Error fetching nutrition subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch nutrition subscription" });
  }
});

// POST /api/nutrition/subscription/change
// Body: { tier: "free" | "premium" }
r.post("/subscription/change", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tier: z.enum(["free", "premium"]),
      paymentMethod: z.string().optional(),
    });

    const { tier, paymentMethod } = schema.parse(req.body);
    const userId = req.user!.id;

    const existingUser = await storage.getUser(userId);
    if (!existingUser) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const currentTier = coerceNutritionTierFromUser(existingUser);
    const now = new Date();

    // no-op protection if already premium and still active
    if (tier === "premium") {
      const existingEndsAtRaw = (existingUser as any).nutritionTrialEndsAt;
      const existingEndsAt =
        existingEndsAtRaw && !Number.isNaN(new Date(existingEndsAtRaw).getTime())
          ? new Date(existingEndsAtRaw)
          : null;

      if (currentTier === "premium" && existingEndsAt && existingEndsAt.getTime() > Date.now()) {
        return res.json({
          ok: true,
          message: "Nutrition Premium is already active.",
          currentTier: "premium",
          status: "active",
          endsAt: existingEndsAt,
          tierInfo: NUTRITION_SUBSCRIPTION_TIERS.premium,
        });
      }

      const endsAt = new Date(now);
      endsAt.setDate(endsAt.getDate() + 30);

      const updated = await storage.updateUser(userId, {
        nutritionPremium: true,
        nutritionTrialEndsAt: endsAt,
      } as any);

      if (!updated) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      await logNutritionSubscriptionHistory({
        userId,
        tier: "premium",
        amount: nutritionTierPriceAsString("premium"),
        startDate: now,
        endDate: endsAt,
        status: "active",
        paymentMethod: paymentMethod || null,
      });

      return res.json({
        ok: true,
        message: "Successfully upgraded to Nutrition Premium",
        currentTier: "premium",
        status: "active",
        endsAt,
        tierInfo: NUTRITION_SUBSCRIPTION_TIERS.premium,
      });
    }

    // tier === "free" => immediate downgrade/cancel for nutrition
    const previousEndsAtRaw = (existingUser as any).nutritionTrialEndsAt;
    const previousEndsAt =
      previousEndsAtRaw && !Number.isNaN(new Date(previousEndsAtRaw).getTime())
        ? new Date(previousEndsAtRaw)
        : now;

    const updated = await storage.updateUser(userId, {
      nutritionPremium: false,
      // Keep the previous end date for display/history context
      nutritionTrialEndsAt: previousEndsAt,
    } as any);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    await logNutritionSubscriptionHistory({
      userId,
      tier: "free",
      amount: nutritionTierPriceAsString("free"),
      startDate: now,
      endDate: previousEndsAt,
      status: "inactive",
      paymentMethod: null,
    });

    return res.json({
      ok: true,
      message: "Successfully downgraded to Nutrition Free",
      currentTier: "free",
      status: "inactive",
      endsAt: previousEndsAt,
      tierInfo: NUTRITION_SUBSCRIPTION_TIERS.free,
    });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ ok: false, error: "Invalid request", errors: error.issues });
    }
    console.error("Error changing nutrition subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to change nutrition subscription" });
  }
});

// POST /api/nutrition/subscription/cancel
r.post("/subscription/cancel", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const now = new Date();
    const currentTier = coerceNutritionTierFromUser(user);

    if (currentTier === "free") {
      return res.json({
        ok: true,
        message: "Nutrition subscription is already on the Free plan.",
        currentTier: "free",
        status: "inactive",
        endsAt: (user as any).nutritionTrialEndsAt ?? null,
        tierInfo: NUTRITION_SUBSCRIPTION_TIERS.free,
      });
    }

    const currentEndsAtRaw = (user as any).nutritionTrialEndsAt;
    const currentEndsAt =
      currentEndsAtRaw && !Number.isNaN(new Date(currentEndsAtRaw).getTime())
        ? new Date(currentEndsAtRaw)
        : now;

    const updated = await storage.updateUser(userId, {
      nutritionPremium: false,
      nutritionTrialEndsAt: currentEndsAt,
    } as any);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    await logNutritionSubscriptionHistory({
      userId,
      tier: "premium",
      amount: nutritionTierPriceAsString("premium"),
      startDate: now,
      endDate: currentEndsAt,
      status: "cancelled",
      paymentMethod: null,
    });

    res.json({
      ok: true,
      message: "Nutrition subscription cancelled and downgraded to Free.",
      currentTier: "free",
      status: "inactive",
      endsAt: currentEndsAt,
      tierInfo: NUTRITION_SUBSCRIPTION_TIERS.free,
    });
  } catch (error) {
    console.error("Error cancelling nutrition subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to cancel nutrition subscription" });
  }
});

export default r;
