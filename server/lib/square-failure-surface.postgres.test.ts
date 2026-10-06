/**
 * Authentication-failure classification is contextual to the Square SURFACE. Bearer-authenticated calls send the provider's access token,
 * never ChefSire's application secret, so "not authorized" wording there is the provider's token failing -- not ChefSire's configuration.
 * Application-auth (free text and codes) is decided only where the application credentials are presented (token grant / refresh, revoke).
 * Part 1 is pure; part 2 drives the real service against a real PostgreSQL (TEST_DATABASE_URL, loopback, name contains "test").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { SquareError } from "square";
import { classifySquareFailure } from "./square-integration";
import { squareConnectionPresentation } from "../../client/src/lib/square-connection";
import { withSquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const v2 = (statusCode: number, code: string, detail: string, category = "AUTHENTICATION_ERROR") =>
  new SquareError({ message: "failed", statusCode, body: { errors: [{ category, code, detail }] } });
const v1 = (statusCode: number, type: string, message: string) => new SquareError({ message: "failed", statusCode, body: { type, message } });

test("token grant / refresh: INVALID_CLIENT and bad application-auth text are application_auth", () => {
  assert.equal(classifySquareFailure(v2(401, "INVALID_CLIENT", "client auth failed"), { surface: "token_grant" }), "application_auth");
  assert.equal(classifySquareFailure(v1(401, "invalid_client", "bad"), { surface: "token_grant" }), "application_auth");
  assert.equal(classifySquareFailure(v2(401, "UNAUTHORIZED", "Invalid client secret"), { surface: "token_grant" }), "application_auth");
  assert.equal(classifySquareFailure(v1(401, "service.not_authorized", "not authorized"), { surface: "token_grant" }), "application_auth");
  // ...while a rejected GRANT stays distinct.
  assert.equal(classifySquareFailure(v1(400, "invalid_grant", "The refresh token has been revoked"), { surface: "token_grant" }), "provider_credential_invalid");
});

test("revoke: a bad ChefSire application secret is application_auth", () => {
  assert.equal(classifySquareFailure(v2(401, "INVALID_CLIENT", "bad secret"), { surface: "revoke" }), "application_auth");
  assert.equal(classifySquareFailure(v2(401, "UNAUTHORIZED", "client secret is wrong"), { surface: "revoke" }), "application_auth");
});

test("bearer calls: a 401 invalid token, 'not authorized' wording, service.not_authorized, expired and revoked tokens are PROVIDER credential failures, never application_auth", () => {
  const cases: SquareError[] = [
    v2(401, "UNAUTHORIZED", "The access token is invalid"),
    v2(401, "UNAUTHORIZED", "This request could not be authorized: not authorized"),
    v2(403, "FORBIDDEN", "You are not authorized to perform this action", "AUTHENTICATION_ERROR"),
    v1(401, "service.not_authorized", "This request could not be authorized."),
    v2(401, "ACCESS_TOKEN_EXPIRED", "expired"),
    v2(401, "ACCESS_TOKEN_REVOKED", "revoked"),
    v2(401, "SOMETHING_ELSE", "service.not_authorized"),
  ];
  for (const error of cases) {
    for (const surface of ["bearer", undefined] as const) {
      assert.equal(classifySquareFailure(error, surface ? { surface } : {}), "provider_credential_invalid", JSON.stringify(error.errors));
    }
  }
});

test("bearer calls: an explicit INVALID_CLIENT / CLIENT_DISABLED CODE keeps the earlier application-identity protection", () => {
  assert.equal(classifySquareFailure(v2(401, "INVALID_CLIENT", "x"), { surface: "bearer" }), "application_auth");
  assert.equal(classifySquareFailure(v2(401, "CLIENT_DISABLED", "x"), { surface: "bearer" }), "application_auth");
});

test("transient failures are never credential failures on any surface", () => {
  for (const surface of ["bearer", "token_grant", "revoke"] as const) {
    assert.equal(classifySquareFailure(v2(503, "SERVICE_UNAVAILABLE", "try later", "API_ERROR"), { surface }), "transient");
    assert.equal(classifySquareFailure(v2(429, "RATE_LIMITED", "slow down", "RATE_LIMIT_ERROR"), { surface }), "transient");
    assert.equal(classifySquareFailure(v2(500, "INTERNAL_SERVER_ERROR", "oops", "API_ERROR"), { surface }), "transient");
    assert.equal(classifySquareFailure(new TypeError("fetch failed"), { surface }), "transient");
  }
  // A not-authorized-sounding body on a 5xx is still transient, not a credential or configuration verdict.
  assert.equal(classifySquareFailure(v2(503, "UNAUTHORIZED", "not authorized"), { surface: "bearer" }), "transient");
});

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
if (!URL_ENV) {
  test("Square failure surfaces, service flow (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: Parameters<typeof withSquareHarness>[2]) => withSquareHarness(URL_ENV, { fake: { grants: [{ access_token: "surf-access-1", refresh_token: "surf-refresh-1", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }] } }, fn);

  test("a bearer 401 with 'not authorized' / service.not_authorized wording reaches the RECONNECT path (needs_reauthorization), not configuration_error", async () => {
    for (const body of [
      { errors: [{ category: "AUTHENTICATION_ERROR", code: "UNAUTHORIZED", detail: "This request could not be authorized: not authorized" }] },
      { type: "service.not_authorized", message: "This request could not be authorized." },
    ]) {
      await run(async (h) => {
        await h.connect("p");
        h.fake.state.failures.merchant = 401;
        h.fake.state.merchantFailureBody = body;
        const readiness = await h.service.getSquarePaymentReadiness("p", { force: true });
        assert.equal(readiness.state, "needs_reauthorization");
        const row = await h.row("p");
        assert.equal(row.account_status, "needs_reauthorization");
        assert.equal(row.encrypted_access_token, null, "unusable credentials are cleared");
        // The provider-facing status offers reconnect.
        const status = await h.service.status("p");
        assert.equal(status.state, "needs_reauthorization");
        assert.equal(status.needsReauthorization, true);
        assert.deepEqual(squareConnectionPresentation(status).actions, ["reconnect", "disconnect"], "the UI offers reconnect, not a configuration dead end");
      });
    }
  });

  test("a transient bearer failure stays unavailable and keeps the credentials", async () => {
    await run(async (h) => {
      await h.connect("p");
      h.fake.state.failures.merchant = 503;
      assert.equal((await h.service.getSquarePaymentReadiness("p", { force: true })).state, "verification_unavailable");
      assert.equal((await h.row("p")).account_status, "active");
      assert.equal(h.accessOf(await h.row("p")), "surf-access-1");
    });
  });

  test("a rejected APPLICATION secret on the refresh surface still preserves credentials and reports configuration_error (earlier protection intact)", async () => {
    await run(async (h) => {
      await h.connect("p");
      await h.pool.query(`UPDATE payment_methods SET token_expires_at = now() + interval '1 hour' WHERE user_id = 'p'`);
      h.fake.state.failures.token = 401;
      h.fake.state.tokenFailureBody = { errors: [{ category: "AUTHENTICATION_ERROR", code: "UNAUTHORIZED", detail: "Invalid client secret" }] };
      assert.equal((await h.service.getSquarePaymentReadiness("p", { force: true })).state, "configuration_error");
      assert.equal((await h.row("p")).account_status, "active");
      assert.equal(h.accessOf(await h.row("p")), "surf-access-1");
    });
  });
}
