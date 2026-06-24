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
import { optionalAuth, requireAuth } from "../middleware";
import {
  buildSimulatedTransactionId,
  filterBrowsePlans,
  normalizeAnalyticsTotals,
  normalizeRatingStats,
  parsePriceDollarsToCents,
  sortBrowsePlans,
  toIsoDateString,
} from "./meal-plans/utils.js";
import { ensureMealSocialSchema, getMealPlanSocialStats } from "./meal-social.js";

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
    await ensureMealSocialSchema();
    const viewerId = userId;

    const plans = await db
      .select({
        blueprint: mealPlanBlueprints,
        // ⬇️ removed generic to avoid esbuild TS-parse error
        avgRating: sql`avg(${mealPlanReviews.rating})`,
        reviewCount: sql`count(distinct ${mealPlanReviews.id})`,
        likeCount: sql`(SELECT COUNT(*)::int FROM meal_plan_likes WHERE blueprint_id = ${mealPlanBlueprints.id})`,
        saveCount: sql`(SELECT COUNT(*)::int FROM meal_plan_saves WHERE blueprint_id = ${mealPlanBlueprints.id})`,
        commentCount: sql`(SELECT COUNT(*)::int FROM meal_plan_comments WHERE blueprint_id = ${mealPlanBlueprints.id} AND deleted_at IS NULL)`,
        viewerHasLiked: sql`${viewerId ? sql`EXISTS(SELECT 1 FROM meal_plan_likes WHERE blueprint_id = ${mealPlanBlueprints.id} AND user_id = ${viewerId})` : sql`FALSE`}`,
        viewerHasSaved: sql`${viewerId ? sql`EXISTS(SELECT 1 FROM meal_plan_saves WHERE blueprint_id = ${mealPlanBlueprints.id} AND user_id = ${viewerId})` : sql`FALSE`}`,
        viewerIsFollowingCreator: sql`${viewerId ? sql`EXISTS(SELECT 1 FROM follows WHERE follower_id = ${viewerId} AND following_id = ${mealPlanBlueprints.creatorId})` : sql`FALSE`}`,
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
router.get("/meal-plans", optionalAuth, async (req: Request, res: Response) => {
  try {
    await ensureMealSocialSchema();
    const viewerId = (req.user as any)?.id || null;
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
        likeCount: sql`(SELECT COUNT(*)::int FROM meal_plan_likes WHERE blueprint_id = ${mealPlanBlueprints.id})`,
        saveCount: sql`(SELECT COUNT(*)::int FROM meal_plan_saves WHERE blueprint_id = ${mealPlanBlueprints.id})`,
        commentCount: sql`(SELECT COUNT(*)::int FROM meal_plan_comments WHERE blueprint_id = ${mealPlanBlueprints.id} AND deleted_at IS NULL)`,
        viewerHasLiked: sql`${viewerId ? sql`EXISTS(SELECT 1 FROM meal_plan_likes WHERE blueprint_id = ${mealPlanBlueprints.id} AND user_id = ${viewerId})` : sql`FALSE`}`,
        viewerHasSaved: sql`${viewerId ? sql`EXISTS(SELECT 1 FROM meal_plan_saves WHERE blueprint_id = ${mealPlanBlueprints.id} AND user_id = ${viewerId})` : sql`FALSE`}`,
        viewerIsFollowingCreator: sql`${viewerId ? sql`EXISTS(SELECT 1 FROM follows WHERE follower_id = ${viewerId} AND following_id = ${mealPlanBlueprints.creatorId})` : sql`FALSE`}`,
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

    res.json({
      plans: sorted.map((item: any) => ({
        ...item,
        social: {
          likeCount: Number(item.likeCount || 0),
          saveCount: Number(item.saveCount || 0),
          commentCount: Number(item.commentCount || 0),
          viewerHasLiked: Boolean(item.viewerHasLiked),
          viewerHasSaved: Boolean(item.viewerHasSaved),
        },
        viewerIsFollowingCreator: Boolean(item.viewerIsFollowingCreator),
        ranking: {
          trendingScore: Number(item.trendingScore || 0),
          recentnessBoost: Number(item.recentnessBoost || 0),
        },
      })),
    });
  } catch (error) {
    console.error("Error browsing meal plans:", error);
    res.status(500).json({ message: "Failed to browse meal plans" });
  }
});

// Get single meal plan details
router.get("/meal-plans/:id", optionalAuth, async (req: Request, res: Response) => {
  try {
    await ensureMealSocialSchema();
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
      social: await getMealPlanSocialStats(planId, (req.user as any)?.id),
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
    const weekStart = sql`date_trunc('week', NOW())`;

    const [totalsResult, trendsResult, topPlansResult, topSharedWeeksResult, daily, salesTopPlans] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(u.followers_count, 0)::int AS total_followers,
          (SELECT COUNT(*)::int FROM meal_plan_saves s INNER JOIN meal_plan_blueprints b ON b.id = s.blueprint_id WHERE b.creator_id = ${userId}) AS total_plan_saves,
          (SELECT COUNT(*)::int FROM shared_week_saves s INNER JOIN meal_plan_week_shares sh ON sh.public_share_token = s.public_share_token WHERE sh.user_id = ${userId} AND sh.visibility = 'public') AS total_shared_week_saves,
          (SELECT COUNT(*)::int FROM meal_plan_purchases p INNER JOIN meal_plan_blueprints b ON b.id = p.blueprint_id WHERE b.creator_id = ${userId} AND p.payment_status = 'completed') AS total_marketplace_purchases,
          (SELECT COALESCE(SUM(price_paid_cents), 0)::int FROM meal_plan_purchases p INNER JOIN meal_plan_blueprints b ON b.id = p.blueprint_id WHERE b.creator_id = ${userId} AND p.payment_status = 'completed') AS total_revenue_cents,
          (SELECT COUNT(*)::int FROM meal_plan_blueprints b WHERE b.creator_id = ${userId} AND b.status = 'published') AS plans_published,
          (SELECT COUNT(*)::int FROM meal_plan_week_shares sh WHERE sh.user_id = ${userId} AND sh.visibility = 'public' AND sh.public_share_token IS NOT NULL) AS shared_weeks_published
        FROM users u
        WHERE u.id = ${userId}
        LIMIT 1
      `),
      db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM follows f WHERE f.following_id = ${userId} AND f.created_at >= ${weekStart}) AS followers_this_week,
          (SELECT COUNT(*)::int FROM meal_plan_saves s INNER JOIN meal_plan_blueprints b ON b.id = s.blueprint_id WHERE b.creator_id = ${userId} AND s.created_at >= ${weekStart}) AS plan_saves_this_week,
          (SELECT COUNT(*)::int FROM shared_week_saves s INNER JOIN meal_plan_week_shares sh ON sh.public_share_token = s.public_share_token WHERE sh.user_id = ${userId} AND sh.visibility = 'public' AND s.created_at >= ${weekStart}) AS shared_week_saves_this_week,
          (SELECT COUNT(*)::int FROM meal_plan_purchases p INNER JOIN meal_plan_blueprints b ON b.id = p.blueprint_id WHERE b.creator_id = ${userId} AND p.payment_status = 'completed' AND p.created_at >= ${weekStart}) AS purchases_this_week
      `),
      db.execute(sql`
        SELECT b.id, b.title, b.sales_count,
          COUNT(DISTINCT s.id)::int AS save_count,
          COUNT(DISTINCT l.id)::int AS like_count,
          COUNT(DISTINCT r.id)::int AS review_count,
          COUNT(DISTINCT p.id)::int AS purchase_count
        FROM meal_plan_blueprints b
        LEFT JOIN meal_plan_saves s ON s.blueprint_id = b.id
        LEFT JOIN meal_plan_likes l ON l.blueprint_id = b.id
        LEFT JOIN meal_plan_reviews r ON r.blueprint_id = b.id
        LEFT JOIN meal_plan_purchases p ON p.blueprint_id = b.id AND p.payment_status = 'completed'
        WHERE b.creator_id = ${userId} AND b.status = 'published'
        GROUP BY b.id, b.title, b.sales_count
        ORDER BY save_count DESC, purchase_count DESC, b.created_at DESC
        LIMIT 5
      `),
      db.execute(sql`
        SELECT sh.public_share_token, sh.week_anchor, sh.updated_at,
          COUNT(DISTINCT s.id)::int AS save_count,
          COUNT(DISTINCT l.id)::int AS like_count,
          COUNT(DISTINCT c.id)::int AS comment_count
        FROM meal_plan_week_shares sh
        LEFT JOIN shared_week_saves s ON s.public_share_token = sh.public_share_token
        LEFT JOIN shared_week_likes l ON l.public_share_token = sh.public_share_token
        LEFT JOIN shared_week_comments c ON c.public_share_token = sh.public_share_token AND c.deleted_at IS NULL
        WHERE sh.user_id = ${userId} AND sh.visibility = 'public' AND sh.public_share_token IS NOT NULL
        GROUP BY sh.public_share_token, sh.week_anchor, sh.updated_at
        ORDER BY save_count DESC, like_count DESC, sh.updated_at DESC
        LIMIT 5
      `),
      db.select().from(creatorAnalytics).where(eq(creatorAnalytics.creatorId, userId)).orderBy(desc(creatorAnalytics.date)).limit(30),
      db.select({ blueprint: mealPlanBlueprints, totalRevenue: sql`${mealPlanBlueprints.salesCount} * ${mealPlanBlueprints.priceInCents}` }).from(mealPlanBlueprints).where(eq(mealPlanBlueprints.creatorId, userId)).orderBy(desc(mealPlanBlueprints.salesCount)).limit(10),
    ]);

    const totalsRow = (totalsResult as any).rows?.[0] || {};
    const trendRow = (trendsResult as any).rows?.[0] || {};
    const totalFollowers = Number(totalsRow.total_followers || 0);
    const totalPlanSaves = Number(totalsRow.total_plan_saves || 0);
    const totalSharedWeekSaves = Number(totalsRow.total_shared_week_saves || 0);
    const totalMarketplacePurchases = Number(totalsRow.total_marketplace_purchases || 0);
    const sharedWeekSavesThisWeek = Number(trendRow.shared_week_saves_this_week || 0);
    const badges = [
      totalFollowers >= 10 && { label: "Community Favorite", description: "10+ followers" },
      totalPlanSaves >= 10 && { label: "Top Saved Creator", description: "10+ marketplace plan saves" },
      Number(trendRow.followers_this_week || 0) >= 3 && { label: "Fast Growing Creator", description: "3+ new followers this week" },
      (Number(trendRow.followers_this_week || 0) + Number(trendRow.plan_saves_this_week || 0) + sharedWeekSavesThisWeek) >= 5 && { label: "Rising Creator", description: "5+ audience actions this week" },
    ].filter(Boolean);

    res.json({
      totals: {
        totalSales: totalMarketplacePurchases,
        totalRevenue: String(Number(totalsRow.total_revenue_cents || 0) / 100),
        totalFollowers,
        totalPlanSaves,
        totalSharedWeekSaves,
        totalWeekCopies: null,
        totalMarketplacePurchases,
        totalProfileViews: null,
        plansPublished: Number(totalsRow.plans_published || 0),
        sharedWeeksPublished: Number(totalsRow.shared_weeks_published || 0),
      },
      weekly: {
        followersThisWeek: Number(trendRow.followers_this_week || 0),
        planSavesThisWeek: Number(trendRow.plan_saves_this_week || 0),
        sharedWeekSavesThisWeek,
        copiesThisWeek: null,
        purchasesThisWeek: Number(trendRow.purchases_this_week || 0),
      },
      unavailableMetrics: {
        weekCopies: "Shared week copy events are not tracked yet.",
        profileViews: "Profile and storefront views are not tracked yet.",
        planViews: "Meal plan views are not tracked yet.",
        conversionRate: "Plan view-to-purchase conversion is not tracked yet.",
      },
      topContent: {
        mostSavedPlans: ((topPlansResult as any).rows || []).map((row: any) => ({ id: row.id, title: row.title, saveCount: Number(row.save_count || 0), purchaseCount: Number(row.purchase_count || 0), likeCount: Number(row.like_count || 0), reviewCount: Number(row.review_count || 0) })),
        mostSavedSharedWeeks: ((topSharedWeeksResult as any).rows || []).map((row: any) => ({ token: row.public_share_token, weekAnchor: row.week_anchor, updatedAt: row.updated_at, saveCount: Number(row.save_count || 0), likeCount: Number(row.like_count || 0), commentCount: Number(row.comment_count || 0), copyCount: null })),
        mostViewedPlan: null,
        highestConvertingPlan: null,
      },
      badges,
      daily,
      topPlans: salesTopPlans,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default router;
