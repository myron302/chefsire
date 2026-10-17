// server/lib/auth-session.ts
/**
 * Server-enforced validity of an access token (P2-1).
 *
 * A signed token only says "this was issued for account X at some point". Whether it may still act
 * for X is decided here, against the *current* account row: the token's `av` claim must equal
 * `users.auth_version`. Reclaiming an account (email verification or authoritative Google link on an
 * account whose credentials were never proven) bumps that version in the same atomic UPDATE that
 * removes the credentials, so every token issued before then stops working immediately.
 *
 * Fails closed: a missing claim (including every token issued before this existed), a non-integer
 * claim, a missing account, or any mismatch all mean "not authenticated".
 *
 * Phase 2C: a lookup that could not be answered is a different thing from an answer of "no". Both deny access -- the verdict is never
 * "valid" without the database's authoritative say-so -- but they are reported differently (`checkSession`): an invalid session is a 401,
 * an unreachable database is a retryable 503 that must not make the client believe the user was logged out.
 */
import { resolveAuthRuntimeMode, signAuthToken } from "./jwt-config";
import { describeDatabaseError, withReadTimeout } from "./db-availability";
import { resolveDbSettings } from "./db-config";

type SessionUser = { id: string; email?: string | null; username?: string | null; authVersion?: number | null };

// The live row is the storage layer's `User`; typed loosely here so this token-layer module stays free of
// the schema import graph (and callers keep the shape they read).
type SessionLookup = (id: string) => Promise<any>;

// `storage` is imported on first use, not at module load: this module sits under the token layer, which
// must stay importable without dragging the database layer in.
// Phase 2C (P1-2): the live lookup is a bounded read -- it cannot keep a pool connection past its deadline (see lib/bounded-read).
const liveLookup: SessionLookup = async (id) => (await import("./session-user-read")).readSessionUserBounded(id, resolveDbSettings().authLookupTimeoutMs);
let lookup: SessionLookup = liveLookup;

/**
 * TEST ONLY. Suites that exercise unrelated routes with a database double have no `users` table to
 * consult; they substitute the account directory here. Refuses to act outside NODE_ENV=test, so no
 * production or unclassified runtime can ever replace the live lookup.
 */
export function setSessionLookupForTests(fn: SessionLookup | null): void {
  if (resolveAuthRuntimeMode(process.env) !== "test") {
    throw new Error("setSessionLookupForTests is only available when NODE_ENV=test");
  }
  lookup = fn ?? liveLookup;
}

/** The one place access tokens are minted for a user, so the version claim cannot be forgotten. */
export function issueAuthToken(user: SessionUser): string {
  if (typeof user.authVersion !== "number" || !Number.isInteger(user.authVersion)) {
    throw new Error("refusing to issue an auth token for an account without an auth version");
  }
  return signAuthToken({
    id: user.id,
    email: user.email ?? undefined,
    username: user.username ?? undefined,
    av: user.authVersion,
  });
}

export type SessionCheck =
  | { status: "valid"; user: any }
  /** The database answered and the session does not count (malformed claims, unknown account, auth version mismatch). */
  | { status: "invalid" }
  /** The database could not answer (unreachable, timed out, errored). Access is NOT granted; the session is NOT known to be bad. */
  | { status: "unavailable" };

/**
 * Three-way verdict for verified token claims. Never returns "valid" unless the live account row was read and matches the claim.
 * The lookup is a read-only SELECT, so bounding it (AUTH_LOOKUP_TIMEOUT_MS) and abandoning it on timeout has no side effects.
 */
export async function checkSession(claims: { id?: unknown; av?: unknown } | null | undefined): Promise<SessionCheck> {
  const id = typeof claims?.id === "string" ? claims.id.trim() : "";
  const av = claims?.av;
  if (!id || typeof av !== "number" || !Number.isInteger(av)) return { status: "invalid" };
  try {
    // The live lookup enforces its own deadline AND releases its connection. This outer bound only covers substituted lookups (tests) and is a
    // little longer so the inner, resource-freeing deadline is the one that normally fires.
    const ms = resolveDbSettings().authLookupTimeoutMs;
    const user = await withReadTimeout(Promise.resolve(lookup(id)), ms + 1_500, "session lookup");
    if (!user || typeof user.authVersion !== "number" || user.authVersion !== av) return { status: "invalid" };
    return { status: "valid", user };
  } catch (error) {
    console.error(`[auth] Session lookup could not be completed; denying without invalidating the session. ${describeDatabaseError(error)}`);
    return { status: "unavailable" };
  }
}

/** Resolve verified token claims to the live account, or `null` if the session is not (or no longer) valid -- or could not be verified. */
export async function resolveSessionUser(claims: { id?: unknown; av?: unknown } | null | undefined) {
  const check = await checkSession(claims);
  return check.status === "valid" ? check.user : null;
}
