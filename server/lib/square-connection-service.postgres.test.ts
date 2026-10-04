/**
 * Square provider connection service against a REAL PostgreSQL and the REAL `square` SDK (driven through a local fake Square
 * server). The tables come from the repository's own migrations: the original payment_methods DDL, then
 * 20261007_square_connection_hardening.sql through the production migration runner.
 *
 * Set TEST_DATABASE_URL to a loopback database whose name contains "test"; the suite is skipped otherwise. Everything runs
 * in its own throwaway schema.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyMigration } from "../scripts/migration-runner";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";
import { startFakeSquare, defaultFakeSquareState, type FakeSquareState } from "../test-support/fake-square";
import { createSquareConnectionService, SQUARE_TOKEN_REFRESH_WINDOW_MS, type SqlPool } from "./square-connection-service";
import { createSquareProviderApi } from "./square-integration";
import { decryptSecret, SECRET_BOX_KEY_ENV } from "./secret-box";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
const KEY = randomBytes(32).toString("base64");
process.env[SECRET_BOX_KEY_ENV] = KEY;
process.env.SQUARE_ENV = "sandbox";

// Anything written to the console while this file runs is inspected at the end: no secret may ever appear in it.
const consoleOutput: string[] = [];
for (const method of ["log", "warn", "error", "info", "debug"] as const) {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    consoleOutput.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    // TAP output from the test runner itself is not application output; let it through untouched.
    if (method === "log") original(...args);
  };
}

const SECRET_SENTINELS = new Set<string>();
const sentinel = (value: string) => { SECRET_SENTINELS.add(value); return value; };

if (!URL_ENV) {
  test("Square connection service (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const config = parseLocalTestDatabaseUrl(URL_ENV);
  const migrationSql = fs.readFileSync(path.join(root, "server/migrations/20261007_square_connection_hardening.sql"), "utf8");
  const generationMigrationSql = fs.readFileSync(path.join(root, "server/migrations/20261008_square_credential_generation.sql"), "utf8");
  const baseDdl = fs.readFileSync(path.join(root, "server/drizzle/20251108_marketplace_monetization.sql"), "utf8")
    .match(/CREATE TABLE IF NOT EXISTS payment_methods \([\s\S]*?\n\);/)![0];

  type Harness = Awaited<ReturnType<typeof harness>>;

  async function harness(options: { applyHardening?: boolean; fake?: Partial<FakeSquareState>; now?: () => Date } = {}) {
    const namespace = `sqconn_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const admin = new pg.Client(config);
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${namespace}`);
    const pool = new pg.Pool({ ...config, options: `-c search_path=${namespace}`, max: 10 });
    await pool.query(`CREATE TABLE users (id varchar PRIMARY KEY)`);
    await pool.query(baseDdl);
    await pool.query(`CREATE TABLE _app_migrations (filename text primary key, applied_at timestamptz not null default now())`);
    const fake = await startFakeSquare(options.fake);
    const logs: { event: string; fields: Record<string, unknown> }[] = [];
    let clock = options.now ? options.now() : new Date();
    const service = createSquareConnectionService({
      pool: pool as unknown as SqlPool,
      api: createSquareProviderApi({ baseUrl: fake.baseUrl }),
      now: () => clock,
      log: { warn: (event, fields) => { logs.push({ event, fields }); } },
    });
    const h = {
      namespace, pool, fake, service, logs,
      setClock: (value: Date) => { clock = value; },
      async hardening() {
        const client = await pool.connect();
        try {
          await applyMigration(client as never, `server:20261007_square_connection_hardening.sql`, migrationSql);
          await applyMigration(client as never, `server:20261008_square_credential_generation.sql`, generationMigrationSql);
        } finally { client.release(); }
      },
      async user(id: string) { await pool.query(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]); return id; },
      /** The full callback path: verify with Square, then persist inside a transaction. */
      async connect(userId: string) {
        await h.user(userId);
        const verification = await service.verifyAuthorizationCode("auth-code");
        if (!verification.ok) return verification;
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await service.persistVerifiedConnection(client as never, userId, verification.verified);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally { client.release(); }
        return verification;
      },
      sealedAccess: (row: { id: string; encrypted_access_token: string }) => decryptSecret(row.encrypted_access_token, `payment_methods:${row.id}:square_access_token`),
      async row(userId: string) { return (await pool.query(`SELECT * FROM payment_methods WHERE user_id = $1`, [userId])).rows[0]; },
      async rowCount() { return Number((await pool.query(`SELECT count(*) FROM payment_methods`)).rows[0].count); },
      async cleanup() {
        await fake.close();
        await pool.end();
        await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
        await admin.end();
      },
    };
    if (options.applyHardening !== false) await h.hardening();
    return h;
  }

  async function withHarness(options: Parameters<typeof harness>[0], fn: (h: Harness) => Promise<void>) {
    const h = await harness(options);
    try { await fn(h); } finally { await h.cleanup(); }
  }

  const tokenGrant = (access: string, refresh: string, expiresAt: string, merchant: string | null = "MERCHANT_1") => ({
    access_token: sentinel(access), refresh_token: sentinel(refresh), expires_at: expiresAt, merchant_id: merchant,
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Authorization and encryption at rest
   * ------------------------------------------------------------------------------------------------------- */

  test("a verified authorization is stored SEALED: no plaintext token anywhere in the row, and it opens only with its own row binding", async () => {
    await withHarness({ fake: { grants: [tokenGrant("access-fresh-1", "refresh-fresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      const result = await h.connect("provider-1");
      assert.equal(result.ok, true);
      const row = await h.row("provider-1");
      assert.match(row.encrypted_access_token, /^sqenc:v1:/);
      assert.match(row.encrypted_refresh_token, /^sqenc:v1:/);
      assert.equal(JSON.stringify(row).includes("access-fresh-1"), false);
      assert.equal(JSON.stringify(row).includes("refresh-fresh-1"), false);
      assert.deepEqual(row.account_details, { merchantId: "MERCHANT_1" });
      assert.equal(row.account_status, "active");
      assert.equal(row.provider_id, "MERCHANT_1");
      assert.equal(row.location_id, "LOC_1");
      assert.equal(row.merchant_name, "Test Catering Co");
      assert.ok(row.token_expires_at && row.last_refreshed_at && row.last_verified_at);
      assert.ok(row.granted_scopes.includes("ORDERS_WRITE"));
      assert.equal(decryptSecret(row.encrypted_access_token, `payment_methods:${row.id}:square_access_token`), "access-fresh-1");
      assert.equal(decryptSecret(row.encrypted_refresh_token, `payment_methods:${row.id}:square_refresh_token`), "refresh-fresh-1");
      // Bound to its own row and column.
      assert.throws(() => decryptSecret(row.encrypted_access_token, `payment_methods:${row.id}:square_refresh_token`));
    });
  });

  test("a connected provider is payment ready, and the server (only) can obtain the credentials for it", async () => {
    await withHarness({ fake: { grants: [tokenGrant("access-ready-1", "refresh-ready-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const readiness = await h.service.getSquarePaymentReadiness("provider-1");
      assert.deepEqual(readiness, { state: "active", paymentReady: true, merchantId: "MERCHANT_1", merchantName: "Test Catering Co", locationId: "LOC_1", locationName: "Main Kitchen", locationCurrency: "USD" });
      assert.equal(JSON.stringify(readiness).includes("access-ready-1"), false);
      const credentials = await h.service.getReadyConnectedCredentials("provider-1");
      assert.equal(credentials?.accessToken, "access-ready-1");
      assert.equal(credentials?.locationId, "LOC_1");
      // A user with no connection is simply not connected, and gets no credentials.
      assert.equal((await h.service.getSquarePaymentReadiness("nobody")).state, "not_connected");
      assert.equal(await h.service.getReadyConnectedCredentials("nobody"), null);
    });
  });

  test("the status view contains only safe fields: no token, ciphertext, scope list, id or raw record", async () => {
    await withHarness({ fake: { grants: [tokenGrant("access-view-1", "refresh-view-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const view = await h.service.status("provider-1");
      assert.deepEqual(view, { state: "active", connected: true, paymentReady: true, needsReauthorization: false, merchantDisplayName: "Test Catering Co", locationDisplayName: "Main Kitchen" });
      const text = JSON.stringify(view);
      for (const forbidden of ["access-view-1", "refresh-view-1", "sqenc", "MERCHANT_1", "LOC_1", "PAYMENTS_WRITE", "accessToken", "refreshToken", "account_details", "app-secret-test", KEY]) {
        assert.equal(text.includes(forbidden), false, forbidden);
      }
      assert.deepEqual((await h.service.status("nobody")), { state: "not_connected", connected: false, paymentReady: false, needsReauthorization: false, merchantDisplayName: null, locationDisplayName: null });
    });
  });

  test("merchant mismatch fails closed: the token response, merchant profile and token status must all name the same merchant", async () => {
    for (const mismatch of [
      { fake: { profileMerchantId: "SOMEONE_ELSE" } },
      { fake: { statusMerchantId: "SOMEONE_ELSE" } },
      { fake: { grants: [tokenGrant("access-mm-1", "refresh-mm-1", "2099-01-01T00:00:00Z", "SOMEONE_ELSE")] } },
      { fake: { grants: [tokenGrant("access-mm-2", "refresh-mm-2", "2099-01-01T00:00:00Z", null)] } },
    ] as const) {
      await withHarness(mismatch as never, async (h) => {
        const result = await h.connect("provider-1");
        assert.equal(result.ok, false);
        assert.equal(await h.rowCount(), 0, "nothing is stored on a mismatch");
        assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "not_connected");
      });
    }
  });

  test("a grant without every required scope is refused and stores nothing", async () => {
    await withHarness({ fake: { scopes: ["MERCHANT_PROFILE_READ", "PAYMENTS_WRITE"] } }, async (h) => {
      const result = await h.connect("provider-1");
      assert.deepEqual(result.ok ? null : result.reason, "scopes_insufficient");
      assert.equal(await h.rowCount(), 0);
    });
  });

  test("Square rejecting the code, or being unreachable, stores nothing", async () => {
    await withHarness({}, async (h) => {
      h.fake.state.failures.token = 400;
      const rejected = await h.connect("provider-1");
      assert.equal(rejected.ok === false && rejected.reason, "provider_rejected");
      h.fake.state.failures.token = 503;
      const unavailable = await h.connect("provider-1");
      assert.equal(unavailable.ok === false && unavailable.reason, "unavailable");
      assert.equal(await h.rowCount(), 0);
    });
  });

  test("a missing or invalid encryption key fails closed: no authorization is accepted, no plaintext is written", async () => {
    await withHarness({}, async (h) => {
      await h.user("provider-1");
      const saved = process.env[SECRET_BOX_KEY_ENV];
      try {
        delete process.env[SECRET_BOX_KEY_ENV];
        const result = await h.service.verifyAuthorizationCode("auth-code");
        assert.equal(result.ok === false && result.reason, "not_configured");
        assert.equal(h.fake.calls("/oauth2/token"), 0, "Square is not even asked");
        assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "configuration_error");
        process.env[SECRET_BOX_KEY_ENV] = "not-a-valid-key";
        assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "configuration_error");
        // Persisting directly (a caller bypassing verification) still cannot write anything without a key.
        const client = await h.pool.connect();
        try {
          await assert.rejects(h.service.persistVerifiedConnection(client as never, "provider-1", {
            merchantId: "M", merchantName: null, accessToken: "x", refreshToken: "y", tokenExpiresAt: new Date(), scopes: [], location: null,
          }));
        } finally { client.release(); }
      } finally {
        process.env[SECRET_BOX_KEY_ENV] = saved;
      }
      assert.equal(await h.rowCount(), 0);
    });
  });

  test("a provider with no card-capable location is connected but NOT payment ready, and recovers when Square is fixed", async () => {
    await withHarness({ fake: { locations: [{ id: "LOC_X", name: "Closed", status: "INACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: "MERCHANT_1", currency: "USD" }] } }, async (h) => {
      await h.connect("provider-1");
      const readiness = await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(readiness.state, "no_payment_location");
      assert.equal(readiness.paymentReady, false);
      assert.equal(readiness.locationId, null);
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
      assert.equal((await h.service.status("provider-1")).connected, true);
      // Not re-checked on every read...
      const before = h.fake.calls("/v2/locations");
      await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(h.fake.calls("/v2/locations"), before);
      // ...but a forced re-check picks up a fixed account.
      h.fake.state.locations = defaultFakeSquareState().locations;
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1", { force: true })).state, "active");
      assert.equal((await h.row("provider-1")).location_id, "LOC_1");
    });
  });

  test("a location of a different merchant, or without card capability, is never selected", async () => {
    await withHarness({ fake: { locations: [
      { id: "LOC_OTHER", status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: "ANOTHER_MERCHANT", currency: "USD" },
      { id: "LOC_NOCARD", status: "ACTIVE", capabilities: [], merchant_id: "MERCHANT_1", currency: "USD" },
    ] } }, async (h) => {
      await h.connect("provider-1");
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "no_payment_location");
    });
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Legacy plaintext conversion
   * ------------------------------------------------------------------------------------------------------- */

  async function insertLegacy(h: Harness, userId: string, details: unknown, status = "active") {
    await h.user(userId);
    await h.pool.query(
      `INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details, is_default) VALUES ($1, 'square', 'MERCHANT_1', $2, $3::jsonb, true)`,
      [userId, status, JSON.stringify(details)],
    );
  }

  const legacyDetails = (access: string, refresh: string, expires = "2099-01-01T00:00:00Z") => ({
    merchantId: "MERCHANT_1", locationId: "LEGACY_LOC", accessToken: sentinel(access), refreshToken: sentinel(refresh), tokenExpiresAt: expires,
  });

  test("legacy conversion seals plaintext tokens, removes the plaintext, keeps non-secret history, and is idempotent", async () => {
    await withHarness({ applyHardening: false }, async (h) => {
      await insertLegacy(h, "provider-1", legacyDetails("legacy-access-1", "legacy-refresh-1"));
      await insertLegacy(h, "provider-2", legacyDetails("legacy-access-2", "legacy-refresh-2"));
      await h.hardening();

      const dry = await h.service.convertAllLegacyRows({ dryRun: true });
      assert.deepEqual(dry, { found: 2, converted: 0, alreadyConverted: 0, malformed: [] });
      assert.equal((await h.row("provider-1")).account_details.accessToken, "legacy-access-1", "a dry run changes nothing");

      const summary = await h.service.convertAllLegacyRows();
      assert.deepEqual(summary, { found: 2, converted: 2, alreadyConverted: 0, malformed: [] });
      assert.equal(JSON.stringify(summary).includes("legacy-"), false, "the report names no token");

      const row = await h.row("provider-1");
      assert.deepEqual(row.account_details, { merchantId: "MERCHANT_1", locationId: "LEGACY_LOC" });
      assert.equal(row.account_status, "active");
      assert.equal(new Date(row.token_expires_at).toISOString(), "2099-01-01T00:00:00.000Z");
      assert.equal(decryptSecret(row.encrypted_access_token, `payment_methods:${row.id}:square_access_token`), "legacy-access-1");
      assert.equal(decryptSecret(row.encrypted_refresh_token, `payment_methods:${row.id}:square_refresh_token`), "legacy-refresh-1");
      assert.equal(JSON.stringify(row).includes("legacy-access-1"), false);
      assert.equal(row.granted_scopes, null, "a legacy connection is not trusted until Square confirms its scopes");
      assert.equal(row.location_id, null, "the unverified legacy location is not promoted to the verified location");

      // Idempotent: a second run finds nothing, and the sealed values are untouched.
      const sealedBefore = row.encrypted_access_token;
      assert.deepEqual(await h.service.convertAllLegacyRows(), { found: 0, converted: 0, alreadyConverted: 0, malformed: [] });
      assert.equal((await h.row("provider-1")).encrypted_access_token, sealedBefore);
      // The plaintext guarantee can now be made unconditional.
      await h.pool.query(`ALTER TABLE payment_methods VALIDATE CONSTRAINT payment_methods_no_plaintext_oauth_token_check`);
    });
  });

  test("malformed legacy records fail closed: reported by id, left exactly as they were, and never presented as connected", async () => {
    await withHarness({ applyHardening: false }, async (h) => {
      await insertLegacy(h, "no-refresh", { merchantId: "MERCHANT_1", accessToken: sentinel("malformed-access-1"), tokenExpiresAt: "2099-01-01T00:00:00Z" });
      await insertLegacy(h, "numeric-token", { merchantId: "MERCHANT_1", accessToken: 12345, refreshToken: sentinel("malformed-refresh-2"), tokenExpiresAt: "2099-01-01T00:00:00Z" });
      await insertLegacy(h, "bad-expiry", legacyDetails("malformed-access-3", "malformed-refresh-3", "not-a-date"));
      await insertLegacy(h, "dead-with-secrets", legacyDetails("malformed-access-4", "malformed-refresh-4"), "disabled");
      await h.hardening();
      const before = await h.pool.query(`SELECT id, account_details FROM payment_methods ORDER BY user_id`);
      const summary = await h.service.convertAllLegacyRows();
      assert.equal(summary.found, 4);
      assert.equal(summary.converted, 0);
      assert.deepEqual(summary.malformed.map((entry) => entry.reason).sort(), ["inactive_connection_with_secrets", "invalid_expiry", "missing_or_non_string_token", "missing_or_non_string_token"]);
      assert.equal(JSON.stringify(summary).includes("malformed-"), false);
      const after = await h.pool.query(`SELECT id, account_details FROM payment_methods ORDER BY user_id`);
      assert.deepEqual(after.rows, before.rows, "malformed rows are not modified");
      for (const user of ["no-refresh", "numeric-token", "bad-expiry"]) {
        const readiness = await h.service.getSquarePaymentReadiness(user);
        assert.equal(readiness.state, "needs_reauthorization", user);
        assert.equal(readiness.paymentReady, false);
        assert.equal(await h.service.getReadyConnectedCredentials(user), null);
      }
    });
  });

  test("a legacy connection is converted when its owner is next checked, then verified before it is trusted", async () => {
    await withHarness({ applyHardening: false }, async (h) => {
      await insertLegacy(h, "provider-1", legacyDetails("lazy-access-1", "lazy-refresh-1"));
      await h.hardening();
      const readiness = await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(readiness.state, "active");
      const row = await h.row("provider-1");
      assert.equal(row.account_details.accessToken, undefined);
      assert.equal(decryptSecret(row.encrypted_access_token, `payment_methods:${row.id}:square_access_token`), "lazy-access-1");
      assert.ok(row.granted_scopes.includes("PAYMENTS_WRITE"));
      assert.equal(row.location_id, "LOC_1");
    });
  });

  test("a legacy connection that only holds the old, narrower scopes must be reauthorized, and its secrets are removed", async () => {
    await withHarness({ applyHardening: false, fake: { scopes: ["MERCHANT_PROFILE_READ", "PAYMENTS_WRITE"] } }, async (h) => {
      await insertLegacy(h, "provider-1", legacyDetails("narrow-access-1", "narrow-refresh-1"));
      await h.hardening();
      const readiness = await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(readiness.state, "needs_reauthorization");
      const row = await h.row("provider-1");
      assert.equal(row.account_status, "needs_reauthorization");
      assert.equal(row.encrypted_access_token, null);
      assert.equal(row.encrypted_refresh_token, null);
      assert.equal(row.provider_id, "MERCHANT_1", "merchant identity is kept");
    });
  });

  test("the hardening migration is additive, idempotent, and stops plaintext tokens being written again", async () => {
    await withHarness({ applyHardening: false }, async (h) => {
      await insertLegacy(h, "provider-1", legacyDetails("migration-access-1", "migration-refresh-1"));
      await h.hardening();
      // Re-applying the whole file (as a manual re-run would) changes nothing and does not fail.
      await h.pool.query(migrationSql);
      assert.equal(await h.rowCount(), 1, "no payment_methods row is deleted");
      assert.equal((await h.row("provider-1")).account_details.accessToken, "migration-access-1", "the migration never touches legacy tokens");
      await h.user("provider-2");
      await assert.rejects(
        h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_details) VALUES ('provider-2', 'square', 'M', '{"accessToken":"x"}'::jsonb)`),
        (error: { code?: string }) => error.code === "23514",
      );
      // Updating a legacy row without removing the plaintext is refused too.
      await assert.rejects(h.pool.query(`UPDATE payment_methods SET updated_at = now() WHERE user_id = 'provider-1'`), (error: { code?: string }) => error.code === "23514");
      // A credential must be a sealed pair with an expiry.
      await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id) VALUES ('provider-2', 'square', 'M2')`);
      await assert.rejects(h.pool.query(`UPDATE payment_methods SET encrypted_access_token = 'plain', encrypted_refresh_token = 'plain', token_expires_at = now() WHERE user_id = 'provider-2'`), (error: { code?: string }) => error.code === "23514");
      await assert.rejects(h.pool.query(`UPDATE payment_methods SET encrypted_access_token = 'sqenc:v1:a:b:c:d' WHERE user_id = 'provider-2'`), (error: { code?: string }) => error.code === "23514");
      // A revoked or disconnected connection cannot keep a secret.
      await assert.rejects(h.pool.query(`UPDATE payment_methods SET account_status = 'disconnected', encrypted_access_token = 'sqenc:v1:a:b:c:d', encrypted_refresh_token = 'sqenc:v1:a:b:c:d', token_expires_at = now() WHERE user_id = 'provider-2'`), (error: { code?: string }) => error.code === "23514");
      await assert.rejects(h.pool.query(`UPDATE payment_methods SET account_status = 'bogus' WHERE user_id = 'provider-2'`), (error: { code?: string }) => error.code === "23514");
    });
  });

  test("malformed account_details of every shape never makes a connection look ready", async () => {
    await withHarness({}, async (h) => {
      const shapes: Array<[string, string | null]> = [["null", null], ["array", "[]"], ["string", '"text"'], ["number", "42"], ["empty object", "{}"], ["unrelated keys", '{"x":{"y":1}}']];
      let n = 0;
      for (const [label, json] of shapes) {
        const user = `shape-${n++}`;
        await h.user(user);
        await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ($1, 'square', 'M', 'active', $2::jsonb)`, [user, json]);
        const readiness = await h.service.getSquarePaymentReadiness(user);
        assert.equal(readiness.state, "needs_reauthorization", label);
        assert.equal(readiness.paymentReady, false, label);
        assert.equal(await h.service.getReadyConnectedCredentials(user), null, label);
      }
      // A token key holding a non-string can no longer be written at all.
      await h.user("shape-nested");
      await assert.rejects(
        h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ('shape-nested', 'square', 'M', 'active', '{"accessToken":{"a":1}}'::jsonb)`),
        (error: { code?: string }) => error.code === "23514",
      );
    });
    // ...but a historical row of that shape is reported, not converted, and is never trusted.
    await withHarness({ applyHardening: false }, async (h) => {
      await insertLegacy(h, "nested", { accessToken: { a: 1 }, refreshToken: ["x"], tokenExpiresAt: "2099-01-01T00:00:00Z" });
      await h.hardening();
      assert.deepEqual((await h.service.convertAllLegacyRows()).malformed.map((entry) => entry.reason), ["missing_or_non_string_token"]);
      assert.equal((await h.service.getSquarePaymentReadiness("nested")).state, "needs_reauthorization");
    });
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Refresh
   * ------------------------------------------------------------------------------------------------------- */

  const soon = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // inside the 7-day safety window

  test("a token inside the safety window is refreshed before use; the new token, expiry and refresh time are stored sealed", async () => {
    await withHarness({ fake: { grants: [
      tokenGrant("refresh-a-access-1", "refresh-a-refresh-1", soon()),
      tokenGrant("refresh-a-access-2", "refresh-a-refresh-1", "2099-06-01T00:00:00Z"),
    ] } }, async (h) => {
      await h.connect("provider-1");
      const before = await h.row("provider-1");
      assert.ok(new Date(before.token_expires_at).getTime() - Date.now() < SQUARE_TOKEN_REFRESH_WINDOW_MS);
      const credentials = await h.service.getReadyConnectedCredentials("provider-1");
      assert.equal(credentials?.accessToken, "refresh-a-access-2");
      const after = await h.row("provider-1");
      assert.equal(h.fake.calls("/oauth2/token"), 2, "one authorization-code exchange, one refresh");
      assert.equal(new Date(after.token_expires_at).toISOString(), "2099-06-01T00:00:00.000Z");
      assert.ok(new Date(after.last_refreshed_at).getTime() >= new Date(before.last_refreshed_at).getTime());
      assert.notEqual(after.encrypted_access_token, before.encrypted_access_token);
      // Always re-sealed under the current key (fresh nonce), whether or not Square returned a new value.
      assert.notEqual(after.encrypted_refresh_token, before.encrypted_refresh_token);
      assert.equal(decryptSecret(after.encrypted_refresh_token, `payment_methods:${after.id}:square_refresh_token`), "refresh-a-refresh-1");
      assert.equal(JSON.stringify(after).includes("refresh-a-access-2"), false);
      const refreshRequest = JSON.parse(h.fake.requests.filter((request) => request.path === "/oauth2/token")[1].body);
      assert.equal(refreshRequest.grant_type, "refresh_token");
      assert.equal(refreshRequest.refresh_token, "refresh-a-refresh-1");
    });
  });

  test("a token that is not near expiry is NOT refreshed", async () => {
    await withHarness({}, async (h) => {
      await h.connect("provider-1");
      await h.service.getReadyConnectedCredentials("provider-1");
      assert.equal(h.fake.calls("/oauth2/token"), 1);
    });
  });

  test("when Square rotates the refresh token, the new one is sealed and stored in the same update", async () => {
    await withHarness({ fake: { grants: [
      tokenGrant("rot-access-1", "rot-refresh-1", soon()),
      tokenGrant("rot-access-2", "rot-refresh-2", "2099-06-01T00:00:00Z"),
    ] } }, async (h) => {
      await h.connect("provider-1");
      await h.service.getSquarePaymentReadiness("provider-1");
      const row = await h.row("provider-1");
      assert.equal(decryptSecret(row.encrypted_refresh_token, `payment_methods:${row.id}:square_refresh_token`), "rot-refresh-2");
      assert.equal(decryptSecret(row.encrypted_access_token, `payment_methods:${row.id}:square_access_token`), "rot-access-2");
    });
  });

  test("concurrent requests refresh at most once: the refresh token is never rotated by two callers at the same time", async () => {
    await withHarness({ fake: { tokenDelayMs: 0, grants: [
      tokenGrant("race-access-1", "race-refresh-1", soon()),
      tokenGrant("race-access-2", "race-refresh-2", "2099-06-01T00:00:00Z"),
    ] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.state.tokenDelayMs = 300; // keep the first refresh in flight while the others arrive
      const results = await Promise.all(Array.from({ length: 8 }, () => h.service.getSquarePaymentReadiness("provider-1")));
      assert.equal(h.fake.calls("/oauth2/token"), 2, "exactly one authorization exchange and ONE refresh");
      for (const result of results) assert.equal(result.state, "active");
      const row = await h.row("provider-1");
      assert.equal(decryptSecret(row.encrypted_refresh_token, `payment_methods:${row.id}:square_refresh_token`), "race-refresh-2");
    });
  });

  test("a rejected refresh (revoked or invalid refresh token) takes the connection out of service and removes every secret", async () => {
    await withHarness({ fake: { grants: [tokenGrant("rev-access-1", "rev-refresh-1", soon())] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.state.failures.token = 401;
      const readiness = await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(readiness.state, "needs_reauthorization");
      assert.equal(readiness.paymentReady, false);
      const row = await h.row("provider-1");
      assert.equal(row.account_status, "needs_reauthorization");
      assert.equal(row.encrypted_access_token, null);
      assert.equal(row.encrypted_refresh_token, null);
      assert.equal(row.token_expires_at, null);
      assert.equal(row.provider_id, "MERCHANT_1", "merchant identity is retained");
      assert.equal(row.location_id, "LOC_1", "location identity is retained");
      assert.equal(row.merchant_name, "Test Catering Co");
      assert.deepEqual(h.logs.map((entry) => entry.event), ["square_connection_needs_reauthorization"]);
      // It stays out of service and stops calling Square.
      h.fake.state.failures.token = undefined;
      const calls = h.fake.requests.length;
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "needs_reauthorization");
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
      assert.equal(h.fake.requests.length, calls);
      const view = await h.service.status("provider-1");
      assert.equal(view.needsReauthorization, true);
      assert.equal(view.paymentReady, false);
      // Reconnecting restores it on the same row.
      h.fake.state.grants = [tokenGrant("rev-access-2", "rev-refresh-2", "2099-01-01T00:00:00Z")];
      h.fake.resetGrants();
      assert.equal((await h.connect("provider-1")).ok, true);
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active");
      assert.equal(await h.rowCount(), 1);
    });
  });

  test("an outage while refreshing changes nothing: the connection is unverified, not revoked, and recovers", async () => {
    await withHarness({ fake: { grants: [tokenGrant("out-access-1", "out-refresh-1", soon())] } }, async (h) => {
      await h.connect("provider-1");
      const before = await h.row("provider-1");
      h.fake.state.failures.token = 503;
      const readiness = await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(readiness.state, "verification_unavailable");
      assert.equal(readiness.paymentReady, false);
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
      const after = await h.row("provider-1");
      assert.equal(after.account_status, "active");
      assert.equal(after.encrypted_access_token, before.encrypted_access_token);
      assert.equal(after.encrypted_refresh_token, before.encrypted_refresh_token);
      h.fake.state.failures.token = undefined;
      h.fake.state.grants = [tokenGrant("out-access-2", "out-refresh-1", "2099-06-01T00:00:00Z")];
      h.fake.resetGrants();
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active");
    });
  });

  test("a refresh that returns a different merchant is rejected and the connection is taken out of service", async () => {
    for (const refreshed of [
      tokenGrant("mm-access-2", "mm-refresh-1", "2099-06-01T00:00:00Z", "ANOTHER_MERCHANT"),
      tokenGrant("mm-access-3", "mm-refresh-1", "2099-06-01T00:00:00Z", null),
    ]) {
      await withHarness({ fake: { grants: [tokenGrant("mm-access-1", "mm-refresh-1", soon()), refreshed] } }, async (h) => {
        await h.connect("provider-1");
        if (refreshed.merchant_id === null) h.fake.state.profileMerchantId = "ANOTHER_MERCHANT";
        assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "needs_reauthorization");
        const row = await h.row("provider-1");
        assert.equal(row.encrypted_access_token, null);
        assert.equal(row.provider_id, "MERCHANT_1");
        assert.deepEqual(h.logs.map((entry) => entry.fields.reason), ["refresh_merchant_mismatch"]);
      });
    }
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Key rotation
   * ------------------------------------------------------------------------------------------------------- */

  const keyIdOf = (sealed: string) => sealed.split(":")[2];
  async function withKeys<T>(current: string, previous: string | undefined, fn: () => Promise<T>): Promise<T> {
    const saved = { current: process.env[SECRET_BOX_KEY_ENV], previous: process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS };
    process.env[SECRET_BOX_KEY_ENV] = current;
    if (previous === undefined) delete process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS; else process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS = previous;
    try { return await fn(); } finally {
      process.env[SECRET_BOX_KEY_ENV] = saved.current!;
      if (saved.previous === undefined) delete process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS; else process.env.SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS = saved.previous;
    }
  }

  test("a refresh after a key rotation re-seals BOTH tokens under the current key, so the previous key can then be removed", async () => {
    for (const squareReturnsRefreshToken of [true, false]) {
      const keyA = randomBytes(32).toString("base64");
      const keyB = randomBytes(32).toString("base64");
      await withKeys(keyA, undefined, () => withHarness({ fake: { grants: [
        tokenGrant("rot-key-access-1", "rot-key-refresh-1", soon()),
        // The code flow returns the SAME refresh token (or none); either way the old ciphertext must not survive.
        { access_token: sentinel("rot-key-access-2"), ...(squareReturnsRefreshToken ? { refresh_token: "rot-key-refresh-1" } : {}), expires_at: "2099-06-01T00:00:00Z", merchant_id: "MERCHANT_1" },
      ] } }, async (h) => {
        await h.connect("provider-1");
        const sealedUnderA = await h.row("provider-1");
        assert.equal(keyIdOf(sealedUnderA.encrypted_refresh_token), keyIdOf(sealedUnderA.encrypted_access_token));
        await withKeys(keyB, keyA, async () => {
          assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active");
          const row = await h.row("provider-1");
          assert.notEqual(keyIdOf(row.encrypted_access_token), keyIdOf(sealedUnderA.encrypted_access_token));
          assert.equal(keyIdOf(row.encrypted_refresh_token), keyIdOf(row.encrypted_access_token), "the refresh token moved to the current key too");
          assert.equal(decryptSecret(row.encrypted_refresh_token, `payment_methods:${row.id}:square_refresh_token`), "rot-key-refresh-1");
        });
        // The previous key is gone: the connection still opens.
        await withKeys(keyB, undefined, async () => {
          const credentials = await h.service.getReadyConnectedCredentials("provider-1");
          assert.equal(credentials?.accessToken, "rot-key-access-2");
          const row = await h.row("provider-1");
          assert.equal(decryptSecret(row.encrypted_refresh_token, `payment_methods:${row.id}:square_refresh_token`), "rot-key-refresh-1");
        });
      }));
    }
  });

  test("resealRotatedCredentials moves every credential to the current key without changing it or its generation, and is idempotent", async () => {
    const keyA = randomBytes(32).toString("base64");
    const keyB = randomBytes(32).toString("base64");
    const keyC = randomBytes(32).toString("base64");
    await withKeys(keyA, undefined, () => withHarness({ fake: { grants: [tokenGrant("reseal-access-1", "reseal-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const before = await h.row("provider-1");
      // A second row sealed under a key that is neither current nor previous: it cannot be re-sealed.
      await withKeys(keyC, undefined, async () => {
        h.fake.resetGrants();
        h.fake.state.grants = [tokenGrant("reseal-access-2", "reseal-refresh-2", "2099-01-01T00:00:00Z")];
        await h.connect("provider-2");
      });
      const orphan = await h.row("provider-2");

      await withKeys(keyB, keyA, async () => {
        assert.deepEqual(await h.service.resealRotatedCredentials({ dryRun: true }), { checked: 2, resealed: 1, alreadyCurrent: 0, failed: [{ id: orphan.id, reason: "cannot_decrypt" }] });
        assert.equal((await h.row("provider-1")).encrypted_access_token, before.encrypted_access_token, "a dry run changes nothing");

        const summary = await h.service.resealRotatedCredentials();
        assert.deepEqual(summary, { checked: 2, resealed: 1, alreadyCurrent: 0, failed: [{ id: orphan.id, reason: "cannot_decrypt" }] });
        assert.equal(JSON.stringify(summary).includes("reseal-"), false, "the report names no token");
        const after = await h.row("provider-1");
        assert.notEqual(keyIdOf(after.encrypted_access_token), keyIdOf(before.encrypted_access_token));
        assert.equal(keyIdOf(after.encrypted_refresh_token), keyIdOf(after.encrypted_access_token));
        assert.equal(h.sealedAccess(after), "reseal-access-1");
        assert.equal(after.credential_generation, before.credential_generation, "the credential did not change, so neither does its generation");
        // The unopenable row is exactly as it was.
        assert.equal((await h.row("provider-2")).encrypted_access_token, orphan.encrypted_access_token);
        // Idempotent.
        assert.deepEqual(await h.service.resealRotatedCredentials(), { checked: 2, resealed: 0, alreadyCurrent: 1, failed: [{ id: orphan.id, reason: "cannot_decrypt" }] });
      });
      // With the previous key removed, the re-sealed connection still works.
      await withKeys(keyB, undefined, async () => {
        assert.equal((await h.service.getReadyConnectedCredentials("provider-1"))?.accessToken, "reseal-access-1");
      });
    }));
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Verification against Square: revoked, stale, widened or moved connections
   * ------------------------------------------------------------------------------------------------------- */

  test("a token Square no longer accepts takes the connection out of service on the next verification", async () => {
    await withHarness({}, async (h) => {
      await h.connect("provider-1");
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active");
      h.fake.state.failures.merchant = 401; // revoked from the Square dashboard
      // Within the verification TTL the stored facts are used; a forced check asks Square.
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1", { force: true })).state, "needs_reauthorization");
      const row = await h.row("provider-1");
      assert.equal(row.account_status, "needs_reauthorization");
      assert.equal(row.encrypted_access_token, null);
    });
  });

  test("stale verification is re-checked after its lifetime; a merchant change or lost scope is caught", async () => {
    let now = new Date();
    await withHarness({ now: () => now }, async (h) => {
      await h.connect("provider-1");
      await h.service.getSquarePaymentReadiness("provider-1");
      const merchantCalls = h.fake.calls("/v2/merchants/me");
      await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(h.fake.calls("/v2/merchants/me"), merchantCalls, "fresh facts are not re-fetched");
      now = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      h.setClock(now);
      h.fake.state.scopes = ["MERCHANT_PROFILE_READ"];
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "needs_reauthorization");
    });
    await withHarness({}, async (h) => {
      await h.connect("provider-1");
      h.fake.state.profileMerchantId = "ANOTHER_MERCHANT";
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1", { force: true })).state, "needs_reauthorization");
    });
  });

  test("an outage while verifying leaves stored state alone and reports the connection as unverifiable", async () => {
    await withHarness({}, async (h) => {
      await h.connect("provider-1");
      h.fake.state.failures.locations = 503;
      const before = await h.row("provider-1");
      const readiness = await h.service.getSquarePaymentReadiness("provider-1", { force: true });
      assert.equal(readiness.state, "verification_unavailable");
      assert.equal(readiness.paymentReady, false);
      const after = await h.row("provider-1");
      assert.equal(after.account_status, "active");
      assert.equal(after.encrypted_access_token, before.encrypted_access_token);
    });
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Encryption faults
   * ------------------------------------------------------------------------------------------------------- */

  test("the wrong key, a tampered ciphertext and a ciphertext moved between rows all fail closed WITHOUT altering or destroying credentials", async () => {
    await withHarness({ fake: { grants: [tokenGrant("enc-access-1", "enc-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.resetGrants();
      h.fake.state.merchantId = "MERCHANT_2";
      h.fake.state.profileMerchantId = "MERCHANT_2";
      h.fake.state.grants = [tokenGrant("enc-access-2", "enc-refresh-2", "2099-01-01T00:00:00Z", "MERCHANT_2")];
      h.fake.state.locations = [{ id: "LOC_2", status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: "MERCHANT_2", currency: "USD" }];
      await h.connect("provider-2");
      const original = await h.pool.query(`SELECT user_id, encrypted_access_token, encrypted_refresh_token, account_status FROM payment_methods ORDER BY user_id`);

      // 1. wrong key
      const saved = process.env[SECRET_BOX_KEY_ENV];
      process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
      try {
        assert.equal((await h.service.getSquarePaymentReadiness("provider-1", { force: true })).state, "configuration_error");
      } finally { process.env[SECRET_BOX_KEY_ENV] = saved; }

      // 2. tampered ciphertext
      // Flip the FIRST character of the ciphertext segment: every bit of it is significant (the last character of a
      // base64url segment can carry padding bits that decode to the same bytes).
      const segments: string[] = original.rows[0].encrypted_access_token.split(":");
      segments[4] = (segments[4][0] === "A" ? "B" : "A") + segments[4].slice(1);
      const tampered = segments.join(":");
      await h.pool.query(`UPDATE payment_methods SET encrypted_access_token = $1 WHERE user_id = 'provider-1'`, [tampered]);
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "configuration_error");
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
      await h.pool.query(`UPDATE payment_methods SET encrypted_access_token = $1 WHERE user_id = 'provider-1'`, [original.rows[0].encrypted_access_token]);

      // 3. provider-2's valid ciphertext copied onto provider-1's row (bound to a different row id)
      await h.pool.query(`UPDATE payment_methods SET encrypted_access_token = $1 WHERE user_id = 'provider-1'`, [original.rows[1].encrypted_access_token]);
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "configuration_error");
      await h.pool.query(`UPDATE payment_methods SET encrypted_access_token = $1 WHERE user_id = 'provider-1'`, [original.rows[0].encrypted_access_token]);

      const restored = await h.pool.query(`SELECT user_id, encrypted_access_token, encrypted_refresh_token, account_status FROM payment_methods ORDER BY user_id`);
      assert.deepEqual(restored.rows, original.rows);
      assert.equal(restored.rows.every((row: { account_status: string }) => row.account_status === "active"), true, "no connection was demoted by a configuration fault");
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active");
    });
  });

  test("an undecryptable refresh token is a configuration fault, not a revocation: credentials are kept", async () => {
    await withHarness({ fake: { grants: [tokenGrant("cf-access-1", "cf-refresh-1", soon())] } }, async (h) => {
      await h.connect("provider-1");
      const before = await h.row("provider-1");
      const saved = process.env[SECRET_BOX_KEY_ENV];
      process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
      try {
        assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "configuration_error");
      } finally { process.env[SECRET_BOX_KEY_ENV] = saved; }
      const after = await h.row("provider-1");
      assert.equal(after.account_status, "active");
      assert.equal(after.encrypted_refresh_token, before.encrypted_refresh_token);
      assert.equal(h.fake.calls("/oauth2/token"), 1, "Square was not asked to refresh with an unreadable token");
    });
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Disconnect
   * ------------------------------------------------------------------------------------------------------- */

  async function connectSecondMerchant(h: Harness, userId: string, merchantId: string, grant: ReturnType<typeof tokenGrant>) {
    h.fake.resetGrants();
    Object.assign(h.fake.state, { merchantId, profileMerchantId: merchantId, grants: [grant], locations: [{ id: `LOC_${merchantId}`, status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: merchantId, currency: "USD" }] });
    await h.connect(userId);
  }

  test("disconnect revokes at Square, removes every secret, keeps merchant/location history, and is idempotent", async () => {
    await withHarness({ fake: { grants: [tokenGrant("dc-access-1", "dc-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: true, providerRevoked: true });
      const revoke = h.fake.requests.find((request) => request.path === "/oauth2/revoke")!;
      assert.equal(JSON.parse(revoke.body).access_token, "dc-access-1");
      const row = await h.row("provider-1");
      assert.equal(row.account_status, "disconnected");
      assert.equal(row.encrypted_access_token, null);
      assert.equal(row.encrypted_refresh_token, null);
      assert.equal(row.token_expires_at, null);
      assert.equal(row.is_default, false);
      assert.ok(row.disconnected_at);
      assert.equal(row.provider_id, "MERCHANT_1");
      assert.equal(row.location_id, "LOC_1");
      assert.equal(row.merchant_name, "Test Catering Co");
      assert.deepEqual(row.account_details, { merchantId: "MERCHANT_1" });
      assert.equal(await h.rowCount(), 1, "the row is retained as history");
      // Repeating is safe and changes nothing.
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: false, providerRevoked: false });
      assert.equal(h.fake.calls("/oauth2/revoke"), 1);
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "not_connected");
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
      // Reconnecting after a disconnect works on the same row.
      h.fake.resetGrants();
      assert.equal((await h.connect("provider-1")).ok, true);
      assert.equal((await h.row("provider-1")).disconnected_at, null);
      assert.equal(await h.rowCount(), 1);
    });
  });

  test("disconnect only ever touches the signed-in user's own connection, and a user with none gets the same harmless answer", async () => {
    await withHarness({ fake: { grants: [tokenGrant("own-access-1", "own-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      await connectSecondMerchant(h, "provider-2", "MERCHANT_2", tokenGrant("own-access-2", "own-refresh-2", "2099-01-01T00:00:00Z", "MERCHANT_2"));
      const second = await h.row("provider-2");
      assert.deepEqual(await h.service.disconnect("someone-without-a-connection"), { changed: false, providerRevoked: false });
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: true, providerRevoked: true });
      const untouched = await h.row("provider-2");
      assert.equal(untouched.account_status, "active");
      assert.equal(untouched.encrypted_access_token, second.encrypted_access_token);
      assert.equal((await h.service.getSquarePaymentReadiness("provider-2")).state, "active");
    });
  });

  test("two ChefSire accounts on one Square merchant: disconnecting one does not revoke the other's token", async () => {
    await withHarness({ fake: { grants: [tokenGrant("shared-access-1", "shared-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.resetGrants();
      h.fake.state.grants = [tokenGrant("shared-access-2", "shared-refresh-2", "2099-01-01T00:00:00Z")];
      await h.connect("provider-2");
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: true, providerRevoked: false });
      assert.equal(h.fake.calls("/oauth2/revoke"), 0);
      assert.equal((await h.service.getSquarePaymentReadiness("provider-2")).state, "active");
    });
  });

  test("disconnect still completes locally when Square cannot confirm the revocation, and says so", async () => {
    await withHarness({ fake: { grants: [tokenGrant("unc-access-1", "unc-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.state.failures.revoke = 503;
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: true, providerRevoked: false });
      assert.equal((await h.row("provider-1")).account_status, "disconnected");
      assert.equal((await h.row("provider-1")).encrypted_access_token, null);
      assert.deepEqual(h.logs.map((entry) => entry.event), ["square_disconnect_revocation_unconfirmed"]);
    });
  });

  test("disconnecting an already-dead token counts as revoked; disconnecting a needs-reauthorization connection is fine", async () => {
    await withHarness({ fake: { grants: [tokenGrant("dead-access-1", "dead-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.state.failures.revoke = 401;
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: true, providerRevoked: true });
    });
    await withHarness({ fake: { grants: [tokenGrant("dead-access-2", "dead-refresh-2", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.state.failures.merchant = 401;
      await h.service.getSquarePaymentReadiness("provider-1", { force: true });
      assert.equal((await h.row("provider-1")).account_status, "needs_reauthorization");
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: true, providerRevoked: false });
      assert.equal((await h.row("provider-1")).account_status, "disconnected");
    });
  });

  test("concurrent disconnects are safe: Square is asked to revoke once and the end state is disconnected", async () => {
    await withHarness({ fake: { grants: [tokenGrant("cd-access-1", "cd-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const results = await Promise.all(Array.from({ length: 5 }, () => h.service.disconnect("provider-1")));
      assert.equal(results.filter((result) => result.changed).length, 1);
      assert.equal(h.fake.calls("/oauth2/revoke"), 1);
      assert.equal((await h.row("provider-1")).account_status, "disconnected");
    });
  });

  test("a disconnect and a refresh racing each other never resurrect credentials", async () => {
    await withHarness({ fake: { grants: [tokenGrant("rc-access-1", "rc-refresh-1", soon()), tokenGrant("rc-access-2", "rc-refresh-1", "2099-06-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.state.tokenDelayMs = 200;
      await Promise.all([h.service.getSquarePaymentReadiness("provider-1"), h.service.disconnect("provider-1")]);
      const row = await h.row("provider-1");
      assert.equal(row.account_status, "disconnected");
      assert.equal(row.encrypted_access_token, null);
      assert.equal(row.encrypted_refresh_token, null);
    });
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Nothing secret is ever logged
   * ------------------------------------------------------------------------------------------------------- */

  test("no access token, refresh token, application secret or encryption key appears in anything logged during this suite", () => {
    const everything = consoleOutput.join("\n");
    for (const secret of [...SECRET_SENTINELS, "app-secret-test", KEY, "not-a-valid-key"]) {
      assert.equal(everything.includes(secret), false, `a secret value was logged`);
    }
    assert.equal(everything.includes("sqenc:v1:"), false, "no ciphertext was logged");
  });
}
