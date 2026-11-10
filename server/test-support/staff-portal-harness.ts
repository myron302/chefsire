/**
 * Staff portal test helpers: the production DDL for the back office, staff accounts with ready-made signed-in sessions,
 * and a caller that talks to /api/ops the way the portal page does (session cookie + the portal's request header).
 */
import { readFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import type pg from "pg";

process.env.STAFF_SECRET_KEY ||= "test-staff-portal-secret-key-0123456789abcdef";

export const BACK_OFFICE_SQL = [
  "../../docs/ops/2026-11-09-staff-groups.sql",
  "../../docs/ops/2026-11-10-account-status.sql",
  "../../docs/ops/2026-11-10-staff-portal.sql",
].map((p) => readFileSync(new URL(p, import.meta.url), "utf8")).join("\n");

export const DROP_BACK_OFFICE = `DROP TABLE IF EXISTS staff_user_groups, staff_invites, staff_recovery_codes, staff_sessions, staff_users,
  account_status, admin_audit_log, staff_group_members, staff_group_permissions, staff_groups CASCADE;
  DROP FUNCTION IF EXISTS admin_audit_log_append_only CASCADE;`;

/** Cleanup: drop the back office tables but leave an empty account_status, which other suites' sign-ins read. */
export const CLEAN_UP_BACK_OFFICE = `${DROP_BACK_OFFICE}
  CREATE TABLE IF NOT EXISTS account_status (user_id varchar PRIMARY KEY, status text NOT NULL, reason text, changed_by varchar,
    changed_at timestamptz NOT NULL DEFAULT now());`;

export const STAFF_COOKIE_NAME = "__Host-chefsire_ops";

/** A staff account that has finished setup, with a signed-in session. Returns its id and session cookie. */
export async function makeStaff(local: pg.Pool, login: string, options: { isOwner?: boolean; groups?: string[]; displayName?: string } = {}) {
  const displayName = options.displayName ?? login[0].toUpperCase() + login.slice(1);
  const { id } = (await local.query(
    `INSERT INTO staff_users (login, display_name, password_hash, totp_secret_enc, mfa_enabled_at, is_owner)
     VALUES ($1, $2, 'fixture', 'fixture', now(), $3) RETURNING id`,
    [login, displayName, options.isOwner === true],
  )).rows[0];
  for (const g of options.groups ?? []) await local.query("INSERT INTO staff_user_groups (staff_user_id, group_id) VALUES ($1, $2)", [id, g]);
  const token = randomBytes(32).toString("base64url");
  await local.query(
    "INSERT INTO staff_sessions (id_hash, staff_user_id, stage, expires_at) VALUES ($1, $2, 'full', now() + interval '1 hour')",
    [createHash("sha256").update(token).digest("hex"), id],
  );
  return { id: id as string, cookie: `${STAFF_COOKIE_NAME}=${token}` };
}

export function makeStaffCaller(getBase: () => string, cookieOf: (who: string) => string | undefined) {
  return async function call(method: string, path: string, as: string | "anon" = "anon", body?: unknown, extraHeaders: Record<string, string> = {}) {
    const cookie = as === "anon" ? undefined : cookieOf(as);
    const res = await fetch(getBase() + path, {
      method,
      headers: {
        "x-chefsire-ops": "1",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, text, headers: res.headers, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
  };
}
