/**
 * The drinks creator-follow surface, held to the same three-state follow model as the rest of ChefSire.
 *
 * The defect this covers: a private creator answers a follow with a pending REQUEST, and the drinks endpoints
 * used to discard that and report `isFollowing: false`. The button then showed plain "Follow" forever, every
 * click posted another request, and there was no way to withdraw one. So these tests assert on the state the
 * API reports -- none / requested / following -- across POST, the status read and DELETE, and on what the
 * cancellation actually did in the store.
 *
 * Real HTTP against the real router; only `storage` is faked, with the same semantics as the SQL (including
 * the actor-scoped cancel and the conflict-tolerant request insert).
 */
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { followOrRequest, followRelationship, unfollowOrCancelRequest } from "../lib/social-follow";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const SECRET = TEST_JWT_SECRET;
const auth = (userId: string) => ({ authorization: `Bearer ${jwt.sign({ id: userId }, SECRET)}` });

/* ------------------------------------------------------------------ the world */

type PendingRequest = { id: string; requesterId: string; targetId: string; status: string };

function freshWorld() {
  return {
    users: {
      V: { id: "V", username: "v", displayName: "V", avatar: null, isPrivate: false, followersCount: 3 },
      W: { id: "W", username: "w", displayName: "W", avatar: null, isPrivate: false, followersCount: 3 },
      PUB: { id: "PUB", username: "pub", displayName: "Public creator", avatar: null, isPrivate: false, followersCount: 10 },
      PRIV: { id: "PRIV", username: "priv", displayName: "Private creator", avatar: null, isPrivate: true, followersCount: 4 },
    } as Record<string, any>,
    follows: new Set<string>(),
    requests: [] as PendingRequest[],
    notifications: [] as { kind: string; target: string; actor: string }[],
    nextRequestId: 1,
  };
}

let world = freshWorld();

const pending = (requesterId: string, targetId: string) =>
  world.requests.find((r) => r.requesterId === requesterId && r.targetId === targetId && r.status === "pending");

Object.assign(storage as any, {
  getUser: async (id: string) => world.users[id],
  isFollowing: async (a: string, b: string) => world.follows.has(`${a}>${b}`),
  followUser: async (followerId: string, followingId: string) => {
    world.follows.add(`${followerId}>${followingId}`);
    return { id: "follow", followerId, followingId };
  },
  unfollowUser: async (followerId: string, followingId: string) => world.follows.delete(`${followerId}>${followingId}`),
  // Mirrors INSERT ... ON CONFLICT DO NOTHING against the partial unique index: at most one pending row per pair.
  createFollowRequestIfAbsent: async (requesterId: string, targetId: string) => {
    const existing = pending(requesterId, targetId);
    if (existing) return { id: existing.id, created: false };
    const row = { id: `req-${world.nextRequestId++}`, requesterId, targetId, status: "pending" };
    world.requests.push(row);
    return { id: row.id, created: true };
  },
  getPendingFollowRequest: async (requesterId: string, targetId: string) => {
    const row = pending(requesterId, targetId);
    return row ? { id: row.id } : undefined;
  },
  // Mirrors the requester-scoped UPDATE.
  cancelFollowRequest: async (requesterId: string, targetId: string) => {
    const row = pending(requesterId, targetId);
    if (!row) return false;
    row.status = "canceled";
    return true;
  },
});

/* The drinks router is enormous and pulls in the whole app; mount only the creator-follow surface, wired the
 * same way drinks.ts wires it, so these tests stay about the follow state machine. */
const { default: drinksRouter } = await import("./drinks");

const app = express();
app.use(express.json());
app.use("/api/drinks", drinksRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;

test.after(() => server.close());
test.beforeEach(() => {
  world = freshWorld();
});

async function call(method: string, path: string, as?: string) {
  const res = await fetch(`${base}${path}`, { method, headers: as ? auth(as) : {} });
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, body: text };
  }
}

const state = (body: any) => ({ isFollowing: !!body?.isFollowing, isRequested: !!body?.isRequested });
const NONE = { isFollowing: false, isRequested: false };
const REQUESTED = { isFollowing: false, isRequested: true };
const FOLLOWING = { isFollowing: true, isRequested: false };

