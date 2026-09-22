// server/routes/nutrition.ts
import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware";
import { paidCancellationUnavailableResponse, paidUpgradeUnavailableResponse } from "../lib/subscription-security";
import {
  NUTRITION_SUBSCRIPTION_TIERS,
  nutritionTierPriceAsString,
} from "./nutrition/constants";
import {
  coerceNutritionTierFromUser,
  deriveNutritionStatus,
  parseValidDateOrNull,
} from "./nutrition/helpers";
import { nutritionSubscriptionChangeSchema } from "./nutrition/schemas";
import { logNutritionSubscriptionHistory } from "./nutrition/subscription-history";

const r = Router();

/**
 * ===========================
 * Existing nutrition endpoints
 * ===========================
 */

/**
 * POST /api/nutrition/users/:id/trial
 * Body: { days?: number }  (default 30)
 */
r.post("/users/:id/trial", requireAuth, async (req, res) => {
  if (req.user!.id !== req.params.id) {
    return res.status(403).json({ message: "You can only change your own nutrition subscription" });
  }
  return res.status(503).json(paidUpgradeUnavailableResponse);
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
    const { tier } = nutritionSubscriptionChangeSchema.strict().parse(req.body);
    const userId = req.user!.id;

    const existingUser = await storage.getUser(userId);
    if (!existingUser) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const currentTier = coerceNutritionTierFromUser(existingUser);
    const now = new Date();

    // Client input is not billing evidence. Existing legacy entitlement remains readable,
    // but this endpoint cannot create, renew, or switch a paid entitlement.
    if (tier === "premium") {
      return res.status(503).json(paidUpgradeUnavailableResponse);
    }

    // tier === "free" => immediate downgrade/cancel for nutrition
    const previousEndsAtRaw = (existingUser as any).nutritionTrialEndsAt;
    const previousEndsAt = parseValidDateOrNull(previousEndsAtRaw) ?? now;

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

    // Cancellation cannot claim provider success when no subscription provider
    // reconciliation/cancellation flow exists. The explicit change-to-Free path
    // remains available as a local entitlement removal.
    return res.status(503).json(paidCancellationUnavailableResponse);
  } catch (error) {
    console.error("Error cancelling nutrition subscription:", error);
    res.status(500).json({ ok: false, error: "Failed to cancel nutrition subscription" });
  }
});

export default r;
