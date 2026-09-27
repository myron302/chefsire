import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSquareOauthClaimId,
  createSquareOauthState,
  hashSquareOauthState,
  SQUARE_OAUTH_STATE_TTL_MS,
} from "../lib/square-oauth-state";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const route = fs.readFileSync(path.join(root, "server/routes/payouts.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "shared/schema/domains/ops-wedding.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "server/migrations/20260927_square_oauth_transactions.sql"), "utf8");

test("OAuth state has 256 bits of CSPRNG entropy and only its digest is persisted", () => {
  const states = new Set(Array.from({ length: 1_000 }, createSquareOauthState));
  assert.equal(states.size, 1_000);
  for (const state of states) {
    assert.equal(Buffer.from(state, "base64url").byteLength, 32);
    assert.match(state, /^[A-Za-z0-9_-]{43}$/);
    assert.match(hashSquareOauthState(state)!, /^[a-f0-9]{64}$/);
  }
  assert.match(route, /hashSquareOauthState\(state\)/);
  assert.match(route, /INSERT INTO square_oauth_transactions \(nonce_hash, user_id, expires_at\)/);
});

test("altered, fabricated-format, and malformed state do not resolve to the valid digest", () => {
  const state = createSquareOauthState();
  const altered = `${state.slice(0, -1)}${state.endsWith("A") ? "B" : "A"}`;
  assert.notEqual(hashSquareOauthState(altered), hashSquareOauthState(state));
  for (const invalid of ["", "seller-123", `${state}=`, "../" + state, state.slice(1)]) {
    assert.equal(hashSquareOauthState(invalid), null);
  }
});

test("state is bound to authenticated server identity, never callback identity", () => {
  assert.match(route, /const sellerId = req\.user!\.id/);
  assert.match(route, /VALUES \(\$1, \$2, \$3\)[\s\S]*\[nonceHash, sellerId, expiresAt\]/);
  assert.match(route, /const sellerId = claim\.rows\[0\]\.user_id/);
  assert.doesNotMatch(route, /state:\s*sellerId|req\.query\.(?:userId|sellerId|accountId)/);
});

test("state expires after an explicit ten-minute server-side lifetime", () => {
  assert.equal(SQUARE_OAUTH_STATE_TTL_MS, 600_000);
  assert.match(route, /expires_at > now\(\)/);
  assert.match(schema, /expiresAt: timestamp\("expires_at"\)\.notNull\(\)/);
});

test("one conditional claim makes replay and concurrent callbacks fail closed", () => {
  assert.match(route, /SET claim_id = \$2, claimed_at = now\(\)/);
  for (const guard of ["claimed_at IS NULL", "consumed_at IS NULL", "superseded_at IS NULL", "expires_at > now()"])
    assert.ok(route.includes(guard), `missing atomic claim guard: ${guard}`);
  assert.match(route, /if \(claim\.rowCount !== 1\)/);
  assert.equal(createSquareOauthClaimId().length, 64);
});

test("missing code and provider denial consume the claimed transaction without connecting", () => {
  assert.match(route, /if \(oauthError \|\| !code\)[\s\S]*SET consumed_at = now\(\)[\s\S]*square_auth_failed/);
  const providerExchange = route.indexOf("await fetch(\"https://connect.squareup.com/oauth2/token\"");
  const persistence = route.indexOf("UPDATE payment_methods", providerExchange);
  assert.ok(providerExchange > 0 && persistence > providerExchange);
});

test("provider exchange failures log neither code nor provider response body and persist nothing", () => {
  assert.doesNotMatch(route, /tokenResponse\.text\(\)/);
  assert.match(route, /tokenResponse\.status/);
  assert.ok(route.indexOf("if (!tokenResponse.ok)") < route.indexOf("UPDATE payment_methods"));
});

test("Square's authoritative merchant identity is required and callback merchant input is ignored", () => {
  assert.match(route, /profileMerchantId && profileMerchantId !== tokenData\.merchant_id/);
  assert.match(route, /provider_id = \$2/);
  assert.doesNotMatch(route, /req\.query\.(?:merchant|merchantId)/);
});

test("credential write and state consumption commit atomically", () => {
  const finalTransaction = route.indexOf('await client.query("BEGIN")', route.indexOf("const accountDetails"));
  assert.ok(finalTransaction > 0);
  assert.ok(route.indexOf("UPDATE payment_methods", finalTransaction) > finalTransaction);
  assert.ok(route.indexOf("SET consumed_at = now()", finalTransaction) > finalTransaction);
  assert.ok(route.indexOf('await client.query("COMMIT")', finalTransaction) > finalTransaction);
});

test("new initiation supersedes prior attempts under a per-user lock", () => {
  assert.match(route, /SELECT id FROM users WHERE id = \$1 FOR UPDATE/);
  assert.match(route, /SET superseded_at = now\(\)[\s\S]*user_id = \$1/);
  assert.match(route, /transaction is no longer current/);
});

test("callback does not require a browser session but does require server-held state", () => {
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

test("schema migration is additive and preserves existing connections", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS square_oauth_transactions/);
  assert.match(migration, /nonce_hash varchar\(64\) NOT NULL UNIQUE/);
  assert.match(migration, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /\b(?:UPDATE|DELETE|DROP|TRUNCATE)\s+(?:TABLE\s+)?payment_methods\b/i);
});

test("tokens remain server-side in account_details and are never returned by payout APIs", () => {
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
