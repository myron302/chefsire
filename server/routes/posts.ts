// server/routes/posts.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

// GET /api/posts/feed/:userId?offset&limit
r.get("/feed/:userId", async (req, res, next) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit  = Number(req.query.limit ?? 10);
    const items  = await storage.getFeedPosts(req.params.userId, offset, limit);
    res.json(items);
  } catch (e) { next(e); }
});

// GET /api/posts/explore
r.get("/explore", async (_req, res, next) => {
  try {
    const items = await storage.getExplorePosts(0, 10);
    res.json(items);
  } catch (e) { next(e); }
});

// GET /api/posts/user/:userId?offset&limit
r.get("/user/:userId", async (req, res, next) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit  = Number(req.query.limit ?? 10);
    const items  = await storage.getUserPosts(req.params.userId, offset, limit);
    res.json(items);
  } catch (e) { next(e); }
});

// GET /api/posts/:id
r.get("/:id", async (req, res, next) => {
  try {
    const post = await storage.getPostWithUser(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (e) { next(e); }
});

// POST /api/posts
r.post("/", async (req, res, next) => {
  try {
    const created = await storage.createPost(req.body);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

// DELETE /api/posts/:id
r.delete("/:id", async (req, res, next) => {
  try {
    const ok = await storage.deletePost(req.params.id);
    if (!ok) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Post deleted successfully" });
  } catch (e) { next(e); }
});

// Convenience: GET /api/posts/:postId/comments (maps to storage.getPostComments)
r.get("/:postId/comments", async (req, res, next) => {
  try {
    const comments = await storage.getPostComments(req.params.postId);
    res.json(comments);
  } catch (e) { next(e); }
});

export default r;
