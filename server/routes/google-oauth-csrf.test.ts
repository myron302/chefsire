/**
 * Stability Phase 2C -- Google OAuth login CSRF (Codex P1 on a45bb5c).
 * A callback is only honoured if THIS browser holds the integrity-protected, unexpired, unspent flow cookie that matches the callback's `state`.
 * Anything else must be refused BEFORE passport can complete authentication: no auth_token is issued or replaced. Real auth router + cookie jar; Google is a
 * stub strategy that records whether it was ever asked to complete a login (`completions`) -- a rejected callback must leave that at zero.
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

let completions = 0;
let denied = false;
class FakeGoogle extends (Strategy as any) {
  name = "google";
  authenticate(req: any, options: any = {}) {
    if (String(req.path).endsWith("/callback")) {
      completions++; // reaching here means passport was allowed to finish a Google login
      if (denied) { denied = false; return (this as any).fail(403); }
      return (this as any).success({ id: "attacker-account", email: "attacker@example.test", username: "attacker", authVersion: 1 });
    }
    const u = new URL("https://accounts.google.test/o/oauth2/auth");
    if (options.state) u.searchParams.set("state", options.state);
    if (options.prompt) u.searchParams.set("prompt", options.prompt);
    (this as any).redirect(u.toString());
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

class Jar {
  cookies = new Map<string, { name: string; value: string; path: string; expires: number }>();
  now = Date.now();
  store(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq), value = pair.slice(eq + 1);
      const a = Object.fromEntries(attrs.map((x) => { const i = x.indexOf("="); return i < 0 ? [x.toLowerCase(), ""] : [x.slice(0, i).toLowerCase(), x.slice(i + 1)]; }));
      const path = a.path ?? "/";
      const maxAge = a["max-age"] !== undefined ? Number(a["max-age"]) : null;
      const key = `${name}|${path}`;
      if (value === "" || (maxAge !== null && maxAge <= 0)) this.cookies.delete(key);
      else this.cookies.set(key, { name, value, path, expires: maxAge !== null ? this.now + maxAge * 1000 : Infinity });
    }
  }
  header(path: string) { return [...this.cookies.values()].filter((c) => c.expires > this.now && path.startsWith(c.path)).map((c) => `${c.name}=${c.value}`).join("; "); }
  auth() { return [...this.cookies.values()].find((c) => c.name === "auth_token")?.value ?? null; }
  async get(path: string) {
    const r = await fetch(base + path, { redirect: "manual", headers: { cookie: this.header(path.split("?")[0]) } });
    this.store(r);
    return r;
  }
}
const N1 = "AAAAAAAAAAAAAAAAAAAAAAAA", N2 = "BBBBBBBBBBBBBBBBBBBBBBBB";
async function begin(jar: Jar, nonce: string | null, next?: string, route = "/api/auth/google") {
  const q = [nonce ? `client_state=${nonce}` : "", next ? `next=${encodeURIComponent(next)}` : ""].filter(Boolean).join("&");
  const r = await jar.get(`${route}${q ? `?${q}` : ""}`);
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get("location")!);
  return { state: loc.searchParams.get("state"), prompt: loc.searchParams.get("prompt") };
}
async function callback(jar: Jar, state: string | null) {
  const before = completions;
  const r = await jar.get(`/api/auth/google/callback?code=x${state === null ? "" : `&state=${encodeURIComponent(state)}`}`);
  const loc = new URL(r.headers.get("location")!, "https://app.test");
  return { r, loc, ok: loc.searchParams.get("google-login") === "success", reachedPassport: completions > before, setCookies: r.headers.getSetCookie() };
}
/** The callback was refused: generic failure redirect, passport never asked to complete, and NO auth_token set/replaced/cleared. */
function assertRefused(x: Awaited<ReturnType<typeof callback>>, jarBefore: string | null, jar: Jar, label: string) {
  assert.equal(x.ok, false, `${label}: must not look like a successful sign-in`);
  assert.equal(x.reachedPassport, false, `${label}: passport must not run`);
  assert.equal(x.loc.pathname, "/login", label);
  assert.ok(!/token|secret|stack|error:/i.test(x.loc.search.replace("error=google-auth-failed", "")), `${label}: nothing sensitive in the redirect`);
  assert.equal(x.setCookies.some((c) => c.startsWith("auth_token=")), false, `${label}: no auth_token Set-Cookie at all`);
  assert.equal(jar.auth(), jarBefore, `${label}: the browser's existing session is untouched`);
}

test("1. MISSING state: refused, no auth_token (the login-CSRF attack: attacker's authorization code delivered to a victim browser)", async () => {
  const victim = new Jar();
  assertRefused(await callback(victim, null), null, victim, "missing");
});

test("2. FORGED state (well-formed, never issued): refused", async () => {
  const victim = new Jar();
  for (const s of ["F".repeat(32), "short", "x".repeat(200), "<script>", ""]) assertRefused(await callback(victim, s), null, victim, `forged ${s.slice(0, 10)}`);
});

test("3. EXPIRED flow cookie: refused even if the browser still presents it", async () => {
  const jar = new Jar();
  const { state } = await begin(jar, N1, "/a");
  const realNow = Date.now;
  Date.now = () => realNow() + 11 * 60_000;
  try { assertRefused(await callback(jar, state), null, jar, "expired"); } finally { Date.now = realNow; }
});