/* ------------------------------------------------------------------ public creator */

test("a public creator: none → follow → following → unfollow → none", async () => {
  const initial = await call("GET", "/api/drinks/creators/PUB/follow-status", "V");
  assert.equal(initial.status, 200);
  assert.deepEqual(state(initial.body), NONE);

  const followed = await call("POST", "/api/drinks/creators/PUB/follow", "V");
  assert.equal(followed.status, 200);
  assert.deepEqual(state(followed.body), FOLLOWING);
  assert.ok(world.follows.has("V>PUB"));

  const reread = await call("GET", "/api/drinks/creators/PUB/follow-status", "V");
  assert.deepEqual(state(reread.body), FOLLOWING);

  const removed = await call("DELETE", "/api/drinks/creators/PUB/follow", "V");
  assert.equal(removed.status, 200);
  assert.deepEqual(state(removed.body), NONE);
  assert.ok(!world.follows.has("V>PUB"));
});

test("the follower count still rides along for the creator cards", async () => {
  const res = await call("GET", "/api/drinks/creators/PUB/follow-status", "V");
  assert.equal(res.body.followerCount, 10);
});

/* ------------------------------------------------------------------ private creator */

test("a private creator: a follow becomes a REQUEST, and the response says so", async () => {
  const initial = await call("GET", "/api/drinks/creators/PRIV/follow-status", "V");
  assert.deepEqual(state(initial.body), NONE);

  const requested = await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  assert.equal(requested.status, 200);
  assert.deepEqual(state(requested.body), REQUESTED);
  assert.equal(requested.body.isPrivate, true);
  assert.ok(requested.body.requestId, "the pending request is identified");

  // No follow row was created: the request has to be accepted first.
  assert.ok(!world.follows.has("V>PRIV"));
  assert.equal(world.requests.filter((r) => r.status === "pending").length, 1);
});

test("the pending state survives a reload -- it is read from the request row, not from React state", async () => {
  await call("POST", "/api/drinks/creators/PRIV/follow", "V");

  const afterReload = await call("GET", "/api/drinks/creators/PRIV/follow-status", "V");
  assert.equal(afterReload.status, 200);
  assert.deepEqual(state(afterReload.body), REQUESTED);
  assert.equal(afterReload.body.requestId, world.requests[0].id);
});

test("clicking Follow again does not open a second request", async () => {
  const first = await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  const second = await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  const third = await call("POST", "/api/drinks/creators/PRIV/follow", "V");

  for (const res of [first, second, third]) {
    assert.equal(res.status, 200);
    assert.deepEqual(state(res.body), REQUESTED);
  }
  assert.equal(world.requests.filter((r) => r.status === "pending").length, 1);
  // Every call reports the same authoritative relationship.
  assert.equal(second.body.requestId, first.body.requestId);
  assert.equal(third.body.requestId, first.body.requestId);
});

test("the pending request can be withdrawn from the drinks surface, and the state returns to none", async () => {
  await call("POST", "/api/drinks/creators/PRIV/follow", "V");

  const canceled = await call("DELETE", "/api/drinks/creators/PRIV/follow", "V");
  assert.equal(canceled.status, 200);
  assert.deepEqual(state(canceled.body), NONE);
  assert.equal(world.requests.filter((r) => r.status === "pending").length, 0);
  assert.equal(world.requests[0].status, "canceled");

  const afterReload = await call("GET", "/api/drinks/creators/PRIV/follow-status", "V");
  assert.deepEqual(state(afterReload.body), NONE);

  // And the viewer can request again afterwards.
  const again = await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  assert.deepEqual(state(again.body), REQUESTED);
});

test("one viewer cannot withdraw another viewer's pending request", async () => {
  await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  assert.equal(world.requests.filter((r) => r.status === "pending").length, 1);

  const byW = await call("DELETE", "/api/drinks/creators/PRIV/follow", "W");
  assert.equal(byW.status, 200);
  assert.deepEqual(state(byW.body), NONE); // W has no relationship of their own

  // V's request is untouched, and V still sees it.
  assert.equal(pending("V", "PRIV")?.status, "pending");
  const vState = await call("GET", "/api/drinks/creators/PRIV/follow-status", "V");
  assert.deepEqual(state(vState.body), REQUESTED);
});

