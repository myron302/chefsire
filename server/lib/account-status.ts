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
 * Nothing is deleted: reinstating (back to active) restores everything exactly as it was. Every change is written to
 * the audit log in the same transaction, with the reason.
 */
export const ACCOUNT_STATUSES = ["active", "restricted", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
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
 * Sign-in gate for every path that issues a session (password, Google, Facebook, TikTok). Fails closed: if the
 * status can't be read, no session is issued.
 */
export async function signInBlock(userId: string): Promise<null | { code: string; message: string }> {
  try {
    const { status } = await getAccountStatus(userId);
    if (status === "suspended") {
      return { code: "ACCOUNT_SUSPENDED", message: "This account is suspended. Contact support@chefsire.com if you think this is a mistake." };
    }
    return null;
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

/** Is this account hidden from others (suspended)? Fails closed: if the status can't be read, treat it as hidden. */
export async function isAccountHidden(userId: string): Promise<boolean> {
  try {
    return (await getAccountStatus(userId)).status === "suspended";
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
  status: AccountStatus;
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
