import { sql } from "drizzle-orm";

/**
 * Serialize creation of new member-authored personal content with irreversible
 * account closure. A request can pass requireAuth BEFORE closure begins, so
 * it must still re-check account state under the shared users-row lock.
 */
export class MemberContentWriteBlockedError extends Error {
  readonly code = "MEMBER_CONTENT_WRITE_BLOCKED";
  constructor() {
    super("This account is no longer available for new content.");
  }
}

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

/** Call only inside the SAME transaction as the authored content insert. */
export async function lockMemberForContentWrite(tx: any, userId: string): Promise<void> {
  const people = rowsOf(await tx.execute(sql`
    SELECT id FROM users WHERE id = ${userId} FOR UPDATE
  `));
  if (people.length !== 1) throw new MemberContentWriteBlockedError();

  // Separate statement AFTER acquiring the row lock: a joined snapshot could
  // be stale at READ COMMITTED if closure committed while we were waiting.
  const status = rowsOf(await tx.execute(sql`
    SELECT status FROM account_status WHERE user_id = ${userId}
  `));
  if (status.length > 1 || (status.length === 1 && String(status[0].status) !== "active")) {
    throw new MemberContentWriteBlockedError();
  }
}

/**
 * New shared DM threads may only include accounts able to receive messages.
 * Lock ALL participants in stable id order before creating the thread, so a
 * concurrent closure cannot slip between a recipient check and the insert.
 * Restricted members can still receive; they cannot author new content.
 */
export async function lockAvailableDmParticipants(
  tx: any,
  senderId: string,
  recipientIds: readonly string[],
): Promise<void> {
  const ids = [...new Set([senderId, ...recipientIds])].sort();
  if (ids.some(id => !id || typeof id !== "string") || ids.length < 2 || ids.length > 100) {
    throw new MemberContentWriteBlockedError();
  }
  const found = rowsOf(await tx.execute(sql`
    SELECT id FROM users
    WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
    ORDER BY id FOR UPDATE
  `));
  if (found.length !== ids.length || found.some(row => !ids.includes(String(row.id)))) {
    throw new MemberContentWriteBlockedError();
  }
  const statuses = rowsOf(await tx.execute(sql`
    SELECT user_id, status FROM account_status
    WHERE user_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
  `));
  for (const row of statuses) {
    if (row.user_id === senderId) {
      if (row.status !== "active") throw new MemberContentWriteBlockedError();
    } else if (!["active", "restricted"].includes(String(row.status))) {
      throw new MemberContentWriteBlockedError();
    }
  }
}
