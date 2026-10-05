/**
 * The token-migration dry run must be trustworthy: it classifies every row EXACTLY as the real run does (same code, in transactions that
 * are always rolled back), reports malformed rows, and writes nothing. Real PostgreSQL; set TEST_DATABASE_URL (loopback, name contains "test").
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const EXPIRY = "2099-01-01T00:00:00Z";
const SECRETS = ["dry-access-", "dry-refresh-", "sealed-access-token-s1", "sealed-refresh-token-s1"];

if (!URL_ENV) {
  test("Square token migration dry run (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, { fake: { grants: [{ access_token: "sealed-access-token-s1", refresh_token: "sealed-refresh-token-s1", expires_at: EXPIRY, merchant_id: "MERCHANT_1" }] } }, fn);
  const legacy = async (h: SquareHarness, userId: string, details: Record<string, unknown>, status = "active") => {
    await h.addUser(userId);
    await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details, is_default) VALUES ($1, 'square', 'MERCHANT_1', $2, $3::jsonb, true)`, [userId, status, JSON.stringify({ merchantId: "MERCHANT_1", ...details })]);
  };
  const pair = (n: string, expires: unknown = EXPIRY) => ({ accessToken: `dry-access-${n}`, refreshToken: `dry-refresh-${n}`, tokenExpiresAt: expires });
  /** Every column of every payment_methods row, as stored: the byte-for-byte state a dry run must leave alone. */
  const snapshot = async (h: SquareHarness) => JSON.stringify((await h.pool.query(`SELECT * FROM payment_methods ORDER BY user_id`)).rows);

  test("1/3/4/5/6. a valid pair would convert; missing access, missing refresh, bad or missing expiry, and an inactive row holding secrets are MALFORMED", async () => {
    await run(async (h) => {
      await legacy(h, "u-valid", pair("valid"));
      await legacy(h, "u-no-access", { refreshToken: "dry-refresh-x", tokenExpiresAt: EXPIRY });
      await legacy(h, "u-no-refresh", { accessToken: "dry-access-x", tokenExpiresAt: EXPIRY });
      await legacy(h, "u-bad-expiry", pair("bad", "not-a-date"));
      await legacy(h, "u-no-expiry", { accessToken: "dry-access-y", refreshToken: "dry-refresh-y" });
      await legacy(h, "u-inactive", pair("inactive"), "disabled");
      await legacy(h, "u-non-string", { accessToken: 12345, refreshToken: "dry-refresh-z", tokenExpiresAt: EXPIRY });
      const dry = await h.service.convertAllLegacyRows({ dryRun: true });
      const byUser = async (id: string) => String((await h.row(id)).id);
      assert.equal(dry.found, 7);
      assert.equal(dry.wouldConvert, 1);
      assert.equal(dry.alreadyConverted, 0);
      assert.deepEqual(dry.malformed.map((entry) => `${entry.id}:${entry.reason}`).sort(), [
        `${await byUser("u-bad-expiry")}:invalid_expiry`,
        `${await byUser("u-inactive")}:inactive_connection_with_secrets`,
        `${await byUser("u-no-access")}:missing_or_non_string_token`,
        `${await byUser("u-no-expiry")}:invalid_expiry`,
        `${await byUser("u-no-refresh")}:missing_or_non_string_token`,
        `${await byUser("u-non-string")}:missing_or_non_string_token`,
      ].sort());
      assert.equal(SECRETS.some((secret) => JSON.stringify(dry).includes(secret)), false, "the report names no token");
    });
  });

  test("2. an already-sealed valid pair is not a candidate and is left alone; a residue key holding only null is stripped", async () => {
    await run(async (h) => {
      await h.connect("sealed");
      await legacy(h, "u-null-residue", { accessToken: null });
      const before = await snapshot(h);
      const dry = await h.service.convertAllLegacyRows({ dryRun: true });
      assert.deepEqual(dry, { found: 1, wouldConvert: 1, alreadyConverted: 0, malformed: [] });
      assert.equal(await snapshot(h), before);
    });
  });

  test("7. an unreadable (wrong key) sealed credential beside plaintext is reported malformed, never converted", async () => {
    await run(async (h) => {
      await h.connect("sealed");
      await h.pool.query(`UPDATE payment_methods SET account_details = account_details || $1::jsonb WHERE user_id = 'sealed'`, [JSON.stringify(pair("new"))]);
      const before = await snapshot(h);
      const saved = process.env[SECRET_BOX_KEY_ENV];
      process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
      try {
        const dry = await h.service.convertAllLegacyRows({ dryRun: true });
        assert.deepEqual(dry.malformed.map((entry) => entry.reason), ["sealed_credential_unreadable"]);
        assert.equal(dry.wouldConvert, 0);
      } finally { process.env[SECRET_BOX_KEY_ENV] = saved; }
      assert.equal(await snapshot(h), before);
    });
  });

  test("8. mixed plaintext + sealed state is classified accurately: identical pair and different pair both would convert, a one-token residue is malformed", async () => {
    await run(async (h) => {
      await h.connect("same");
      await h.pool.query(`UPDATE payment_methods SET account_details = account_details || $1::jsonb WHERE user_id = 'same'`, [JSON.stringify({ accessToken: "sealed-access-token-s1", refreshToken: "sealed-refresh-token-s1", tokenExpiresAt: EXPIRY })]);
      await h.connect("other-user");
      await h.pool.query(`UPDATE payment_methods SET account_details = account_details || $1::jsonb WHERE user_id = 'other-user'`, [JSON.stringify(pair("fresh"))]);
      await h.connect("one-token");
      await h.pool.query(`UPDATE payment_methods SET account_details = account_details || '{"accessToken":"dry-access-q"}'::jsonb WHERE user_id = 'one-token'`);
      const dry = await h.service.convertAllLegacyRows({ dryRun: true });
      assert.equal(dry.found, 3);
      assert.equal(dry.wouldConvert, 2);
      assert.deepEqual(dry.malformed.map((entry) => entry.reason), ["missing_or_non_string_token"]);
    });
  });

  test("9. a dry run leaves EVERY column of every row unchanged -- tokens, plaintext, generation, status, verification facts, timestamps", async () => {
    await run(async (h) => {
      await legacy(h, "u-valid", pair("valid"));
      await legacy(h, "u-bad", pair("bad", "nope"));
      await h.connect("sealed");
      await h.pool.query(`UPDATE payment_methods SET account_details = account_details || $1::jsonb WHERE user_id = 'sealed'`, [JSON.stringify(pair("fresh"))]);
      const before = await snapshot(h);
      const generation = await h.generation("sealed");
      for (let i = 0; i < 2; i += 1) await h.service.convertAllLegacyRows({ dryRun: true });
      assert.equal(await snapshot(h), before, "byte-for-byte identical");
      assert.equal(await h.generation("sealed"), generation);
      assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM square_merchant_revocations`)).rows[0].n, 0);
    });
  });

  test("10. the real run after a dry run matches the dry-run classification exactly", async () => {
    await run(async (h) => {
      await legacy(h, "u-valid-1", pair("1"));
      await legacy(h, "u-valid-2", pair("2"));
      await legacy(h, "u-bad", { accessToken: "dry-access-b" });
      await legacy(h, "u-inactive", pair("i"), "pending");
      await h.connect("sealed");
      await h.pool.query(`UPDATE payment_methods SET account_details = account_details || $1::jsonb WHERE user_id = 'sealed'`, [JSON.stringify(pair("fresh"))]);
      const dry = await h.service.convertAllLegacyRows({ dryRun: true });
      const real = await h.service.convertAllLegacyRows();
      assert.equal(real.found, dry.found);
      assert.equal(real.converted, dry.wouldConvert);
      assert.equal(real.alreadyConverted, dry.alreadyConverted);
      assert.deepEqual(real.malformed, dry.malformed);
      assert.equal(real.malformed.length, 2);
      // A second dry run now has nothing further to convert, and the malformed rows are still reported (the migration is not clean).
      const after = await h.service.convertAllLegacyRows({ dryRun: true });
      assert.equal(after.wouldConvert, 0);
      assert.deepEqual(after.malformed, dry.malformed);
    });
  });
}

test("the CLI's dry run exits non-zero for malformed rows like the real run, never calls a malformed migration clean, and keeps the finalization guidance", () => {
  const script = fs.readFileSync(path.join(root, "server/scripts/migrate-square-oauth-tokens.ts"), "utf8").replace(/"\s*\+\s*\n\s*"/g, "");
  assert.match(script, /service\.convertAllLegacyRows\(\{ dryRun \}\)/);
  assert.match(script, /process\.exitCode = summary\.malformed\.length > 0 \? 2 : 0/);
  assert.match(script, /Dry run: malformed rows were found[^"]*NOT clean/);
  assert.match(script, /Dry run: no malformed rows/);
  assert.match(script, /finalize-square-plaintext-enforcement\.ts --confirm-old-servers-drained/);
  assert.equal(/VALIDATE CONSTRAINT/i.test(script), false);
});
