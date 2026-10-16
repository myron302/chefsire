/**
 * Stability Phase 2C (Codex P2-1, server half): the browser-created sign-in nonce travels through the Google round trip and is echoed on the success redirect.
 * Real auth router + real cookie handling; Google itself is replaced by a stub passport strategy.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy } from "passport-strategy";

process.env.DATABASE_URL ||= "postgres://app:secret@127.0.0.1:9/chefsire_unreachable_test";
const { default: authRouter } = await import("./auth");

class FakeGoogle extends (Strategy as any) {
  name = "google";
  authenticate(req: any) {
    if (String(req.path).endsWith("/callback")) (this as any).success({ id: "g-user", email: "g@example.test", username: "g", authVersion: 1 });
    else (this as any).redirect("https://accounts.google.test/o/oauth2/auth");
  }
}
passport.use("google", new FakeGoogle() as any);

const app = express();
app.use(cookieParser());
app.use(passport.initialize());
app.use("/api", authRouter);
const server = http.createServer(app);
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => { server.close(); server.closeAllConnections?.(); });

const NONCE = "Zm9vYmFyYmF6cXV4MTIzNDU2";
const get = (path: string, cookie?: string) => fetch(base + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
const setCookies = (r: Response) => r.headers.getSetCookie();

test("initiation: a well-formed client_state is stored in an httpOnly cookie scoped to the callback path", async () => {
  const r = await get(`/api/auth/google?client_state=${NONCE}`);
  assert.equal(r.status, 302);
  const c = setCookies(r).find((x) => x.startsWith("oauth_client_state="))!;
  assert.ok(c.startsWith(`oauth_client_state=${NONCE};`), c);
  assert.match(c, /HttpOnly/i);
  assert.match(c, /Path=\/api\/auth\/google\/callback/);
  assert.match(c, /Max-Age=600/);
});

test("initiation: malformed / oversized / non-string client_state is never stored or reflected", async () => {
  for (const bad of ["short", "has space and ;semi=colon", "x".repeat(200), "<script>alert(1)</script>"]) {
    const r = await get(`/api/auth/google?client_state=${encodeURIComponent(bad)}`);
    const c = setCookies(r).filter((x) => x.startsWith("oauth_client_state="));
    assert.ok(c.every((x) => x.startsWith("oauth_client_state=;")), `${bad}: ${c.join("|")}`);
  }
  const arr = await get(`/api/auth/google?client_state=${NONCE}&client_state=${NONCE}`);
  assert.ok(setCookies(arr).filter((x) => x.startsWith("oauth_client_state=")).every((x) => x.startsWith("oauth_client_state=;")), "repeated parameter (array) is rejected");
});

test("callback: the nonce from the cookie is echoed as oauth_state next to the marker; the destination is preserved; the cookie is cleared; the session cookie is issued", async () => {
  const r = await get("/api/auth/google/callback", `oauth_client_state=${NONCE}; oauth_return_to=${encodeURIComponent("/recipes/9?tab=a#c")}`);
  assert.equal(r.status, 302);
  const location = new URL(r.headers.get("location")!, "https://x.test");
  assert.equal(location.pathname, "/recipes/9");
  assert.equal(location.searchParams.get("google-login"), "success");
  assert.equal(location.searchParams.get("oauth_state"), NONCE);
  assert.equal(location.searchParams.get("tab"), "a");
  assert.equal(location.hash, "#c");
  const cookies = setCookies(r);
  assert.ok(cookies.some((x) => x.startsWith("auth_token=") && /HttpOnly/i.test(x)));
  assert.ok(cookies.some((x) => x.startsWith("oauth_client_state=;")), "single use: cleared");
});

test("callback without (or with a malformed) cookie behaves as before: marker only, no oauth_state", async () => {
  for (const cookie of [undefined, "oauth_client_state=bad", `oauth_client_state=${"y".repeat(100)}`]) {
    const r = await get("/api/auth/google/callback", cookie);
    const location = new URL(r.headers.get("location")!, "https://x.test");
    assert.equal(location.searchParams.get("google-login"), "success");
    assert.equal(location.searchParams.has("oauth_state"), false, String(cookie));
  }
});
