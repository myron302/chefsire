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
 * claim, a missing account, a lookup error, or any mismatch all mean "not authenticated".
 */
import { resolveAuthRuntimeMode, signAuthToken } from "./jwt-config";

type SessionUser = { id: string; email?: string | null; username?: string | null; authVersion?: number | null };

type SessionLookup = (id: string) => Promise<{ authVersion?: number | null } | undefined>;

// `storage` is imported on first use, not at module load: this module sits under the token layer, which
// must stay importable without dragging the database layer in.
const liveLookup: SessionLookup = async (id) => (await import("../storage")).storage.getUser(id);
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

/** Resolve verified token claims to the live account, or `null` if the session is not (or no longer) valid. */
export async function resolveSessionUser(claims: { id?: unknown; av?: unknown } | null | undefined) {
  const id = typeof claims?.id === "string" ? claims.id.trim() : "";
  const av = claims?.av;
  if (!id || typeof av !== "number" || !Number.isInteger(av)) return null;
  try {
    const user = await lookup(id);
    if (!user || typeof user.authVersion !== "number" || user.authVersion !== av) return null;
    return user;
  } catch (error) {
    console.error("[auth] Session lookup failed; denying.", error);
    return null;
  }
}
