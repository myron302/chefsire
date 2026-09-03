import fs from "fs";
import path from "path";
import { assertPrivateR2Isolated, deletePrivateObject, getPrivateObject, headPrivateObject, isPrivateR2Configured, putPrivateObject } from "./r2";
import { assertPrivateRootIsolated, canonicalizePath, isSameOrInside } from "./private-storage-path";
import { UPLOADS_DIR } from "./uploads-dir";

/**
 * Private storage for booking documents. Nothing written here is reachable by URL: the local root is deliberately
 * outside the directory Express serves at /uploads, and the R2 side uses a bucket with no public base URL. Every
 * read is therefore gated by the authorized download route rather than by knowledge of a key.
 */
export type PrivateStorageProvider = "r2" | "local";

/**
 * The private local root.
 *
 * `server/app.ts` serves UPLOADS_DIR at `/uploads` through `express.static`, with no authentication, so any booking
 * document that resolved inside that tree would be downloadable by anyone. Both the PRIVATE_STORAGE_DIR override
 * and the default are therefore validated against the same canonical UPLOADS_DIR the app itself mounts, and an
 * overlapping configuration throws rather than being quietly relocated: an operator who set an unsafe directory
 * must be told, not silently given a different one while believing theirs is in use.
 */
function resolvePrivateRoot(): string {
  const configured = process.env.PRIVATE_STORAGE_DIR?.trim();
  const root = configured ? path.resolve(configured) : path.resolve(process.cwd(), "private-storage");
  assertPrivateRootIsolated(root, UPLOADS_DIR);
  return root;
}
export const PRIVATE_STORAGE_ROOT: string = resolvePrivateRoot();
// Surfaced at initialization as well as at first use, so an unsafe bucket collision is not discovered only when a
// participant tries to upload. It throws only when BOTH buckets are set and equal, never for an unconfigured one.
assertPrivateR2Isolated();

/**
 * Resolves one server-generated storage key beneath the private root and refuses anything that escapes it. Keys are
 * only ever produced by the server from UUIDs, so this is a second line of defence rather than the first: an absolute
 * path, a traversal segment, or a NUL byte is rejected instead of resolved.
 */
export function resolvePrivatePath(storageKey: string): string {
  if (storageKey.includes("\0") || path.isAbsolute(storageKey)) throw new Error("Invalid private storage key");
  const lexical = path.resolve(PRIVATE_STORAGE_ROOT, storageKey);
  const root = PRIVATE_STORAGE_ROOT.endsWith(path.sep) ? PRIVATE_STORAGE_ROOT : PRIVATE_STORAGE_ROOT + path.sep;
  if (lexical !== PRIVATE_STORAGE_ROOT && !lexical.startsWith(root)) throw new Error("Invalid private storage key");
  // Lexical containment alone is not enough. It stops `../` traversal, but a DESCENDANT of the private root can
  // itself be a symlink -- `<root>/catering-bookings` pointing at UPLOADS_DIR, say -- and the lexical path would
  // still start with the root while the write landed under the public static mount. So the path is resolved
  // physically as well: both sides are canonicalized (which follows every symlink in either path, at any depth,
  // and rebuilds the not-yet-created suffix beneath the deepest real ancestor), and the real target must still be
  // inside the real root. Canonicalization is done per call rather than cached, so a symlink introduced AFTER
  // startup is caught on the very next operation. A canonicalization that fails for any reason other than a
  // missing path throws, so an unresolvable path is refused rather than assumed safe.
  const realTarget = canonicalizePath(lexical);
  if (!isSameOrInside(realTarget, canonicalizePath(PRIVATE_STORAGE_ROOT))) throw new Error("Invalid private storage key");
  return realTarget;
}

/** Present only where the platform supports it; on Windows the flag does not exist and the constant is absent. */
const O_NOFOLLOW = (fs.constants as { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;

/**
 * Which backend a new object is written to.
 *
 * R2 is used only when an explicitly private bucket is configured, and only when that bucket is not the public one.
 * A collision throws here, before a provider is chosen and long before any byte is written -- an unsafely configured
 * deployment must never be quietly downgraded to local storage, because the administrator would go on believing
 * their R2 bucket is in use. An absent R2_PRIVATE_BUCKET is the separate, legitimate local-fallback case.
 */
export function privateStorageProvider(): PrivateStorageProvider {
  if (!isPrivateR2Configured()) return "local";
  assertPrivateR2Isolated();
  return "r2";
}

export async function writePrivateObject(provider: PrivateStorageProvider, storageKey: string, body: Buffer, contentType: string): Promise<void> {
  if (provider === "r2") return putPrivateObject(storageKey, body, contentType);
  const target = resolvePrivatePath(storageKey);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  // Re-validated AFTER the directories exist. `mkdir -p` succeeds silently over an existing symlinked component, so
  // a link that was created between the first check and now would otherwise go unnoticed; this narrows the window
  // to the gap between this check and the open below.
  resolvePrivatePath(storageKey);
  // O_NOFOLLOW closes that remaining gap for the final component: if the file itself is a symlink the open fails
  // rather than writing through it. O_EXCL is not usable here because an overwrite of an existing object is legal.
  const handle = await fs.promises.open(target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | O_NOFOLLOW, 0o600);
  try {
    await handle.write(body);
    // An object that already existed keeps whatever mode it had, so the permissions are asserted rather than assumed.
    await handle.chmod(0o600);
  } finally {
    await handle.close();
  }
}

export async function readPrivateObject(provider: PrivateStorageProvider, storageKey: string): Promise<Buffer> {
  if (provider === "r2") return getPrivateObject(storageKey);
  // Physically contained by `resolvePrivatePath`, and O_NOFOLLOW refuses a final component that is itself a link,
  // so a download can never be served from outside the private root.
  const handle = await fs.promises.open(resolvePrivatePath(storageKey), fs.constants.O_RDONLY | O_NOFOLLOW);
  try {
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function statPrivateObject(provider: PrivateStorageProvider, storageKey: string): Promise<{ byteSize: number } | null> {
  if (provider === "r2") return headPrivateObject(storageKey);
  try {
    // `lstat`, not `stat`: a private object is a regular file. A symlink sitting where one should be describes
    // something outside this tree, so it is reported as absent rather than measured through.
    const stat = await fs.promises.lstat(resolvePrivatePath(storageKey));
    return stat.isFile() ? { byteSize: stat.size } : null;
  } catch {
    return null;
  }
}

/** Deleting an object that is already gone succeeds: cleanup is idempotent, so a retry never reports a false failure. */
export async function removePrivateObject(provider: PrivateStorageProvider, storageKey: string): Promise<void> {
  if (provider === "r2") return deletePrivateObject(storageKey);
  // Resolution happens outside the catch, so an unsafe path is REFUSED rather than swallowed as a missing file.
  // `unlink` never follows its final component, so it removes a link rather than the thing a link points at, and
  // the containment check above is what stops a symlinked parent directing it outside the root.
  const target = resolvePrivatePath(storageKey);
  try {
    await fs.promises.unlink(target);
  } catch (error) {
    // Deleting something already gone stays a success, so cleanup retries never report a false failure.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
