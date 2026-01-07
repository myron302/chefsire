// server/routes/follows.ts
import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import { follows, followRequests, users } from "../../shared/schema";
import { requireAuth } from "../middleware";
import { storage } from "../storage";
import {
  sendFollowRequestNotification,
  sendFollowAcceptedNotification,
  sendNewFollowerNotification,
} from "../services/notification-service";

const r = Router();

/**
 * GET /api/follows/status/:targetId
 * Returns whether the current user is following / has a pending request.
 */
r.get("/status/:targetId", requireAuth, async (req, res) => {
  const viewerId = req.user!.id;
  const targetId = req.params.targetId;

  if (!targetId) return res.status(400).json({ message: "targetId is required" });

  const target = await db
    .select({ id: users.id, isPrivate: users.isPrivate })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!target[0]) return res.status(404).json({ message: "User not found" });

  const isFollowing = viewerId === targetId ? false : await storage.isFollowing(viewerId, targetId);

  const pending = await db
    .select({ id: followRequests.id })
    .from(followRequests)
    .where(
      and(
        eq(followRequests.requesterId, viewerId),
        eq(followRequests.targetId, targetId),
        eq(followRequests.status, "pending")
      )
    )
    .limit(1);

  return res.json({
    isPrivate: !!target[0].isPrivate,
    isFollowing,
    isRequested: !!pending[0],
    requestId: pending[0]?.id || null,
  });
});

/**
 * POST /api/follows/:targetId
 * - If target is public: creates a follow immediately.
 * - If target is private: creates a follow request (pending).
 */
r.post("/:targetId", requireAuth, async (req, res) => {
  const followerId = req.user!.id;
  const targetId = req.params.targetId;

  if (!targetId) return res.status(400).json({ message: "targetId is required" });
  if (targetId === followerId) return res.status(400).json({ message: "You cannot follow yourself" });

  const target = await db
    .select({ id: users.id, isPrivate: users.isPrivate })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!target[0]) return res.status(404).json({ message: "User not found" });

  // If already following, just return status
  const alreadyFollowing = await storage.isFollowing(followerId, targetId);
  if (alreadyFollowing) {
    return res.json({ status: "following" });
  }

  if (target[0].isPrivate) {
    // Create a pending request (ignore duplicates)
    try {
      await db.insert(followRequests).values({
        requesterId: followerId,
        targetId,
        status: "pending",
      });
    } catch {
      // ignore (likely unique constraint on pending)
    }

    const pending = await db
      .select({ id: followRequests.id })
      .from(followRequests)
      .where(
        and(
          eq(followRequests.requesterId, followerId),
          eq(followRequests.targetId, targetId),
          eq(followRequests.status, "pending")
        )
      )
      .limit(1);

    // Send notification to target user
    const requester = await db
      .select({ username: users.username, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, followerId))
      .limit(1);

    if (requester[0]) {
      sendFollowRequestNotification(
        targetId,
        followerId,
        requester[0].username,
        requester[0].avatar
      );
    }

    return res.json({ status: "requested", requestId: pending[0]?.id || null });
  }

  // Public account → follow immediately
  try {
    await storage.followUser(followerId, targetId);

    // Send notification to target user
    const follower = await db
      .select({ username: users.username, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, followerId))
      .limit(1);

    if (follower[0]) {
      sendNewFollowerNotification(
        targetId,
        followerId,
        follower[0].username,
        follower[0].avatar
      );
    }
  } catch {
    // ignore duplicate follows
  }
  return res.json({ status: "following" });
});

/**
 * DELETE /api/follows/:targetId
 * - If following: unfollow
 * - If requested: cancel request
 */
r.delete("/:targetId", requireAuth, async (req, res) => {
  const followerId = req.user!.id;
  const targetId = req.params.targetId;

  if (!targetId) return res.status(400).json({ message: "targetId is required" });
  if (targetId === followerId) return res.status(400).json({ message: "Invalid target" });

  const isFollowing = await storage.isFollowing(followerId, targetId);
  if (isFollowing) {
    await storage.unfollowUser(followerId, targetId);
    return res.json({ status: "unfollowed" });
  }

  // cancel pending request
  await db
    .update(followRequests)
    .set({ status: "canceled", respondedAt: new Date() })
    .where(
      and(
        eq(followRequests.requesterId, followerId),
        eq(followRequests.targetId, targetId),
        eq(followRequests.status, "pending")
      )
    );

  return res.json({ status: "canceled" });
});

/**
 * GET /api/follows/requests/incoming
 * List pending follow requests for the current user (private accounts).
 */
r.get("/requests/incoming", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 100);
  const offset = Math.max(parseInt((req.query.offset as string) || "0", 10), 0);

  const rows = await db
    .select({
      requestId: followRequests.id,
      createdAt: followRequests.createdAt,
      requester: users,
    })
    .from(followRequests)
    .innerJoin(users, eq(users.id, followRequests.requesterId))
    .where(and(eq(followRequests.targetId, userId), eq(followRequests.status, "pending")))
    .orderBy(desc(followRequests.createdAt))
    .limit(limit)
    .offset(offset);

  return res.json({
    requests: rows.map((r) => ({
      id: r.requestId,
      createdAt: r.createdAt,
      requester: r.requester,
    })),
  });
});

/**
 * POST /api/follows/requests/:requestId/accept
 * Accept a follow request: mark accepted + create follow.
 */
r.post("/requests/:requestId/accept", requireAuth, async (req, res) => {
  const targetUserId = req.user!.id;
  const requestId = req.params.requestId;

  const reqRow = await db
    .select()
    .from(followRequests)
    .where(eq(followRequests.id, requestId))
    .limit(1);

  const fr = reqRow[0];
  if (!fr) return res.status(404).json({ message: "Request not found" });
  if (fr.targetId !== targetUserId) return res.status(403).json({ message: "Not allowed" });
  if (fr.status !== "pending") return res.status(400).json({ message: "Request is not pending" });

  await db
    .update(followRequests)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(eq(followRequests.id, requestId));

  try {
    await storage.followUser(fr.requesterId, fr.targetId);
  } catch {
    // ignore if already following
  }

  // Send notification to requester that their request was accepted
  const accepter = await db
    .select({ username: users.username, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (accepter[0]) {
    sendFollowAcceptedNotification(
      fr.requesterId,
      targetUserId,
      accepter[0].username,
      accepter[0].avatar
    );
  }

  return res.json({ status: "accepted" });
});

/**
 * POST /api/follows/requests/:requestId/decline
 */
r.post("/requests/:requestId/decline", requireAuth, async (req, res) => {
  const targetUserId = req.user!.id;
  const requestId = req.params.requestId;

  const reqRow = await db
    .select()
    .from(followRequests)
    .where(eq(followRequests.id, requestId))
    .limit(1);

  const fr = reqRow[0];
  if (!fr) return res.status(404).json({ message: "Request not found" });
  if (fr.targetId !== targetUserId) return res.status(403).json({ message: "Not allowed" });
  if (fr.status !== "pending") return res.status(400).json({ message: "Request is not pending" });

  await db
    .update(followRequests)
    .set({ status: "declined", respondedAt: new Date() })
    .where(eq(followRequests.id, requestId));

  return res.json({ status: "declined" });
});

export default r;
