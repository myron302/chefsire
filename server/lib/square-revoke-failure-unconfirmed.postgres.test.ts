/**
 * A revoke is CONFIRMED only by Square's explicit `success: true`. A rejected, expired or unauthorized ACCESS token proves nothing about
 * the grant (an expired access token can coexist with a live refresh token), so it must never become "revoked" nor advance the merchant
 * revocation history, which would wrongly invalidate newer authorizations. Real PostgreSQL; set TEST_DATABASE_URL (loopback, name contains "test").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { squareDisconnectNotice } from "../../client/src/lib/square-connection";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const ACCESS = "revoke-fail-access-1";

if (!URL_ENV) {
  test("Square revoke failures are unconfirmed (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, { fake: { grants: [{ access_token: ACCESS, refresh_token: "revoke-fail-refresh-1", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }] } }, fn);
  const history = async (h: SquareHarness) => (await h.pool.query(`SELECT merchant_id, revocation_epoch, revoked_at FROM square_merchant_revocations ORDER BY merchant_id`)).rows;
  const authError = (code: string) => ({ errors: [{ category: "AUTHENTICATION_ERROR", code, detail: "rejected" }] });

  type Scenario = { name: string; arrange: (h: SquareHarness) => Promise<void> | void };
  const failing: Scenario[] = [
    { name: "ACCESS_TOKEN_EXPIRED", arrange: (h) => { h.fake.state.failures.revoke = 401; h.fake.state.revokeFailureBody = authError("ACCESS_TOKEN_EXPIRED"); } },
    { name: "ACCESS_TOKEN_REVOKED", arrange: (h) => { h.fake.state.failures.revoke = 401; h.fake.state.revokeFailureBody = authError("ACCESS_TOKEN_REVOKED"); } },
    { name: "UNAUTHORIZED", arrange: (h) => { h.fake.state.failures.revoke = 401; h.fake.state.revokeFailureBody = authError("UNAUTHORIZED"); } },
    { name: "a bare 401 with no recognizable body", arrange: (h) => { h.fake.state.failures.revoke = 401; h.fake.state.revokeFailureBody = {}; } },
    { name: "generic invalid credential (403)", arrange: (h) => { h.fake.state.failures.revoke = 403; h.fake.state.revokeFailureBody = authError("FORBIDDEN"); } },
    { name: "success: false", arrange: (h) => { h.fake.state.revokeResponseBody = { success: false }; } },
    { name: "missing success field", arrange: (h) => { h.fake.state.revokeResponseBody = {}; } },
    { name: "response-level Square errors", arrange: (h) => { h.fake.state.revokeResponseBody = { errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] }; } },
    { name: "success: true alongside response-level errors", arrange: (h) => { h.fake.state.revokeResponseBody = { success: true, errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] }; } },
    { name: "a 5xx", arrange: (h) => { h.fake.state.failures.revoke = 503; } },
    { name: "a network failure", arrange: async (h) => { await h.fake.close(); } },
  ];

  for (const scenario of failing) {
    test(`${scenario.name}: UNCONFIRMED, local disconnect completes, no revocation history is written or advanced, and the owner is not told Square revoked`, async () => {
      await run(async (h) => {
        await h.connect("account-a");
        // A pre-existing history row for the same merchant must be left exactly as it was.
        await h.pool.query(`INSERT INTO square_merchant_revocations (merchant_id, revoked_at, revocation_epoch) VALUES ('MERCHANT_1', '2020-01-01T00:00:00Z', 4)`);
        const before = await history(h);
        await scenario.arrange(h);

        const result = await h.service.disconnect("account-a");
        assert.deepEqual(result, { changed: true, providerRevocation: "unconfirmed", providerRevoked: false });

        assert.deepEqual(await history(h), before, "history unchanged: no false epoch");
        const row = await h.row("account-a");
        assert.equal(row.account_status, "disconnected", "the local disconnect still completes");
        assert.equal(row.encrypted_access_token, null);
        assert.equal(row.encrypted_refresh_token, null);
        assert.deepEqual(row.account_details, { merchantId: "MERCHANT_1" });

        const notice = squareDisconnectNotice(result);
        assert.equal(notice?.tone, "attention");
        assert.match(notice!.text, /Disconnected from ChefSire/);
        assert.match(notice!.text, /couldn't confirm that Square has revoked/);
        assert.doesNotMatch(notice!.text, /has been revoked|were revoked|is revoked/i);
        assert.equal(JSON.stringify(h.logs).includes(ACCESS), false, "no token in logs");
      });
    });
  }

  test("a failed revoke on a merchant with no history creates none; a LATER explicit success records exactly one epoch", async () => {
    await run(async (h) => {
      await h.connect("account-a");
      h.fake.state.failures.revoke = 401;
      h.fake.state.revokeFailureBody = authError("ACCESS_TOKEN_EXPIRED");
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "unconfirmed");
      assert.deepEqual(await history(h), []);

      h.fake.state.failures.revoke = undefined;
      h.useMerchant("MERCHANT_1", { access: "revoke-fail-access-2", refresh: "revoke-fail-refresh-2" });
      await h.connect("account-a");
      assert.equal((await h.service.getSquarePaymentReadiness("account-a")).state, "active", "a failed revoke never blocks a legitimate reconnect");
      assert.deepEqual(await h.service.disconnect("account-a"), { changed: true, providerRevocation: "revoked", providerRevoked: true });
      assert.deepEqual((await history(h)).map((row) => `${row.merchant_id}:${row.revocation_epoch}`), ["MERCHANT_1:1"]);
    });
  });

  test("explicit success: true is the only confirmation: revoked, one epoch recorded, and the owner is told it was revoked", async () => {
    await run(async (h) => {
      await h.connect("account-a");
      const result = await h.service.disconnect("account-a");
      assert.deepEqual(result, { changed: true, providerRevocation: "revoked", providerRevoked: true });
      assert.deepEqual((await history(h)).map((row) => `${row.merchant_id}:${row.revocation_epoch}`), ["MERCHANT_1:1"]);
      assert.equal(squareDisconnectNotice(result)?.tone, "good");
      assert.equal(h.fake.calls("/oauth2/revoke"), 1);
    });
  });
}
