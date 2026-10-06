/**
 * Disconnect reports Square revocation as confirmed ONLY when Square explicitly says so. Anything else is `unconfirmed`, is not
 * recorded as a merchant-wide revocation, and is never presented as a revoked authorization. The local disconnect always completes.
 * Real PostgreSQL, the real `square` SDK against a local fake Square. Set TEST_DATABASE_URL (loopback, name contains "test").
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

if (!URL_ENV) {
  test("Square revoke confirmation (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, { fake: { grants: [{ access_token: "revoke-conf-access-1", refresh_token: "revoke-conf-refresh-1", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }] } }, fn);
  const history = async (h: SquareHarness) => (await h.pool.query(`SELECT merchant_id FROM square_merchant_revocations`)).rows;

  for (const [label, body] of [
    ["success: false", { success: false }],
    ["success missing", {}],
    ["response-level errors", { errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] }],
    ["success: true with errors", { success: true, errors: [{ category: "API_ERROR", code: "GENERIC_DECLINE" }] }],
  ] as const) {
    test(`a 2xx revoke answered with ${label} is UNCONFIRMED: no merchant revocation recorded, the user is not told it was revoked`, async () => {
      await run(async (h) => {
        await h.connect("account-a");
        h.fake.state.revokeResponseBody = body;
        const result = await h.service.disconnect("account-a");
        assert.deepEqual(result, { changed: true, providerRevocation: "unconfirmed", providerRevoked: false });
        assert.deepEqual(await history(h), [], "no revocation epoch for something Square did not confirm");
        const row = await h.row("account-a");
        assert.equal(row.account_status, "disconnected", "the local disconnect still completes");
        assert.equal(row.encrypted_access_token, null);
        assert.equal(row.encrypted_refresh_token, null);
        const logged = JSON.stringify(h.logs);
        assert.ok(h.logs.some((entry) => entry.event === "square_disconnect_revocation_unconfirmed"));
        assert.equal(logged.includes("revoke-conf-access-1"), false);
        assert.equal(logged.includes("app-secret-test"), false);
      });
    });
  }

  test("explicit success: true IS confirmed and recorded; a thrown API error and a network failure are not", async () => {
    await run(async (h) => {
      await h.connect("account-a");
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "revoked");
      assert.deepEqual((await history(h)).map((row) => row.merchant_id), ["MERCHANT_1"]);
    });
    await run(async (h) => {
      await h.connect("account-a");
      h.fake.state.failures.revoke = 503;
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "unconfirmed");
      assert.deepEqual(await history(h), []);
    });
    // Square unreachable for the revoke call itself.
    await run(async (h) => {
      await h.connect("account-a");
      await h.fake.close();
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "unconfirmed");
      assert.deepEqual(await history(h), []);
      assert.equal((await h.row("account-a")).account_status, "disconnected");
    });
  });

  test("an unconfirmed revocation never blocks a reconnect, and a later successful revocation is recorded", async () => {
    await run(async (h) => {
      await h.connect("account-a");
      h.fake.state.revokeResponseBody = { success: false };
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "unconfirmed");
      h.fake.state.revokeResponseBody = undefined;
      h.useMerchant("MERCHANT_1", { access: "revoke-conf-access-2", refresh: "revoke-conf-refresh-2" });
      await h.connect("account-a");
      assert.equal((await h.service.getSquarePaymentReadiness("account-a")).state, "active");
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "revoked");
      assert.deepEqual((await history(h)).length, 1);
    });
  });
}
