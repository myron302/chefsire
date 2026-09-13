// server/lib/social-follow.ts
//
// One implementation of "user A starts following user B", so every follow entry point obeys the same
// private-account rule: a public account is followed immediately, a private account only ever gains a PENDING
// follow request that its owner has to accept. An approved follow is what unlocks a private account's posts
// (see lib/post-visibility.ts), so any path that inserted a follow row directly would hand out that access.
//
// The follower is always the caller's authenticated identity: this helper takes it as an argument and never
// reads it from a request.

import { storage } from "../storage";
import {
  sendFollowRequestNotification,
  sendNewFollowerNotification,
} from "../services/notification-service";

export type FollowOutcome =
  | { status: "following" }
  | { status: "requested"; requestId: string | null };

/**
 * Follow `targetId` as `followerId`, or open a follow request when the target account is private.
 * Callers are expected to have rejected self-follows first. A missing target throws with `status: 404`.
 */
export async function followOrRequest(followerId: string, targetId: string): Promise<FollowOutcome> {
  const target = await storage.getUser(targetId);
  if (!target) throw Object.assign(new Error("User not found"), { status: 404 });

  // Already following: nothing to do, and nothing to notify about.
  if (await storage.isFollowing(followerId, targetId)) {
    return { status: "following" };
  }

  if (target.isPrivate) {
    const requestId = await storage.createFollowRequestIfAbsent(followerId, targetId);
    await notify(followerId, (name, avatar) =>
      sendFollowRequestNotification(targetId, followerId, name, avatar)
    );
    return { status: "requested", requestId };
  }

  // Public account → follow immediately. `followUser` is idempotent, so a duplicate is a no-op.
  await storage.followUser(followerId, targetId);
  await notify(followerId, (name, avatar) =>
    sendNewFollowerNotification(targetId, followerId, name, avatar)
  );

  return { status: "following" };
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
