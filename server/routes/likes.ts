// server/routes/likes.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

// POST /api/likes  { userId, postId }
r.post("/", async (req, res, next) => {
  try {
    const like = await storage.likePost(req.body.userId, req.body.postId);
    res.status(201).json(like);
  } catch (e) { next(e); }
});

// DELETE /api/likes/:userId/:postId
r.delete("/:userId/:postId", async (req, res, next) => {
  try {
    const ok = await storage.unlikePost(req.params.userId, req.params.postId);
    if (!ok) return res.status(404).json({ message: "Like not found" });
    res.json({ message: "Post unliked successfully" });
  } catch (e) { next(e); }
});

// GET /api/likes/:userId/:postId
r.get("/:userId/:postId", async (req, res, next) => {
  try {
    const isLiked = await storage.isPostLiked(req.params.userId, req.params.postId);
    res.json({ isLiked });
  } catch (e) { next(e); }
});

export default r;
