// server/routes/reviews.ts
import { Router, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import {
  recipeReviews,
  recipeReviewPhotos,
  reviewHelpful,
  recipes,
  users,
  type InsertRecipeReview,
  type InsertRecipeReviewPhoto,
  type InsertReviewHelpful
} from "../../shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import multer from "multer";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { RecipeService } from "../services/recipe.service";
import { sendRecipeReviewNotification } from "../services/notification-service";

const router = Router();

function safeObjectKeyCount(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  try {
    return Object.keys(value as Record<string, unknown>).length;
  } catch {
    return 0;
  }
}

function serializeErrorSafely(error: unknown): string {
  const normalized = (error && typeof error === "object")
    ? error
    : { message: typeof error === "string" ? error : "Unknown error", raw: error };

  try {
    return JSON.stringify(normalized, Object.getOwnPropertyNames(normalized), 2);
  } catch {
    try {
      return JSON.stringify({
        name: (normalized as any)?.name,
        message: (normalized as any)?.message,
        code: (normalized as any)?.code,
      });
    } catch {
      return "{\"message\":\"Unserializable error\"}";
    }
  }
}

type ReviewCreateStage =
  | "request.normalization"
  | "recipe.resolve"
  | "duplicate.check"
  | "insert"
  | "media.optional"
  | "stats.update"
  | "readback"
  | "notification"
  | "response.serialize"
  | "error.serialize";

function createReviewDiagnostics(req: Request) {
  const requestId = `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let stage: ReviewCreateStage = "request.normalization";

  const log = (level: "info" | "warn" | "error", message: string, data?: unknown) => {
    const prefix = `[reviews.create][${requestId}][${stage}]`;
    try {
      if (level === "error") console.error(prefix, message, data ?? "");
      else if (level === "warn") console.warn(prefix, message, data ?? "");
      else console.log(prefix, message, data ?? "");
    } catch {
      // Diagnostics must never throw.
    }
  };

  return {
    requestId,
    getStage: () => stage,
    setStage: (next: ReviewCreateStage) => {
      stage = next;
      log("info", "stage.enter");
    },
    info: (message: string, data?: unknown) => log("info", message, data),
    warn: (message: string, data?: unknown) => log("warn", message, data),
    error: (message: string, data?: unknown) => log("error", message, data),
  };
}

function isExternalRecipeRef(recipeId: string): boolean {
  // Only treat known external provider IDs as external refs.
  // This avoids misclassifying local IDs that happen to contain underscores.
  return /^mealdb_[^_]+$/i.test(recipeId);
}

type ResolvedReviewRecipeIdentity = {
  canonicalRecipeId: string;
  linkedRecipeIds: string[];
};

async function resolveRecipeIdentityForReview(recipeId: string): Promise<ResolvedReviewRecipeIdentity> {
  if (typeof recipeId !== "string" || !recipeId.trim()) {
    throw new Error("Recipe id is required");
  }

  const normalizedRecipeId = recipeId.trim();

  if (!isExternalRecipeRef(normalizedRecipeId)) {
    return {
      canonicalRecipeId: normalizedRecipeId,
      linkedRecipeIds: [normalizedRecipeId],
    };
  }

  const identity = await RecipeService.resolveExternalRecipeIdentity(db, normalizedRecipeId);
  if (!identity?.recipe?.id) {
    throw new Error("Failed to resolve external recipe id");
  }

  return {
    canonicalRecipeId: identity.recipe.id,
    linkedRecipeIds: identity.linkedRecipeIds.length > 0
      ? identity.linkedRecipeIds
      : [identity.recipe.id],
  };
}

// Multer config for review photos
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/reviews/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `review-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed (jpeg, jpg, png, webp)"));
    }
  },
});

