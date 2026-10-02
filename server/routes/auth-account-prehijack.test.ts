/**
 * P2-1: account pre-hijack through unverified signup.
 *
 * Real HTTP against the real auth router, the real AuthService / OAuth account-linking code and
 * the real storage layer, with the rendered SQL executed by a REAL local PostgreSQL
 * (set CS_TEST_PG_URL; skipped otherwise). The URL goes through the loopback-only guard first.
 *
 * Invariant: proof of email ownership must not activate an attacker-chosen password.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import pg from "pg";
import type { AddressInfo } from "node:net";
import { getTableColumns } from "drizzle-orm";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

process.env.DATABASE_URL ||= "postgres://u:p@prehijack-tests.invalid/none";
const PG_URL = process.env.CS_TEST_PG_URL;

if (!PG_URL) {
  test("account pre-hijack (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = new pg.Pool(parseLocalTestDatabaseUrl(PG_URL));
  const { pool } = await import("../db/index");
  (pool as any).connect = () => local.connect();
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));

  const { users } = await import("../../shared/schema");
  const userCols = Object.values(getTableColumns(users)).map((c: any) =>
    c.name === "id" ? `id varchar PRIMARY KEY DEFAULT gen_random_uuid()`
      : c.name === "username" || c.name === "email" ? `${c.name} text NOT NULL UNIQUE`
      : `${c.name} ${c.columnType === "PgTimestamp" ? "timestamp" : "text"}`);
  await local.query(`
    DROP TABLE IF EXISTS email_verification_tokens, users CASCADE;
    CREATE TABLE users (${userCols.join(",")});
    CREATE TABLE email_verification_tokens (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, token_hash varchar(64) NOT NULL,
      email varchar(255) NOT NULL, expires_at timestamp NOT NULL DEFAULT now() + interval '24 hours', consumed_at timestamp, created_at timestamp NOT NULL DEFAULT now());`);

  const { default: authRouter } = await import("./auth");
  const { AuthService } = await import("../services/auth.service");
  const { verifyGoogleProfile } = await import("../services/google-oauth.service");
  const { verifyFacebookProfile } = await import("../services/facebook-oauth.service");
  const { hasCurrentAdminAuthority } = await import("../lib/admin-authority");

  // Capture the emailed token instead of sending mail.
  let lastToken = "";
  (AuthService as any).sendVerificationEmail = async (_e: string, token: string) => { lastToken = token; };

  const app = express();
  app.set("trust proxy", true); // each request presents a fresh client IP so the per-IP rate limiters stay out of the way
  let ipCounter = 0;
  const nextIp = () => `10.${(++ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api", authRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });
  test.beforeEach(async () => { await local.query(`TRUNCATE email_verification_tokens, users CASCADE`); lastToken = ""; });

  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post = (p: string, b: unknown) => fetch(base() + p, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": nextIp() }, body: JSON.stringify(b) });
  const login = (email: string, password: string) => post("/auth/login", { email, password });
  const redeem = (token: string, password: string) =>
    fetch(`${base()}/auth/verify-email`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": nextIp() }, body: new URLSearchParams({ token, password }) });
  const row = async (email: string) => (await local.query(`SELECT * FROM users WHERE email=$1`, [email])).rows[0];
  const signup = async (email: string, password: string, username = email.split("@")[0]) => {
    const r = await post("/auth/signup", { firstName: "F", lastName: "L", username, email, password });
    assert.equal(r.status, 201);
    return lastToken;
  };
  const googleProfile = (id: string, email: string, verified: boolean | undefined) => ({
    id, emails: [{ value: email, ...(verified === undefined ? {} : { verified }) }], name: { givenName: "G", familyName: "U" }, photos: [{ value: "https://g/p.png" }], _json: {},
  });
  const facebookProfile = (id: string, email: string) => ({ id, emails: [{ value: email }], name: { givenName: "F", familyName: "B" }, displayName: "FB User", photos: [] });
  const runVerify = (fn: Function, profile: any) => new Promise<{ err?: Error; user?: any }>((resolve) => fn("a", "r", profile, (err: any, user: any) => resolve({ err, user })));

  const VICTIM = "victim@example.com";

  // ---------- A: attacker pre-registration + email verification ----------
  test("A: victim verifying the emailed link does not activate the attacker's password", async () => {
    const token = await signup(VICTIM, "attacker-pw");
    assert.equal((await login(VICTIM, "attacker-pw")).status, 403, "unverified accounts cannot log in");

    // Opening the link only shows the form; nothing is verified by a GET.
    const page = await fetch(`${base()}/auth/verify-email?token=${token}`, { headers: { "x-forwarded-for": nextIp() } });
    assert.equal(page.status, 200);
    assert.equal((await row(VICTIM)).email_verified_at, null);

    const done = await redeem(token, "victim-own-pw");
    assert.equal(done.status, 303);
    assert.notEqual((await row(VICTIM)).email_verified_at, null);

    assert.equal((await login(VICTIM, "attacker-pw")).status, 401, "attacker password must not authenticate");
    assert.equal((await login(VICTIM, "victim-own-pw")).status, 200);
  });

  test("A2: replayed / concurrent redemptions cannot restore or race a credential", async () => {
    const token = await signup(VICTIM, "attacker-pw");
    const [r1, r2] = await Promise.all([redeem(token, "winner-pw-1"), redeem(token, "winner-pw-2")]);
    assert.deepEqual([r1.status, r2.status].sort(), [303, 400]);
    const winner = r1.status === 303 ? "winner-pw-1" : "winner-pw-2";
    assert.equal((await login(VICTIM, winner)).status, 200);

    const replay = await redeem(token, "attacker-pw");
    assert.equal(replay.status, 400);
    assert.equal((await login(VICTIM, "attacker-pw")).status, 401);
    assert.equal((await login(VICTIM, winner)).status, 200, "replay left the established password alone");
  });

  test("A3: short passwords and malformed tokens are rejected without consuming the token", async () => {
    const token = await signup(VICTIM, "attacker-pw");
    assert.equal((await redeem(token, "123")).status, 400);
    assert.equal((await redeem("not-a-token", "long-enough-pw")).status, 400);
    assert.equal((await row(VICTIM)).email_verified_at, null);
    assert.equal((await redeem(token, "long-enough-pw")).status, 303);
  });

  // ---------- B: attacker pre-registration + Google ----------
  test("B: verified Google linking discards the attacker's pre-verification password", async () => {
    await signup(VICTIM, "attacker-pw");
    const { err, user } = await runVerify(verifyGoogleProfile, googleProfile("g-1", VICTIM, true));
    assert.ok(!err);
    assert.equal(user.password, null);
    const r = await row(VICTIM);
    assert.equal(r.google_id, "g-1");
    assert.notEqual(r.email_verified_at, null);
    assert.equal(r.password, null);
    assert.equal((await login(VICTIM, "attacker-pw")).status, 401);
    // Outstanding verification links issued during the attack no longer redeem.
    assert.equal(lastToken === "" ? 400 : (await redeem(lastToken, "attacker-pw2")).status, 400);
    assert.equal((await login(VICTIM, "attacker-pw2")).status, 401);
  });

  test("B2: verification racing a Google link never leaves the attacker credential usable", async () => {
    const token = await signup(VICTIM, "attacker-pw");
    await Promise.all([redeem(token, "victim-own-pw"), runVerify(verifyGoogleProfile, googleProfile("g-1", VICTIM, true))]);
    assert.equal((await login(VICTIM, "attacker-pw")).status, 401);
    const r = await row(VICTIM);
    assert.notEqual(r.email_verified_at, null);
    assert.equal(r.google_id, "g-1");
  });

  test("I: duplicate Google callbacks are idempotent and do not resurrect credentials", async () => {
    await signup(VICTIM, "attacker-pw");
    const a = await runVerify(verifyGoogleProfile, googleProfile("g-1", VICTIM, true));
    const b = await runVerify(verifyGoogleProfile, googleProfile("g-1", VICTIM, true));
    assert.equal(a.user.id, b.user.id);
    assert.equal((await row(VICTIM)).password, null);
    assert.equal((await login(VICTIM, "attacker-pw")).status, 401);
  });

  // ---------- C: Facebook ----------
  test("C: Facebook cannot link to or verify an existing account by email", async () => {
    await signup(VICTIM, "attacker-pw");
    const before = await row(VICTIM);
    const { err, user } = await runVerify(verifyFacebookProfile, facebookProfile("fb-1", VICTIM));
    assert.ok(err);
    assert.equal(user, undefined);
    assert.deepEqual(await row(VICTIM), before, "account untouched");
  });

  test("C2: a Facebook-created account is never born verified, and a later verified Google link evicts the Facebook identity", async () => {
    const { user } = await runVerify(verifyFacebookProfile, facebookProfile("fb-attacker", VICTIM));
    const created = await row(VICTIM);
    assert.equal(created.email_verified_at, null);
    assert.equal(created.password, null);
    assert.equal(user.id, created.id);

    const g = await runVerify(verifyGoogleProfile, googleProfile("g-1", VICTIM, true));
    assert.ok(!g.err);
    const after = await row(VICTIM);
    assert.equal(after.facebook_id, null, "attacker's Facebook identity discarded");
    assert.equal(after.google_id, "g-1");
    // The attacker's Facebook identity no longer resolves to this account: it would create a fresh one (here: email clash -> refused).
    const again = await runVerify(verifyFacebookProfile, facebookProfile("fb-attacker", VICTIM));
    assert.ok(again.err);
  });

  // ---------- D: unverified provider email ----------
  test("D: an unverified Google email neither links, verifies, nor creates an account", async () => {
    await signup(VICTIM, "attacker-pw");
    const before = await row(VICTIM);
    for (const verified of [false, undefined]) {
      const { err } = await runVerify(verifyGoogleProfile, googleProfile("g-1", VICTIM, verified as any));
      assert.ok(err, `verified=${verified} must fail closed`);
    }
    assert.deepEqual(await row(VICTIM), before);
    const fresh = await runVerify(verifyGoogleProfile, googleProfile("g-2", "new@example.com", false));
    assert.ok(fresh.err);
    assert.equal(await row("new@example.com"), undefined);
  });

  // ---------- E: normal signup ----------
  test("E: ordinary signup + verification yields a working account", async () => {
    const token = await signup("new@example.com", "my-chosen-pw");
    assert.equal((await redeem(token, "my-chosen-pw")).status, 303);
    assert.equal((await login("new@example.com", "my-chosen-pw")).status, 200);
    assert.equal((await login("new@example.com", "other-pw")).status, 401);
  });

  // ---------- F: existing verified password account ----------
  test("F: a verified password account keeps its password (also across a Google link)", async () => {
    const token = await signup("old@example.com", "old-pw-123");
    await redeem(token, "old-pw-123");
    assert.equal((await login("old@example.com", "old-pw-123")).status, 200);
    const g = await runVerify(verifyGoogleProfile, googleProfile("g-9", "old@example.com", true));
    assert.ok(!g.err);
    assert.equal((await login("old@example.com", "old-pw-123")).status, 200, "legitimate link must not strip the password");
    assert.equal((await row("old@example.com")).google_id, "g-9");
  });

  // ---------- G: OAuth-only ----------
  test("G: OAuth-only accounts work and gain no local password", async () => {
    const created = await runVerify(verifyGoogleProfile, googleProfile("g-5", "oauth@example.com", true));
    assert.ok(!created.err);
    const r = await row("oauth@example.com");
    assert.equal(r.password, null);
    assert.notEqual(r.email_verified_at, null);
    assert.equal((await login("oauth@example.com", "anything")).status, 401, "no password => clean 401, not a crash");
    const again = await runVerify(verifyGoogleProfile, googleProfile("g-5", "oauth@example.com", true));
    assert.equal(again.user.id, created.user.id);
  });

  // ---------- H: admin email ----------
  test("H: pre-registering an INTERNAL_ADMIN_EMAILS address yields no credential or authority", async () => {
    const ADMIN = "boss@chefsire.test";
    const prev = process.env.INTERNAL_ADMIN_EMAILS;
    process.env.INTERNAL_ADMIN_EMAILS = ADMIN;
    try {
      const token = await signup(ADMIN, "attacker-pw");
      const poisoned = await row(ADMIN);
      assert.equal(await hasCurrentAdminAuthority(poisoned.id), false, "unverified claimant holds no authority");
      assert.equal((await login(ADMIN, "attacker-pw")).status, 403);

      // Real owner proves control (email path).
      assert.equal((await redeem(token, "owner-pw-123")).status, 303);
      assert.equal((await login(ADMIN, "attacker-pw")).status, 401);
      assert.equal((await login(ADMIN, "owner-pw-123")).status, 200);
      assert.equal(await hasCurrentAdminAuthority(poisoned.id), true, "legitimate verified owner keeps authority");
    } finally {
      if (prev === undefined) delete process.env.INTERNAL_ADMIN_EMAILS; else process.env.INTERNAL_ADMIN_EMAILS = prev;
    }
  });

  test("H2: admin address via Google link or via an unvouched Facebook account", async () => {
    const ADMIN = "boss@chefsire.test";
    const prev = process.env.INTERNAL_ADMIN_EMAILS;
    process.env.INTERNAL_ADMIN_EMAILS = ADMIN;
    try {
      // Attacker's Facebook account claiming the admin address: logs in via OAuth but holds no authority.
      const fb = await runVerify(verifyFacebookProfile, facebookProfile("fb-evil", ADMIN));
      assert.equal(await hasCurrentAdminAuthority(fb.user.id), false);
      // The real owner's verified Google identity takes the account over and evicts the attacker.
      const g = await runVerify(verifyGoogleProfile, googleProfile("g-boss", ADMIN, true));
      assert.equal(await hasCurrentAdminAuthority(g.user.id), true);
      assert.equal((await row(ADMIN)).facebook_id, null);

      // Same for a pre-registered password account.
      await local.query(`TRUNCATE users CASCADE`);
      await signup(ADMIN, "attacker-pw");
      const g2 = await runVerify(verifyGoogleProfile, googleProfile("g-boss", ADMIN, true));
      assert.equal(await hasCurrentAdminAuthority(g2.user.id), true);
      assert.equal((await login(ADMIN, "attacker-pw")).status, 401);
    } finally {
      if (prev === undefined) delete process.env.INTERNAL_ADMIN_EMAILS; else process.env.INTERNAL_ADMIN_EMAILS = prev;
    }
  });
}