test("once a request is accepted, the creator reads as following rather than requested", async () => {
  await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  // The target accepts: the request is resolved and the follow exists (what routes/follows.ts does).
  world.requests[0].status = "accepted";
  world.follows.add("V>PRIV");

  const res = await call("GET", "/api/drinks/creators/PRIV/follow-status", "V");
  assert.deepEqual(state(res.body), FOLLOWING);

  const removed = await call("DELETE", "/api/drinks/creators/PRIV/follow", "V");
  assert.deepEqual(state(removed.body), NONE);
  assert.ok(!world.follows.has("V>PRIV"));
});

/* ------------------------------------------------------------------ identity */

test("the actor is the session on every drinks follow route", async () => {
  for (const [method, path] of [
    ["POST", "/api/drinks/creators/PRIV/follow"],
    ["DELETE", "/api/drinks/creators/PRIV/follow"],
    ["GET", "/api/drinks/creators/PRIV/follow-status"],
  ] as const) {
    assert.equal((await call(method, path)).status, 401, `${method} ${path}`);
  }

  // V acting produces V's relationship, never anyone else's.
  await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  assert.equal(pending("V", "PRIV")?.requesterId, "V");
  assert.equal(world.requests.length, 1);
});

test("a viewer cannot follow themselves, and a missing creator is a 404", async () => {
  assert.equal((await call("POST", "/api/drinks/creators/V/follow", "V")).status, 400);
  assert.equal((await call("POST", "/api/drinks/creators/nobody/follow", "V")).status, 404);
  assert.equal((await call("GET", "/api/drinks/creators/nobody/follow-status", "V")).status, 404);
});

/* ------------------------------------------------------------------ the shared helpers themselves */

test("the shared helpers are what the surfaces agree on", async () => {
  // followOrRequest reports the outcome that actually happened...
  assert.deepEqual(await followOrRequest("V", "PUB"), { status: "following" });
  const requested = await followOrRequest("W", "PRIV");
  assert.equal(requested.status, "requested");

  // ...followRelationship reads all three states back...
  assert.deepEqual(await followRelationship("V", "PUB"), {
    isPrivate: false,
    isFollowing: true,
    isRequested: false,
    requestId: null,
  });
  assert.deepEqual(await followRelationship("W", "PRIV"), {
    isPrivate: true,
    isFollowing: false,
    isRequested: true,
    requestId: pending("W", "PRIV")!.id,
  });
  assert.deepEqual(await followRelationship("V", "PRIV"), {
    isPrivate: true,
    isFollowing: false,
    isRequested: false,
    requestId: null,
  });

  // ...and unfollowOrCancelRequest names which of the two it undid.
  assert.deepEqual(await unfollowOrCancelRequest("V", "PUB"), { status: "unfollowed" });
  assert.deepEqual(await unfollowOrCancelRequest("W", "PRIV"), { status: "canceled" });
  assert.deepEqual(await unfollowOrCancelRequest("V", "PRIV"), { status: "none" });
});

test("a follow request notifies the target once, not once per click", async () => {
  // The notification is gated on the one call that actually inserted the row, so the dedupe question is
  // "how many times did the store report `created`?" -- exactly once across any number of clicks.
  const create = (storage as any).createFollowRequestIfAbsent;
  const creations: string[] = [];
  (storage as any).createFollowRequestIfAbsent = async (requesterId: string, targetId: string) => {
    const result = await create(requesterId, targetId);
    if (result.created) creations.push(`${requesterId}>${targetId}`);
    return result;
  };
  test.after(() => {
    (storage as any).createFollowRequestIfAbsent = create;
  });

  await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  await call("POST", "/api/drinks/creators/PRIV/follow", "V");
  await call("POST", "/api/drinks/creators/PRIV/follow", "V");

  assert.deepEqual(creations, ["V>PRIV"]);
  assert.equal(world.requests.filter((r) => r.status === "pending").length, 1);

  // And that flag is what the helper actually gates the notification on.
  const helper = fs.readFileSync(path.join(here, "..", "lib", "social-follow.ts"), "utf8");
  assert.match(helper, /if \(request\.created\) \{\s*await notify\(/);
});
