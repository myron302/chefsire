/**
 * Security regression tests for the social posts router: who is allowed to mutate what, and whose identity
 * the server uses when it does.
 *
 * These are real HTTP requests against the real router. Only the persistence layer is replaced -- the
 * `storage` singleton is swapped for an in-memory world with the same semantics (including the owner-scoped
 * writes), so a request that reaches the database at all is a request that got past authorization. Every
 * "A acting as B" case sends B's id exactly the way a hand-written request would, and asserts on what the
 * server actually persisted, not merely on the status code.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import postsRouter from "./posts";
import { storage } from "../storage";

// Same resolution order as middleware/auth.ts, evaluated after the imports above have loaded the env.
const SECRET =
  (process.env.JWT_SECRET || process.env.SESSION_SECRET || "").trim() || "CHEFSIRE_DEV_FALLBACK_SECRET";

const auth = (userId: string) => ({ authorization: `Bearer ${jwt.sign({ id: userId }, SECRET)}` });

/* ------------------------------------------------------------------ the world */

type World = ReturnType<typeof freshWorld>;

function freshWorld() {
  return {
    users: {
      A: { id: "A", username: "a", displayName: "A", avatar: null, isPrivate: false },
      B: { id: "B", username: "b", displayName: "B", avatar: null, isPrivate: false },
      P: { id: "P", username: "p", displayName: "P", avatar: null, isPrivate: true },
    } as Record<string, any>,
    posts: {
      postA: { id: "postA", userId: "A", caption: "by A" },
      postB: { id: "postB", userId: "B", caption: "by B" },
      postP: { id: "postP", userId: "P", caption: "by P" },
    } as Record<string, any>,
    comments: {
      cA: { id: "cA", postId: "postA", userId: "A", content: "A's comment", parentId: null },
      cB: { id: "cB", postId: "postA", userId: "B", content: "B's comment", parentId: null },
      cOnB: { id: "cOnB", postId: "postB", userId: "B", content: "on post B", parentId: null },
    } as Record<string, any>,
    follows: new Set<string>(),
    likes: new Set<string>(),
    commentLikes: new Set<string>(),
    followRequests: new Set<string>(),
    calls: [] as { method: string; args: any[] }[],
  };
}

let world: World = freshWorld();
const record = (method: string, ...args: any[]) => world.calls.push({ method, args });
const callsTo = (method: string) => world.calls.filter((c) => c.method === method);

Object.assign(storage as any, {
  getUser: async (id: string) => world.users[id],
  isFollowing: async (a: string, b: string) => world.follows.has(`${a}>${b}`),

  getPost: async (id: string) => world.posts[id],
  getPostWithUser: async (id: string) =>
    world.posts[id] ? { ...world.posts[id], user: world.users[world.posts[id].userId] } : undefined,
  createPost: async (post: any) => {
    record("createPost", post);
    const created = { id: "created", ...post };
    world.posts[created.id] = created;
    return created;
  },
  createRecipe: async (recipe: any) => ({ id: "recipe", ...recipe }),
  // Mirrors the owner-scoped UPDATE: a post that is not the owner's matches nothing.
  updatePostAsOwner: async (id: string, ownerId: string, updates: any) => {
    record("updatePostAsOwner", id, ownerId, updates);
    const post = world.posts[id];
    if (!post || post.userId !== ownerId) return undefined;
    Object.assign(post, updates);
    return post;
  },
  updatePost: async () => {
    throw new Error("unscoped updatePost must not be used by the router");
  },
  // Mirrors the owner-scoped DELETE.
  deletePost: async (id: string, ownerId?: string) => {
    record("deletePost", id, ownerId);
    const post = world.posts[id];
    if (!post || (ownerId && post.userId !== ownerId)) return false;
    delete world.posts[id];
    return true;
  },

  getComment: async (id: string) => world.comments[id],
  getPostComments: async (postId: string) =>
    Object.values(world.comments).filter((c: any) => c.postId === postId),
  createComment: async (comment: any) => {
    record("createComment", comment);
    const created = { id: "createdComment", ...comment };
    world.comments[created.id] = created;
    return created;
  },
  // Mirrors the author-scoped DELETE.
  deleteCommentAsAuthor: async (id: string, authorId: string) => {
    record("deleteCommentAsAuthor", id, authorId);
    const comment = world.comments[id];
    if (!comment || comment.userId !== authorId) return false;
    delete world.comments[id];
    return true;
  },
  deleteComment: async () => {
    throw new Error("unscoped deleteComment must not be used by the router");
  },

  likePost: async (userId: string, postId: string) => {
    record("likePost", userId, postId);
    world.likes.add(`${userId}|${postId}`);
    return { id: "like", userId, postId };
  },
  unlikePost: async (userId: string, postId: string) => {
    record("unlikePost", userId, postId);
    return world.likes.delete(`${userId}|${postId}`);
  },
  isPostLiked: async (userId: string, postId: string) => {
    record("isPostLiked", userId, postId);
    return world.likes.has(`${userId}|${postId}`);
  },
  getPostLikes: async (postId: string) =>
    [...world.likes].filter((k) => k.endsWith(`|${postId}`)).map((k) => ({ userId: k.split("|")[0], postId })),

  likeComment: async (userId: string, commentId: string) => {
    record("likeComment", userId, commentId);
    world.commentLikes.add(`${userId}|${commentId}`);
    return { id: "commentLike", userId, commentId };
  },
  unlikeComment: async (userId: string, commentId: string) => {
    record("unlikeComment", userId, commentId);
    return world.commentLikes.delete(`${userId}|${commentId}`);
  },
  isCommentLiked: async (userId: string, commentId: string) => {
    record("isCommentLiked", userId, commentId);
    return world.commentLikes.has(`${userId}|${commentId}`);
  },
  getCommentLikes: async (commentId: string) =>
    [...world.commentLikes]
      .filter((k) => k.endsWith(`|${commentId}`))
      .map((k) => ({ userId: k.split("|")[0], commentId })),

  followUser: async (followerId: string, followingId: string) => {
    record("followUser", followerId, followingId);
    world.follows.add(`${followerId}>${followingId}`);
    return { id: "follow", followerId, followingId };
  },
  unfollowUser: async (followerId: string, followingId: string) => {
    record("unfollowUser", followerId, followingId);
    return world.follows.delete(`${followerId}>${followingId}`);
  },
  createFollowRequestIfAbsent: async (requesterId: string, targetId: string) => {
    record("createFollowRequestIfAbsent", requesterId, targetId);
    world.followRequests.add(`${requesterId}>${targetId}`);
    return "request-1";
  },
});

