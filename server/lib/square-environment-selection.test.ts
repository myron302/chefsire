/**
 * Square environment selection: ONE authoritative, fail-closed policy (server/lib/square-environment.ts) shared by every integration.
 *
 *  - SQUARE_ENV unset: Sandbox outside a production runtime; a configuration FAULT under NODE_ENV=production (never silently LIVE).
 *  - SQUARE_ENV invalid: always a fault. SQUARE_ENV=sandbox: Sandbox everywhere.
 *  - SQUARE_ENV=production: LIVE only with NODE_ENV=production AND SQUARE_LIVE_PAYMENTS_ENABLED=true.
 *
 * Pure: no network call is made and no production endpoint is contacted.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SquareEnvironment } from "square";
import { SquareEnvironmentConfigError, resolveSquareEnvironment, tryResolveSquareEnvironment } from "./square-environment";
import {
  createConnectedSquareClient,
  createPlatformSquareClient,
  squareApiEnvironment,
  squareEnvironmentConfigured,
  squareEnvironmentName,
  squareOauthApplication,
  squareOauthAuthorizeUrl,
} from "./square-integration";
import { assertSquareSandboxOnly, cateringSquarePaymentsEnabled, cateringSquareSandboxReady, SquareSandboxOnlyError } from "./square-checkout";
import { getSquareClient as getDrinksSquareClient, getSquareConfigError, isSquareConfigured, requireWebhookKey } from "./square";

const KEYS = [
  "SQUARE_ENV", "NODE_ENV", "SQUARE_LIVE_PAYMENTS_ENABLED", "SQUARE_APPLICATION_ID", "SQUARE_APPLICATION_SECRET",
  "SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID", "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY", "SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL",
];

function withEnv<T>(values: Record<string, string | undefined>, fn: () => T): T {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) if (value !== undefined) process.env[key] = value;
  try { return fn(); } finally {
    for (const key of KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

const LIVE = { SQUARE_ENV: "production", NODE_ENV: "production", SQUARE_LIVE_PAYMENTS_ENABLED: "true" };
const CREDS = { SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "loc", SQUARE_APPLICATION_ID: "app", SQUARE_APPLICATION_SECRET: "secret" };

/* ---------------------------------------------- the policy itself ---------------------------------------------- */

test("missing SQUARE_ENV: Sandbox outside a production runtime, a fault under NODE_ENV=production -- never LIVE", () => {
  for (const nodeEnv of ["development", "test", undefined]) {
    for (const blank of [undefined, "", "   "]) {
      withEnv({ SQUARE_ENV: blank, NODE_ENV: nodeEnv }, () => {
        assert.equal(squareEnvironmentName(), "sandbox", `${nodeEnv}/${JSON.stringify(blank)}`);
        assert.equal(squareApiEnvironment(), SquareEnvironment.Sandbox);
      });
    }
  }
  for (const blank of [undefined, "", "  "]) {
    withEnv({ SQUARE_ENV: blank, NODE_ENV: "production", SQUARE_LIVE_PAYMENTS_ENABLED: "true" }, () => {
      assert.throws(() => resolveSquareEnvironment(), (error: unknown) => error instanceof SquareEnvironmentConfigError && error.reason === "missing_in_production_runtime");
      assert.throws(() => squareApiEnvironment(), SquareEnvironmentConfigError);
      assert.equal(tryResolveSquareEnvironment(), null);
      assert.equal(squareEnvironmentConfigured(), false);
    });
  }
});

test("invalid or ambiguous SQUARE_ENV is always a fault, in every runtime, even with the live flag set", () => {
  for (const value of ["prod", "live", "sandbx", "production!", "1", "true", "staging", "sandbox,production", "production sandbox", "bogus-secret-looking-value"]) {
    for (const nodeEnv of ["production", "development", "test", undefined]) {
      withEnv({ SQUARE_ENV: value, NODE_ENV: nodeEnv, SQUARE_LIVE_PAYMENTS_ENABLED: "true" }, () => {
        assert.throws(() => resolveSquareEnvironment(), (error: unknown) => error instanceof SquareEnvironmentConfigError && error.reason === "invalid_value", value);
        assert.equal(tryResolveSquareEnvironment(), null);
      });
    }
  }
});

test("SQUARE_ENV=sandbox selects Sandbox whatever NODE_ENV says (value trimmed, case-insensitive)", () => {
  for (const nodeEnv of ["production", "development", "test", undefined]) {
    for (const value of ["sandbox", " Sandbox ", "SANDBOX"]) {
      withEnv({ SQUARE_ENV: value, NODE_ENV: nodeEnv }, () => {
        assert.equal(squareEnvironmentName(), "sandbox");
        assert.equal(squareApiEnvironment(), SquareEnvironment.Sandbox);
      });
    }
  }
});