test("4. TAMPERED flow cookie (payload edited / MAC edited): refused", async () => {
  for (const mutate of [
    (v: string) => `${Buffer.from(JSON.stringify({ d: "/evil", c: N2, t: Date.now() })).toString("base64url")}.${v.split(".")[1]}`,
    (v: string) => `${v.split(".")[0]}.${"A".repeat(v.split(".")[1].length)}`,
    () => "garbage",
  ]) {
    const jar = new Jar();
    const { state } = await begin(jar, N1, "/a");
    const c = [...jar.cookies.values()].find((x) => x.name.startsWith("oauth_flow_"))!;
    c.value = mutate(c.value);
    assertRefused(await callback(jar, state), null, jar, "tampered");
  }
});

test("5. UNKNOWN flow id: a cookie exists for another flow but not for this state: refused, and the other flow is untouched", async () => {
  const jar = new Jar();
  const real = await begin(jar, N1, "/a");
  assertRefused(await callback(jar, "U".repeat(32)), null, jar, "unknown");
  const ok = await callback(jar, real.state);
  assert.equal(ok.ok, true, "the legitimate flow still completes");
});

test("6. STATE ISSUED TO A DIFFERENT BROWSER: attacker starts a flow; the victim browser (no cookie) is sent the callback: refused, victim gets no session", async () => {
  const attacker = new Jar();
  const { state } = await begin(attacker, N1, "/a");
  const victim = new Jar();
  assertRefused(await callback(victim, state), null, victim, "cross-browser");
  assert.equal(victim.auth(), null);
  // a victim who is ALREADY signed in as someone else keeps that session
  victim.cookies.set("auth_token|/", { name: "auth_token", value: "victim-session", path: "/", expires: Infinity });
  assertRefused(await callback(victim, state), "victim-session", victim, "cross-browser existing session");
});

test("7. REPLAY: a completed flow cannot be used again -- even when the cookie is replayed (server-side single use, not only cookie clearing)", async () => {
  const jar = new Jar();
  const { state } = await begin(jar, N1, "/a");
  const saved = [...jar.cookies.values()].find((x) => x.name.startsWith("oauth_flow_"))!;
  const first = await callback(jar, state);
  assert.equal(first.ok, true);
  assert.equal(jar.cookies.size > 0 && [...jar.cookies.values()].some((c) => c.name.startsWith("oauth_flow_")), false, "cookie cleared");
  const replayJar = new Jar();
  replayJar.cookies.set(`${saved.name}|${saved.path}`, { ...saved, expires: Infinity }); // an attacker/extension re-injecting the saved cookie
  assertRefused(await callback(replayJar, state), null, replayJar, "replayed");
});

test("8. VALID login flow: succeeds, issues auth_token, echoes ITS nonce and returns to ITS destination", async () => {
  const jar = new Jar();
  const { state, prompt } = await begin(jar, N1, "/services/catering/provider?tab=menu#billing");
  assert.equal(prompt, null, "login keeps the existing (no forced account chooser) behaviour");
  const x = await callback(jar, state);
  assert.equal(x.ok, true);
  assert.equal(x.reachedPassport, true);
  assert.equal(x.loc.searchParams.get("oauth_state"), N1);
  assert.equal(x.loc.pathname, "/services/catering/provider");
  assert.equal(x.loc.hash, "#billing");
  assert.ok(jar.auth());
});

test("9. VALID signup flow: initiation keeps prompt=select_account; the callback is validated exactly like login; a signup callback without a flow is refused", async () => {
  const jar = new Jar();
  const { state, prompt } = await begin(jar, N1, "/welcome", "/api/auth/google/signup");
  assert.equal(prompt, "select_account");
  assert.ok(state && [...jar.cookies.values()].some((c) => c.name === `oauth_flow_${state}`), "signup creates a browser-bound flow");
  const x = await callback(jar, state);
  assert.equal(x.ok, true);
  assert.equal(x.loc.pathname, "/welcome");
  assert.ok(jar.auth());
  const victim = new Jar();
  const attacker = await begin(new Jar(), N1, "/", "/api/auth/google/signup");
  assertRefused(await callback(victim, attacker.state), null, victim, "signup cross-browser");
});

test("10. CONCURRENT logins, callbacks in EITHER order, each with its own destination; one callback never consumes the other", async () => {
  for (const order of [[0, 1], [1, 0]]) {
    const jar = new Jar();
    const flows = [await begin(jar, N1, "/a"), await begin(jar, N2, "/b")];
    const out = [] as Awaited<ReturnType<typeof callback>>[];
    for (const i of order) out[i] = await callback(jar, flows[i].state);
    assert.deepEqual([out[0].loc.pathname, out[0].loc.searchParams.get("oauth_state")], ["/a", N1]);
    assert.deepEqual([out[1].loc.pathname, out[1].loc.searchParams.get("oauth_state")], ["/b", N2]);
  }
});

test("a REFUSED callback does not consume or invalidate a pending legitimate flow, and a Google-denied valid flow ends that flow only", async () => {
  const jar = new Jar();
  const f1 = await begin(jar, N1, "/a");
  const f2 = await begin(jar, N2, "/b");
  assertRefused(await callback(jar, "Z".repeat(32)), null, jar, "probe");
  denied = true;
  const failed = await callback(jar, f1.state);
  assert.equal(failed.ok, false);
  assert.equal(failed.reachedPassport, true, "a valid flow reaches Google verification");
  assert.equal(jar.auth(), null);
  assert.equal((await callback(jar, f2.state)).ok, true);
});

test("13. rejected callbacks never issue OR replace auth_token across the whole matrix", async () => {
  const jar = new Jar();
  jar.cookies.set("auth_token|/", { name: "auth_token", value: "existing", path: "/", expires: Infinity });
  const attacker = await begin(new Jar(), N1, "/");
  for (const s of [null, "", "F".repeat(32), attacker.state]) {
    const x = await callback(jar, s);
    assert.equal(x.setCookies.some((c) => c.startsWith("auth_token=")), false);
  }
  assert.equal(jar.auth(), "existing");
});
