// server/routes/follows.ts
import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { users, followRequests, follows } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

const r = Router();

/**
 * POST /api/follows
 * Body: { followerId, followingId }
 * If target user is private, creates a follow request instead
 */
r.post("/", async (req, res, next) => {
  try {
    const { followerId, followingId } = req.body || {};
    if (!followerId || !followingId) {
      return res.status(400).json({ message: "followerId and followingId are required" });
    }

    // Check if target user is private
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, followingId))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // If user is private, create a follow request
    if (targetUser.isPrivate) {
      // Check if request already exists
      const existing = await db
        .select()
        .from(followRequests)
        .where(
          and(
            eq(followRequests.requesterId, followerId),
            eq(followRequests.requestedId, followingId),
            eq(followRequests.status, "pending")
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(200).json({ message: "Follow request already sent", request: existing[0] });
      }

      const [request] = await db
        .insert(followRequests)
        .values({ requesterId: followerId, requestedId: followingId })
        .returning();

      return res.status(201).json({ message: "Follow request sent", request });
    }

    // User is public, follow directly
    const follow = await storage.followUser(followerId, followingId);
    res.status(201).json(follow);
  } catch (error) { next(error); }
});

/**
 * DELETE /api/follows/:followerId/:followingId
 */
r.delete("/:followerId/:followingId", async (req, res, next) => {
  try {
    const ok = await storage.unfollowUser(req.params.followerId, req.params.followingId);
    if (!ok) return res.status(404).json({ message: "Follow relationship not found" });
    res.json({ message: "User unfollowed successfully" });
  } catch (error) { next(error); }
});

/**
 * GET /api/follows/:followerId/:followingId
 * Returns { isFollowing: boolean, requestStatus: string | null }
 */
r.get("/:followerId/:followingId", async (req, res, next) => {
  try {
    const isFollowing = await storage.isFollowing(req.params.followerId, req.params.followingId);

    // Check for pending request
    const [request] = await db
      .select()
      .from(followRequests)
      .where(
        and(
          eq(followRequests.requesterId, req.params.followerId),
          eq(followRequests.requestedId, req.params.followingId),
          eq(followRequests.status, "pending")
        )
      )
      .limit(1);

    res.json({
      isFollowing,
      requestStatus: request ? request.status : null
    });
  } catch (error) { next(error); }
});

/**
 * GET /api/follows/requests/received
 * Get follow requests sent to the current user
 */
r.get("/requests/received", async (req, res, next) => {
  try {
    const userId = (req.query.userId as string) || "";
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const requests = await db
      .select({
        id: followRequests.id,
        requesterId: followRequests.requesterId,
        requestedId: followRequests.requestedId,
        status: followRequests.status,
        createdAt: followRequests.createdAt,
        requester: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        }
      })
      .from(followRequests)
      .innerJoin(users, eq(followRequests.requesterId, users.id))
      .where(
        and(
          eq(followRequests.requestedId, userId),
          eq(followRequests.status, "pending")
        )
      );

    res.json({ requests });
  } catch (error) { next(error); }
});

/**
 * POST /api/follows/requests/:requestId/accept
 * Accept a follow request
 */
r.post("/requests/:requestId/accept", async (req, res, next) => {
  try {
    const { requestId } = req.params;

    // Get the request
    const [request] = await db
      .select()
      .from(followRequests)
      .where(eq(followRequests.id, requestId))
      .limit(1);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    // Create the follow relationship
    await storage.followUser(request.requesterId, request.requestedId);

    // Update request status
    await db
      .update(followRequests)
      .set({ status: "accepted" })
      .where(eq(followRequests.id, requestId));

    res.json({ message: "Follow request accepted" });
  } catch (error) { next(error); }
});

/**
 * POST /api/follows/requests/:requestId/reject
 * Reject a follow request
 */
r.post("/requests/:requestId/reject", async (req, res, next) => {
  try {
    const { requestId } = req.params;

    // Update request status
    const [updated] = await db
      .update(followRequests)
      .set({ status: "rejected" })
      .where(eq(followRequests.id, requestId))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.json({ message: "Follow request rejected" });
  } catch (error) { next(error); }
});

/**
 * DELETE /api/follows/requests/:requestId
 * Cancel a follow request (sent by requester)
 */
r.delete("/requests/:requestId", async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const deleted = await db
      .delete(followRequests)
      .where(eq(followRequests.id, requestId))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.json({ message: "Follow request cancelled" });
  } catch (error) { next(error); }
});

/**
 * GET /api/follows/user/:userId/followers?offset=0&limit=25
 * Lists users who follow :userId
 */
r.get("/user/:userId/followers", async (req, res, next) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit  = Number(req.query.limit ?? 25);

    const all = await storage.getFollowers(req.params.userId);
    const items = all.slice(offset, offset + limit);

    res.json({
      items,
      total: all.length,
      offset,
      limit,
    });
  } catch (error) { next(error); }
});

/**
 * GET /api/follows/user/:userId/following?offset=0&limit=25
 * Lists users that :userId is following
 */
r.get("/user/:userId/following", async (req, res, next) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit  = Number(req.query.limit ?? 25);

    const all = await storage.getFollowing(req.params.userId);
    const items = all.slice(offset, offset + limit);

    res.json({
      items,
      total: all.length,
      offset,
      limit,
    });
  } catch (error) { next(error); }
});

/**
 * GET /api/follows/user/:userId/stats
 * Returns follower/following counts (uses columns if present, otherwise derives)
 */
r.get("/user/:userId/stats", async (req, res, next) => {
  try {
    const user = await storage.getUser(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let followersCount = (user as any).followersCount;
    let followingCount = (user as any).followingCount;

    if (followersCount == null || followingCount == null) {
      // derive if counts aren't stored
      const [followers, following] = await Promise.all([
        storage.getFollowers(req.params.userId),
        storage.getFollowing(req.params.userId),
      ]);
      followersCount = followers.length;
      followingCount = following.length;
    }

    res.json({ followersCount, followingCount });
  } catch (error) { next(error); }
});

export default r;
