import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { asyncHandler, ErrorFactory } from "../middleware/error-handler";
import { validateRequest, CommonSchemas } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";

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
    // If the profile is private, only the owner or approved followers can view posts
    const target = await storage.getUser(req.params.userId);
    if (target?.isPrivate) {
      const viewerId = currentUserId;
      const isOwner = viewerId && viewerId === req.params.userId;
      const canView = isOwner || (viewerId ? await storage.isFollowing(viewerId, req.params.userId) : false);
      if (!canView) {
        return res.status(403).json({ message: "This account is private" });
      }
    }

    const posts = await storage.getUserPosts(req.params.userId, offset, limit, currentUserId);
    res.json(posts);
  })
);

r.post("/", async (req, res) => {
  try {
    console.log("📝 Create post attempt with body:", req.body);

    const recipeSchema = z.object({
      title: z.string().min(1, "Recipe title is required"),
      imageUrl: z.string().optional(),
      ingredients: z.array(z.string().min(1)).min(1, "At least 1 ingredient is required"),
      instructions: z.array(z.string().min(1)).min(1, "At least 1 instruction step is required"),
      cookTime: z.coerce.number().int().min(0).optional(),
      servings: z.coerce.number().int().min(1).optional(),
      difficulty: z.string().optional(),
    });

    const schema = z.object({
      userId: z.string(),
      caption: z.string().optional(),
      imageUrl: z.string().min(1, "Image URL is required"), // Required, allows data URIs
      tags: z.array(z.string()).optional(),
      isRecipe: z.boolean().optional(),
      recipe: recipeSchema.optional(),
    });

    const body = schema.parse(req.body);

    // If it's a recipe post, enforce recipe payload
    if (body.isRecipe && !body.recipe) {
      return res.status(400).json({ message: "Recipe details are required for recipe posts" });
    }

    console.log("✅ Validation passed, creating post:", body);

    const created = await storage.createPost({
      userId: body.userId,
      caption: body.caption,
      imageUrl: body.imageUrl,
      tags: body.tags,
      isRecipe: body.isRecipe ?? false,
    } as any);

    // Create the linked recipe record if needed (so feeds can render the recipe template)
    if (body.isRecipe && body.recipe) {
      await storage.createRecipe({
        postId: created.id,
        title: body.recipe.title,
        imageUrl: body.recipe.imageUrl ?? created.imageUrl,
        ingredients: body.recipe.ingredients,
        instructions: body.recipe.instructions,
        cookTime: body.recipe.cookTime ?? null,
        servings: body.recipe.servings ?? null,
        difficulty: body.recipe.difficulty ?? null,
      } as any);
    }

    console.log("✅ Post created successfully:", created.id);
    res.status(201).json(created);
  } catch (err: any) {
    console.error("❌ Post creation error:", err);
    console.error("Error details:", {
      message: err.message,
      issues: err.issues,
      code: err.code,
      detail: err.detail,
    });
    if (err?.issues) {
      return res.status(400).json({ message: "Validation error", issues: err.issues });
    }
    res.status(500).json({ message: "Failed to create post" });
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

r.delete("/:id", requireAuth, async (req, res) => {
  try {
    console.log("DELETE /api/posts/:id - Request params:", req.params);
    console.log("DELETE /api/posts/:id - User:", req.user);

    const postId = req.params.id;
    const userId = req.user!.id; // requireAuth ensures user exists

    // Get the post first to check ownership
    const post = await storage.getPost(postId);
    console.log("DELETE /api/posts/:id - Found post:", post);

    if (!post) {
      console.log("DELETE /api/posts/:id - Post not found");
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if user owns the post
    if (post.userId !== userId) {
      console.log("DELETE /api/posts/:id - User does not own post", {
        postUserId: post.userId,
        requestUserId: userId
      });
      return res.status(403).json({ message: "You can only delete your own posts" });
    }

    console.log("DELETE /api/posts/:id - Attempting to delete post");
    const ok = await storage.deletePost(postId);

    if (!ok) {
      console.log("DELETE /api/posts/:id - Delete failed (storage returned false)");
      return res.status(500).json({ message: "Failed to delete post" });
    }

    console.log("DELETE /api/posts/:id - Post deleted successfully");
    res.json({ message: "Post deleted", postId });
  } catch (err: any) {
    console.error("DELETE /api/posts/:id - Error:", err);
    console.error("DELETE /api/posts/:id - Error message:", err.message);
    console.error("DELETE /api/posts/:id - Error stack:", err.stack);
    res.status(500).json({
      message: "Failed to delete post",
      error: err.message,
      details: err.toString()
    });
  }
});

// Get all likes for a specific post.  This route must come before the generic
// "/:id" handler otherwise Express will treat "likes" as the id and never
// reach this handler.
r.get("/:postId/likes", async (req, res) => {
  try {
    const postId = req.params.postId;
    const likesList = await storage.getPostLikes(postId);
    const userPromises = likesList.map((like) => storage.getUser(like.userId));
    const usersList = await Promise.all(userPromises);
    const result = usersList
      .filter((u): u is Exclude<typeof u, undefined> => !!u)
      .map((u) => ({ id: u.id, displayName: u.displayName, avatar: u.avatar }));
    res.json(result);
  } catch (err) {
    console.error("post likes/list error", err);
    res.status(500).json({ message: "Failed to fetch post likes" });
  }
});

// Get details for a single post
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
      // If provided, this comment becomes a reply to parentId (supports unlimited nesting)
      parentId: z.string().min(1).nullable().optional(),
      text: z.string().min(1),
    });
    const body = schema.parse(req.body);
    console.log("Creating comment:", body);
    // Map 'text' to 'content' for database
    const created = await storage.createComment({
      userId: body.userId,
      postId: body.postId,
      parentId: body.parentId ?? null,
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

// Get all likes for a post.  Returns an array of users (id and displayName) who have liked this post.

/**
 * Comment Likes endpoints
 */
// Like a comment
r.post("/comments/likes", async (req, res) => {
  try {
    const schema = z.object({ userId: z.string(), commentId: z.string() });
    const body = schema.parse(req.body);
    const like = await storage.likeComment(body.userId, body.commentId);
    res.status(201).json(like);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid like data", errors: err.issues });
    console.error("comments/likes/create error", err);
    res.status(500).json({ message: "Failed to like comment" });
  }
});

// Unlike a comment
r.delete("/comments/likes/:userId/:commentId", async (req, res) => {
  try {
    const ok = await storage.unlikeComment(req.params.userId, req.params.commentId);
    if (!ok) return res.status(404).json({ message: "Like not found" });
    res.json({ message: "Comment unliked" });
  } catch (err) {
    console.error("comments/likes/delete error", err);
    res.status(500).json({ message: "Failed to unlike comment" });
  }
});

// Check if a comment is liked by a user
r.get("/comments/likes/:userId/:commentId", async (req, res) => {
  try {
    const isLiked = await storage.isCommentLiked(req.params.userId, req.params.commentId);
    res.json({ isLiked });
  } catch (err) {
    console.error("comments/likes/check error", err);
    res.status(500).json({ message: "Failed to check comment like status" });
  }
});

// List all likes on a comment
r.get("/comments/:commentId/likes", async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const likesList = await storage.getCommentLikes(commentId);
    const userPromises = likesList.map((like) => storage.getUser(like.userId));
    const usersList = await Promise.all(userPromises);
    const result = usersList
      .filter((u): u is Exclude<typeof u, undefined> => !!u)
      .map((u) => ({ id: u.id, displayName: u.displayName, avatar: u.avatar }));
    res.json(result);
  } catch (err) {
    console.error("comments/likes/list error", err);
    res.status(500).json({ message: "Failed to fetch comment likes" });
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
