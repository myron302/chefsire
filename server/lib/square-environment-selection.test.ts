/**
 * Square environment resolution. SQUARE_ENV decides when set (and must be exactly sandbox|production); when absent the prior NODE_ENV
 * fallback applies, so an existing production deployment is never silently moved to Sandbox. An invalid value is an explicit error,
 * never a guess. Pure: nothing here makes a network call, and no production endpoint is contacted.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SquareEnvironment } from "square";
import {
  SquareEnvironmentConfigError,
  squareApiEnvironment,
  squareEnvironmentName,
  squareOauthApplication,
  squareOauthAuthorizeUrl,
} from "./square-integration";

function withEnv<T>(values: Record<string, string | undefined>, fn: () => T): T {
  const keys = Object.keys(values);
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) { if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key]; }
  try { return fn(); } finally {
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

test("SQUARE_ENV=sandbox selects Sandbox, whatever NODE_ENV says", () => {
  for (const nodeEnv of ["production", "development", "test", undefined]) {
    withEnv({ SQUARE_ENV: "sandbox", NODE_ENV: nodeEnv }, () => {
      assert.equal(squareEnvironmentName(), "sandbox", String(nodeEnv));
      assert.equal(squareApiEnvironment(), SquareEnvironment.Sandbox);
      assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareupsandbox.com/oauth2/authorize");
    });
  }
});

test("SQUARE_ENV=production selects Production (value is trimmed and case-insensitive)", () => {
  for (const value of ["production", " Production ", "PRODUCTION"]) {
    withEnv({ SQUARE_ENV: value, NODE_ENV: "development" }, () => {
      assert.equal(squareEnvironmentName(), "production", value);
      assert.equal(squareApiEnvironment(), SquareEnvironment.Production);
      assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareup.com/oauth2/authorize");
    });
  }
});

test("NODE_ENV=production with SQUARE_ENV absent (or blank) is Production, never silently Sandbox -- the prior fallback is preserved", () => {
  for (const absent of [undefined, "", "   "]) {
    withEnv({ SQUARE_ENV: absent, NODE_ENV: "production" }, () => {
      assert.equal(squareEnvironmentName(), "production");
      assert.equal(squareApiEnvironment(), SquareEnvironment.Production);
      assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareup.com/oauth2/authorize");
    });
  }
});

test("outside production, an absent SQUARE_ENV is Sandbox (development and tests stay Sandbox)", () => {
  for (const nodeEnv of ["development", "test", undefined]) {
    withEnv({ SQUARE_ENV: undefined, NODE_ENV: nodeEnv }, () => {
      assert.equal(squareEnvironmentName(), "sandbox", String(nodeEnv));
      assert.equal(squareApiEnvironment(), SquareEnvironment.Sandbox);
    });
  }
});

test("an invalid SQUARE_ENV fails explicitly instead of guessing; the provider OAuth application then reads as NOT configured", () => {
  for (const value of ["prod", "live", "sandbx", "production!", "1"]) {
    for (const nodeEnv of ["production", "test"]) {
      withEnv({ SQUARE_ENV: value, NODE_ENV: nodeEnv, SQUARE_APPLICATION_ID: "id", SQUARE_APPLICATION_SECRET: "secret" }, () => {
        assert.throws(() => squareEnvironmentName(), SquareEnvironmentConfigError, value);
        assert.throws(() => squareApiEnvironment(), SquareEnvironmentConfigError);
        assert.equal(squareOauthApplication(), null, "fail closed: not configured");
      });
    }
  }
  withEnv({ SQUARE_ENV: "sandbox", SQUARE_APPLICATION_ID: "id", SQUARE_APPLICATION_SECRET: "secret" }, () => {
    assert.deepEqual(squareOauthApplication(), { clientId: "id", clientSecret: "secret" });
  });
});

test("the Gate 0 test environment is Sandbox and the error message carries no secret", () => {
  // Every Postgres/HTTP suite sets SQUARE_ENV=sandbox and points the real SDK at a local fake server; none contacts Square.
  withEnv({ SQUARE_ENV: "sandbox" }, () => assert.equal(squareEnvironmentName(), "sandbox"));
  withEnv({ SQUARE_ENV: "bogus-secret-looking-value" }, () => {
    try { squareEnvironmentName(); assert.fail("expected a throw"); } catch (error) {
      assert.ok(error instanceof SquareEnvironmentConfigError);
      assert.equal(String(error.message).includes("bogus-secret-looking-value"), false);
    }
  });
});
