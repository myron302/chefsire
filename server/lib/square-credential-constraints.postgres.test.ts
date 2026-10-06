/**
 * The sealed-credential pair CHECK (and its siblings) against a REAL PostgreSQL built from the repository's migrations.
 * A CHECK passes when its expression is TRUE *or NULL*, so the pair rule must not lean on three-valued logic: exactly two states
 * are valid -- neither token stored, or BOTH stored in the sealed format with an expiry on a square row.
 * Set TEST_DATABASE_URL to a loopback database whose name contains "test"; skipped otherwise.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createSquareHarness, withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");

const SEALED = "sqenc:v1:abcd1234:aXY:Y3Q:dGFn";
const check = (error: { code?: string }) => error.code === "23514";

if (!URL_ENV) {
  test("Square credential constraints (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  let n = 0;
  /** Insert one row with the given column values; returns the promise so callers can assert on acceptance or rejection. */
  async function insert(h: SquareHarness, columns: { provider?: string; status?: string; access?: string | null; refresh?: string | null; expires?: string | null; details?: unknown }) {
    const user = `user-${++n}`;
    await h.addUser(user);
    return h.pool.query(
      `INSERT INTO payment_methods (user_id, provider, provider_id, account_status, encrypted_access_token, encrypted_refresh_token, token_expires_at, account_details)
       VALUES ($1, $2, 'M', $3, $4, $5, $6, $7::jsonb)`,
      [user, columns.provider ?? "square", columns.status ?? "active", columns.access ?? null, columns.refresh ?? null, columns.expires ?? null, columns.details === undefined ? null : JSON.stringify(columns.details)],
    );
  }
  const EXPIRES = "2099-01-01T00:00:00Z";

  test("1. neither token stored is allowed, in every status and with or without an expiry", async () => {
    await run(async (h) => {
      for (const status of ["active", "pending", "needs_reauthorization", "disconnected", "disabled"]) await insert(h, { status });
      await insert(h, { status: "active", expires: EXPIRES });
      await insert(h, { provider: "paypal", status: "active" });
    });
  });

  test("2. BOTH tokens stored in the sealed format with an expiry on a square row is allowed", async () => {
    await run(async (h) => { await insert(h, { access: SEALED, refresh: SEALED, expires: EXPIRES }); });
  });

  test("3. an ACCESS token alone is rejected, even with an expiry on a square row (the NULL-semantics hole)", async () => {
    await run(async (h) => {
      await assert.rejects(insert(h, { access: SEALED, refresh: null, expires: EXPIRES }), check);
      await assert.rejects(insert(h, { access: SEALED, refresh: null, expires: null }), check);
    });
  });

  test("4. a REFRESH token alone is rejected, even with an expiry on a square row (the NULL-semantics hole)", async () => {
    await run(async (h) => {
      await assert.rejects(insert(h, { access: null, refresh: SEALED, expires: EXPIRES }), check);
      await assert.rejects(insert(h, { access: null, refresh: SEALED, expires: null }), check);
    });
  });

  test("5/6. a malformed access or refresh ciphertext is rejected, and so is plaintext in either column", async () => {
    await run(async (h) => {
      for (const bad of ["plain-token", "sqenc:v2:a:b:c:d", "sqenc:", "", "SQENC:v1:a:b:c:d", " sqenc:v1:a:b:c:d"]) {
        await assert.rejects(insert(h, { access: bad, refresh: SEALED, expires: EXPIRES }), check, `access ${JSON.stringify(bad)}`);
        await assert.rejects(insert(h, { access: SEALED, refresh: bad, expires: EXPIRES }), check, `refresh ${JSON.stringify(bad)}`);
      }
    });
  });

  test("7. an encrypted pair without an expiry is rejected", async () => {
    await run(async (h) => { await assert.rejects(insert(h, { access: SEALED, refresh: SEALED, expires: null }), check); });
  });

  test("8. an encrypted pair on a non-square provider is rejected", async () => {
    await run(async (h) => {
      await assert.rejects(insert(h, { provider: "stripe", access: SEALED, refresh: SEALED, expires: EXPIRES }), check);
      await assert.rejects(insert(h, { provider: "paypal", access: SEALED, refresh: SEALED, expires: EXPIRES }), check);
    });
  });

  test("the same pair rule holds for UPDATEs, including every way of leaving one token behind", async () => {
    await run(async (h) => {
      await insert(h, { access: SEALED, refresh: SEALED, expires: EXPIRES });
      const update = (set: string) => h.pool.query(`UPDATE payment_methods SET ${set}`);
      await assert.rejects(update(`encrypted_access_token = NULL`), check);
      await assert.rejects(update(`encrypted_refresh_token = NULL`), check);
      await assert.rejects(update(`token_expires_at = NULL`), check);
      await assert.rejects(update(`provider = 'stripe'`), check);
      await assert.rejects(update(`encrypted_access_token = 'plain'`), check);
      await update(`encrypted_access_token = NULL, encrypted_refresh_token = NULL`); // clearing BOTH is the other valid state
      await assert.rejects(update(`encrypted_refresh_token = '${SEALED}'`), check);
    });
  });

  test("9. dead states hold no secret: a revoked or disconnected row cannot keep a token, sealed or plaintext", async () => {
    await run(async (h) => {
      for (const status of ["needs_reauthorization", "disconnected"]) {
        await assert.rejects(insert(h, { status, access: SEALED, refresh: SEALED, expires: EXPIRES }), check, status);
        await assert.rejects(insert(h, { status, details: { accessToken: "x" } }), check, `${status} plaintext access`);
        await assert.rejects(insert(h, { status, details: { refreshToken: "y" } }), check, `${status} plaintext refresh`);
        await insert(h, { status, details: { merchantId: "M" } }); // identity is history, not a secret
      }
      await assert.rejects(insert(h, { status: "bogus" }), check);
    });
  });

  test("10. legacy plaintext rows remain deployable during the transition: the migrations do not reject what an old server writes", async () => {
    await run(async (h) => {
      const legacy = { accessToken: "old-server-access", refreshToken: "old-server-refresh", tokenExpiresAt: EXPIRES, merchantId: "M" };
      await insert(h, { status: "active", details: legacy });
      await h.pool.query(`UPDATE payment_methods SET account_details = $1::jsonb, updated_at = now()`, [JSON.stringify({ ...legacy, accessToken: "old-server-access-2" })]);
      const installed = await h.pool.query(`SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_no_plaintext_oauth_token_check' AND conrelid = 'payment_methods'::regclass`);
      assert.equal(installed.rows.length, 0, "no migration installs the plaintext-blocking constraint");
    });
  });

  test("no migration in the automatic sequence ADDs the plaintext-blocking constraint", () => {
    const dir = path.join(root, "server/migrations");
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".sql"))) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8").replace(/^--.*$/gm, "");
      assert.equal(/ADD CONSTRAINT payment_methods_no_plaintext_oauth_token_check/i.test(sql), false, file);
    }
  });

  test("the repair migration fixes a database that applied the EARLIER revision: weak pair check and early plaintext constraint", async () => {
    // A clean database first, to prove the repair is a harmless no-op there and validates.
    await run(async (h) => {
      const sql = fs.readFileSync(path.join(root, "server/migrations/20261011_square_credential_pair_repair.sql"), "utf8");
      await h.pool.query(sql);
      const row = (await h.pool.query(`SELECT convalidated FROM pg_constraint WHERE conname = 'payment_methods_square_credentials_check' AND conrelid = 'payment_methods'::regclass`)).rows[0];
      assert.equal(row.convalidated, true);
    });
    // A database in the earlier revision's state.
    const h = await createSquareHarness(URL_ENV);
    try {
      await h.pool.query(`ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_square_credentials_check`);
      await h.pool.query(`ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_square_credentials_check CHECK (
        (encrypted_access_token IS NULL AND encrypted_refresh_token IS NULL)
        OR (encrypted_access_token LIKE 'sqenc:v1:%' AND encrypted_refresh_token LIKE 'sqenc:v1:%' AND token_expires_at IS NOT NULL AND provider = 'square'))`);
      await h.pool.query(`ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_no_plaintext_oauth_token_check CHECK (account_details IS NULL OR NOT (account_details ?| ARRAY['accessToken', 'refreshToken'])) NOT VALID`);
      await h.addUser("partial-user");
      // The earlier revision accepted a one-token row (the hole) and rejected old-server plaintext writes (the rollout problem).
      await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, encrypted_refresh_token, token_expires_at) VALUES ('partial-user', 'square', 'M', 'active', $1, '${EXPIRES}')`, [SEALED]);
      await assert.rejects(h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_details) VALUES ('partial-user', 'square', 'M2', '{"accessToken":"x"}'::jsonb)`), check);

      await h.pool.query(fs.readFileSync(path.join(root, "server/migrations/20261011_square_credential_pair_repair.sql"), "utf8"));

      const constraints = (await h.pool.query(`SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'payment_methods'::regclass AND conname IN ('payment_methods_square_credentials_check', 'payment_methods_no_plaintext_oauth_token_check')`)).rows;
      assert.deepEqual(constraints.map((row) => row.conname), ["payment_methods_square_credentials_check"], "the early plaintext constraint is gone");
      assert.equal(constraints[0].convalidated, false, "the pre-existing partial row stays flagged: enforced for new writes, validated only once repaired");
      await h.addUser("old-server-user");
      await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_details) VALUES ('old-server-user', 'square', 'M3', '{"accessToken":"x","refreshToken":"y"}'::jsonb)`);
      await h.addUser("another-partial");
      await assert.rejects(h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, encrypted_access_token, token_expires_at) VALUES ('another-partial', 'square', 'M4', $1, '${EXPIRES}')`, [SEALED]), check, "a NEW one-token row is rejected after the repair");
    } finally {
      await h.cleanup();
    }
  });
}
