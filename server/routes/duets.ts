// server/routes/duets.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware";
import { sendDuetNotification } from "../services/notification-service";

const router = Router();

// ============================================================================
// RECIPE DUETS: Side-by-side video responses to recipes
// ============================================================================

/**
 * GET /api/duets/recipe/:recipeId
 * Get all duets for a specific recipe
 */
router.get("/recipe/:recipeId", async (req, res) => {
  try {
    const { recipeId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const duets = await db.execute(sql`
      SELECT
        rd.*,
        u.id as "duet_user.id",
        u.display_name as "duet_user.displayName",
        u.avatar as "duet_user.avatar",
        ou.id as "original_user.id",
        ou.display_name as "original_user.displayName",
        ou.avatar as "original_user.avatar"
      FROM recipe_duets rd
      JOIN users u ON rd.duet_user_id = u.id
      JOIN users ou ON rd.original_user_id = ou.id
      WHERE rd.original_recipe_id = ${recipeId}
        AND rd.is_public = true
      ORDER BY rd.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    res.json({ duets: duets.rows });
  } catch (error: any) {
    console.error("Error fetching duets:", error);
    res.status(500).json({ error: "Failed to fetch duets" });
  }
});

/**
 * GET /api/duets/user/:userId
 * Get all duets created by a specific user
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const duets = await db.execute(sql`
      SELECT
        rd.*,
        r.title as "recipe.title",
        r.image_url as "recipe.imageUrl",
        u.id as "duet_user.id",
        u.display_name as "duet_user.displayName",
        u.avatar as "duet_user.avatar"
      FROM recipe_duets rd
      JOIN recipes r ON rd.original_recipe_id = r.id
      JOIN users u ON rd.duet_user_id = u.id
      WHERE rd.duet_user_id = ${userId}
        AND rd.is_public = true
      ORDER BY rd.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    res.json({ duets: duets.rows });
  } catch (error: any) {
    console.error("Error fetching user duets:", error);
    res.status(500).json({ error: "Failed to fetch user duets" });
  }
});

/**
 * GET /api/duets/feed
 * Get recent duets from followed users (personalized feed)
 */
router.get("/feed", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const duets = await db.execute(sql`
      SELECT
        rd.*,
        r.title as "recipe.title",
        r.image_url as "recipe.imageUrl",
        u.id as "duet_user.id",
        u.display_name as "duet_user.displayName",
        u.avatar as "duet_user.avatar",
        ou.id as "original_user.id",
        ou.display_name as "original_user.displayName",
        ou.avatar as "original_user.avatar"
      FROM recipe_duets rd
      JOIN recipes r ON rd.original_recipe_id = r.id
      JOIN users u ON rd.duet_user_id = u.id
      JOIN users ou ON rd.original_user_id = ou.id
      JOIN follows f ON rd.duet_user_id = f.followed_id
      WHERE f.follower_id = ${userId}
        AND rd.is_public = true
      ORDER BY rd.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    res.json({ duets: duets.rows });
  } catch (error: any) {
    console.error("Error fetching duet feed:", error);
    res.status(500).json({ error: "Failed to fetch duet feed" });
  }
});

/**
 * POST /api/duets/create
 * Create a new recipe duet
 */
router.post("/create", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const schema = z.object({
      originalRecipeId: z.string(),
      originalUserId: z.string(),
      duetVideoUrl: z.string().url().optional(),
      duetImageUrl: z.string().url().optional(),
      caption: z.string().max(500).optional(),
      isPublic: z.boolean().default(true),
    });

    const data = schema.parse(req.body);

    // Check if recipe exists
    const recipe = await db.execute(sql`
      SELECT id FROM recipes WHERE id = ${data.originalRecipeId}
    `);

    if (recipe.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Create duet
    const result = await db.execute(sql`
      INSERT INTO recipe_duets (
        original_recipe_id,
        original_user_id,
        duet_user_id,
        duet_video_url,
        duet_image_url,
        caption,
        is_public
      ) VALUES (
        ${data.originalRecipeId},
        ${data.originalUserId},
        ${userId},
        ${data.duetVideoUrl || null},
        ${data.duetImageUrl || null},
        ${data.caption || null},
        ${data.isPublic}
      )
      RETURNING *
    `);

    const duet = result.rows[0];

    // Send notification to original recipe creator
    if (data.originalUserId !== userId) {
      const [dueter] = await db.execute(sql`
        SELECT username, avatar FROM users WHERE id = ${userId} LIMIT 1
      `);
      const dueterUser = dueter.rows?.[0];

      if (dueterUser) {
        sendDuetNotification(
          data.originalUserId,
          userId,
          dueterUser.username || (req as any).user?.displayName || 'Someone',
          dueterUser.avatar,
          duet.id
        );
      }
    }

    res.json({ duet });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error creating duet:", error);
    res.status(500).json({ error: "Failed to create duet" });
  }
});

/**
 * POST /api/duets/:duetId/like
 * Like/unlike a duet
 */
router.post("/:duetId/like", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { duetId } = req.params;

    // Check if already liked
    const existing = await db.execute(sql`
      SELECT id FROM likes
      WHERE user_id = ${userId}
        AND target_type = 'duet'
        AND target_id = ${duetId}
    `);

    if (existing.rows.length > 0) {
      // Unlike
      await db.execute(sql`
        DELETE FROM likes
        WHERE user_id = ${userId}
          AND target_type = 'duet'
          AND target_id = ${duetId}
      `);

      await db.execute(sql`
        UPDATE recipe_duets
        SET likes_count = GREATEST(likes_count - 1, 0)
        WHERE id = ${duetId}
      `);

      return res.json({ liked: false });
    } else {
      // Like
      await db.execute(sql`
        INSERT INTO likes (user_id, target_type, target_id)
        VALUES (${userId}, 'duet', ${duetId})
      `);

      await db.execute(sql`
        UPDATE recipe_duets
        SET likes_count = likes_count + 1
        WHERE id = ${duetId}
      `);

      // Notify duet creator
      const duet = await db.execute(sql`
        SELECT duet_user_id FROM recipe_duets WHERE id = ${duetId}
      `);

      if (duet.rows[0] && duet.rows[0].duet_user_id !== userId) {
        await db.execute(sql`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            link_url,
            metadata
          ) VALUES (
            ${duet.rows[0].duet_user_id},
            'like',
            'New like on your duet',
            ${`${(req as any).user?.displayName || 'Someone'} liked your duet`},
            ${`/duets/${duetId}`},
            ${JSON.stringify({ duetId, userId })}
          )
        `);
      }

      return res.json({ liked: true });
    }
  } catch (error: any) {
    console.error("Error toggling duet like:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

/**
 * DELETE /api/duets/:duetId
 * Delete a duet (only creator can delete)
 */
router.delete("/:duetId", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { duetId } = req.params;

    // Check ownership
    const duet = await db.execute(sql`
      SELECT duet_user_id FROM recipe_duets WHERE id = ${duetId}
    `);

    if (duet.rows.length === 0) {
      return res.status(404).json({ error: "Duet not found" });
    }

    if (duet.rows[0].duet_user_id !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this duet" });
    }

    await db.execute(sql`
      DELETE FROM recipe_duets WHERE id = ${duetId}
    `);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting duet:", error);
    res.status(500).json({ error: "Failed to delete duet" });
  }
});

/**
 * GET /api/duets/trending
 * Get trending duets (most liked in last 7 days)
 */
router.get("/trending", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const duets = await db.execute(sql`
      SELECT
        rd.*,
        r.title as "recipe.title",
        r.image_url as "recipe.imageUrl",
        u.id as "duet_user.id",
        u.display_name as "duet_user.displayName",
        u.avatar as "duet_user.avatar"
      FROM recipe_duets rd
      JOIN recipes r ON rd.original_recipe_id = r.id
      JOIN users u ON rd.duet_user_id = u.id
      WHERE rd.is_public = true
        AND rd.created_at > NOW() - INTERVAL '7 days'
      ORDER BY rd.likes_count DESC, rd.views_count DESC
      LIMIT ${limit}
    `);

    res.json({ duets: duets.rows });
  } catch (error: any) {
    console.error("Error fetching trending duets:", error);
    res.status(500).json({ error: "Failed to fetch trending duets" });
  }
});

export default router;
