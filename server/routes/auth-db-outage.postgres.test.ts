/**
 * Stability Phase 2C: authentication when the database cannot answer, against the REAL app, REAL pool and a REAL (disposable) PostgreSQL,
 * with every failure injected deterministically by test-support/neon-fault-proxy. Needs TEST_DATABASE_URL (loopback-only); skipped otherwise.
 *
 * The three cases that must stay distinct:
 *   A  no / malformed / expired / tampered credentials                    -> 401 (checked before the database is consulted)
 *   B  valid credentials, database says the session is revoked/unknown   -> 401 (fail closed)
 *   C  credentials may be valid, database cannot answer                   -> 503 retryable, nothing granted, nothing cleared, no detail
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import pg from "pg";
import bcrypt from "bcryptjs";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";
import { createScratchDatabase } from "../test-support/scratch-database";
import { testAuthHeader, signTestAuthToken, TEST_JWT_SECRET } from "../test-support/auth-test-env";

const RAW = process.env.TEST_DATABASE_URL;

if (!RAW) {
  test("authentication during a database outage (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const scratch = await createScratchDatabase(RAW, "p2c_auth"); // its own database: this suite drops/recreates `users`
  const local = parseLocalTestDatabaseUrl(scratch.url);
  const { startFaultProxy, useNeonFaultProxy } = await import("../test-support/neon-fault-proxy");
  const proxy = await startFaultProxy({ host: local.host, port: local.port });
  useNeonFaultProxy(proxy.port);
  process.env.DATABASE_URL = scratch.url;
  process.env.DB_CONNECT_TIMEOUT_MS = "1500";
  process.env.AUTH_LOOKUP_TIMEOUT_MS = "2000";
  process.env.SQUARE_ENV = "sandbox";
  process.env.SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY = "test-signature-key";
  process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL = "https://chefsire.test/api/catering/webhooks/square";

  const direct = new pg.Pool({ ...local, max: 2 });
  const { getTableColumns } = await import("drizzle-orm");
  const { users } = await import("../../shared/schema");
  const userCols = Object.values(getTableColumns(users)).map((c: any) =>
    c.name === "id" ? `id varchar PRIMARY KEY DEFAULT gen_random_uuid()`
      : c.name === "username" || c.name === "email" ? `${c.name} text NOT NULL UNIQUE`
      : c.name === "auth_version" ? `auth_version integer NOT NULL DEFAULT 1`
      : `${c.name} ${c.columnType === "PgTimestamp" ? "timestamp" : c.columnType === "PgBoolean" ? "boolean" : "text"}`);
  await direct.query(`DROP TABLE IF EXISTS users CASCADE; CREATE TABLE users (${userCols.join(",")}); CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));`);
  const hash = await bcrypt.hash("correct-horse", 4);
  await direct.query(
    `INSERT INTO users (id, username, email, password, email_verified_at, auth_version) VALUES
      ('u-valid','valid','valid@example.test',$1, now(), 1),
      ('u-revoked','revoked','revoked@example.test',$1, now(), 2)`, [hash]);

  const { default: app } = await import("../app");
  const { optionalAuth, requireAuth } = await import("../middleware/auth");

  const unhandled: unknown[] = [];
  const uncaught: unknown[] = [];
  process.on("unhandledRejection", (e) => unhandled.push(e));
  process.on("uncaughtException", (e) => uncaught.push(e));
  const realError = console.error;
  console.error = () => {};

  // The real middleware on a tiny app: optional-auth semantics need a handler whose only dependency is the session check.
  const mini = express();
  mini.use(cookieParser());
  mini.get("/optional", optionalAuth, (req, res) => res.json({ anonymous: !req.user, id: req.user?.id ?? null }));
  mini.get("/required", requireAuth, (req, res) => res.json({ id: req.user?.id }));

  const serve = async (a: http.RequestListener) => {
    const s = http.createServer(a);
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    return { s, base: `http://127.0.0.1:${(s.address() as AddressInfo).port}` };
  };
  const real = await serve(app);
  const tiny = await serve(mini);

  test.after(async () => {
    console.error = realError;
    proxy.mode = "pass"; proxy.cutAll();
    for (const x of [real.s, tiny.s]) { x.close(); x.closeAllConnections?.(); }
    const { pool } = await import("../db");
    await pool.end().catch(() => {});
    await direct.end();
    await proxy.close();
    await scratch.drop();
  });
  test.beforeEach(async () => { proxy.mode = "pass"; proxy.delayMs = 0; proxy.muteReplies = false; proxy.cutAll(); await new Promise((r) => setTimeout(r, 150)); });

  async function call(base: string, method: string, path: string, init: { headers?: Record<string, string>; body?: unknown } = {}) {
    const t = Date.now();
    const r = await fetch(base + path, { method, headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers }, body: init.body === undefined ? undefined : JSON.stringify(init.body), redirect: "manual" });
    const text = await r.text();
    let json: any; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, text, json, headers: r.headers, ms: Date.now() - t };
  }
  const cookie = (token: string) => ({ cookie: `auth_token=${token}` });
  const validToken = () => signTestAuthToken({ id: "u-valid", av: 1 });
  const bearer = () => testAuthHeader("u-valid");
  const SAFE = (text: string) => { for (const s of ["ECONNREFUSED", "socket hang up", "Connection terminated", "timeout exceeded", "127.0.0.1", String(proxy.port), "postgres://", "SELECT", "select "]) assert.ok(!text.includes(s), `leaked ${s}: ${text}`); };
  const UNAVAILABLE = { error: "Service temporarily unavailable. Please try again in a moment.", code: "SERVICE_UNAVAILABLE", retryable: true };

  // ---- the three cases ---------------------------------------------------------------------------------------------------
  test("healthy: a valid session is accepted (/api/auth/me 200)", async () => {
    const r = await call(real.base, "GET", "/api/auth/me", { headers: cookie(validToken()) });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.user.id, "u-valid");
  });

  test("case B (database answers 'no') stays 401: revoked auth version and unknown account", async () => {
    const revoked = await call(real.base, "GET", "/api/auth/me", { headers: cookie(signTestAuthToken({ id: "u-revoked", av: 1 })) });
    assert.equal(revoked.status, 401);
    const ghost = await call(real.base, "GET", "/api/auth/me", { headers: cookie(signTestAuthToken({ id: "nobody", av: 1 })) });
    assert.equal(ghost.status, 401);
    const noClaim = await call(real.base, "GET", "/api/auth/me", { headers: cookie(jwt.sign({ id: "u-valid" }, TEST_JWT_SECRET, { expiresIn: "1h" })) });
    assert.equal(noClaim.status, 401, "a token without the version claim is still refused");
    const gated = await call(tiny.base, "GET", "/required", { headers: bearer() });
    assert.equal(gated.status, 200);
  });

  for (const mode of ["blackhole", "refuse"] as const) {
    test(`case C (database ${mode === "blackhole" ? "black-holed" : "refusing"}): /api/auth/me is a retryable 503 -- not 401 -- bounded in time, detail-free, no cookie changes`, async () => {
      proxy.mode = mode;
      const r = await call(real.base, "GET", "/api/auth/me", { headers: cookie(validToken()) });
      assert.equal(r.status, 503, r.text);
      assert.deepEqual(r.json, UNAVAILABLE);
      assert.equal(r.headers.get("retry-after"), "5");
      assert.equal(r.headers.get("set-cookie"), null, "a temporary outage must not clear (or set) the browser's auth cookie");
      assert.ok(r.ms < (mode === "blackhole" ? 4500 : 1500), `${r.ms}ms`);
      SAFE(r.text);
    });
  }

  test("case C never grants access: requireAuth routes answer 503 and run no handler code", async () => {
    proxy.mode = "blackhole";
    let ran = false;
    const gate = express(); gate.use(cookieParser()); gate.get("/x", requireAuth, (_q, r) => { ran = true; r.json({ secret: true }); });
    const g = await serve(gate);
    try {
      const r = await call(g.base, "GET", "/x", { headers: bearer() });
      assert.equal(r.status, 503);
      assert.equal(ran, false);
      assert.ok(!r.text.includes("secret"));
    } finally { g.s.close(); g.s.closeAllConnections?.(); }
    const real1 = await call(real.base, "GET", "/api/dm/threads", { headers: bearer() });
    assert.equal(real1.status, 503);
    assert.deepEqual(real1.json, UNAVAILABLE);
  });

  test("case A during an outage is still 401: a bad/expired/missing credential is rejected before (and without) the database", async () => {
    proxy.mode = "blackhole";
    const before = proxy.accepted;
    const expired = jwt.sign({ id: "u-valid", av: 1 }, TEST_JWT_SECRET, { expiresIn: -60 });
    const tampered = validToken().slice(0, -3) + "abc";
    for (const headers of [{}, cookie("not-a-jwt"), cookie(expired), cookie(tampered)]) {
      const me = await call(real.base, "GET", "/api/auth/me", { headers });
      assert.equal(me.status, 401, JSON.stringify(headers));
    }
    for (const headers of [{}, { authorization: "Bearer not-a-jwt" }, { authorization: `Bearer ${expired}` }]) {
      const r = await call(tiny.base, "GET", "/required", { headers });
      assert.equal(r.status, 401);
    }
    assert.equal(proxy.accepted, before, "no database connection was needed to reject them");
  });

  test("optional authentication: anonymous stays anonymous; a signed-in user is NOT silently treated as anonymous when the session cannot be checked", async () => {
    proxy.mode = "blackhole";
    const anon = await call(tiny.base, "GET", "/optional");
    assert.deepEqual(anon.json, { anonymous: true, id: null });
    const badToken = await call(tiny.base, "GET", "/optional", { headers: { authorization: "Bearer not-a-jwt" } });
    assert.deepEqual(badToken.json, { anonymous: true, id: null }, "an invalid token is anonymous, as before");
    const signedIn = await call(tiny.base, "GET", "/optional", { headers: bearer() });
    assert.equal(signedIn.status, 503);
    assert.deepEqual(signedIn.json, UNAVAILABLE);
    proxy.mode = "pass";
    const back = await call(tiny.base, "GET", "/optional", { headers: bearer() });
    assert.deepEqual(back.json, { anonymous: false, id: "u-valid" });
    const revoked = await call(tiny.base, "GET", "/optional", { headers: testAuthHeader("u-revoked") });
    assert.deepEqual(revoked.json, { anonymous: true, id: null }, "a revoked session is anonymous (database answered)");
  });

  // ---- login / signup / OAuth --------------------------------------------------------------------------------------------
  test("login: outage is a retryable 503 (not 401 'invalid password', not 500); wrong password stays 401; success after recovery", async () => {
    proxy.mode = "blackhole";
    const down = await call(real.base, "POST", "/api/auth/login", { body: { email: "valid@example.test", password: "correct-horse" } });
    assert.equal(down.status, 503, down.text);
    assert.deepEqual(down.json, UNAVAILABLE);
    assert.equal(down.headers.get("set-cookie"), null, "no session is issued");
    SAFE(down.text);
    proxy.mode = "pass";
    const wrong = await call(real.base, "POST", "/api/auth/login", { body: { email: "valid@example.test", password: "nope" } });
    assert.equal(wrong.status, 401);
    const ok = await call(real.base, "POST", "/api/auth/login", { body: { email: "valid@example.test", password: "correct-horse" } });
    assert.equal(ok.status, 200, ok.text);
    assert.match(ok.headers.get("set-cookie") ?? "", /auth_token=/);
  });

  test("signup: outage is a retryable 503 and creates nothing", async () => {
    proxy.mode = "refuse";
    const r = await call(real.base, "POST", "/api/auth/signup", { body: { firstName: "A", lastName: "B", username: "newbie", email: "newbie@example.test", password: "correct-horse-1" } });
    assert.equal(r.status, 503, r.text);
    assert.deepEqual(r.json, UNAVAILABLE);
    proxy.mode = "pass";
    assert.equal((await direct.query("select count(*)::int as n from users where email = 'newbie@example.test'")).rows[0].n, 0);
  });

  test("Google OAuth callback: a database failure redirects to a distinct, non-credential error and issues no session; other failures keep the old redirect", async () => {
    const passport = (await import("passport")).default;
    const { Strategy } = await import("passport-strategy");
    let failure: Error = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
    class Fake extends (Strategy as any) { name = "google"; authenticate() { (this as any).error(failure); } }
    passport.use("google", new Fake() as any);
    const down = await call(real.base, "GET", "/api/auth/google/callback");
    assert.equal(down.status, 302);
    assert.equal(down.headers.get("location"), "/login?error=service-unavailable");
    assert.ok(!(down.headers.get("set-cookie") ?? "").includes("auth_token="));
    failure = Object.assign(new Error('column "x" does not exist'), { code: "42703" });
    const other = await call(real.base, "GET", "/api/auth/google/callback");
    assert.equal(other.headers.get("location"), "/login?error=google-auth-failed");
  });

  // ---- recovery, retry storm ---------------------------------------------------------------------------------------------
  test("recovery without a restart: valid sessions work again, revoked ones are still refused, and the outage left no stale state", async () => {
    proxy.mode = "blackhole";
    assert.equal((await call(real.base, "GET", "/api/auth/me", { headers: cookie(validToken()) })).status, 503);
    proxy.mode = "refuse"; proxy.cutAll();
    assert.equal((await call(real.base, "GET", "/api/auth/me", { headers: cookie(validToken()) })).status, 503);
    proxy.mode = "pass";
    assert.equal((await call(real.base, "GET", "/api/auth/me", { headers: cookie(validToken()) })).status, 200);
    assert.equal((await call(real.base, "GET", "/api/auth/me", { headers: cookie(signTestAuthToken({ id: "u-revoked", av: 1 })) })).status, 401);
    assert.equal((await call(real.base, "GET", "/healthz")).status, 200);
  });

  test("no retry storm: 20 concurrent authenticated requests during a black hole all return 503 within the bound; connection attempts stay bounded and stop", async () => {
    proxy.mode = "blackhole";
    const before = proxy.accepted;
    const results = await Promise.all(Array.from({ length: 20 }, () => call(real.base, "GET", "/api/auth/me", { headers: cookie(validToken()) })));
    assert.ok(results.every((r) => r.status === 503), results.map((r) => r.status).join(","));
    assert.ok(Math.max(...results.map((r) => r.ms)) < 6000);
    await new Promise((r) => setTimeout(r, 2 * 1500 + 500)); // let attempts begun just before the timeout drain (each is bounded)
    const attempts = proxy.accepted - before;
    assert.ok(attempts <= 20 + 5, `${attempts} attempts for 20 requests`);
    await new Promise((r) => setTimeout(r, 2000));
    assert.equal(proxy.accepted - before, attempts, "no background retry loop after the requests ended");
  });

  // ---- financial / entitlement isolation ---------------------------------------------------------------------------------
  const signed = (body: string, key = "test-signature-key") => ({ "content-type": "application/json", "x-square-hmacsha256-signature": createHmac("sha256", key).update(process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL! + body).digest("base64") });

  test("Square webhook: unsigned/forged stay 401 with no database work; a valid delivery during an outage is NOT acknowledged (Square will retry), fixed body, no leak", async () => {
    proxy.mode = "blackhole";
    const before = proxy.accepted;
    const body = JSON.stringify({ event_id: "evt-outage-1", type: "payment.updated", merchant_id: "M1", data: { object: { payment: { id: "pay-1", order_id: "o-1", status: "COMPLETED" } } } });
    assert.equal((await call(real.base, "POST", "/api/catering/webhooks/square", { headers: { "content-type": "application/json" } })).status, 401);
    const forged = await fetch(real.base + "/api/catering/webhooks/square", { method: "POST", headers: signed(body, "wrong"), body });
    assert.equal(forged.status, 401);
    assert.equal(proxy.accepted, before, "an unauthenticated delivery caused no database connection");
    const res = await fetch(real.base + "/api/catering/webhooks/square", { method: "POST", headers: signed(body), body });
    const text = await res.text();
    assert.ok(res.status >= 500, `${res.status} ${text}`);
    assert.deepEqual(JSON.parse(text), { ok: false });
    SAFE(text);
  });

  test("payments and entitlements during an outage: requests are refused at authentication (503), nothing is granted or changed", async () => {
    const snapshot = async () => (await direct.query("select id, auth_version, password, subscription_tier from users order by id").catch(() => direct.query("select id, auth_version, password from users order by id"))).rows;
    const before = JSON.stringify(await snapshot());
    proxy.mode = "blackhole";
    const B = "11111111-1111-4111-8111-111111111111";
    for (const [method, path, body] of [
      ["POST", "/api/subscriptions/upgrade", { tier: "pro" }],
      ["POST", "/api/payments/create-payment", { orderId: "o-1" }],
      ["POST", "/api/payments/refund", { orderId: "o-1" }],
      ["POST", `/api/catering/bookings/${B}/billing/invoices/${B}/pay`, {}],
      ["GET", `/api/catering/bookings/${B}/billing/payment-attempts/${B}`, undefined],
    ] as const) {
      const r = await call(real.base, method, path, { headers: bearer(), body });
      assert.equal(r.status, 503, `${method} ${path} -> ${r.status} ${r.text}`);
      assert.deepEqual(r.json, UNAVAILABLE);
      assert.ok(!/"ok":true|unpaid|paid|captured|entitle/i.test(r.text));
    }
    proxy.mode = "pass";
    assert.equal(JSON.stringify(await snapshot()), before, "no row changed");
  });

  test("the handled outages above produced no uncaught exception and no unhandled rejection", () => {
    assert.deepEqual(uncaught.map(String), []);
    assert.deepEqual(unhandled.map(String), []);
  });
}
