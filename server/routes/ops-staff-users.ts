import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { requireStaffPermission, writeAudit } from "../lib/staff-permissions";
import { randomToken, sha256 } from "../lib/staff-crypto";
import { revokeAllStaffSessions } from "../lib/staff-session";
import { requestHostName } from "../lib/ops-host";

/**
 * Staff accounts (Owners only: staff.manage). Mounted at /api/ops/admin behind requireStaffSession.
 * Invite, disable/enable, reset access (new password + authenticator via a one-time link), make or remove Owners.
 * Every change is audited in the same transaction; disabling or resetting ends that person's sessions at once.
 */
const r = Router();
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
const actorOf = (req: any): string => req.staff.id;
export const STAFF_INVITE_HOURS = 72;

const inviteLink = (req: any, token: string) => `https://${requestHostName(req)}/invite#${token}`;

r.get("/staff", requireStaffPermission("staff.manage"), async (_req, res) => {
  const staff = rowsOf(await db.execute(sql`
    SELECT u.id, u.login, u.display_name AS "displayName", u.email, u.is_owner AS "isOwner", u.status,
      u.mfa_enabled_at IS NOT NULL AS "mfaEnabled", u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt",
      coalesce((SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name)
                FROM staff_user_groups m JOIN staff_groups g ON g.id = m.group_id WHERE m.staff_user_id = u.id), '[]'::json) AS groups
    FROM staff_users u ORDER BY u.status, lower(u.display_name)
  `));
  const invites = rowsOf(await db.execute(sql`
    SELECT left(token_hash, 16) AS id, login, display_name AS "displayName", is_owner AS "isOwner", staff_user_id IS NOT NULL AS "reset",
      created_at AS "createdAt", expires_at AS "expiresAt"
    FROM staff_invites WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC
  `));
  res.json({ ok: true, staff, invites });
});

const inviteBody = z.object({
  login: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{1,39}$/, "Login: 2-40 characters, letters, numbers, dot, dash or underscore"),
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255).optional().nullable(),
  groupIds: z.array(z.string().max(100)).max(50).default([]),
  isOwner: z.boolean().default(false),
}).strict();

r.post("/staff/invites", requireStaffPermission("staff.manage"), async (req, res) => {
  const parsed = inviteBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invite" });
  const body = parsed.data;
  const token = randomToken(32);
  const groupJson = JSON.stringify(Array.from(new Set(body.groupIds)));
  let outcome: any;
  try {
  outcome = await db.transaction(async (tx: any) => {
    const taken = rowsOf(await tx.execute(sql`
      SELECT 1 FROM staff_users WHERE login = ${body.login}
      UNION ALL SELECT 1 FROM staff_invites WHERE login = ${body.login} AND staff_user_id IS NULL AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    `));
    if (taken.length) return "taken" as const;
    const groups: string[] = rowsOf(await tx.execute(sql`
      SELECT id FROM staff_groups WHERE id IN (SELECT jsonb_array_elements_text(${groupJson}::jsonb)) ORDER BY id
    `)).map((g) => g.id);
    if (groups.length !== new Set(body.groupIds).size) return "groups" as const;
    const [invite] = rowsOf(await tx.execute(sql`
      INSERT INTO staff_invites (token_hash, login, display_name, email, is_owner, group_ids, created_by, expires_at)
      VALUES (${sha256(token)}, ${body.login}, ${body.displayName}, ${body.email ?? null}, ${body.isOwner},
        ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(groups)}::jsonb)), ${actorOf(req)},
        now() + interval '${sql.raw(String(STAFF_INVITE_HOURS))} hours')
      RETURNING expires_at AS "expiresAt"
    `));
    await writeAudit({ actorId: actorOf(req), action: "staff.invite.create", targetType: "staff_invite", targetId: body.login, details: { login: body.login, displayName: body.displayName, isOwner: body.isOwner, groupIds: groups } }, tx);
    return invite;
  });
  } catch (error) {
    return respond(res, error, "create invite");
  }
  if (outcome === "taken") return res.status(409).json({ ok: false, error: "That login is already used or invited" });
  if (outcome === "groups") return res.status(400).json({ ok: false, error: "Unknown group" });
  res.status(201).json({ ok: true, link: inviteLink(req, token), expiresAt: outcome.expiresAt });
});

r.delete("/staff/invites/:id", requireStaffPermission("staff.manage"), async (req, res) => {
  const id = String(req.params.id);
  if (!/^[0-9a-f]{16}$/.test(id)) return res.status(404).json({ ok: false, error: "Invite not found" });
  const done = await db.transaction(async (tx: any) => {
    const rows = rowsOf(await tx.execute(sql`
      UPDATE staff_invites SET revoked_at = now() WHERE left(token_hash, 16) = ${id} AND used_at IS NULL AND revoked_at IS NULL RETURNING login
    `));
    if (rows.length !== 1) return false;
    await writeAudit({ actorId: actorOf(req), action: "staff.invite.revoke", targetType: "staff_invite", targetId: rows[0].login, details: { login: rows[0].login } }, tx);
    return true;
  });
  if (!done) return res.status(404).json({ ok: false, error: "Invite not found" });
  res.json({ ok: true });
});

const reasonBody = z.object({ reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500) });
const statusBody = reasonBody.extend({ status: z.enum(["active", "disabled"]) }).strict();
const ownerBody = reasonBody.extend({ isOwner: z.boolean() }).strict();

class StaffChangeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Serializes every staff account change, so two Owners can't remove each other at the same moment. */
export const STAFF_CHANGE_LOCK = 72_416_001;

/** Locks the target and checks that at least one other active Owner would remain. */
async function lockTarget(tx: any, req: any, options: { removingOwner: boolean }) {
  // One staff-account change at a time (transaction-scoped): the Owner count below can't go stale before commit.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${STAFF_CHANGE_LOCK})`);
  // Re-check the acting Owner under the lock: a change committed while this request waited may have removed them.
  const actor = rowsOf(await tx.execute(sql`SELECT 1 FROM staff_users WHERE id = ${actorOf(req)} AND is_owner AND status = 'active'`));
  if (!actor.length) throw new StaffChangeError(403, "You don't have permission to do that.");
  const [target] = rowsOf(await tx.execute(sql`
    SELECT id, login, is_owner AS "isOwner", status FROM staff_users WHERE id = ${req.params.id} FOR UPDATE
  `));
  if (!target) throw new StaffChangeError(404, "Staff member not found");
  if (target.id === actorOf(req)) throw new StaffChangeError(400, "You can't do that to your own account. Ask another Owner.");
  if (options.removingOwner && target.isOwner && target.status === "active") {
    const others = rowsOf(await tx.execute(sql`
      SELECT id FROM staff_users WHERE is_owner AND status = 'active' AND id <> ${target.id} ORDER BY id FOR UPDATE
    `)).length;
    if (others < 1) throw new StaffChangeError(400, "There must always be at least one active Owner.");
  }
  return target;
}

function respond(res: any, error: any, label: string) {
  if (error instanceof StaffChangeError) return res.status(error.status).json({ ok: false, error: error.message });
  console.error(`[ops] ${label} failed`, error);
  res.status(500).json({ ok: false, error: `Failed to ${label}` });
}

r.post("/staff/:id/status", requireStaffPermission("staff.manage"), async (req, res) => {
  const parsed = statusBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" });
  try {
    await db.transaction(async (tx: any) => {
      const target = await lockTarget(tx, req, { removingOwner: parsed.data.status === "disabled" });
      if (target.status === parsed.data.status) return;
      await tx.execute(sql`UPDATE staff_users SET status = ${parsed.data.status} WHERE id = ${target.id}`);
      if (parsed.data.status === "disabled") await revokeAllStaffSessions(target.id, tx);
      await writeAudit({ actorId: actorOf(req), action: `staff.user.${parsed.data.status === "disabled" ? "disable" : "enable"}`, targetType: "staff_user", targetId: target.id, reason: parsed.data.reason, details: { login: target.login } }, tx);
    });
    res.json({ ok: true });
  } catch (error) {
    respond(res, error, "change staff status");
  }
});

r.post("/staff/:id/owner", requireStaffPermission("staff.manage"), async (req, res) => {
  const parsed = ownerBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" });
  try {
    await db.transaction(async (tx: any) => {
      const target = await lockTarget(tx, req, { removingOwner: !parsed.data.isOwner });
      if (target.isOwner === parsed.data.isOwner) return;
      await tx.execute(sql`UPDATE staff_users SET is_owner = ${parsed.data.isOwner} WHERE id = ${target.id}`);
      await writeAudit({ actorId: actorOf(req), action: parsed.data.isOwner ? "staff.owner.grant" : "staff.owner.revoke", targetType: "staff_user", targetId: target.id, reason: parsed.data.reason, details: { login: target.login } }, tx);
    });
    res.json({ ok: true });
  } catch (error) {
    respond(res, error, "change Owner");
  }
});

// Forgotten password or lost phone: their sign-ins end now, and a one-time link lets them set a new password and
// set up the authenticator again.
r.post("/staff/:id/reset-access", requireStaffPermission("staff.manage"), async (req, res) => {
  const parsed = reasonBody.strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" });
  const token = randomToken(32);
  try {
    const expiresAt = await db.transaction(async (tx: any) => {
      const target = await lockTarget(tx, req, { removingOwner: false });
      if (target.status !== "active") throw new StaffChangeError(400, "Enable the account first.");
      await tx.execute(sql`
        UPDATE staff_users SET password_hash = NULL, totp_secret_enc = NULL, totp_pending_enc = NULL, totp_last_step = NULL, mfa_enabled_at = NULL
        WHERE id = ${target.id}
      `);
      await tx.execute(sql`DELETE FROM staff_recovery_codes WHERE staff_user_id = ${target.id}`);
      await tx.execute(sql`UPDATE staff_invites SET revoked_at = now() WHERE staff_user_id = ${target.id} AND used_at IS NULL AND revoked_at IS NULL`);
      await revokeAllStaffSessions(target.id, tx);
      const [invite] = rowsOf(await tx.execute(sql`
        INSERT INTO staff_invites (token_hash, staff_user_id, login, display_name, created_by, expires_at)
        SELECT ${sha256(token)}, id, login, display_name, ${actorOf(req)}, now() + interval '${sql.raw(String(STAFF_INVITE_HOURS))} hours'
        FROM staff_users WHERE id = ${target.id}
        RETURNING expires_at AS "expiresAt"
      `));
      await writeAudit({ actorId: actorOf(req), action: "staff.access.reset", targetType: "staff_user", targetId: target.id, reason: parsed.data.reason, details: { login: target.login } }, tx);
      return invite.expiresAt;
    });
    res.json({ ok: true, link: inviteLink(req, token), expiresAt });
  } catch (error) {
    respond(res, error, "reset access");
  }
});

export default r;
