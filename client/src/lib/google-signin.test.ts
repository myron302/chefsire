import test from "node:test";
import assert from "node:assert/strict";
import { googleSignInUrl } from "./google-signin";
import { consumeOAuthInitiation, OAUTH_INITIATION_KEY } from "./session-controller";

const mem = () => { const m = new Map<string, string>(); return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }; };

test("the sign-in URL carries a fresh nonce that the same browser can later consume exactly once", () => {
  const { m, s } = mem();
  const url = new URL(googleSignInUrl("/api/auth/google", s), "https://app.test");
  const nonce = url.searchParams.get("client_state")!;
  assert.match(nonce, /^[A-Za-z0-9_-]{16,64}$/);
  assert.ok(m.has(OAUTH_INITIATION_KEY));
  assert.equal(consumeOAuthInitiation(s, "wrong-wrong-wrong-wrong", Date.now()), false, "a different value does not match (and does not burn the record)");
  assert.equal(consumeOAuthInitiation(s, nonce, Date.now()), true);
  assert.equal(consumeOAuthInitiation(s, nonce, Date.now()), false, "single use");
});

test("existing query parameters are kept (?next=…&client_state=…); each click gets a different nonce", () => {
  const { s } = mem();
  const a = new URL(googleSignInUrl("/api/auth/google?next=%2Ffeed", s), "https://app.test");
  const b = new URL(googleSignInUrl("/api/auth/google?next=%2Ffeed", s), "https://app.test");
  assert.equal(a.searchParams.get("next"), "/feed");
  assert.notEqual(a.searchParams.get("client_state"), b.searchParams.get("client_state"));
});

test("an expired initiation is rejected and removed", () => {
  const { m, s } = mem();
  m.set(OAUTH_INITIATION_KEY, JSON.stringify({ nonce: "A".repeat(24), at: 1_000 }));
  assert.equal(consumeOAuthInitiation(s, "A".repeat(24), 1_000 + 11 * 60_000), false);
  assert.equal(m.has(OAUTH_INITIATION_KEY), false);
  m.set(OAUTH_INITIATION_KEY, "{not json");
  assert.equal(consumeOAuthInitiation(s, "A".repeat(24), Date.now()), false);
});

test("without usable storage the plain URL is returned and the flow still works", () => {
  assert.equal(googleSignInUrl("/api/auth/google", undefined), "/api/auth/google");
  const angry = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } };
  const url = googleSignInUrl("/api/auth/google", angry);
  assert.ok(url.startsWith("/api/auth/google"));
});
