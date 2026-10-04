/**
 * Phase 2Q Gate 0 repair: a verification, refresh, reconnect or disconnect may only mutate the EXACT credential snapshot it
 * started from. These are real concurrency tests: a REAL PostgreSQL, the REAL `square` SDK against a local fake Square, and
 * separate pooled connections. An attempt is held "after Square answered, before it writes" by gating the pool's write
 * statement itself (the production code carries no test hook), while another operation commits on a different connection.
 *
 * Set TEST_DATABASE_URL to a loopback database whose name contains "test"; the suite is skipped otherwise.
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
import { startFakeSquare, REQUIRED_TEST_SCOPES, defaultFakeSquareState, type FakeSquareState } from "../test-support/fake-square";
import { createSquareConnectionService, type SqlPool } from "./square-connection-service";
import { createSquareProviderApi } from "./square-integration";
import { decryptSecret, SECRET_BOX_KEY_ENV } from "./secret-box";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

if (!URL_ENV) {
  test("Square connection snapshot concurrency (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const config = parseLocalTestDatabaseUrl(URL_ENV);
  const sqlOf = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
  const baseDdl = sqlOf("server/drizzle/20251108_marketplace_monetization.sql").match(/CREATE TABLE IF NOT EXISTS payment_methods \([\s\S]*?\n\);/)![0];

  /** Holds the next matching write on the pool until released, after announcing that it has been reached. */
  type Gate = { armed: boolean; pattern: RegExp; reached: Promise<void>; release: () => void; before?: () => Promise<void> };
  function newGate(pattern: RegExp): Gate {
    let reachedResolve!: () => void;
    let releaseResolve!: () => void;
    const gate: Gate = {
      armed: true, pattern,
      reached: new Promise<void>((resolve) => { reachedResolve = resolve; }),
      release: () => releaseResolve(),
    };
    const released = new Promise<void>((resolve) => { releaseResolve = resolve; });
    (gate as Gate & { _reached: () => void; _released: Promise<void> })._reached = reachedResolve;
    (gate as Gate & { _reached: () => void; _released: Promise<void> })._released = released;
    return gate;
  }
  const withTimeout = <T>(promise: Promise<T>, label: string) =>
    Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out: ${label}`)), 15_000))]);

  async function harness(options: { applyMigrations?: boolean; fake?: Partial<FakeSquareState> } = {}) {
    const namespace = `sqsnap_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const admin = new pg.Client(config);
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${namespace}`);
    const pool = new pg.Pool({ ...config, options: `-c search_path=${namespace}`, max: 12 });
    await pool.query(`CREATE TABLE users (id varchar PRIMARY KEY)`);
    await pool.query(baseDdl);
    await pool.query(`CREATE TABLE _app_migrations (filename text primary key, applied_at timestamptz not null default now())`);
    const fake = await startFakeSquare(options.fake);
    const logs: { event: string; fields: Record<string, unknown> }[] = [];
    let gate: Gate | null = null;
    const gated = {
      query: async (text: string, params?: unknown[]) => {
        const g = gate;
        if (g?.armed && g.pattern.test(text)) {
          g.armed = false;
          (g as Gate & { _reached: () => void })._reached();
          await (g as Gate & { _released: Promise<void> })._released;
          if (g.before) await g.before();
        }
        return pool.query(text, params);
      },
      connect: () => pool.connect(),
    };
    const service = createSquareConnectionService({
      pool: gated as unknown as SqlPool,
      api: createSquareProviderApi({ baseUrl: fake.baseUrl }),
      log: { warn: (event, fields) => { logs.push({ event, fields }); } },
    });
    const h = {
      pool, fake, service, logs,
      arm(pattern: RegExp, before?: () => Promise<void>) { gate = newGate(pattern); gate.before = before; return gate; },
      async migrate() {
        const client = await pool.connect();
        try {
          await applyMigration(client as never, "server:20261007_square_connection_hardening.sql", sqlOf("server/migrations/20261007_square_connection_hardening.sql"));
          await applyMigration(client as never, "server:20261008_square_credential_generation.sql", sqlOf("server/migrations/20261008_square_credential_generation.sql"));
        } finally { client.release(); }
      },
      async connect(userId: string) {
        await pool.query(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
        const verification = await service.verifyAuthorizationCode("auth-code");
        assert.equal(verification.ok, true);
        if (!verification.ok) return;
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await service.persistVerifiedConnection(client as never, userId, verification.verified);
          await client.query("COMMIT");
        } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
      },
      /** Replaces the fake account so the NEXT connect installs a different merchant, location, scopes and token. */
      secondAccount(extra: Partial<FakeSquareState> = {}) {
        fake.resetGrants();
        Object.assign(fake.state, {
          merchantId: "MERCHANT_2", profileMerchantId: "MERCHANT_2", statusMerchantId: "MERCHANT_2",
          scopes: [...REQUIRED_TEST_SCOPES, "NEW_ACCOUNT_SCOPE"],
          grants: [{ access_token: "second-account-access", refresh_token: "second-account-refresh", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_2" }],
          locations: [{ id: "LOC_2", name: "Second Kitchen", status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: "MERCHANT_2", currency: "USD" }],
          ...extra,
        });
      },
      async row(userId: string) { return (await pool.query(`SELECT * FROM payment_methods WHERE user_id = $1`, [userId])).rows[0]; },
      generation: async (userId: string) => Number((await h.row(userId)).credential_generation),
      accessOf: (row: { id: string; encrypted_access_token: string }) => decryptSecret(row.encrypted_access_token, `payment_methods:${row.id}:square_access_token`),
      async cleanup() {
        await fake.close();
        await pool.end();
        await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
        await admin.end();
      },
    };
    if (options.applyMigrations !== false) await h.migrate();
    return h;
  }
  type Harness = Awaited<ReturnType<typeof harness>>;
  async function withHarness(options: Parameters<typeof harness>[0], fn: (h: Harness) => Promise<void>) {
    const h = await harness(options);
    try { await fn(h); } finally { await h.cleanup(); }
  }

  const VERIFY_WRITE = /SET granted_scopes/;
  const REAUTH_WRITE = /SET account_status = 'needs_reauthorization'/;
  const grant = (access: string, refresh: string, expiresAt: string) => ({ access_token: access, refresh_token: refresh, expires_at: expiresAt, merchant_id: "MERCHANT_1" });
  const soon = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

  /* ------------------------------------------------------------------------------------------------------- *
   * Verification vs disconnect  (Codex P1 #2)
   * ------------------------------------------------------------------------------------------------------- */

  test("verification vs disconnect: a disconnect that commits before the verification write is NOT undone, and no credential is returned", async () => {
    await withHarness({ fake: { grants: [grant("old-access-token-1", "old-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const generationBefore = await h.generation("provider-1");
      const gate = h.arm(VERIFY_WRITE);

      // Thread A: starts a verification, decrypts the old credential, Square answers, and then waits before it writes.
      const verification = h.service.getSquarePaymentReadiness("provider-1", { force: true });
      await withTimeout(gate.reached, "verification reached its write");
      assert.ok(h.fake.calls("/v2/locations") >= 1, "Square had already answered");

      // Thread B: the owner disconnects, and that commits.
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: true, providerRevoked: true });
      const disconnected = await h.row("provider-1");
      assert.equal(disconnected.account_status, "disconnected");

      gate.release();
      const readiness = await withTimeout(verification, "verification finished");

      // The zero-row write forced a reload, and the reload says disconnected -- not "active with retained location".
      assert.equal(readiness.state, "not_connected");
      assert.equal(readiness.paymentReady, false);
      assert.equal(readiness.locationId, null);
      const after = await h.row("provider-1");
      assert.equal(after.account_status, "disconnected");
      assert.equal(after.encrypted_access_token, null);
      assert.equal(after.encrypted_refresh_token, null);
      assert.equal(after.token_expires_at, null);
      assert.equal(after.location_id, "LOC_1", "non-secret history is retained");
      assert.equal(Number(after.credential_generation), generationBefore + 1, "only the disconnect advanced the generation");
      assert.equal(after.disconnected_at.getTime(), disconnected.disconnected_at.getTime());
      assert.ok(h.logs.some((entry) => entry.event === "square_connection_snapshot_changed" && entry.fields.attempted === "verification"));
      // A repeat disconnect is still a no-op, and the connection stays out of service.
      assert.deepEqual(await h.service.disconnect("provider-1"), { changed: false, providerRevoked: false });
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "not_connected");
    });
  });

  test("a credential request that races a disconnect returns NO token", async () => {
    await withHarness({ fake: { grants: [grant("raced-access-token-1", "raced-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      // Make the next evaluation verify (so it reaches a write the gate can hold).
      await h.pool.query(`UPDATE payment_methods SET last_verified_at = now() - interval '2 days' WHERE user_id = 'provider-1'`);
      const gate = h.arm(VERIFY_WRITE);
      const credentials = h.service.getReadyConnectedCredentials("provider-1");
      await withTimeout(gate.reached, "credential request reached its write");
      await h.service.disconnect("provider-1");
      gate.release();
      assert.equal(await withTimeout(credentials, "credential request finished"), null);
      assert.equal((await h.row("provider-1")).account_status, "disconnected");
    });
  });

  test("a disconnected connection that retains location and merchant history never reports active and never yields a credential", async () => {
    await withHarness({ fake: { grants: [grant("history-access-token-1", "history-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      await h.service.disconnect("provider-1");
      const row = await h.row("provider-1");
      assert.equal(row.location_id, "LOC_1");
      assert.equal(row.location_currency, "USD");
      assert.equal(row.provider_id, "MERCHANT_1");
      for (const force of [false, true]) {
        const readiness = await h.service.getSquarePaymentReadiness("provider-1", { force });
        assert.equal(readiness.state, "not_connected");
        assert.equal(readiness.paymentReady, false);
        assert.equal(readiness.merchantId, null);
        assert.equal(readiness.locationId, null);
      }
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
      assert.deepEqual(await h.service.status("provider-1"), { state: "not_connected", connected: false, paymentReady: false, needsReauthorization: false, merchantDisplayName: null, locationDisplayName: null });
      assert.equal(h.logs.filter((entry) => entry.event === "square_connection_snapshot_changed").length, 0, "nothing was racing");
    });
  });

  test("a connection needing reauthorization never yields a credential, however fresh its retained location looks", async () => {
    await withHarness({ fake: { grants: [grant("reauth-access-token-1", "reauth-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.state.failures.merchant = 401;
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1", { force: true })).state, "needs_reauthorization");
      h.fake.state.failures.merchant = undefined;
      const row = await h.row("provider-1");
      assert.equal(row.location_id, "LOC_1");
      assert.equal(row.encrypted_access_token, null);
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).paymentReady, false);
    });
  });

  test("a verification failure racing a disconnect cannot turn the disconnected row into needs_reauthorization", async () => {
    await withHarness({ fake: { grants: [grant("fail-vs-dc-access-1", "fail-vs-dc-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      h.fake.state.failures.merchant = 401;
      const gate = h.arm(REAUTH_WRITE);
      const verification = h.service.getSquarePaymentReadiness("provider-1", { force: true });
      await withTimeout(gate.reached, "failure path reached its write");
      h.fake.state.failures.merchant = undefined;
      await h.service.disconnect("provider-1");
      gate.release();
      assert.equal((await withTimeout(verification, "verification finished")).state, "not_connected");
      const row = await h.row("provider-1");
      assert.equal(row.account_status, "disconnected");
      assert.ok(h.logs.some((entry) => entry.event === "square_connection_snapshot_changed" && entry.fields.attempted === "needs_reauthorization"));
    });
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Verification vs OAuth reconnect  (Codex P1 #1)
   * ------------------------------------------------------------------------------------------------------- */

  test("stale verification SUCCESS vs OAuth reconnect: the new generation's credentials, merchant, location and scopes survive", async () => {
    await withHarness({ fake: { grants: [grant("gen-n-access-token", "gen-n-refresh-token", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const generationN = await h.generation("provider-1");
      const gate = h.arm(VERIFY_WRITE);
      const verification = h.service.getSquarePaymentReadiness("provider-1", { force: true });
      await withTimeout(gate.reached, "verification reached its write");

      // Thread B: a reconnect to a DIFFERENT merchant/location/scope set commits on the same row.
      h.secondAccount();
      await h.connect("provider-1");
      const reconnected = await h.row("provider-1");
      assert.equal(Number(reconnected.credential_generation), generationN + 1);
      assert.equal(reconnected.provider_id, "MERCHANT_2");

      gate.release();
      const readiness = await withTimeout(verification, "verification finished");

      assert.equal(readiness.state, "active");
      assert.equal(readiness.merchantId, "MERCHANT_2", "the answer is about generation N+1, not N");
      assert.equal(readiness.locationId, "LOC_2");
      const after = await h.row("provider-1");
      assert.equal(Number(after.credential_generation), generationN + 1, "the stale attempt advanced nothing");
      assert.equal(after.provider_id, "MERCHANT_2");
      assert.equal(after.location_id, "LOC_2");
      assert.equal(after.location_name, "Second Kitchen");
      assert.equal(after.merchant_name, "Test Catering Co");
      assert.ok(after.granted_scopes.includes("NEW_ACCOUNT_SCOPE"), "the new scopes were not overwritten with the old ones");
      assert.equal(after.account_status, "active");
      assert.equal(h.accessOf(after), "second-account-access", "the new credential survives");
      assert.equal(after.last_verified_at.getTime(), reconnected.last_verified_at.getTime(), "the stale attempt did not touch the verification time");
      assert.equal(h.logs.filter((entry) => entry.event === "square_connection_snapshot_changed").length, 1);
    });
  });

  test("stale verification SUCCESS vs a reconnect to the SAME merchant: only the generation tells them apart, and it holds", async () => {
    await withHarness({ fake: { grants: [grant("same-n-access-token", "same-n-refresh-token", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const generationN = await h.generation("provider-1");
      // Generation N's verification reports facts that only a stale write could leave behind.
      h.fake.state.scopes = [...REQUIRED_TEST_SCOPES, "STALE_GENERATION_SCOPE"];
      h.fake.state.businessName = "Stale Business Name";
      const gate = h.arm(VERIFY_WRITE);
      const verification = h.service.getSquarePaymentReadiness("provider-1", { force: true });
      await withTimeout(gate.reached, "verification reached its write");

      // The owner reconnects the same Square account: same row, same merchant, new credentials, new facts.
      h.fake.state.scopes = [...REQUIRED_TEST_SCOPES, "RECONNECT_SCOPE"];
      h.fake.state.businessName = "Reconnected Business Name";
      h.fake.resetGrants();
      h.fake.state.grants = [grant("same-n1-access-token", "same-n1-refresh-token", "2099-01-01T00:00:00Z")];
      await h.connect("provider-1");

      gate.release();
      const readiness = await withTimeout(verification, "verification finished");
      assert.equal(readiness.state, "active");
      assert.equal(readiness.merchantName, "Reconnected Business Name");
      const after = await h.row("provider-1");
      assert.equal(Number(after.credential_generation), generationN + 1);
      assert.equal(after.provider_id, "MERCHANT_1");
      assert.ok(after.granted_scopes.includes("RECONNECT_SCOPE"));
      assert.equal(after.granted_scopes.includes("STALE_GENERATION_SCOPE"), false);
      assert.equal(after.merchant_name, "Reconnected Business Name");
      assert.equal(h.accessOf(after), "same-n1-access-token");
    });
  });

  test("stale verification FAILURE vs OAuth reconnect: the stale failure cannot demote the new generation or clear its credentials", async () => {
    await withHarness({ fake: { grants: [grant("fail-n-access-token", "fail-n-refresh-token", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const generationN = await h.generation("provider-1");
      h.fake.state.failures.merchant = 401; // generation N's token has been revoked at Square
      const gate = h.arm(REAUTH_WRITE);
      const verification = h.service.getSquarePaymentReadiness("provider-1", { force: true });
      await withTimeout(gate.reached, "failure path reached its write");

      // Thread B: the owner reconnects, which succeeds, while A is about to mark N as needing reauthorization.
      h.fake.state.failures.merchant = undefined;
      h.secondAccount();
      await h.connect("provider-1");

      gate.release();
      const readiness = await withTimeout(verification, "verification finished");

      assert.equal(readiness.state, "active", "the reload judged generation N+1");
      assert.equal(readiness.merchantId, "MERCHANT_2");
      const after = await h.row("provider-1");
      assert.equal(after.account_status, "active");
      assert.equal(Number(after.credential_generation), generationN + 1);
      assert.equal(h.accessOf(after), "second-account-access", "the new credentials were not cleared");
      assert.ok(after.encrypted_refresh_token);
      assert.equal(after.location_id, "LOC_2");
      assert.ok(h.logs.some((entry) => entry.event === "square_connection_snapshot_changed" && entry.fields.attempted === "needs_reauthorization"));
      assert.equal(h.logs.some((entry) => entry.event === "square_connection_needs_reauthorization"), false, "no demotion was ever applied");
      assert.equal((await h.service.getReadyConnectedCredentials("provider-1"))?.accessToken, "second-account-access");
    });
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Verification vs token refresh
   * ------------------------------------------------------------------------------------------------------- */

  test("verification vs token refresh: an ordinary verification on the old snapshot cannot overwrite the refreshed credentials", async () => {
    await withHarness({ fake: { grants: [
      grant("before-refresh-access", "refresh-token-1", "2099-01-01T00:00:00Z"),
      grant("after-refresh-access", "refresh-token-1", "2099-06-01T00:00:00Z"),
    ] } }, async (h) => {
      await h.connect("provider-1");
      const generationN = await h.generation("provider-1");
      // Thread A's Square calls report a scope set that only the OLD verification would ever write.
      h.fake.state.scopes = [...REQUIRED_TEST_SCOPES, "STALE_VERIFICATION_MARKER"];
      const gate = h.arm(VERIFY_WRITE);
      const verification = h.service.getSquarePaymentReadiness("provider-1", { force: true });
      await withTimeout(gate.reached, "verification reached its write");
      h.fake.state.scopes = [...REQUIRED_TEST_SCOPES];

      // Thread B: the token is now due, and an ordinary check refreshes it (advancing the generation).
      await h.pool.query(`UPDATE payment_methods SET token_expires_at = $1 WHERE user_id = 'provider-1'`, [soon()]);
      const refreshed = await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(refreshed.state, "active");
      assert.equal(await h.generation("provider-1"), generationN + 1, "a refresh advances the generation");
      const afterRefresh = await h.row("provider-1");

      gate.release();
      const readiness = await withTimeout(verification, "verification finished");

      assert.equal(readiness.state, "active");
      const after = await h.row("provider-1");
      assert.equal(Number(after.credential_generation), generationN + 1);
      assert.equal(h.accessOf(after), "after-refresh-access", "the refreshed credential survives");
      assert.equal(after.encrypted_access_token, afterRefresh.encrypted_access_token);
      assert.equal(new Date(after.token_expires_at).toISOString(), "2099-06-01T00:00:00.000Z");
      assert.equal(after.granted_scopes.includes("STALE_VERIFICATION_MARKER"), false, "the stale verification wrote nothing");
      assert.equal(after.account_status, "active");
      assert.ok(h.logs.some((entry) => entry.event === "square_connection_snapshot_changed" && entry.fields.attempted === "verification"));
    });
  });

  test("a stale verification success cannot resurrect a connection that a refresh failure took out of service", async () => {
    await withHarness({ fake: { grants: [grant("rf-access-1", "rf-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const gate = h.arm(VERIFY_WRITE);
      const verification = h.service.getSquarePaymentReadiness("provider-1", { force: true });
      await withTimeout(gate.reached, "verification reached its write");
      await h.pool.query(`UPDATE payment_methods SET token_expires_at = $1 WHERE user_id = 'provider-1'`, [soon()]);
      h.fake.state.failures.token = 401; // Square rejects the refresh token
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "needs_reauthorization");
      h.fake.state.failures.token = undefined;
      gate.release();
      const readiness = await withTimeout(verification, "verification finished");
      assert.equal(readiness.state, "needs_reauthorization");
      assert.equal(readiness.paymentReady, false);
      const after = await h.row("provider-1");
      assert.equal(after.account_status, "needs_reauthorization");
      assert.equal(after.encrypted_access_token, null);
      assert.equal(after.encrypted_refresh_token, null);
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
    });
  });

  test("concurrent refreshes stay single flight and advance the generation exactly once; the refreshed state is current-generation", async () => {
    await withHarness({ fake: { grants: [
      grant("sf-access-1", "sf-refresh-1", soon()),
      grant("sf-access-2", "sf-refresh-1", "2099-06-01T00:00:00Z"),
    ] } }, async (h) => {
      await h.connect("provider-1");
      const generationN = await h.generation("provider-1");
      h.fake.state.tokenDelayMs = 250;
      const results = await Promise.all(Array.from({ length: 6 }, () => h.service.getSquarePaymentReadiness("provider-1")));
      for (const result of results) assert.equal(result.state, "active");
      assert.equal(h.fake.calls("/oauth2/token"), 2, "one exchange, one refresh");
      assert.equal(await h.generation("provider-1"), generationN + 1, "advanced exactly once");
      assert.equal(h.accessOf(await h.row("provider-1")), "sf-access-2");
    });
  });

  test("a legitimate refresh still persists: new token, expiry and refresh time on the next generation, and the token is usable", async () => {
    await withHarness({ fake: { grants: [
      grant("lr-access-1", "lr-refresh-1", soon()),
      grant("lr-access-2", "lr-refresh-2", "2099-06-01T00:00:00Z"),
    ] } }, async (h) => {
      await h.connect("provider-1");
      const before = await h.row("provider-1");
      const credentials = await h.service.getReadyConnectedCredentials("provider-1");
      assert.equal(credentials?.accessToken, "lr-access-2");
      assert.equal(credentials?.credentialGeneration, String(Number(before.credential_generation) + 1));
      const after = await h.row("provider-1");
      assert.equal(new Date(after.token_expires_at).toISOString(), "2099-06-01T00:00:00.000Z");
      assert.ok(after.last_refreshed_at.getTime() >= before.last_refreshed_at.getTime());
      assert.equal(decryptSecret(after.encrypted_refresh_token, `payment_methods:${after.id}:square_refresh_token`), "lr-refresh-2");
    });
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Zero-row writes force an authoritative re-read; legitimate current-generation operations still work
   * ------------------------------------------------------------------------------------------------------- */

  test("a snapshot that keeps changing is retried a bounded number of times, then reported unverifiable with no credential", async () => {
    await withHarness({ fake: { grants: [grant("churn-access-1", "churn-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      // Every verification write is preceded by another operation advancing the generation and making the row due again.
      const churn = async () => { await h.pool.query(`UPDATE payment_methods SET credential_generation = credential_generation + 1, granted_scopes = NULL WHERE user_id = 'provider-1'`); };
      let writes = 0;
      const originalQuery = h.pool.query.bind(h.pool);
      // Re-arm the gate for each attempt so every verification write meets a changed generation.
      const arm = () => h.arm(VERIFY_WRITE, async () => { writes += 1; await churn(); });
      let gate = arm();
      const evaluation = h.service.getSquarePaymentReadiness("provider-1", { force: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await withTimeout(gate.reached, `attempt ${attempt} reached its write`);
        gate.release();
        if (attempt < 2) gate = arm();
        // wait for the next attempt to be ready to reach its gate
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const readiness = await withTimeout(evaluation, "evaluation finished");
      void originalQuery;
      assert.equal(writes, 3);
      assert.equal(readiness.state, "verification_unavailable");
      assert.equal(readiness.paymentReady, false);
      assert.equal(h.logs.filter((entry) => entry.event === "square_connection_snapshot_changed").length, 3);
    });
  });

  test("current-generation verification SUCCESS still writes, without advancing the generation", async () => {
    await withHarness({ fake: { grants: [grant("ok-access-token-1", "ok-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const before = await h.row("provider-1");
      h.fake.state.scopes = [...REQUIRED_TEST_SCOPES, "CURRENT_GEN_EXTRA"];
      h.fake.state.businessName = "Renamed Catering Co";
      const readiness = await h.service.getSquarePaymentReadiness("provider-1", { force: true });
      assert.equal(readiness.state, "active");
      assert.equal(readiness.merchantName, "Renamed Catering Co");
      const after = await h.row("provider-1");
      assert.equal(after.credential_generation, before.credential_generation, "facts-only writes do not advance the generation");
      assert.ok(after.granted_scopes.includes("CURRENT_GEN_EXTRA"));
      assert.ok(after.last_verified_at.getTime() >= before.last_verified_at.getTime());
      assert.equal(h.logs.some((entry) => entry.event === "square_connection_snapshot_changed"), false);
    });
  });

  test("current-generation verification FAILURE still takes the connection out of service, advancing the generation", async () => {
    await withHarness({ fake: { grants: [grant("bad-access-token-1", "bad-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const generationN = await h.generation("provider-1");
      h.fake.state.failures.merchant = 401;
      const readiness = await h.service.getSquarePaymentReadiness("provider-1", { force: true });
      assert.equal(readiness.state, "needs_reauthorization");
      const after = await h.row("provider-1");
      assert.equal(after.account_status, "needs_reauthorization");
      assert.equal(after.encrypted_access_token, null);
      assert.equal(after.encrypted_refresh_token, null);
      assert.equal(Number(after.credential_generation), generationN + 1);
      assert.equal(after.provider_id, "MERCHANT_1");
      assert.equal(after.location_id, "LOC_1");
      assert.deepEqual(h.logs.map((entry) => entry.event), ["square_connection_needs_reauthorization"]);
    });
  });

  test("merchant-mismatch and lost-scope verification failures are bound to the snapshot too", async () => {
    for (const scenario of ["merchant", "scopes"] as const) {
      await withHarness({ fake: { grants: [grant("mm-access-token-1", "mm-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
        await h.connect("provider-1");
        if (scenario === "merchant") h.fake.state.profileMerchantId = "SOMEONE_ELSE"; else h.fake.state.scopes = ["MERCHANT_PROFILE_READ"];
        const gate = h.arm(REAUTH_WRITE);
        const verification = h.service.getSquarePaymentReadiness("provider-1", { force: true });
        await withTimeout(gate.reached, `${scenario} failure reached its write`);
        // A reconnect lands first, then the stale failure resumes.
        Object.assign(h.fake.state, { profileMerchantId: undefined, scopes: [...REQUIRED_TEST_SCOPES] });
        h.fake.resetGrants();
        h.fake.state.grants = [grant("mm-access-token-2", "mm-refresh-token-2", "2099-01-01T00:00:00Z")];
        await h.connect("provider-1");
        gate.release();
        assert.equal((await withTimeout(verification, "verification finished")).state, "active", scenario);
        const after = await h.row("provider-1");
        assert.equal(after.account_status, "active", scenario);
        assert.equal(h.accessOf(after), "mm-access-token-2", scenario);
      });
    }
  });

  /* ------------------------------------------------------------------------------------------------------- *
   * Generation mechanics across every mutation path
   * ------------------------------------------------------------------------------------------------------- */

  test("every path that changes a row's credentials advances its generation; facts-only writes and no-ops do not", async () => {
    await withHarness({ applyMigrations: false, fake: { grants: [grant("mech-access-1", "mech-refresh-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      // Legacy plaintext first (before the hardening exists), then the migrations.
      await h.pool.query(`INSERT INTO users (id) VALUES ('legacy-user'), ('provider-1')`);
      await h.pool.query(
        `INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ('legacy-user', 'square', 'MERCHANT_1', 'active', $1::jsonb)`,
        [JSON.stringify({ merchantId: "MERCHANT_1", accessToken: "legacy-plain-access", refreshToken: "legacy-plain-refresh", tokenExpiresAt: "2099-01-01T00:00:00Z" })],
      );
      await h.migrate();
      assert.equal(await h.generation("legacy-user"), 1, "existing rows start at generation 1");
      const converted = await h.service.convertAllLegacyRows();
      assert.equal(converted.converted, 1);
      assert.equal(await h.generation("legacy-user"), 2, "legacy conversion installs credentials: advanced");
      assert.equal((await h.service.convertAllLegacyRows()).found, 0);
      assert.equal(await h.generation("legacy-user"), 2, "an idempotent re-run advances nothing");

      await h.connect("provider-1");
      assert.equal(await h.generation("provider-1"), 1, "a first connection is generation 1");
      await h.connect("provider-1");
      assert.equal(await h.generation("provider-1"), 2, "a reconnect advances it");
      await h.service.getSquarePaymentReadiness("provider-1", { force: true });
      assert.equal(await h.generation("provider-1"), 2, "verification facts do not");
      await h.pool.query(`UPDATE payment_methods SET token_expires_at = $1 WHERE user_id = 'provider-1'`, [soon()]);
      await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(await h.generation("provider-1"), 3, "a refresh advances it");
      await h.service.disconnect("provider-1");
      assert.equal(await h.generation("provider-1"), 4, "a disconnect advances it");
      await h.service.disconnect("provider-1");
      assert.equal(await h.generation("provider-1"), 4, "a repeated disconnect does not");
      h.fake.resetGrants();
      await h.connect("provider-1");
      assert.equal(await h.generation("provider-1"), 5, "reconnecting after a disconnect advances it");
    });
  });

  test("an authorization failure reported about OLD credentials is ignored; one about the current credentials applies", async () => {
    await withHarness({ fake: { grants: [grant("report-access-token-1", "report-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const first = await h.service.getReadyConnectedCredentials("provider-1");
      assert.ok(first);
      h.fake.resetGrants();
      await h.connect("provider-1"); // generation advances; `first` is now stale
      await h.service.reportAuthorizationFailure("provider-1", first!.credentialGeneration);
      assert.equal((await h.row("provider-1")).account_status, "active", "a stale report changed nothing");
      const current = await h.service.getReadyConnectedCredentials("provider-1");
      assert.ok(current && current.credentialGeneration !== first!.credentialGeneration);
      await h.service.reportAuthorizationFailure("provider-1", current!.credentialGeneration);
      const after = await h.row("provider-1");
      assert.equal(after.account_status, "needs_reauthorization");
      assert.equal(after.encrypted_access_token, null);
      assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
    });
  });

  test("the credential generation is a typed, non-secret column that the status view never exposes", async () => {
    await withHarness({ fake: { grants: [grant("view-access-token-1", "view-refresh-token-1", "2099-01-01T00:00:00Z")] } }, async (h) => {
      await h.connect("provider-1");
      const view = JSON.stringify(await h.service.status("provider-1"));
      assert.equal(/generation/i.test(view), false);
      const columns = await h.pool.query(`SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'credential_generation' AND table_schema = current_schema()`);
      assert.deepEqual(columns.rows[0], { data_type: "bigint", is_nullable: "NO", column_default: "1" });
      await assert.rejects(h.pool.query(`UPDATE payment_methods SET credential_generation = 0 WHERE user_id = 'provider-1'`), (error: { code?: string }) => error.code === "23514");
      // Re-applying the migration is a no-op.
      await h.pool.query(sqlOf("server/migrations/20261008_square_credential_generation.sql"));
      assert.equal(await h.generation("provider-1"), 1);
      void defaultFakeSquareState;
    });
  });
}
