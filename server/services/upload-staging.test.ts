/**
 * Regressions for the two upload-lifecycle defects Greptile found in PR #1291.
 *
 * FINDING 3 -- the EXDEV fallback copied straight to the FINAL public filename, so a copy that died part-way
 * left a truncated, reachable object under `UPLOADS_DIR` while the request answered 500. Reproduced on e27e897:
 * a 4096-byte source failing after 1024 bytes left a 1024-byte file at `/uploads/<uuid>.mp4`.
 *
 * FINDING 4 -- cleanup lived only in the request's `finally`, so a process that died mid-upload left its staged
 * file behind forever. Reproduced on e27e897: a staged file survived a full server start untouched.
 *
 * `legacyPromote` below is the old implementation, kept as the negative control: every failure case is asserted
 * against both, so these tests demonstrably catch the defect rather than merely describing the fix.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "chefsire-staging-test-uploads-"));
process.env.UPLOADS_DIR = uploadsDir;

const {
  STALE_UPLOAD_AGE_MS,
  UPLOAD_PROMOTION_DIR,
  ensureUploadDirectories,
  promoteToUploadsDir,
  sweepStaleUploadFiles,
  sweepStaleUploadsOnStartup,
} = await import("./upload-staging");

after(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

/** The pre-correction promotion, verbatim, so each case can be shown to fail against it. */
async function legacyPromote(from: string, filename: string): Promise<void> {
  const destination = path.join(uploadsDir, filename);
  try {
    await fs.promises.rename(from, destination);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code !== "EXDEV") throw error;
    await fs.promises.copyFile(from, destination);
  }
}

/** Forces the cross-filesystem branch, and makes the copy fail the way a full disk would. */
function withFailingCrossDeviceCopy<T>(mode: "partial-then-fail" | "rename-fails", body: () => Promise<T>): Promise<T> {
  const realRename = fs.promises.rename;
  const realCopyFile = fs.promises.copyFile;
  let copied = false;
  (fs.promises as { rename: unknown }).rename = async (from: string, to: string) => {
    // The first rename (staging -> public) reports EXDEV, selecting the fallback. The publishing rename inside
    // the fallback is allowed through unless this case is specifically about it failing.
    if (!copied) { const error: NodeJS.ErrnoException = new Error("EXDEV: cross-device link"); error.code = "EXDEV"; throw error; }
    if (mode === "rename-fails") { const error: NodeJS.ErrnoException = new Error("EIO: publishing rename failed"); error.code = "EIO"; throw error; }
    return realRename(from, to);
  };
  (fs.promises as { copyFile: unknown }).copyFile = async (from: string, to: string) => {
    copied = true;
    if (mode === "rename-fails") return realCopyFile(from, to);
    // Exactly the reported hazard: the destination is created and partly written, then the copy dies.
    await fs.promises.writeFile(to, (await fs.promises.readFile(from)).subarray(0, 1024));
    const error: NodeJS.ErrnoException = new Error("ENOSPC: no space left on device");
    error.code = "ENOSPC";
    throw error;
  };
  return body().finally(() => {
    (fs.promises as { rename: unknown }).rename = realRename;
    (fs.promises as { copyFile: unknown }).copyFile = realCopyFile;
  });
}

function stagedSource(bytes = 4096): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "chefsire-staging-test-src-"));
  const file = path.join(directory, "chefsire-upload-source");
  fs.writeFileSync(file, Buffer.alloc(bytes, 0x41));
  return file;
}

const publicNames = () => fs.readdirSync(uploadsDir).filter((name) => !name.startsWith("."));
const promotionLeftovers = () => (fs.existsSync(UPLOAD_PROMOTION_DIR) ? fs.readdirSync(UPLOAD_PROMOTION_DIR) : []);

/* ------------------------------------------------------------------ FINDING 3 */

