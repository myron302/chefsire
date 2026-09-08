import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Post-startup replacement of the private root itself.
 *
 * Descendant-symlink containment asks "does the target resolve inside the resolved root". That question answers
 * itself when the ROOT is the thing that was replaced: if PRIVATE_STORAGE_ROOT becomes a symlink to UPLOADS_DIR or
 * to the client build tree, the target and the root canonicalize THROUGH THE SAME LINK, containment holds, and
 * every byte lands under an unauthenticated `express.static` mount. The startup assertion cannot see it -- it ran
 * against the directory as it was then -- so isolation is re-proved on every access instead of once per process.
 *
 * These build real directories and symlinks in a temporary tree and swap the root out from under an already-loaded
 * module, so what is asserted is the filesystem behaviour rather than a string comparison. The production
 * filesystem is never written to.
 */
const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "catering-root-swap-"));
const PRIVATE_ROOT = path.join(base, "private");
const PUBLIC_PARENT = path.join(base, "public");
const PUBLIC_UPLOADS = path.join(PUBLIC_PARENT, "uploads");
const OUTSIDE = path.join(base, "elsewhere");
for (const dir of [PRIVATE_ROOT, PUBLIC_UPLOADS, OUTSIDE]) fs.mkdirSync(dir, { recursive: true });

// Both roots are pointed into the temporary tree BEFORE the storage module is loaded, so the module's own
// startup validation runs against a genuinely safe configuration -- which is the premise of every test below.
process.env.UPLOADS_DIR = PUBLIC_UPLOADS;
process.env.PRIVATE_STORAGE_DIR = PRIVATE_ROOT;
const storage = await import("./private-storage");
const { canonicalizePath, firstPrivateRootConflict } = await import("./private-storage-path");
const { CLIENT_STATIC_DIR_CANDIDATES } = await import("./public-static-dirs");

