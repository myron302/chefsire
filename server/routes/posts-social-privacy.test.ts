/**
 * Privacy regression tests for the social posts router.
 *
 * The cast, throughout: P is a private account, F is an approved follower of P, O is an outsider, and there is
 * an anonymous caller. The rule is that P's content reaches P and F only -- and that knowing an id (a post's,
 * a comment's) is not a way around it, on ANY of the direct-resource routes, not just the profile listing.
 *
 * As in the authorization suite these are real HTTP requests with only `storage` replaced, so anything that
 * reaches the fake database is something the router decided to allow.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { PgDialect } from "drizzle-orm/pg-core";
import postsRouter from "./posts";
import { storage } from "../storage";
import { visiblePostsCondition } from "../lib/post-visibility";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SECRET =
  (process.env.JWT_SECRET || process.env.SESSION_SECRET || "").trim() || "CHEFSIRE_DEV_FALLBACK_SECRET";
const auth = (userId: string) => ({ authorization: `Bearer ${jwt.sign({ id: userId }, SECRET)}` });

/* ------------------------------------------------------------------ the world */

const users: Record<string, any> = {
  P: { id: "P", username: "p", displayName: "P", avatar: null, isPrivate: true },
  F: { id: "F", username: "f", displayName: "F", avatar: null, isPrivate: false },
  O: { id: "O", username: "o", displayName: "O", avatar: null, isPrivate: false },
};

const posts: Record<string, any> = {
  postP: { id: "postP", userId: "P", caption: "private" },
  postF: { id: "postF", userId: "F", caption: "public" },
};

const comments: Record<string, any> = {
  cP: { id: "cP", postId: "postP", userId: "P", content: "private comment", parentId: null },
  cF: { id: "cF", postId: "postF", userId: "F", content: "public comment", parentId: null },
};

// F is an approved follower of P. Nobody else is.
const follows = new Set<string>(["F>P"]);
let listCalls: { method: string; args: any[] }[] = [];

Object.assign(storage as any, {
  getUser: async (id: string) => users[id],
  isFollowing: async (a: string, b: string) => follows.has(`${a}>${b}`),
  getPost: async (id: string) => posts[id],
  getPostWithUser: async (id: string) =>
    posts[id] ? { ...posts[id], user: users[posts[id].userId] } : undefined,
  getComment: async (id: string) => comments[id],
  getPostComments: async (postId: string) => Object.values(comments).filter((c: any) => c.postId === postId),
  getPostLikes: async () => [{ userId: "P", postId: "postP" }],
  getCommentLikes: async () => [{ userId: "P", commentId: "cP" }],
  isPostLiked: async () => true,
  isCommentLiked: async () => true,
  likePost: async (userId: string, postId: string) => ({ id: "like", userId, postId }),
  likeComment: async (userId: string, commentId: string) => ({ id: "like", userId, commentId }),
  createComment: async (comment: any) => ({ id: "c", ...comment }),
  getUserPosts: async (...args: any[]) => {
    listCalls.push({ method: "getUserPosts", args });
    return [];
  },
  getFeedPosts: async (...args: any[]) => {
    listCalls.push({ method: "getFeedPosts", args });
    return [];
  },
  getExplorePosts: async (...args: any[]) => {
    listCalls.push({ method: "getExplorePosts", args });
    return [];
  },
});

const app = express();
app.use(express.json());
app.use("/api/posts", postsRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;

test.after(() => server.close());
test.beforeEach(() => {
  listCalls = [];
});

async function call(
  method: string,
  path: string,
  options: { as?: string; body?: unknown } = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.as ? auth(options.as) : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  // Some routes answer through `asyncHandler`, whose errors reach Express's own error handler (the app mounts
  // no custom one), so the body is not always JSON. Status is what matters there.
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, body: text };
  }
}

/* ------------------------------------------------------------------ the profile listing */

test("a private account's owner can list their own posts", async () => {
  assert.equal((await call("GET", "/api/posts/user/P", { as: "P" })).status, 200);
});

test("an approved follower can list a private account's posts", async () => {
  assert.equal((await call("GET", "/api/posts/user/P", { as: "F" })).status, 200);
});

