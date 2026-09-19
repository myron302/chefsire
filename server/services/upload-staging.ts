/**
 * Where an upload lives while it is still untrusted, and how it becomes a served object.
 *
 * Two directories, two different jobs, and neither is ever reachable over HTTP:
 *
 *   STAGING (`<tmp>/chefsire-upload-staging`) holds the multipart body while its bytes are still unclassified.
 *   It is under the OS temp directory, outside both `express.static` mounts, and the files in it carry NO
 *   extension -- there is nothing to derive one from yet, and a name without an extension cannot be mistaken for
 *   a served object if it is ever left behind.
 *
 *   PROMOTION (`<UPLOADS_DIR>/.promote`) holds a validated file for the instant between "copied" and "published".
 *   It has to be on the SAME filesystem as `UPLOADS_DIR`, because the only way to publish a file atomically is to
 *   `rename()` it within one filesystem. It is a dotted directory and the `/uploads` mount is configured
 *   `dotfiles: "deny"`, so nothing under it is servable even by exact URL.
 *
 * WHY PROMOTION EXISTS. `promoteToUploadsDir` used to fall back to `copyFile(staged, finalPublicPath)` when
 * `rename` answered EXDEV. `copyFile` creates its destination and writes into it progressively, so a failure
 * part-way through -- ENOSPC is the realistic one -- leaves a TRUNCATED FILE AT THE FINAL PUBLIC PATH while the
 * request answers 500. Reproduced: a 4096-byte source failing after 1024 bytes left a reachable 1024-byte object
 * at `/uploads/<uuid>.mp4`. Copying into `.promote` first and renaming only on success means the public name
 * either does not exist or is the complete file. There is no state in between.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { UPLOADS_DIR } from "../lib/uploads-dir";

/** Untrusted multipart bodies. Outside every served directory. */
export const UPLOAD_STAGING_DIR = path.join(os.tmpdir(), "chefsire-upload-staging");
/** Validated files mid-publish. Inside UPLOADS_DIR so `rename` is atomic; dotted so it is never served. */
export const UPLOAD_PROMOTION_DIR = path.join(UPLOADS_DIR, ".promote");

export function ensureUploadDirectories(): void {
  fs.mkdirSync(UPLOAD_STAGING_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_PROMOTION_DIR, { recursive: true });
}

/**
 * Publishes a validated file under its canonical name, atomically.
 *
 * The fast path is a plain `rename` from staging, which is atomic when staging and uploads share a filesystem.
 * When they do not, the copy goes to a private name inside the target filesystem and only a `rename` -- which
 * cannot half-succeed -- puts it at the public path. Every failure removes the partial copy and leaves no public
 * object; the caller's own lifecycle still disposes of the staged source.
 */
export async function promoteToUploadsDir(from: string, filename: string): Promise<void> {
  const destination = path.join(UPLOADS_DIR, filename);
  try {
    await fs.promises.rename(from, destination);
    return;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code !== "EXDEV") throw error;
  }

  // Cross-filesystem. Copy into the target filesystem under a name nothing serves, then publish by rename.
  await fs.promises.mkdir(UPLOAD_PROMOTION_DIR, { recursive: true });
  const pending = path.join(UPLOAD_PROMOTION_DIR, `${randomUUID()}.part`);
  try {
    await fs.promises.copyFile(from, pending);
    await fs.promises.rename(pending, destination);
  } catch (error: unknown) {
    // Whether the copy died half-written or the rename failed, the partial file is ours to remove and the
    // public name was never created.
    await fs.promises.unlink(pending).catch(() => undefined);
    throw error;
  }
}

/** How old a leftover must be before a sweep will remove it. Comfortably longer than any real upload. */
export const STALE_UPLOAD_AGE_MS = 6 * 60 * 60 * 1000;

export type StagingSweepResult = { directory: string; removed: number; kept: number; failed: number };

/**
 * Removes leftovers from one of ChefSire's own upload directories.
 *
 * The per-request `finally` handles every outcome a request can reach, but it cannot run if the process dies
 * mid-upload -- a crash, an OOM kill, a deploy restart -- and the staged file then stays until something removes
 * it. Reproduced: a staged file survives a full server start with nothing touching it.
 *
 * Deliberately conservative. It only ever looks in a directory ChefSire created for itself, never at the OS temp
 * directory at large; it only considers plain files directly inside it, never a subdirectory and never a
 * symlink's target; and it only removes files whose mtime is older than the threshold, so an upload in flight
 * right now is not a candidate no matter how large it is or how long it takes.
 */
export async function sweepStaleUploadFiles(directory: string, now = Date.now(), olderThanMs = STALE_UPLOAD_AGE_MS): Promise<StagingSweepResult> {
  const result: StagingSweepResult = { directory, removed: 0, kept: 0, failed: 0 };
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    // A directory that does not exist yet is not a failure: nothing has been staged.
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return result;
    result.failed += 1;
    return result;
  }

  for (const entry of entries) {
    if (!entry.isFile()) { result.kept += 1; continue; }
    const target = path.join(directory, entry.name);
    try {
      // `lstat`, so a symlink is judged as a link and never followed out of the directory.
      const stats = await fs.promises.lstat(target);
      if (!stats.isFile() || now - stats.mtimeMs < olderThanMs) { result.kept += 1; continue; }
      await fs.promises.unlink(target);
      result.removed += 1;
    } catch (error: unknown) {
      // Another worker finishing the same upload wins the race; that is not a failure.
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") { result.kept += 1; continue; }
      result.failed += 1;
    }
  }
  return result;
}

/**
 * The startup sweep. Runs once, never on a timer: a timer would keep a test process alive and buy nothing, since
 * leftovers only appear when a process dies and a process that has died is about to be started again anyway.
 *
 * It can never prevent the server from starting. Every failure is counted and logged, and the counts name
 * directories and totals -- no filenames, no credentials, nothing from a request.
 */
export async function sweepStaleUploadsOnStartup(now = Date.now()): Promise<StagingSweepResult[]> {
  const results: StagingSweepResult[] = [];
  for (const directory of [UPLOAD_STAGING_DIR, UPLOAD_PROMOTION_DIR]) {
    try {
      results.push(await sweepStaleUploadFiles(directory, now));
    } catch {
      results.push({ directory, removed: 0, kept: 0, failed: 1 });
    }
  }
  const removed = results.reduce((total, one) => total + one.removed, 0);
  const failed = results.reduce((total, one) => total + one.failed, 0);
  if (removed > 0 || failed > 0) {
    console.log(`[uploads] startup sweep: removed ${removed} stale file(s), ${failed} could not be removed`);
  }
  return results;
}
