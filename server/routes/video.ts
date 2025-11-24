// server/routes/video.ts
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { competitions } from "../db/competitions";

const router = Router();

/**
 * POST /api/video/room
 * Create a video room for a competition
 */
router.post("/room", async (req, res) => {
  try {
    const { competitionId, maxParticipants = 20 } = req.body;

    if (!competitionId) {
      return res.status(400).json({ error: "competitionId is required" });
    }

    // Check if competition exists
    const [competition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);

    if (!competition) {
      return res.status(404).json({ error: "Competition not found" });
    }

    // Generate a unique room URL using Jitsi Meet (free, open source)
    // Alternative: use Daily.co, Zoom, or any other video service
    const roomId = `chefsire-${competitionId}-${Date.now()}`;
    const roomUrl = `https://meet.jit.si/${roomId}`;

    // Store the room URL in the competition record
    await db
      .update(competitions)
      .set({
        videoRoomUrl: roomUrl,
        updatedAt: new Date()
      })
      .where(eq(competitions.id, competitionId));

    res.json({
      ok: true,
      roomUrl,
      competitionId,
      maxParticipants
    });
  } catch (error) {
    console.error("Error creating video room:", error);
    res.status(500).json({ error: "Failed to create video room" });
  }
});

export default router;
