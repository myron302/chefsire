// server/routes/cook-together.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware";

const router = Router();

// ============================================================================
// COOK TOGETHER: Live cooking sessions with multiple participants
// ============================================================================

/**
 * Helper: Generate unique room code
 */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * GET /api/cook-together/active
 * Get currently active sessions
 */
router.get("/active", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const sessions = await db.execute(sql`
      SELECT
        cts.*,
        r.title as "recipe.title",
        r.image_url as "recipe.imageUrl",
        r.prep_time as "recipe.prepTime",
        u.id as "host.id",
        u.display_name as "host.displayName",
        u.avatar as "host.avatar",
        COUNT(ctp.id) as participant_count
      FROM cook_together_sessions cts
      JOIN recipes r ON cts.recipe_id = r.id
      JOIN users u ON cts.host_user_id = u.id
      LEFT JOIN cook_together_participants ctp ON cts.id = ctp.session_id AND ctp.left_at IS NULL
      WHERE cts.status = 'active'
        AND cts.is_public = true
      GROUP BY cts.id, r.id, u.id
      ORDER BY cts.started_at DESC
      LIMIT ${limit}
    `);

    res.json({ sessions: sessions.rows });
  } catch (error: any) {
    console.error("Error fetching active sessions:", error);
    res.status(500).json({ error: "Failed to fetch active sessions" });
  }
});

/**
 * GET /api/cook-together/scheduled
 * Get upcoming scheduled sessions
 */
router.get("/scheduled", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const sessions = await db.execute(sql`
      SELECT
        cts.*,
        r.title as "recipe.title",
        r.image_url as "recipe.imageUrl",
        u.id as "host.id",
        u.display_name as "host.displayName",
        u.avatar as "host.avatar",
        COUNT(ctp.id) as registered_count
      FROM cook_together_sessions cts
      JOIN recipes r ON cts.recipe_id = r.id
      JOIN users u ON cts.host_user_id = u.id
      LEFT JOIN cook_together_participants ctp ON cts.id = ctp.session_id
      WHERE cts.status = 'scheduled'
        AND cts.scheduled_for > NOW()
        AND cts.is_public = true
      GROUP BY cts.id, r.id, u.id
      ORDER BY cts.scheduled_for ASC
      LIMIT ${limit}
    `);

    res.json({ sessions: sessions.rows });
  } catch (error: any) {
    console.error("Error fetching scheduled sessions:", error);
    res.status(500).json({ error: "Failed to fetch scheduled sessions" });
  }
});

/**
 * GET /api/cook-together/:sessionId
 * Get session details
 */
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await db.execute(sql`
      SELECT
        cts.*,
        r.title as "recipe.title",
        r.description as "recipe.description",
        r.image_url as "recipe.imageUrl",
        r.prep_time as "recipe.prepTime",
        r.ingredients as "recipe.ingredients",
        r.instructions as "recipe.instructions",
        u.id as "host.id",
        u.display_name as "host.displayName",
        u.avatar as "host.avatar"
      FROM cook_together_sessions cts
      JOIN recipes r ON cts.recipe_id = r.id
      JOIN users u ON cts.host_user_id = u.id
      WHERE cts.id = ${sessionId}
    `);

    if (session.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Get participants
    const participants = await db.execute(sql`
      SELECT
        ctp.*,
        u.id as "user.id",
        u.display_name as "user.displayName",
        u.avatar as "user.avatar"
      FROM cook_together_participants ctp
      JOIN users u ON ctp.user_id = u.id
      WHERE ctp.session_id = ${sessionId}
      ORDER BY ctp.joined_at ASC
    `);

    res.json({
      session: session.rows[0],
      participants: participants.rows,
    });
  } catch (error: any) {
    console.error("Error fetching session:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

/**
 * POST /api/cook-together/create
 * Create a new cooking session
 */
router.post("/create", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const schema = z.object({
      recipeId: z.string(),
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      scheduledFor: z.string().datetime().optional(),
      maxParticipants: z.number().int().min(2).max(50).default(10),
      isPublic: z.boolean().default(true),
    });

    const data = schema.parse(req.body);

    // Check if recipe exists
    const recipe = await db.execute(sql`
      SELECT id FROM recipes WHERE id = ${data.recipeId}
    `);

    if (recipe.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Generate unique room code
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.execute(sql`
        SELECT id FROM cook_together_sessions WHERE room_code = ${roomCode}
      `);
      if (existing.rows.length === 0) break;
      roomCode = generateRoomCode();
      attempts++;
    }

    // Create session
    const result = await db.execute(sql`
      INSERT INTO cook_together_sessions (
        recipe_id,
        host_user_id,
        title,
        description,
        scheduled_for,
        max_participants,
        is_public,
        room_code,
        status
      ) VALUES (
        ${data.recipeId},
        ${userId},
        ${data.title},
        ${data.description || null},
        ${data.scheduledFor || null},
        ${data.maxParticipants},
        ${data.isPublic},
        ${roomCode},
        ${data.scheduledFor ? 'scheduled' : 'active'}
      )
      RETURNING *
    `);

    const session = result.rows[0];

    // Auto-join host as participant
    await db.execute(sql`
      INSERT INTO cook_together_participants (session_id, user_id)
      VALUES (${session.id}, ${userId})
    `);

    res.json({ session });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

/**
 * POST /api/cook-together/:sessionId/join
 * Join a cooking session
 */
router.post("/:sessionId/join", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.params;

    // Check session status and capacity
    const session = await db.execute(sql`
      SELECT
        cts.*,
        COUNT(ctp.id) as current_participants
      FROM cook_together_sessions cts
      LEFT JOIN cook_together_participants ctp ON cts.id = ctp.session_id AND ctp.left_at IS NULL
      WHERE cts.id = ${sessionId}
      GROUP BY cts.id
    `);

    if (session.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const sessionData = session.rows[0];

    if (sessionData.status === 'completed') {
      return res.status(400).json({ error: "Session already completed" });
    }

    if (sessionData.status === 'cancelled') {
      return res.status(400).json({ error: "Session cancelled" });
    }

    if (sessionData.current_participants >= sessionData.max_participants) {
      return res.status(400).json({ error: "Session is full" });
    }

    // Check if already joined
    const existing = await db.execute(sql`
      SELECT id FROM cook_together_participants
      WHERE session_id = ${sessionId} AND user_id = ${userId} AND left_at IS NULL
    `);

    if (existing.rows.length > 0) {
      return res.json({ message: "Already in session", participant: existing.rows[0] });
    }

    // Join session
    const result = await db.execute(sql`
      INSERT INTO cook_together_participants (session_id, user_id)
      VALUES (${sessionId}, ${userId})
      RETURNING *
    `);

    // Start session if it was scheduled and now has participants
    if (sessionData.status === 'scheduled') {
      await db.execute(sql`
        UPDATE cook_together_sessions
        SET status = 'active', started_at = NOW()
        WHERE id = ${sessionId} AND started_at IS NULL
      `);
    }

    res.json({ participant: result.rows[0] });
  } catch (error: any) {
    console.error("Error joining session:", error);
    res.status(500).json({ error: "Failed to join session" });
  }
});

/**
 * POST /api/cook-together/:sessionId/leave
 * Leave a cooking session
 */
router.post("/:sessionId/leave", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.params;

    await db.execute(sql`
      UPDATE cook_together_participants
      SET left_at = NOW()
      WHERE session_id = ${sessionId} AND user_id = ${userId} AND left_at IS NULL
    `);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error leaving session:", error);
    res.status(500).json({ error: "Failed to leave session" });
  }
});

