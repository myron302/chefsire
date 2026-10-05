/**
 * Square provider connection over real HTTP: the real payouts (OAuth connect/callback) and square-connection routers, the real
 * `square` SDK talking to a local fake Square, and a REAL PostgreSQL built from the repository's migrations.
 *
 * Set TEST_DATABASE_URL to a loopback database whose name contains "test"; the suite is skipped otherwise.
 */
import "../test-support/accept-test-sessions";
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import pg from "pg";
import { signAuthToken } from "../lib/jwt-config";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";
import { startFakeSquare } from "../test-support/fake-square";

process.env.DATABASE_URL ||= "postgres://u:p@square-connection-tests.invalid/none";
process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env.SQUARE_ENV = "sandbox";
const KEY = randomBytes(32).toString("base64");
process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY = KEY;

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id, av: 1 } as never)}` });

if (!URL_ENV) {
  test("Square connection over HTTP (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const SCHEMA = `sqconn_http_${process.pid}`;
  const local = new pg.Pool({ ...parseLocalTestDatabaseUrl(URL_ENV), options: `-c search_path=${SCHEMA}`, max: 10 });
  const { pool } = await import("../db/index");
  (pool as never as { connect: unknown }).connect = () => local.connect();
  (pool as never as { query: unknown }).query = (q: unknown, params?: unknown[]) => local.query(q as string, params);

  const sql = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
  await local.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA};`);
  await local.query(`CREATE TABLE users (id varchar PRIMARY KEY)`);
  await local.query(sql("server/drizzle/20251108_marketplace_monetization.sql").match(/CREATE TABLE IF NOT EXISTS payment_methods \([\s\S]*?\n\);/)![0]);
  await local.query(sql("server/migrations/20260927_square_oauth_transactions.sql"));
  await local.query(sql("server/migrations/20260928_square_oauth_hardening.sql"));
  await local.query(sql("server/migrations/20261007_square_connection_hardening.sql"));
  await local.query(sql("server/migrations/20261008_square_credential_generation.sql"));
  await local.query(sql("server/migrations/20261009_square_merchant_revocation.sql"));
  await local.query(sql("server/migrations/20261010_square_merchant_revocations.sql"));
  await local.query(sql("server/migrations/20261011_square_credential_pair_repair.sql"));
  await local.query(sql("server/migrations/20261012_square_merchant_id_width.sql"));
  for (const id of ["provider-a", "provider-b"]) await local.query(`INSERT INTO users (id) VALUES ($1)`, [id]);

  const fake = await startFakeSquare({ grants: [{ access_token: "http-access-token-1", refresh_token: "http-refresh-token-1", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }] });
  const { createSquareConnectionService } = await import("../lib/square-connection-service");
  const { createSquareProviderApi } = await import("../lib/square-integration");
  const { squareConnections } = await import("../lib/square-connection");
  const service = createSquareConnectionService({ pool: local as never, api: createSquareProviderApi({ baseUrl: fake.baseUrl }), log: { warn: () => undefined } });
  // The payouts router imports the production wiring; point that wiring's Square-facing methods at the fake-backed service.
  Object.assign(squareConnections, {
    verifyAuthorizationCode: service.verifyAuthorizationCode,
    persistVerifiedConnection: service.persistVerifiedConnection,
  });

  const { default: payoutsRouter } = await import("./payouts");
  const { createSquareConnectionRouter } = await import("./square-connection");
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/payouts", payoutsRouter);
  app.use("/api/square-connection", createSquareConnectionRouter(service));
  const server = app.listen(0);
  test.after(async () => { server.close(); await fake.close(); await local.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`); await local.end(); });
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (method: string, route: string, headers: Record<string, string> = {}, body?: unknown, rawBody?: string) => {
    const response = await fetch(`${base()}${route}`, {
      method, redirect: "manual",
      headers: { ...headers, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* a redirect has no body */ }
    return { status: response.status, headers: response.headers, text, body: json };
  };

  /** The browser side of OAuth: initiate (collect state + binding cookie), then return from Square with a code. */
  async function authorize(user: string, options: { code?: string; cookie?: "own" | "none" | string } = {}) {
    const started = await call("GET", "/api/payouts/connect-square", tok(user));
    assert.equal(started.status, 200, started.text);
    const authUrl = new URL(started.body.authUrl);
    const state = authUrl.searchParams.get("state")!;
    const setCookie = started.headers.get("set-cookie")!;
    const own = setCookie.split(";")[0];
    const cookie = options.cookie === "none" ? undefined : options.cookie === undefined || options.cookie === "own" ? own : options.cookie;
    const callback = await call("GET", `/api/payouts/square-callback?code=${options.code ?? "auth-code"}&state=${encodeURIComponent(state)}`, cookie ? { cookie } : {});
    return { started, authUrl, state, callback, own };
  }

  const rows = async (user: string) => (await local.query(`SELECT * FROM payment_methods WHERE user_id = $1`, [user])).rows;
  const wipe = async () => { await local.query(`DELETE FROM payment_methods; DELETE FROM square_oauth_transactions;`); fake.requests.length = 0; fake.resetGrants(); Object.assign(fake.state, { failures: {}, profileMerchantId: undefined, statusMerchantId: undefined }); };

  test("the connect URL targets the right Square environment and asks for exactly the required scopes", async () => {
    await wipe();
    const started = await call("GET", "/api/payouts/connect-square", tok("provider-a"));
    assert.equal(started.status, 200);
    const url = new URL(started.body.authUrl);
    assert.equal(url.origin, "https://connect.squareupsandbox.com");
    assert.equal(url.pathname, "/oauth2/authorize");
    assert.equal(url.searchParams.get("client_id"), "app-id-test");
    assert.deepEqual(url.searchParams.get("scope")!.split(" ").sort(), ["MERCHANT_PROFILE_READ", "ORDERS_READ", "ORDERS_WRITE", "PAYMENTS_READ", "PAYMENTS_WRITE"]);
    assert.match(url.searchParams.get("state")!, /^[A-Za-z0-9_-]{43}$/);
    assert.equal((await call("GET", "/api/payouts/connect-square")).status, 401);
  });

  test("connecting is refused up front when the application secret or the encryption key is not configured", async () => {
    await wipe();
    const secret = process.env.SQUARE_APPLICATION_SECRET;
    delete process.env.SQUARE_APPLICATION_SECRET;
    try { assert.equal((await call("GET", "/api/payouts/connect-square", tok("provider-a"))).status, 503); } finally { process.env.SQUARE_APPLICATION_SECRET = secret; }
    process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY = "short";
    try { assert.equal((await call("GET", "/api/payouts/connect-square", tok("provider-a"))).status, 503); } finally { process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY = KEY; }
    assert.equal((await local.query(`SELECT count(*) FROM square_oauth_transactions`)).rows[0].count, "0", "no OAuth transaction is created for an attempt that cannot finish");
  });

  test("the full OAuth round trip stores a SEALED, verified connection and the status endpoint reports it safely", async () => {
    await wipe();
    const { callback } = await authorize("provider-a");
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get("location"), "/settings/payouts?connected=true");
    const [row] = await rows("provider-a");
    assert.equal(row.account_status, "active");
    assert.match(row.encrypted_access_token, /^sqenc:v1:/);
    assert.equal(JSON.stringify(row).includes("http-access-token-1"), false);
    assert.equal(JSON.stringify(row).includes("http-refresh-token-1"), false);
    assert.equal(row.location_id, "LOC_1");

    const status = await call("GET", "/api/square-connection/status", tok("provider-a"));
    assert.equal(status.status, 200);
    assert.equal(status.headers.get("cache-control"), "no-store");
    assert.deepEqual(status.body, { ok: true, connection: { state: "active", connected: true, paymentReady: true, needsReauthorization: false, merchantDisplayName: "Test Catering Co", locationDisplayName: "Main Kitchen", canDisconnect: true } });
    for (const forbidden of ["http-access-token-1", "http-refresh-token-1", "sqenc", "app-secret-test", KEY, "MERCHANT_1", "account_details"]) {
      assert.equal(status.text.includes(forbidden), false, forbidden);
    }
  });

  test("OAuth state replay, a missing or wrong browser binding, and a forwarded URL are refused before any Square call", async () => {
    await wipe();
    const first = await authorize("provider-a");
    assert.equal(first.callback.status, 302);
    const exchanges = fake.calls("/oauth2/token");
    // Replay of the very same state + cookie.
    const replay = await call("GET", `/api/payouts/square-callback?code=auth-code&state=${encodeURIComponent(first.state)}`, { cookie: first.own });
    assert.equal(replay.status, 400);
    // A different browser (no cookie) and a cookie from a different attempt.
    const noBinding = await authorize("provider-b", { cookie: "none" });
    assert.equal(noBinding.callback.status, 400);
    const other = await authorize("provider-b", { cookie: first.own });
    assert.equal(other.callback.status, 400);
    assert.equal(fake.calls("/oauth2/token"), exchanges, "Square was never asked to exchange a rejected callback");
    assert.equal((await rows("provider-b")).length, 0);
  });

  test("a merchant mismatch during the callback stores nothing and cannot be retried with the same state", async () => {
    await wipe();
    fake.state.profileMerchantId = "SOMEONE_ELSE";
    const attempt = await authorize("provider-a");
    assert.equal(attempt.callback.status, 302);
    assert.equal(attempt.callback.headers.get("location"), "/settings/payouts?error=merchant_mismatch");
    assert.equal((await rows("provider-a")).length, 0);
    const retry = await call("GET", `/api/payouts/square-callback?code=auth-code&state=${encodeURIComponent(attempt.state)}`, { cookie: attempt.own });
    assert.equal(retry.status, 400);
  });

  test("an insufficient-scope grant, a provider denial and a Square outage never create a connection", async () => {
    await wipe();
    fake.state.scopes = ["MERCHANT_PROFILE_READ", "PAYMENTS_WRITE"];
    const narrow = await authorize("provider-a");
    assert.equal(narrow.callback.headers.get("location"), "/settings/payouts?error=scopes_insufficient");
    fake.state.scopes = ["MERCHANT_PROFILE_READ", "PAYMENTS_WRITE", "PAYMENTS_READ", "ORDERS_WRITE", "ORDERS_READ"];
    fake.state.failures.token = 503;
    const outage = await authorize("provider-a");
    assert.equal(outage.callback.headers.get("location"), "/settings/payouts?error=square_auth_failed");
    fake.state.failures.token = undefined;
    const started = await call("GET", "/api/payouts/connect-square", tok("provider-a"));
    const denied = await call("GET", `/api/payouts/square-callback?error=access_denied&state=${new URL(started.body.authUrl).searchParams.get("state")}`, { cookie: started.headers.get("set-cookie")!.split(";")[0] });
    assert.equal(denied.headers.get("location"), "/settings/payouts?error=square_auth_failed");
    assert.equal((await rows("provider-a")).length, 0);
  });

  test("status is the signed-in user's own and nothing else: no id is accepted, so nobody else's connection can be read", async () => {
    await wipe();
    await authorize("provider-a");
    assert.equal((await call("GET", "/api/square-connection/status")).status, 401);
    const other = await call("GET", "/api/square-connection/status", tok("provider-b"));
    assert.deepEqual(other.body.connection, { state: "not_connected", connected: false, paymentReady: false, needsReauthorization: false, merchantDisplayName: null, locationDisplayName: null, canDisconnect: false });
    // Ids supplied in a query or path do nothing, and guessing one finds no route.
    const [row] = await rows("provider-a");
    assert.deepEqual((await call("GET", `/api/square-connection/status?userId=provider-a&paymentMethodId=${row.id}`, tok("provider-b"))).body.connection.state, "not_connected");
    assert.equal((await call("GET", `/api/square-connection/status/${row.id}`, tok("provider-b"))).status, 404);
    assert.equal((await call("POST", `/api/square-connection/disconnect/${row.id}`, tok("provider-b"), {})).status, 404);
  });

  test("disconnect: owner only, JSON from the app's own origin only, idempotent, history kept, never another user's account", async () => {
    await wipe();
    await authorize("provider-a");
    const [before] = await rows("provider-a");

    // Not authenticated / not JSON / foreign origin: nothing happens.
    assert.equal((await call("POST", "/api/square-connection/disconnect", {}, {})).status, 401);
    assert.equal((await call("POST", "/api/square-connection/disconnect", tok("provider-a"), undefined, "")).status, 415);
    assert.equal((await call("POST", "/api/square-connection/disconnect", { ...tok("provider-a"), "content-type": "text/plain" }, undefined, "{}")).status, 415);
    const foreign = await call("POST", "/api/square-connection/disconnect", { ...tok("provider-a"), origin: "https://evil.example" }, {});
    assert.equal(foreign.status, 403);
    assert.equal((await rows("provider-a"))[0].account_status, "active");

    // Another user, even naming the victim's payment-method id, only ever acts on their own (nonexistent) connection.
    const attacker = await call("POST", "/api/square-connection/disconnect", tok("provider-b"), { paymentMethodId: before.id, userId: "provider-a" });
    assert.equal(attacker.status, 200);
    assert.equal(attacker.body.changed, false);
    assert.equal((await rows("provider-a"))[0].account_status, "active");
    assert.equal((await rows("provider-a"))[0].encrypted_access_token, before.encrypted_access_token);

    // The owner, from the app's own origin.
    const own = await call("POST", "/api/square-connection/disconnect", { ...tok("provider-a"), origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }, {});
    assert.equal(own.status, 200);
    assert.deepEqual(own.body, { ok: true, changed: true, providerRevocation: "revoked", providerRevoked: true, connection: { state: "not_connected", connected: false, paymentReady: false, needsReauthorization: false, merchantDisplayName: null, locationDisplayName: null, canDisconnect: false } });
    const [after] = await rows("provider-a");
    assert.equal(after.account_status, "disconnected");
    assert.equal(after.encrypted_access_token, null);
    assert.equal(after.provider_id, "MERCHANT_1");
    assert.equal(own.text.includes("http-access-token-1"), false);

    // Repeating is safe.
    const again = await call("POST", "/api/square-connection/disconnect", tok("provider-a"), {});
    assert.equal(again.status, 200);
    assert.equal(again.body.changed, false);
    assert.equal(fake.calls("/oauth2/revoke"), 1);
  });

  test("disconnect says plainly when Square's revocation was NOT confirmed, and when it was deliberately left for a shared connection", async () => {
    await wipe();
    // Unconfirmed: Square cannot be reached for the revocation. The local disconnect still completes.
    await authorize("provider-a");
    fake.state.failures.revoke = 503;
    const unconfirmed = await call("POST", "/api/square-connection/disconnect", tok("provider-a"), {});
    assert.equal(unconfirmed.status, 200);
    assert.equal(unconfirmed.body.changed, true);
    assert.equal(unconfirmed.body.providerRevocation, "unconfirmed");
    assert.equal(unconfirmed.body.providerRevoked, false);
    assert.equal(unconfirmed.body.connection.state, "not_connected");
    assert.equal((await rows("provider-a"))[0].account_status, "disconnected");
    fake.state.failures.revoke = undefined;

    // Shared: another active ChefSire account uses the same Square merchant, so Square access is intentionally left in place.
    await wipe();
    await authorize("provider-a");
    await authorize("provider-b");
    const shared = await call("POST", "/api/square-connection/disconnect", tok("provider-a"), {});
    assert.equal(shared.body.providerRevocation, "retained_for_shared_connection");
    assert.equal(shared.body.providerRevoked, false);
    assert.equal(fake.calls("/oauth2/revoke"), 0);
    // The last one out revokes.
    const last = await call("POST", "/api/square-connection/disconnect", tok("provider-b"), {});
    assert.equal(last.body.providerRevocation, "revoked");
    // Repeating is a no-op that says so.
    const again = await call("POST", "/api/square-connection/disconnect", tok("provider-b"), {});
    assert.equal(again.body.providerRevocation, "not_applicable");
    for (const body of [unconfirmed.text, shared.text, last.text]) for (const forbidden of ["http-access-token-1", "http-refresh-token-1", "sqenc", KEY]) assert.equal(body.includes(forbidden), false);
  });

  test("during a configuration outage the owner's connection is reported (safely) as disconnectable, and local disconnect works", async () => {
    await wipe();
    await authorize("provider-a");
    const savedKey = process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY;
    delete process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY;
    try {
      const status = await call("GET", "/api/square-connection/status", tok("provider-a"));
      assert.equal(status.body.connection.state, "configuration_error");
      assert.equal(status.body.connection.canDisconnect, true);
      for (const forbidden of ["http-access-token-1", "http-refresh-token-1", "sqenc", "app-secret-test", KEY, "MERCHANT_1"]) assert.equal(status.text.includes(forbidden), false, forbidden);
      // Someone with no connection is not offered Disconnect.
      assert.equal((await call("GET", "/api/square-connection/status", tok("provider-b"))).body.connection.canDisconnect, false);

      const revokesBefore = fake.calls("/oauth2/revoke");
      const disconnected = await call("POST", "/api/square-connection/disconnect", tok("provider-a"), {});
      assert.equal(disconnected.status, 200);
      assert.equal(disconnected.body.changed, true);
      assert.equal(disconnected.body.providerRevocation, "unconfirmed");
      assert.equal(disconnected.body.providerRevoked, false);
      assert.equal(disconnected.body.connection.canDisconnect, false);
      assert.equal(fake.calls("/oauth2/revoke"), revokesBefore);
      assert.equal(disconnected.text.includes("http-access-token-1"), false);
      const [row] = await rows("provider-a");
      assert.equal(row.account_status, "disconnected");
      assert.equal(row.encrypted_access_token, null);
    } finally {
      process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY = savedKey;
    }
  });

  test("recheck re-asks Square; a connection Square has revoked is reported as needing reauthorization without leaking why", async () => {
    await wipe();
    await authorize("provider-a");
    fake.state.failures.merchant = 401;
    const result = await call("POST", "/api/square-connection/recheck", tok("provider-a"), {});
    assert.equal(result.status, 200);
    assert.equal(result.body.connection.state, "needs_reauthorization");
    assert.equal(result.body.connection.needsReauthorization, true);
    assert.equal(result.body.connection.paymentReady, false);
    assert.equal(result.text.includes("UNAUTHORIZED"), false);
    assert.equal((await call("POST", "/api/square-connection/recheck", tok("provider-a"), undefined, "")).status, 415);
  });
}
