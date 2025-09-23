// server/routes/bites.ts
// "Bites" (formerly "Stories") routes.
// We keep storage + schema names that still say "story/stories" to avoid touching your DB layer.

import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertStorySchema } from "../../shared/schema"; // keep using existing schema

const r = Router();

/**
 * GET /api/bites/active/:userId
 * Active bites for a user's feed (uses existing storage.getActiveStories)
 */
r.get("/active/:userId", async (req, res) => {
  try {
    const bites = await storage.getActiveStories(req.params.userId);
    res.json(bites);
  } catch {
    res.status(500).json({ message: "Failed to fetch active bites" });
  }
});

/**
 * POST /api/bites
 * Create a bite (validates via existing insertStorySchema, stored through storage.createStory)
 */
r.post("/", async (req, res) => {
  try {
    const biteData = insertStorySchema.parse(req.body);
    const bite = await storage.createStory(biteData);
    res.status(201).json(bite);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid bite data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create bite" });
  }
});

export default r;
