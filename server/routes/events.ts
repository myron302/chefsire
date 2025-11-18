// server/routes/events.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware";

const router = Router();

// ============================================================================
// SEASONAL EVENTS: Time-limited challenges and competitions
// ============================================================================

/**
 * GET /api/events/active
 * Get all currently active events
 */
router.get("/active", async (req, res) => {
  try {
    const events = await db.execute(sql`
      SELECT
        se.*,
        COUNT(DISTINCT ep.user_id) as participant_count
      FROM seasonal_events se
      LEFT JOIN event_participants ep ON se.id = ep.event_id
      WHERE se.is_active = true
        AND se.start_date <= NOW()
        AND se.end_date >= NOW()
      GROUP BY se.id
      ORDER BY se.is_featured DESC, se.start_date ASC
    `);

    res.json({ events: events.rows });
  } catch (error: any) {
    console.error("Error fetching active events:", error);
    res.status(500).json({ error: "Failed to fetch active events" });
  }
});

/**
 * GET /api/events/upcoming
 * Get upcoming events (not started yet)
 */
router.get("/upcoming", async (req, res) => {
  try {
    const events = await db.execute(sql`
      SELECT
        se.*,
        COUNT(DISTINCT ep.user_id) as interested_count
      FROM seasonal_events se
      LEFT JOIN event_participants ep ON se.id = ep.event_id
      WHERE se.is_active = true
        AND se.start_date > NOW()
      GROUP BY se.id
      ORDER BY se.start_date ASC
      LIMIT 10
    `);

    res.json({ events: events.rows });
  } catch (error: any) {
    console.error("Error fetching upcoming events:", error);
    res.status(500).json({ error: "Failed to fetch upcoming events" });
  }
});

/**
 * GET /api/events/past
 * Get past events (completed)
 */
router.get("/past", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const events = await db.execute(sql`
      SELECT
        se.*,
        COUNT(DISTINCT ep.user_id) as participant_count
      FROM seasonal_events se
      LEFT JOIN event_participants ep ON se.id = ep.event_id
      WHERE se.end_date < NOW()
      GROUP BY se.id
      ORDER BY se.end_date DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    res.json({ events: events.rows });
  } catch (error: any) {
    console.error("Error fetching past events:", error);
    res.status(500).json({ error: "Failed to fetch past events" });
  }
});

/**
 * GET /api/events/:eventId
 * Get detailed information about a specific event
 */
router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).user?.id;

    const event = await db.execute(sql`
      SELECT * FROM seasonal_events WHERE id = ${eventId}
    `);

    if (event.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get participant count
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total_participants,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_count
      FROM event_participants
      WHERE event_id = ${eventId}
    `);

    // Get user's participation status if logged in
    let userParticipation = null;
    if (userId) {
      const participation = await db.execute(sql`
        SELECT * FROM event_participants
        WHERE event_id = ${eventId} AND user_id = ${userId}
      `);
      userParticipation = participation.rows[0] || null;
    }

    res.json({
      event: event.rows[0],
      stats: stats.rows[0],
      userParticipation,
    });
  } catch (error: any) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

/**
 * POST /api/events/:eventId/join
 * Join an event
 */
router.post("/:eventId/join", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { eventId } = req.params;

    // Check if event exists and is active
    const event = await db.execute(sql`
      SELECT * FROM seasonal_events
      WHERE id = ${eventId}
        AND is_active = true
        AND start_date <= NOW()
        AND end_date >= NOW()
    `);

    if (event.rows.length === 0) {
      return res.status(404).json({ error: "Event not found or not active" });
    }

    // Check if already participating
    const existing = await db.execute(sql`
      SELECT id FROM event_participants
      WHERE event_id = ${eventId} AND user_id = ${userId}
    `);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Already participating in this event" });
    }

    // Join event
    const result = await db.execute(sql`
      INSERT INTO event_participants (event_id, user_id, score, progress)
      VALUES (${eventId}, ${userId}, 0, '{}'::jsonb)
      RETURNING *
    `);

    // Update participation count
    await db.execute(sql`
      UPDATE seasonal_events
      SET participation_count = participation_count + 1
      WHERE id = ${eventId}
    `);

    res.json({ participation: result.rows[0] });
  } catch (error: any) {
    console.error("Error joining event:", error);
    res.status(500).json({ error: "Failed to join event" });
  }
});

/**
 * POST /api/events/:eventId/progress
 * Update user's progress in an event
 */
