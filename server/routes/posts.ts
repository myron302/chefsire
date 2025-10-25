import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { asyncHandler, ErrorFactory } from "../middleware/error-handler";
import { validateRequest, CommonSchemas } from "../middleware/validation";

const r = Router();

/**
 * Posts - NOTE: All routes are prefixed with /posts by index.ts
 * So /feed here becomes /api/posts/feed
 */

r.get(
  "/feed",
  validateRequest(
    z.object({
      userId: z.string().min(1, "userId is required"),
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const { userId, offset, limit } = req.query;
    const posts = await storage.getFeedPosts(userId as string, offset as number, limit as number);
    res.json(posts);
  })
);

r.get(
  "/explore",
  validateRequest(CommonSchemas.pagination, "query"),
  asyncHandler(async (req, res) => {
    const { offset, limit } = req.query;
    const posts = await storage.getExplorePosts(offset as number, limit as number);
    res.json(posts);
  })
);

r.get(
  "/user/:userId",
  validateRequest(CommonSchemas.pagination, "query"),
  asyncHandler(async (req, res) => {
    const { offset, limit } = req.query;
    const posts = await storage.getUserPosts(req.params.userId, offset as number, limit as number);
    res.json(posts);
  })
);

r.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const post = await storage.getPostWithUser(req.params.id);
    if (!post) throw ErrorFactory.notFound("Post not found");
    res.json(post);
  })
);

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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error("likes/delete error", e);
    res.status(500).json({ message: "Failed to unlike post" });
  }
});

r.get("/likes/:userId/:postId", async (req, res) => {
  try {
    const isLiked = await storage.isPostLiked(req.params.userId, req.params.postId);
    res.json({ isLiked });
  } catch (error) {
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
  } catch (error) {
    console.error("follows/delete error", e);
    res.status(500).json({ message: "Failed to unfollow user" });
  }
});

r.get("/follows/:followerId/:followingId", async (req, res) => {
  try {
    const isFollowing = await storage.isFollowing(req.params.followerId, req.params.followingId);
    res.json({ isFollowing });
  } catch (error) {
    console.error("follows/check error", e);
    res.status(500).json({ message: "Failed to check follow status" });
  }
});

export default r;
