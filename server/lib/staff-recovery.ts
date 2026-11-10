import { sql } from "drizzle-orm";
import { db } from "../db";
import { randomToken, sha256 } from "./staff-crypto";
import { opsHost } from "./ops-host";

/**
 * Break-glass recovery for the staff portal, run from the server (Plesk "Run Node.js commands" or a shell), for when
 * nobody who could reset the account in the portal can sign in (for example the only Owner lost their phone and their
 * recovery codes). Whoever can run commands on the server or reach the database already controls the portal, so this
 * adds no new power; it makes the recovery one audited step instead of hand-written SQL.
 */
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
export const RECOVERY_LINK_HOURS = 24;

export class StaffRecoveryError extends Error {}

/**
 * Resets one staff account's sign-in: password and authenticator cleared, recovery codes removed, every session ended,
 * any earlier reset link cancelled. Returns a one-time link (24 hours) to set a new password and authenticator. Groups,
 * Owner status and history are kept. Audited as a server action, in the same transaction.
 */
export async function issueStaffResetLink(login: string, reason: string, executor: any = db): Promise<{ link: string; expiresAt: Date }> {
  const clean = login.trim().toLowerCase();
  if (!reason || reason.trim().length < 3) throw new StaffRecoveryError("Give a reason (at least 3 characters).");
  const token = randomToken(32);
  return executor.transaction(async (tx: any) => {
    const [staff] = rowsOf(await tx.execute(sql`SELECT id, login, display_name AS "displayName", status FROM staff_users WHERE login = ${clean} FOR UPDATE`));
    if (!staff) throw new StaffRecoveryError(`No staff account with login "${clean}".`);
    if (staff.status !== "active") throw new StaffRecoveryError(`"${clean}" is disabled. An Owner has to enable it first.`);
    await tx.execute(sql`
      UPDATE staff_users SET password_hash = NULL, totp_secret_enc = NULL, totp_pending_enc = NULL, totp_last_step = NULL,
        mfa_enabled_at = NULL, failed_attempts = 0, locked_until = NULL
      WHERE id = ${staff.id}
    `);
    await tx.execute(sql`DELETE FROM staff_recovery_codes WHERE staff_user_id = ${staff.id}`);
    await tx.execute(sql`UPDATE staff_sessions SET revoked_at = now() WHERE staff_user_id = ${staff.id} AND revoked_at IS NULL`);
    await tx.execute(sql`UPDATE staff_invites SET revoked_at = now() WHERE staff_user_id = ${staff.id} AND used_at IS NULL AND revoked_at IS NULL`);
    const [invite] = rowsOf(await tx.execute(sql`
      INSERT INTO staff_invites (token_hash, staff_user_id, login, display_name, expires_at)
      VALUES (${sha256(token)}, ${staff.id}, ${staff.login}, ${staff.displayName}, now() + interval '${sql.raw(String(RECOVERY_LINK_HOURS))} hours')
      RETURNING expires_at AS "expiresAt"
    `));
    await tx.execute(sql`
      INSERT INTO admin_audit_log (actor_type, actor_id, actor_label, action, target_type, target_id, reason, details)
      VALUES ('system', NULL, 'Server script', 'staff.access.reset.emergency', 'staff_user', ${staff.id}, ${reason.trim()},
        ${JSON.stringify({ login: staff.login })}::jsonb)
    `);
    return { link: `https://${opsHost() ?? "ops.chefsire.com"}/invite#${token}`, expiresAt: invite.expiresAt };
  });
}
