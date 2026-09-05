import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { assertPrivateRootIsolated, isSameOrInside, privateRootConflict } from "./private-storage-path";

/**
 * The invariant under test: a booking document must never resolve inside the tree `server/app.ts` serves at
 * `/uploads` through `express.static`, because that mount is unauthenticated. These are pure path assertions -- no
 * environment, no filesystem, no module state -- so they hold identically wherever the app is deployed.
 */
const PUBLIC = path.resolve("/srv/chefsire/uploads");

test("a private root that is clearly elsewhere is accepted", () => {
  for (const safe of ["/srv/chefsire/private-storage", "/var/lib/chefsire-private", "/srv/private/catering"]) {
    assert.equal(privateRootConflict(safe, PUBLIC), null, safe);
    assert.doesNotThrow(() => assertPrivateRootIsolated(safe, PUBLIC));
  }
});

test("the public uploads root itself is rejected", () => {
  assert.equal(privateRootConflict(PUBLIC, PUBLIC), "same");
  // A trailing separator and a duplicated separator are the same directory, and are rejected the same way.
  assert.equal(privateRootConflict(`${PUBLIC}/`, PUBLIC), "same");
  assert.equal(privateRootConflict("/srv/chefsire//uploads", PUBLIC), "same");
  assert.equal(privateRootConflict("/srv/chefsire/./uploads", PUBLIC), "same");
});

test("any descendant of the public uploads root is rejected", () => {
  for (const unsafe of [`${PUBLIC}/private`, `${PUBLIC}/private/catering`, `${PUBLIC}/a/b/c`, `${PUBLIC}/private/`]) {
    assert.equal(privateRootConflict(unsafe, PUBLIC), "inside_public", unsafe);
  }
});

test("a path that only reaches the public tree after normalization is still rejected", () => {
  // Nothing here looks like a descendant as written; each one resolves to one.
  assert.equal(privateRootConflict("/srv/chefsire/private/../uploads/docs", PUBLIC), "inside_public");
  assert.equal(privateRootConflict("/srv/chefsire/uploads/x/../../uploads", PUBLIC), "same");
  assert.equal(privateRootConflict("/srv/chefsire/uploads/./private/../private", PUBLIC), "inside_public");
});

test("a sibling whose name merely starts with the public root's is accepted", () => {
  // The exact case a string-prefix comparison gets wrong: these are siblings, not descendants.
  assert.equal(privateRootConflict("/srv/chefsire/uploads-private", PUBLIC), null);
  assert.equal(privateRootConflict("/srv/chefsire/uploadsX", PUBLIC), null);
  assert.equal(isSameOrInside("/srv/chefsire/uploads-private", PUBLIC), false);
});

test("a relative configuration is judged on what it canonically resolves to", () => {
  const cwd = process.cwd();
  // Relative and absolute spellings of the same safe directory agree.
  assert.equal(privateRootConflict("private-storage", path.join(cwd, "uploads")), null);
  assert.equal(privateRootConflict(path.join(cwd, "private-storage"), path.join(cwd, "uploads")), null);
  // A relative path that resolves into the public tree is rejected despite never being written as a descendant.
  assert.equal(privateRootConflict("uploads/private", path.join(cwd, "uploads")), "inside_public");
  assert.equal(privateRootConflict("./uploads", path.join(cwd, "uploads")), "same");
});

test("a private root that contains the public uploads tree is rejected too", () => {
  // Not exposed by today's `catering-bookings/` keys, but it makes that safety depend on key-prefix arithmetic
  // against an unrelated environment variable. The verifiable guarantee is that the two trees do not overlap.
  assert.equal(privateRootConflict("/srv/chefsire", PUBLIC), "contains_public");
  assert.equal(privateRootConflict("/", PUBLIC), "contains_public");
  assert.equal(privateRootConflict("/srv", PUBLIC), "contains_public");
});

test("separator handling is delegated to the path module rather than to string surgery", () => {
  const base = path.join(path.sep, "srv", "app", "uploads");
  const inside = path.join(base, "nested", "deeper");
  assert.equal(isSameOrInside(inside, base), true);
  assert.equal(isSameOrInside(base, base), true);
  assert.equal(isSameOrInside(path.join(path.sep, "srv", "app"), base), false);
  // Joining produces the platform separator, and containment still holds after a traversal segment collapses.
  assert.equal(isSameOrInside(path.join(base, "a", "..", "b"), base), true);
  assert.equal(isSameOrInside(path.join(base, "..", "elsewhere"), base), false);
});

test("an unsafe configuration fails closed with a message that names both resolved roots", () => {
  for (const unsafe of [PUBLIC, `${PUBLIC}/private`, "/srv/chefsire"]) {
    assert.throws(() => assertPrivateRootIsolated(unsafe, PUBLIC), (error: unknown) => {
      const message = (error as Error).message;
      // The operator is told what is wrong, where both trees are, and which variable to change.
      assert.equal(message.includes(path.resolve(unsafe)), true);
      assert.equal(message.includes(PUBLIC), true);
      assert.equal(message.includes("PRIVATE_STORAGE_DIR"), true);
      return true;
    }, unsafe);
  }
});
