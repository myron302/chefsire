// server/routes/likes.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * POST /api/likes
 * Body: { userId: string, postId: string }
 */
r.post("/", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      postId: z.string(),
    });
    const likeData = schema.parse(req.body);

    const like = await storage.likePost(likeData.userId, likeData.postId);
    res.status(201).json(like);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid like data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to like post" });
  }
});

/**
 * DELETE /api/likes/:userId/:postId
 */
r.delete("/:userId/:postId", async (req, res) => {
  try {
    const success = await storage.unlikePost(req.params.userId, req.params.postId);
    if (!success) return res.status(404).json({ message: "Like not found" });
    res.json({ message: "Post unliked successfully" });
  } catch {
    res.status(500).json({ message: "Failed to unlike post" });
  }
});

/**
 * GET /api/likes/:userId/:postId
 * Returns { isLiked: boolean }
 */
r.get("/:userId/:postId", async (req, res) => {
  try {
    const isLiked = await storage.isPostLiked(req.params.userId, req.params.postId);
    res.json({ isLiked });
  } catch {
    res.status(500).json({ message: "Failed to check like status" });
  }
});

export default r;
