/**
 * A provider must not be trapped in ChefSire because ChefSire's own Square configuration is broken. When the encryption key or the
 * Square application credentials are unavailable, readiness is `configuration_error`, but the status still says whether a LOCAL
 * connection exists (a boolean, never a credential) so Disconnect can be offered, and local disconnect completes without that
 * configuration. Real PostgreSQL. Set TEST_DATABASE_URL (loopback, name contains "test").
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
  test("Square config-error disconnect (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, { fake: { grants: [{ access_token: "cfg-access-token-1", refresh_token: "cfg-refresh-token-1", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }] } }, fn);
  async function withEnv<T>(name: string, value: string | undefined, fn: () => Promise<T>): Promise<T> {
    const saved = process.env[name];
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
    try { return await fn(); } finally { if (saved === undefined) delete process.env[name]; else process.env[name] = saved; }
  }
  const outages: Array<[string, (fn: () => Promise<void>) => Promise<void>]> = [
    ["the encryption key is unavailable", (fn) => withEnv(SECRET_BOX_KEY_ENV, undefined, fn)],
    ["the encryption key is malformed", (fn) => withEnv(SECRET_BOX_KEY_ENV, "not-a-key", fn)],
    ["the Square application secret is unavailable", (fn) => withEnv("SQUARE_APPLICATION_SECRET", undefined, fn)],
    ["the Square application id is unavailable", (fn) => withEnv("SQUARE_APPLICATION_ID", undefined, fn)],
  ];

  for (const [label, during] of outages) {
    test(`${label} + an existing connection: configuration_error, Disconnect is available, and the status carries no secret`, async () => {
      await run(async (h) => {
        await h.connect("account-a");
        await during(async () => {
          const view = await h.service.status("account-a");
          assert.equal(view.state, "configuration_error");
          assert.equal(view.canDisconnect, true);
          assert.equal(view.paymentReady, false);
          const text = JSON.stringify(view);
          for (const forbidden of ["cfg-access-token-1", "cfg-refresh-token-1", "sqenc", "app-secret-test", "MERCHANT_1"]) assert.equal(text.includes(forbidden), false, forbidden);
          assert.equal(await h.service.getReadyConnectedCredentials("account-a"), null);
        });
      });
    });

    test(`${label} + NO connection: configuration_error, and no meaningless Disconnect is offered`, async () => {
      await run(async (h) => {
        await during(async () => {
          assert.equal((await h.service.status("nobody")).canDisconnect, false);
          assert.equal((await h.service.status("nobody")).state, "configuration_error");
        });
        // A disconnected account is no connection either.
        await h.connect("account-a");
        await h.service.disconnect("account-a");
        await during(async () => assert.equal((await h.service.status("account-a")).canDisconnect, false));
      });
    });

    test(`local disconnect completes while ${label}: credentials cleared, history kept, revocation reported as unconfirmed`, async () => {
      await run(async (h) => {
        await h.connect("account-a");
        await during(async () => {
          const revokesBefore = h.fake.calls("/oauth2/revoke");
          const result = await h.service.disconnect("account-a");
          assert.deepEqual(result, { changed: true, providerRevocation: "unconfirmed", providerRevoked: false });
          assert.equal(h.fake.calls("/oauth2/revoke"), revokesBefore, "no provider call is attempted without a usable configuration");
          const row = await h.row("account-a");
          assert.equal(row.account_status, "disconnected");
          assert.equal(row.encrypted_access_token, null);
          assert.equal(row.encrypted_refresh_token, null);
          assert.equal(row.provider_id, "MERCHANT_1", "non-secret history is preserved");
          assert.equal(row.location_id, "LOC_1");
          assert.equal((await h.service.status("account-a")).canDisconnect, false);
          assert.deepEqual((await h.pool.query(`SELECT 1 FROM square_merchant_revocations`)).rows, [], "an unconfirmed revoke is not recorded");
        });
      });
    });
  }

  test("a legacy plaintext connection can be disconnected during a configuration outage, and its plaintext is removed", async () => {
    await run(async (h) => {
      await h.addUser("account-legacy");
      await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ('account-legacy', 'square', 'MERCHANT_1', 'active', '{"accessToken":"cfg-legacy-access","refreshToken":"cfg-legacy-refresh","tokenExpiresAt":"2099-01-01T00:00:00Z"}'::jsonb)`);
      await withEnv(SECRET_BOX_KEY_ENV, undefined, async () => {
        const view = await h.service.status("account-legacy");
        assert.equal(view.canDisconnect, true);
        assert.equal((await h.service.disconnect("account-legacy")).providerRevocation, "unconfirmed");
      });
      const row = await h.row("account-legacy");
      assert.equal(row.account_status, "disconnected");
      assert.equal(JSON.stringify(row).includes("cfg-legacy-access"), false);
    });
  });
}
