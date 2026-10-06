/**
 * One-token ("partial") credential rows. The NOT VALID pair CHECK (20261011) deliberately leaves such a historical row in place on
 * upgrade, but the readiness/refresh path cannot use it. It must therefore (1) never count as a usable SHARED connection that suppresses a
 * merchant-wide revoke, and (2) be reported -- before any UPDATE is built -- by the key-rotation reseal instead of aborting it.
 * Real PostgreSQL; set TEST_DATABASE_URL (loopback, name contains "test").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV, sealedSecretNeedsRotation } from "./secret-box";
import { hasCompleteLegacyCredential, hasCompleteSealedCredential } from "./square-connection-service";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");
process.env[SECRET_BOX_KEY_ENV] = KEY_A;
process.env.SQUARE_ENV = "sandbox";
const PREVIOUS = "SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const EXPIRY = "2099-01-01T00:00:00Z";

test("the completeness predicates: sealed needs BOTH sealed tokens and an expiry; legacy needs both strings and a parseable expiry", () => {
  const sealed = "sqenc:v1:k:i:c:t";
  assert.equal(hasCompleteSealedCredential({ encrypted_access_token: sealed, encrypted_refresh_token: sealed, token_expires_at: new Date() }), true);
  assert.equal(hasCompleteSealedCredential({ encrypted_access_token: sealed, encrypted_refresh_token: null, token_expires_at: new Date() }), false);
  assert.equal(hasCompleteSealedCredential({ encrypted_access_token: null, encrypted_refresh_token: sealed, token_expires_at: new Date() }), false);
  assert.equal(hasCompleteSealedCredential({ encrypted_access_token: sealed, encrypted_refresh_token: sealed, token_expires_at: null }), false);
  assert.equal(hasCompleteSealedCredential({ encrypted_access_token: "plain", encrypted_refresh_token: sealed, token_expires_at: new Date() }), false);
  assert.equal(hasCompleteLegacyCredential({ accessToken: "a", refreshToken: "r", tokenExpiresAt: EXPIRY }), true);
  for (const bad of [{ accessToken: "a" }, { refreshToken: "r", tokenExpiresAt: EXPIRY }, { accessToken: "a", refreshToken: "r" }, { accessToken: "a", refreshToken: "r", tokenExpiresAt: "nope" }, { accessToken: " ", refreshToken: "r", tokenExpiresAt: EXPIRY }, { accessToken: "a", refreshToken: 5, tokenExpiresAt: EXPIRY }, {}]) {
    assert.equal(hasCompleteLegacyCredential(bad as Record<string, unknown>), false, JSON.stringify(Object.keys(bad)));
  }
  assert.equal(hasCompleteLegacyCredential(null), false);
});

if (!URL_ENV) {
  test("Square partial credential rows (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  const revokes = (h: SquareHarness) => h.fake.calls("/oauth2/revoke");
  const history = async (h: SquareHarness) => (await h.pool.query(`SELECT merchant_id, revocation_epoch FROM square_merchant_revocations`)).rows;
  const PAIR_CHECK = `(encrypted_access_token IS NULL AND encrypted_refresh_token IS NULL) OR (encrypted_access_token IS NOT NULL AND encrypted_refresh_token IS NOT NULL AND encrypted_access_token LIKE 'sqenc:v1:%' AND encrypted_refresh_token LIKE 'sqenc:v1:%' AND token_expires_at IS NOT NULL AND provider IS NOT NULL AND provider = 'square')`;

  /** The state an upgrade leaves behind: the pair CHECK present but NOT VALID, with a historical one-token row inside it. */
  async function makeHistorical(h: SquareHarness, userId: string, change: string) {
    await h.pool.query(`ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_square_credentials_check`);
    await h.pool.query(`UPDATE payment_methods SET ${change} WHERE user_id = $1`, [userId]);
    await h.pool.query(`ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_square_credentials_check CHECK (${PAIR_CHECK}) NOT VALID`);
  }
  async function twoOnMerchant(h: SquareHarness) {
    h.useMerchant("MERCHANT_1", { access: "partial-other-access", refresh: "partial-other-refresh" });
    await h.connect("other");
    h.useMerchant("MERCHANT_1", { access: "partial-main-access", refresh: "partial-main-refresh" });
    await h.connect("main");
  }

  const partialCases: Array<[string, string]> = [
    ["only encrypted_access_token", "encrypted_refresh_token = NULL"],
    ["only encrypted_refresh_token", "encrypted_access_token = NULL"],
    ["both tokens but NO expiry", "token_expires_at = NULL"],
  ];
  for (const [name, change] of partialCases) {
    test(`shared merchant: an active row with ${name} is NOT a usable shared connection -- the disconnect revokes at Square instead of claiming it was retained`, async () => {
      await run(async (h) => {
        await twoOnMerchant(h);
        await makeHistorical(h, "other", change);
        const before = JSON.stringify(await h.row("other"));
        assert.deepEqual(await h.service.disconnect("main"), { changed: true, providerRevocation: "revoked", providerRevoked: true });
        assert.equal(revokes(h), 1);
        assert.deepEqual((await history(h)).map((row) => row.merchant_id), ["MERCHANT_1"]);
        assert.equal(JSON.stringify(await h.row("other")), before, "the historical row is neither deleted nor altered");
        assert.equal((await h.row("other")).account_status, "active");
      });
    });
  }

  test("shared merchant control: a COMPLETE active sealed pair with an expiry still counts, so the disconnect retains and does not revoke", async () => {
    await run(async (h) => {
      await twoOnMerchant(h);
      assert.deepEqual(await h.service.disconnect("main"), { changed: true, providerRevocation: "retained_for_shared_connection", providerRevoked: false });
      assert.equal(revokes(h), 0);
      assert.deepEqual(await history(h), []);
    });
  });

  test("shared merchant, legacy plaintext: partial or malformed plaintext does NOT suppress the revoke; a complete legacy credential still does (staged rollout)", async () => {
    const legacy = async (h: SquareHarness, details: Record<string, unknown>) => {
      await h.addUser("legacy");
      await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details, is_default) VALUES ('legacy', 'square', 'MERCHANT_1', 'active', $1::jsonb, true)`, [JSON.stringify(details)]);
    };
    for (const [label, details, expected] of [
      ["accessToken only", { accessToken: "legacy-a" }, "revoked"],
      ["no expiry", { accessToken: "legacy-a", refreshToken: "legacy-r" }, "revoked"],
      ["unparseable expiry", { accessToken: "legacy-a", refreshToken: "legacy-r", tokenExpiresAt: "nope" }, "revoked"],
      ["complete", { accessToken: "legacy-a", refreshToken: "legacy-r", tokenExpiresAt: EXPIRY }, "retained_for_shared_connection"],
    ] as const) {
      await run(async (h) => {
        h.useMerchant("MERCHANT_1", { access: "partial-main-access", refresh: "partial-main-refresh" });
        await h.connect("main");
        await legacy(h, details);
        assert.equal((await h.service.disconnect("main")).providerRevocation, expected, label);
        assert.equal((await h.row("legacy")).account_status, "active", `${label}: the legacy row is never deleted`);
      });
    }
  });

  test("shared merchant, concurrency: two complete same-merchant accounts disconnecting at once still revoke exactly once", async () => {
    await run(async (h) => {
      await twoOnMerchant(h);
      const results = await Promise.all([h.service.disconnect("main"), h.service.disconnect("other")]);
      assert.deepEqual(results.map((result) => result.providerRevocation).sort(), ["retained_for_shared_connection", "revoked"]);
      assert.equal(revokes(h), 1);
      assert.deepEqual((await history(h)).map((row) => `${row.merchant_id}:${row.revocation_epoch}`), ["MERCHANT_1:1"]);
    });
  });

  /* ---------------- reseal ---------------- */
  async function withKeys<T>(current: string, previous: string | undefined, fn: () => Promise<T>): Promise<T> {
    const saved = { current: process.env[SECRET_BOX_KEY_ENV], previous: process.env[PREVIOUS] };
    process.env[SECRET_BOX_KEY_ENV] = current;
    if (previous === undefined) delete process.env[PREVIOUS]; else process.env[PREVIOUS] = previous;
    try { return await fn(); } finally {
      process.env[SECRET_BOX_KEY_ENV] = saved.current;
      if (saved.previous === undefined) delete process.env[PREVIOUS]; else process.env[PREVIOUS] = saved.previous;
    }
  }
  const TOKENS = ["rs-access-", "rs-refresh-"];

  test("reseal: previous-key partial rows are reported BEFORE any UPDATE (dry run and real run agree), never written, and later healthy rows still rotate", async () => {
    await run(async (h) => {
      // Created in this order: two partial previous-key rows FIRST, then healthy previous-key rows, then a healthy current-key row.
      for (const [user, access, refresh] of [["partial-access", "rs-access-p1", "rs-refresh-p1"], ["partial-refresh", "rs-access-p2", "rs-refresh-p2"], ["healthy-1", "rs-access-h1", "rs-refresh-h1"], ["healthy-2", "rs-access-h2", "rs-refresh-h2"]]) {
        h.useMerchant(`M_${user}`, { access, refresh });
        await h.connect(user);
      }
      await makeHistorical(h, "partial-access", "encrypted_refresh_token = NULL");
      await makeHistorical(h, "partial-refresh", "encrypted_access_token = NULL");
      const partials = async () => JSON.stringify([await h.row("partial-access"), await h.row("partial-refresh")]);
      const partialsBefore = await partials();
      const idOf = async (user: string) => String((await h.row(user)).id);
      const generation = await h.generation("healthy-1");

      await withKeys(KEY_B, KEY_A, async () => {
        const dry = await h.service.resealRotatedCredentials({ dryRun: true });
        const failedIds = [await idOf("partial-access"), await idOf("partial-refresh")].sort();
        assert.deepEqual(dry.failed.map((entry) => entry.id).sort(), failedIds);
        assert.deepEqual(dry.failed.map((entry) => entry.reason), ["incomplete_credential_pair", "incomplete_credential_pair"]);
        assert.equal(dry.resealed, 2, "dry run counts the two healthy previous-key rows");
        assert.equal(await partials(), partialsBefore, "dry run writes nothing");

        const real = await h.service.resealRotatedCredentials();
        assert.deepEqual(real, dry, "real run reports exactly what the dry run did");
        assert.equal(await partials(), partialsBefore, "partial rows are not written, completed, or deleted");
        assert.equal(TOKENS.some((token) => JSON.stringify(real).includes(token)), false, "no token in the report");

        for (const user of ["healthy-1", "healthy-2"]) {
          const row = await h.row(user);
          assert.equal(sealedSecretNeedsRotation(row.encrypted_access_token), false, `${user} access now under the current key`);
          assert.equal(sealedSecretNeedsRotation(row.encrypted_refresh_token), false, `${user} refresh now under the current key`);
          assert.equal(h.accessOf(row), `rs-access-${user === "healthy-1" ? "h1" : "h2"}`, "same credential, new key");
          assert.equal(h.refreshOf(row), `rs-refresh-${user === "healthy-1" ? "h1" : "h2"}`);
        }
        assert.equal(await h.generation("healthy-1"), generation, "resealing does not change the credential generation");

        // Idempotent: healthy rows are current now; the partial rows are reported again, still untouched.
        const again = await h.service.resealRotatedCredentials();
        assert.equal(again.resealed, 0);
        assert.equal(again.alreadyCurrent, 2);
        assert.deepEqual(again.failed.map((entry) => entry.reason), ["incomplete_credential_pair", "incomplete_credential_pair"]);
        assert.equal(await partials(), partialsBefore);
        assert.equal(JSON.stringify(h.logs).includes("rs-access-"), false, "no token in logs");
      });
    });
  });

  test("reseal: a current-key one-token row is not rewritten, and a healthy current-key row stays unchanged", async () => {
    await run(async (h) => {
      h.useMerchant("M_partial", { access: "rs-access-c1", refresh: "rs-refresh-c1" });
      await h.connect("partial-current");
      h.useMerchant("M_healthy", { access: "rs-access-c2", refresh: "rs-refresh-c2" });
      await h.connect("healthy-current");
      await makeHistorical(h, "partial-current", "encrypted_refresh_token = NULL");
      const before = JSON.stringify([await h.row("partial-current"), await h.row("healthy-current")]);
      const summary = await h.service.resealRotatedCredentials();
      assert.deepEqual(summary, { checked: 2, resealed: 0, alreadyCurrent: 2, failed: [] });
      assert.equal(JSON.stringify([await h.row("partial-current"), await h.row("healthy-current")]), before);
    });
  });
}