router.post("/:eventId/progress", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { eventId } = req.params;

    const schema = z.object({
      score: z.number().int().min(0),
      progress: z.record(z.any()).optional(),
    });

    const data = schema.parse(req.body);

    // Update participation
    const result = await db.execute(sql`
      UPDATE event_participants
      SET
        score = ${data.score},
        progress = ${JSON.stringify(data.progress || {})}::jsonb
      WHERE event_id = ${eventId} AND user_id = ${userId}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not participating in this event" });
    }

    // Update leaderboard
    await updateLeaderboard(eventId);

    res.json({ participation: result.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error updating event progress:", error);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

/**
 * GET /api/events/:eventId/leaderboard
 * Get event leaderboard
 */
router.get("/:eventId/leaderboard", async (req, res) => {
  try {
    const { eventId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const leaderboard = await db.execute(sql`
      SELECT
        el.*,
        u.id as "user.id",
        u.display_name as "user.displayName",
        u.avatar as "user.avatar",
        ep.score as current_score
      FROM event_leaderboard el
      JOIN users u ON el.user_id = u.id
      JOIN event_participants ep ON el.user_id = ep.user_id AND el.event_id = ep.event_id
      WHERE el.event_id = ${eventId}
      ORDER BY el.rank ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    res.json({ leaderboard: leaderboard.rows });
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

/**
 * GET /api/events/:eventId/leaderboard/:userId
 * Get specific user's position on leaderboard
 */
router.get("/:eventId/leaderboard/:userId", async (req, res) => {
  try {
    const { eventId, userId } = req.params;

    const position = await db.execute(sql`
      SELECT
        el.*,
        u.id as "user.id",
        u.display_name as "user.displayName",
        u.avatar as "user.avatar",
        ep.score as current_score
      FROM event_leaderboard el
      JOIN users u ON el.user_id = u.id
      JOIN event_participants ep ON el.user_id = ep.user_id AND el.event_id = ep.event_id
      WHERE el.event_id = ${eventId} AND el.user_id = ${userId}
    `);

    if (position.rows.length === 0) {
      return res.status(404).json({ error: "User not found on leaderboard" });
    }

    // Get users around this user (context)
    const rank = position.rows[0].rank;
    const context = await db.execute(sql`
      SELECT
        el.*,
        u.id as "user.id",
        u.display_name as "user.displayName",
        u.avatar as "user.avatar",
        ep.score as current_score
      FROM event_leaderboard el
      JOIN users u ON el.user_id = u.id
      JOIN event_participants ep ON el.user_id = ep.user_id AND el.event_id = ep.event_id
      WHERE el.event_id = ${eventId}
        AND el.rank BETWEEN ${Math.max(1, rank - 2)} AND ${rank + 2}
      ORDER BY el.rank ASC
    `);

    res.json({
      position: position.rows[0],
      context: context.rows,
    });
  } catch (error: any) {
    console.error("Error fetching user leaderboard position:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard position" });
  }
});

/**
 * POST /api/events/:eventId/complete
 * Mark event as completed for user and claim rewards
 */
router.post("/:eventId/complete", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { eventId } = req.params;

    // Get event and participation
    const event = await db.execute(sql`
      SELECT se.*, ep.score, ep.reward_claimed
      FROM seasonal_events se
      JOIN event_participants ep ON se.id = ep.event_id
      WHERE se.id = ${eventId} AND ep.user_id = ${userId}
    `);

    if (event.rows.length === 0) {
      return res.status(404).json({ error: "Event or participation not found" });
    }

    const eventData = event.rows[0];

    if (eventData.reward_claimed) {
      return res.status(400).json({ error: "Reward already claimed" });
    }

    // Mark as completed and reward claimed
    await db.execute(sql`
      UPDATE event_participants
      SET
        completed_at = NOW(),
        reward_claimed = true,
        reward_claimed_at = NOW()
      WHERE event_id = ${eventId} AND user_id = ${userId}
    `);

    // Award rewards based on rank (implement reward logic)
    const rewards = eventData.rewards || {};
    // TODO: Award XP, badges, etc. based on rank

    res.json({ success: true, rewards });
  } catch (error: any) {
    console.error("Error completing event:", error);
    res.status(500).json({ error: "Failed to complete event" });
  }
});

/**
 * GET /api/events/user/:userId/participating
 * Get events a user is participating in
 */
router.get("/user/:userId/participating", async (req, res) => {
  try {
    const { userId } = req.params;

    const events = await db.execute(sql`
      SELECT
        se.*,
        ep.score,
        ep.rank,
        ep.joined_at,
        ep.completed_at
      FROM seasonal_events se
      JOIN event_participants ep ON se.id = ep.event_id
      WHERE ep.user_id = ${userId}
        AND se.end_date >= NOW()
      ORDER BY se.end_date ASC
    `);

    res.json({ events: events.rows });
  } catch (error: any) {
    console.error("Error fetching user events:", error);
    res.status(500).json({ error: "Failed to fetch user events" });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update leaderboard rankings for an event
 */
async function updateLeaderboard(eventId: string) {
  try {
    // Recalculate ranks based on scores
    await db.execute(sql`
      INSERT INTO event_leaderboard (event_id, user_id, points, rank, previous_rank)
      SELECT
        event_id,
        user_id,
        score as points,
        ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY score DESC) as rank,
        COALESCE(
          (SELECT rank FROM event_leaderboard WHERE event_id = ep.event_id AND user_id = ep.user_id),
          0
        ) as previous_rank
      FROM event_participants ep
      WHERE event_id = ${eventId}
      ON CONFLICT (event_id, user_id)
      DO UPDATE SET
        points = EXCLUDED.points,
        previous_rank = event_leaderboard.rank,
        rank = EXCLUDED.rank,
        rank_change = event_leaderboard.rank - EXCLUDED.rank,
        last_updated = NOW()
    `);
  } catch (error) {
    console.error("Error updating leaderboard:", error);
  }
}

export default router;
