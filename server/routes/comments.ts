// server/routes/comments.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertCommentSchema } from "../../shared/schema";

const r = Router();

/**
 * GET /api/comments/posts/:postId
 * List comments for a post
 */
r.get("/posts/:postId", async (req, res) => {
  try {
    const comments = await storage.getPostComments(req.params.postId);
    res.json(comments);
  } catch {
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

/**
 * POST /api/comments
 * Body validated via shared schema
 */
r.post("/", async (req, res) => {
  try {
    const commentData = insertCommentSchema.parse(req.body);
    const comment = await storage.createComment(commentData);
    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid comment data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create comment" });
  }
});

export default r;
