import { sql } from "drizzle-orm";

/**
 * Part 3b DM classification ONLY: no messages or attachments are changed.
 * Booking-linked threads are contractual evidence, never ordinary social DMs.
 * Return aggregate counts without exposing bodies, filenames, or recipients.
 * Any missing table/error is fatal to closure preflight.
 */
export type ClosureDmInventory = {
  ordinaryMessagesToRedact: number;
  ordinaryAttachmentReferences: number;
  bookingEvidenceMessages: number;
  otherParticipantThreadsToPreserve: number;
};
const rowsOf = (x: any): any[] => x?.rows ?? (Array.isArray(x) ? x : []);

export async function inspectClosureDmInventory(tx: any, userId: string): Promise<ClosureDmInventory> {
  const [counts] = rowsOf(await tx.execute(sql`
    SELECT
      count(*) FILTER (WHERE cb.thread_id IS NULL)::int AS "ordinaryMessagesToRedact",
      coalesce(sum(CASE WHEN cb.thread_id IS NULL AND jsonb_typeof(m.attachments) = 'array'
        THEN jsonb_array_length(m.attachments) ELSE 0 END), 0)::int AS "ordinaryAttachmentReferences",
      count(*) FILTER (WHERE cb.thread_id IS NOT NULL)::int AS "bookingEvidenceMessages"
    FROM dm_messages m
    LEFT JOIN catering_booking_conversations cb ON cb.thread_id = m.thread_id
    WHERE m.sender_id = ${userId}
  `));
  const [shared] = rowsOf(await tx.execute(sql`
    SELECT count(DISTINCT p.thread_id)::int AS n
    FROM dm_participants p
    WHERE p.user_id = ${userId}
      AND EXISTS (SELECT 1 FROM dm_participants other
                  WHERE other.thread_id = p.thread_id AND other.user_id <> ${userId})
  `));
  const nums = [
    Number(counts?.ordinaryMessagesToRedact),
    Number(counts?.ordinaryAttachmentReferences),
    Number(counts?.bookingEvidenceMessages),
    Number(shared?.n),
  ];
  if (nums.some(x => !Number.isSafeInteger(x) || x < 0)) {
    throw new Error("DM closure inventory unavailable; refuse irreversible closure");
  }
  return {
    ordinaryMessagesToRedact: nums[0],
    ordinaryAttachmentReferences: nums[1],
    bookingEvidenceMessages: nums[2],
    otherParticipantThreadsToPreserve: nums[3],
  };
}
