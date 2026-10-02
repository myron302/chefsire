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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

process.env.DATABASE_URL ||= "postgres://u:p@prehijack-tests.invalid/none";
const PG_URL = process.env.CS_TEST_PG_URL;
const MIGRATION_SQL = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations/20261002_email_verification_provenance.sql"), "utf8");

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
  const { applyMigration } = await import("../scripts/migration-runner");

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
  const resend = (email: string) => post("/auth/resend-verification", { email });
  const seedRow = async (r: { email: string; password?: string | null; verifiedAt?: boolean; via?: string | null; google?: string; facebook?: string; tiktok?: string; provider?: string }) =>
    (await local.query(
      `INSERT INTO users (username, email, display_name, password, email_verified_at, email_verified_via, google_id, facebook_id, tiktok_id, provider)
       VALUES ($1,$1,'d',$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [r.email, r.password ?? null, r.verifiedAt ? new Date() : null, r.via ?? null, r.google ?? null, r.facebook ?? null, r.tiktok ?? null, r.provider ?? null])).rows[0].id as string;
  const withAdmin = async (email: string, fn: () => Promise<void>) => {
    const prev = process.env.INTERNAL_ADMIN_EMAILS;
    process.env.INTERNAL_ADMIN_EMAILS = email;
    try { await fn(); } finally { if (prev === undefined) delete process.env.INTERNAL_ADMIN_EMAILS; else process.env.INTERNAL_ADMIN_EMAILS = prev; }
  };
  const runMigration = async () => {
    await local.query(`CREATE TABLE IF NOT EXISTS _app_migrations (filename text primary key, applied_at timestamptz not null default now())`);
    const c = await local.connect();
    try { await applyMigration(c as any, "server:20261002_email_verification_provenance.sql", MIGRATION_SQL, { error() {} } as any); } finally { c.release(); }
  };

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

  // ---------- P1 (re-review): provider identities attached before proof must not survive email verification ----------
  test("PI-1: attacker's Facebook identity on an unverified account is cleared by legitimate email verification", async () => {
    const fb = await runVerify(verifyFacebookProfile, facebookProfile("fb-attacker", VICTIM));
    assert.equal((await row(VICTIM)).facebook_id, "fb-attacker");
    assert.equal((await resend(VICTIM)).status, 200);
    assert.equal((await redeem(lastToken, "victim-own-pw")).status, 303);
    const r = await row(VICTIM);
    assert.equal(r.facebook_id, null);
    assert.equal(r.provider, "local");
    assert.equal(r.email_verified_via, "email_link");
    assert.equal(r.id, fb.user.id, "same account, owner now holds it");
    // The stale Facebook identity no longer resolves to the account.
    const stale = await runVerify(verifyFacebookProfile, facebookProfile("fb-attacker", VICTIM));
    assert.ok(stale.err);
    assert.equal((await login(VICTIM, "victim-own-pw")).status, 200);
  });

  test("PI-2: attacker's TikTok (and any other provider) identity is cleared; replay cannot restore it", async () => {
    // Exactly the row the TikTok strategy creates: unverified, no password, tiktok id.
    const id = await seedRow({ email: VICTIM, tiktok: "tt-attacker", facebook: "fb-x", google: "g-x", provider: "tiktok" });
    assert.equal((await resend(VICTIM)).status, 200);
    const token = lastToken;
    assert.equal((await redeem(token, "victim-own-pw")).status, 303);
    const r = await row(VICTIM);
    assert.equal(r.id, id);
    for (const col of ["tiktok_id", "facebook_id", "google_id", "instagram_id"]) assert.equal(r[col], null, col);
    // Replay of the consumed token, and a second resend after verification, restore nothing.
    assert.equal((await redeem(token, "attacker-pw")).status, 400);
    assert.equal((await resend(VICTIM)).status, 400, "already authoritatively verified");
    const after = await row(VICTIM);
    for (const col of ["tiktok_id", "facebook_id", "google_id", "instagram_id"]) assert.equal(after[col], null, col);
    assert.equal((await login(VICTIM, "attacker-pw")).status, 401);
    assert.equal((await login(VICTIM, "victim-own-pw")).status, 200);
  });

  test("PI-3: legitimate verified-Google linking is untouched by email verification of an already-authoritative account", async () => {
    await runVerify(verifyGoogleProfile, googleProfile("g-1", VICTIM, true));
    assert.equal((await resend(VICTIM)).status, 400);
    assert.equal((await redeem("a".repeat(64), "whatever-pw")).status, 400);
    const r = await row(VICTIM);
    assert.equal(r.google_id, "g-1");
    assert.equal(r.email_verified_via, "google");
  });

  test("PI-4: Facebook identity racing email verification never survives it", async () => {
    await runVerify(verifyFacebookProfile, facebookProfile("fb-attacker", VICTIM));
    await resend(VICTIM);
    await Promise.all([redeem(lastToken, "victim-own-pw"), runVerify(verifyFacebookProfile, facebookProfile("fb-attacker", VICTIM))]);
    const r = await row(VICTIM);
    assert.equal(r.facebook_id, null);
    assert.equal(r.email_verified_via, "email_link");
  });

  // ---------- P1 (re-review): legacy emailVerifiedAt provenance ----------
  test("LG: migration classifies history without touching passwords, ids or timestamps", async () => {
    await seedRow({ email: "local@x.test", password: "hash-l", verifiedAt: true, provider: "local" });
    await seedRow({ email: "local-null-provider@x.test", password: "hash-n", verifiedAt: true });
    await seedRow({ email: "google@x.test", verifiedAt: true, google: "g-1", provider: "google" });
    await seedRow({ email: "fb@x.test", verifiedAt: true, facebook: "fb-1", provider: "facebook" });
    await seedRow({ email: "tt@x.test", verifiedAt: true, tiktok: "tt-1", provider: "tiktok" });
    await seedRow({ email: "mixed@x.test", password: "hash-m", verifiedAt: true, google: "g-2", facebook: "fb-2", provider: "facebook" });
    await seedRow({ email: "unverified@x.test", password: "hash-u" });
    const before = (await local.query(`SELECT email, password, google_id, facebook_id, tiktok_id, email_verified_at FROM users ORDER BY email`)).rows;
    await runMigration();
    await runMigration(); // idempotent
    const via = Object.fromEntries((await local.query(`SELECT email, email_verified_via v FROM users`)).rows.map((r) => [r.email, r.v]));
    assert.deepEqual(via, {
      "local@x.test": "email_link", "local-null-provider@x.test": "email_link", "google@x.test": "google",
      "fb@x.test": null, "tt@x.test": null, "mixed@x.test": null, "unverified@x.test": null,
    });
    const after = (await local.query(`SELECT email, password, google_id, facebook_id, tiktok_id, email_verified_at FROM users ORDER BY email`)).rows;
    assert.deepEqual(after, before, "migration only classifies; nothing else changes");
  });

  test("LG-A/B: legacy Facebook-only and TikTok-only admins (historical timestamp) get no authority until re-verification", async () => {
    const ADMIN = "boss@chefsire.test";
    for (const provider of ["facebook", "tiktok"] as const) {
      await local.query(`TRUNCATE email_verification_tokens, users CASCADE`);
      const id = await seedRow({ email: ADMIN, verifiedAt: true, provider, ...(provider === "facebook" ? { facebook: "fb-legacy" } : { tiktok: "tt-legacy" }) });
      await runMigration();
      await withAdmin(ADMIN, async () => {
        assert.equal(await hasCurrentAdminAuthority(id), false, `${provider}: stale timestamp must not confer authority`);
        // Authoritative re-verification restores it, and discards the unproven provider identity.
        assert.equal((await resend(ADMIN)).status, 200);
        assert.equal((await redeem(lastToken, "owner-pw-123")).status, 303);
        assert.equal(await hasCurrentAdminAuthority(id), true);
        const r = await row(ADMIN);
        assert.equal(r.facebook_id, null);
        assert.equal(r.tiktok_id, null);
      });
    }
  });

  test("LG-A2: a legacy provider admin can also be restored by authoritative Google verification", async () => {
    const ADMIN = "boss@chefsire.test";
    const id = await seedRow({ email: ADMIN, verifiedAt: true, facebook: "fb-legacy", provider: "facebook" });
    await runMigration();
    await withAdmin(ADMIN, async () => {
      assert.equal(await hasCurrentAdminAuthority(id), false);
      const g = await runVerify(verifyGoogleProfile, googleProfile("g-boss", ADMIN, true));
      assert.equal(await hasCurrentAdminAuthority(g.user.id), true);
      assert.equal((await row(ADMIN)).facebook_id, null);
    });
  });

  test("LG-C/D/E: locally verified and Google-verified admins keep authority; normal verified users are preserved", async () => {
    const LOCAL = "local-admin@chefsire.test";
    const GOOGLE = "google-admin@chefsire.test";
    // Locally verified through the real flow (new code) ...
    const token = await signup(LOCAL, "pw-1234567");
    await redeem(token, "pw-1234567");
    // ... Google verified through the real flow ...
    const g = await runVerify(verifyGoogleProfile, googleProfile("g-admin", GOOGLE, true));
    // ... and a legacy verified local account + legacy Google-only account, classified by the migration.
    const legacyLocal = await seedRow({ email: "legacy-local-admin@chefsire.test", password: "hash", verifiedAt: true, provider: "local" });
    const legacyGoogle = await seedRow({ email: "legacy-google-admin@chefsire.test", verifiedAt: true, google: "g-old", provider: "google" });
    await runMigration();
    const emails = [LOCAL, GOOGLE, "legacy-local-admin@chefsire.test", "legacy-google-admin@chefsire.test"].join(",");
    await withAdmin(emails, async () => {
      assert.equal(await hasCurrentAdminAuthority((await row(LOCAL)).id), true);
      assert.equal(await hasCurrentAdminAuthority(g.user.id), true);
      assert.equal(await hasCurrentAdminAuthority(legacyLocal), true);
      assert.equal(await hasCurrentAdminAuthority(legacyGoogle), true);
    });
    // Normal users keep their password and can still log in.
    assert.equal((await login(LOCAL, "pw-1234567")).status, 200);
    assert.equal((await row("legacy-local-admin@chefsire.test")).password, "hash");
  });

  // ---------- P2 (re-review): verification limiter budgets ----------
  test("RL: GET rendering cannot exhaust POST redemption; failed POSTs stay limited; shared-IP success works", async () => {
    const SHARED = "203.0.113.7";
    const sharedGet = (t: string) => fetch(`${base()}/auth/verify-email?token=${t}`, { headers: { "x-forwarded-for": SHARED } });
    const sharedPost = (t: string, pw: string) =>
      fetch(`${base()}/auth/verify-email`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": SHARED }, body: new URLSearchParams({ token: t, password: pw }) });

    // 12 distinct people behind one NAT, each opening the link a few times (previews/reloads), then redeeming.
    const tokens: string[] = [];
    for (let i = 0; i < 12; i++) tokens.push(await signup(`nat${i}@example.com`, "attacker-pw"));
    for (const t of tokens) for (let k = 0; k < 3; k++) assert.equal((await sharedGet(t)).status, 200);
    for (const t of tokens) assert.equal((await sharedPost(t, "owner-pw-123")).status, 303, "every legitimate redemption succeeds");

    // Failed redemptions from that IP are still limited: brute force is not free.
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await sharedPost(`${i}`.padStart(64, "0"), "guess-pw-123")).status);
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(400));
    assert.equal(statuses[10], 429);
    // Even a correct token is refused while the failure budget is spent ...
    const late = await signup("late@example.com", "attacker-pw");
    assert.equal((await sharedPost(late, "owner-pw-123")).status, 429);
    // ... but another network is unaffected.
    assert.equal((await redeem(late, "owner-pw-123")).status, 303);
  });
}