test("LIVE needs SQUARE_ENV=production AND NODE_ENV=production AND SQUARE_LIVE_PAYMENTS_ENABLED=true; any one missing refuses", () => {
  withEnv(LIVE, () => {
    assert.equal(squareEnvironmentName(), "production");
    assert.equal(squareApiEnvironment(), SquareEnvironment.Production);
  });
  withEnv({ ...LIVE, SQUARE_ENV: " Production " }, () => assert.equal(squareEnvironmentName(), "production"));
  for (const flag of [undefined, "", "false", "1", "yes", "TRUE-ish"]) {
    withEnv({ ...LIVE, SQUARE_LIVE_PAYMENTS_ENABLED: flag }, () => {
      assert.throws(() => resolveSquareEnvironment(), (error: unknown) => error instanceof SquareEnvironmentConfigError && error.reason === "live_not_enabled", String(flag));
    });
  }
  for (const nodeEnv of ["development", "test", undefined, "staging"]) {
    withEnv({ ...LIVE, NODE_ENV: nodeEnv }, () => {
      assert.throws(() => resolveSquareEnvironment(), (error: unknown) => error instanceof SquareEnvironmentConfigError && error.reason === "live_requires_production_runtime", String(nodeEnv));
    });
  }
});

test("a configuration error never echoes the configured value", () => {
  withEnv({ SQUARE_ENV: "bogus-secret-looking-value", NODE_ENV: "test" }, () => {
    try { resolveSquareEnvironment(); assert.fail("expected a throw"); } catch (error) {
      assert.ok(error instanceof SquareEnvironmentConfigError);
      assert.equal(String(error.message).includes("bogus-secret-looking-value"), false);
    }
  });
});

test("the policy accepts an explicit environment object and does not read process.env in that case", () => {
  withEnv({ SQUARE_ENV: "sandbox" }, () => {
    assert.equal(resolveSquareEnvironment({ SQUARE_ENV: "production", NODE_ENV: "production", SQUARE_LIVE_PAYMENTS_ENABLED: "true" } as NodeJS.ProcessEnv), "production");
    assert.equal(resolveSquareEnvironment({} as NodeJS.ProcessEnv), "sandbox");
  });
});

/* ------------------------------ every integration obeys it (payments, OAuth, refunds, reconciliation) ------------------------------ */

test("marketplace platform client (capture, refund, reconciliation) cannot be built for a missing / invalid / unsafe environment", () => {
  for (const env of [
    { ...CREDS, NODE_ENV: "production" },                                              // SQUARE_ENV missing in production
    { ...CREDS, NODE_ENV: "production", SQUARE_ENV: "prod" },                          // invalid
    { ...CREDS, NODE_ENV: "test", SQUARE_ENV: "production", SQUARE_LIVE_PAYMENTS_ENABLED: "true" }, // live outside production runtime
    { ...CREDS, NODE_ENV: "production", SQUARE_ENV: "production" },                    // live without the explicit flag
  ]) {
    withEnv(env, () => {
      assert.throws(() => createPlatformSquareClient(), SquareEnvironmentConfigError, JSON.stringify(env.SQUARE_ENV));
      assert.throws(() => createConnectedSquareClient("provider-token"), SquareEnvironmentConfigError);
    });
  }
  withEnv({ ...CREDS, NODE_ENV: "test", SQUARE_ENV: "sandbox" }, () => {
    assert.ok(createPlatformSquareClient());
    assert.ok(createConnectedSquareClient("provider-token"));
  });
  withEnv({ ...CREDS, ...LIVE }, () => assert.ok(createPlatformSquareClient(), "explicitly configured live is still reachable when everything is deliberate"));
});

test("a missing platform credential still fails closed in every environment", () => {
  withEnv({ NODE_ENV: "test", SQUARE_ENV: "sandbox" }, () => assert.throws(() => createPlatformSquareClient(), /SQUARE_ACCESS_TOKEN/));
  withEnv({ NODE_ENV: "test", SQUARE_ENV: "sandbox", SQUARE_ACCESS_TOKEN: "tok" }, () => assert.throws(() => createConnectedSquareClient(""), /access token is required/));
});