test("an outsider cannot list a private account's posts", async () => {
  assert.equal((await call("GET", "/api/posts/user/P", { as: "O" })).status, 403);
});

test("an anonymous caller cannot list a private account's posts", async () => {
  assert.equal((await call("GET", "/api/posts/user/P")).status, 403);
});

test("the exploit: an outsider cannot borrow an approved follower's identity via ?currentUserId", async () => {
  const asO = await call("GET", "/api/posts/user/P?currentUserId=F", { as: "O" });
  assert.equal(asO.status, 403);

  // The same query string from a caller with no session at all is equally powerless.
  const anonymous = await call("GET", "/api/posts/user/P?currentUserId=F");
  assert.equal(anonymous.status, 403);
  assert.equal(listCalls.length, 0);
});

test("public profiles stay readable, including without logging in", async () => {
  assert.equal((await call("GET", "/api/posts/user/F")).status, 200);
  assert.equal((await call("GET", "/api/posts/user/F", { as: "O" })).status, 200);
});

test("the viewer handed to storage is the session, never the query string", async () => {
  await call("GET", "/api/posts/user/F?currentUserId=P", { as: "O" });
  assert.equal(listCalls[0].args[3], "O");

  listCalls = [];
  await call("GET", "/api/posts/user/F?currentUserId=P");
  assert.equal(listCalls[0].args[3], undefined);
});

/* ------------------------------------------------------------------ feed and explore */

test("the feed belongs to the session, not to ?userId", async () => {
  await call("GET", "/api/posts/feed?userId=P", { as: "O" });
  assert.deepEqual(listCalls, [{ method: "getFeedPosts", args: ["O", 0, 10] }]);
});

test("an anonymous feed is the anonymous Explore: no viewer is invented from the query string", async () => {
  await call("GET", "/api/posts/feed?userId=P");
  assert.deepEqual(listCalls, [{ method: "getExplorePosts", args: [0, 10, undefined] }]);
});

test("Explore's viewer is the session, not ?userId", async () => {
  await call("GET", "/api/posts/explore?userId=P", { as: "O" });
  assert.deepEqual(listCalls, [{ method: "getExplorePosts", args: [0, 10, "O"] }]);

  listCalls = [];
  await call("GET", "/api/posts/explore?userId=P");
  assert.deepEqual(listCalls, [{ method: "getExplorePosts", args: [0, 10, undefined] }]);
});

/* ------------------------------------------------------------------ direct resources */

test("a private post cannot be read directly by id", async () => {
  assert.equal((await call("GET", "/api/posts/postP", { as: "O" })).status, 404);
  assert.equal((await call("GET", "/api/posts/postP")).status, 404);
});

test("the owner and approved followers can read the private post directly", async () => {
  assert.equal((await call("GET", "/api/posts/postP", { as: "P" })).status, 200);
  assert.equal((await call("GET", "/api/posts/postP", { as: "F" })).status, 200);
});

test("a private post's comments do not leak", async () => {
  assert.equal((await call("GET", "/api/posts/postP/comments", { as: "O" })).status, 404);
  assert.equal((await call("GET", "/api/posts/postP/comments")).status, 404);
  assert.equal((await call("GET", "/api/posts/postP/comments", { as: "F" })).status, 200);
});

test("a private post's likes do not leak", async () => {
  assert.equal((await call("GET", "/api/posts/postP/likes", { as: "O" })).status, 404);
  assert.equal((await call("GET", "/api/posts/postP/likes")).status, 404);
  assert.equal((await call("GET", "/api/posts/postP/likes", { as: "F" })).status, 200);
});

test("like status on a private post does not confirm the post's existence", async () => {
  assert.equal((await call("GET", "/api/posts/likes/O/postP", { as: "O" })).status, 404);
  assert.equal((await call("GET", "/api/posts/likes/postP")).status, 404);
});

test("likes on a comment under a private post do not leak", async () => {
  assert.equal((await call("GET", "/api/posts/comments/cP/likes", { as: "O" })).status, 404);
  assert.equal((await call("GET", "/api/posts/comments/likes/cP", { as: "O" })).status, 404);
  assert.equal((await call("GET", "/api/posts/comments/cP/likes", { as: "F" })).status, 200);
});

