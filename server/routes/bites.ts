// server/routes/bites.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * Bites = stories (same data, different name)
 * Routes are read-friendly and minimal-create to avoid auth complexity.
 */

// List currently-active bites across network (optionally scoped by viewer)
r.get("/active/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const items = await storage.getActiveStories(userId);
    res.json(items);
  } catch (e) {
    console.error("bites/active error", e);
    res.status(500).json({ message: "Failed to fetch active bites" });
  }
});

// List a user’s bites (all, newest first)
r.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const items = await storage.getUserStories(userId);
    res.json({ bites: items, total: items.length });
  } catch (e) {
    console.error("bites/user error", e);
    res.status(500).json({ message: "Failed to fetch user bites" });
  }
});

// Create a bite (story)
r.post("/", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      mediaUrl: z.string().url().optional(),
      text: z.string().max(500).optional(),
      // If not provided, the DB default (e.g., NOW() + 24h) should handle expiry
      expiresAt: z.string().datetime().optional(),
    });

    const data = schema.parse(req.body);
    const created = await storage.createStory({
      userId: data.userId,
      mediaUrl: data.mediaUrl ?? null,
      text: data.text ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    } as any);

    res.status(201).json({ message: "Bite created", bite: created });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid bite", errors: e.issues });
    console.error("bites/create error", e);
    res.status(500).json({ message: "Failed to create bite" });
  }
});

export default r;
