import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";

/**
 * Stage 1 internal, unexposed text+attachment redaction building block.
 * DO NOT invoke until the future closure orchestration has inventoried media
 * references and persisted eligible cleanup candidates in the SAME transaction.
 * In particular, booking-linked messages are contractual evidence and are
 * NEVER redacted by this helper.
 */
export const CLOSED_MEMBER_DM_PLACEHOLDER = "This message was removed";

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

/** Leaves thread ids, original timestamps, sender id and other people's content unchanged. */
export async function redactOrdinaryMemberMessagesWithinTransaction(tx: any, userId: string): Promise<number> {
  assertInternalClosureMutationAllowed();
  const rows = rowsOf(await tx.execute(sql`
    WITH targets AS MATERIALIZED (
      SELECT m.id
      FROM dm_messages m
      WHERE m.sender_id = ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM catering_booking_conversations c WHERE c.thread_id = m.thread_id
        )
        AND (
          m.body IS DISTINCT FROM 'This message was removed'
          OR m.attachments IS DISTINCT FROM '[]'::jsonb
        )
      FOR UPDATE OF m
    )
    UPDATE dm_messages m
    SET body = 'This message was removed', attachments = '[]'::jsonb
    FROM targets t
    WHERE m.id = t.id
    RETURNING m.id
  `));
  return rows.length;
}
