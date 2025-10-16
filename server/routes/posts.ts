import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const r = Router();

/**
 * Posts - NOTE: All routes are prefixed with /posts by index.ts
 * So /feed here becomes /api/posts/feed
 */

r.get("/feed", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 10);
    const posts = await storage.getFeedPosts(userId, offset, limit);
    res.json(posts);
  } catch (e) {
    console.error("posts/feed error", e);
    res.status(500).json({ message: "Failed to fetch feed" });
  }
});

r.get("/explore", async (req, res) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 10);
    const posts = await storage.getExplorePosts(offset, limit);
    res.json(posts);
  } catch (e) {
    console.error("posts/explore error", e);
    res.status(500).json({ message: "Failed to fetch explore posts" });
  }
});

r.get("/user/:userId", async (req, res) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 10);
    const posts = await storage.getUserPosts(req.params.userId, offset, limit);
    res.json(posts);
  } catch (e) {
    console.error("posts/user error", e);
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
});

r.get("/:id", async (req, res) => {
  try {
    const post = await storage.getPostWithUser(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (e) {
    console.error("posts/:id error", e);
    res.status(500).json({ message: "Failed to fetch post" });
  }
});

r.post("/", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      caption: z.string().optional(),
      imageUrl: z.string().url().optional(),
      tags: z.array(z.string()).optional(),
      isRecipe: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const created = await storage.createPost(body as any);
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid post data", errors: e.issues });
    console.error("posts/create error", e);
    res.status(500).json({ message: "Failed to create post" });
  }
});

r.delete("/:id", async (req, res) => {
  try {
    const ok = await storage.deletePost(req.params.id);
    if (!ok) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Post deleted" });
  } catch (e) {
    console.error("posts/delete error", e);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

/**
 * Comments
 */
r.get("/:postId/comments", async (req, res) => {
  try {
    const comments = await storage.getPostComments(req.params.postId);
    res.json(comments);
  } catch (e) {
    console.error("comments/list error", e);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

r.post("/comments", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      postId: z.string(),
      text: z.string().min(1),
    });
    const body = schema.parse(req.body);
    const created = await storage.createComment(body as any);
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid comment", errors: e.issues });
    console.error("comments/create error", e);
    res.status(500).json({ message: "Failed to create comment" });
  }
});

r.delete("/comments/:id", async (req, res) => {
  try {
    const ok = await storage.deleteComment(req.params.id);
    if (!ok) return res.status(404).json({ message: "Comment not found" });
    res.json({ message: "Comment deleted" });
  } catch (e) {
    console.error("comments/delete error", e);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

/**
 * Likes
 */
r.post("/likes", async (req, res) => {
  try {
    const schema = z.object({ userId: z.string(), postId: z.string() });
    const body = schema.parse(req.body);
    const like = await storage.likePost(body.userId, body.postId);
    res.status(201).json(like);
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid like data", errors: e.issues });
    console.error("likes/create error", e);
    res.status(500).json({ message: "Failed to like post" });
  }
});

r.delete("/likes/:userId/:postId", async (req, res) => {
  try {
    const ok = await storage.unlikePost(req.params.userId, req.params.postId);
    if (!ok) return res.status(404).json({ message: "Like not found" });
    res.json({ message: "Post unliked" });
  } catch (e) {
    console.error("likes/delete error", e);
    res.status(500).json({ message: "Failed to unlike post" });
  }
});

r.get("/likes/:userId/:postId", async (req, res) => {
  try {
    const isLiked = await storage.isPostLiked(req.params.userId, req.params.postId);
    res.json({ isLiked });
  } catch (e) {
    console.error("likes/check error", e);
    res.status(500).json({ message: "Failed to check like status" });
  }
});

/**
 * Follows
 */
r.post("/follows", async (req, res) => {
  try {
    const schema = z.object({ followerId: z.string(), followingId: z.string() });
    const body = schema.parse(req.body);
    const follow = await storage.followUser(body.followerId, body.followingId);
    res.status(201).json(follow);
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ message: "Invalid follow data", errors: e.issues });
    console.error("follows/create error", e);
    res.status(500).json({ message: "Failed to follow user" });
  }
});

r.delete("/follows/:followerId/:followingId", async (req, res) => {
  try {
    const ok = await storage.unfollowUser(req.params.followerId, req.params.followingId);
    if (!ok) return res.status(404).json({ message: "Follow relationship not found" });
    res.json({ message: "User unfollowed" });
  } catch (e) {
    console.error("follows/delete error", e);
    res.status(500).json({ message: "Failed to unfollow user" });
  }
});

r.get("/follows/:followerId/:followingId", async (req, res) => {
  try {
    const isFollowing = await storage.isFollowing(req.params.followerId, req.params.followingId);
    res.json({ isFollowing });
  } catch (e) {
    console.error("follows/check error", e);
    res.status(500).json({ message: "Failed to check follow status" });
  }
});

export default r;
