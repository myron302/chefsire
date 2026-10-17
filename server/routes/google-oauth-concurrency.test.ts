/**
 * Stability Phase 2C (Codex P2, server half of concurrent OAuth): every Google sign-in needs its OWN correlated state.
 * Real auth router + a real browser-like cookie jar (name + path keyed, Max-Age=0 deletes) -- two tabs share ONE jar, exactly as in a browser.
 * Google is replaced by a stub strategy that, like Google, echoes the `state` it was given on the callback.
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

let failNextCallback = false;
class FakeGoogle extends (Strategy as any) {
  name = "google";
  authenticate(req: any, options: any = {}) {
    if (String(req.path).endsWith("/callback")) {
      if (failNextCallback || req.query.error) { failNextCallback = false; return (this as any).fail(403); }
      return (this as any).success({ id: "g-user", email: "g@example.test", username: "g", authVersion: 1 });
    }
    const u = new URL("https://accounts.google.test/o/oauth2/auth");
    if (options.state) u.searchParams.set("state", options.state); // passport-oauth2 forwards a string `state` verbatim
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

/** A browser cookie jar: keyed by name+path, honours Path scoping, Max-Age=0 and Max-Age expiry. */
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
      if (value === "" || (maxAge !== null && maxAge <= 0) || (a.expires && Date.parse(a.expires) <= this.now)) this.cookies.delete(key);
      else this.cookies.set(key, { name, value, path, expires: maxAge !== null ? this.now + maxAge * 1000 : Infinity });
    }
  }
  header(path: string) {
    return [...this.cookies.values()].filter((c) => c.expires > this.now && path.startsWith(c.path)).map((c) => `${c.name}=${c.value}`).join("; ");
  }
  has(prefix: string) { return [...this.cookies.values()].some((c) => c.name.startsWith(prefix)); }
  async get(path: string) {
    const pathOnly = path.split("?")[0];
    const r = await fetch(base + path, { redirect: "manual", headers: { cookie: this.header(pathOnly) } });
    this.store(r);
    return r;
  }
}

const N1 = "AAAAAAAAAAAAAAAAAAAAAAAA", N2 = "BBBBBBBBBBBBBBBBBBBBBBBB", N3 = "CCCCCCCCCCCCCCCCCCCCCCCC";
/** Tab starts Google sign-in; returns the `state` Google will echo back. */
async function begin(jar: Jar, nonce: string | null, next?: string) {
  const q = [nonce ? `client_state=${nonce}` : "", next ? `next=${encodeURIComponent(next)}` : ""].filter(Boolean).join("&");
  const r = await jar.get(`/api/auth/google${q ? `?${q}` : ""}`);
  assert.equal(r.status, 302);
  return new URL(r.headers.get("location")!).searchParams.get("state");
}
async function finish(jar: Jar, state: string | null) {
  const r = await jar.get(`/api/auth/google/callback${state ? `?state=${encodeURIComponent(state)}&code=x` : "?code=x"}`);
  const loc = new URL(r.headers.get("location")!, "https://x.test");
  return { r, loc, ok: loc.searchParams.get("google-login") === "success", nonce: loc.searchParams.get("oauth_state") };
}

test("two tabs, callbacks in order 1 then 2: each callback gets ITS OWN nonce and destination", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/services/catering/provider?tab=menu");
  const s2 = await begin(jar, N2, "/recipes/9#top");
  assert.ok(s1 && s2 && s1 !== s2, "each flow has its own correlation id");
  const a = await finish(jar, s1);
  assert.equal(a.nonce, N1);
  assert.equal(a.loc.pathname, "/services/catering/provider");
  assert.equal(a.loc.searchParams.get("tab"), "menu");
  const b = await finish(jar, s2);
  assert.equal(b.nonce, N2, "the second callback still finds its state after the first completed");
  assert.equal(b.loc.pathname, "/recipes/9");
  assert.equal(b.loc.hash, "#top");
});

test("callbacks in order 2 then 1", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/a");
  const s2 = await begin(jar, N2, "/b");
  const b = await finish(jar, s2);
  const a = await finish(jar, s1);
  assert.deepEqual([a.nonce, a.loc.pathname, b.nonce, b.loc.pathname], [N1, "/a", N2, "/b"]);
});

test("first callback FAILS (Google denied) while the second succeeds; the failure does not consume the other flow", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/a");
  const s2 = await begin(jar, N2, "/b");
  failNextCallback = true;
  const a = await finish(jar, s1);
  assert.equal(a.ok, false);
  assert.equal(a.r.headers.getSetCookie().some((c) => c.startsWith("auth_token=") && !c.startsWith("auth_token=;")), false, "no session on a failed flow");
  const b = await finish(jar, s2);
  assert.equal(b.ok, true);
  assert.equal(b.nonce, N2);
  assert.equal(b.loc.pathname, "/b");
});

