import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { getStaffAccess, writeAudit } from "../lib/staff-permissions";
import {
  StaffPortalConfigError,
  decryptSecret,
  encryptSecret,
  newRecoveryCodes,
  newTotpSecret,
  normalizeRecoveryCode,
  otpauthUri,
  sha256,
  staffPortalConfigured,
  verifyTotp,
} from "../lib/staff-crypto";
import {
  clearStaffCookie,
  createStaffSession,
  readStaffSession,
  revokeStaffSession,
  rotateStaffSession,
  setStaffCookie,
  type StaffSessionInfo,
} from "../lib/staff-session";

/**
 * Staff portal sign-in, mounted at /api/ops/auth (ops host only).
 *
 * Password (step 1), then the authenticator code (step 2) — or, the first time, setting up the authenticator. Five
 * wrong passwords or codes in a row lock the staff account for 15 minutes; every attempt is also rate-limited by IP.
 * Accounts are created only from an Owner's single-use invite link.
 */
export const STAFF_MAX_FAILURES = 5;
export const STAFF_LOCK_MINUTES = 15;
export const STAFF_PASSWORD_MIN = 12;

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
// Compared against when the login doesn't exist, so a wrong login takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("chefsire-staff-portal-dummy-password", 12);

const loginBody = z.object({ login: z.string().trim().toLowerCase().min(1).max(40), password: z.string().min(1).max(200) }).strict();
const codeBody = z.object({ code: z.string().trim().max(20).optional(), recoveryCode: z.string().trim().max(40).optional() }).strict();
const tokenBody = z.object({ token: z.string().min(20).max(100) }).strict();
const acceptBody = z.object({
  token: z.string().min(20).max(100),
  password: z.string().min(STAFF_PASSWORD_MIN, `Use at least ${STAFF_PASSWORD_MIN} characters`).max(200),
}).strict();

function fail(res: Response, status: number, error: string, code?: string) {
  res.status(status).json({ ok: false, ...(code ? { code } : {}), error });
}

/** Records a failed password or code; locks the account at STAFF_MAX_FAILURES. Returns true when this locked it. */
async function recordFailure(staffUserId: string): Promise<boolean> {
  const [row] = rowsOf(await db.execute(sql`
    UPDATE staff_users SET failed_attempts = failed_attempts + 1,
      locked_until = CASE WHEN failed_attempts + 1 >= ${STAFF_MAX_FAILURES} THEN now() + interval '${sql.raw(String(STAFF_LOCK_MINUTES))} minutes' ELSE locked_until END
    WHERE id = ${staffUserId}
    RETURNING failed_attempts >= ${STAFF_MAX_FAILURES} AS locked
  `));
  if (row?.locked) {
    await db.execute(sql`UPDATE staff_users SET failed_attempts = 0 WHERE id = ${staffUserId}`);
    console.warn("[ops] staff account locked after repeated failures", staffUserId);
    return true;
  }
  return false;
}

async function isLocked(staffUserId: string): Promise<boolean> {
  const [row] = rowsOf(await db.execute(sql`SELECT locked_until > now() AS locked FROM staff_users WHERE id = ${staffUserId}`));
  return row?.locked === true;
}

const LOCKED_MESSAGE = `Too many attempts. Try again in ${STAFF_LOCK_MINUTES} minutes, or ask an Owner to reset your access.`;

