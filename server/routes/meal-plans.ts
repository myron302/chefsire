import express, { type Request, type Response } from "express";
import { db } from "../db/index.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  mealPlanBlueprints,
  blueprintVersions,
  mealPlanPurchases,
  mealPlanReviews,
  creatorAnalytics,
  users,
  recipes
} from "../../shared/schema.js";
import { requireAuth } from "../middleware";
import {
  buildSimulatedTransactionId,
  filterBrowsePlans,
  normalizeAnalyticsTotals,
  normalizeRatingStats,
  parsePriceDollarsToCents,
  sortBrowsePlans,
  toIsoDateString,
} from "./meal-plans/utils.js";

const router = express.Router();

// ============================================================
// CREATOR - MEAL PLAN MANAGEMENT
// ============================================================

// Create new meal plan blueprint
router.post("/meal-plans", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      description,
      duration,
      durationUnit,
      priceInCents,
      category,
      dietaryLabels,
      difficulty,
      servings,
      mealStructure,
      tags,
    } = req.body;

    if (!title || !priceInCents || !mealStructure) {
      return res.status(400).json({ message: "Title, price, and meal structure are required" });
    }

    // Create blueprint
    const [blueprint] = await db
      .insert(mealPlanBlueprints)
      .values({
        creatorId: userId,
        title: title.trim(),
        description: description || null,
        duration: duration || 7,
        durationUnit: durationUnit || "days",
        priceInCents,
        category: category || "general",
        dietaryLabels: dietaryLabels || [],
        difficulty: difficulty || "medium",
        servings: servings || 4,
        tags: tags || [],
        status: "draft",
      })
      .returning();

    // Create initial version
    const [version] = await db
      .insert(blueprintVersions)
      .values({
        blueprintId: blueprint.id,
        version: 1,
        mealStructure,
        changeLog: "Initial version",
      })
      .returning();

    res.json({ blueprint, version });
  } catch (error) {
    console.error("Error creating meal plan:", error);
    res.status(500).json({ message: "Failed to create meal plan" });
  }
});

// Get creator's own meal plans
router.get("/my-plans", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const plans = await db
      .select({
        blueprint: mealPlanBlueprints,
        // ⬇️ removed generic to avoid esbuild TS-parse error
        avgRating: sql`avg(${mealPlanReviews.rating})`,
        reviewCount: sql`count(distinct ${mealPlanReviews.id})`,
      })
      .from(mealPlanBlueprints)
      .leftJoin(mealPlanReviews, eq(mealPlanBlueprints.id, mealPlanReviews.blueprintId))
      .where(eq(mealPlanBlueprints.creatorId, userId))
      .groupBy(mealPlanBlueprints.id)
      .orderBy(desc(mealPlanBlueprints.createdAt));

    res.json({ plans });
  } catch (error) {
    console.error("Error fetching creator plans:", error);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
});

// Publish meal plan
router.post("/meal-plans/:id/publish", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.params.id;

    const [existing] = await db
      .select()
      .from(mealPlanBlueprints)
      .where(and(eq(mealPlanBlueprints.id, planId), eq(mealPlanBlueprints.creatorId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Meal plan not found" });
    }

    if (existing.status === "published") {
      return res.status(400).json({ message: "Meal plan is already published" });
    }

    const [updated] = await db
      .update(mealPlanBlueprints)
      .set({ status: "published" })
      .where(eq(mealPlanBlueprints.id, planId))
      .returning();

    res.json({ blueprint: updated });
  } catch (error) {
    console.error("Error publishing meal plan:", error);
    res.status(500).json({ message: "Failed to publish meal plan" });
  }
});

// Browse published meal plans
router.get("/meal-plans", async (req: Request, res: Response) => {
  try {
    const { category, difficulty, minPrice, maxPrice, search, sort } = req.query;

    let query = db
      .select({
        blueprint: mealPlanBlueprints,
        creator: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
        // ⬇️ removed generic to avoid esbuild TS-parse error
        avgRating: sql`avg(${mealPlanReviews.rating})`,
        reviewCount: sql`count(distinct ${mealPlanReviews.id})`,
      })
      .from(mealPlanBlueprints)
      .innerJoin(users, eq(mealPlanBlueprints.creatorId, users.id))
      .leftJoin(mealPlanReviews, eq(mealPlanBlueprints.id, mealPlanReviews.blueprintId))
      .where(eq(mealPlanBlueprints.status, "published"))
      .groupBy(mealPlanBlueprints.id, users.id)
      .$dynamic();

    const plans = await query;

    const filtered = filterBrowsePlans(plans, {
      category,
      difficulty,
      minPriceCents: parsePriceDollarsToCents(minPrice),
      maxPriceCents: parsePriceDollarsToCents(maxPrice),
      search,
    });

    const sorted = sortBrowsePlans(filtered, sort);

    res.json({ plans: sorted });
  } catch (error) {
    console.error("Error browsing meal plans:", error);
    res.status(500).json({ message: "Failed to browse meal plans" });
  }
});