// Get all reviews for a recipe
router.get("/recipe/:recipeId", async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.params;
    const userId = (req as any).user?.id;
    const identity = await resolveRecipeIdentityForReview(recipeId);
    const reviewRecipeFilter = identity.linkedRecipeIds.length > 1
      ? inArray(recipeReviews.recipeId, identity.linkedRecipeIds)
      : eq(recipeReviews.recipeId, identity.canonicalRecipeId);

    const reviews = await db
      .select({
        id: recipeReviews.id,
        recipeId: recipeReviews.recipeId,
        userId: recipeReviews.userId,
        rating: recipeReviews.rating,
        reviewText: recipeReviews.reviewText,
        helpfulCount: recipeReviews.helpfulCount,
        createdAt: recipeReviews.createdAt,
        updatedAt: recipeReviews.updatedAt,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          royalTitle: users.royalTitle,
        },
        isHelpful: userId ? sql<boolean>`EXISTS (
          SELECT 1 FROM ${reviewHelpful}
          WHERE ${reviewHelpful.reviewId} = ${recipeReviews.id}
          AND ${reviewHelpful.userId} = ${userId}
        )` : sql<boolean>`false`,
      })
      .from(recipeReviews)
      .leftJoin(users, eq(recipeReviews.userId, users.id))
      .where(reviewRecipeFilter)
      .orderBy(desc(recipeReviews.createdAt));

    // Get photos for each review
    const reviewIds = reviews.map((r) => r.id);
    let photos: any[] = [];
    if (reviewIds.length > 0) {
      photos = await db
        .select()
        .from(recipeReviewPhotos)
        .where(inArray(recipeReviewPhotos.reviewId, reviewIds));
    }

    // Group photos by review
    const photosMap = photos.reduce((acc: any, photo: any) => {
      if (!acc[photo.reviewId]) acc[photo.reviewId] = [];
      acc[photo.reviewId].push(photo);
      return acc;
    }, {});

    const reviewsWithPhotos = reviews.map((review) => ({
      ...review,
      photos: photosMap[review.id] || [],
    }));

    res.json(reviewsWithPhotos);
  } catch (error: any) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Create a review
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const diagnostics = createReviewDiagnostics(req);
  try {
    diagnostics.setStage("request.normalization");
    diagnostics.info("create.review.start", {
      userId: (req as any).user?.id || null,
      bodyKeys: safeObjectKeyCount(req.body),
    });

    const userId = (req as any).user.id;
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    let recipeId = typeof body.recipeId === "string" ? body.recipeId.trim() : "";
    let linkedRecipeIdsForIdentity: string[] = [];
    const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);
    const reviewText = typeof body.reviewText === "string" ? body.reviewText : null;

    // Defensive normalization for optional client payload fields used by some review clients.
    const media = Array.isArray(body.media) ? body.media : [];
    const photos = Array.isArray(body.photos) ? body.photos : [];
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const details = body.details && typeof body.details === "object" ? body.details : {};

    diagnostics.setStage("media.optional");
    diagnostics.info("optional.payload.normalized", {
      mediaCount: media.length,
      photosCount: photos.length,
      metadataKeys: safeObjectKeyCount(metadata),
      detailsKeys: safeObjectKeyCount(details),
    });
    diagnostics.setStage("request.normalization");
    diagnostics.info("request.parsed", { userId, recipeId, rating, recipeIdType: typeof recipeId });

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      diagnostics.warn("invalid.rating", { rating });
      return res.status(400).json({ error: "Rating must be between 1 and 5 spoons" });
    }

    // Normalize external recipe IDs to local DB IDs so submit + read use the same key.
    try {
      diagnostics.setStage("recipe.resolve");
      const identity = await resolveRecipeIdentityForReview(recipeId);
      recipeId = identity.canonicalRecipeId;
      linkedRecipeIdsForIdentity = identity.linkedRecipeIds;
      diagnostics.info("recipe.resolved", {
        recipeId,
        linkedRecipeIdsCount: linkedRecipeIdsForIdentity.length,
      });
    } catch (saveError: any) {
      diagnostics.error("recipe.resolve.failed", {
        error: serializeErrorSafely(saveError),
      });
      return res.status(500).json({
        error: "Failed to save recipe from external source",
        details: saveError?.message || "Unable to resolve recipe id",
        stage: diagnostics.getStage(),
        requestId: diagnostics.requestId,
      });
    }

    // Check if user already reviewed this recipe
    diagnostics.setStage("duplicate.check");
    diagnostics.info("duplicate.check.start");
    const duplicateRecipeFilter = linkedRecipeIdsForIdentity.length > 1
      ? inArray(recipeReviews.recipeId, linkedRecipeIdsForIdentity)
      : eq(recipeReviews.recipeId, recipeId);
    const existingReview = await db
      .select()
      .from(recipeReviews)
      .where(and(duplicateRecipeFilter, eq(recipeReviews.userId, userId)))
      .limit(1);

    if (existingReview.length > 0) {
      diagnostics.warn("duplicate.check.blocked", { existingReviewId: existingReview[0].id });
      return res.status(400).json({
        error: "You already reviewed this recipe. Use update instead.",
        stage: diagnostics.getStage(),
        requestId: diagnostics.requestId,
      });
    }
    diagnostics.info("duplicate.check.clear");

    // Create review
    const newReview: InsertRecipeReview = {
      recipeId,
      userId,
      rating,
      reviewText: reviewText || null,
    };

    diagnostics.setStage("insert");
    diagnostics.info("insert.start", { recipeId, userId, rating, hasReviewText: !!reviewText });
    const [review] = await db.insert(recipeReviews).values(newReview).returning();
    diagnostics.info("insert.success", { reviewId: review?.id || null });

    // Update recipe average rating and count (non-fatal)
    diagnostics.setStage("stats.update");
    diagnostics.info("stats.update.start");
    try {
      await updateRecipeRating(recipeId);
      diagnostics.info("stats.update.success");
    } catch (ratingError) {
      // Do not fail create-review after successful insert.
      diagnostics.warn("stats.update.failed.nonfatal", {
        error: serializeErrorSafely(ratingError),
      });
    }

    // Fetch the complete review with user data
    diagnostics.setStage("readback");
    diagnostics.info("readback.start");
    let completeReview: any = null;
    try {
      [completeReview] = await db
        .select({
          id: recipeReviews.id,
          recipeId: recipeReviews.recipeId,
          userId: recipeReviews.userId,
          rating: recipeReviews.rating,
          reviewText: recipeReviews.reviewText,
          helpfulCount: recipeReviews.helpfulCount,
          createdAt: recipeReviews.createdAt,
          updatedAt: recipeReviews.updatedAt,
          user: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar,
            royalTitle: users.royalTitle,
          },
        })
        .from(recipeReviews)
        .leftJoin(users, eq(recipeReviews.userId, users.id))
        .where(eq(recipeReviews.id, review.id));
      diagnostics.info("readback.success", { found: !!completeReview });
    } catch (fetchReviewError) {
      // Do not fail create-review after successful insert.
      diagnostics.warn("readback.failed.nonfatal", {
        error: serializeErrorSafely(fetchReviewError),
      });
    }

    const safeReviewBase = (review && typeof review === "object") ? review : {
      id: "",
      recipeId,
      userId,
      rating,
      reviewText: reviewText || null,
      helpfulCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const safeCompleteReview = (completeReview && typeof completeReview === "object")
      ? completeReview
      : {
          ...safeReviewBase,
          user: {
            id: userId,
            username: "unknown",
            displayName: null,
            avatar: null,
            royalTitle: null,
          },
        };

    diagnostics.info("response.review.normalized", { reviewId: safeCompleteReview.id || null });

    // Send notification to recipe author
    diagnostics.setStage("notification");
    const [recipe] = await db
      .select({ userId: recipes.userId, title: recipes.title })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);

    if (recipe && recipe.userId && recipe.userId !== userId && safeCompleteReview.user) {
      try {
        await sendRecipeReviewNotification(
          recipe.userId,
          userId,
          safeCompleteReview.user.username || safeCompleteReview.user.displayName || "Someone",
          safeCompleteReview.user.avatar,
          recipeId,
          recipe.title || "your recipe",
          rating
        );
      } catch (notificationError) {
        // Notification delivery should never fail a successful create-review call.
        diagnostics.warn("notification.failed.nonfatal", {
          error: serializeErrorSafely(notificationError),
        });
      }
    }

    diagnostics.setStage("response.serialize");
    diagnostics.info("response.success");
    res.status(201).json({ ...safeCompleteReview, photos: [] });
  } catch (error: any) {
    diagnostics.setStage("error.serialize");
    const errorObj = (error && typeof error === "object")
      ? error
      : { message: typeof error === "string" ? error : "Unknown error", raw: error };

    diagnostics.error("create.review.failed", {
      name: (errorObj as any).name,
      message: (errorObj as any).message,
      code: (errorObj as any).code,
      detail: (errorObj as any).detail,
      constraint: (errorObj as any).constraint,
      table: (errorObj as any).table,
      column: (errorObj as any).column,
      stack: (errorObj as any).stack?.split('\n').slice(0, 5).join('\n')
    });
    diagnostics.error("create.review.failed.full", serializeErrorSafely(errorObj));

    res.status(500).json({
      error: "Failed to create review",
      details: (errorObj as any).message || "Unknown error",
      code: (errorObj as any).code,
      constraint: (errorObj as any).constraint,
      stage: diagnostics.getStage(),
      requestId: diagnostics.requestId,
    });
  }
});