test("second callback fails while the first succeeds", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/a");
  const s2 = await begin(jar, N2, "/b");
  const a = await finish(jar, s1);
  assert.equal(a.nonce, N1);
  failNextCallback = true;
  assert.equal((await finish(jar, s2)).ok, false);
});

test("both succeed, then replay of either state yields NO nonce and NO destination (single use)", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/a");
  const s2 = await begin(jar, N2, "/b");
  await finish(jar, s1); await finish(jar, s2);
  for (const s of [s1, s2]) {
    const again = await finish(jar, s);
    assert.equal(again.nonce, null);
    assert.equal(again.loc.pathname, "/");
  }
});

test("an abandoned flow (never completes) does not affect a later one", async () => {
  const jar = new Jar();
  await begin(jar, N1, "/abandoned");
  const s2 = await begin(jar, N2, "/b");
  const b = await finish(jar, s2);
  assert.deepEqual([b.nonce, b.loc.pathname], [N2, "/b"]);
});

test("forged / missing / malformed / unknown state: no nonce echoed, no destination, never another flow's data", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/secret");
  for (const bad of [null, "", "short", "x".repeat(200), "<script>", "Z".repeat(32), s1!.slice(0, -1) + (s1!.endsWith("A") ? "B" : "A")]) {
    const r = await finish(jar, bad);
    assert.equal(r.nonce, null, String(bad));
    assert.equal(r.loc.pathname, "/", String(bad));
  }
  // and the legitimate flow is untouched by those probes
  const ok = await finish(jar, s1);
  assert.deepEqual([ok.nonce, ok.loc.pathname], [N1, "/secret"]);
});

test("expired flow is rejected (cookie lifetime and embedded timestamp)", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/a");
  const realNow = Date.now;
  Date.now = () => realNow() + 11 * 60_000;
  try {
    jar.now = Date.now(); // the browser drops the expired cookie ...
    const dropped = await finish(jar, s1);
    assert.equal(dropped.nonce, null);
    // ... and even a client that still presents the cookie is refused by the server-side timestamp
    const s2 = await begin(jar, N2, "/b");
    Date.now = () => realNow() + 22 * 60_000;
    const keep = new Jar(); keep.now = realNow(); keep.cookies = new Map(jar.cookies); for (const c of keep.cookies.values()) c.expires = Infinity;
    assert.equal((await finish(keep, s2)).nonce, null);
  } finally { Date.now = realNow; }
});

test("a tampered cookie body (state id intact) is rejected; a cookie copied under another state id is rejected", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/a");
  const s2 = await begin(jar, N2, "/b");
  const c1 = [...jar.cookies.values()].find((c) => c.name.endsWith(s1!))!;
  const c2 = [...jar.cookies.values()].find((c) => c.name.endsWith(s2!))!;
  const [body, mac] = c1.value.split(".");
  c1.value = `${Buffer.from(JSON.stringify({ d: "/evil", c: N3, t: Date.now() })).toString("base64url")}.${mac}`;
  assert.equal((await finish(jar, s1)).nonce, null);
  c2.value = c2.value; // untouched
  const swapped = new Jar();
  swapped.cookies.set("x", { name: `oauth_flow_${s1}`, value: c2.value, path: c2.path, expires: Infinity });
  assert.equal((await finish(swapped, s1)).nonce, null, "a payload minted for another flow does not verify under this flow id");
});

test("initiation without client_state / with a bad next is harmless; the cookie count stays bounded", async () => {
  const jar = new Jar();
  const s = await begin(jar, null, "//evil.example");
  const r = await finish(jar, s);
  assert.equal(r.nonce, null);
  assert.equal(r.loc.pathname, "/");
  for (let i = 0; i < 30; i++) await begin(jar, N1, "/x");
  assert.ok([...jar.cookies.values()].filter((c) => c.name.startsWith("oauth_flow_")).length <= 8);
});

test("account switching: a completed flow's session cookie is replaced by the next completed flow; nothing from a flow leaks into another", async () => {
  const jar = new Jar();
  const s1 = await begin(jar, N1, "/a");
  const a = await finish(jar, s1);
  assert.ok(a.r.headers.getSetCookie().some((c) => c.startsWith("auth_token=") && !c.startsWith("auth_token=;")));
  const s2 = await begin(jar, N2, "/b");
  const b = await finish(jar, s2);
  assert.deepEqual([b.nonce, b.loc.pathname], [N2, "/b"]);
  assert.equal(jar.has("oauth_flow_"), false, "all flows consumed");
});
