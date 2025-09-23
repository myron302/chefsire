// server/routes/follows.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertFollowSchema } from "../../shared/schema";

const r = Router();

/**
 * POST /api/follows
 * Body: { followerId: string, followingId: string }
 */
r.post("/", async (req, res) => {
  try {
    // Use your shared schema for validation
    const followData = insertFollowSchema.parse(req.body);

    const follow = await storage.followUser(followData.followerId, followData.followingId);
    res.status(201).json(follow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid follow data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to follow user" });
  }
});

/**
 * DELETE /api/follows/:followerId/:followingId
 */
r.delete("/:followerId/:followingId", async (req, res) => {
  try {
    const success = await storage.unfollowUser(req.params.followerId, req.params.followingId);
    if (!success) return res.status(404).json({ message: "Follow relationship not found" });
    res.json({ message: "User unfollowed successfully" });
  } catch {
    res.status(500).json({ message: "Failed to unfollow user" });
  }
});

/**
 * GET /api/follows/:followerId/:followingId
 * Returns { isFollowing: boolean }
 */
r.get("/:followerId/:followingId", async (req, res) => {
  try {
    const isFollowing = await storage.isFollowing(req.params.followerId, req.params.followingId);
    res.json({ isFollowing });
  } catch {
    res.status(500).json({ message: "Failed to check follow status" });
  }
});

export default r;
