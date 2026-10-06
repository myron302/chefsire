/**
 * During a rolling deploy an active connection can still hold its ONLY credential as plaintext in account_details.accessToken.
 * Merchant-wide revocation must count such a connection as a live sharer of the Square merchant (Square revokes every token for
 * the merchant), under the same merchant-scoped lock. Real PostgreSQL, the real `square` SDK against a local fake Square that
 * really invalidates a merchant's tokens on revoke. Set TEST_DATABASE_URL to a loopback database whose name contains "test".
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, withTimeout, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();

if (!URL_ENV) {
  test("Square legacy shared-merchant revocation (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  const revokeCalls = (h: SquareHarness) => h.fake.calls("/oauth2/revoke");
  const epochs = async (h: SquareHarness) => (await h.pool.query(`SELECT merchant_id, revocation_epoch FROM square_merchant_revocations ORDER BY merchant_id`)).rows.map((row) => `${row.merchant_id}:${row.revocation_epoch}`);

  /** A connection an OLD server wrote: plaintext tokens in account_details, status active, nothing sealed. */
  async function legacyConnection(h: SquareHarness, userId: string, merchant = "MERCHANT_1", details: unknown = undefined, status = "active") {
    await h.addUser(userId);
    await h.pool.query(
      `INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details, is_default) VALUES ($1, 'square', $2, $3, $4::jsonb, true)`,
      [userId, merchant, status, JSON.stringify(details ?? { merchantId: merchant, accessToken: `legacy-access-${userId}`, refreshToken: `legacy-refresh-${userId}`, tokenExpiresAt: "2099-01-01T00:00:00Z" })],
    );
  }

  test("an encrypted connection disconnecting while a LEGACY connection shares the merchant does NOT revoke the merchant-wide grant", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "enc-access-a", refresh: "enc-refresh-a" });
      await h.connect("account-a");
      await legacyConnection(h, "account-legacy"); // an old server's connection, same merchant

      const result = await h.service.disconnect("account-a");
      assert.deepEqual(result, { changed: true, providerRevocation: "retained_for_shared_connection", providerRevoked: false });
      assert.equal(revokeCalls(h), 0, "the legacy user's grant was not revoked");
      assert.deepEqual(await epochs(h), []);
      const legacy = await h.row("account-legacy");
      assert.equal(legacy.account_status, "active", "the legacy connection remains locally active");
      assert.equal(legacy.account_details.accessToken, "legacy-access-account-legacy", "and untouched");
    });
  });

  test("after the legacy connection is migrated to encrypted form the behaviour is the same, and the final disconnect revokes exactly once", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "mig-access-a", refresh: "mig-refresh-a" });
      await h.connect("account-a");
      await legacyConnection(h, "account-legacy");
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "retained_for_shared_connection");

      // The legacy row is migrated. (Its token is not one the fake issued, so it counts as live there.)
      assert.equal((await h.service.convertAllLegacyRows()).converted, 1);
      const converted = await h.row("account-legacy");
      assert.ok(converted.encrypted_access_token);
      assert.equal(converted.account_details.accessToken, undefined);

      // The first account reconnects; disconnecting it again still leaves the (now encrypted) other connection alone.
      h.useMerchant("MERCHANT_1", { access: "mig-access-a2", refresh: "mig-refresh-a2" });
      await h.connect("account-a");
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "retained_for_shared_connection");
      assert.equal(revokeCalls(h), 0);

      // The last connection out revokes, once, and the merchant-level history records it.
      assert.equal((await h.service.disconnect("account-legacy")).providerRevocation, "revoked");
      assert.equal(revokeCalls(h), 1);
      assert.deepEqual(await epochs(h), ["MERCHANT_1:1"]);
    });
  });

  test("a legacy connection that is the LAST one out is sealed first, so it can revoke the merchant's grant (once)", async () => {
    await run(async (h) => {
      await legacyConnection(h, "account-legacy");
      const result = await h.service.disconnect("account-legacy");
      assert.equal(result.providerRevocation, "revoked");
      assert.equal(revokeCalls(h), 1);
      assert.equal(JSON.parse(h.fake.requests.find((request) => request.path === "/oauth2/revoke")!.body).access_token, "legacy-access-account-legacy");
      const row = await h.row("account-legacy");
      assert.equal(row.account_status, "disconnected");
      assert.equal(row.encrypted_access_token, null);
      assert.equal(row.account_details.accessToken, undefined, "no plaintext survives the disconnect");
    });
  });

  test("only a USABLE legacy credential counts: arbitrary account_details JSON, other merchants and inactive rows do not", async () => {
    const notUsable: unknown[] = [{}, { merchantId: "MERCHANT_1" }, { accessToken: "" }, { accessToken: "   " }, { accessToken: 12345 }, { accessToken: null }, { accessToken: { a: 1 } }, { refreshToken: "only-refresh" }, [], "text", 42];
    for (const [index, details] of notUsable.entries()) {
      await run(async (h) => {
        h.useMerchant("MERCHANT_1", { access: "noise-access-a", refresh: "noise-refresh-a" });
        await h.connect("account-a");
        await legacyConnection(h, "account-noise", "MERCHANT_1", details);
        assert.equal((await h.service.disconnect("account-a")).providerRevocation, "revoked", `shape #${index} ${JSON.stringify(details)} is not a live connection`);
      });
    }
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "other-access-a", refresh: "other-refresh-a" });
      await h.connect("account-a");
      await legacyConnection(h, "account-other-merchant", "MERCHANT_2");
      await legacyConnection(h, "account-inactive", "MERCHANT_1", undefined, "disabled");
      assert.equal((await h.service.disconnect("account-a")).providerRevocation, "revoked");
    });
  });

  test("dual-disconnect and reconnect races from the earlier passes still hold with a legacy sharer present", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "dual-access-a", refresh: "dual-refresh-a" });
      await h.connect("account-a");
      await legacyConnection(h, "account-legacy");
      h.fake.state.revokeDelayMs = 150;
      const results = await withTimeout(Promise.all([h.service.disconnect("account-a"), h.service.disconnect("account-legacy")]), "dual disconnect");
      assert.deepEqual(results.map((result) => result.providerRevocation).sort(), ["retained_for_shared_connection", "revoked"]);
      assert.equal(revokeCalls(h), 1, "exactly one merchant-wide revocation, by whoever left last");
      assert.deepEqual(await epochs(h), ["MERCHANT_1:1"]);
      for (const row of await h.rows()) assert.equal(row.account_status, "disconnected");
    });
    // A reconnect that commits while a disconnect waits is still seen by it.
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "rc-access-a", refresh: "rc-refresh-a" });
      await h.connect("account-a");
      await h.addUser("account-b");
      h.useMerchant("MERCHANT_1", { access: "rc-access-b", refresh: "rc-refresh-b" });
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;
      const tx = await h.pool.connect();
      await tx.query("BEGIN");
      await h.service.persistVerifiedConnection(tx as never, "account-b", verification.verified);
      const disconnect = h.service.disconnect("account-a");
      await new Promise((resolve) => setTimeout(resolve, 150));
      await tx.query("COMMIT");
      tx.release();
      assert.equal((await withTimeout(disconnect, "disconnect")).providerRevocation, "retained_for_shared_connection");
      assert.equal(revokeCalls(h), 0);
    });
  });
}
