// server/routes/follows.ts
import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import { followRequests, users } from "../../shared/schema";
import { requireAuth } from "../middleware";
import { storage } from "../storage";
import { followOrRequest, followRelationship, unfollowOrCancelRequest } from "../lib/social-follow";
import { sendFollowAcceptedNotification } from "../services/notification-service";
import { serializePublicUser } from "../serializers/public-user";

const r = Router();

/**
 * GET /api/follows/status/:targetId
 * Returns whether the current user is following / has a pending request.
 */
r.get("/status/:targetId", requireAuth, async (req, res) => {
  const viewerId = req.user!.id;
  const targetId = req.params.targetId;

  if (!targetId) return res.status(400).json({ message: "targetId is required" });

  try {
    // One authoritative derivation, shared with every other follow surface: a pending request is reported as
    // a pending request, never flattened into "not following".
    return res.json(await followRelationship(viewerId, targetId));
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ message: "User not found" });
    throw err;
  }
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

  try {
    // Shared with every other follow entry point: a private target only ever gets a pending request.
    return res.json(await followOrRequest(followerId, targetId));
  } catch (err: any) {
    if (err?.status === 404) return res.status(404).json({ message: "User not found" });
    throw err;
  }
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

  // Drops an established follow or withdraws a pending request, whichever exists -- always the caller's own.
  return res.json(await unfollowOrCancelRequest(followerId, targetId));
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
    // The joined row is the whole `users` record -- password hash, email and provider ids included -- so the
    // requester goes out through the repository's public projection, same as every other social response.
    requests: rows.map((r) => ({
      id: r.requestId,
      createdAt: r.createdAt,
      requester: serializePublicUser(r.requester),
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

  // The UPDATE carries the responder and the pending status, so it is the authorization AND the guard against
  // two responses racing: exactly one of them resolves the request and goes on to create the follow.
  const accepted = await db
    .update(followRequests)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(
      and(
        eq(followRequests.id, requestId),
        eq(followRequests.targetId, targetUserId),
        eq(followRequests.status, "pending")
      )
    )
    .returning({ id: followRequests.id });

  if (!accepted[0]) return res.status(400).json({ message: "Request is not pending" });

  // Idempotent: a follow that somehow already exists is left alone rather than duplicated.
  await storage.followUser(fr.requesterId, fr.targetId);

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

  // Scoped the same way as accept: only the target can decline, and only while it is still pending.
  const declined = await db
    .update(followRequests)
    .set({ status: "declined", respondedAt: new Date() })
    .where(
      and(
        eq(followRequests.id, requestId),
        eq(followRequests.targetId, targetUserId),
        eq(followRequests.status, "pending")
      )
    )
    .returning({ id: followRequests.id });

  if (!declined[0]) return res.status(400).json({ message: "Request is not pending" });

  return res.json({ status: "declined" });
});

export default r;
