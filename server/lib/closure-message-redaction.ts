import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";

/**
 * Redact ONLY ordinary member-authored DMs as part of the eventual, locked,
 * all-or-nothing closure transaction. The operation never deletes shared
 * threads, counterparties' messages, or booking-linked contractual evidence.
 * The caller must retain attachment references for the post-commit outbox
 * BEFORE this update; no files are deleted here.
 *
 * Missing booking-linkage tables cause a database error (fail closed).
 */
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
export const REDACTED_MEMBER_DM_BODY = "This message was removed";

export async function redactOrdinaryDmWithinClosure(tx: any, userId: string): Promise<number> {
  assertInternalClosureMutationAllowed();
  const changed = rowsOf(await tx.execute(sql`
    UPDATE dm_messages m
    SET body = ${REDACTED_MEMBER_DM_BODY},
        attachments = '[]'::jsonb
    WHERE m.sender_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM catering_booking_conversations b
        WHERE b.thread_id = m.thread_id
      )
      AND (m.body IS DISTINCT FROM ${REDACTED_MEMBER_DM_BODY}
        OR m.attachments IS DISTINCT FROM '[]'::jsonb)
    RETURNING m.id
  `));
  return changed.length;
}
