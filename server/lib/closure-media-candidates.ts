import { sql } from "drizzle-orm";

/**
 * Media is a TWO-PHASE privacy operation. A committed closure can register a
 * reviewable candidate, but cannot delete any object until ALL references
 * (including retained financial evidence) are checked and storage authorization
 * is available. No dispatcher/worker is installed by Part 3b stage 1.
 *
 * Never turn a client-supplied URL directly into a filesystem path or R2 key.
 * The metadata here must come from a trusted media index, not DM JSON strings.
 */
export type ClosureMediaProvider = "local" | "r2";
export type ClosureMediaClass =
  | "ordinary_dm_attachment"
  | "profile_avatar"
  | "ordinary_post_media"
  | "unpurchased_product_media";

export type ClosureMediaCandidate = {
  closedUserId: string;
  provider: ClosureMediaProvider;
  storageKey: string;
  kind: ClosureMediaClass;
};

/** Reject URLs, traversal, encoded traversal, and path separator ambiguity. */
export function validateClosureMediaKey(provider: ClosureMediaProvider, key: string): void {
  if (!key || key.length > 1024 || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid media storage key");
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(key) || /[\x00-\x1f\x7f]/.test(key)) {
    throw new Error("Invalid media storage key");
  }
  if (key.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Unsafe media path");
  }
  let decoded: string;
  try { decoded = decodeURIComponent(key); } catch { throw new Error("Invalid media encoding"); }
  if (decoded !== key || decoded.split("/").some(x => x === ".." || x === ".")) {
    throw new Error("Encoded media key is not allowed");
  }
  if (provider !== "local" && provider !== "r2") throw new Error("Unknown media provider");
}

/** Called within the same transaction as the future account closure. Enqueue only. */
export async function enqueueClosureMediaCandidate(tx: any, value: ClosureMediaCandidate): Promise<void> {
  validateClosureMediaKey(value.provider, value.storageKey);
  if (!["ordinary_dm_attachment", "profile_avatar", "ordinary_post_media", "unpurchased_product_media"].includes(value.kind)) {
    throw new Error("Unknown media class");
  }
  await tx.execute(sql`
    INSERT INTO closure_media_candidates
      (closed_user_id, storage_provider, storage_key, object_class)
    VALUES (${value.closedUserId}, ${value.provider}, ${value.storageKey}, ${value.kind})
    ON CONFLICT (closed_user_id, storage_provider, storage_key, object_class)
    DO NOTHING
  `);
}

/** Explicitly require a separate, reviewed worker before ANY deletion. */
export function closureMediaDeletionEnabled(): false {
  return false;
}
