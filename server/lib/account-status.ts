import { sql } from "drizzle-orm";
import { db } from "../db";
import { writeAudit } from "./staff-permissions";
import { accountStatusTestReader } from "./account-status-test-hook";

/**
 * Member account status (back office part 2). Stored in account_status; no row means active.
 *
 * - restricted: can sign in and browse; every write request is refused except a small allowlist (sign out, mark
 *   notifications read). Content stays visible.
 * - suspended: every session is ended at once (users.auth_version is bumped), no new sign-in by any method, and the
 *   member's posts, products, store and profile are hidden from everyone else.
 *
 * - deactivated: the member chose to deactivate their own account. Treated like suspended for others (hidden, every
 *   session ended), but signing in again by any method reactivates it.
 *
 * Nothing is deleted: reinstating (back to active) restores everything exactly as it was. Every change is written to
 * the audit log in the same transaction, with the reason.
 */
export const ACCOUNT_STATUSES = ["active", "restricted", "suspended", "deactivated", "closed"] as const;
/** The statuses staff can set. Deactivation is the member's own choice. */
export const STAFF_SETTABLE_STATUSES = ["active", "restricted", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type StaffSettableStatus = (typeof STAFF_SETTABLE_STATUSES)[number];
export type AccountStatusRecord = { status: AccountStatus; reason: string | null; changedBy: string | null; changedAt: string | Date | null };

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

export { setAccountStatusReaderForTests } from "./account-status-test-hook";

export async function getAccountStatus(userId: string, executor: any = db): Promise<AccountStatusRecord> {
  const testReader = accountStatusTestReader();
  if (testReader && executor === db) return testReader(userId);
  const [row] = rowsOf(await executor.execute(sql`
    SELECT status, reason, changed_by AS "changedBy", changed_at AS "changedAt" FROM account_status WHERE user_id = ${userId}
  `));
  return row ? { status: row.status, reason: row.reason, changedBy: row.changedBy, changedAt: row.changedAt }
    : { status: "active", reason: null, changedBy: null, changedAt: null };
}

/**
 * Sign-in gate for every path that issues a session (password, Google, Facebook, TikTok), called once the member's
 * credentials have been verified. Fails closed: if the status can't be read, no session is issued. A deactivated
 * account is reactivated here: signing back in is how a member undoes deactivation.
 */
export async function signInBlock(userId: string): Promise<null | { code: string; message: string }> {
  const suspended = { code: "ACCOUNT_SUSPENDED", message: "This account is suspended. Contact support@chefsire.com if you think this is a mistake." };
  const closed = { code: "ACCOUNT_CLOSED", message: "This account has been permanently closed and cannot be signed into." };
  try {
    // Suites that run sign-in on a database double answer status reads through the test hook (no transaction there).
    if (accountStatusTestReader()) {
      const { status } = await getAccountStatus(userId);
      if (status === "suspended") return suspended;
      if (status === "closed") return closed;
      if (status === "deactivated") await reactivateOwnAccount(userId);
      return null;
    }
    // The decision and any reactivation happen under the same account-row lock staff status changes take, so a
    // suspension racing this sign-in is either seen here (refused) or applied after it (that session then ends).
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
      const { status } = await getAccountStatus(userId, tx);
      if (status === "suspended") return suspended;
      if (status === "closed") return closed;
      if (status === "deactivated") await reactivateWithin(tx, userId);
      return null;
    });
  } catch (error) {
    console.error("[account-status] sign-in status check failed; refusing.", (error as Error)?.message);
    return { code: "ACCOUNT_STATUS_UNAVAILABLE", message: "We couldn't sign you in right now. Please try again." };
  }
}

/** Requests a restricted account may still make (everything else that changes data is refused). */
const RESTRICTED_WRITE_ALLOWLIST: RegExp[] = [
  /^\/api\/auth\/logout\/?$/,
  /^\/api\/notifications\/(mark-all-read|[^/]+\/read)\/?$/,
];

export function isAllowedForRestricted(method: string, path: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return true;
  return RESTRICTED_WRITE_ALLOWLIST.some((re) => re.test(path.split("?")[0]));
}

export { accountHidden } from "./account-hidden-sql";

/** Is this account hidden from others (suspended or deactivated)? Fails closed: if the status can't be read, hide it. */
export async function isAccountHidden(userId: string): Promise<boolean> {
  try {
    const { status } = await getAccountStatus(userId);
    return status === "suspended" || status === "deactivated" || status === "closed";
  } catch (error) {
    console.error("[account-status] status unavailable; hiding the account's content until it can be read.", (error as Error)?.message);
    return true;
  }
}

export class AccountStatusError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Changes a member's status (staff action). Suspending ends every session by bumping auth_version. Owners
 * (INTERNAL_ADMIN_EMAILS) and the acting staff member themselves can't be changed here.
 */
