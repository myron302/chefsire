/**
 * Security regression tests for the centralized JWT configuration (P1-08).
 *
 * The defect these lock down: production could resolve its signing secret to a literal committed
 * to this repository, so anyone reading the source could mint tokens ChefSire would accept.
 *
 * `resolveJwtConfig` is pure — it takes the environment as an argument — so every case below runs
 * against an explicit, isolated env object. `process.env` is never mutated by these tests, which
 * keeps them safe to run concurrently with the rest of the suite.
 */
import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  AUTH_TOKEN_ALGORITHM,
  DEV_ONLY_FALLBACK_JWT_SECRET,
  JwtConfigError,
  MIN_PRODUCTION_SECRET_LENGTH,
  resolveAuthRuntimeMode,
  resolveJwtConfig,
} from "./jwt-config";

/** A secret of the shape a real deployment would use: private, random, long enough. */
const REAL_SECRET = "s0zT1Qv7rKpN4bX9wLmE2hJdY6uAcF8gRtVnZqWs";
const OTHER_REAL_SECRET = "Q8mHb3kPzLxN1vUeR7yTdC5aJfWgS2oXiM4nBrZq";

const env = (overrides: Record<string, string | undefined>): NodeJS.ProcessEnv =>
  ({ ...overrides }) as NodeJS.ProcessEnv;

/* ------------------------------------------------ production must fail closed */

test("production refuses to resolve a configuration when no secret is set", () => {
  assert.throws(() => resolveJwtConfig(env({ NODE_ENV: "production" })), JwtConfigError);
});

test("production refuses an empty secret", () => {
  assert.throws(
    () => resolveJwtConfig(env({ NODE_ENV: "production", JWT_SECRET: "" })),
    JwtConfigError,
  );
});

test("production refuses a whitespace-only secret", () => {
  assert.throws(
    () => resolveJwtConfig(env({ NODE_ENV: "production", JWT_SECRET: "   \t\n  " })),
    JwtConfigError,
  );
});

test("production refuses the publicly known development fallback", () => {
  assert.throws(
    () => resolveJwtConfig(env({ NODE_ENV: "production", JWT_SECRET: DEV_ONLY_FALLBACK_JWT_SECRET })),
    JwtConfigError,
  );
  // Casing and padding are not an escape hatch either.
  assert.throws(
    () =>
      resolveJwtConfig(
        env({ NODE_ENV: "production", JWT_SECRET: `  ${DEV_ONLY_FALLBACK_JWT_SECRET.toLowerCase()}  ` }),
      ),
    JwtConfigError,
  );
});

test("production refuses the placeholder shipped in .env.example", () => {
  assert.throws(
    () =>
      resolveJwtConfig(
        env({ NODE_ENV: "production", JWT_SECRET: "your-super-secret-jwt-key-change-this-in-production" }),
      ),
    JwtConfigError,
  );
});

test("production refuses a secret shorter than the required minimum", () => {
  const tooShort = "a".repeat(MIN_PRODUCTION_SECRET_LENGTH - 1);
  assert.throws(() => resolveJwtConfig(env({ NODE_ENV: "production", JWT_SECRET: tooShort })), JwtConfigError);
});

test("production also refuses an unsafe SESSION_SECRET when JWT_SECRET is absent", () => {
  assert.throws(
    () => resolveJwtConfig(env({ NODE_ENV: "production", SESSION_SECRET: DEV_ONLY_FALLBACK_JWT_SECRET })),
    JwtConfigError,
  );
});

test("production accepts a real configured secret", () => {
  const config = resolveJwtConfig(env({ NODE_ENV: "production", JWT_SECRET: REAL_SECRET }));
  assert.equal(config.secret, REAL_SECRET);
  assert.equal(config.mode, "production");
  assert.equal(config.source, "JWT_SECRET");
  assert.equal(config.usingDevelopmentFallback, false);
});

test("production keeps ChefSire's SESSION_SECRET fallback for the secret's source", () => {
  const config = resolveJwtConfig(env({ NODE_ENV: "production", SESSION_SECRET: REAL_SECRET }));
  assert.equal(config.secret, REAL_SECRET);
  assert.equal(config.source, "SESSION_SECRET");
});

test("JWT_SECRET wins over SESSION_SECRET", () => {
  const config = resolveJwtConfig(
    env({ NODE_ENV: "production", JWT_SECRET: REAL_SECRET, SESSION_SECRET: OTHER_REAL_SECRET }),
  );
  assert.equal(config.secret, REAL_SECRET);
});

