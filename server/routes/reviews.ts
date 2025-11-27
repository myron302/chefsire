// server/routes/reviews.ts
import { Router, Request, Response } from "express";
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

    const reviews = await storage
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
      photos = await storage
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
    const userId = (req as any).user.id;
    const { recipeId, rating, reviewText } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5 spoons" });
    }

    // Check if user already reviewed this recipe
    const existingReview = await storage
      .select()
      .from(recipeReviews)
      .where(and(eq(recipeReviews.recipeId, recipeId), eq(recipeReviews.userId, userId)))
      .limit(1);

    if (existingReview.length > 0) {
      return res.status(400).json({ error: "You already reviewed this recipe. Use update instead." });
    }

    // Create review
    const newReview: InsertRecipeReview = {
      recipeId,
      userId,
      rating,
      reviewText: reviewText || null,
    };

    const [review] = await storage.insert(recipeReviews).values(newReview).returning();

    // Update recipe average rating and count
    await updateRecipeRating(recipeId);

    // Fetch the complete review with user data
    const [completeReview] = await storage
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

    res.status(201).json({ ...completeReview, photos: [] });
  } catch (error: any) {
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Failed to create review" });
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
    const [existingReview] = await storage
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

    const [updatedReview] = await storage
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
    const [existingReview] = await storage
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
    await storage.delete(recipeReviews).where(eq(recipeReviews.id, reviewId));

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
      const [existingReview] = await storage
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

      const [photo] = await storage.insert(recipeReviewPhotos).values(photoData).returning();

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
    const existing = await storage
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

    await storage.insert(reviewHelpful).values(helpfulData);

    // Increment helpful count
    await storage
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
    const result = await storage
      .delete(reviewHelpful)
      .where(and(eq(reviewHelpful.reviewId, reviewId), eq(reviewHelpful.userId, userId)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Helpful vote not found" });
    }

    // Decrement helpful count
    await storage
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
  const stats = await storage
    .select({
      avgRating: sql<number>`AVG(${recipeReviews.rating})::numeric(3,2)`,
      count: sql<number>`COUNT(*)::integer`,
    })
    .from(recipeReviews)
    .where(eq(recipeReviews.recipeId, recipeId));

  const { avgRating, count } = stats[0];

  await storage
    .update(recipes)
    .set({
      averageRating: avgRating || "0",
      reviewCount: count || 0,
    })
    .where(eq(recipes.id, recipeId));
}

export default router;