export async function setAccountStatus(input: {
  actorId: string;
  userId: string;
  status: StaffSettableStatus;
  reason: string;
  protectedTarget: boolean;
  /** Decides, on the locked current status, whether this actor may make the change. */
  authorize: (from: AccountStatus, to: AccountStatus) => boolean;
}): Promise<{ from: AccountStatus; to: AccountStatus; changed: boolean }> {
  if (input.userId === input.actorId) throw new AccountStatusError(400, "You can't change your own account status.");
  if (input.protectedTarget) throw new AccountStatusError(400, "Owner accounts can't be restricted or suspended.");
  return db.transaction(async (tx: any) => {
    const [user] = rowsOf(await tx.execute(sql`SELECT id, username FROM users WHERE id = ${input.userId} FOR UPDATE`));
    if (!user) throw new AccountStatusError(404, "Member not found");
    const current = await getAccountStatus(input.userId, tx);
    if (current.status === "closed") throw new AccountStatusError(409, "A permanently closed account cannot be reinstated or changed.");
    if (!input.authorize(current.status, input.status)) throw new AccountStatusError(403, "You don't have permission to do that.");
    if (current.status === input.status) return { from: current.status, to: input.status, changed: false };
    if (input.status === "active") {
      await tx.execute(sql`DELETE FROM account_status WHERE user_id = ${input.userId}`);
    } else {
      await tx.execute(sql`
        INSERT INTO account_status (user_id, status, reason, changed_by) VALUES (${input.userId}, ${input.status}, ${input.reason}, ${input.actorId})
        ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason, changed_by = EXCLUDED.changed_by, changed_at = now()
      `);
    }
    if (input.status === "suspended") {
      // Ends every existing session on every device immediately (tokens carry the old version).
      await tx.execute(sql`UPDATE users SET auth_version = coalesce(auth_version, 1) + 1 WHERE id = ${input.userId}`);
    }
    await writeAudit({
      actorId: input.actorId,
      action: `member.status.${input.status}`,
      targetType: "user",
      targetId: input.userId,
      reason: input.reason,
      details: { username: user.username, from: current.status, to: input.status },
    }, tx);
    return { from: current.status, to: input.status, changed: true };
  });
}

/** Audit entry for an action a member took on their own account (actor_type 'member'). */
async function writeMemberAudit(tx: any, userId: string, action: string, details: Record<string, unknown>) {
  await tx.execute(sql`
    INSERT INTO admin_audit_log (actor_type, actor_id, actor_label, action, target_type, target_id, reason, details)
    VALUES ('member', ${userId}, (SELECT username FROM users WHERE id = ${userId}), ${action}, 'user', ${userId},
      ${(details.reason as string | undefined) ?? null}, ${JSON.stringify(details)}::jsonb)
  `);
}

export const DEACTIVATION_REASON = "Deactivated by the member";

/**
 * The member deactivates their own account: hidden from everyone, signed out on every device. Nothing is deleted;
 * signing in again reactivates it. Refused while restricted or suspended (that's staff's decision to lift).
 */
export async function deactivateOwnAccount(userId: string): Promise<{ changed: boolean }> {
  return db.transaction(async (tx: any) => {
    const [user] = rowsOf(await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`));
    if (!user) throw new AccountStatusError(404, "Account not found");
    const current = await getAccountStatus(userId, tx);
    if (current.status === "deactivated") return { changed: false };
    if (current.status !== "active") {
      throw new AccountStatusError(409, "This account is restricted or suspended, so it can't be deactivated. Contact support@chefsire.com.");
    }
    await tx.execute(sql`
      INSERT INTO account_status (user_id, status, reason, changed_by) VALUES (${userId}, 'deactivated', ${DEACTIVATION_REASON}, ${userId})
    `);
    await tx.execute(sql`UPDATE users SET auth_version = coalesce(auth_version, 1) + 1 WHERE id = ${userId}`);
    await writeMemberAudit(tx, userId, "member.deactivated", { reason: DEACTIVATION_REASON });
    return { changed: true };
  });
}

/** Signing back in reactivates a deactivated account (only that status; staff decisions are never lifted here). */
async function reactivateWithin(tx: any, userId: string): Promise<boolean> {
  const removed = rowsOf(await tx.execute(sql`
    DELETE FROM account_status WHERE user_id = ${userId} AND status = 'deactivated' RETURNING user_id
  `));
  if (!removed.length) return false;
  await writeMemberAudit(tx, userId, "member.reactivated", { reason: "Signed in again" });
  return true;
}

export async function reactivateOwnAccount(userId: string): Promise<boolean> {
  return db.transaction((tx: any) => reactivateWithin(tx, userId));
}
