// server/routes/comments.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

// GET /api/comments/post/:postId
r.get("/post/:postId", async (req, res, next) => {
  try {
    const items = await storage.getPostComments(req.params.postId);
    res.json(items);
  } catch (e) { next(e); }
});

// POST /api/comments
r.post("/", async (req, res, next) => {
  try {
    const created = await storage.createComment(req.body);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

// DELETE /api/comments/:id
r.delete("/:id", async (req, res, next) => {
  try {
    const ok = await storage.deleteComment(req.params.id);
    if (!ok) return res.status(404).json({ message: "Comment not found" });
    res.json({ message: "Comment deleted" });
  } catch (e) { next(e); }
});

export default r;
