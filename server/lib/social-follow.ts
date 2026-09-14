// server/lib/social-follow.ts
//
// One implementation of the follow relationship, so every entry point obeys the same private-account rule:
// a public account is followed immediately, a private account only ever gains a PENDING follow request that
// its owner has to accept. An approved follow is what unlocks a private account's posts (see
// lib/post-visibility.ts), so any path that inserted a follow row directly would hand out that access.
//
// There are three states, and all three are authoritative here rather than re-derived per surface:
//
//   none       -- no follow, no pending request
//   requested  -- a pending follow request against a private account
//   following  -- an established follow
//
// Collapsing "requested" into "not following" is the bug this module exists to prevent: the caller cannot
// tell that their request is already in flight, so they re-request, and they have no way to cancel it.
//
// The actor is always the caller's authenticated identity: these helpers take it as an argument and never
// read it from a request.

import { storage } from "../storage";
import {
  sendFollowRequestNotification,
  sendNewFollowerNotification,
} from "../services/notification-service";

export type FollowOutcome =
  | { status: "following" }
  | { status: "requested"; requestId: string | null };

export type UnfollowOutcome = { status: "unfollowed" | "canceled" | "none" };

/** The full relationship, in the shape /api/follows/status has always reported it. */
export type FollowRelationship = {
  isPrivate: boolean;
  isFollowing: boolean;
  isRequested: boolean;
  requestId: string | null;
};

const notFound = () => Object.assign(new Error("User not found"), { status: 404 });

/**
 * Follow `targetId` as `followerId`, or open a follow request when the target account is private.
 * Callers are expected to have rejected self-follows first. A missing target throws with `status: 404`.
 */
export async function followOrRequest(followerId: string, targetId: string): Promise<FollowOutcome> {
  const target = await storage.getUser(targetId);
  if (!target) throw notFound();

  // Already following: nothing to do, and nothing to notify about.
  if (await storage.isFollowing(followerId, targetId)) {
    return { status: "following" };
  }

  if (target.isPrivate) {
    // Idempotent: a repeat or concurrent request reuses the pending row instead of failing on the partial
    // unique index, and only the call that actually created it notifies the target.
    const request = await storage.createFollowRequestIfAbsent(followerId, targetId);
    if (request.created) {
      await notify(followerId, (name, avatar) =>
        sendFollowRequestNotification(targetId, followerId, name, avatar)
      );
    }
    return { status: "requested", requestId: request.id };
  }

  // Public account → follow immediately. `followUser` is idempotent, so a duplicate is a no-op.
  await storage.followUser(followerId, targetId);
  await notify(followerId, (name, avatar) =>
    sendNewFollowerNotification(targetId, followerId, name, avatar)
  );

  return { status: "following" };
}

/**
 * The one way out of the relationship, whichever state it is in: drop an established follow, or withdraw a
 * pending request. Both are scoped to `followerId`, so a caller can only ever undo their own relationship.
 */
export async function unfollowOrCancelRequest(
  followerId: string,
  targetId: string
): Promise<UnfollowOutcome> {
  if (await storage.unfollowUser(followerId, targetId)) {
    return { status: "unfollowed" };
  }
  if (await storage.cancelFollowRequest(followerId, targetId)) {
    return { status: "canceled" };
  }
  return { status: "none" };
}

/**
 * The authoritative state of `viewerId`'s relationship with `targetId`. Every surface reports follows from
 * here, so none of them can quietly answer "not following" while a request is pending.
 */
export async function followRelationship(
  viewerId: string,
  targetId: string
): Promise<FollowRelationship> {
  const target = await storage.getUser(targetId);
  if (!target) throw notFound();

  const isSelf = viewerId === targetId;
  const isFollowing = isSelf ? false : await storage.isFollowing(viewerId, targetId);
  const pending = isSelf || isFollowing ? undefined : await storage.getPendingFollowRequest(viewerId, targetId);

  return {
    isPrivate: !!target.isPrivate,
    isFollowing,
    isRequested: !!pending,
    requestId: pending?.id ?? null,
  };
}

/** Notifications are best effort: failing to tell someone must not fail the follow itself. */
async function notify(
  followerId: string,
  send: (name: string, avatar: string | null) => unknown
): Promise<void> {
  try {
    const follower = await storage.getUser(followerId);
    await send(follower?.username ?? "Someone", follower?.avatar ?? null);
  } catch (err) {
    console.error("follow notification error", err);
  }
}
