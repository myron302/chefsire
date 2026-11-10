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
