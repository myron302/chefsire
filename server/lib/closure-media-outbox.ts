import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";

/**
 * Draft Part 3b media cleanup ledger. This is a QUEUE of candidate references,
 * not permission to delete a file. The eventual worker must re-check every
 * reference in retained financial, shared and creator content before deleting.
 *
 * Only a server-derived key from an authenticated storage adapter may be passed
 * here. No user-supplied URL or absolute path is ever accepted as a local key.
 * The queue write belongs in the same transaction as the eventual tombstone.
 */
export type ClosureStorageProvider = "local" | "r2";
export type ClosureMediaSource = "dm" | "post" | "avatar" | "recipe" | "store" | "product" | "other";
export type ClosureMediaCandidate = {
  memberId: string;
  provider: ClosureStorageProvider;
  objectKey: string;
  sourceKind: ClosureMediaSource;
};

const safeKey = /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/;
const sources: readonly ClosureMediaSource[] = ["dm","post","avatar","recipe","store","product","other"];

export function validateClosureMediaCandidate(candidate: ClosureMediaCandidate): void {
  if (!candidate.memberId || !["local", "r2"].includes(candidate.provider)
      || !sources.includes(candidate.sourceKind)
      || !candidate.objectKey || candidate.objectKey.length > 1024
      || !safeKey.test(candidate.objectKey)
      || candidate.objectKey.includes("\\")
      || candidate.objectKey.includes(":")) {
    throw new Error("Unsafe or unverified media deletion candidate");
  }
}

const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);
/** Inserts one durable candidate; duplicates are harmless and never reset completed cleanup state. */
export async function enqueueClosureMediaCandidate(tx: any, candidate: ClosureMediaCandidate): Promise<boolean> {
  assertInternalClosureMutationAllowed();
  validateClosureMediaCandidate(candidate);
  const rows = rowsOf(await tx.execute(sql`
    INSERT INTO account_closure_media_cleanup (member_id, storage_provider, object_key, source_kind)
    VALUES (${candidate.memberId}, ${candidate.provider}, ${candidate.objectKey}, ${candidate.sourceKind})
    ON CONFLICT (member_id, storage_provider, object_key) DO NOTHING RETURNING id
  `));
  return rows.length === 1;
}
