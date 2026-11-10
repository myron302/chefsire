import type { Request, RequestHandler, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { randomToken, sha256 } from "./staff-crypto";
import { requestHostName } from "./ops-host";

/**
 * Staff portal sessions. Completely separate from member sign-in: a different cookie, server-side session rows, and
 * nothing a member token can satisfy.
 *
 * The cookie is "__Host-" prefixed (host-only, Secure, Path=/), HttpOnly and SameSite=Strict, and holds a random id;
 * only its SHA-256 is stored. A session ends after STAFF_IDLE_MINUTES without activity, after STAFF_SESSION_HOURS in
 * all, when the staff account is disabled, or when an Owner revokes it. Signing in issues a fresh id at each stage
 * (password, then authenticator code), so a pre-sign-in id is never the one that ends up signed in.
 */
export const STAFF_COOKIE = "__Host-chefsire_ops";
export const STAFF_IDLE_MINUTES = 30;
export const STAFF_SESSION_HOURS = 12;
/** A session that has passed the password step but not the code step lasts this long. */
export const STAFF_PENDING_MINUTES = 10;

export type StaffStage = "mfa" | "enroll" | "full";
export type StaffIdentity = { id: string; login: string; displayName: string; isOwner: boolean; mfaEnabled: boolean };
export type StaffSessionInfo = { hash: string; stage: StaffStage; staff: StaffIdentity };

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

function cookieToken(req: Request): string | null {
  const fromParser = (req as any).cookies?.[STAFF_COOKIE];
  if (typeof fromParser === "string" && fromParser) return fromParser;
  const header = String(req.headers.cookie ?? "");
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === STAFF_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function createStaffSession(
  staffUserId: string,
  stage: StaffStage,
  req: Request,
  executor: any = db,
): Promise<string> {
  const token = randomToken(32);
  const lifetime = stage === "full" ? sql`interval '${sql.raw(String(STAFF_SESSION_HOURS))} hours'` : sql`interval '${sql.raw(String(STAFF_PENDING_MINUTES))} minutes'`;
  await executor.execute(sql`
    INSERT INTO staff_sessions (id_hash, staff_user_id, stage, expires_at, ip, user_agent)
    VALUES (${sha256(token)}, ${staffUserId}, ${stage}, now() + ${lifetime}, ${req.ip ?? null}, ${String(req.headers["user-agent"] ?? "").slice(0, 300)})
  `);
  return token;
}

export function setStaffCookie(res: Response, token: string) {
  res.cookie(STAFF_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
}

export function clearStaffCookie(res: Response) {
  res.clearCookie(STAFF_COOKIE, { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
}

export async function revokeStaffSession(hash: string, executor: any = db) {
  await executor.execute(sql`UPDATE staff_sessions SET revoked_at = now() WHERE id_hash = ${hash} AND revoked_at IS NULL`);
}

export async function revokeAllStaffSessions(staffUserId: string, executor: any = db) {
  await executor.execute(sql`UPDATE staff_sessions SET revoked_at = now() WHERE staff_user_id = ${staffUserId} AND revoked_at IS NULL`);
}

/** Replaces the current session with a new one at `stage` (new id; the old one stops working). */
export async function rotateStaffSession(req: Request, res: Response, current: StaffSessionInfo, stage: StaffStage, executor: any = db) {
  await revokeStaffSession(current.hash, executor);
  const token = await createStaffSession(current.staff.id, stage, req, executor);
  setStaffCookie(res, token);
}

/** The live session for this request, or null. Expired, idle, revoked or disabled-account sessions don't count. */
export async function readStaffSession(req: Request): Promise<StaffSessionInfo | null> {
  const token = cookieToken(req);
  if (!token || token.length > 100) return null;
  const hash = sha256(token);
  const [row] = rowsOf(await db.execute(sql`
    SELECT s.stage, s.last_seen_at < now() - interval '1 minute' AS "touch",
      u.id, u.login, u.display_name AS "displayName", u.is_owner AS "isOwner", u.mfa_enabled_at IS NOT NULL AS "mfaEnabled"
    FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_user_id
    WHERE s.id_hash = ${hash}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND s.last_seen_at > now() - interval '${sql.raw(String(STAFF_IDLE_MINUTES))} minutes'
      AND u.status = 'active'
  `));
  if (!row) return null;
  if (row.touch) await db.execute(sql`UPDATE staff_sessions SET last_seen_at = now() WHERE id_hash = ${hash}`);
  return {
    hash,
    stage: row.stage,
    staff: { id: row.id, login: row.login, displayName: row.displayName, isOwner: row.isOwner === true, mfaEnabled: row.mfaEnabled === true },
  };
}

/**
 * Cross-site request protection for every state-changing staff request. SameSite=Strict alone isn't enough here:
 * chefsire.com and ops.chefsire.com are the same "site", so the browser would send the staff cookie on a request a
 * customer page started. So a write must carry the portal's own header (which a cross-origin page can't send without
 * a preflight, and the ops host refuses preflights), and when the browser reports the origin, it must be this host.
 */
export const OPS_REQUEST_HEADER = "x-chefsire-ops";
export const requireOpsRequestOrigin: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  const deny = () => res.status(403).json({ ok: false, code: "OPS_ORIGIN_REQUIRED", error: "This request must come from the staff portal." });
  if (req.headers[OPS_REQUEST_HEADER] !== "1") return deny();
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin") return deny();
  const origin = req.headers.origin;
  if (origin !== undefined) {
    try {
      const url = new URL(String(origin));
      if (url.host.toLowerCase() !== String(req.headers.host ?? "").toLowerCase() || url.hostname.toLowerCase() !== requestHostName(req)) return deny();
    } catch {
      return deny();
    }
  }
  next();
};

/** Requires a signed-in staff session (password and authenticator code). Attaches req.staff. */
export const requireStaffSession: RequestHandler = async (req, res, next) => {
  try {
    res.set("Cache-Control", "private, no-store");
    const session = await readStaffSession(req);
    if (!session || session.stage !== "full") {
      res.status(401).json({ ok: false, code: "STAFF_SIGN_IN_REQUIRED", error: "Sign in to the staff portal." });
      return;
    }
    (req as any).staff = session.staff;
    (req as any).staffSession = session;
    next();
  } catch (error) {
    console.error("[ops] session check failed; refusing.", (error as Error)?.message);
    res.status(503).json({ ok: false, error: "The staff portal is unavailable. Try again." });
  }
};

export const staffOf = (req: Request): StaffIdentity => (req as any).staff;