/**
 * POST /api/cook-together/:sessionId/complete
 * Complete a session (host only)
 */
router.post("/:sessionId/complete", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.params;

    const schema = z.object({
      recordingUrl: z.string().url().optional(),
      thumbnailUrl: z.string().url().optional(),
    });

    const data = schema.parse(req.body);

    // Check if user is host
    const session = await db.execute(sql`
      SELECT * FROM cook_together_sessions WHERE id = ${sessionId} AND host_user_id = ${userId}
    `);

    if (session.rows.length === 0) {
      return res.status(403).json({ error: "Not authorized or session not found" });
    }

    // Update session
    await db.execute(sql`
      UPDATE cook_together_sessions
      SET
        status = 'completed',
        ended_at = NOW(),
        recording_url = ${data.recordingUrl || null},
        thumbnail_url = ${data.thumbnailUrl || null}
      WHERE id = ${sessionId}
    `);

    // Mark all active participants as completed
    await db.execute(sql`
      UPDATE cook_together_participants
      SET completed = true, left_at = COALESCE(left_at, NOW())
      WHERE session_id = ${sessionId} AND left_at IS NULL
    `);

    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error completing session:", error);
    res.status(500).json({ error: "Failed to complete session" });
  }
});

/**
 * POST /api/cook-together/:sessionId/rate
 * Rate a completed session
 */
router.post("/:sessionId/rate", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.params;

    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      feedback: z.string().max(500).optional(),
    });

    const data = schema.parse(req.body);

    await db.execute(sql`
      UPDATE cook_together_participants
      SET rating = ${data.rating}, feedback = ${data.feedback || null}
      WHERE session_id = ${sessionId} AND user_id = ${userId}
    `);

    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error rating session:", error);
    res.status(500).json({ error: "Failed to rate session" });
  }
});

/**
 * GET /api/cook-together/user/:userId/history
 * Get user's session history
 */
router.get("/user/:userId/history", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const sessions = await db.execute(sql`
      SELECT
        cts.*,
        r.title as "recipe.title",
        r.image_url as "recipe.imageUrl",
        u.id as "host.id",
        u.display_name as "host.displayName",
        ctp.completed,
        ctp.rating,
        ctp.joined_at
      FROM cook_together_sessions cts
      JOIN recipes r ON cts.recipe_id = r.id
      JOIN users u ON cts.host_user_id = u.id
      JOIN cook_together_participants ctp ON cts.id = ctp.session_id
      WHERE ctp.user_id = ${userId}
      ORDER BY ctp.joined_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    res.json({ sessions: sessions.rows });
  } catch (error: any) {
    console.error("Error fetching user session history:", error);
    res.status(500).json({ error: "Failed to fetch session history" });
  }
});

export default router;