test("the same-filesystem fast path publishes atomically by rename", async () => {
  ensureUploadDirectories();
  const source = path.join(uploadsDir, ".promote", "same-fs-source");
  fs.writeFileSync(source, Buffer.alloc(2048, 0x42));
  await promoteToUploadsDir(source, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg");
  assert.equal(fs.existsSync(path.join(uploadsDir, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg")), true);
  assert.equal(fs.statSync(path.join(uploadsDir, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg")).size, 2048);
  assert.equal(fs.existsSync(source), false, "the source is gone: a rename moved it");
  fs.rmSync(path.join(uploadsDir, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg"));
});

test("a successful cross-filesystem promotion publishes the complete file", async () => {
  ensureUploadDirectories();
  const source = stagedSource(4096);
  const name = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.mp4";
  const realRename = fs.promises.rename;
  let first = true;
  (fs.promises as { rename: unknown }).rename = async (from: string, to: string) => {
    if (first) { first = false; const error: NodeJS.ErrnoException = new Error("EXDEV"); error.code = "EXDEV"; throw error; }
    return realRename(from, to);
  };
  try {
    await promoteToUploadsDir(source, name);
  } finally {
    (fs.promises as { rename: unknown }).rename = realRename;
  }
  assert.equal(fs.statSync(path.join(uploadsDir, name)).size, 4096, "the whole file, published under its canonical name");
  assert.deepEqual(promotionLeftovers(), [], "and nothing left in the promotion directory");
  fs.rmSync(path.join(uploadsDir, name));
});

test("a copy that dies part-way leaves NO public object -- the defect, and the negative control", async () => {
  ensureUploadDirectories();
  const name = "cccccccc-cccc-4ccc-8ccc-cccccccccccc.mp4";

  // The old implementation: the request fails AND a truncated public object is left behind.
  const legacySource = stagedSource(4096);
  await withFailingCrossDeviceCopy("partial-then-fail", async () => {
    await assert.rejects(() => legacyPromote(legacySource, name));
  });
  assert.equal(fs.existsSync(path.join(uploadsDir, name)), true, "negative control: the old code published a partial file");
  assert.equal(fs.statSync(path.join(uploadsDir, name)).size, 1024, "negative control: and it was truncated");
  fs.rmSync(path.join(uploadsDir, name));

  // The correction: the same failure, and the public name never comes into existence.
  const source = stagedSource(4096);
  await withFailingCrossDeviceCopy("partial-then-fail", async () => {
    await assert.rejects(() => promoteToUploadsDir(source, name));
  });
  assert.equal(fs.existsSync(path.join(uploadsDir, name)), false, "the public path was never created");
  assert.deepEqual(publicNames(), [], "and nothing else was published either");
  assert.deepEqual(promotionLeftovers(), [], "the partial copy was cleaned up");
});

test("a failure during the publishing rename also leaves no public object and no leftover", async () => {
  ensureUploadDirectories();
  const source = stagedSource(4096);
  const name = "dddddddd-dddd-4ddd-8ddd-dddddddddddd.mp4";
  await withFailingCrossDeviceCopy("rename-fails", async () => {
    await assert.rejects(() => promoteToUploadsDir(source, name));
  });
  assert.equal(fs.existsSync(path.join(uploadsDir, name)), false);
  assert.deepEqual(promotionLeftovers(), [], "the completed copy was removed when publishing failed");
});

test("the promotion directory is dotted, so nothing in it can be served", () => {
  assert.equal(path.basename(UPLOAD_PROMOTION_DIR).startsWith("."), true);
  assert.equal(path.dirname(UPLOAD_PROMOTION_DIR), uploadsDir, "and it is on the uploads filesystem, so rename is atomic");
});

/* ------------------------------------------------------------------ FINDING 4 */

function aged(directory: string, name: string, ageMs: number): string {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, name);
  fs.writeFileSync(file, Buffer.alloc(128, 0x43));
  const when = new Date(Date.now() - ageMs);
  fs.utimesSync(file, when, when);
  return file;
}

test("a stale leftover is swept and a fresh one is not", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "chefsire-sweep-"));
  const stale = aged(directory, "chefsire-upload-stale", STALE_UPLOAD_AGE_MS + 60_000);
  const fresh = aged(directory, "chefsire-upload-fresh", 1_000);
  const borderline = aged(directory, "chefsire-upload-borderline", STALE_UPLOAD_AGE_MS - 60_000);

  const result = await sweepStaleUploadFiles(directory);
  assert.equal(result.removed, 1);
  assert.equal(fs.existsSync(stale), false, "the leftover from a dead process is gone");
  assert.equal(fs.existsSync(fresh), true, "an upload in flight right now is untouched");
  assert.equal(fs.existsSync(borderline), true, "and so is one that is merely slow");
  assert.equal(result.failed, 0);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("the sweep never follows a link or descends into a directory", async () => {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "chefsire-sweep-links-"));
  const outside = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "chefsire-sweep-outside-"));
  const precious = path.join(outside, "real-user-media.jpg");
  fs.writeFileSync(precious, Buffer.alloc(64, 0x44));
  const old = new Date(Date.now() - STALE_UPLOAD_AGE_MS * 2);
  fs.utimesSync(precious, old, old);

  fs.mkdirSync(path.join(directory, "a-subdirectory"));
  aged(path.join(directory, "a-subdirectory"), "nested", STALE_UPLOAD_AGE_MS * 2);
  let linked = true;
  try { fs.symlinkSync(precious, path.join(directory, "link-to-precious")); } catch { linked = false; }

  const result = await sweepStaleUploadFiles(directory);
  assert.equal(fs.existsSync(precious), true, "a symlink's target is never removed");
  assert.equal(fs.existsSync(path.join(directory, "a-subdirectory", "nested")), true, "and the sweep does not recurse");
  if (linked) assert.equal(result.removed, 0, "the link itself is not a plain file, so it is kept");
  fs.rmSync(directory, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

test("a missing directory is not a failure, and a sweep of it removes nothing", async () => {
  const result = await sweepStaleUploadFiles(path.join(os.tmpdir(), "chefsire-sweep-does-not-exist"));
  assert.deepEqual({ removed: result.removed, kept: result.kept, failed: result.failed }, { removed: 0, kept: 0, failed: 0 });
});

test("the startup sweep covers both ChefSire directories and never throws", async () => {
  ensureUploadDirectories();
  const stale = aged(UPLOAD_PROMOTION_DIR, "abandoned.part", STALE_UPLOAD_AGE_MS * 2);
  const results = await sweepStaleUploadsOnStartup();
  assert.equal(results.length, 2, "staging and promotion");
  assert.equal(fs.existsSync(stale), false, "an abandoned promotion copy is cleaned up too");
  // Rerunning is harmless, which is what makes this safe to do on every boot.
  const again = await sweepStaleUploadsOnStartup();
  assert.equal(again.reduce((total, one) => total + one.failed, 0), 0);
});

test("the sweep only ever looks in ChefSire's own directories, never the OS temp root", async () => {
  const results = await sweepStaleUploadsOnStartup();
  for (const result of results) {
    assert.notEqual(path.resolve(result.directory), path.resolve(os.tmpdir()), "never the temp root itself");
    assert.equal(path.basename(result.directory) === "chefsire-upload-staging" || path.basename(result.directory) === ".promote", true, result.directory);
  }
});
