import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { asyncHandler, ErrorFactory } from "../middleware/error-handler";
import { validateRequest } from "../middleware/validation";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { persistDataUri } from "../lib/data-uri";
import { followOrRequest } from "../lib/social-follow";
import { serializePublicUser } from "../serializers/public-user";
import {
  canViewUserContent,
  getVisibleCommentContext,
  getVisiblePost,
  getVisiblePostWithUser,
  viewerIdFrom,
} from "../lib/post-visibility";

const r = Router();

/**
 * Posts - NOTE: All routes are prefixed with /posts by index.ts
 * So /feed here becomes /api/posts/feed
 *
 * IDENTITY RULES FOR THIS ROUTER
 *
 * - Every mutation runs behind `requireAuth`, and the actor is ALWAYS `req.user!.id`.
 * - Every read that depends on who is looking runs behind `optionalAuth`, and the viewer is
 *   ALWAYS `viewerIdFrom(req)` (the authenticated identity, or null).
 * - Client-supplied ids (`body.userId`, `query.currentUserId`, `/:userId`, `body.followerId`, ...) may name a
 *   TARGET, never the actor or the viewer. Several legacy endpoints still carry such a segment in their URL so
 *   existing clients keep working; those segments are ignored for authorization and for what gets persisted.
 * - Whether a post may be seen at all is decided in one place, `lib/post-visibility.ts`, and applied to the
 *   lists AND to every direct read of a post, its comments and its likes.
 */

/** Legacy actor/viewer fields that clients used to send. Accepted so old clients don't 400; never trusted. */
const legacyViewerField = z.string().optional();

/**
 * Posts and comments carry their author. The joined row is the whole `users` record -- password hash, email,
 * OAuth provider ids and all -- so every one of these responses goes through the repository's existing public
 * projection first (the same one routes/users.ts serves profiles with).
 */
function withPublicAuthor<T extends { user?: any }>(row: T): T {
  return row?.user ? { ...row, user: serializePublicUser(row.user) } : row;
}

