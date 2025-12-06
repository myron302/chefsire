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
import { eq, desc, and, sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { RecipeService } from "../services/recipe.service";

const router = Router();

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
      .where(eq(recipeReviews.recipeId, recipeId))
      .orderBy(desc(recipeReviews.createdAt));

    // Get photos for each review
    const reviewIds = reviews.map((r) => r.id);
    let photos: any[] = [];
    if (reviewIds.length > 0) {
      photos = await db
        .select()
        .from(recipeReviewPhotos)
        .where(sql`${recipeReviewPhotos.reviewId} IN ${sql.raw(`(${reviewIds.map(() => '?').join(',')})`, reviewIds)}`);
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
  try {
    console.log("📝 ============ CREATE REVIEW START ============");
    console.log("📝 User:", (req as any).user?.id);
    console.log("📝 Request body:", JSON.stringify(req.body, null, 2));

    const userId = (req as any).user.id;
    let { recipeId, rating, reviewText } = req.body;
    console.log("📝 Parsed data:", { userId, recipeId, rating, reviewText, recipeIdType: typeof recipeId });

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      console.log("❌ Invalid rating:", rating);
      return res.status(400).json({ error: "Rating must be between 1 and 5 spoons" });
    }

    // Check if this is an external recipe (starts with "mealdb_", "spoonacular_", etc.)
    if (recipeId && recipeId.includes("_")) {
      console.log("🌐 External recipe detected:", recipeId);
      console.log("🌐 Calling RecipeService.findOrCreateExternalRecipe...");

      try {
        const savedRecipe = await RecipeService.findOrCreateExternalRecipe(db, recipeId);

        if (!savedRecipe) {
          console.log("❌ findOrCreateExternalRecipe returned null");
          return res.status(500).json({
            error: "Failed to save recipe from external source",
            details: "Recipe service returned null"
          });
        }

        console.log("✅ Recipe saved/found in database:");
        console.log("   - ID:", savedRecipe.id);
        console.log("   - Title:", savedRecipe.title);
        console.log("   - External Source:", savedRecipe.externalSource);
        console.log("   - External ID:", savedRecipe.externalId);

        // Use the local database ID for the review
        recipeId = savedRecipe.id;
        console.log("✅ Updated recipeId to local DB ID:", recipeId);
      } catch (saveError: any) {
        console.error("❌ Error in findOrCreateExternalRecipe:");
        console.error("   Message:", saveError.message);
        console.error("   Stack:", saveError.stack);
        return res.status(500).json({
          error: "Failed to save recipe from external source",
          details: saveError.message
        });
      }
    } else {
      console.log("📍 Using existing recipe ID:", recipeId);
    }

    // Check if user already reviewed this recipe
    console.log("🔍 Checking for existing review...");
    const existingReview = await db
      .select()
      .from(recipeReviews)
      .where(and(eq(recipeReviews.recipeId, recipeId), eq(recipeReviews.userId, userId)))
      .limit(1);

    if (existingReview.length > 0) {
      console.log("❌ User already reviewed this recipe:", existingReview[0].id);
      return res.status(400).json({ error: "You already reviewed this recipe. Use update instead." });
    }
    console.log("✅ No existing review found");

    // Create review
    const newReview: InsertRecipeReview = {
      recipeId,
      userId,
      rating,
      reviewText: reviewText || null,
    };

    console.log("💾 Inserting review into database:", JSON.stringify(newReview, null, 2));
    const [review] = await db.insert(recipeReviews).values(newReview).returning();
    console.log("✅ Review inserted successfully with ID:", review.id);

    // Update recipe average rating and count
    console.log("📊 Updating recipe rating statistics...");
    await updateRecipeRating(recipeId);
    console.log("✅ Recipe rating updated");

    // Fetch the complete review with user data
    console.log("📥 Fetching complete review with user data...");
    const [completeReview] = await db
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

    console.log("✅ Complete review fetched:", completeReview.id);
    console.log("📝 ============ CREATE REVIEW SUCCESS ============");
    res.status(201).json({ ...completeReview, photos: [] });
  } catch (error: any) {
    console.error("❌ ============ CREATE REVIEW ERROR ============");
    console.error("❌ Error creating review:", error);
    console.error("❌ Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    console.error("❌ Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

    res.status(500).json({
      error: "Failed to create review",
      details: error.message,
      code: error.code,
      constraint: error.constraint
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
