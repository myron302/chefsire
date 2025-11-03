import express, { type Request, type Response } from "express";
import { db } from "@db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  mealPlanBlueprints,
  blueprintVersions,
  mealPlanPurchases,
  mealPlanReviews,
  creatorAnalytics,
  users,
  recipes
} from "@db/schema";
import { requireAuth } from "../middleware";

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
        avgRating: sql<number>`avg(${mealPlanReviews.rating})`,
        reviewCount: sql<number>`count(distinct ${mealPlanReviews.id})`,
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
        avgRating: sql<number>`avg(${mealPlanReviews.rating})`,
        reviewCount: sql<number>`count(distinct ${mealPlanReviews.id})`,
      })
      .from(mealPlanBlueprints)
      .innerJoin(users, eq(mealPlanBlueprints.creatorId, users.id))
      .leftJoin(mealPlanReviews, eq(mealPlanBlueprints.id, mealPlanReviews.blueprintId))
      .where(eq(mealPlanBlueprints.status, "published"))
      .groupBy(mealPlanBlueprints.id, users.id)
      .$dynamic();

    const plans = await query;

    let filtered = plans;

    if (category && category !== "all") {
      filtered = filtered.filter(p => p.blueprint.category === category);
    }

    if (difficulty && difficulty !== "all") {
      filtered = filtered.filter(p => p.blueprint.difficulty === difficulty);
    }

    if (minPrice) {
      filtered = filtered.filter(p => p.blueprint.priceInCents >= parseInt(minPrice as string) * 100);
    }

    if (maxPrice) {
      filtered = filtered.filter(p => p.blueprint.priceInCents <= parseInt(maxPrice as string) * 100);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(p =>
        p.blueprint.title.toLowerCase().includes(searchLower) ||
        p.blueprint.description?.toLowerCase().includes(searchLower)
      );
    }

    if (sort === "price-asc") {
      filtered.sort((a, b) => a.blueprint.priceInCents - b.blueprint.priceInCents);
    } else if (sort === "price-desc") {
      filtered.sort((a, b) => b.blueprint.priceInCents - a.blueprint.priceInCents);
    } else if (sort === "rating") {
      filtered.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    } else {
      filtered.sort((a, b) => new Date(b.blueprint.createdAt).getTime() - new Date(a.blueprint.createdAt).getTime());
    }

    res.json({ plans: filtered });
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
        avgRating: sql<number>`avg(${mealPlanReviews.rating})`,
        totalReviews: sql<number>`count(*)`,
      })
      .from(mealPlanReviews)
      .where(eq(mealPlanReviews.blueprintId, planId));

    res.json({
      plan,
      version,
      reviews,
      ratingStats: {
        avgRating: ratingStats.avgRating || 0,
        totalReviews: ratingStats.totalReviews || 0,
      },
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
        transactionId: `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
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
        date: new Date().toISOString().split("T")[0],
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

// Get creator analytics
router.get("/analytics", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [totals] = await db
      .select({
        totalSales: sql<number>`sum(${creatorAnalytics.totalSales})`,
        totalRevenue: sql<number>`sum(${creatorAnalytics.totalRevenueCents})`,
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
        totalRevenue: sql<number>`${mealPlanBlueprints.salesCount} * ${mealPlanBlueprints.priceInCents}`,
      })
      .from(mealPlanBlueprints)
      .where(eq(mealPlanBlueprints.creatorId, userId))
      .orderBy(desc(mealPlanBlueprints.salesCount))
      .limit(10);

    res.json({
      totals: {
        totalSales: totals.totalSales || 0,
        totalRevenueCents: totals.totalRevenue || 0,
      },
      daily,
      topPlans,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default router;
