import { sql } from "drizzle-orm";

/**
 * Serialize creation of new member-authored personal content with the account's own status.
 *
 * Why this exists even though permanent closure is still hard-disabled: the HTTP status gate
 * (see RESTRICTED_WRITE_ALLOWLIST in server/lib/account-status.ts) runs in middleware, BEFORE the
 * handler. A suspension, restriction, deactivation or -- later -- a closure that commits between
 * that check and the insert still lands the write today. Taking the member's own users row with
 * FOR UPDATE inside the same transaction as the insert closes that window: whichever of the two
 * transactions gets the row first wins, and the loser sees the committed outcome.
 *
 * Permanent closure is the second beneficiary of this, not the reason for it.
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

  // A separate statement AFTER the row lock is acquired, deliberately: at READ COMMITTED a join
  // or subquery in the locking statement above is evaluated against the snapshot taken when that
  // statement started, so a status change that commits while we wait for the lock would not be
  // visible. Re-reading in a fresh statement sees it.
  const status = rowsOf(await tx.execute(sql`
    SELECT status FROM account_status WHERE user_id = ${userId}
  `));
  if (status.length > 1 || (status.length === 1 && String(status[0].status) !== "active")) {
    throw new MemberContentWriteBlockedError();
  }
}

/**
 * New shared DM threads may only include accounts able to receive messages.
 * Lock ALL participants in stable id order before creating the thread, so a concurrent status
 * change cannot slip between a recipient check and the insert, and so two threads created in
 * opposite participant order cannot deadlock.
 *
 * The sender must be active (it is authoring). Recipients may be active or restricted: a
 * restricted member can still read and receive, it just cannot write (see account-status.ts).
 */
export async function lockAvailableDmParticipants(
  tx: any,
  senderId: string,
  recipientIds: readonly string[],
): Promise<void> {
  const ids = Array.from(new Set([senderId, ...recipientIds])).sort();
  if (ids.some((id) => !id || typeof id !== "string") || ids.length < 2 || ids.length > 100) {
    throw new MemberContentWriteBlockedError();
  }
  const found = rowsOf(await tx.execute(sql`
    SELECT id FROM users
    WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    ORDER BY id FOR UPDATE
  `));
  if (found.length !== ids.length) throw new MemberContentWriteBlockedError();

  const statuses = rowsOf(await tx.execute(sql`
    SELECT user_id, status FROM account_status
    WHERE user_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
  `));
  for (const row of statuses) {
    const status = String(row.status);
    if (String(row.user_id) === senderId) {
      if (status !== "active") throw new MemberContentWriteBlockedError();
    } else if (status !== "active" && status !== "restricted") {
      throw new MemberContentWriteBlockedError();
    }
  }
}