// Update a review
router.put("/:reviewId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { reviewId } = req.params;
    const { rating, reviewText } = req.body;

    // Validate rating
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "Rating must be between 1 and 5 spoons" });
    }

    // Check if review exists and belongs to user
    const [existingReview] = await db
      .select()
      .from(recipeReviews)
      .where(eq(recipeReviews.id, reviewId))
      .limit(1);

    if (!existingReview) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (existingReview.userId !== userId) {
      return res.status(403).json({ error: "You can only edit your own reviews" });
    }

    // Update review
    const updateData: any = { updatedAt: new Date() };
    if (rating !== undefined) updateData.rating = rating;
    if (reviewText !== undefined) updateData.reviewText = reviewText;

    const [updatedReview] = await db
      .update(recipeReviews)
      .set(updateData)
      .where(eq(recipeReviews.id, reviewId))
      .returning();

    // Update recipe average rating if rating changed
    if (rating !== undefined) {
      await updateRecipeRating(existingReview.recipeId);
    }

    res.json(updatedReview);
  } catch (error: any) {
    console.error("Error updating review:", error);
    res.status(500).json({ error: "Failed to update review" });
  }
});

// Delete a review
router.delete("/:reviewId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { reviewId } = req.params;

    // Check if review exists and belongs to user
    const [existingReview] = await db
      .select()
      .from(recipeReviews)
      .where(eq(recipeReviews.id, reviewId))
      .limit(1);

    if (!existingReview) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (existingReview.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own reviews" });
    }

    const recipeId = existingReview.recipeId;

    // Delete review (cascade will delete photos and helpful votes)
    await db.delete(recipeReviews).where(eq(recipeReviews.id, reviewId));

    // Update recipe average rating
    await updateRecipeRating(recipeId);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting review:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// Upload photo to a review
router.post(
  "/:reviewId/photos",
  requireAuth,
  upload.single("photo"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { reviewId } = req.params;
      const { caption } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No photo uploaded" });
      }

      // Check if review exists and belongs to user
      const [existingReview] = await db
        .select()
        .from(recipeReviews)
        .where(eq(recipeReviews.id, reviewId))
        .limit(1);

      if (!existingReview) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (existingReview.userId !== userId) {
        return res.status(403).json({ error: "You can only add photos to your own reviews" });
      }

      // Create photo record
      const photoData: InsertRecipeReviewPhoto = {
        reviewId,
        photoUrl: `/uploads/reviews/${req.file.filename}`,
        caption: caption || null,
      };

      const [photo] = await db.insert(recipeReviewPhotos).values(photoData).returning();

      res.status(201).json(photo);
    } catch (error: any) {
      console.error("Error uploading review photo:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  }
);

// Mark review as helpful
router.post("/:reviewId/helpful", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { reviewId } = req.params;

    // Check if already marked as helpful
    const existing = await db
      .select()
      .from(reviewHelpful)
      .where(and(eq(reviewHelpful.reviewId, reviewId), eq(reviewHelpful.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "You already marked this review as helpful" });
    }

    // Add helpful vote
    const helpfulData: InsertReviewHelpful = {
      reviewId,
      userId,
    };

    await db.insert(reviewHelpful).values(helpfulData);

    // Increment helpful count
    await db
      .update(recipeReviews)
      .set({ helpfulCount: sql`${recipeReviews.helpfulCount} + 1` })
      .where(eq(recipeReviews.id, reviewId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking review as helpful:", error);
    res.status(500).json({ error: "Failed to mark review as helpful" });
  }
});

// Remove helpful mark
router.delete("/:reviewId/helpful", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { reviewId } = req.params;

    // Delete helpful vote
    const result = await db
      .delete(reviewHelpful)
      .where(and(eq(reviewHelpful.reviewId, reviewId), eq(reviewHelpful.userId, userId)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Helpful vote not found" });
    }

    // Decrement helpful count
    await db
      .update(recipeReviews)
      .set({ helpfulCount: sql`${recipeReviews.helpfulCount} - 1` })
      .where(eq(recipeReviews.id, reviewId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error removing helpful mark:", error);
    res.status(500).json({ error: "Failed to remove helpful mark" });
  }
});

// Helper function to update recipe's average rating
async function updateRecipeRating(recipeId: string) {
  try {
    const stats = await db
      .select({
        avgRating: sql<number>`AVG(${recipeReviews.rating})::numeric(3,2)`,
        count: sql<number>`COUNT(*)::integer`,
      })
      .from(recipeReviews)
      .where(eq(recipeReviews.recipeId, recipeId));

    const { avgRating, count } = stats[0];

    // Try to update, but don't fail if columns don't exist yet
    try {
      await db
        .update(recipes)
        .set({
          averageRating: avgRating || "0",
          reviewCount: count || 0,
        })
        .where(eq(recipes.id, recipeId));
    } catch (updateError) {
      // Columns might not exist in database yet - that's ok, review still created
      console.log("Note: Could not update recipe rating stats (columns may not exist yet)");
    }
  } catch (error) {
    console.error("Error in updateRecipeRating:", error);
    // Don't throw - allow review creation to succeed even if rating update fails
  }
}

export default router;
