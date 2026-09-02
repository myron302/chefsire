import fs from "fs";
import path from "path";
import { deletePrivateObject, getPrivateObject, headPrivateObject, isPrivateR2Configured, putPrivateObject } from "./r2";

/**
 * Private storage for booking documents. Nothing written here is reachable by URL: the local root is deliberately
 * outside the directory Express serves at /uploads, and the R2 side uses a bucket with no public base URL. Every
 * read is therefore gated by the authorized download route rather than by knowledge of a key.
 */
export type PrivateStorageProvider = "r2" | "local";

/**
 * The private local root. It defaults to a sibling of the public uploads directory rather than a child of it, so a
 * misconfigured static mount cannot expose booking documents. PRIVATE_STORAGE_DIR overrides it for deployments that
 * pin storage outside the application directory.
 */
function resolvePrivateRoot(): string {
  const configured = process.env.PRIVATE_STORAGE_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), "private-storage");
}
export const PRIVATE_STORAGE_ROOT: string = resolvePrivateRoot();

/**
 * Resolves one server-generated storage key beneath the private root and refuses anything that escapes it. Keys are
 * only ever produced by the server from UUIDs, so this is a second line of defence rather than the first: an absolute
 * path, a traversal segment, or a NUL byte is rejected instead of resolved.
 */
export function resolvePrivatePath(storageKey: string): string {
  if (storageKey.includes("\0") || path.isAbsolute(storageKey)) throw new Error("Invalid private storage key");
  const resolved = path.resolve(PRIVATE_STORAGE_ROOT, storageKey);
  const root = PRIVATE_STORAGE_ROOT.endsWith(path.sep) ? PRIVATE_STORAGE_ROOT : PRIVATE_STORAGE_ROOT + path.sep;
  if (resolved !== PRIVATE_STORAGE_ROOT && !resolved.startsWith(root)) throw new Error("Invalid private storage key");
  return resolved;
}

/** Which backend a new object is written to. R2 is used only when an explicitly private bucket is configured. */
export function privateStorageProvider(): PrivateStorageProvider { return isPrivateR2Configured() ? "r2" : "local"; }

export async function writePrivateObject(provider: PrivateStorageProvider, storageKey: string, body: Buffer, contentType: string): Promise<void> {
  if (provider === "r2") return putPrivateObject(storageKey, body, contentType);
  const target = resolvePrivatePath(storageKey);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, body, { mode: 0o600 });
}

export async function readPrivateObject(provider: PrivateStorageProvider, storageKey: string): Promise<Buffer> {
  if (provider === "r2") return getPrivateObject(storageKey);
  return fs.promises.readFile(resolvePrivatePath(storageKey));
}

export async function statPrivateObject(provider: PrivateStorageProvider, storageKey: string): Promise<{ byteSize: number } | null> {
  if (provider === "r2") return headPrivateObject(storageKey);
  try {
    const stat = await fs.promises.stat(resolvePrivatePath(storageKey));
    return { byteSize: stat.size };
  } catch {
    return null;
  }
}

/** Deleting an object that is already gone succeeds: cleanup is idempotent, so a retry never reports a false failure. */
export async function removePrivateObject(provider: PrivateStorageProvider, storageKey: string): Promise<void> {
  if (provider === "r2") return deletePrivateObject(storageKey);
  try {
    await fs.promises.unlink(resolvePrivatePath(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