export function createOpsAuthRouter(options: { limit?: number } = {}) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.limit ?? 30,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { ok: false, error: "Too many attempts. Please try again later." },
  });

  r.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    if (!staffPortalConfigured()) return fail(res, 503, "The staff portal isn't configured yet.", "OPS_NOT_CONFIGURED");
    next();
  });

  // Where am I in signing in? Never an error for a signed-out visitor.
  r.get("/me", async (req, res) => {
    const session = await readStaffSession(req);
    if (!session) return res.json({ ok: true, signedIn: false });
    const base = { ok: true, stage: session.stage, staff: { login: session.staff.login, displayName: session.staff.displayName } };
    if (session.stage !== "full") return res.json({ ...base, signedIn: false });
    base.staff = { ...base.staff, id: session.staff.id } as any;
    const access = await getStaffAccess(session.staff.id);
    res.json({ ...base, signedIn: true, isOwner: access.isOwner, permissions: access.permissions, groups: access.groups });
  });

  r.post("/login", limiter, async (req, res) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Enter your login and password.");
    const { login, password } = parsed.data;
    const [staff] = rowsOf(await db.execute(sql`
      SELECT id, password_hash AS "passwordHash", status, mfa_enabled_at IS NOT NULL AS "mfaEnabled", locked_until > now() AS locked
      FROM staff_users WHERE login = ${login}
    `));
    const ok = await bcrypt.compare(password, staff?.passwordHash || DUMMY_HASH);
    if (!staff || staff.status !== "active" || !staff.passwordHash) return fail(res, 401, "Wrong login or password.");
    if (staff.locked) return fail(res, 423, LOCKED_MESSAGE, "STAFF_LOCKED");
    if (!ok) {
      if (await recordFailure(staff.id)) return fail(res, 423, LOCKED_MESSAGE, "STAFF_LOCKED");
      return fail(res, 401, "Wrong login or password.");
    }
    await db.execute(sql`UPDATE staff_users SET failed_attempts = 0 WHERE id = ${staff.id}`);
    const stage = staff.mfaEnabled ? "mfa" : "enroll";
    setStaffCookie(res, await createStaffSession(staff.id, stage, req));
    res.json({ ok: true, stage });
  });

  async function pending(req: Request, res: Response, stage: "mfa" | "enroll"): Promise<StaffSessionInfo | null> {
    const session = await readStaffSession(req);
    if (!session || session.stage !== stage) {
      fail(res, 401, "Your sign-in expired. Start again.", "STAFF_SIGN_IN_REQUIRED");
      return null;
    }
    return session;
  }

  // First sign-in: a new authenticator secret (kept encrypted until the first code confirms it).
  r.post("/mfa/setup", async (req, res) => {
    const session = await pending(req, res, "enroll");
    if (!session) return;
    const secret = newTotpSecret();
    await db.execute(sql`UPDATE staff_users SET totp_pending_enc = ${encryptSecret(secret)} WHERE id = ${session.staff.id}`);
    res.json({ ok: true, secret, uri: otpauthUri(secret, session.staff.login) });
  });

  r.post("/mfa/enroll", limiter, async (req, res) => {
    const session = await pending(req, res, "enroll");
    if (!session) return;
    const parsed = codeBody.safeParse(req.body);
    if (!parsed.success || !parsed.data.code) return fail(res, 400, "Enter the 6-digit code from your authenticator app.");
    const [row] = rowsOf(await db.execute(sql`SELECT totp_pending_enc AS "pendingEnc" FROM staff_users WHERE id = ${session.staff.id}`));
    if (!row?.pendingEnc) return fail(res, 400, "Set up your authenticator first.");
    const secret = decryptSecret(row.pendingEnc);
    const step = verifyTotp(secret, parsed.data.code);
    if (step === null) return fail(res, 401, "That code didn't match. Check the time on your phone and try again.");
    const codes = newRecoveryCodes();
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`
        UPDATE staff_users SET totp_secret_enc = totp_pending_enc, totp_pending_enc = NULL, totp_last_step = ${step},
          mfa_enabled_at = now(), failed_attempts = 0, last_login_at = now()
        WHERE id = ${session.staff.id}
      `);
      await tx.execute(sql`DELETE FROM staff_recovery_codes WHERE staff_user_id = ${session.staff.id}`);
      for (const code of codes) {
        await tx.execute(sql`INSERT INTO staff_recovery_codes (staff_user_id, code_hash) VALUES (${session.staff.id}, ${sha256(normalizeRecoveryCode(code))})`);
      }
      await writeAudit({ actorId: session.staff.id, action: "staff.mfa.enrolled", targetType: "staff_user", targetId: session.staff.id }, tx);
      await rotateStaffSession(req, res, session, "full", tx);
    });
    res.json({ ok: true, stage: "full", recoveryCodes: codes });
  });

  r.post("/mfa/verify", limiter, async (req, res) => {
    const session = await pending(req, res, "mfa");
    if (!session) return;
    const parsed = codeBody.safeParse(req.body);
    if (!parsed.success || (!parsed.data.code && !parsed.data.recoveryCode)) return fail(res, 400, "Enter the 6-digit code from your authenticator app.");
    if (await isLocked(session.staff.id)) return fail(res, 423, LOCKED_MESSAGE, "STAFF_LOCKED");
    let method: "authenticator" | "recovery code" | null = null;
    if (parsed.data.code) {
      const [row] = rowsOf(await db.execute(sql`SELECT totp_secret_enc AS "secretEnc" FROM staff_users WHERE id = ${session.staff.id}`));
      const step = row?.secretEnc ? verifyTotp(decryptSecret(row.secretEnc), parsed.data.code) : null;
      // Each code works once: the step must be newer than the last one accepted (checked and recorded atomically).
      if (step !== null) {
        const used = rowsOf(await db.execute(sql`
          UPDATE staff_users SET totp_last_step = ${step} WHERE id = ${session.staff.id} AND (totp_last_step IS NULL OR totp_last_step < ${step}) RETURNING id
        `));
        if (used.length) method = "authenticator";
      }
    } else if (parsed.data.recoveryCode) {
      const used = rowsOf(await db.execute(sql`
        UPDATE staff_recovery_codes SET used_at = now()
        WHERE staff_user_id = ${session.staff.id} AND code_hash = ${sha256(normalizeRecoveryCode(parsed.data.recoveryCode))} AND used_at IS NULL
        RETURNING code_hash
      `));
      if (used.length) method = "recovery code";
    }
    if (!method) {
      if (await recordFailure(session.staff.id)) {
        await revokeStaffSession(session.hash);
        clearStaffCookie(res);
        return fail(res, 423, LOCKED_MESSAGE, "STAFF_LOCKED");
      }
      return fail(res, 401, "That code didn't work. Codes can only be used once.");
    }
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`UPDATE staff_users SET failed_attempts = 0, last_login_at = now() WHERE id = ${session.staff.id}`);
      await writeAudit({ actorId: session.staff.id, action: "staff.signin", targetType: "staff_user", targetId: session.staff.id, details: { method, ip: req.ip ?? null } }, tx);
      await rotateStaffSession(req, res, session, "full", tx);
    });
    res.json({ ok: true, stage: "full" });
  });

  r.post("/logout", async (req, res) => {
    const session = await readStaffSession(req);
    if (session) await revokeStaffSession(session.hash);
    clearStaffCookie(res);
    res.json({ ok: true });
  });

  async function findInvite(token: string, executor: any = db, lock = false) {
    const [invite] = rowsOf(await executor.execute(sql`
      SELECT token_hash AS "tokenHash", staff_user_id AS "staffUserId", login, display_name AS "displayName", email,
        is_owner AS "isOwner", group_ids AS "groupIds", created_by AS "createdBy"
      FROM staff_invites
      WHERE token_hash = ${sha256(token)} AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
      ${lock ? sql`FOR UPDATE` : sql``}
    `));
    return invite ?? null;
  }

  // The invite link is https://<ops host>/invite#<token>; the fragment never reaches server logs, the page posts it here.
  r.post("/invite/check", limiter, async (req, res) => {
    const parsed = tokenBody.safeParse(req.body);
    const invite = parsed.success ? await findInvite(parsed.data.token) : null;
    if (!invite) return fail(res, 404, "This link is invalid, already used or expired. Ask an Owner for a new one.");
    res.json({ ok: true, login: invite.login, displayName: invite.displayName, reset: Boolean(invite.staffUserId) });
  });

  r.post("/invite/accept", limiter, async (req, res) => {
    const parsed = acceptBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Invalid request");
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const outcome = await db.transaction(async (tx: any) => {
      const invite = await findInvite(parsed.data.token, tx, true);
      if (!invite) return null;
      let staffId: string;
      if (invite.staffUserId) {
        // Access reset by an Owner: new password; the authenticator is set up again on this sign-in.
        const updated = rowsOf(await tx.execute(sql`
          UPDATE staff_users SET password_hash = ${passwordHash}, totp_secret_enc = NULL, totp_pending_enc = NULL, totp_last_step = NULL,
            mfa_enabled_at = NULL, failed_attempts = 0, locked_until = NULL
          WHERE id = ${invite.staffUserId} AND status = 'active' RETURNING id
        `));
        if (!updated.length) return null;
        staffId = invite.staffUserId;
        await tx.execute(sql`DELETE FROM staff_recovery_codes WHERE staff_user_id = ${staffId}`);
      } else {
        const [created] = rowsOf(await tx.execute(sql`
          INSERT INTO staff_users (login, display_name, email, password_hash, is_owner, created_by)
          VALUES (${invite.login}, ${invite.displayName}, ${invite.email}, ${passwordHash}, ${invite.isOwner}, ${invite.createdBy})
          RETURNING id
        `));
        staffId = created.id;
        for (const groupId of invite.groupIds ?? []) {
          await tx.execute(sql`
            INSERT INTO staff_user_groups (staff_user_id, group_id, added_by)
            SELECT ${staffId}, id, ${invite.createdBy} FROM staff_groups WHERE id = ${groupId} ON CONFLICT DO NOTHING
          `);
        }
      }
      await tx.execute(sql`UPDATE staff_invites SET used_at = now() WHERE token_hash = ${invite.tokenHash}`);
      await writeAudit({
        actorId: staffId,
        action: invite.staffUserId ? "staff.access.reset.completed" : "staff.user.created",
        targetType: "staff_user",
        targetId: staffId,
        details: { login: invite.login, invitedBy: invite.createdBy, isOwner: invite.isOwner, groupIds: invite.groupIds },
      }, tx);
      const token = await createStaffSession(staffId, "enroll", req, tx);
      return token;
    }).catch((error: any) => {
      if (error?.code === "23505") return "taken" as const;
      throw error;
    });
    if (outcome === "taken") return fail(res, 409, "That login is already in use. Ask an Owner for a new invite.");
    if (!outcome) return fail(res, 404, "This link is invalid, already used or expired. Ask an Owner for a new one.");
    setStaffCookie(res, outcome);
    res.status(201).json({ ok: true, stage: "enroll" });
  });

  r.use((error: any, _req: Request, res: Response, next: (e?: any) => void) => {
    if (res.headersSent) return next(error);
    if (error instanceof StaffPortalConfigError) return fail(res, 503, "The staff portal isn't configured yet.", "OPS_NOT_CONFIGURED");
    console.error("[ops] auth error", error);
    fail(res, 500, "Something went wrong. Try again.");
  });

  return r;
}