// Get single meal plan details
router.get("/meal-plans/:id", async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;

    const [plan] = await db
      .select({
        blueprint: mealPlanBlueprints,
        creator: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(mealPlanBlueprints)
      .innerJoin(users, eq(mealPlanBlueprints.creatorId, users.id))
      .where(eq(mealPlanBlueprints.id, planId))
      .limit(1);

    if (!plan) {
      return res.status(404).json({ message: "Meal plan not found" });
    }

    const [version] = await db
      .select()
      .from(blueprintVersions)
      .where(eq(blueprintVersions.blueprintId, planId))
      .orderBy(desc(blueprintVersions.version))
      .limit(1);

    const reviews = await db
      .select({
        review: mealPlanReviews,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(mealPlanReviews)
      .innerJoin(users, eq(mealPlanReviews.userId, users.id))
      .where(eq(mealPlanReviews.blueprintId, planId))
      .orderBy(desc(mealPlanReviews.createdAt))
      .limit(20);

    const [ratingStats] = await db
      .select({
        // ⬇️ removed generic to avoid esbuild TS-parse error
        avgRating: sql`avg(${mealPlanReviews.rating})`,
        totalReviews: sql`count(*)`,
      })
      .from(mealPlanReviews)
      .where(eq(mealPlanReviews.blueprintId, planId));

    res.json({
      plan,
      version,
      reviews,
      ratingStats: normalizeRatingStats(ratingStats),
    });
  } catch (error) {
    console.error("Error fetching meal plan details:", error);
    res.status(500).json({ message: "Failed to fetch meal plan details" });
  }
});

// Purchase meal plan
router.post("/meal-plans/:id/purchase", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.params.id;
    const { paymentMethod } = req.body;

    const [plan] = await db
      .select()
      .from(mealPlanBlueprints)
      .where(eq(mealPlanBlueprints.id, planId))
      .limit(1);

    if (!plan) {
      return res.status(404).json({ message: "Meal plan not found" });
    }

    if (plan.status !== "published") {
      return res.status(400).json({ message: "Meal plan is not available for purchase" });
    }

    const [existingPurchase] = await db
      .select()
      .from(mealPlanPurchases)
      .where(and(eq(mealPlanPurchases.userId, userId), eq(mealPlanPurchases.blueprintId, planId)))
      .limit(1);

    if (existingPurchase) {
      return res.status(400).json({ message: "You already own this meal plan" });
    }

    const [purchase] = await db
      .insert(mealPlanPurchases)
      .values({
        userId,
        blueprintId: planId,
        pricePaidCents: plan.priceInCents,
        paymentStatus: "completed",
        paymentMethod: paymentMethod || "stripe",
        transactionId: buildSimulatedTransactionId(),
      })
      .returning();

    await db
      .update(mealPlanBlueprints)
      .set({ salesCount: sql`${mealPlanBlueprints.salesCount} + 1` })
      .where(eq(mealPlanBlueprints.id, planId));

    await db
      .insert(creatorAnalytics)
      .values({
        creatorId: plan.creatorId,
        date: toIsoDateString(),
        totalSales: 1,
        totalRevenueCents: plan.priceInCents,
      })
      .onConflictDoUpdate({
        target: [creatorAnalytics.creatorId, creatorAnalytics.date],
        set: {
          totalSales: sql`${creatorAnalytics.totalSales} + 1`,
          totalRevenueCents: sql`${creatorAnalytics.totalRevenueCents} + ${plan.priceInCents}`,
        },
      });

    res.json({ purchase, message: "Purchase successful!" });
  } catch (error) {
    console.error("Error purchasing meal plan:", error);
    res.status(500).json({ message: "Failed to purchase meal plan" });
  }
});

// Get user's purchased meal plans
router.get("/my-purchases", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const purchases = await db
      .select({
        purchase: mealPlanPurchases,
        blueprint: mealPlanBlueprints,
        creator: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(mealPlanPurchases)
      .innerJoin(mealPlanBlueprints, eq(mealPlanPurchases.blueprintId, mealPlanBlueprints.id))
      .innerJoin(users, eq(mealPlanBlueprints.creatorId, users.id))
      .where(eq(mealPlanPurchases.userId, userId))
      .orderBy(desc(mealPlanPurchases.createdAt));

    res.json({ purchases });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ message: "Failed to fetch purchases" });
  }
});