test("a configuration failure never echoes the configured secret", () => {
  const leaky = "leak-me-please-0123456789";
  let message = "";
  try {
    resolveJwtConfig(env({ NODE_ENV: "production", JWT_SECRET: leaky }));
    assert.fail("expected the unsafe secret to be rejected");
  } catch (error) {
    assert.ok(error instanceof JwtConfigError);
    message = error.message;
  }
  assert.ok(message.length > 0);
  assert.ok(!message.includes(leaky), "error message must not contain the configured secret");
});

/* ----------------------------------------- unlabelled runtimes are not development */

test("an unset NODE_ENV is treated with production strictness, not as development", () => {
  assert.equal(resolveAuthRuntimeMode(env({})), "unknown");
  assert.throws(() => resolveJwtConfig(env({})), JwtConfigError);
  assert.throws(() => resolveJwtConfig(env({ NODE_ENV: "" })), JwtConfigError);
});

test("a NODE_ENV that merely looks production-ish is not classified as development", () => {
  // Only the three exact labels are recognised (case- and whitespace-normalised). Anything else —
  // including near-misses like "prod" and "dev" — falls into `unknown` and is held to production rules.
  for (const value of ["prod", "PRODUCTION", "staging", "dev", "devel", "live", "local"]) {
    assert.throws(
      () => resolveJwtConfig(env({ NODE_ENV: value })),
      JwtConfigError,
      `NODE_ENV=${JSON.stringify(value)} must not reach the development fallback`,
    );
  }
});

/* ------------------------------------------------- development and test behaviour */

test("development may use the deterministic development fallback", () => {
  const config = resolveJwtConfig(env({ NODE_ENV: "development" }));
  assert.equal(config.secret, DEV_ONLY_FALLBACK_JWT_SECRET);
  assert.equal(config.usingDevelopmentFallback, true);
  assert.equal(config.source, "development-fallback");
});

test("test may use the deterministic development fallback", () => {
  const config = resolveJwtConfig(env({ NODE_ENV: "test" }));
  assert.equal(config.secret, DEV_ONLY_FALLBACK_JWT_SECRET);
  assert.equal(config.usingDevelopmentFallback, true);
});

test("development still prefers an explicitly configured secret", () => {
  const config = resolveJwtConfig(env({ NODE_ENV: "development", JWT_SECRET: REAL_SECRET }));
  assert.equal(config.secret, REAL_SECRET);
  assert.equal(config.usingDevelopmentFallback, false);
});

test("development tolerates a short or placeholder secret that production would reject", () => {
  const config = resolveJwtConfig(env({ NODE_ENV: "development", JWT_SECRET: "short-dev-secret" }));
  assert.equal(config.secret, "short-dev-secret");
});

/* ------------------------------------------------------ signing and verification */

test("production and development never resolve to the same secret for the same env", () => {
  const devSecret = resolveJwtConfig(env({ NODE_ENV: "development" })).secret;
  const prodSecret = resolveJwtConfig(env({ NODE_ENV: "production", JWT_SECRET: REAL_SECRET })).secret;
  assert.notEqual(devSecret, prodSecret);
});

test("a token signed with the public fallback does not verify against a real production secret", () => {
  const production = resolveJwtConfig(env({ NODE_ENV: "production", JWT_SECRET: REAL_SECRET }));
  const forged = jwt.sign({ id: "attacker", email: "admin@chefsire.com" }, DEV_ONLY_FALLBACK_JWT_SECRET, {
    algorithm: AUTH_TOKEN_ALGORITHM,
    expiresIn: "7d",
  });
  assert.throws(
    () => jwt.verify(forged, production.secret, { algorithms: [AUTH_TOKEN_ALGORITHM] }),
    /invalid signature/,
  );
});

test("a token signed with the configured secret verifies, and a wrong secret does not", () => {
  const token = jwt.sign({ id: "A" }, REAL_SECRET, { algorithm: AUTH_TOKEN_ALGORITHM, expiresIn: "5m" });
  const decoded = jwt.verify(token, REAL_SECRET, { algorithms: [AUTH_TOKEN_ALGORITHM] }) as { id: string };
  assert.equal(decoded.id, "A");
  assert.throws(() => jwt.verify(token, OTHER_REAL_SECRET, { algorithms: [AUTH_TOKEN_ALGORITHM] }));
});

test("verification is pinned to HS256, so an unsigned `none` token is rejected", () => {
  const unsigned = jwt.sign({ id: "A" }, "", { algorithm: "none" });
  assert.throws(() => jwt.verify(unsigned, REAL_SECRET, { algorithms: [AUTH_TOKEN_ALGORITHM] }));
});
