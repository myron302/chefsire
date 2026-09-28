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
  const exchange = route.indexOf('fetch("https://connect.squareup.com/oauth2/token"', callback);
  assert.ok(initiation > 0 && callback > initiation && claim > callback && exchange > claim);
  assert.match(route, /if \(claim\.rowCount !== 1\)[\s\S]{0,80}return res\.status\(400\)/);
});

test("missing browser binding cookie fails closed before the claim", () => {
  assert.match(route, /const browserBindingCookie = req\.cookies\?\.\[SQUARE_OAUTH_BROWSER_BINDING_COOKIE\]/);
  assert.match(
    route,
    /if \(!nonceHash \|\| !browserBindingHash \|\| !pool\)[\s\S]{0,60}return res\.status\(400\)/,
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

test("browser binding cookie is cleared on every callback outcome", () => {
  const callback = route.indexOf('router.get("/square-callback"');
  const clearCall = route.indexOf("res.clearCookie(SQUARE_OAUTH_BROWSER_BINDING_COOKIE", callback);
  const claim = route.indexOf("const claim = await pool.query(", callback);
  assert.ok(clearCall > callback && clearCall < claim);
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
  const providerExchange = route.indexOf('await fetch("https://connect.squareup.com/oauth2/token"');
  const persistence = route.indexOf("UPDATE payment_methods", providerExchange);
  assert.ok(providerExchange > 0 && persistence > providerExchange);
});

test("provider exchange failures log neither code nor provider response body and persist nothing", () => {
  assert.doesNotMatch(route, /tokenResponse\.text\(\)/);
  assert.match(route, /tokenResponse\.status/);
  assert.ok(route.indexOf("if (!tokenResponse.ok)") < route.indexOf("UPDATE payment_methods"));
});

test("credential write and state consumption commit atomically", () => {
  const finalTransaction = route.indexOf('await client.query("BEGIN")', route.indexOf("const accountDetails"));
  assert.ok(finalTransaction > 0);
  assert.ok(route.indexOf("UPDATE payment_methods", finalTransaction) > finalTransaction);
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
  assert.ok(redirects.every((value) => value.startsWith('"/settings/payouts?')));
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

test("merchant verification fails closed on every missing/mismatched condition, never `profileMerchantId &&`", () => {
  assert.doesNotMatch(route, /profileMerchantId && profileMerchantId !== tokenData\.merchant_id/);
  const guard = route.slice(
    route.indexOf("const locationId = merchant?.mainLocationId"),
    route.indexOf("return res.redirect(\"/settings/payouts?error=square_auth_failed\");", route.indexOf("const locationId = merchant?.mainLocationId")),
  );
  for (const condition of [
    "!tokenData.access_token",
    "!tokenData.refresh_token",
    "!tokenData.merchant_id",
    "!merchant",
    "!profileMerchantId",
    "profileMerchantId !== tokenData.merchant_id",
  ]) {
    assert.ok(guard.includes(condition), `missing fail-closed condition: ${condition}`);
  }
});

test("merchant lookup exceptions are caught and fail closed without activating credentials", () => {
  const lookup = route.indexOf("retrieveMerchant(\"me\")");
  const tryStart = route.lastIndexOf("try {", lookup);
  const catchIdx = route.indexOf("} catch (_merchantError)", lookup);
  assert.ok(tryStart > 0 && catchIdx > lookup);
  const catchBlock = route.slice(catchIdx, route.indexOf("}", route.indexOf("return res.redirect", catchIdx)));
  assert.match(catchBlock, /return res\.redirect\("\/settings\/payouts\?error=square_auth_failed"\)/);
});

test("provider denial and token exchange failure never reach merchant lookup or persistence", () => {
  const denial = route.indexOf("if (oauthError || !code)");
  const exchangeFailure = route.indexOf("if (!tokenResponse.ok)");
  const merchantLookup = route.indexOf('retrieveMerchant("me")');
  const persistence = route.indexOf("UPDATE payment_methods");
  assert.ok(denial > 0 && denial < exchangeFailure);
  assert.ok(exchangeFailure < merchantLookup);
  assert.ok(merchantLookup < persistence);
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

test("tokens remain server-side in account_details and are never returned by payout APIs or logged", () => {
  assert.match(route, /accessToken: tokenData\.access_token/);
  assert.match(route, /refreshToken: tokenData\.refresh_token/);
  assert.doesNotMatch(route, /res\.(?:json|send)\([^)]*(?:accessToken|refreshToken)/s);
  assert.doesNotMatch(route, /console\.(?:log|error)\([^)]*(?:tokenData|access_token|refresh_token|\bcode\b)/s);
});

test("the OAuth repair leaves fail-closed payout execution and eligibility intact", () => {
  assert.match(route, /rejectUnavailablePayout\(req\.body\)/);
  assert.match(route, /PAYOUT_ELIGIBILITY_UNVERIFIABLE/);
  assert.doesNotMatch(route, /status:\s*["']completed["']/);
});
