/**
 * Stability Phase 2C -- Google OAuth replay state must not be an availability weakness (Codex P1 on 43672d9).
 * Real auth router + real HTTP + browser-like cookie jars. Every client gets its own address (X-Forwarded-For, trust proxy on), exactly like a botnet or
 * ordinary users on different networks. Google is a local stub: code "bad" = Google rejects it, "slow" = verification takes a while, "db" = database down.
 * Nothing here talks to Google or to any real database.
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
const flowLib = await import("../lib/oauth-flow");

let completions = 0;
let slowGate: Promise<void> = Promise.resolve();
class FakeGoogle extends (Strategy as any) {
  name = "google";
  authenticate(req: any, options: any = {}) {
    if (String(req.path).endsWith("/callback")) {
      completions++;
      const code = String(req.query.code ?? "");
      const self = this as any;
      const run = async () => {
        if (code === "slow") await slowGate;
        if (code === "bad") return self.fail(403);
        if (code === "db") return self.error(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" }));
        return self.success({ id: "user-1", email: "u@example.test", username: "u", authVersion: 1 });
      };
      void run();
      return;
    }
    const u = new URL("https://accounts.google.test/o/oauth2/auth");
    if (options.state) u.searchParams.set("state", options.state);
    if (options.prompt) u.searchParams.set("prompt", options.prompt);
    (this as any).redirect(u.toString());
  }
}
passport.use("google", new FakeGoogle() as any);

const app = express();
app.set("trust proxy", true);
app.use(cookieParser());
app.use(passport.initialize());
app.use("/api", authRouter);
const server = http.createServer(app);
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => { server.close(); server.closeAllConnections?.(); });

let ipCounter = 0;
const nextIp = () => { ipCounter++; return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`; };

class Jar {
  cookies = new Map<string, { name: string; value: string; path: string }>();
  constructor(public ip: string = nextIp()) {}
  store(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq), value = pair.slice(eq + 1);
      const a = Object.fromEntries(attrs.map((x) => { const i = x.indexOf("="); return i < 0 ? [x.toLowerCase(), ""] : [x.slice(0, i).toLowerCase(), x.slice(i + 1)]; }));
      const path = a.path ?? "/";
      if (value === "" || (a["max-age"] !== undefined && Number(a["max-age"]) <= 0)) this.cookies.delete(`${name}|${path}`);
      else this.cookies.set(`${name}|${path}`, { name, value, path });
    }
  }
  header(path: string) { return [...this.cookies.values()].filter((c) => path.startsWith(c.path)).map((c) => `${c.name}=${c.value}`).join("; "); }
  auth() { return [...this.cookies.values()].find((c) => c.name === "auth_token")?.value ?? null; }
  async get(path: string) {
    const r = await fetch(base + path, { redirect: "manual", headers: { cookie: this.header(path.split("?")[0]), "x-forwarded-for": this.ip } });
    this.store(r);
    await r.arrayBuffer();
    return r;
  }
}
const N1 = "AAAAAAAAAAAAAAAAAAAAAAAA", N2 = "BBBBBBBBBBBBBBBBBBBBBBBB";
async function begin(jar: Jar, nonce: string | null = N1, next?: string, route = "/api/auth/google") {
  const q = [nonce ? `client_state=${nonce}` : "", next ? `next=${encodeURIComponent(next)}` : ""].filter(Boolean).join("&");
  const r = await jar.get(`${route}${q ? `?${q}` : ""}`);
  assert.equal(r.status, 302, `initiation ${r.status}`);
  return new URL(r.headers.get("location")!).searchParams.get("state")!;
}
async function callback(jar: Jar, state: string | null, code = "good") {
  const r = await jar.get(`/api/auth/google/callback?code=${code}${state === null ? "" : `&state=${encodeURIComponent(state)}`}`);
  const loc = new URL(r.headers.get("location") ?? "/", "https://app.test");
  return { r, loc, status: r.status, ok: loc.searchParams.get("google-login") === "success", issued: r.headers.getSetCookie().some((c) => c.startsWith("auth_token=") && !c.startsWith("auth_token=;")) };
}
const reset = () => { flowLib.resetFlowStateForTests(); slowGate = Promise.resolve(); };
const legitLogin = async () => { const j = new Jar(); const s = await begin(j, N1, "/home"); return callback(j, s); };

test("EXHAUSTION: >10,000 incomplete callbacks (valid flows, Google rejects every code) cannot disable Google login for unrelated users", async () => {
  reset();
  for (let i = 0; i < 10_500; i++) {
    const attacker = new Jar(); // a different source each time: the per-IP limiter is NOT what protects the shared state
    const state = await begin(attacker, N1);
    const x = await callback(attacker, state, "bad");
    assert.equal(x.issued, false);
  }
  const sizes = flowLib.flowStateSizes();
  assert.ok(sizes.spentFailed <= flowLib.SPENT_FAILED_MAX, `failure tombstones are capped (${sizes.spentFailed})`);
  assert.equal(sizes.spentOk, 0, "failed callbacks leave no durable success record");
  assert.equal(sizes.inFlight, 0, "no claim is leaked");
  const legit = await legitLogin();
  assert.equal(legit.ok, true, "an unrelated user can still sign in after the flood");
  assert.equal(legit.issued, true);
  assert.equal(legit.loc.pathname, "/home");
});

test("repeated failures do not poison the SAME user's next attempt (a new initiation is a new flow)", async () => {
  reset();
  const jar = new Jar();
  for (let i = 0; i < 5; i++) assert.equal((await callback(jar, await begin(jar), "bad")).issued, false);
  const s = await begin(jar);
  assert.equal((await callback(jar, s)).issued, true);
});

test("CONCURRENT callbacks for ONE flow: exactly one issues a session", async () => {
  reset();
  let release!: () => void;
  slowGate = new Promise<void>((r) => { release = r; });
  const jar = new Jar();
  const state = await begin(jar, N1, "/a");
  const results = Promise.all([callback(jar, state, "slow"), callback(jar, state, "slow"), callback(jar, state, "slow")]);
  await new Promise((r) => setTimeout(r, 150));
  release();
  const out = await results;
  assert.equal(out.filter((x) => x.issued).length, 1, "only one callback may sign in");
  assert.equal(out.filter((x) => x.ok).length, 1);
  assert.equal(flowLib.flowStateSizes().inFlight, 0);
});

test("REPLAY after success is refused, also with a re-injected cookie and a fresh code", async () => {
  reset();
  const jar = new Jar();
  const state = await begin(jar, N1, "/a");
  const saved = [...jar.cookies.values()].find((c) => c.name.startsWith("oauth_flow_"))!;
  assert.equal((await callback(jar, state)).issued, true);
  const replay = new Jar(jar.ip);
  replay.cookies.set(`${saved.name}|${saved.path}`, saved);
  const again = await callback(replay, state, "good");
  assert.equal(again.issued, false);
  assert.equal(again.loc.pathname, "/login");
});

test("REPLAY after a FAILED callback is refused (tombstoned), also with a re-injected cookie and a fresh good code", async () => {
  reset();
  const jar = new Jar();
  const state = await begin(jar, N1, "/a");
  const saved = [...jar.cookies.values()].find((c) => c.name.startsWith("oauth_flow_"))!;
  assert.equal((await callback(jar, state, "bad")).issued, false);
  const replay = new Jar(jar.ip);
  replay.cookies.set(`${saved.name}|${saved.path}`, saved);
  assert.equal((await callback(replay, state, "good")).issued, false);
});

test("when failure tombstones are FULL: nothing is evicted, nothing is rejected -- new flows still work and earlier tombstones still hold", async () => {
  reset();
  const first = new Jar();
  const firstState = await begin(first);
  const firstCookie = [...first.cookies.values()].find((c) => c.name.startsWith("oauth_flow_"))!;
  await callback(first, firstState, "bad"); // tombstoned
  for (let i = 0; i < flowLib.SPENT_FAILED_MAX; i++) flowLib.finishFlow(`filler-${i}`.padEnd(20, "x"), "failure");
  assert.equal(flowLib.flowStateSizes().spentFailed, flowLib.SPENT_FAILED_MAX);
  assert.equal((await legitLogin()).issued, true, "login stays available with a full tombstone table");
  const replay = new Jar(first.ip);
  replay.cookies.set(`${firstCookie.name}|${firstCookie.path}`, firstCookie);
  assert.equal((await callback(replay, firstState, "good")).issued, false, "an unexpired tombstone was not evicted to make room");
  reset();
});

test("SUCCESS record table full of UNEXPIRED entries: fail closed (no session), never evict; expiry restores service", async () => {
  reset();
  const t0 = Date.now();
  for (let i = 0; i < flowLib.SPENT_OK_MAX; i++) flowLib.finishFlow(`ok-${i}`.padEnd(20, "x"), "success", t0);
  assert.equal(flowLib.flowStateSizes().spentOk, flowLib.SPENT_OK_MAX);
  const full = await legitLogin();
  assert.equal(full.issued, false);
  assert.equal(full.loc.searchParams.get("error"), "service-unavailable");
  assert.equal(flowLib.claimFlow("ok-0".padEnd(20, "x"), t0 + 1000), "spent", "records are not evicted while unexpired");
  flowLib.releaseFlow("ok-0".padEnd(20, "x"));
  // after the TTL the same table accepts new entries again
  assert.equal(flowLib.finishFlow("later".padEnd(20, "x"), "success", t0 + 11 * 60_000), true);
  reset();
});

test("a database outage during verification issues no session and the next attempt (new flow) works", async () => {
  reset();
  const jar = new Jar();
  const down = await callback(jar, await begin(jar), "db");
  assert.equal(down.issued, false);
  assert.equal(down.loc.searchParams.get("error"), "service-unavailable");
  assert.equal((await callback(jar, await begin(jar))).issued, true);
});

test("CROSS-BROWSER callback (state from another browser) is refused and consumes nothing", async () => {
  reset();
  const attacker = new Jar();
  const state = await begin(attacker);
  const victim = new Jar();
  const x = await callback(victim, state);
  assert.equal(x.issued, false);
  assert.equal(flowLib.flowStateSizes().spentFailed + flowLib.flowStateSizes().spentOk, 0, "a refused (uncorrelated) callback leaves no shared state");
  assert.equal((await callback(attacker, state)).issued, true, "the owner's flow is untouched");
});

test("MULTIPLE tabs + signup: independent flows complete in either order with their own destinations", async () => {
  reset();
  const jar = new Jar();
  const a = await begin(jar, N1, "/a");
  const b = await begin(jar, N2, "/b", "/api/auth/google/signup");
  const rb = await callback(jar, b);
  const ra = await callback(jar, a);
  assert.deepEqual([ra.loc.pathname, ra.loc.searchParams.get("oauth_state"), rb.loc.pathname, rb.loc.searchParams.get("oauth_state")], ["/a", N1, "/b", N2]);
});

test("RATE LIMIT: one address is throttled, other users are not; the limiter keys per IP so an attacker cannot block others", async () => {
  reset();
  const noisy = new Jar();
  let throttled = 0;
  for (let i = 0; i < 130; i++) {
    const r = await noisy.get("/api/auth/google?client_state=" + N1);
    if (r.status === 429) throttled++;
  }
  assert.ok(throttled > 0, "the noisy address was throttled");
  assert.equal((await legitLogin()).issued, true, "everyone else is unaffected");
});

test("memory stays bounded and no claim leaks after a flood of garbage callbacks (no valid flow at all)", async () => {
  reset();
  for (let i = 0; i < 300; i++) await callback(new Jar(), i % 2 ? "G".repeat(32) : null, "bad");
  assert.deepEqual(flowLib.flowStateSizes(), { inFlight: 0, spentOk: 0, spentFailed: 0 });
});