// Feed: the viewer is the authenticated user; anonymous callers fall back to Explore.
r.get(
  "/feed",
  optionalAuth,
  validateRequest(
    z.object({
      // Ignored: the feed's owner is the authenticated caller, never a query parameter.
      userId: legacyViewerField,
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const { offset, limit } = req.query as unknown as { offset: number; limit: number };
    const viewerId = viewerIdFrom(req);

    if (!viewerId) {
      const posts = await storage.getExplorePosts(offset, limit, undefined);
      return res.json(posts.map(withPublicAuthor));
    }

    const posts = await storage.getFeedPosts(viewerId, offset, limit);
    res.json(posts.map(withPublicAuthor));
  })
);

r.get(
  "/explore",
  optionalAuth,
  validateRequest(
    z.object({
      // Ignored: see /feed.
      userId: legacyViewerField,
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const { offset, limit } = req.query as unknown as { offset: number; limit: number };
    const posts = await storage.getExplorePosts(offset, limit, viewerIdFrom(req) ?? undefined);
    res.json(posts.map(withPublicAuthor));
  })
);

r.get(
  "/user/:userId",
  optionalAuth,
  validateRequest(
    z.object({
      // Ignored: a caller cannot nominate itself as the viewer of a private account.
      currentUserId: legacyViewerField,
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const { offset, limit } = req.query as unknown as { offset: number; limit: number };
    const viewerId = viewerIdFrom(req);

    // If the profile is private, only the owner or approved followers can view posts
    if (!(await canViewUserContent(viewerId, req.params.userId))) {
      return res.status(403).json({ message: "This account is private" });
    }

    const posts = await storage.getUserPosts(req.params.userId, offset, limit, viewerId ?? undefined);
    res.json(posts.map(withPublicAuthor));
  })
);

r.post("/", requireAuth, async (req, res) => {
  try {
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
      // Accepted for compatibility with older clients and ignored: the author is the authenticated user.
      userId: z.string().optional(),
      caption: z.string().optional(),
      imageUrl: z.string().min(1, "Image URL is required"), // Required, allows data URIs
      additionalImages: z.array(z.string().min(1, "Additional image URL is required")).default([]),
      tags: z.array(z.string()).optional(),
      isRecipe: z.boolean().optional(),
      recipe: recipeSchema.optional(),
    });

    const body = schema.parse(req.body);
    const authorId = req.user!.id;

    // If it's a recipe post, enforce recipe payload
    if (body.isRecipe && !body.recipe) {
      return res.status(400).json({ message: "Recipe details are required for recipe posts" });
    }

    // Safety net: persist any stray data URIs to disk
    body.imageUrl = await persistDataUri(body.imageUrl);
    body.additionalImages = await Promise.all(body.additionalImages.map(persistDataUri));
    if (body.recipe?.imageUrl) {
      body.recipe.imageUrl = await persistDataUri(body.recipe.imageUrl);
    }

    const created = await storage.createPost({
      userId: authorId,
      caption: body.caption,
      imageUrl: body.imageUrl,
      additionalImages: body.additionalImages,
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

r.patch("/:id", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      caption: z.string().optional(),
    });
    const body = schema.parse(req.body);

    // Ownership is the UPDATE predicate: a post that is not the caller's matches nothing, and a post that
    // does not exist is answered exactly the same way, so a foreign post's existence is not disclosed.
    const updated = await storage.updatePostAsOwner(req.params.id, req.user!.id, body);
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
    const postId = req.params.id;
    const userId = req.user!.id; // requireAuth ensures user exists

    // Ownership is carried by the delete itself (`id = ? AND user_id = actor`), so there is no window between
    // an ownership read and the write, and a post belonging to someone else is indistinguishable from a
    // missing one.
    const ok = await storage.deletePost(postId, userId);

    if (!ok) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json({ message: "Post deleted", postId });
  } catch (err: any) {
    console.error("DELETE /api/posts/:id - Error:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

// Get all likes for a specific post.  This route must come before the generic
// "/:id" handler otherwise Express will treat "likes" as the id and never
// reach this handler.
r.get("/:postId/likes", optionalAuth, async (req, res) => {
  try {
    const postId = req.params.postId;

    // Who liked a post is part of that post: a private account's engagement does not leak to outsiders.
    if (!(await getVisiblePost(postId, viewerIdFrom(req)))) {
      return res.status(404).json({ message: "Post not found" });
    }

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
  optionalAuth,
  asyncHandler(async (req, res) => {
    // Knowing a private post's id is not access: an inaccessible post answers as "not found".
    const post = await getVisiblePostWithUser(req.params.id, viewerIdFrom(req));
    if (!post) throw ErrorFactory.notFound("Post not found");
    res.json(withPublicAuthor(post));
  })
);

/**
 * Comments
 */
r.get("/:postId/comments", optionalAuth, async (req, res) => {
  try {
    if (!(await getVisiblePost(req.params.postId, viewerIdFrom(req)))) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comments = await storage.getPostComments(req.params.postId);
    res.json(comments.map(withPublicAuthor));
  } catch (err) {
    console.error("comments/list error", err);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

r.post("/comments", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      // Accepted for compatibility and ignored: the commenter is the authenticated user.
      userId: z.string().optional(),
      postId: z.string(),
      // If provided, this comment becomes a reply to parentId (supports unlimited nesting)
      parentId: z.string().min(1).nullable().optional(),
      text: z.string().min(1),
    });
    const body = schema.parse(req.body);
    const authorId = req.user!.id;

    // You can only comment on a post you are allowed to see.
    if (!(await getVisiblePost(body.postId, authorId))) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (body.parentId) {
      // A reply's parent has to exist and belong to the same post -- no cross-post reply threads.
      const parent = await storage.getComment(body.parentId);
      if (!parent || parent.postId !== body.postId) {
        return res.status(400).json({ message: "Parent comment does not belong to this post" });
      }
    }

    // Map 'text' to 'content' for database
    const created = await storage.createComment({
      userId: authorId,
      postId: body.postId,
      parentId: body.parentId ?? null,
      content: body.text,
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid comment", errors: err.issues });
    console.error("comments/create error:", err);
    res.status(500).json({ message: "Failed to create comment" });
  }
});

/**
 * Delete a comment. ChefSire's rule, matching the other comment surfaces in this codebase (see
 * routes/meal-social.ts), is author-only: the delete is scoped to the comment's own author. There is no
 * post-owner or moderator deletion anywhere in the product today, so none is introduced here.
 */
r.delete("/comments/:id", requireAuth, async (req, res) => {
  try {
    const ok = await storage.deleteCommentAsAuthor(req.params.id, req.user!.id);
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
r.post("/likes", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      // Accepted for compatibility and ignored: the liker is the authenticated user.
      userId: z.string().optional(),
      postId: z.string(),
    });
    const body = schema.parse(req.body);
    const actorId = req.user!.id;

    if (!(await getVisiblePost(body.postId, actorId))) {
      return res.status(404).json({ message: "Post not found" });
    }

    const like = await storage.likePost(actorId, body.postId);
    res.status(201).json(like);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid like data", errors: err.issues });
    console.error("likes/create error", err);
    res.status(500).json({ message: "Failed to like post" });
  }
});

// `/likes/:postId` is the canonical shape. `/likes/:userId/:postId` is kept so existing clients keep working;
// its `:userId` segment is ignored -- the like removed is always the authenticated caller's own.
r.delete(["/likes/:postId", "/likes/:userId/:postId"], requireAuth, async (req, res) => {
  try {
    const ok = await storage.unlikePost(req.user!.id, req.params.postId);
    if (!ok) return res.status(404).json({ message: "Like not found" });
    res.json({ message: "Post unliked" });
  } catch (err) {
    console.error("likes/delete error", err);
    res.status(500).json({ message: "Failed to unlike post" });
  }
});

// Like status is "did *I* like this": the viewer is the authenticated caller, never the legacy `:userId`
// segment, which is ignored.
r.get(["/likes/:postId", "/likes/:userId/:postId"], optionalAuth, async (req, res) => {
  try {
    const viewerId = viewerIdFrom(req);
    if (!(await getVisiblePost(req.params.postId, viewerId))) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (!viewerId) return res.json({ isLiked: false });

    const isLiked = await storage.isPostLiked(viewerId, req.params.postId);
    res.json({ isLiked });
  } catch (err) {
    console.error("likes/check error", err);
    res.status(500).json({ message: "Failed to check like status" });
  }
});

/**
 * Comment Likes endpoints
 */
// Like a comment
r.post("/comments/likes", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      // Accepted for compatibility and ignored: the liker is the authenticated user.
      userId: z.string().optional(),
      commentId: z.string(),
    });
    const body = schema.parse(req.body);
    const actorId = req.user!.id;

    if (!(await getVisibleCommentContext(body.commentId, actorId))) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const like = await storage.likeComment(actorId, body.commentId);
    res.status(201).json(like);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid like data", errors: err.issues });
    console.error("comments/likes/create error", err);
    res.status(500).json({ message: "Failed to like comment" });
  }
});

// Unlike a comment -- the legacy `:userId` segment is ignored; the like removed is the caller's own.
r.delete(["/comments/likes/:commentId", "/comments/likes/:userId/:commentId"], requireAuth, async (req, res) => {
  try {
    const ok = await storage.unlikeComment(req.user!.id, req.params.commentId);
    if (!ok) return res.status(404).json({ message: "Like not found" });
    res.json({ message: "Comment unliked" });
  } catch (err) {
    console.error("comments/likes/delete error", err);
    res.status(500).json({ message: "Failed to unlike comment" });
  }
});

// Check if a comment is liked -- by the authenticated viewer, never by the legacy `:userId` segment.
r.get(["/comments/likes/:commentId", "/comments/likes/:userId/:commentId"], optionalAuth, async (req, res) => {
  try {
    const viewerId = viewerIdFrom(req);
    if (!(await getVisibleCommentContext(req.params.commentId, viewerId))) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (!viewerId) return res.json({ isLiked: false });

    const isLiked = await storage.isCommentLiked(viewerId, req.params.commentId);
    res.json({ isLiked });
  } catch (err) {
    console.error("comments/likes/check error", err);
    res.status(500).json({ message: "Failed to check comment like status" });
  }
});

// List all likes on a comment
r.get("/comments/:commentId/likes", optionalAuth, async (req, res) => {
  try {
    const commentId = req.params.commentId;

    if (!(await getVisibleCommentContext(commentId, viewerIdFrom(req)))) {
      return res.status(404).json({ message: "Comment not found" });
    }

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
 *
 * The follower is the authenticated caller. `followerId` in the body and `:followerId` in the path are legacy
 * shape and are ignored -- a caller can pick who to follow, never who is doing the following.
 */
r.post("/follows", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      // Accepted for compatibility and ignored.
      followerId: z.string().optional(),
      followingId: z.string(),
    });
    const body = schema.parse(req.body);
    const followerId = req.user!.id;

    if (body.followingId === followerId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    // Private accounts get a pending follow request instead of an immediate follow.
    const outcome = await followOrRequest(followerId, body.followingId);
    res.status(201).json(outcome);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ message: "Invalid follow data", errors: err.issues });
    if (err?.status === 404) return res.status(404).json({ message: "User not found" });
    console.error("follows/create error", err);
    res.status(500).json({ message: "Failed to follow user" });
  }
});

r.delete("/follows/:followerId/:followingId", requireAuth, async (req, res) => {
  try {
    const ok = await storage.unfollowUser(req.user!.id, req.params.followingId);
    if (!ok) return res.status(404).json({ message: "Follow relationship not found" });
    res.json({ message: "User unfollowed" });
  } catch (err) {
    console.error("follows/delete error", err);
    res.status(500).json({ message: "Failed to unfollow user" });
  }
});

// "Am I following this user?" -- the follower side is the authenticated caller, so this cannot be used to
// enumerate other people's relationships.
r.get("/follows/:followerId/:followingId", requireAuth, async (req, res) => {
  try {
    const isFollowing = await storage.isFollowing(req.user!.id, req.params.followingId);
    res.json({ isFollowing });
  } catch (err) {
    console.error("follows/check error", err);
    res.status(500).json({ message: "Failed to check follow status" });
  }
});

export default r;
