/**
 * Square failures are classified from what Square SAID, and only a provider-credential failure may destroy credentials.
 * A wrong, stale or rotating ChefSire application secret (INVALID_CLIENT and friends), an outage and an unrecognised error
 * must all leave a provider's stored connection exactly as it was. Real PostgreSQL, the real `square` SDK against a local fake
 * Square. Set TEST_DATABASE_URL to a loopback database whose name contains "test"; skipped otherwise.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, withTimeout, type SquareHarness } from "../test-support/square-connection-harness";
import { FAKE_TOKEN_ERRORS } from "../test-support/fake-square";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const soon = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const dueGrants = (access: string, refresh: string) => [{ access_token: access, refresh_token: refresh, expires_at: soon(), merchant_id: "MERCHANT_1" }];

if (!URL_ENV) {
  test("Square failure classification (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (grants: ReturnType<typeof dueGrants>, fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, { fake: { grants } }, fn);
  const snapshotOf = async (h: SquareHarness) => {
    const row = await h.row("provider-1");
    return { status: row.account_status, access: row.encrypted_access_token, refresh: row.encrypted_refresh_token, expires: row.token_expires_at?.toISOString() ?? null, generation: row.credential_generation, location: row.location_id };
  };
  const denies = (h: SquareHarness) => assert.equal(h.logs.some((entry) => entry.event === "square_connection_needs_reauthorization"), false, "no connection was demoted");

  for (const [label, status, body] of [
    ["401 INVALID_CLIENT", 401, FAKE_TOKEN_ERRORS.invalidClient],
    ["400 INVALID_CLIENT", 400, FAKE_TOKEN_ERRORS.invalidClient],
    ["403 INVALID_CLIENT", 403, FAKE_TOKEN_ERRORS.invalidClient],
    ["401 CLIENT_DISABLED", 401, FAKE_TOKEN_ERRORS.clientDisabled],
    ["401 'Not Authorized' (wrong application secret, v1 body)", 401, FAKE_TOKEN_ERRORS.notAuthorizedV1],
    ["400 'Not Authorized' (v1 body)", 400, FAKE_TOKEN_ERRORS.notAuthorizedV1],
  ] as const) {
    test(`token refresh answered ${label}: the provider's credentials are PRESERVED and the fault is reported as configuration`, async () => {
      await run(dueGrants("app-auth-access-1", "app-auth-refresh-1"), async (h) => {
        await h.connect("provider-1");
        const before = await snapshotOf(h);
        h.fake.state.failures.token = status;
        h.fake.state.tokenFailureBody = body;

        const readiness = await h.service.getSquarePaymentReadiness("provider-1");
        assert.equal(readiness.state, "configuration_error");
        assert.equal(readiness.paymentReady, false);
        assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
        assert.deepEqual(await snapshotOf(h), before, "nothing about the stored connection changed");
        assert.equal(before.status, "active");
        denies(h);
        assert.ok(h.logs.some((entry) => entry.event === "square_application_auth_failed"));
        const view = await h.service.status("provider-1");
        assert.equal(view.needsReauthorization, false, "the provider is not told to reconnect for ChefSire's own misconfiguration");
        assert.equal(JSON.stringify(h.logs).includes("app-auth-access-1"), false);
        assert.equal(JSON.stringify(h.logs).includes("app-secret-test"), false);
      });
    });
  }

  test("an application-secret misconfiguration that is later FIXED finds the provider's connection intact and working", async () => {
    await run(dueGrants("misconfig-access-1", "misconfig-refresh-1"), async (h) => {
      await h.connect("provider-1");
      h.fake.state.failures.token = 401;
      h.fake.state.tokenFailureBody = FAKE_TOKEN_ERRORS.notAuthorizedV1; // ChefSire's secret is wrong or being rotated
      for (let i = 0; i < 3; i += 1) assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "configuration_error");

      // The secret is corrected: the very same stored refresh token is accepted and the connection recovers.
      h.fake.state.failures.token = undefined;
      h.fake.state.grants = [{ access_token: "misconfig-access-2", refresh_token: "misconfig-refresh-1", expires_at: "2099-06-01T00:00:00Z", merchant_id: "MERCHANT_1" }];
      h.fake.resetGrants();
      const credentials = await h.service.getReadyConnectedCredentials("provider-1");
      assert.equal(credentials?.accessToken, "misconfig-access-2");
      const refreshRequests = h.fake.requests.filter((request) => request.path === "/oauth2/token").map((request) => JSON.parse(request.body));
      assert.equal(refreshRequests.at(-1).refresh_token, "misconfig-refresh-1", "the original refresh grant was still in hand and valid");
      assert.equal(h.refreshOf(await h.row("provider-1")), "misconfig-refresh-1");
    });
  });

  for (const [label, status, body] of [
    ["400 invalid_grant (v2 envelope)", 400, FAKE_TOKEN_ERRORS.invalidGrantV2],
    ["401 invalid_grant (v2 envelope)", 401, FAKE_TOKEN_ERRORS.invalidGrantV2],
    ["400 invalid_grant (v1 body)", 400, FAKE_TOKEN_ERRORS.invalidGrantV1],
    ["403 invalid_grant (v1 body)", 403, FAKE_TOKEN_ERRORS.invalidGrantV1],
  ] as const) {
    test(`token refresh answered ${label}: the provider's grant IS invalid, so the connection leaves service and its secrets are cleared`, async () => {
      await run(dueGrants("grant-access-1", "grant-refresh-1"), async (h) => {
        await h.connect("provider-1");
        const generationN = await h.generation("provider-1");
        h.fake.state.failures.token = status;
        h.fake.state.tokenFailureBody = body;
        const readiness = await h.service.getSquarePaymentReadiness("provider-1");
        assert.equal(readiness.state, "needs_reauthorization");
        const after = await h.row("provider-1");
        assert.equal(after.account_status, "needs_reauthorization");
        assert.equal(after.encrypted_access_token, null);
        assert.equal(after.encrypted_refresh_token, null);
        assert.equal(Number(after.credential_generation), generationN + 1);
        assert.equal(after.provider_id, "MERCHANT_1", "merchant identity is retained");
        assert.equal(after.location_id, "LOC_1");
        assert.deepEqual(h.logs.map((entry) => entry.event), ["square_connection_needs_reauthorization"]);
        assert.equal((await h.service.status("provider-1")).needsReauthorization, true);
      });
    });
  }

  for (const [label, status] of [["500", 500], ["502", 502], ["503", 503], ["429", 429], ["408", 408]] as const) {
    test(`a ${label} from the token endpoint is transient: credentials are preserved and the connection is merely unverifiable`, async () => {
      await run(dueGrants("transient-access-1", "transient-refresh-1"), async (h) => {
        await h.connect("provider-1");
        const before = await snapshotOf(h);
        h.fake.state.failures.token = status;
        h.fake.state.tokenFailureBody = FAKE_TOKEN_ERRORS.invalidGrantV2; // even if the body "sounds" fatal, a 5xx/429/408 is not evidence
        const readiness = await h.service.getSquarePaymentReadiness("provider-1");
        assert.equal(readiness.state, "verification_unavailable");
        assert.equal(readiness.paymentReady, false);
        assert.deepEqual(await snapshotOf(h), before);
        denies(h);
      });
    });
  }

  test("a transient failure does not demote a connection however many times it repeats, and the connection recovers", async () => {
    await run(dueGrants("repeat-access-1", "repeat-refresh-1"), async (h) => {
      await h.connect("provider-1");
      const before = await snapshotOf(h);
      h.fake.state.failures.token = 503;
      for (let i = 0; i < 5; i += 1) assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "verification_unavailable");
      assert.deepEqual(await snapshotOf(h), before);
      h.fake.state.failures.token = undefined;
      h.fake.state.grants = [{ access_token: "repeat-access-2", refresh_token: "repeat-refresh-1", expires_at: "2099-06-01T00:00:00Z", merchant_id: "MERCHANT_1" }];
      h.fake.resetGrants();
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active");
    });
  });

  for (const [label, status, body] of [
    ["an unrecognised error code", 401, FAKE_TOKEN_ERRORS.unrecognized],
    ["an unrecognised error code on a 400", 400, FAKE_TOKEN_ERRORS.unrecognized],
    ["an empty error body", 403, FAKE_TOKEN_ERRORS.empty],
    ["a non-object body", 401, "<html>gateway says no</html>"],
  ] as const) {
    test(`${label} from the token endpoint fails closed WITHOUT credential loss`, async () => {
      await run(dueGrants("unknown-access-1", "unknown-refresh-1"), async (h) => {
        await h.connect("provider-1");
        const before = await snapshotOf(h);
        h.fake.state.failures.token = status;
        h.fake.state.tokenFailureBody = body;
        const readiness = await h.service.getSquarePaymentReadiness("provider-1");
        assert.equal(readiness.paymentReady, false);
        assert.ok(["verification_unavailable", "configuration_error"].includes(readiness.state), readiness.state);
        assert.equal(await h.service.getReadyConnectedCredentials("provider-1"), null);
        assert.deepEqual(await snapshotOf(h), before);
        denies(h);
      });
    });
  }

  test("the same rule holds for the authorization-code exchange: application-auth errors are a configuration fault, a bad grant is the provider's", async () => {
    await run(dueGrants("exchange-access-1", "exchange-refresh-1"), async (h) => {
      await h.addUser("provider-1");
      h.fake.state.failures.token = 401;
      h.fake.state.tokenFailureBody = FAKE_TOKEN_ERRORS.invalidClient;
      const application = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(application.ok === false && application.reason, "not_configured");
      h.fake.state.tokenFailureBody = FAKE_TOKEN_ERRORS.invalidGrantV2;
      const grant = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(grant.ok === false && grant.reason, "provider_rejected");
      h.fake.state.tokenFailureBody = FAKE_TOKEN_ERRORS.unrecognized;
      const unknown = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(unknown.ok === false && unknown.reason, "unavailable");
      h.fake.state.failures.token = 503;
      assert.equal((await h.service.verifyAuthorizationCode("auth-code")).ok, false);
      assert.equal((await h.rows()).length, 0);
    });
  });

  test("verification calls made with a provider's token: INVALID_CLIENT is not a revoked token; a 401 is", async () => {
    await run(dueGrants("verify-access-1", "verify-refresh-1").map((grant) => ({ ...grant, expires_at: "2099-01-01T00:00:00Z" })), async (h) => {
      await h.connect("provider-1");
      const before = await snapshotOf(h);
      // The application itself is rejected while verifying: preserved, reported as configuration.
      h.fake.state.failures.merchant = 401;
      h.fake.state.merchantFailureBody = FAKE_TOKEN_ERRORS.invalidClient;
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1", { force: true })).state, "configuration_error");
      assert.deepEqual(await snapshotOf(h), before);
      // A plain 401 for the bearer token IS the provider's credential being refused.
      h.fake.state.merchantFailureBody = undefined;
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1", { force: true })).state, "needs_reauthorization");
    });
  });

  test("a stale refresh outcome cannot touch a newer generation: a reconnect that wins the row makes the waiting refresh stand down", async () => {
    await run(dueGrants("stale-access-1", "stale-refresh-1"), async (h) => {
      await h.connect("provider-1");
      const generationN = await h.generation("provider-1");

      // Thread B reconnects and HOLDS its transaction (and the row lock) open.
      h.fake.resetGrants();
      h.fake.state.grants = [{ access_token: "stale-access-2", refresh_token: "stale-refresh-2", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }];
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;
      const tx = await h.pool.connect();
      await tx.query("BEGIN");
      await h.service.persistVerifiedConnection(tx as never, "provider-1", verification.verified);

      // Thread A: the token it read is due, so it tries to refresh -- and would use the OLD refresh token -- but must wait for the lock.
      const requestsBefore = h.fake.calls("/oauth2/token");
      h.fake.state.failures.token = 400;
      h.fake.state.tokenFailureBody = FAKE_TOKEN_ERRORS.invalidGrantV2; // were it to run, it would demote the (old) grant
      const refresh = h.service.getSquarePaymentReadiness("provider-1");
      await new Promise((resolve) => setTimeout(resolve, 150));
      await tx.query("COMMIT");
      tx.release();
      const readiness = await withTimeout(refresh, "stale refresh finished");

      assert.equal(readiness.state, "active", "the waiting refresh re-read the NEW generation");
      assert.equal(h.fake.calls("/oauth2/token"), requestsBefore, "no refresh was attempted with the replaced grant");
      const after = await h.row("provider-1");
      assert.equal(Number(after.credential_generation), generationN + 1);
      assert.equal(h.accessOf(after), "stale-access-2");
      assert.equal(h.refreshOf(after), "stale-refresh-2");
      denies(h);
    });
  });

  test("a rejected-grant outcome is bound to the exact snapshot it judged: a report about replaced credentials changes nothing", async () => {
    await run(dueGrants("bound-access-1", "bound-refresh-1").map((grant) => ({ ...grant, expires_at: "2099-01-01T00:00:00Z" })), async (h) => {
      await h.connect("provider-1");
      const first = await h.service.getReadyConnectedCredentials("provider-1");
      assert.ok(first);
      h.fake.resetGrants();
      await h.connect("provider-1");
      await h.service.reportAuthorizationFailure("provider-1", first!.credentialGeneration);
      assert.equal((await h.row("provider-1")).account_status, "active");
      assert.ok(h.logs.some((entry) => entry.event === "square_connection_snapshot_changed"));
    });
  });
}