test("an outsider cannot comment on, or like, a post they cannot see", async () => {
  assert.equal((await call("POST", "/api/posts/comments", { as: "O", body: { postId: "postP", text: "hi" } })).status, 404);
  assert.equal((await call("POST", "/api/posts/likes", { as: "O", body: { postId: "postP" } })).status, 404);
  assert.equal((await call("POST", "/api/posts/comments/likes", { as: "O", body: { commentId: "cP" } })).status, 404);
});

test("an approved follower can comment on and like the private post", async () => {
  assert.equal((await call("POST", "/api/posts/comments", { as: "F", body: { postId: "postP", text: "hi" } })).status, 201);
  assert.equal((await call("POST", "/api/posts/likes", { as: "F", body: { postId: "postP" } })).status, 201);
  assert.equal((await call("POST", "/api/posts/comments/likes", { as: "F", body: { commentId: "cP" } })).status, 201);
});

test("public content is unaffected", async () => {
  assert.equal((await call("GET", "/api/posts/postF")).status, 200);
  assert.equal((await call("GET", "/api/posts/postF/comments")).status, 200);
  assert.equal((await call("GET", "/api/posts/postF/likes")).status, 200);
  assert.equal((await call("GET", "/api/posts/comments/cF/likes")).status, 200);
});

/* ------------------------------------------------------------------ response projection */

test("the author embedded in social responses carries no credentials or account metadata", async () => {
  const secrets = ["password", "email", "googleId", "facebookId", "instagramId", "tiktokId", "provider", "monthlyRevenue"];
  const authored = { ...users.F, password: "hash", email: "f@example.com", googleId: "g-1", monthlyRevenue: "99" };

  const original = {
    getPostWithUser: (storage as any).getPostWithUser,
    getPostComments: (storage as any).getPostComments,
    getExplorePosts: (storage as any).getExplorePosts,
  };
  test.after(() => Object.assign(storage as any, original));

  Object.assign(storage as any, {
    getPostWithUser: async (id: string) => (posts[id] ? { ...posts[id], user: authored } : undefined),
    getPostComments: async () => [{ ...comments.cF, user: authored }],
    getExplorePosts: async () => [{ ...posts.postF, user: authored }],
  });

  for (const path of ["/api/posts/postF", "/api/posts/postF/comments", "/api/posts/explore"]) {
    const res = await call("GET", path);
    assert.equal(res.status, 200, path);
    const payload = JSON.stringify(res.body);
    for (const secret of secrets) {
      assert.ok(!payload.includes(secret), `${path} leaked ${secret}`);
    }
    // The fields the product does show are still there.
    assert.ok(payload.includes("displayName"), path);
    assert.ok(payload.includes("avatar"), path);
  }
});

/* ------------------------------------------------------------------ the list predicate itself */

const dialect = new PgDialect();
const render = (viewerId?: string | null) => dialect.sqlToQuery(visiblePostsCondition(viewerId) as any);

test("the anonymous list predicate admits only public authors", () => {
  const { sql, params } = render(null);
  assert.match(sql, /"is_private" = \$1/);
  assert.match(sql, /"is_private" is null/);
  assert.deepEqual(params, [false]);
  assert.ok(!/follows/.test(sql), sql);
});

test("a viewer's list predicate also admits their own posts and the accounts they follow", () => {
  const { sql, params } = render("F");
  assert.match(sql, /"is_private"/);
  assert.match(sql, /"posts"\."user_id" = \$/);
  assert.match(sql, /EXISTS \(SELECT 1 FROM "follows"/);
  assert.match(sql, /"follows"\."follower_id" = \$/);
  assert.match(sql, /"follows"\."following_id" = "posts"\."user_id"/);
  assert.ok(params.includes("F"));
});

test("every post list query in storage applies the predicate", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(here, "..", "storage.ts"), "utf8");

  for (const method of ["getFeedPosts", "getUserPosts", "getExplorePosts"]) {
    const start = source.indexOf(`async ${method}(`);
    assert.ok(start > 0, method);
    const body = source.slice(start, source.indexOf("\n  async ", start + 1));
    assert.ok(body.includes("visiblePostsCondition("), `${method} must filter by post visibility`);
  }
});