test("provider OAuth: not configured and no authorize URL for a missing / invalid / unsafe environment; the host follows the environment", () => {
  for (const env of [{ NODE_ENV: "production" }, { NODE_ENV: "production", SQUARE_ENV: "live" }, { NODE_ENV: "test", SQUARE_ENV: "production" }, { NODE_ENV: "production", SQUARE_ENV: "production" }]) {
    withEnv({ ...CREDS, ...env }, () => {
      assert.equal(squareOauthApplication(), null, JSON.stringify(env));
      assert.throws(() => squareOauthAuthorizeUrl(), SquareEnvironmentConfigError);
    });
  }
  withEnv({ ...CREDS, NODE_ENV: "test" }, () => {
    assert.deepEqual(squareOauthApplication(), { clientId: "app", clientSecret: "secret" });
    assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareupsandbox.com/oauth2/authorize");
  });
  withEnv({ ...CREDS, NODE_ENV: "production", SQUARE_ENV: "sandbox" }, () => assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareupsandbox.com/oauth2/authorize"));
  withEnv({ ...CREDS, ...LIVE }, () => assert.equal(squareOauthAuthorizeUrl(), "https://connect.squareup.com/oauth2/authorize"));
});

test("drink / membership / bundle checkout and its webhook use the same policy and fail closed", () => {
  for (const env of [{ NODE_ENV: "production" }, { NODE_ENV: "production", SQUARE_ENV: "prod" }, { NODE_ENV: "production", SQUARE_ENV: "production" }, { NODE_ENV: "test", SQUARE_ENV: "production", SQUARE_LIVE_PAYMENTS_ENABLED: "true" }]) {
    withEnv({ ...CREDS, SQUARE_WEBHOOK_SIGNATURE_KEY: "whsec", ...env }, () => {
      assert.match(String(getSquareConfigError()), /SQUARE_ENV/, JSON.stringify(env));
      assert.equal(isSquareConfigured(), false);
      assert.throws(() => getDrinksSquareClient(), /SQUARE_ENV/);
      assert.throws(() => requireWebhookKey(), /not safely configured/);
    });
  }
  // Credentials in the module-level config are read at import; the environment is read at USE time, so only the environment is exercised here.
  withEnv({ NODE_ENV: "test", SQUARE_ENV: "sandbox", SQUARE_WEBHOOK_SIGNATURE_KEY: "whsec" }, () => {
    assert.doesNotMatch(String(getSquareConfigError()), /SQUARE_ENV/, "sandbox environment is accepted (any remaining error is about credentials)");
  });
});

test("Catering stays Sandbox-only: production, missing-in-production and invalid environments are all refused", () => {
  const webhook = { SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY: "k", SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL: "https://chefsire.test/hook" };
  withEnv({ ...webhook, NODE_ENV: "test", SQUARE_ENV: "sandbox" }, () => {
    assert.doesNotThrow(() => assertSquareSandboxOnly());
    assert.equal(cateringSquareSandboxReady(), true);
    assert.equal(cateringSquarePaymentsEnabled(), true);
  });
  withEnv({ ...webhook, NODE_ENV: "test" }, () => assert.equal(cateringSquarePaymentsEnabled(), true, "unset outside production stays Sandbox (existing local workflow)"));
  withEnv({ ...webhook, ...LIVE }, () => {
    assert.throws(() => assertSquareSandboxOnly(), SquareSandboxOnlyError, "a fully, deliberately LIVE environment is still refused for Catering");
    assert.equal(cateringSquareSandboxReady(), false);
    assert.equal(cateringSquarePaymentsEnabled(), false);
  });
  for (const env of [{ NODE_ENV: "production" }, { NODE_ENV: "production", SQUARE_ENV: "typo" }, { NODE_ENV: "test", SQUARE_ENV: "production" }]) {
    withEnv({ ...webhook, ...env }, () => {
      assert.throws(() => assertSquareSandboxOnly());
      assert.equal(cateringSquarePaymentsEnabled(), false, JSON.stringify(env));
    });
  }
});

/* ------------------------------------- structural guard: no second policy can creep back ------------------------------------- */

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.ts$/.test(entry) && !full.includes(`${path.sep}test-support${path.sep}`)) out.push(full);
  }
  return out;
}

test("only square-environment.ts reads SQUARE_ENV, and only square-integration.ts picks an SDK environment", () => {
  for (const file of sourceFiles(SERVER)) {
    const relative = path.relative(SERVER, file);
    const text = readFileSync(file, "utf8");
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    if (relative !== path.join("lib", "square-environment.ts")) {
      assert.doesNotMatch(code, /process\.env\.SQUARE_ENV|env\[["']SQUARE_ENV["']\]/, `${relative} reads SQUARE_ENV directly`);
    }
    if (relative !== path.join("lib", "square-integration.ts")) {
      assert.doesNotMatch(code, /SquareEnvironment\.(Production|Sandbox)/, `${relative} chooses an SDK environment itself`);
      assert.doesNotMatch(code, /new SquareClient\(/, `${relative} builds a Square client outside the shared factory`);
    }
    assert.doesNotMatch(code, /isSandbox\b/, `${relative} derives its own sandbox flag`);
  }
});

test("marketplace capture, refund and the public config route consult the shared policy before any provider work", () => {
  const payments = readFileSync(path.join(SERVER, "routes", "payments.ts"), "utf8");
  assert.equal((payments.match(/squareEnvironmentConfigured\(\)/g) ?? []).length, 2, "capture and refund guards");
  assert.match(payments, /tryResolveSquareEnvironment\(\)/);
  assert.doesNotMatch(payments, /NODE_ENV/);
});