/* ------------------------------------------------------------------ the server */

const app = express();
app.use(express.json());
app.use("/api/posts", postsRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;

test.after(() => server.close());
test.beforeEach(() => {
  world = freshWorld();
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

/* ------------------------------------------------------------------ posts */

test("creating a post requires authentication", async () => {
  const res = await call("POST", "/api/posts", { body: { userId: "A", imageUrl: "x.jpg" } });
  assert.equal(res.status, 401);
  assert.equal(callsTo("createPost").length, 0);
});

test("a post's author is the session, even when the body names someone else", async () => {
  const res = await call("POST", "/api/posts", { as: "A", body: { userId: "B", imageUrl: "x.jpg" } });
  assert.equal(res.status, 201);
  assert.equal(res.body.userId, "A");
  assert.equal(callsTo("createPost")[0].args[0].userId, "A");
});

test("an ordinary authenticated post still works, recipe and all", async () => {
  const res = await call("POST", "/api/posts", {
    as: "A",
    body: {
      imageUrl: "x.jpg",
      caption: "hi",
      isRecipe: true,
      recipe: { title: "Soup", ingredients: ["water"], instructions: ["boil"] },
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.userId, "A");
});

test("editing a post requires authentication", async () => {
  const res = await call("PATCH", "/api/posts/postA", { body: { caption: "hacked" } });
  assert.equal(res.status, 401);
  assert.equal(world.posts.postA.caption, "by A");
});

test("a user cannot edit someone else's post, and is not told it exists", async () => {
  const res = await call("PATCH", "/api/posts/postB", { as: "A", body: { caption: "hacked" } });
  assert.equal(res.status, 404);
  assert.equal(world.posts.postB.caption, "by B");
  // Same answer as a post that does not exist at all.
  const missing = await call("PATCH", "/api/posts/nope", { as: "A", body: { caption: "hacked" } });
  assert.equal(missing.status, 404);
  assert.deepEqual(res.body, missing.body);
});

test("a user can edit their own post, through the owner-scoped update", async () => {
  const res = await call("PATCH", "/api/posts/postA", { as: "A", body: { caption: "edited" } });
  assert.equal(res.status, 200);
  assert.equal(world.posts.postA.caption, "edited");
  // Ownership travelled into the mutation itself rather than being checked beforehand.
  assert.deepEqual(callsTo("updatePostAsOwner")[0].args.slice(0, 2), ["postA", "A"]);
});

test("deleting a post requires authentication", async () => {
  const res = await call("DELETE", "/api/posts/postA");
  assert.equal(res.status, 401);
  assert.ok(world.posts.postA);
});

test("a user cannot delete someone else's post", async () => {
  const res = await call("DELETE", "/api/posts/postB", { as: "A" });
  assert.equal(res.status, 404);
  assert.ok(world.posts.postB);
  // The delete was issued scoped to the actor, so it could not have removed the row.
  assert.deepEqual(callsTo("deletePost")[0].args, ["postB", "A"]);
});

test("a user can delete their own post", async () => {
  const res = await call("DELETE", "/api/posts/postA", { as: "A" });
  assert.equal(res.status, 200);
  assert.equal(world.posts.postA, undefined);
});

/* ------------------------------------------------------------------ comments */

test("commenting requires authentication", async () => {
  const res = await call("POST", "/api/posts/comments", {
    body: { userId: "A", postId: "postA", text: "hi" },
  });
  assert.equal(res.status, 401);
  assert.equal(callsTo("createComment").length, 0);
});

test("a comment's author is the session, even when the body names someone else", async () => {
  const res = await call("POST", "/api/posts/comments", {
    as: "A",
    body: { userId: "B", postId: "postA", text: "not from B" },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.userId, "A");
  assert.equal(callsTo("createComment")[0].args[0].userId, "A");
});

test("a reply cannot adopt a parent comment from a different post", async () => {
  const res = await call("POST", "/api/posts/comments", {
    as: "A",
    body: { postId: "postA", parentId: "cOnB", text: "cross-post reply" },
  });
  assert.equal(res.status, 400);
  assert.equal(callsTo("createComment").length, 0);
});

test("a reply to a comment on the same post works", async () => {
  const res = await call("POST", "/api/posts/comments", {
    as: "A",
    body: { postId: "postA", parentId: "cB", text: "reply" },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.parentId, "cB");
});

test("deleting a comment requires authentication", async () => {
  const res = await call("DELETE", "/api/posts/comments/cA");
  assert.equal(res.status, 401);
  assert.ok(world.comments.cA);
});

test("a user cannot delete another user's comment", async () => {
  const res = await call("DELETE", "/api/posts/comments/cA", { as: "B" });
  assert.equal(res.status, 404);
  assert.ok(world.comments.cA);
  assert.deepEqual(callsTo("deleteCommentAsAuthor")[0].args, ["cA", "B"]);
});

test("the post's owner does not gain deletion rights over other people's comments", async () => {
  // ChefSire has no post-owner moderation today (see routes/meal-social.ts); A owns postA, cB is B's comment.
  const res = await call("DELETE", "/api/posts/comments/cB", { as: "A" });
  assert.equal(res.status, 404);
  assert.ok(world.comments.cB);
});

test("a comment's author can delete it", async () => {
  const res = await call("DELETE", "/api/posts/comments/cA", { as: "A" });
  assert.equal(res.status, 200);
  assert.equal(world.comments.cA, undefined);
});

/* ------------------------------------------------------------------ post likes */

test("liking a post requires authentication", async () => {
  const res = await call("POST", "/api/posts/likes", { body: { userId: "B", postId: "postA" } });
  assert.equal(res.status, 401);
  assert.equal(callsTo("likePost").length, 0);
});

test("a like is recorded for the session, not for the id in the body", async () => {
  const res = await call("POST", "/api/posts/likes", { as: "A", body: { userId: "B", postId: "postA" } });
  assert.equal(res.status, 201);
  assert.deepEqual(callsTo("likePost")[0].args, ["A", "postA"]);
  assert.ok(!world.likes.has("B|postA"));
});

test("liking twice stays successful and does not double up", async () => {
  await call("POST", "/api/posts/likes", { as: "A", body: { postId: "postA" } });
  const again = await call("POST", "/api/posts/likes", { as: "A", body: { postId: "postA" } });
  assert.equal(again.status, 201);
  assert.equal([...world.likes].length, 1);
});

test("unliking requires authentication", async () => {
  world.likes.add("B|postA");
  const res = await call("DELETE", "/api/posts/likes/B/postA");
  assert.equal(res.status, 401);
  assert.ok(world.likes.has("B|postA"));
});

test("a user cannot remove someone else's like by naming them in the URL", async () => {
  world.likes.add("B|postA");
  const res = await call("DELETE", "/api/posts/likes/B/postA", { as: "A" });
  assert.equal(res.status, 404); // A had no like of their own to remove
  assert.ok(world.likes.has("B|postA"));
  assert.deepEqual(callsTo("unlikePost")[0].args, ["A", "postA"]);
});

test("a user can unlike their own like, on either URL shape", async () => {
  world.likes.add("A|postA");
  assert.equal((await call("DELETE", "/api/posts/likes/postA", { as: "A" })).status, 200);
  assert.ok(!world.likes.has("A|postA"));

  world.likes.add("A|postA");
  assert.equal((await call("DELETE", "/api/posts/likes/B/postA", { as: "A" })).status, 200);
  assert.ok(!world.likes.has("A|postA"));
});

test("like status answers for the session, not for the id in the URL", async () => {
  world.likes.add("B|postA");
  const res = await call("GET", "/api/posts/likes/B/postA", { as: "A" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { isLiked: false });
  assert.deepEqual(callsTo("isPostLiked")[0].args, ["A", "postA"]);
});

test("an anonymous like-status check never reveals another user's likes", async () => {
  world.likes.add("B|postA");
  const res = await call("GET", "/api/posts/likes/B/postA");
  assert.deepEqual(res.body, { isLiked: false });
  assert.equal(callsTo("isPostLiked").length, 0);
});

/* ------------------------------------------------------------------ comment likes */

test("liking a comment requires authentication", async () => {
  const res = await call("POST", "/api/posts/comments/likes", { body: { userId: "B", commentId: "cA" } });
  assert.equal(res.status, 401);
  assert.equal(callsTo("likeComment").length, 0);
});

test("a comment like is recorded for the session, not for the id in the body", async () => {
  const res = await call("POST", "/api/posts/comments/likes", {
    as: "A",
    body: { userId: "B", commentId: "cA" },
  });
  assert.equal(res.status, 201);
  assert.deepEqual(callsTo("likeComment")[0].args, ["A", "cA"]);
  assert.ok(!world.commentLikes.has("B|cA"));
});

test("a user cannot remove someone else's comment like", async () => {
  world.commentLikes.add("B|cA");
  const res = await call("DELETE", "/api/posts/comments/likes/B/cA", { as: "A" });
  assert.equal(res.status, 404);
  assert.ok(world.commentLikes.has("B|cA"));
  assert.deepEqual(callsTo("unlikeComment")[0].args, ["A", "cA"]);
});

test("a user can like and unlike a comment normally", async () => {
  assert.equal((await call("POST", "/api/posts/comments/likes", { as: "A", body: { commentId: "cA" } })).status, 201);
  assert.ok(world.commentLikes.has("A|cA"));
  assert.equal((await call("DELETE", "/api/posts/comments/likes/cA", { as: "A" })).status, 200);
  assert.ok(!world.commentLikes.has("A|cA"));
});

test("comment like status answers for the session, not for the id in the URL", async () => {
  world.commentLikes.add("B|cA");
  const res = await call("GET", "/api/posts/comments/likes/B/cA", { as: "A" });
  assert.deepEqual(res.body, { isLiked: false });
  assert.deepEqual(callsTo("isCommentLiked")[0].args, ["A", "cA"]);
});

/* ------------------------------------------------------------------ follows */

test("following requires authentication", async () => {
  const res = await call("POST", "/api/posts/follows", { body: { followerId: "B", followingId: "A" } });
  assert.equal(res.status, 401);
  assert.equal(callsTo("followUser").length, 0);
});

test("the follower is the session, even when the body forges someone else", async () => {
  const res = await call("POST", "/api/posts/follows", {
    as: "A",
    body: { followerId: "B", followingId: "A" },
  });
  // A cannot make B a follower; the only relationship the request could create is A's own, and A may not
  // follow themselves.
  assert.equal(res.status, 400);
  assert.equal(callsTo("followUser").length, 0);
  assert.ok(!world.follows.has("B>A"));
});

test("a user can follow a public account, and the follow is theirs", async () => {
  const res = await call("POST", "/api/posts/follows", { as: "A", body: { followerId: "B", followingId: "B" } });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, { status: "following" });
  assert.deepEqual(callsTo("followUser")[0].args, ["A", "B"]);
});

test("a private account yields a follow request, never a follow", async () => {
  const res = await call("POST", "/api/posts/follows", { as: "A", body: { followingId: "P" } });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, "requested");
  assert.equal(callsTo("followUser").length, 0);
  assert.ok(world.followRequests.has("A>P"));
  assert.ok(!world.follows.has("A>P"));
});

test("unfollowing requires authentication", async () => {
  world.follows.add("B>A");
  const res = await call("DELETE", "/api/posts/follows/B/A");
  assert.equal(res.status, 401);
  assert.ok(world.follows.has("B>A"));
});

test("a user cannot tear down someone else's follow relationship", async () => {
  world.follows.add("B>A");
  const res = await call("DELETE", "/api/posts/follows/B/A", { as: "A" });
  assert.equal(res.status, 404);
  assert.ok(world.follows.has("B>A"));
  assert.deepEqual(callsTo("unfollowUser")[0].args, ["A", "A"]);
});

test("a user can unfollow their own follow", async () => {
  world.follows.add("A>B");
  const res = await call("DELETE", "/api/posts/follows/A/B", { as: "A" });
  assert.equal(res.status, 200);
  assert.ok(!world.follows.has("A>B"));
});

test("follow status is only ever asked about the session's own relationships", async () => {
  world.follows.add("B>P");
  const res = await call("GET", "/api/posts/follows/B/P", { as: "A" });
  assert.deepEqual(res.body, { isFollowing: false });
  const anonymous = await call("GET", "/api/posts/follows/B/P");
  assert.equal(anonymous.status, 401);
});
