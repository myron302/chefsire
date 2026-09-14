// server/test-support/auth-test-env.ts
/**
 * Shared setup for tests that need to mint ChefSire access tokens.
 *
 * Import this **first** in any test file that signs or sends a token. It pins the runtime to
 * `test`, which is the only classification (besides `development`) permitted to use the built-in
 * development signing secret — see `server/lib/jwt-config.ts`. Without it, a test run with no
 * `NODE_ENV` is treated with production strictness and refuses to resolve a secret at all, which
 * is exactly the fail-closed behaviour this repair introduces.
 *
 * The secret is resolved through the same helper the server uses, so tests can never drift onto a
 * different value than the middleware they are exercising.
 */
// Load the environment the same way the server boots, before anything resolves configuration:
// a developer with a JWT_SECRET in `server/.env` must see tests sign with that same secret rather
// than with a fallback captured before the file was read.
import "../lib/load-env";
import { getJwtConfig, signAuthToken, type AuthTokenClaims } from "../lib/jwt-config";

// Every consumer of the JWT configuration resolves it lazily, on first use, so setting this as
// the first statement of this module's body is enough to classify the whole test run.
process.env.NODE_ENV = "test";

/**
 * The secret the server will actually sign and verify with during this test run. Resolved through
 * the process-wide `getJwtConfig()` — the very instance the middleware uses — so the test seam
 * cannot drift onto a different value than the code it exercises.
 */
export const TEST_JWT_SECRET = getJwtConfig().secret;

/** Mint a token the way the application does. */
export function signTestAuthToken(claims: AuthTokenClaims): string {
  return signAuthToken(claims);
}

/** `Authorization` header for a user id, matching how the app's clients send credentials. */
export function testAuthHeader(userId: string, extraClaims: Partial<AuthTokenClaims> = {}) {
  return { authorization: `Bearer ${signTestAuthToken({ id: userId, ...extraClaims })}` };
}
