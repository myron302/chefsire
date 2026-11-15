import { sql } from "drizzle-orm";

/**
 * Who in a DM thread may be given a new notification, decided under locks so the answer cannot go
 * stale before the rows are written.
 *
 * Filtering recipients by status in one statement and inserting in another leaves a window: a
 * recipient who is active when the query runs can be suspended before the insert lands, and would
 * still get the alert. So this takes each candidate's own users row -- the same row a status change
 * takes -- in ascending id order, then re-reads status in a fresh statement, exactly as
 * lockMemberForContentWrite does and for the same READ COMMITTED reason.
 *
 * Call it inside the notification transaction and insert in that same transaction. Deliberately NOT
 * the sender's send transaction: holding the sender's row while taking a recipient's row deadlocks
 * against that recipient sending back at the same moment. By the time this runs the sender's row is
 * released, and every caller here takes rows in ascending id order, so there is no cycle left.
 *
 * Returns the ids that may be notified, which can be empty.
 */
export async function lockNotifiableThreadRecipients(
  tx: any,
  threadId: string,
  senderId: string,
): Promise<string[]> {
  const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

  const candidates = rowsOf(await tx.execute(sql`
    SELECT DISTINCT p.user_id AS id FROM dm_participants p
    WHERE p.thread_id = ${threadId} AND p.user_id <> ${senderId}
  `))
    .map((row) => String(row.id))
    .filter((id) => id.length > 0)
    .sort();
  if (candidates.length === 0) return [];

  const ids = sql.join(candidates.map((id) => sql`${id}`), sql`, `);

  // Ascending id order, so two sends notifying overlapping recipients cannot take the same two
  // rows in opposite orders.
  const present = rowsOf(await tx.execute(sql`
    SELECT id FROM users WHERE id IN (${ids}) ORDER BY id FOR UPDATE
  `)).map((row) => String(row.id));

  // Fresh statement after the lock wait, for the same reason as in member-content-write-lock.ts: a
  // status row inserted while we waited is invisible to the statement that did the waiting.
  const statuses = new Map<string, string>(
    rowsOf(await tx.execute(sql`
      SELECT user_id, status FROM account_status WHERE user_id IN (${ids})
    `)).map((row) => [String(row.user_id), String(row.status)]),
  );

  // No status row means active, as everywhere else. A participant who can no longer receive keeps
  // their place in the thread's history; they just stop accruing new alerts.
  return present.filter((id) => {
    const status = statuses.get(id);
    return status === undefined || status === "active" || status === "restricted";
  });
}