/** Symlinks need elevation on some Windows configurations; nowhere else. */
function symlinksAvailable(): boolean {
  const probe = path.join(base, ".probe");
  try {
    fs.symlinkSync(base, probe, "dir");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
const skipWithoutSymlinks = { skip: symlinksAvailable() ? false : "symlinks unavailable" };

const BODY = Buffer.from("%PDF-1.7\nbooking document\n%%EOF\n");
const KEY = "catering-bookings/11111111-1111-4111-8111-111111111111/doc.pdf";

/** Replaces the private root itself with a symlink to `target`, as an attacker with write access to its parent would. */
function swapRootTo(target: string): void {
  fs.rmSync(PRIVATE_ROOT, { recursive: true, force: true });
  fs.symlinkSync(target, PRIVATE_ROOT, "dir");
}
function restoreRoot(): void {
  fs.rmSync(PRIVATE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PRIVATE_ROOT, { recursive: true });
}
/** Every local operation, so no entry point is left unproved. */
async function everyOperationIsRefused(message: string): Promise<void> {
  assert.throws(() => storage.resolvePrivatePath(KEY), message);
  await assert.rejects(() => storage.writePrivateObject("local", KEY, BODY, "application/pdf"), message);
  await assert.rejects(() => storage.readPrivateObject("local", KEY), message);
  await assert.rejects(() => storage.removePrivateObject("local", KEY), message);
  // `stat` reports "absent" rather than throwing -- its established contract -- which is equally a refusal: it
  // never measures a file through an unsafe root.
  assert.equal(await storage.statPrivateObject("local", KEY), null, message);
}

test("A. a normal safe root still works for every operation", async () => {
  await storage.writePrivateObject("local", KEY, BODY, "application/pdf");
  assert.equal((await storage.readPrivateObject("local", KEY)).equals(BODY), true);
  assert.deepEqual(await storage.statPrivateObject("local", KEY), { byteSize: BODY.length });
  if (process.platform !== "win32") assert.equal(fs.statSync(storage.resolvePrivatePath(KEY)).mode & 0o077, 0);
  await storage.removePrivateObject("local", KEY);
  assert.equal(await storage.statPrivateObject("local", KEY), null);
});

test("B. the root replaced with a symlink to UPLOADS_DIR is refused on every operation", skipWithoutSymlinks, async () => {
  // A real file planted in the public tree, so a successful read would be a genuine disclosure.
  fs.mkdirSync(path.join(PUBLIC_UPLOADS, "catering-bookings", "11111111-1111-4111-8111-111111111111"), { recursive: true });
  const victim = path.join(PUBLIC_UPLOADS, "catering-bookings", "11111111-1111-4111-8111-111111111111", "doc.pdf");
  fs.writeFileSync(victim, BODY);
  swapRootTo(PUBLIC_UPLOADS);
  try {
    // The containment check alone would PASS here: both sides resolve through the same link.
    assert.equal(canonicalizePath(path.resolve(PRIVATE_ROOT, KEY)).startsWith(canonicalizePath(PRIVATE_ROOT)), true);
    await everyOperationIsRefused("root symlinked to the public uploads tree");
    // Nothing was written into the public tree, and the planted file was neither read nor deleted.
    assert.equal(fs.existsSync(victim), true);
    assert.equal(fs.readFileSync(victim).equals(BODY), true);
  } finally {
    restoreRoot();
    fs.rmSync(path.join(PUBLIC_UPLOADS, "catering-bookings"), { recursive: true, force: true });
  }
});

test("C. the root replaced with a symlink to the client static tree is refused on every operation", skipWithoutSymlinks, async () => {
  // A real candidate from the same list `server/app.ts` serves the client bundle from -- not a path invented here.
  const clientTree = CLIENT_STATIC_DIR_CANDIDATES.find((dir) => fs.existsSync(dir));
  if (!clientTree) return; // no client build in this working tree
  const before = fs.readdirSync(clientTree).sort();
  swapRootTo(clientTree);
  try {
    await everyOperationIsRefused("root symlinked to the client build tree");
    // The decisive assertion: the served tree is byte-for-byte untouched.
    assert.deepEqual(fs.readdirSync(clientTree).sort(), before);
  } finally {
    restoreRoot();
  }
});

test("the root replaced with a symlink to a directory CONTAINING a public root is refused", skipWithoutSymlinks, async () => {
  // `<base>/public` contains `<base>/public/uploads`. Today's keys would not land in it, but that safety would
  // depend on key-prefix arithmetic against an unrelated variable, so the overlap itself is what is rejected.
  swapRootTo(PUBLIC_PARENT);
  try {
    await everyOperationIsRefused("root symlinked above the public uploads tree");
  } finally {
    restoreRoot();
  }
});

test("D. a descendant symlink escape is still rejected, to a public root and to anywhere else", skipWithoutSymlinks, async () => {
  for (const target of [PUBLIC_UPLOADS, OUTSIDE]) {
    const descendant = path.join(PRIVATE_ROOT, "catering-bookings");
    fs.rmSync(descendant, { recursive: true, force: true });
    fs.symlinkSync(target, descendant, "dir");
    try {
      // Lexically inside the root -- which is exactly why the physical check is what does the work.
      assert.equal(path.resolve(PRIVATE_ROOT, KEY).startsWith(PRIVATE_ROOT + path.sep), true);
      await everyOperationIsRefused(`descendant symlinked to ${target}`);
      assert.deepEqual(fs.readdirSync(target), []);
    } finally {
      fs.rmSync(descendant, { recursive: true, force: true });
    }
  }
});

test("E. the swap is detected without restarting: the same loaded module refuses on the very next call", skipWithoutSymlinks, async () => {
  // The module is already initialized and this key demonstrably works right now.
  await storage.writePrivateObject("local", KEY, BODY, "application/pdf");
  assert.equal((await storage.readPrivateObject("local", KEY)).equals(BODY), true);
  await storage.removePrivateObject("local", KEY);
  // The root becomes a link to the public tree. No reload, no restart, no cached decision.
  swapRootTo(PUBLIC_UPLOADS);
  try {
    await everyOperationIsRefused("swap detected on the next operation");
  } finally {
    restoreRoot();
  }
  // And it works again once the root is genuinely private, so the check is not a latch.
  await storage.writePrivateObject("local", KEY, BODY, "application/pdf");
  assert.equal((await storage.readPrivateObject("local", KEY)).equals(BODY), true);
  await storage.removePrivateObject("local", KEY);
});

test("F. valid nested paths inside a genuinely private root still work", async () => {
  const deep = "catering-bookings/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/33333333-3333-4333-8333-333333333333.pdf";
  await storage.writePrivateObject("local", deep, BODY, "application/pdf");
  assert.equal((await storage.readPrivateObject("local", deep)).equals(BODY), true);
  assert.deepEqual(await storage.statPrivateObject("local", deep), { byteSize: BODY.length });
  await storage.removePrivateObject("local", deep);
  // Idempotent delete is preserved: removing something already gone is still a success.
  await storage.removePrivateObject("local", deep);
});

test("G. a root whose real location cannot be established fails closed", skipWithoutSymlinks, async () => {
  // A symlink loop: canonicalization raises ELOOP rather than ENOENT, so the location is unknown rather than
  // merely absent. An unknown location is not evidence of privacy.
  const loopA = path.join(base, "loop-a");
  const loopB = path.join(base, "loop-b");
  fs.rmSync(PRIVATE_ROOT, { recursive: true, force: true });
  fs.symlinkSync(loopB, loopA, "dir");
  fs.symlinkSync(loopA, loopB, "dir");
  fs.symlinkSync(loopA, PRIVATE_ROOT, "dir");
  try {
    assert.equal(firstPrivateRootConflict(PRIVATE_ROOT, [{ label: "public uploads", path: PUBLIC_UPLOADS }])?.conflict, "unresolvable");
    await everyOperationIsRefused("unresolvable root");
  } finally {
    fs.rmSync(loopA, { force: true });
    fs.rmSync(loopB, { force: true });
    restoreRoot();
  }
});

test("G. an unresolvable PUBLIC root fails closed too, rather than being assumed non-overlapping", () => {
  const loopA = path.join(base, "public-loop-a");
  const loopB = path.join(base, "public-loop-b");
  fs.symlinkSync(loopB, loopA, "dir");
  fs.symlinkSync(loopA, loopB, "dir");
  try {
    assert.equal(firstPrivateRootConflict(PRIVATE_ROOT, [{ label: "public uploads", path: loopA }])?.conflict, "unresolvable");
  } finally {
    fs.rmSync(loopA, { force: true });
    fs.rmSync(loopB, { force: true });
  }
});

test("a refusal still discloses no filesystem path", skipWithoutSymlinks, () => {
  swapRootTo(PUBLIC_UPLOADS);
  try {
    assert.throws(() => storage.resolvePrivatePath(KEY), (error: unknown) => {
      const message = (error as Error).message;
      // The verbose operator message that names both roots belongs to the STARTUP assertion, read from logs. A
      // per-request refusal says only that the key is invalid.
      assert.equal(message, "Invalid private storage key");
      for (const secret of [PRIVATE_ROOT, PUBLIC_UPLOADS, base]) assert.equal(message.includes(secret), false);
      return true;
    });
  } finally {
    restoreRoot();
  }
});

test("H. the R2 branch is unaffected: no local root check is reached on that path", () => {
  const source = fs.readFileSync(new URL("./private-storage.ts", import.meta.url), "utf8");
  for (const [operation, call] of [
    ["writePrivateObject", "putPrivateObject(storageKey, body, contentType)"],
    ["readPrivateObject", "getPrivateObject(storageKey)"],
    ["statPrivateObject", "headPrivateObject(storageKey)"],
    ["removePrivateObject", "deletePrivateObject(storageKey)"],
  ] as const) {
    const at = source.indexOf(`export async function ${operation}`);
    const body = source.slice(at, source.indexOf("\n}", at));
    assert.equal(body.includes(`if (provider === "r2") return ${call};`), true, operation);
    // The R2 return precedes every local path resolution, so the cloud branch never reaches the root check.
    assert.equal(body.indexOf(`return ${call}`) < body.indexOf("resolvePrivatePath("), true, operation);
  }
});

test("the per-access check reuses the authoritative static-root set rather than restating it", () => {
  const source = fs.readFileSync(new URL("./private-storage.ts", import.meta.url), "utf8");
  const current = source.slice(source.indexOf("function currentPrivateRoot"), source.indexOf("export function resolvePrivatePath"));
  // Same helper the startup assertion uses, and the same root list app.ts serves from -- no second copy.
  assert.equal(current.includes("firstPrivateRootConflict(PRIVATE_STORAGE_ROOT, publicStaticRoots())"), true);
  assert.equal(/"dist\/public"|'dist\/public'/.test(source), false);
  // Proved BEFORE the target is resolved, and the target is measured against that freshly proved root.
  const resolve = source.slice(source.indexOf("export function resolvePrivatePath"), source.indexOf("/** Present only where the platform supports it"));
  assert.equal(resolve.indexOf("const realRoot = currentPrivateRoot();") < resolve.indexOf("const realTarget = canonicalizePath(lexical);"), true);
  assert.equal(resolve.includes("isSameOrInside(realTarget, realRoot)"), true);
  // Nothing is cached: it is a function call per access, not a module constant computed once.
  assert.equal(source.includes("const CURRENT_PRIVATE_ROOT ="), false);
  // The residual pathname-check race is documented rather than glossed over. It lives in the docstring, which sits
  // above the declaration and so outside the body slice above.
  assert.equal(source.includes("RESIDUAL RACE"), true);
  // O_NOFOLLOW and the post-mkdir re-validation, which narrow that race, are both still there.
  assert.equal(source.includes("O_NOFOLLOW"), true);
  const write = source.slice(source.indexOf("export async function writePrivateObject"), source.indexOf("async function writeWholeBuffer"));
  assert.equal((write.match(/resolvePrivatePath\(storageKey\)/g) ?? []).length, 2, "the write must re-validate after mkdir");
});

test.after(() => fs.rmSync(base, { recursive: true, force: true }));
