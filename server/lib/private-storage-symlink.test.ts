import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { canonicalizePath, privateRootConflict } from "./private-storage-path";

/**
 * Real-filesystem symlink coverage for private booking storage isolation.
 *
 * A purely lexical comparison is not enough: `PRIVATE_STORAGE_DIR=/safe-looking/private` looks unrelated to the
 * public uploads tree while being a symlink straight into it, and the files would land in the directory
 * `express.static` serves unauthenticated. These tests build actual directories and symlinks in a temporary tree so
 * the physical relationship -- not the spelling -- is what is asserted.
 */
// The temp dir is canonicalized up front (on macOS /tmp is itself a symlink), so the assertions below are about
// the links these tests create rather than about the platform's own aliasing.
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "catering-symlink-"));
const dir = (...segments: string[]) => {
  const target = path.join(root, ...segments);
  fs.mkdirSync(target, { recursive: true });
  return target;
};

/** Symlinks require elevation on some Windows configurations; nowhere else. */
function symlinksAvailable(): boolean {
  const probe = path.join(root, ".symlink-probe");
  try {
    fs.symlinkSync(root, probe, "dir");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
const SYMLINKS = symlinksAvailable();
const link = (from: string, to: string) => { fs.symlinkSync(to, from, "dir"); return from; };

const PUBLIC = dir("public", "uploads");

test("two separate physical directories are accepted", () => {
  assert.equal(privateRootConflict(dir("private", "storage"), PUBLIC), null);
});

test("the same physical directory reached by different lexical paths is rejected", () => {
  // No symlink needed: `..` segments spell one directory two ways, and both must be judged the same place.
  const viaTraversal = path.join(PUBLIC, "..", "uploads");
  assert.equal(privateRootConflict(viaTraversal, PUBLIC), "same");
  assert.equal(privateRootConflict(path.join(PUBLIC, ".", "sub", ".."), PUBLIC), "same");
});

test("a private root symlinked to the public root is rejected", { skip: SYMLINKS ? false : "symlinks unavailable" }, () => {
  const alias = link(path.join(dir("aliases"), "looks-private"), PUBLIC);
  // Lexically this shares no segment with the public tree; physically it IS the public tree.
  assert.equal(path.resolve(alias).startsWith(PUBLIC), false);
  assert.equal(privateRootConflict(alias, PUBLIC), "same");
});

test("a private root symlinked to a child of the public root is rejected", { skip: SYMLINKS ? false : "symlinks unavailable" }, () => {
  const inside = dir("public", "uploads", "docs");
  const alias = link(path.join(dir("aliases2"), "looks-private"), inside);
  assert.equal(privateRootConflict(alias, PUBLIC), "inside_public");
});

test("a symlinked public root that aliases the private tree is rejected", { skip: SYMLINKS ? false : "symlinks unavailable" }, () => {
  // The alias is on the PUBLIC side this time: resolving only the private side would miss the overlap entirely.
  const physicalPrivate = dir("shared", "storage");
  const publicAlias = link(path.join(dir("aliases3"), "uploads"), physicalPrivate);
  assert.equal(privateRootConflict(physicalPrivate, publicAlias), "same");
  assert.equal(privateRootConflict(path.join(physicalPrivate, "nested"), publicAlias), "inside_public");
});

test("a symlink several segments up the path is still resolved", { skip: SYMLINKS ? false : "symlinks unavailable" }, () => {
  // The link is a PARENT of the configured root, not the root itself, so only full canonicalization catches it.
  const parentAlias = link(path.join(dir("aliases4"), "data"), PUBLIC);
  const nested = path.join(parentAlias, "catering", "private");
  assert.equal(privateRootConflict(nested, PUBLIC), "inside_public");
});

test("a symlink pointing safely outside the public tree is accepted", { skip: SYMLINKS ? false : "symlinks unavailable" }, () => {
  const physical = dir("elsewhere", "private");
  const alias = link(path.join(dir("aliases5"), "private"), physical);
  assert.equal(privateRootConflict(alias, PUBLIC), null);
});

test("a not-yet-created directory under a safe canonical parent is accepted", () => {
  // The private root is created on first write, so it must be judged by where it WILL live.
  const notYet = path.join(dir("future"), "private-storage", "deep");
  assert.equal(fs.existsSync(notYet), false);
  assert.equal(privateRootConflict(notYet, PUBLIC), null);
  // Canonicalization rebuilds the missing suffix beneath the nearest existing ancestor.
  assert.equal(canonicalizePath(notYet), path.join(fs.realpathSync(path.join(root, "future")), "private-storage", "deep"));
});

test("a not-yet-created directory under a symlinked public parent is rejected", { skip: SYMLINKS ? false : "symlinks unavailable" }, () => {
  const parentAlias = link(path.join(dir("aliases6"), "data"), PUBLIC);
  const notYet = path.join(parentAlias, "private-storage");
  assert.equal(fs.existsSync(notYet), false);
  // Nothing at this path exists, yet its future physical home is already inside the public tree.
  assert.equal(privateRootConflict(notYet, PUBLIC), "inside_public");
});

test("canonicalization of an entirely existing path matches realpath", () => {
  const existing = dir("plain", "here");
  assert.equal(canonicalizePath(existing), fs.realpathSync(existing));
});

test("normal private storage still works under a canonically safe root", async () => {
  // The root check must not have disturbed reading, writing or deleting a real private object.
  const safeRoot = dir("working", "private");
  process.env.PRIVATE_STORAGE_DIR = safeRoot;
  const storage = await import("./private-storage");
  assert.equal(privateRootConflict(storage.PRIVATE_STORAGE_ROOT, PUBLIC), null);
  const key = "catering-bookings/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/22222222-2222-4222-8222-222222222222.pdf";
  const body = Buffer.from("%PDF-1.7\nstartxref\n%%EOF\n");
  await storage.writePrivateObject("local", key, body, "application/pdf");
  assert.equal((await storage.readPrivateObject("local", key)).equals(body), true);
  if (process.platform !== "win32") assert.equal(fs.statSync(storage.resolvePrivatePath(key)).mode & 0o077, 0);
  await storage.removePrivateObject("local", key);
  assert.equal(await storage.statPrivateObject("local", key), null);
});
