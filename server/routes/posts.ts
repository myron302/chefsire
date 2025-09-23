// server/routes/posts.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  insertPostSchema,
} from "../../shared/schema";

const r = Router();

/** -------------------------
 * Feed / Explore / By User
 * -------------------------- */
r.get("/feed/:userId", async (req, res) => {
  try {
    const offset = parseInt((req.query.offset as string) || "0", 10);
    const limit = parseInt((req.query.limit as string) || "10", 10);
    const posts = await storage.getFeedPosts(req.params.userId, offset, limit);
    res.json(posts);
  } catch {
    res.status(500).json({ message: "Failed to fetch feed" });
  }
});

r.get("/explore", async (_req, res) => {
  try {
    const offset = 0;
    const limit = 10;
    const posts = await storage.getExplorePosts(offset, limit);
    res.json(posts);
  } catch {
    res.status(500).json({ message: "Failed to fetch explore posts" });
  }
});

r.get("/user/:userId", async (req, res) => {
  try {
    const offset = parseInt((req.query.offset as string) || "0", 10);
    const limit = parseInt((req.query.limit as string) || "10", 10);
    const posts = await storage.getUserPosts(req.params.userId, offset, limit);
    res.json(posts);
  } catch {
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
});

/** -------------------------
 * Single Post CRUD
 * -------------------------- */
r.get("/:id", async (req, res) => {
  try {
    const post = await storage.getPostWithUser(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch {
    res.status(500).json({ message: "Failed to fetch post" });
  }
});

r.post("/", async (req, res) => {
  try {
    const postData = insertPostSchema.parse(req.body);
    const post = await storage.createPost(postData);
    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid post data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create post" });
  }
});

r.delete("/:id", async (req, res) => {
  try {
    const success = await storage.deletePost(req.params.id);
    if (!success) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Post deleted successfully" });
  } catch {
    res.status(500).json({ message: "Failed to delete post" });
  }
});

export default r;
