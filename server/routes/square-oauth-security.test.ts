import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSquareOauthBrowserBinding,
  createSquareOauthClaimId,
  createSquareOauthState,
  hashSquareOauthBrowserBinding,
  hashSquareOauthState,
  SQUARE_OAUTH_BROWSER_BINDING_COOKIE,
  SQUARE_OAUTH_BROWSER_BINDING_COOKIE_PATH,
  SQUARE_OAUTH_STATE_TTL_MS,
  squareOauthBrowserBindingCookieOptions,
} from "../lib/square-oauth-state";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const route = fs.readFileSync(path.join(root, "server/routes/payouts.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "shared/schema/domains/ops-wedding.ts"), "utf8");
// Since Phase 2Q Gate 0 the post-claim work (code exchange, merchant/scope/location verification and the sealed write)
// lives in the connection service; the route keeps the state/claim/consume protections.
const service = fs.readFileSync(path.join(root, "server/lib/square-connection-service.ts"), "utf8");
const freshMigration = fs.readFileSync(
  path.join(root, "server/migrations/20260927_square_oauth_transactions.sql"),
  "utf8",
);
const hardeningMigration = fs.readFileSync(
  path.join(root, "server/migrations/20260928_square_oauth_hardening.sql"),
  "utf8",
);

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

test("OAuth state has 256 bits of CSPRNG entropy and only its digest is persisted", () => {
  const states = new Set(Array.from({ length: 1_000 }, createSquareOauthState));
  assert.equal(states.size, 1_000);
  for (const state of states) {
    assert.equal(Buffer.from(state, "base64url").byteLength, 32);
    assert.match(state, /^[A-Za-z0-9_-]{43}$/);
    assert.match(hashSquareOauthState(state)!, /^[a-f0-9]{64}$/);
  }
  assert.match(route, /hashSquareOauthState\(state\)/);
  assert.match(route, /nonce_hash, browser_binding_hash, expires_at/);
});

test("altered, fabricated-format, missing, and malformed state do not resolve to the valid digest", () => {
  const state = createSquareOauthState();
  const altered = `${state.slice(0, -1)}${state.endsWith("A") ? "B" : "A"}`;
  assert.notEqual(hashSquareOauthState(altered), hashSquareOauthState(state));
  for (const invalid of ["", "seller-123", `${state}=`, "../" + state, state.slice(1)]) {
    assert.equal(hashSquareOauthState(invalid), null);
  }
});

test("state is bound to authenticated server identity, never callback identity", () => {
  assert.match(route, /const sellerId = req\.user!\.id/);
  assert.match(route, /\[sellerId, nonceHash, browserBindingHash, expiresAt\]/);
  assert.match(route, /const sellerId = claim\.rows\[0\]\.user_id/);
  assert.doesNotMatch(route, /state:\s*sellerId|req\.query\.(?:userId|sellerId|accountId)/);
});

test("state expires after an explicit ten-minute server-side lifetime, an absolute instant", () => {
  assert.equal(SQUARE_OAUTH_STATE_TTL_MS, 600_000);
  assert.match(route, /expires_at > now\(\)/);
  assert.match(schema, /expiresAt: timestamp\("expires_at", \{ withTimezone: true \}\)\.notNull\(\)/);
});

test("replayed state cannot be claimed twice", () => {
  assert.match(route, /AND claimed_at IS NULL[\s\S]*AND consumed_at IS NULL[\s\S]*AND expires_at > now\(\)/);
  assert.match(route, /if \(claim\.rowCount !== 1\)/);
});

// ---------------------------------------------------------------------------
// BROWSER BINDING
// ---------------------------------------------------------------------------

test("browser-binding secret is a second, independent 256-bit CSPRNG value", () => {
  const bindings = new Set(Array.from({ length: 1_000 }, createSquareOauthBrowserBinding));
  assert.equal(bindings.size, 1_000);
  for (const binding of bindings) {
    assert.equal(Buffer.from(binding, "base64url").byteLength, 32);
    assert.match(hashSquareOauthBrowserBinding(binding)!, /^[a-f0-9]{64}$/);
  }
  // Independent pools: a state nonce is never accepted as a valid binding value's sibling by construction.
  const state = createSquareOauthState();
  const binding = createSquareOauthBrowserBinding();
  assert.notEqual(state, binding);
});

test("browser-binding secret does not encode ChefSire user identity", () => {
  const userId = "seller-12345";
  for (let i = 0; i < 50; i++) {
    const binding = createSquareOauthBrowserBinding();
    // Pure 256 bits of random bytes: never contains or derives from a user id.
    assert.equal(Buffer.from(binding, "base64url").byteLength, 32);
    assert.doesNotMatch(binding, new RegExp(userId));
  }
});

test("cookie carrying the binding secret has the required security attributes", () => {
  const optsDev = squareOauthBrowserBindingCookieOptions();
  assert.equal(optsDev.httpOnly, true);
  assert.equal(optsDev.sameSite, "lax");
  assert.equal(optsDev.path, "/api/payouts/square-callback");
  assert.equal(SQUARE_OAUTH_BROWSER_BINDING_COOKIE_PATH, "/api/payouts/square-callback");
  assert.equal(optsDev.maxAge, SQUARE_OAUTH_STATE_TTL_MS);
  assert.equal("domain" in optsDev, false);
  assert.match(route, /res\.cookie\(SQUARE_OAUTH_BROWSER_BINDING_COOKIE, browserBinding, squareOauthBrowserBindingCookieOptions\(\)\)/);

  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal(squareOauthBrowserBindingCookieOptions().secure, true);
    process.env.NODE_ENV = "development";
    assert.equal(squareOauthBrowserBindingCookieOptions().secure, false);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test("callback claim requires both the state digest and the browser-binding digest atomically", () => {
  const claimStatement = route.slice(route.indexOf("SET claim_id = $3, claimed_at = now()"));
  assert.match(claimStatement, /WHERE nonce_hash = \$1/);
  assert.match(claimStatement, /AND browser_binding_hash = \$2/);
  assert.match(route, /\[nonceHash, browserBindingHash, claimId\]/);
});

test("forwarded authorization URL opened in another browser fails: correct state, no matching binding", () => {
  // The victim browser never received the attacker's binding cookie, so its
  // hashed binding cannot equal the value stored at initiation. The claim
  // WHERE clause requires equality on both columns in one statement, so the
  // legitimate row is left untouched (see the atomicity test above) and no
  // code below the claim (token exchange, merchant lookup, persistence) runs.
  const initiation = route.indexOf('router.get("/connect-square"');
  const callback = route.indexOf('router.get("/square-callback"');
  const claim = route.indexOf("SET claim_id = $3, claimed_at = now()", callback);
  const exchange = route.indexOf("squareConnections.verifyAuthorizationCode(code)", callback);
  assert.ok(initiation > 0 && callback > initiation && claim > callback && exchange > claim);
  assert.match(route, /if \(claim\.rowCount !== 1\)[\s\S]{0,260}return res\.status\(400\)/);
});

test("missing browser binding cookie fails closed before the claim", () => {
  assert.match(route, /const browserBindingCookie = req\.cookies\?\.\[SQUARE_OAUTH_BROWSER_BINDING_COOKIE\]/);
  assert.match(
    route,
    /if \(!nonceHash \|\| !browserBindingHash \|\| !pool\)[\s\S]{0,260}return res\.status\(400\)/,
  );
  const guardIdx = route.indexOf("if (!nonceHash || !browserBindingHash || !pool)");
  const claimIdx = route.indexOf("SET claim_id = $3, claimed_at = now()");
  assert.ok(guardIdx > 0 && guardIdx < claimIdx);
});

test("wrong or forged binding value hashes to a different digest and cannot match", () => {
  const real = createSquareOauthBrowserBinding();
  const forged = createSquareOauthBrowserBinding();
  assert.notEqual(hashSquareOauthBrowserBinding(real), hashSquareOauthBrowserBinding(forged));
  for (const invalid of ["", "attacker-controlled", `${real}=`, real.slice(1)]) {
    assert.equal(hashSquareOauthBrowserBinding(invalid), null);
  }
});

test("invalid binding does not consume or claim the legitimate transaction (no destructive side effect)", () => {
  // The only write in the callback that can touch claimed_at/consumed_at before
  // the browser-binding digest is verified is the atomic claim UPDATE itself,
  // and it is guarded by `browser_binding_hash = $2` in its WHERE clause, so a
  // non-matching binding produces rowCount 0 with no row mutated.
  const claimStatement = route.slice(
    route.indexOf("const claim = await pool.query("),
    route.indexOf("RETURNING user_id") + "RETURNING user_id".length,
  );
  assert.match(claimStatement, /AND browser_binding_hash = \$2/);
  assert.doesNotMatch(route.slice(0, route.indexOf("const claim = await pool.query(")), /consumed_at = now\(\)/);
});

test("browser binding cookie is cleared only after a successful matching claim, never before", () => {
  // Round 2 / Finding 2: clearing the cookie before the claim succeeds is a
  // denial-of-service against a different, still-legitimate OAuth attempt
  // sharing this browser (e.g. an older tab whose flow was replaced by a
  // newer initiation). The cookie must be cleared only once the atomic claim
  // has proven it belongs to the transaction being terminated.
  const callback = route.indexOf('router.get("/square-callback"');
  const guard = route.indexOf("if (!nonceHash || !browserBindingHash || !pool)", callback);
  const claimCall = route.indexOf("const claim = await pool.query(", callback);
  const claimFailureGuard = route.indexOf("if (claim.rowCount !== 1)", callback);
  const sellerIdAssignment = route.indexOf("const sellerId = claim.rows[0].user_id;", callback);
  const clearCall = route.indexOf("res.clearCookie(SQUARE_OAUTH_BROWSER_BINDING_COOKIE", callback);
  const oauthDenialCheck = route.indexOf("if (oauthError || !code)", callback);

  assert.ok(guard > 0 && guard < claimCall, "missing-state guard must run before the claim");
  assert.ok(claimCall > 0 && claimCall < claimFailureGuard, "claim must run before its failure guard");
  assert.ok(
    claimFailureGuard > 0 && claimFailureGuard < sellerIdAssignment,
    "claim failure guard must run before sellerId is read",
  );
  assert.ok(
    clearCall > sellerIdAssignment && clearCall < oauthDenialCheck,
    "cookie must be cleared only after a successful claim, before any provider round-trip",
  );

  // No clearCookie call anywhere before the claim failure guard: an invalid,
  // stale, forged, or wrong-binding attempt must never reach it.
  const preClaimSource = route.slice(callback, claimFailureGuard);
  assert.doesNotMatch(preClaimSource, /res\.clearCookie/);
});

test("a claim failure (invalid, stale, forged, or wrong-binding) returns before any cookie mutation", () => {
  const callback = route.indexOf('router.get("/square-callback"');
  const claimFailureGuard = route.indexOf("if (claim.rowCount !== 1)", callback);
  const failureBlock = route.slice(claimFailureGuard, route.indexOf("}", route.indexOf("return res.status(400)", claimFailureGuard)) + 1);
  assert.match(failureBlock, /return res\.status\(400\)/);
  assert.doesNotMatch(failureBlock, /res\.clearCookie/);
});

test("a DB error thrown before a successful claim is caught by the outer handler without clearing the cookie", () => {
  // Any exception thrown by pool.query during the claim (e.g. a transient DB
  // failure) propagates to the outer try/catch, which redirects without ever
  // reaching the clearCookie call that only exists after a successful claim.
  const callback = route.indexOf('router.get("/square-callback"');
  const outerCatch = route.indexOf("} catch (error) {\n    console.error(\"Square callback error:\"", callback);
  const clearCall = route.indexOf("res.clearCookie(SQUARE_OAUTH_BROWSER_BINDING_COOKIE", callback);
  const claimCall = route.indexOf("const claim = await pool.query(", callback);
  assert.ok(outerCatch > clearCall, "outer catch must be positioned after the success-path cookie clear");
  assert.ok(claimCall < clearCall, "claim must run before the cookie is ever cleared");
});

// ---------------------------------------------------------------------------
// CONCURRENCY / REPLAY
// ---------------------------------------------------------------------------

test("one conditional claim makes replay and concurrent callbacks fail closed", () => {
  assert.match(route, /SET claim_id = \$3, claimed_at = now\(\)/);
  for (const guard of ["claimed_at IS NULL", "consumed_at IS NULL", "expires_at > now()"])
    assert.ok(route.includes(guard), `missing atomic claim guard: ${guard}`);
  assert.match(route, /if \(claim\.rowCount !== 1\)/);
  assert.equal(createSquareOauthClaimId().length, 64);
});

test("missing code and provider denial consume the claimed transaction without connecting", () => {
  assert.match(route, /if \(oauthError \|\| !code\)[\s\S]*SET consumed_at = now\(\)[\s\S]*square_auth_failed/);
  const providerExchange = route.indexOf("squareConnections.verifyAuthorizationCode(code)");
  const persistence = route.indexOf("squareConnections.persistVerifiedConnection");
  assert.ok(providerExchange > 0 && persistence > providerExchange);
});

test("provider exchange failures log neither code nor provider response body and persist nothing", () => {
  // The route never touches the provider response: it only learns pass/fail from the service.
  assert.doesNotMatch(route, /tokenResponse|tokenData|\.text\(\)|\bfetch\(/);
  assert.match(route, /if \(!verification\.ok\) \{\s*return res\.redirect\(SQUARE_CALLBACK_FAILURE_REDIRECTS\[verification\.reason\]\);/);
  assert.ok(route.indexOf("if (!verification.ok)") < route.indexOf("persistVerifiedConnection"));
  // The service logs only an HTTP status and a classification, never an error message or body (which can echo credentials).
  const logCalls = [...service.matchAll(/log\.warn\([^;]*\);/g)].map((match) => match[0]);
  assert.ok(logCalls.length >= 5);
  for (const call of logCalls) assert.doesNotMatch(call, /error\.message|\.body|accessToken|refreshToken|\bcode\b/);
});

test("final persistence lookup verifies claimed ownership by immutable identifiers, not a second expiration check", () => {
  // Round 2 / Finding 3: expires_at gates whether a callback may START/CLAIM
  // (enforced once, in the initial atomic claim). It must not be re-checked
  // after Square's token exchange and merchant lookup, where ordinary
  // provider latency crossing expires_at would otherwise invalidate an
  // already-legitimately-claimed transaction.
  const finalLookupStart = route.indexOf("const transaction = await client.query(");
  const finalLookupEnd = route.indexOf("FOR UPDATE`", finalLookupStart);
  const finalLookup = route.slice(finalLookupStart, finalLookupEnd);
  assert.match(finalLookup, /WHERE nonce_hash = \$1 AND user_id = \$2 AND claim_id = \$3/);
  assert.match(finalLookup, /AND claimed_at IS NOT NULL AND consumed_at IS NULL/);
  assert.doesNotMatch(finalLookup, /expires_at/);

  // The initial claim (which alone gates whether a callback may begin at
  // all) still enforces expiration.
  const initialClaimStart = route.indexOf("const claim = await pool.query(");
  const initialClaimEnd = route.indexOf("RETURNING user_id", initialClaimStart);
  const initialClaim = route.slice(initialClaimStart, initialClaimEnd);
  assert.match(initialClaim, /AND expires_at > now\(\)/);
});

test("credential write and state consumption commit atomically", () => {
  const finalTransaction = route.indexOf('await client.query("BEGIN")', route.indexOf("squareConnections.verifyAuthorizationCode(code)"));
  assert.ok(finalTransaction > 0);
  // The sealed credential write runs on the SAME transaction client, between BEGIN and the consume + COMMIT.
  assert.ok(route.indexOf("squareConnections.persistVerifiedConnection(client,", finalTransaction) > finalTransaction);
  assert.ok(route.indexOf("SET consumed_at = now()", finalTransaction) > finalTransaction);
  assert.ok(route.indexOf('await client.query("COMMIT")', finalTransaction) > finalTransaction);
});

test("callback does not require a browser session but does require server-held state and binding", () => {
  assert.match(route, /router\.get\("\/square-callback", async/);
  assert.doesNotMatch(route, /router\.get\("\/square-callback", requireAuth/);
  assert.match(route, /UPDATE square_oauth_transactions[\s\S]*RETURNING user_id/);
});

test("callback redirects are fixed local paths and cannot use a state return URL", () => {
  const redirects = [...route.matchAll(/res\.redirect\(([^)]+)\)/g)].map((match) => match[1]);
  assert.ok(redirects.length >= 3);
  // Every redirect is either a literal local path or a lookup in a constant table of literal local paths.
  assert.ok(redirects.every((value) => value.startsWith('"/settings/payouts?') || value === "SQUARE_CALLBACK_FAILURE_REDIRECTS[verification.reason]"));
  const table = route.slice(route.indexOf("SQUARE_CALLBACK_FAILURE_REDIRECTS: Record"), route.indexOf("};", route.indexOf("SQUARE_CALLBACK_FAILURE_REDIRECTS: Record")));
  const destinations = [...table.matchAll(/:\s*(".*?")/g)].map((match) => match[1]);
  assert.ok(destinations.length >= 5 && destinations.every((value) => value.startsWith('"/settings/payouts?')));
  assert.doesNotMatch(route, /returnUrl|return_url|redirect_uri\s*:\s*req/);
});

// ---------------------------------------------------------------------------
// RETENTION / RATE LIMIT / RECONNECT
// ---------------------------------------------------------------------------

test("initiation is a single upsert keyed by user_id, bounding growth to one row per user", () => {
  assert.match(route, /INSERT INTO square_oauth_transactions/);
  assert.match(route, /ON CONFLICT \(user_id\) DO UPDATE/);
  assert.match(route, /SET nonce_hash = EXCLUDED\.nonce_hash/);
  assert.match(route, /browser_binding_hash = EXCLUDED\.browser_binding_hash/);
  assert.doesNotMatch(route, /superseded_at/);
});

test("schema and migrations enforce one transaction row per user", () => {
  assert.match(schema, /userId: varchar\("user_id"\)[\s\S]*\.notNull\(\)\.unique\(\)/);
  assert.match(freshMigration, /user_id varchar NOT NULL UNIQUE REFERENCES users\(id\)/);
  assert.match(hardeningMigration, /ADD CONSTRAINT square_oauth_transactions_user_id_key UNIQUE \(user_id\)/);
});

test("hardening migration's uniqueness constraint installation is idempotent against a fresh 20260927", () => {
  // Round 2 / Finding 1: on a fresh database, 20260927 already creates
  // user_id UNIQUE, which Postgres names square_oauth_transactions_user_id_key
  // by its default naming convention. Since run-migrations.ts applies every
  // *.sql file it finds (ledger permitting), 20260928 runs immediately after
  // 20260927 on a brand-new database. An unconditional ADD CONSTRAINT with
  // that same name would fail with "constraint already exists" there, so the
  // migration must drop it first (a no-op if it never existed) before adding
  // it back -- safe in both the fresh and upgrade scenarios because step 2
  // above unconditionally empties the table first, so no duplicate user_id
  // row can ever make the ADD CONSTRAINT fail.
  assert.match(
    hardeningMigration,
    /DROP CONSTRAINT IF EXISTS square_oauth_transactions_user_id_key;\s*\nALTER TABLE square_oauth_transactions\s*\n\s*ADD CONSTRAINT square_oauth_transactions_user_id_key UNIQUE \(user_id\);/,
  );
  // The unconditional DELETE FROM must precede the constraint installation,
  // so the table is always empty by the time uniqueness is (re)installed.
  const deleteIdx = hardeningMigration.indexOf("DELETE FROM square_oauth_transactions");
  const dropAddIdx = hardeningMigration.indexOf(
    "DROP CONSTRAINT IF EXISTS square_oauth_transactions_user_id_key",
  );
  assert.ok(deleteIdx > 0 && dropAddIdx > deleteIdx);
});

test("Square OAuth initiation is rate limited to 20 requests per 15 minutes per IP", () => {
  const rateLimitSource = fs.readFileSync(path.join(root, "server/middleware/rate-limit.ts"), "utf8");
  assert.match(rateLimitSource, /squareOauthInitiationLimiter[\s\S]*windowMs: 15 \* 60 \* 1000/);
  assert.match(rateLimitSource, /squareOauthInitiationLimiter[\s\S]*limit: 20/);
  assert.match(route, /router\.get\("\/connect-square", squareOauthInitiationLimiter, requireAuth/);
});

test("a newer initiation replaces the prior nonce and binding so a stale callback cannot match", () => {
  // Because there is exactly one row per user_id and initiation overwrites
  // nonce_hash/browser_binding_hash/claim/claimed/consumed in place, the old
  // nonce (from an earlier attempt) no longer appears in any row: a stale
  // callback's WHERE nonce_hash = $1 finds zero rows.
  assert.match(route, /claim_id = NULL,\s*\n\s*claimed_at = NULL,\s*\n\s*consumed_at = NULL/);
});

// ---------------------------------------------------------------------------
// TIMEZONE
// ---------------------------------------------------------------------------

test("schema timestamps are timezone-aware absolute instants", () => {
  const tableStart = schema.indexOf('export const squareOauthTransactions = pgTable(');
  const tableEnd = schema.indexOf('\n);', tableStart);
  assert.ok(tableStart >= 0 && tableEnd > tableStart);
  const tableSource = schema.slice(tableStart, tableEnd);
  for (const column of ["created_at", "expires_at", "claimed_at", "consumed_at"]) {
    const re = new RegExp(`timestamp\\("${column}"`);
    const idx = tableSource.search(re);
    assert.ok(idx >= 0, `missing column ${column} in squareOauthTransactions schema`);
    const line = tableSource.slice(idx, tableSource.indexOf("\n", idx));
    assert.match(line, /\{ withTimezone: true \}/, `${column} is not withTimezone: true`);
  }
});

test("fresh migration uses timestamptz for every OAuth transaction timestamp", () => {
  for (const column of ["created_at", "expires_at", "claimed_at", "consumed_at"]) {
    const re = new RegExp(`${column} timestamptz`);
    assert.ok(re.test(freshMigration), `fresh migration column ${column} is not timestamptz`);
  }
  assert.doesNotMatch(freshMigration, /\btimestamp\b(?!tz)/);
});

test("hardening migration converts every timestamp column to timestamptz", () => {
  for (const column of ["created_at", "expires_at", "claimed_at", "consumed_at"]) {
    const re = new RegExp(`ALTER COLUMN ${column} TYPE timestamptz`);
    assert.ok(re.test(hardeningMigration), `hardening migration does not convert ${column}`);
  }
});

test("the ten-minute TTL is expressed as milliseconds added to an absolute Date, not a DB-local literal", () => {
  assert.match(route, /new Date\(Date\.now\(\) \+ SQUARE_OAUTH_STATE_TTL_MS\)/);
});

// ---------------------------------------------------------------------------
// MERCHANT VERIFICATION
// ---------------------------------------------------------------------------

test("merchant verification fails closed on every missing/mismatched condition", () => {
  const verify = service.slice(service.indexOf("async function verifyAuthorizationCode"), service.indexOf("async function persistVerifiedConnection"));
  for (const condition of [
    "!grant.refreshToken || !grant.merchantId",
    "merchant.id !== grant.merchantId",
    "tokenStatus.merchantId && tokenStatus.merchantId !== merchant.id",
    "!hasRequiredSquareScopes(tokenStatus.scopes)",
  ]) {
    assert.ok(verify.includes(condition), `missing fail-closed condition: ${condition}`);
  }
  // The merchant profile id must exist (the SDK wrapper refuses a response without one) and may never be waved through by `&&`.
  assert.doesNotMatch(verify, /profileMerchantId &&/);
  const integration = fs.readFileSync(path.join(root, "server/lib/square-integration.ts"), "utf8");
  assert.match(integration, /if \(!merchant\?\.id\) throw new SquareProviderResponseError/);
});

test("merchant lookup exceptions are caught and fail closed without activating credentials", () => {
  const verify = service.slice(service.indexOf("async function verifyAuthorizationCode"), service.indexOf("async function persistVerifiedConnection"));
  assert.match(verify, /catch \(error\) \{[\s\S]*return \{ ok: false, reason:/);
  assert.ok(verify.indexOf("api.retrieveMerchant") < verify.indexOf("} catch (error)"));
});

test("provider denial and token exchange failure never reach merchant lookup or persistence", () => {
  const denial = route.indexOf("if (oauthError || !code)");
  const verification = route.indexOf("squareConnections.verifyAuthorizationCode(code)");
  const persistence = route.indexOf("squareConnections.persistVerifiedConnection");
  assert.ok(denial > 0 && denial < verification && verification < persistence);
  const verify = service.slice(service.indexOf("async function verifyAuthorizationCode"), service.indexOf("async function persistVerifiedConnection"));
  assert.ok(verify.indexOf("api.exchangeAuthorizationCode") < verify.indexOf("api.retrieveMerchant"));
  assert.doesNotMatch(verify, /payment_methods|\.query\(/, "verification touches no database");
});

// ---------------------------------------------------------------------------
// MIGRATION SAFETY / EXISTING CONNECTIONS
// ---------------------------------------------------------------------------

test("fresh migration is additive and never touches payment_methods", () => {
  assert.match(freshMigration, /CREATE TABLE IF NOT EXISTS square_oauth_transactions/);
  assert.doesNotMatch(freshMigration, /\b(?:UPDATE|DELETE|DROP|TRUNCATE)\s+(?:TABLE\s+)?payment_methods\b/i);
});

test("hardening migration only discards short-lived OAuth attempts, never payment_methods", () => {
  assert.match(hardeningMigration, /DELETE FROM square_oauth_transactions/);
  assert.doesNotMatch(hardeningMigration, /\b(?:UPDATE|DELETE|DROP|TRUNCATE)\s+(?:TABLE\s+)?payment_methods\b/i);
});

// ---------------------------------------------------------------------------
// TOKEN / OUTPUT SAFETY
// ---------------------------------------------------------------------------

test("tokens are sealed before storage and are never returned by payout APIs or logged", () => {
  // Plaintext tokens are no longer written anywhere; the typed encrypted columns hold sealed values.
  assert.doesNotMatch(route, /accessToken: tokenData|refreshToken: tokenData|account_details = \$3::jsonb/);
  assert.match(service, /encryptSecret\(verified\.accessToken, accessAad\(id\)\)/);
  assert.match(service, /encryptSecret\(verified\.refreshToken, refreshAad\(id\)\)/);
  assert.doesNotMatch(route, /res\.(?:json|send)\([^)]*(?:accessToken|refreshToken)/s);
  assert.doesNotMatch(route, /console\.(?:log|error)\([^)]*(?:tokenData|access_token|refresh_token|\bcode\b|verification)/s);
});

test("the OAuth repair leaves fail-closed payout execution and eligibility intact", () => {
  assert.match(route, /rejectUnavailablePayout\(req\.body\)/);
  assert.match(route, /PAYOUT_ELIGIBILITY_UNVERIFIABLE/);
  assert.doesNotMatch(route, /status:\s*["']completed["']/);
});
