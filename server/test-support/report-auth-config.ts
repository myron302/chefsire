// server/test-support/report-auth-config.ts
/**
 * A child-process probe for the real boot sequence.
 *
 * `server/boot/env-load-order.test.ts` spawns this module the way `server/index.ts` boots — same
 * loader, same gate, same configuration helper — and reads the JSON line it prints on stdout to
 * assert which source won. It exists so those tests can observe the outcome of environment
 * loading without ever printing a secret: the resolved value is compared in-process against an
 * `EXPECT_SECRET` passed in by the parent, and only the boolean result is reported.
 *
 * It deliberately imports ONLY the gate — it does not load the environment itself. The gate is
 * responsible for its own precondition, so this probe fails exactly the way the deployment would
 * if that responsibility were ever dropped again. (Against 16732e1, where the gate did not import
 * the loader, every `server/.env` case below exits 1.)
 */
import "../boot/verify-auth-config";
import { getJwtConfig } from "../lib/jwt-config";

const config = getJwtConfig();
const expected = process.env.EXPECT_SECRET;

process.stdout.write(
  `AUTH_CONFIG ${JSON.stringify({
    mode: config.mode,
    source: config.source,
    usingDevelopmentFallback: config.usingDevelopmentFallback,
    algorithm: config.algorithm,
    expiresIn: config.expiresIn,
    // Never the secret itself — only whether it is the one the test expected.
    matchesExpected: expected === undefined ? null : config.secret === expected,
    secretLength: config.secret.length,
  })}\n`,
);
