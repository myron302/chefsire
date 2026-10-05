/**
 * Merchant-scoped serialization. Everything that decides or changes which ChefSire accounts are connected to ONE Square merchant
 * -- OAuth persistence, disconnect, and the merchant-wide revoke decision -- takes the same transaction-scoped advisory lock, so
 * these races resolve to one coherent outcome. Real PostgreSQL, the real `square` SDK against a local fake Square, separate
 * pooled connections. Set TEST_DATABASE_URL to a loopback database whose name contains "test"; skipped otherwise.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, withTimeout, type SquareHarness } from "../test-support/square-connection-harness";
import { SquareAuthorizationSupersededError } from "./square-connection-service";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const until = async (condition: () => boolean, label: string) => {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > 10_000) throw new Error(`timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

if (!URL_ENV) {
  test("Square merchant lock (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  /** Two accounts connected to the same merchant. */
  async function sharedPair(h: SquareHarness, merchant = "MERCHANT_1") {
    h.useMerchant(merchant, { access: "shared-access-a", refresh: "shared-refresh-a" });
    await h.connect("account-a");
    h.useMerchant(merchant, { access: "shared-access-b", refresh: "shared-refresh-b" });
    await h.connect("account-b");
  }
  const revokeCalls = (h: SquareHarness) => h.fake.calls("/oauth2/revoke");
  const revocationHistory = async (h: SquareHarness) => (await h.pool.query(`SELECT merchant_id, revocation_epoch FROM square_merchant_revocations ORDER BY merchant_id`)).rows;

  test("disconnect vs OAuth reconnect for the same merchant: the reconnect that began before the revocation is refused, never left active on a revoked grant", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "race-access-a", refresh: "race-refresh-a" });
      await h.connect("account-a"); // the only active connection for MERCHANT_1

      // Account B starts authorizing the same merchant (the code exchange happens first)...
      await h.addUser("account-b");
      h.useMerchant("MERCHANT_1", { access: "race-access-b", refresh: "race-refresh-b" });
      const t0 = new Date("2030-01-01T00:00:00Z");
      h.setClock(t0);
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;

      // ...then A disconnects, as the last active connection, and revokes the merchant's grant (which kills B's new token too).
      h.setClock(new Date(t0.getTime() + 5_000));
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "revoked");
      assert.equal(revokeCalls(h), 1);

      // B now tries to store its authorization: it must be refused, not stored as active against a just-revoked grant.
      h.setClock(new Date(t0.getTime() + 6_000));
      await assert.rejects(h.persist("account-b", verification.verified), (error: unknown) => error instanceof SquareAuthorizationSupersededError);
      assert.equal(await h.row("account-b"), undefined, "nothing was stored");
      const active = (await h.rows()).filter((row) => row.account_status === "active");
      assert.deepEqual(active, [], "no active connection points at the revoked grant");
    });
  });

  test("an authorization that began AFTER the merchant-wide revocation is a fresh grant and is stored", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "fresh-access-a", refresh: "fresh-refresh-a" });
      const t0 = new Date("2030-01-01T00:00:00Z");
      h.setClock(t0);
      await h.connect("account-a");
      h.setClock(new Date(t0.getTime() + 1_000));
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "revoked");
      h.setClock(new Date(t0.getTime() + 2_000));
      h.useMerchant("MERCHANT_1", { access: "fresh-access-b", refresh: "fresh-refresh-b" });
      await h.connect("account-b");
      assert.equal((await h.row("account-b")).account_status, "active");
      assert.equal((await h.service.getSquarePaymentReadiness("account-b")).state, "active");
      // The disconnected account reconnecting later is fine too (same row, later authorization).
      h.setClock(new Date(t0.getTime() + 3_000));
      h.useMerchant("MERCHANT_1", { access: "fresh-access-a2", refresh: "fresh-refresh-a2" });
      await h.connect("account-a");
      assert.equal((await h.row("account-a")).account_status, "active");
    });
  });

  test("a disconnect holding a merchant-wide revocation in flight makes a concurrent reconnect WAIT, then refuses it", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "wait-access-a", refresh: "wait-refresh-a" });
      await h.connect("account-a");
      await h.addUser("account-b");
      h.useMerchant("MERCHANT_1", { access: "wait-access-b", refresh: "wait-refresh-b" });
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;

      h.fake.state.revokeDelayMs = 400;
      const disconnect = h.service.disconnect("account-a");
      await until(() => revokeCalls(h) >= 1, "revocation reached Square");
      const started = Date.now();
      const persist = h.persist("account-b", verification.verified).then(() => "stored", (error: unknown) => (error instanceof SquareAuthorizationSupersededError ? "superseded" : `error: ${String(error)}`));
      const [revocation, outcome] = await withTimeout(Promise.all([disconnect, persist]), "race resolved");
      assert.equal(revocation.providerRevocation, "revoked");
      assert.equal(outcome, "superseded");
      assert.ok(Date.now() - started >= 150, "the reconnect waited for the merchant lock instead of racing ahead");
      assert.deepEqual((await h.rows()).filter((row) => row.account_status === "active"), []);
    });
  });

  test("a reconnect that commits first is seen by the disconnect: the merchant grant is NOT revoked and the new connection survives", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "first-access-a", refresh: "first-refresh-a" });
      await h.connect("account-a");
      await h.addUser("account-b");
      h.useMerchant("MERCHANT_1", { access: "first-access-b", refresh: "first-refresh-b" });
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;

      // B's persistence is in flight (holds the merchant lock inside its open transaction) when A's disconnect starts.
      const tx = await h.pool.connect();
      await tx.query("BEGIN");
      await h.service.persistVerifiedConnection(tx as never, "account-b", verification.verified);
      const disconnect = h.service.disconnect("account-a");
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(revokeCalls(h), 0, "the disconnect is waiting; it has decided nothing yet");
      await tx.query("COMMIT");
      tx.release();

      const result = await withTimeout(disconnect, "disconnect finished");
      assert.equal(result.providerRevocation, "retained_for_shared_connection");
      assert.equal(revokeCalls(h), 0);
      assert.equal((await h.service.getSquarePaymentReadiness("account-b")).state, "active");
      assert.equal((await h.row("account-a")).account_status, "disconnected");
      assert.deepEqual(await revocationHistory(h), [], "no merchant-wide revocation was recorded");
    });
  });

  test("two shared active accounts disconnecting concurrently: exactly ONE merchant-wide revocation, no double skip, both rows disconnected", async () => {
    for (let round = 0; round < 4; round += 1) {
      await run(async (h) => {
        await sharedPair(h);
        h.fake.state.revokeDelayMs = 150;
        const results = await withTimeout(Promise.all([h.service.disconnect("account-a"), h.service.disconnect("account-b")]), `round ${round}`);
        assert.deepEqual(results.map((result) => result.providerRevocation).sort(), ["retained_for_shared_connection", "revoked"], `round ${round}`);
        assert.equal(revokeCalls(h), 1, "the grant was revoked exactly once, by whoever disconnected last");
        for (const row of await h.rows()) {
          assert.equal(row.account_status, "disconnected");
          assert.equal(row.encrypted_access_token, null);
          assert.equal(row.encrypted_refresh_token, null);
        }
        assert.deepEqual((await revocationHistory(h)).map((entry) => `${entry.merchant_id}:${entry.revocation_epoch}`), ["MERCHANT_1:1"], "exactly one revocation is on record");
        assert.deepEqual((await h.rows()).filter((row) => row.account_status === "active"), []);
      });
    }
  });

  test("disconnecting ONE of two shared accounts does not revoke the merchant, and the survivor stays valid", async () => {
    await run(async (h) => {
      await sharedPair(h);
      const result = await h.service.disconnect("account-a");
      assert.deepEqual(result, { changed: true, providerRevocation: "retained_for_shared_connection", providerRevoked: false });
      assert.equal(revokeCalls(h), 0);
      const survivor = await h.service.getReadyConnectedCredentials("account-b");
      assert.equal(survivor?.accessToken, "shared-access-b");
      assert.equal((await h.service.getSquarePaymentReadiness("account-b")).state, "active");
      // When the survivor leaves, it is the last connection and revokes.
      assert.equal((await h.service.disconnect("account-b")).providerRevocation, "revoked");
      assert.equal(revokeCalls(h), 1);
    });
  });

  test("reconnecting while another shared account remains active never revokes", async () => {
    await run(async (h) => {
      await sharedPair(h);
      h.useMerchant("MERCHANT_1", { access: "shared-access-a2", refresh: "shared-refresh-a2" });
      await h.connect("account-a");
      assert.equal(revokeCalls(h), 0);
      assert.equal((await h.service.getSquarePaymentReadiness("account-a")).state, "active");
      assert.equal((await h.service.getSquarePaymentReadiness("account-b")).state, "active");
      assert.deepEqual(await revocationHistory(h), [], "no merchant-wide revocation was recorded");
    });
  });

  test("an unconfirmed or retained outcome never stamps a merchant-wide revocation, so it can never block a reconnect", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "unc-access-a", refresh: "unc-refresh-a" });
      await h.connect("account-a");
      h.fake.state.failures.revoke = 503;
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "unconfirmed");
      assert.deepEqual(await revocationHistory(h), [], "no merchant-wide revocation was recorded");
      h.fake.state.failures.revoke = undefined;
      h.useMerchant("MERCHANT_1", { access: "unc-access-b", refresh: "unc-refresh-b" });
      await h.connect("account-b");
      assert.equal((await h.row("account-b")).account_status, "active");
    });
  });

  test("different merchants are independent: their disconnects run concurrently and neither waits for the other's revocation", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "ind-access-1", refresh: "ind-refresh-1" });
      await h.connect("account-a");
      h.useMerchant("MERCHANT_2", { access: "ind-access-2", refresh: "ind-refresh-2" });
      await h.connect("account-b");
      h.fake.state.revokeDelayMs = 500;
      const started = Date.now();
      const results = await withTimeout(Promise.all([h.service.disconnect("account-a"), h.service.disconnect("account-b")]), "independent disconnects");
      const elapsed = Date.now() - started;
      assert.deepEqual(results.map((result) => result.providerRevocation), ["revoked", "revoked"]);
      assert.equal(revokeCalls(h), 2, "each merchant's grant was revoked");
      assert.ok(elapsed < 900, `the two revocations overlapped (took ${elapsed}ms, not ~1000ms)`);
    });
  });

  test("moving an account from one merchant to another is serialized with both merchants and never deadlocks", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "mv-access-1", refresh: "mv-refresh-1" });
      await h.connect("account-a");
      await h.connect("account-c");
      h.useMerchant("MERCHANT_2", { access: "mv-access-2", refresh: "mv-refresh-2" });
      await h.connect("account-d");
      // account-a leaves MERCHANT_1 for MERCHANT_2 while account-c (MERCHANT_1) and account-d (MERCHANT_2) disconnect.
      await h.addUser("account-a");
      h.useMerchant("MERCHANT_2", { access: "mv-access-3", refresh: "mv-refresh-3" });
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;
      h.fake.state.revokeDelayMs = 100;
      const settled = await withTimeout(Promise.allSettled([
        h.persist("account-a", verification.verified),
        h.service.disconnect("account-c"),
        h.service.disconnect("account-d"),
      ]), "no deadlock");
      for (const outcome of settled) {
        if (outcome.status === "rejected") {
          assert.ok(outcome.reason instanceof SquareAuthorizationSupersededError, `unexpected failure: ${String(outcome.reason)}`);
          assert.notEqual((outcome.reason as { code?: string }).code, "40P01", "no deadlock");
        }
      }
      for (const row of await h.rows()) assert.ok(!(row.account_status === "disconnected" && (row.encrypted_access_token || row.encrypted_refresh_token)), "a disconnected row holds no secret");
    });
  });
}