// Add review
router.post("/meal-plans/:id/review", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.params.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const [purchase] = await db
      .select()
      .from(mealPlanPurchases)
      .where(and(eq(mealPlanPurchases.userId, userId), eq(mealPlanPurchases.blueprintId, planId)))
      .limit(1);

    if (!purchase) {
      return res.status(403).json({ message: "You must purchase this meal plan before reviewing it" });
    }

    const [existingReview] = await db
      .select()
      .from(mealPlanReviews)
      .where(and(eq(mealPlanReviews.userId, userId), eq(mealPlanReviews.blueprintId, planId)))
      .limit(1);

    if (existingReview) {
      const [updated] = await db
        .update(mealPlanReviews)
        .set({ rating, comment: comment || null })
        .where(eq(mealPlanReviews.id, existingReview.id))
        .returning();

      return res.json({ review: updated });
    }

    const [review] = await db
      .insert(mealPlanReviews)
      .values({
        userId,
        blueprintId: planId,
        rating,
        comment: comment || null,
      })
      .returning();

    res.json({ review });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: "Failed to add review" });
  }
});

// Update meal plan blueprint (draft only)
router.patch("/meal-plans/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.params.id;

    const [existing] = await db
      .select()
      .from(mealPlanBlueprints)
      .where(and(eq(mealPlanBlueprints.id, planId), eq(mealPlanBlueprints.creatorId, userId)))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "Meal plan not found" });
    if (existing.status === "published") {
      return res.status(400).json({ message: "Published plans cannot be edited. Unpublish first." });
    }

    const {
      title, description, priceInCents, duration, durationUnit,
      category, difficulty, servings, dietaryLabels, tags,
    } = req.body;

    const [updated] = await db
      .update(mealPlanBlueprints)
      .set({
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(priceInCents !== undefined && { priceInCents }),
        ...(duration !== undefined && { duration }),
        ...(durationUnit !== undefined && { durationUnit }),
        ...(category !== undefined && { category }),
        ...(difficulty !== undefined && { difficulty }),
        ...(servings !== undefined && { servings }),
        ...(dietaryLabels !== undefined && { dietaryLabels }),
        ...(tags !== undefined && { tags }),
      })
      .where(eq(mealPlanBlueprints.id, planId))
      .returning();

    res.json({ blueprint: updated });
  } catch (error) {
    console.error("Error updating meal plan:", error);
    res.status(500).json({ message: "Failed to update meal plan" });
  }
});

// Delete meal plan blueprint (draft only, no purchases)
router.delete("/meal-plans/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.params.id;

    const [existing] = await db
      .select()
      .from(mealPlanBlueprints)
      .where(and(eq(mealPlanBlueprints.id, planId), eq(mealPlanBlueprints.creatorId, userId)))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "Meal plan not found" });
    if (existing.status === "published") {
      return res.status(400).json({ message: "Published plans cannot be deleted." });
    }

    const [hasPurchase] = await db
      .select()
      .from(mealPlanPurchases)
      .where(eq(mealPlanPurchases.blueprintId, planId))
      .limit(1);

    if (hasPurchase) {
      return res.status(400).json({ message: "Plans with purchases cannot be deleted." });
    }

    await db.delete(blueprintVersions).where(eq(blueprintVersions.blueprintId, planId));
    await db.delete(mealPlanBlueprints).where(eq(mealPlanBlueprints.id, planId));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting meal plan:", error);
    res.status(500).json({ message: "Failed to delete meal plan" });
  }
});

// Get creator analytics
router.get("/analytics", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [totals] = await db
      .select({
        // ⬇️ removed generic to avoid esbuild TS-parse error
        totalSales: sql`sum(${creatorAnalytics.totalSales})`,
        totalRevenue: sql`sum(${creatorAnalytics.totalRevenueCents})`,
      })
      .from(creatorAnalytics)
      .where(eq(creatorAnalytics.creatorId, userId));

    const daily = await db
      .select()
      .from(creatorAnalytics)
      .where(eq(creatorAnalytics.creatorId, userId))
      .orderBy(desc(creatorAnalytics.date))
      .limit(30);

    const topPlans = await db
      .select({
        blueprint: mealPlanBlueprints,
        totalRevenue: sql`${mealPlanBlueprints.salesCount} * ${mealPlanBlueprints.priceInCents}`,
      })
      .from(mealPlanBlueprints)
      .where(eq(mealPlanBlueprints.creatorId, userId))
      .orderBy(desc(mealPlanBlueprints.salesCount))
      .limit(10);

    res.json({
      totals: normalizeAnalyticsTotals(totals),
      daily,
      topPlans,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default router;
