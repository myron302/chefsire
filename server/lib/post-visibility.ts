// server/lib/post-visibility.ts
//
// The single authoritative answer to "may this viewer see this post?".
//
// ChefSire's privacy model is account-level: a post is visible when its author's account is public, when the
// viewer IS the author, or when the viewer is an approved follower of a private author (a `follows` row, which
// for a private account is only ever created by accepting a follow request). There is no per-post visibility
// column today; if one is added, this module is the one place that has to learn about it.
//
// Two shapes of the same rule live here so list queries and direct-resource reads cannot drift apart:
//   - `visiblePostsCondition(viewerId)` — a SQL predicate for list queries (feed, explore, a user's posts).
//   - `canViewUserContent` / `getVisiblePost` / `getVisibleCommentContext` — row-level checks for direct reads
//     and for the writes that are only allowed on content the actor can actually see.
//
// The viewer is ALWAYS the authenticated identity (`req.user?.id` via `optionalAuth`/`requireAuth`). A viewer id
// that arrives in a query string, a body, or a path parameter is never an identity — see `viewerIdFrom`.

import type { Request } from "express";
import { eq, isNull, or, sql } from "drizzle-orm";
import { follows, posts, users } from "../../shared/schema";
import type { Comment, Post, PostWithUser } from "../../shared/schema";

/**
 * The viewer for a request: the validated authenticated identity, or null for an anonymous caller.
 *
 * This is the ONLY way a route may learn who is looking. `?currentUserId=`, `req.body.userId` and
 * `/:userId` path segments identify targets at most, never the viewer.
 */
export function viewerIdFrom(req: Request): string | null {
  const id = (req.user as { id?: string } | undefined)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * SQL predicate selecting the posts `viewerId` may see. Written against `posts` joined to its author `users`
 * row, which is how every post list query in storage is already shaped.
 */
export function visiblePostsCondition(viewerId?: string | null) {
  const authorIsPublic = or(eq(users.isPrivate, false), isNull(users.isPrivate));

  if (!viewerId) return authorIsPublic;

  return or(
    authorIsPublic,
    eq(posts.userId, viewerId),
    sql`EXISTS (SELECT 1 FROM ${follows} WHERE ${follows.followerId} = ${viewerId} AND ${follows.followingId} = ${posts.userId})`
  );
}

/**
 * May `viewerId` see content owned by `ownerId`? Owner always can; a public account is open to everyone
 * including anonymous callers; a private account is open only to its approved followers.
 */
export async function canViewUserContent(
  viewerId: string | null | undefined,
  ownerId: string
): Promise<boolean> {
  if (!ownerId) return false;
  if (viewerId && viewerId === ownerId) return true;

  // Imported lazily: storage imports this module for `visiblePostsCondition`, and a static import back would
  // make that a cycle. The module is cached after the first call.
  const { storage } = await import("../storage");

  const owner = await storage.getUser(ownerId);
  if (!owner) return false;
  if (!owner.isPrivate) return true;
  if (!viewerId) return false;

  return storage.isFollowing(viewerId, ownerId);
}

/** The post, if `viewerId` is allowed to see it; null when it does not exist OR is not visible. */
export async function getVisiblePost(postId: string, viewerId: string | null): Promise<Post | null> {
  const { storage } = await import("../storage");
  const post = await storage.getPost(postId);
  if (!post) return null;
  return (await canViewUserContent(viewerId, post.userId)) ? post : null;
}

/** Same rule, returning the joined projection used by the post detail route. */
export async function getVisiblePostWithUser(
  postId: string,
  viewerId: string | null
): Promise<PostWithUser | null> {
  const { storage } = await import("../storage");
  const post = await storage.getPostWithUser(postId);
  if (!post) return null;
  return (await canViewUserContent(viewerId, post.userId)) ? post : null;
}

/**
 * A comment plus the post it hangs off, if the viewer may see that post. Comments, comment likes and reply
 * parents all inherit the visibility of their post — knowing a comment id must not be a way around it.
 */
export async function getVisibleCommentContext(
  commentId: string,
  viewerId: string | null
): Promise<{ comment: Comment; post: Post } | null> {
  const { storage } = await import("../storage");
  const comment = await storage.getComment(commentId);
  if (!comment) return null;
  const post = await getVisiblePost(comment.postId, viewerId);
  if (!post) return null;
  return { comment, post };
}
