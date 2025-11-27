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
      coverImage,
      price,
      duration,
      difficulty,
      dietType,
      tags,
      targetCalories,
      macroSplit,
      meals,
    } = req.body;

    if (!title || !price || !meals) {
      return res.status(400).json({ message: "Title, price, and meals are required" });
    }

    // Create blueprint
    const [blueprint] = await db
      .insert(mealPlanBlueprints)
      .values({
        creatorId: userId,
        title: title.trim(),
        description: description || null,
        coverImage: coverImage || null,
        price: price.toString(),
        duration: duration || 7,
        difficulty: difficulty || "intermediate",
        dietType: dietType || null,
        tags: tags || [],
        targetCalories: targetCalories || null,
        macroSplit: macroSplit || null,
        isPublished: false,
      })
      .returning();

    // Create initial version
    const [version] = await db
      .insert(blueprintVersions)
      .values({
        blueprintId: blueprint.id,
        versionNumber: 1,
        meals,
        notes: "Initial version",
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

    if (existing.isPublished) {
      return res.status(400).json({ message: "Meal plan is already published" });
    }

    const [updated] = await db
      .update(mealPlanBlueprints)
      .set({ isPublished: true })
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
      .where(eq(mealPlanBlueprints.isPublished, true))
      .groupBy(mealPlanBlueprints.id, users.id)
      .$dynamic();

    const plans = await query;

    let filtered = plans;

    if (difficulty && difficulty !== "all") {
      filtered = filtered.filter(p => p.blueprint.difficulty === difficulty);
    }

    if (minPrice) {
      filtered = filtered.filter(p => parseFloat(p.blueprint.price) >= parseFloat(minPrice as string));
    }

    if (maxPrice) {
      filtered = filtered.filter(p => parseFloat(p.blueprint.price) <= parseFloat(maxPrice as string));
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(p =>
        p.blueprint.title.toLowerCase().includes(searchLower) ||
        p.blueprint.description?.toLowerCase().includes(searchLower)
      );
    }

    if (sort === "price-asc") {
      filtered.sort((a, b) => parseFloat(a.blueprint.price) - parseFloat(b.blueprint.price));
    } else if (sort === "price-desc") {
      filtered.sort((a, b) => parseFloat(b.blueprint.price) - parseFloat(a.blueprint.price));
    } else if (sort === "rating") {
      filtered.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    } else {
      filtered.sort((a, b) => {
        const dateA = a.blueprint.createdAt ? new Date(a.blueprint.createdAt).getTime() : 0;
        const dateB = b.blueprint.createdAt ? new Date(b.blueprint.createdAt).getTime() : 0;
        return dateB - dateA;
      });
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
      .orderBy(desc(blueprintVersions.versionNumber))
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
      ratingStats: {
        avgRating: (ratingStats as any).avgRating || 0,
        totalReviews: (ratingStats as any).totalReviews || 0,
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

    if (!plan.isPublished) {
      return res.status(400).json({ message: "Meal plan is not available for purchase" });
    }

    // Get the latest version
    const [latestVersion] = await db
      .select()
      .from(blueprintVersions)
      .where(eq(blueprintVersions.blueprintId, planId))
      .orderBy(desc(blueprintVersions.versionNumber))
      .limit(1);

    if (!latestVersion) {
      return res.status(400).json({ message: "Meal plan has no published version" });
    }

    const [existingPurchase] = await db
      .select()
      .from(mealPlanPurchases)
      .where(and(eq(mealPlanPurchases.buyerId, userId), eq(mealPlanPurchases.blueprintId, planId)))
      .limit(1);

    if (existingPurchase) {
      return res.status(400).json({ message: "You already own this meal plan" });
    }

    const [purchase] = await db
      .insert(mealPlanPurchases)
      .values({
        buyerId: userId,
        blueprintId: planId,
        versionId: latestVersion.id,
        pricePaid: plan.price,
      })
      .returning();

    await db
      .update(mealPlanBlueprints)
      .set({ salesCount: sql`${mealPlanBlueprints.salesCount} + 1` })
      .where(eq(mealPlanBlueprints.id, planId));

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    await db
      .insert(creatorAnalytics)
      .values({
        creatorId: plan.creatorId,
        blueprintId: planId,
        date: todayDate,
        sales: 1,
        revenue: plan.price,
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
      .where(eq(mealPlanPurchases.buyerId, userId))
      .orderBy(desc(mealPlanPurchases.purchasedAt));

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
    const { rating, reviewText } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const [purchase] = await db
      .select()
      .from(mealPlanPurchases)
      .where(and(eq(mealPlanPurchases.buyerId, userId), eq(mealPlanPurchases.blueprintId, planId)))
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
        .set({ rating, reviewText: reviewText || null })
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
        reviewText: reviewText || null,
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
        // ⬇️ removed generic to avoid esbuild TS-parse error
        totalSales: sql`sum(${creatorAnalytics.sales})`,
        totalRevenue: sql`sum(cast(${creatorAnalytics.revenue} as decimal))`,
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
        totalRevenue: sql`cast(${mealPlanBlueprints.salesCount} as decimal) * cast(${mealPlanBlueprints.price} as decimal)`,
      })
      .from(mealPlanBlueprints)
      .where(eq(mealPlanBlueprints.creatorId, userId))
      .orderBy(desc(mealPlanBlueprints.salesCount))
      .limit(10);

    res.json({
      totals: {
        totalSales: (totals as any)?.totalSales || 0,
        totalRevenue: (totals as any)?.totalRevenue || "0",
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
