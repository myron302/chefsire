/**
 * A one-token (or expiry-less) SEALED row that the NOT VALID pair CHECK left in place, carrying account_details.tokenExpiresAt residue.
 * Any UPDATE of such a row -- even an incidental cleanup of account_details -- re-checks the pair CHECK and fails with SQLSTATE 23514, so
 * the whole credential row is classified BEFORE any update: it is reported (never written, never completed, never deleted), later healthy
 * rows keep converting, and a disconnect is never rolled back by it. Real PostgreSQL; set TEST_DATABASE_URL (loopback, name contains "test").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const EXPIRY = "2099-01-01T00:00:00Z";
const SENTINELS = ["res-access-", "res-refresh-", "legacy-ok-access", "legacy-ok-refresh"];

if (!URL_ENV) {
  test("Square partial expiry residue (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  const PAIR_CHECK = `(encrypted_access_token IS NULL AND encrypted_refresh_token IS NULL) OR (encrypted_access_token IS NOT NULL AND encrypted_refresh_token IS NOT NULL AND encrypted_access_token LIKE 'sqenc:v1:%' AND encrypted_refresh_token LIKE 'sqenc:v1:%' AND token_expires_at IS NOT NULL AND provider IS NOT NULL AND provider = 'square')`;
  async function historical(h: SquareHarness, userId: string, change: string, extra: Record<string, unknown> = {}) {
    await h.pool.query(`ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_square_credentials_check`);
    await h.pool.query(`UPDATE payment_methods SET ${change}, account_details = account_details || $2::jsonb WHERE user_id = $1`, [userId, JSON.stringify({ tokenExpiresAt: EXPIRY, ...extra })]);
    await h.pool.query(`ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_square_credentials_check CHECK (${PAIR_CHECK}) NOT VALID`);
  }
  const connect = async (h: SquareHarness, user: string, n: string) => { h.useMerchant(`M_${user}`, { access: `res-access-${n}`, refresh: `res-refresh-${n}` }); await h.connect(user); };
  const snapshot = async (h: SquareHarness) => JSON.stringify((await h.pool.query(`SELECT * FROM payment_methods ORDER BY user_id`)).rows);

  const partials: Array<[string, string]> = [
    ["access-only sealed row", "encrypted_refresh_token = NULL"],
    ["refresh-only sealed row", "encrypted_access_token = NULL"],
    ["both sealed tokens but NO sealed expiry", "token_expires_at = NULL"],
  ];
  for (const [name, change] of partials) {
    test(`${name} + tokenExpiresAt residue: classified malformed BEFORE any UPDATE (no 23514), unchanged; later healthy legacy rows still convert; dry run and real run agree`, async () => {
      await run(async (h) => {
        await connect(h, "partial", "p");
        await historical(h, "partial", change);
        await h.addUser("healthy");
        await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details, is_default) VALUES ('healthy', 'square', 'M_healthy', 'active', $1::jsonb, true)`,
          [JSON.stringify({ accessToken: "legacy-ok-access", refreshToken: "legacy-ok-refresh", tokenExpiresAt: EXPIRY })]);
        const partialBefore = JSON.stringify(await h.row("partial"));
        const partialId = String((await h.row("partial")).id);

        const dry = await h.service.convertAllLegacyRows({ dryRun: true });
        assert.deepEqual(dry, { found: 2, wouldConvert: 1, alreadyConverted: 0, malformed: [{ id: partialId, reason: "incomplete_sealed_credential" }] });
        assert.equal(JSON.stringify(await h.row("partial")), partialBefore, "dry run writes nothing");

        const real = await h.service.convertAllLegacyRows(); // must not throw (no 23514 escapes) and must not stop at the malformed row
        assert.deepEqual(real, { found: 2, converted: 1, alreadyConverted: 0, malformed: [{ id: partialId, reason: "incomplete_sealed_credential" }] });
        assert.equal(JSON.stringify(await h.row("partial")), partialBefore, "the partial row is neither written, completed nor deleted");
        const healthy = await h.row("healthy");
        assert.equal(h.accessOf(healthy), "legacy-ok-access", "the later healthy legacy row converted");
        assert.deepEqual(healthy.account_details, {});
        assert.equal(SENTINELS.some((token) => JSON.stringify({ dry, real, logs: h.logs }).includes(token)), false, "no token in reports or logs");
      });
    });
  }

  test("a partial sealed row that ALSO carries a complete plaintext pair is repaired by resealing it as the newer authorization (both tokens + expiry in one statement)", async () => {
    await run(async (h) => {
      await connect(h, "partial", "p");
      await historical(h, "partial", "encrypted_refresh_token = NULL", { accessToken: "res-access-new", refreshToken: "res-refresh-new" });
      assert.deepEqual(await h.service.convertAllLegacyRows(), { found: 1, converted: 1, alreadyConverted: 0, malformed: [] });
      const row = await h.row("partial");
      assert.equal(h.accessOf(row), "res-access-new");
      assert.equal(h.refreshOf(row), "res-refresh-new");
    });
  });

  test("harmless expiry-only residue on a row with NO sealed credential is still cleaned up", async () => {
    await run(async (h) => {
      await h.addUser("bare");
      await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ('bare', 'square', 'M_bare', 'pending', $1::jsonb)`, [JSON.stringify({ merchantId: "M_bare", tokenExpiresAt: EXPIRY })]);
      assert.deepEqual(await h.service.convertAllLegacyRows(), { found: 1, converted: 1, alreadyConverted: 0, malformed: [] });
      assert.deepEqual((await h.row("bare")).account_details, { merchantId: "M_bare" });
    });
  });

  test("disconnect meeting such a row completes locally (not rolled back by a 23514), reports unconfirmed, and revokes nothing at Square", async () => {
    for (const [, change] of partials) {
      await run(async (h) => {
        await connect(h, "partial", "p");
        await historical(h, "partial", change);
        const before = await h.generation("partial");
        const result = await h.service.disconnect("partial");
        assert.deepEqual(result, { changed: true, providerRevocation: "unconfirmed", providerRevoked: false });
        assert.equal(h.fake.calls("/oauth2/revoke"), 0);
        const row = await h.row("partial");
        assert.equal(row.account_status, "disconnected");
        assert.equal(row.encrypted_access_token, null);
        assert.equal(row.encrypted_refresh_token, null);
        assert.equal(row.token_expires_at, null);
        assert.deepEqual(row.account_details, { merchantId: "M_partial" });
        assert.equal(await h.generation("partial"), before + 1);
        assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM square_merchant_revocations`)).rows[0].n, 0);
        assert.equal(JSON.stringify(h.logs).includes("res-access-"), false);
      });
    }
  });
}
