/**
 * Reconciling plaintext written by an OLD server over a row the new application already sealed. An expiry is not a credential
 * identity (a fresh OAuth authorization can have different tokens and the same or a nearly identical expiry), so the sealed pair is
 * opened server-side and compared with the plaintext by VALUE. Real PostgreSQL; set TEST_DATABASE_URL (loopback, name contains "test").
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
const SENTINELS = ["sealed-access-token-s1", "sealed-refresh-token-s1", "legacy-access-token-n1", "legacy-refresh-token-n1"];
const EXPIRY = "2099-01-01T00:00:00Z";

if (!URL_ENV) {
  test("Square legacy reconciliation (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  /** A connection the new application sealed (tokens S1), then plaintext written over it by an old server. */
  async function withSealedConnection(fn: (h: SquareHarness, sealedBefore: Record<string, unknown>) => Promise<void>) {
    await withSquareHarness(URL_ENV!, { fake: { grants: [{ access_token: "sealed-access-token-s1", refresh_token: "sealed-refresh-token-s1", expires_at: EXPIRY, merchant_id: "MERCHANT_1" }] } }, async (h) => {
      await h.connect("provider-1");
      await fn(h, await h.row("provider-1"));
    });
  }
  const oldServerWrites = (h: SquareHarness, details: Record<string, unknown>) =>
    h.pool.query(`UPDATE payment_methods SET account_details = COALESCE(account_details, '{}'::jsonb) || $1::jsonb WHERE user_id = 'provider-1'`, [JSON.stringify(details)]);
  const plain = (access: string, refresh: string, expires: string) => ({ accessToken: access, refreshToken: refresh, tokenExpiresAt: expires });
  const SAME = plain("sealed-access-token-s1", "sealed-refresh-token-s1", EXPIRY);

  test("1/2/6. the SAME pair is redundant residue, whatever its expiry: the plaintext is removed and the sealed credential is left alone", async () => {
    for (const expires of [EXPIRY, "2099-01-01T00:00:00.500Z", "2099-01-01T00:00:00.999Z", "2099-06-01T00:00:00Z", "2030-01-01T00:00:00Z"]) {
      await withSealedConnection(async (h, before) => {
        await oldServerWrites(h, plain("sealed-access-token-s1", "sealed-refresh-token-s1", expires));
        const summary = await h.service.convertAllLegacyRows();
        assert.deepEqual(summary, { found: 1, converted: 1, alreadyConverted: 0, malformed: [] }, expires);
        const after = await h.row("provider-1");
        assert.equal(after.encrypted_access_token, before.encrypted_access_token, `${expires}: sealed access token untouched`);
        assert.equal(after.encrypted_refresh_token, before.encrypted_refresh_token);
        assert.equal(after.credential_generation, before.credential_generation, "no new credential, no new generation");
        assert.equal(new Date(after.token_expires_at).toISOString(), "2099-01-01T00:00:00.000Z", "the sealed credential's own expiry stands");
        assert.deepEqual(after.account_details, { merchantId: "MERCHANT_1" });
        assert.equal(after.granted_scopes.length > 0, true, "verification facts kept: nothing about the connection changed");
      });
    }
  });

  test("3/4/5. a DIFFERENT pair is a distinct reconnect and is kept, even with an identical or <1s-different expiry: resealed, generation advanced", async () => {
    for (const expires of [EXPIRY, "2099-01-01T00:00:00.400Z", "2098-12-31T23:59:59.700Z"]) {
      await withSealedConnection(async (h, before) => {
        await oldServerWrites(h, plain("legacy-access-token-n1", "legacy-refresh-token-n1", expires));
        assert.equal((await h.service.convertAllLegacyRows()).converted, 1, expires);
        const after = await h.row("provider-1");
        assert.equal(h.accessOf(after), "legacy-access-token-n1", `${expires}: the fresh reconnect is authoritative`);
        assert.equal(h.refreshOf(after), "legacy-refresh-token-n1");
        assert.notEqual(after.encrypted_access_token, before.encrypted_access_token);
        assert.equal(Number(after.credential_generation), Number(before.credential_generation) + 1, "advanced atomically with the credential");
        assert.equal(new Date(after.token_expires_at).toISOString(), new Date(expires).toISOString());
        assert.deepEqual(after.account_details, { merchantId: "MERCHANT_1" });
        assert.equal(after.granted_scopes, null, "installed unverified");
        assert.equal(after.last_verified_at, null);
        // Resealed under the CURRENT key and bound to this row.
        assert.match(after.encrypted_access_token, /^sqenc:v1:/);
      });
    }
  });

  test("a pair that differs in only ONE token is still a different credential", async () => {
    for (const [access, refresh] of [["sealed-access-token-s1", "legacy-refresh-token-n1"], ["legacy-access-token-n1", "sealed-refresh-token-s1"]]) {
      await withSealedConnection(async (h, before) => {
        await oldServerWrites(h, plain(access, refresh, EXPIRY));
        assert.equal((await h.service.convertAllLegacyRows()).converted, 1);
        const after = await h.row("provider-1");
        assert.equal(h.accessOf(after), access);
        assert.equal(h.refreshOf(after), refresh);
        assert.equal(Number(after.credential_generation), Number(before.credential_generation) + 1);
      });
    }
  });

  test("lazy reconciliation (the owner is checked) applies the same rule as the bulk migration", async () => {
    await withSealedConnection(async (h, before) => {
      await oldServerWrites(h, plain("legacy-access-token-n1", "legacy-refresh-token-n1", EXPIRY)); // same expiry, different pair
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active");
      const after = await h.row("provider-1");
      assert.equal(h.accessOf(after), "legacy-access-token-n1");
      assert.ok(Number(after.credential_generation) > Number(before.credential_generation));
      assert.equal(after.location_id, "LOC_1", "re-verified with Square");
    });
    await withSealedConnection(async (h, before) => {
      await oldServerWrites(h, SAME);
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active");
      const after = await h.row("provider-1");
      assert.equal(after.encrypted_access_token, before.encrypted_access_token);
      assert.equal(after.account_details.accessToken, undefined);
    });
  });

  test("C. only ONE plaintext token is malformed: it fails closed, is reported by id, and nothing (sealed or plaintext) changes", async () => {
    for (const details of [{ accessToken: "legacy-access-token-n1", tokenExpiresAt: EXPIRY }, { refreshToken: "legacy-refresh-token-n1", tokenExpiresAt: EXPIRY }, { accessToken: "legacy-access-token-n1", refreshToken: "", tokenExpiresAt: EXPIRY }, { accessToken: 5, refreshToken: "legacy-refresh-token-n1" }]) {
      await withSealedConnection(async (h, before) => {
        await oldServerWrites(h, details);
        const summary = await h.service.convertAllLegacyRows();
        assert.equal(summary.converted, 0);
        assert.deepEqual(summary.malformed.map((entry) => entry.reason), ["missing_or_non_string_token"], JSON.stringify(details));
        assert.equal(JSON.stringify(summary).includes("legacy-"), false);
        const after = await h.row("provider-1");
        assert.equal(after.encrypted_access_token, before.encrypted_access_token, "the sealed credential is not replaced by a half-written one");
        assert.equal(after.credential_generation, before.credential_generation);
        assert.equal(JSON.stringify(after.account_details).includes("legacy-"), true, "the malformed plaintext is left for an operator, not silently dropped");
      });
    }
  });

  test("a plaintext pair with an unusable expiry that DIFFERS from the sealed pair is malformed, not installed", async () => {
    await withSealedConnection(async (h, before) => {
      await oldServerWrites(h, plain("legacy-access-token-n1", "legacy-refresh-token-n1", "not-a-date"));
      const summary = await h.service.convertAllLegacyRows();
      assert.deepEqual(summary.malformed.map((entry) => entry.reason), ["invalid_expiry"]);
      assert.equal((await h.row("provider-1")).encrypted_access_token, before.encrypted_access_token);
    });
  });

  test("D. a sealed pair that cannot be opened is a configuration fault: plaintext does NOT overwrite it, and nothing is demoted", async () => {
    await withSealedConnection(async (h, before) => {
      await oldServerWrites(h, plain("legacy-access-token-n1", "legacy-refresh-token-n1", EXPIRY));
      const saved = process.env[SECRET_BOX_KEY_ENV];
      process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64"); // the wrong key
      try {
        assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "configuration_error");
        const summary = await h.service.convertAllLegacyRows();
        assert.deepEqual(summary.malformed.map((entry) => entry.reason), ["sealed_credential_unreadable"]);
      } finally { process.env[SECRET_BOX_KEY_ENV] = saved; }
      const after = await h.row("provider-1");
      assert.equal(after.encrypted_access_token, before.encrypted_access_token);
      assert.equal(after.credential_generation, before.credential_generation);
      assert.equal(after.account_status, "active");
      assert.equal(after.account_details.accessToken, "legacy-access-token-n1", "the plaintext is untouched too");
    });
  });

  test("7. no token appears in logs, summaries or error messages during any of this", async () => {
    const captured: string[] = [];
    const originals = (["log", "warn", "error"] as const).map((method) => [method, console[method]] as const);
    for (const [method] of originals) console[method] = (...args: unknown[]) => { captured.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")); };
    try {
      await withSealedConnection(async (h) => {
        await oldServerWrites(h, plain("legacy-access-token-n1", "legacy-refresh-token-n1", EXPIRY));
        const summary = await h.service.convertAllLegacyRows();
        const saved = process.env[SECRET_BOX_KEY_ENV];
        process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
        let failure = "";
        try { await h.service.convertAllLegacyRows(); await h.service.getSquarePaymentReadiness("provider-1"); } catch (error) { failure = String(error); } finally { process.env[SECRET_BOX_KEY_ENV] = saved; }
        captured.push(JSON.stringify(summary), failure, JSON.stringify(h.logs));
      });
    } finally {
      for (const [method, original] of originals) console[method] = original;
    }
    const everything = captured.join("\n");
    for (const secret of SENTINELS) assert.equal(everything.includes(secret), false, "a token value was logged");
  });
}
