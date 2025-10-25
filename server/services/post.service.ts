// server/services/post.service.ts
import { eq, desc, sql } from "drizzle-orm";
import {
  posts,
  users,
  recipes,
  likes,
  comments,
  follows,
  type Post,
  type InsertPost,
  type PostWithUser,
  type Like,
  type InsertLike,
  type Comment,
  type InsertComment,
  type CommentWithUser,
  type Follow,
  type InsertFollow,
} from "@shared/schema";

/**
 * PostService - Handles all post-related database operations
 * Includes posts, likes, comments, and follows
 */
export class PostService {
  /**
   * Get post by ID
   */
  static async getPost(db: any, id: string): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return result[0];
  }

  /**
   * Get post with user and recipe data
   */
  static async getPostWithUser(db: any, id: string): Promise<PostWithUser | undefined> {
    const result = await db
      .select({ post: posts, user: users, recipe: recipes })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(recipes, eq(recipes.postId, posts.id))
      .where(eq(posts.id, id))
      .limit(1);

    if (!result[0]) return undefined;
    return { ...result[0].post, user: result[0].user, recipe: result[0].recipe || undefined };
  }

  /**
   * Create a new post
   */
  static async createPost(db: any, insertPost: InsertPost): Promise<Post> {
    const result = await db.insert(posts).values(insertPost).returning();

    // Increment user's posts count
    await db
      .update(users)
      .set({ postsCount: sql`${users.postsCount} + 1` })
      .where(eq(users.id, insertPost.userId));

    return result[0];
  }

  /**
   * Update post
   */
  static async updatePost(db: any, id: string, updates: Partial<Post>): Promise<Post | undefined> {
    const result = await db.update(posts).set(updates).where(eq(posts.id, id)).returning();
    return result[0];
  }

  /**
   * Delete post
   */
  static async deletePost(db: any, id: string): Promise<boolean> {
    const result = await db.delete(posts).where(eq(posts.id, id)).returning();
    if (result[0]) {
      // Decrement user's posts count
      await db
        .update(users)
        .set({ postsCount: sql`${users.postsCount} - 1` })
        .where(eq(users.id, result[0].userId));
      return true;
    }
    return false;
  }

  /**
   * Get feed posts (chronological)
   */
  static async getFeedPosts(
    db: any,
    userId: string,
    offset = 0,
    limit = 10
  ): Promise<PostWithUser[]> {
    const result = await db
      .select({ post: posts, user: users, recipe: recipes })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(recipes, eq(recipes.postId, posts.id))
      .orderBy(desc(posts.createdAt))
      .offset(offset)
      .limit(limit);

    return result.map((row) => ({ ...row.post, user: row.user, recipe: row.recipe || undefined }));
  }

  /**
   * Get posts by specific user
   */
  static async getUserPosts(
    db: any,
    userId: string,
    offset = 0,
    limit = 10
  ): Promise<PostWithUser[]> {
    const result = await db
      .select({ post: posts, user: users, recipe: recipes })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(recipes, eq(recipes.postId, posts.id))
      .where(eq(posts.userId, userId))
      .orderBy(desc(posts.createdAt))
      .offset(offset)
      .limit(limit);

    return result.map((row) => ({ ...row.post, user: row.user, recipe: row.recipe || undefined }));
  }

  /**
   * Get explore posts (same as feed but public)
   */
  static async getExplorePosts(
    db: any,
    offset = 0,
    limit = 10
  ): Promise<PostWithUser[]> {
    return this.getFeedPosts(db, "", offset, limit);
  }

  // ========== LIKES ==========

  /**
   * Like a post
   */
  static async likePost(db: any, userId: string, postId: string): Promise<Like> {
    const result = await db
      .insert(likes)
      .values({ userId, postId })
      .returning();

    // Increment post likes count
    await db
      .update(posts)
      .set({ likesCount: sql`${posts.likesCount} + 1` })
      .where(eq(posts.id, postId));

    return result[0];
  }

  /**
   * Unlike a post
   */
  static async unlikePost(db: any, userId: string, postId: string): Promise<boolean> {
    const result = await db
      .delete(likes)
      .where(sql`${likes.userId} = ${userId} AND ${likes.postId} = ${postId}`)
      .returning();

    if (result[0]) {
      // Decrement post likes count
      await db
        .update(posts)
        .set({ likesCount: sql`${posts.likesCount} - 1` })
        .where(eq(posts.id, postId));
      return true;
    }
    return false;
  }

  /**
   * Check if user liked a post
   */
  static async isPostLiked(db: any, userId: string, postId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(likes)
      .where(sql`${likes.userId} = ${userId} AND ${likes.postId} = ${postId}`)
      .limit(1);
    return result.length > 0;
  }

  /**
   * Get all likes for a post
   */
  static async getPostLikes(db: any, postId: string): Promise<Like[]> {
    return db.select().from(likes).where(eq(likes.postId, postId));
  }

  // ========== COMMENTS ==========

  /**
   * Get comment by ID
   */
  static async getComment(db: any, id: string): Promise<Comment | undefined> {
    const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return result[0];
  }

  /**
   * Create a comment
   */
  static async createComment(db: any, insertComment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(insertComment).returning();

    // Increment post comments count
    await db
      .update(posts)
      .set({ commentsCount: sql`${posts.commentsCount} + 1` })
      .where(eq(posts.id, insertComment.postId));

    return result[0];
  }

  /**
   * Delete a comment
   */
  static async deleteComment(db: any, id: string): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    if (result[0]) {
      // Decrement post comments count
      await db
        .update(posts)
        .set({ commentsCount: sql`${posts.commentsCount} - 1` })
        .where(eq(posts.id, result[0].postId));
      return true;
    }
    return false;
  }

  /**
   * Get comments for a post with user data
   */
  static async getPostComments(db: any, postId: string): Promise<CommentWithUser[]> {
    const result = await db
      .select({ comment: comments, user: users })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));

    return result.map((row) => ({ ...row.comment, user: row.user }));
  }

  // ========== FOLLOWS ==========

  /**
   * Follow a user
   */
  static async followUser(db: any, followerId: string, followingId: string): Promise<Follow> {
    const result = await db
      .insert(follows)
      .values({ followerId, followingId })
      .returning();

    // Update follower counts
    await db
      .update(users)
      .set({ followingCount: sql`${users.followingCount} + 1` })
      .where(eq(users.id, followerId));

    await db
      .update(users)
      .set({ followersCount: sql`${users.followersCount} + 1` })
      .where(eq(users.id, followingId));

    return result[0];
  }

  /**
   * Unfollow a user
   */
  static async unfollowUser(db: any, followerId: string, followingId: string): Promise<boolean> {
    const result = await db
      .delete(follows)
      .where(sql`${follows.followerId} = ${followerId} AND ${follows.followingId} = ${followingId}`)
      .returning();

    if (result[0]) {
      // Update follower counts
      await db
        .update(users)
        .set({ followingCount: sql`${users.followingCount} - 1` })
        .where(eq(users.id, followerId));

      await db
        .update(users)
        .set({ followersCount: sql`${users.followersCount} - 1` })
        .where(eq(users.id, followingId));

      return true;
    }
    return false;
  }

  /**
   * Check if user is following another user
   */
  static async isFollowing(db: any, followerId: string, followingId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(follows)
      .where(sql`${follows.followerId} = ${followerId} AND ${follows.followingId} = ${followingId}`)
      .limit(1);
    return result.length > 0;
  }

  /**
   * Get user's followers
   */
  static async getFollowers(db: any, userId: string): Promise<any[]> {
    const result = await db
      .select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));

    return result.map((row) => row.user);
  }

  /**
   * Get users that a user is following
   */
  static async getFollowing(db: any, userId: string): Promise<any[]> {
    const result = await db
      .select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));

    return result.map((row) => row.user);
  }
}
