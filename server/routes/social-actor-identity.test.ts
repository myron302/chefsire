/**
 * The same-class audit, kept as a test: the defect this campaign fixed was not one endpoint but a habit --
 * a social write that trusts an id the caller typed. These assertions are structural, over the source of the
 * social subsystem, so a route added later that picks the habit back up fails here rather than in production.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => fs.readFileSync(path.join(here, ...p), "utf8");

const postsRoute = read("posts.ts");
const followsRoute = read("follows.ts");
const followHelper = read("..", "lib", "social-follow.ts");
const visibility = read("..", "lib", "post-visibility.ts");
const routeIndex = read("index.ts");

/** Every `r.<method>("path"` / `r.<method>([paths]` declaration with the middleware that follows it. */
function declarations(source: string) {
  return [...source.matchAll(/r\.(get|post|put|patch|delete)\(\s*(\[[^\]]*\]|"[^"]+")\s*,\s*([A-Za-z]+)/g)].map(
    (m) => ({ method: m[1], path: m[2].replace(/\s+/g, " "), middleware: m[3] })
  );
}

test("every mutation in the posts router is authenticated", () => {
  const mutations = declarations(postsRoute).filter((d) => d.method !== "get");
  assert.equal(mutations.length, 11, mutations.map((d) => `${d.method} ${d.path}`).join(", "));
  for (const d of mutations) {
    assert.equal(d.middleware, "requireAuth", `${d.method} ${d.path}`);
  }
});

test("every read in the posts router that depends on the viewer resolves one", () => {
  // Reads are either `optionalAuth` (public content stays public, the viewer refines it) or `requireAuth`
  // (the answer is only ever about the caller). Nothing reads with no identity middleware at all.
  for (const d of declarations(postsRoute).filter((d) => d.method === "get")) {
    assert.ok(
      ["optionalAuth", "requireAuth", "validateRequest"].includes(d.middleware),
      `${d.method} ${d.path} -> ${d.middleware}`
    );
  }
  // The three list routes validate their query first; each still runs behind optionalAuth.
  for (const listRoute of ['"/feed",\n  optionalAuth', '"/explore",\n  optionalAuth', '"/user/:userId",\n  optionalAuth']) {
    assert.ok(postsRoute.includes(listRoute), listRoute);
  }
});

test("the posts router never derives an actor or a viewer from the request payload", () => {
  // The actor is the session; `viewerIdFrom` is the only other source of identity, and it reads `req.user`.
  const identitySources = [...postsRoute.matchAll(/(?:const|let)\s+\w*(?:[Aa]ctorId|authorId|viewerId|followerId)\s*=\s*([^;]+);/g)]
    .map((m) => m[1].trim());
  assert.ok(identitySources.length >= 6, identitySources.join(" | "));
  for (const source of identitySources) {
    assert.ok(
      source === "req.user!.id" || source === "viewerIdFrom(req)",
      `actor/viewer derived from ${source}`
    );
  }

  // Comments in the file discuss these patterns by name; it is the CODE that must not contain them.
  const code = postsRoute
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
  for (const forbidden of ["body.userId", "body.followerId", "req.body.userId", "req.params.followerId", "query.currentUserId"]) {
    assert.ok(!code.includes(forbidden), forbidden);
  }

  // The two client-supplied ids the router still mentions are a TARGET user and an accepted-but-ignored
  // legacy field -- never a source of identity.
  for (const line of postsRoute.split("\n")) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (line.includes("req.params.userId")) {
      assert.ok(/canViewUserContent|getUserPosts/.test(line), `params.userId used as identity: ${line}`);
    }
    if (line.includes("currentUserId")) {
      assert.ok(
        line.trim().startsWith("currentUserId: legacyViewerField") || line.trim().startsWith("//"),
        `currentUserId read as identity: ${line}`
      );
    }
  }
  assert.ok(postsRoute.includes("const legacyViewerField = z.string().optional();"));

  assert.ok(visibility.includes("req.user as { id?: string } | undefined"), "the viewer comes from the session");
});

test("post ownership is enforced by the mutation, not by an earlier read", () => {
  assert.ok(postsRoute.includes("storage.updatePostAsOwner(req.params.id, req.user!.id"));
  assert.ok(postsRoute.includes("storage.deletePost(postId, userId)"));
  assert.ok(postsRoute.includes("storage.deleteCommentAsAuthor(req.params.id, req.user!.id)"));
  // The unscoped variants are not reachable from this router.
  assert.ok(!postsRoute.includes("storage.updatePost("));
  assert.ok(!postsRoute.includes("storage.deleteComment("));
});

test("direct post-associated reads all go through the one visibility policy", () => {
  // Every read of a post, its comments or its likes asks the policy first.
  const gates = postsRoute.match(/getVisiblePost\(|getVisiblePostWithUser\(|getVisibleCommentContext\(|canViewUserContent\(/g) ?? [];
  assert.ok(gates.length >= 10, `only ${gates.length} visibility gates`);
  assert.ok(visibility.includes("export function visiblePostsCondition"));
  assert.ok(visibility.includes("export async function canViewUserContent"));
});

test("a follow is never created directly around the private-account rule", () => {
  // `followOrRequest` is the only path that turns a follow intent into a row, and it refuses to create a
  // follow for a private target. The one other caller of `storage.followUser` is the request approval.
  assert.ok(followHelper.includes("if (target.isPrivate)"));
  assert.ok(followHelper.includes("storage.createFollowRequestIfAbsent(followerId, targetId)"));

  for (const [name, source] of Object.entries({
    "routes/posts.ts": postsRoute,
    "routes/follows.ts": followsRoute,
    "routes/drinks.ts": read("drinks.ts"),
  })) {
    const direct = [...source.matchAll(/storage\.followUser\(([^)]*)\)/g)].map((m) => m[1]);
    for (const args of direct) {
      // follows.ts creates the follow when the target accepts the request -- that IS the approval.
      assert.ok(args.includes("fr.requesterId"), `${name} creates a follow outside followOrRequest: ${args}`);
    }
  }
});

test("the other route that surfaces post content applies the same visibility policy", () => {
  // Autocomplete searches review POSTS; without the predicate it is a keyhole into private captions.
  const search = read("search.ts");
  assert.ok(search.includes('router.get("/autocomplete", optionalAuth'));
  assert.ok(search.includes("visiblePostsCondition(viewerIdFrom(req))"));
});

test("the unmounted duplicate comment/like routers are gone", () => {
  // They carried the same defects (no auth, body-supplied actor) and were never mounted; leaving them around
  // is a loaded gun for whoever wires them up next.
  for (const file of ["comments.ts", "likes.ts"]) {
    assert.ok(!fs.existsSync(path.join(here, file)), file);
  }
  assert.ok(!routeIndex.includes('from "./comments"'));
  assert.ok(!routeIndex.includes('from "./likes"'));
});
