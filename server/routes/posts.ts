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

// Feed: userId is OPTIONAL; if missing, fall back to Explore
r.get(
  "/feed",
  validateRequest(
    z.object({
      userId: z.string().min(1, "userId is required").optional(),
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const { userId, offset, limit } = req.query as {
      userId?: string;
      offset: number;
      limit: number;
    };

    if (!userId) {
      const posts = await storage.getExplorePosts(offset, limit, undefined);
      return res.json(posts);
    }

    const posts = await storage.getFeedPosts(userId, offset, limit);
    res.json(posts);
  })
);

r.get(
  "/explore",
  validateRequest(
    z.object({
      userId: z.string().optional(),
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const { userId, offset, limit } = req.query as {
      userId?: string;
      offset: number;
      limit: number;
    };
    const posts = await storage.getExplorePosts(offset, limit, userId);
    res.json(posts);
  })
);

r.get(
  "/user/:userId",
  validateRequest(
    z.object({
      currentUserId: z.string().optional(),
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const { currentUserId, offset, limit } = req.query as {
      currentUserId?: string;
      offset: number;
      limit: number;
    };
    const posts = await storage.getUserPosts(req.params.userId, offset, limit, currentUserId);
    res.json(posts);
  })
);

r.post("/", async (req, res) => {
  try {
    console.log("📝 Create post attempt with body:", req.body);
    const schema = z.object({
      userId: z.string(),
      caption: z.string().optional(),
      imageUrl: z.string().min(1, "Image URL is required"), // Required, allows data URIs
      tags: z.array(z.string()).optional(),
      isRecipe: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    console.log("✅ Validation passed, creating post:", body);
    const created = await storage.createPost(body as any);
    console.log("✅ Post created successfully:", created.id);
    res.status(201).json(created);
  } catch (err: any) {
    console.error("❌ Post creation error:", err);
    console.error("Error details:", {
      message: err.message,
      issues: err.issues,
      code: err.code,
      detail: err.detail
    });
    if (err?.issues) return res.status(400).json({ message: "Invalid post data", errors: err.issues });
    console.error("posts/create error", err);
    res.status(500).json({ message: "Failed to create post", error: err.message });
  }
});

r.patch("/:id", async (req, res) => {
  try {
    const schema = z.object({
      caption: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const updated = await storage.updatePost(req.params.id, body);
    if (!updated) return res.status(404).json({ message: "Post not found" });
    res.json(updated);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid post data", errors: err.issues });
    console.error("posts/update error", err);
    res.status(500).json({ message: "Failed to update post" });
  }
});

r.delete("/:id", async (req, res) => {
  try {
    const ok = await storage.deletePost(req.params.id);
    if (!ok) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("posts/delete error", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

r.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const post = await storage.getPostWithUser(req.params.id);
    if (!post) throw ErrorFactory.notFound("Post not found");
    res.json(post);
  })
);

/**
 * Comments
 */
r.get("/:postId/comments", async (req, res) => {
  try {
    const comments = await storage.getPostComments(req.params.postId);
    res.json(comments);
  } catch (err) {
    console.error("comments/list error", err);
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
    console.log("Creating comment:", body);
    // Map 'text' to 'content' for database
    const created = await storage.createComment({
      userId: body.userId,
      postId: body.postId,
      content: body.text,
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid comment", errors: err.issues });
    console.error("comments/create error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ message: "Failed to create comment", error: err.message });
  }
});

r.delete("/comments/:id", async (req, res) => {
  try {
    const ok = await storage.deleteComment(req.params.id);
    if (!ok) return res.status(404).json({ message: "Comment not found" });
    res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error("comments/delete error", err);
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
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid like data", errors: err.issues });
    console.error("likes/create error", err);
    res.status(500).json({ message: "Failed to like post" });
  }
});

r.delete("/likes/:userId/:postId", async (req, res) => {
  try {
    const ok = await storage.unlikePost(req.params.userId, req.params.postId);
    if (!ok) return res.status(404).json({ message: "Like not found" });
    res.json({ message: "Post unliked" });
  } catch (err) {
    console.error("likes/delete error", err);
    res.status(500).json({ message: "Failed to unlike post" });
  }
});

r.get("/likes/:userId/:postId", async (req, res) => {
  try {
    const isLiked = await storage.isPostLiked(req.params.userId, req.params.postId);
    res.json({ isLiked });
  } catch (err) {
    console.error("likes/check error", err);
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
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid follow data", errors: err.issues });
    console.error("follows/create error", err);
    res.status(500).json({ message: "Failed to follow user" });
  }
});

r.delete("/follows/:followerId/:followingId", async (req, res) => {
  try {
    const ok = await storage.unfollowUser(req.params.followerId, req.params.followingId);
    if (!ok) return res.status(404).json({ message: "Follow relationship not found" });
    res.json({ message: "User unfollowed" });
  } catch (err) {
    console.error("follows/delete error", err);
    res.status(500).json({ message: "Failed to unfollow user" });
  }
});

r.get("/follows/:followerId/:followingId", async (req, res) => {
  try {
    const isFollowing = await storage.isFollowing(req.params.followerId, req.params.followingId);
    res.json({ isFollowing });
  } catch (err) {
    console.error("follows/check error", err);
    res.status(500).json({ message: "Failed to check follow status" });
  }
});

export default r;
