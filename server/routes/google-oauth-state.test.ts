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

const flowCookie = (r: Response) => setCookies(r).find((x) => x.startsWith("oauth_flow_"));
const stateOf = (r: Response) => new URL(r.headers.get("location")!).searchParams.get("state");
// FakeGoogle above forwards no state; wrap so the passport `state` option is visible like it is with the real strategy.
const origAuthenticate = FakeGoogle.prototype.authenticate;
FakeGoogle.prototype.authenticate = function (req: any, options: any = {}) {
  if (!String(req.path).endsWith("/callback")) {
    const u = new URL("https://accounts.google.test/o/oauth2/auth");
    if (options.state) u.searchParams.set("state", options.state);
    return (this as any).redirect(u.toString());
  }
  return origAuthenticate.call(this, req, options);
};

test("initiation: the flow is stored in its own httpOnly cookie scoped to the google routes, named by the OAuth state", async () => {
  const r = await get(`/api/auth/google?client_state=${NONCE}`);
  assert.equal(r.status, 302);
  const state = stateOf(r)!;
  const c = flowCookie(r)!;
  assert.ok(c.startsWith(`oauth_flow_${state}=`), c);
  assert.match(c, /HttpOnly/i);
  assert.match(c, /Path=\/api\/auth\/google(;|$)/);
  assert.match(c, /Max-Age=600/);
  assert.ok(!c.includes(NONCE), "the payload is sealed, not plain");
});

test("initiation: malformed / oversized / non-string client_state is never stored or reflected", async () => {
  for (const bad of ["short", "has space and ;semi=colon", "x".repeat(200), "<script>alert(1)</script>"]) {
    const r = await get(`/api/auth/google?client_state=${encodeURIComponent(bad)}`);
    const cb = await get(`/api/auth/google/callback?state=${stateOf(r)}`, flowCookie(r)!.split(";")[0]);
    assert.equal(new URL(cb.headers.get("location")!, "https://x.test").searchParams.has("oauth_state"), false, bad);
  }
  const arr = await get(`/api/auth/google?client_state=${NONCE}&client_state=${NONCE}`);
  const cb = await get(`/api/auth/google/callback?state=${stateOf(arr)}`, flowCookie(arr)!.split(";")[0]);
  assert.equal(new URL(cb.headers.get("location")!, "https://x.test").searchParams.has("oauth_state"), false, "repeated parameter (array) is rejected");
});

test("callback: the nonce and destination of THIS flow are echoed next to the marker; its cookie is cleared; the session cookie is issued", async () => {
  const init = await get(`/api/auth/google?client_state=${NONCE}&next=${encodeURIComponent("/recipes/9?tab=a#c")}`);
  const r = await get(`/api/auth/google/callback?state=${stateOf(init)}`, flowCookie(init)!.split(";")[0]);
  assert.equal(r.status, 302);
  const location = new URL(r.headers.get("location")!, "https://x.test");
  assert.equal(location.pathname, "/recipes/9");
  assert.equal(location.searchParams.get("google-login"), "success");
  assert.equal(location.searchParams.get("oauth_state"), NONCE);
  assert.equal(location.searchParams.get("tab"), "a");
  assert.equal(location.hash, "#c");
  const cookies = setCookies(r);
  assert.ok(cookies.some((x) => x.startsWith("auth_token=") && /HttpOnly/i.test(x)));
  assert.ok(cookies.some((x) => x.startsWith(`oauth_flow_${stateOf(init)}=;`)), "single use: cleared");
});

test("callback without (or with a legacy shared / malformed) cookie behaves as a plain sign-in: marker only, no oauth_state, no trusted destination", async () => {
  for (const [q, cookie] of [["", undefined], ["?state=short", undefined], ["", `oauth_client_state=${NONCE}; oauth_return_to=${encodeURIComponent("/evil")}`]] as const) {
    const r = await get(`/api/auth/google/callback${q}`, cookie);
    const location = new URL(r.headers.get("location")!, "https://x.test");
    assert.equal(location.searchParams.get("google-login"), "success");
    assert.equal(location.searchParams.has("oauth_state"), false, String(cookie));
    assert.equal(location.pathname, "/");
  }
});
