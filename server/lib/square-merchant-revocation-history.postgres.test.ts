/**
 * Merchant-level revocation history. Square revokes every token the application holds for a merchant, so a revocation is
 * recorded under the MERCHANT'S identity (table square_merchant_revocations), not on a connection row whose merchant can later
 * change. Real PostgreSQL, the real `square` SDK against a local fake Square that really invalidates a merchant's tokens on
 * revoke. Set TEST_DATABASE_URL to a loopback database whose name contains "test"; skipped otherwise.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, withTimeout, type SquareHarness } from "../test-support/square-connection-harness";
import { SquareAuthorizationSupersededError, SquareAuthorizationUnconfirmedError } from "./square-connection-service";
import { SECRET_BOX_KEY_ENV } from "./secret-box";
import { FAKE_TOKEN_ERRORS } from "../test-support/fake-square";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();

if (!URL_ENV) {
  test("Square merchant revocation history (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  const history = async (h: SquareHarness) => (await h.pool.query(`SELECT merchant_id, revocation_epoch, revoked_at FROM square_merchant_revocations ORDER BY merchant_id`)).rows;
  const T = (seconds: number) => new Date(Date.UTC(2030, 0, 1, 0, 0, seconds));
  const refused = (error: unknown) => error instanceof SquareAuthorizationSupersededError;

  /** account-1 is connected to MA; account-2 has verified (but not yet stored) an authorization for MA. Returns it. */
  async function inFlightAuthorization(h: SquareHarness) {
    h.useMerchant("MA", { access: "ma-access-1", refresh: "ma-refresh-1" });
    await h.connect("account-1");
    await h.addUser("account-2");
    h.useMerchant("MA", { access: "ma-access-2-inflight", refresh: "ma-refresh-2-inflight" });
    const verification = await h.service.verifyAuthorizationCode("auth-code");
    assert.equal(verification.ok, true);
    if (!verification.ok) throw new Error("unreachable");
    return verification.verified;
  }

  test("merchant A is revoked while another A authorization is in flight, then the revoking row reconnects to merchant B: the in-flight A authorization is NOT stored", async () => {
    await run(async (h) => {
      h.setClock(T(0));
      const inFlight = await inFlightAuthorization(h);

      h.setClock(T(10));
      assert.equal((await h.service.disconnect("account-1")).providerRevocation, "revoked"); // the last active A connection

      // The row that carried A's history now moves to merchant B.
      h.setClock(T(20));
      h.useMerchant("MB", { access: "mb-access-1", refresh: "mb-refresh-1" });
      await h.connect("account-1");
      assert.equal((await h.row("account-1")).provider_id, "MB");

      // The in-flight A authorization predates A's revocation and must not become an active, verified connection.
      h.setClock(T(30));
      await assert.rejects(h.persist("account-2", inFlight), refused);
      assert.equal(await h.row("account-2"), undefined, "nothing was stored for the stale authorization");
      assert.deepEqual((await h.rows()).filter((row) => row.account_status === "active").map((row) => row.provider_id), ["MB"]);
    });
  });

  test("each defence refuses the stale authorization on its own", async () => {
    // (1) The revocation epoch: the token still LOOKS live (fake does not invalidate it) and the clocks do not help.
    await run(async (h) => {
      h.fake.state.revokeInvalidatesTokens = false;
      h.setClock(T(100));
      const inFlight = await inFlightAuthorization(h);
      h.setClock(T(50)); // a revocation timestamp EARLIER than the authorization's start defeats the timestamp check
      assert.equal((await h.service.disconnect("account-1")).providerRevocation, "revoked");
      await assert.rejects(h.persist("account-2", inFlight), refused);
      assert.equal(h.fake.calls("/oauth2/token/status") >= 1, true);
    });
    // (2) The timestamp: epoch read AFTER the revocation matches, the token looks live, but the revocation committed after the
    //     authorization began.
    await run(async (h) => {
      h.fake.state.revokeInvalidatesTokens = false;
      h.setClock(T(0));
      h.useMerchant("MA", { access: "ts-access-1", refresh: "ts-refresh-1" });
      await h.connect("account-1");
      await h.addUser("account-2");
      h.useMerchant("MA", { access: "ts-access-2", refresh: "ts-refresh-2" });
      // Hold the second authorization AFTER its code exchange but before it reads the epoch, and revoke in that gap.
      const gate = h.arm(/FROM square_merchant_revocations WHERE merchant_id/);
      const verification = h.service.verifyAuthorizationCode("auth-code");
      await withTimeout(gate.reached, "authorization reached its epoch read");
      h.setClock(T(10));
      assert.equal((await h.service.disconnect("account-1")).providerRevocation, "revoked");
      gate.release();
      const result = await withTimeout(verification, "authorization verified");
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.verified.revocationEpoch, "1", "the epoch was read after the revocation, so the epoch check alone cannot see it");
      await assert.rejects(h.persist("account-2", result.verified), refused);
    });
    // (3) Square's own liveness answer: epoch read after the revocation matches, the timestamps do not catch it, but the token is dead.
    await run(async (h) => {
      h.setClock(T(100));
      h.useMerchant("MA", { access: "live-access-1", refresh: "live-refresh-1" });
      await h.connect("account-1");
      await h.addUser("account-2");
      h.useMerchant("MA", { access: "live-access-2", refresh: "live-refresh-2" });
      const gate = h.arm(/FROM square_merchant_revocations WHERE merchant_id/);
      const verification = h.service.verifyAuthorizationCode("auth-code");
      await withTimeout(gate.reached, "authorization reached its epoch read");
      h.setClock(T(50)); // earlier than the authorization's start (T100): the timestamp check cannot refuse
      assert.equal((await h.service.disconnect("account-1")).providerRevocation, "revoked");
      gate.release();
      const result = await withTimeout(verification, "authorization verified");
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.verified.revocationEpoch, "1");
      await assert.rejects(h.persist("account-2", result.verified), refused);
      assert.equal(await h.row("account-2"), undefined);
    });
  });

  test("merchant A's revocation record survives its row moving to merchant B, further disconnects, row deletion and account changes", async () => {
    await run(async (h) => {
      h.setClock(T(0));
      h.useMerchant("MA", { access: "surv-access-a", refresh: "surv-refresh-a" });
      await h.connect("account-1");
      h.setClock(T(10));
      await h.service.disconnect("account-1");
      const afterRevoke = await history(h);
      assert.deepEqual(afterRevoke.map((entry) => `${entry.merchant_id}:${entry.revocation_epoch}`), ["MA:1"]);

      h.setClock(T(20));
      h.useMerchant("MB", { access: "surv-access-b", refresh: "surv-refresh-b" });
      await h.connect("account-1"); // the SAME row now identifies merchant B
      assert.equal((await h.row("account-1")).provider_id, "MB");
      assert.deepEqual((await history(h)).map((entry) => `${entry.merchant_id}:${entry.revocation_epoch}`), ["MA:1"], "A's history did not move or vanish");

      h.setClock(T(30));
      assert.equal((await h.service.disconnect("account-1")).providerRevocation, "revoked");
      assert.deepEqual((await history(h)).map((entry) => `${entry.merchant_id}:${entry.revocation_epoch}`), ["MA:1", "MB:1"], "B has its own record; A's is untouched");
      assert.equal((await history(h))[0].revoked_at.getTime(), afterRevoke[0].revoked_at.getTime());

      // The row and even the user can go; the merchant's history stays.
      await h.pool.query(`DELETE FROM payment_methods`);
      await h.pool.query(`DELETE FROM users`);
      assert.deepEqual((await history(h)).map((entry) => entry.merchant_id), ["MA", "MB"]);

      // A repeated revocation of A advances ITS epoch only.
      h.setClock(T(40));
      h.useMerchant("MA", { access: "surv-access-a2", refresh: "surv-refresh-a2" });
      await h.connect("account-3");
      h.setClock(T(50));
      await h.service.disconnect("account-3");
      assert.deepEqual((await history(h)).map((entry) => `${entry.merchant_id}:${entry.revocation_epoch}`), ["MA:2", "MB:1"]);
    });
  });

  test("the history table is append-only in effect: no delete, no rewind", async () => {
    await run(async (h) => {
      h.setClock(T(0));
      h.useMerchant("MA", { access: "imm-access-1", refresh: "imm-refresh-1" });
      await h.connect("account-1");
      h.setClock(T(10));
      await h.service.disconnect("account-1");
      await assert.rejects(h.pool.query(`DELETE FROM square_merchant_revocations WHERE merchant_id = 'MA'`), /never deleted/);
      await assert.rejects(h.pool.query(`UPDATE square_merchant_revocations SET revocation_epoch = 1 WHERE merchant_id = 'MA'`), /only moves forward/);
      await assert.rejects(h.pool.query(`UPDATE square_merchant_revocations SET revoked_at = revoked_at - interval '1 day', revocation_epoch = 5 WHERE merchant_id = 'MA'`), /only moves forward/);
      await assert.rejects(h.pool.query(`UPDATE square_merchant_revocations SET merchant_id = 'MZ', revocation_epoch = 9 WHERE merchant_id = 'MA'`), /only moves forward/);
      await h.pool.query(`UPDATE square_merchant_revocations SET revocation_epoch = revocation_epoch + 1 WHERE merchant_id = 'MA'`); // forward is allowed
      await assert.rejects(h.pool.query(`INSERT INTO square_merchant_revocations (merchant_id, revoked_at, revocation_epoch) VALUES ('MX', now(), 0)`), (error: { code?: string }) => error.code === "23514");
      await assert.rejects(h.pool.query(`INSERT INTO square_merchant_revocations (merchant_id, revoked_at) VALUES ('  ', now())`), (error: { code?: string }) => error.code === "23514");
    });
  });

  test("a NEW legitimate authorization for merchant A after the revocation is stored: Square says its token is live and its epoch is current", async () => {
    await run(async (h) => {
      h.setClock(T(0));
      h.useMerchant("MA", { access: "new-access-1", refresh: "new-refresh-1" });
      await h.connect("account-1");
      h.setClock(T(10));
      await h.service.disconnect("account-1");
      assert.deepEqual((await history(h)).map((entry) => entry.revocation_epoch), ["1"]);

      // A different account authorizes A afresh, after the revocation: a newer grant.
      h.setClock(T(20));
      await h.addUser("account-2");
      h.useMerchant("MA", { access: "new-access-2", refresh: "new-refresh-2" });
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;
      assert.equal(verification.verified.revocationEpoch, "1", "it observed the current epoch");
      await h.persist("account-2", verification.verified);
      assert.equal((await h.service.getSquarePaymentReadiness("account-2")).state, "active");
      assert.equal((await h.service.getReadyConnectedCredentials("account-2"))?.accessToken, "new-access-2");

      // The previous owner reconnecting later is also fine.
      h.setClock(T(30));
      h.useMerchant("MA", { access: "new-access-3", refresh: "new-refresh-3" });
      await h.connect("account-1");
      assert.equal((await h.row("account-1")).account_status, "active");
    });
  });

  test("merchant B is unaffected by merchant A's revocation history, including B authorizations already in flight", async () => {
    await run(async (h) => {
      h.setClock(T(0));
      h.useMerchant("MA", { access: "ind-access-a", refresh: "ind-refresh-a" });
      await h.connect("account-a");
      h.useMerchant("MB", { access: "ind-access-b", refresh: "ind-refresh-b" });
      await h.connect("account-b");
      await h.addUser("account-c");
      h.useMerchant("MB", { access: "ind-access-c-inflight", refresh: "ind-refresh-c-inflight" });
      const inFlightB = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(inFlightB.ok, true);
      if (!inFlightB.ok) return;

      h.setClock(T(10));
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "revoked");
      assert.deepEqual((await history(h)).map((entry) => entry.merchant_id), ["MA"]);

      h.setClock(T(20));
      assert.equal((await h.service.getSquarePaymentReadiness("account-b")).state, "active", "B's connection still works");
      await h.persist("account-c", inFlightB.verified); // B's in-flight authorization is stored normally
      assert.equal((await h.service.getSquarePaymentReadiness("account-c")).state, "active");
      assert.equal(inFlightB.verified.revocationEpoch, "0");
    });
  });

  test("if Square cannot confirm the authorization is live, it is NOT stored (and nothing is demoted)", async () => {
    await run(async (h) => {
      h.useMerchant("MA", { access: "unc-access-1", refresh: "unc-refresh-1" });
      await h.addUser("account-1");
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;
      h.fake.state.failures.tokenStatus = 503;
      await assert.rejects(h.persist("account-1", verification.verified), (error: unknown) => error instanceof SquareAuthorizationUnconfirmedError);
      // ChefSire's own application credentials being rejected during the check is also "unconfirmed", never a provider failure.
      h.fake.state.failures.tokenStatus = 401;
      await assert.rejects(h.persist("account-1", verification.verified), (error: unknown) => error instanceof SquareAuthorizationUnconfirmedError || refused(error));
      assert.equal(await h.row("account-1"), undefined);
      h.fake.state.failures.tokenStatus = undefined;
      await h.persist("account-1", verification.verified);
      assert.equal((await h.row("account-1")).account_status, "active");
      void FAKE_TOKEN_ERRORS;
    });
  });

  test("shared-merchant serialization from the previous repair still holds with the merchant-level record", async () => {
    await run(async (h) => {
      h.useMerchant("MA", { access: "dual-access-a", refresh: "dual-refresh-a" });
      await h.connect("account-a");
      h.useMerchant("MA", { access: "dual-access-b", refresh: "dual-refresh-b" });
      await h.connect("account-b");
      h.fake.state.revokeDelayMs = 150;
      const results = await withTimeout(Promise.all([h.service.disconnect("account-a"), h.service.disconnect("account-b")]), "dual disconnect");
      assert.deepEqual(results.map((result) => result.providerRevocation).sort(), ["retained_for_shared_connection", "revoked"]);
      assert.equal(h.fake.calls("/oauth2/revoke"), 1);
      assert.deepEqual((await history(h)).map((entry) => `${entry.merchant_id}:${entry.revocation_epoch}`), ["MA:1"]);
    });
  });
}
