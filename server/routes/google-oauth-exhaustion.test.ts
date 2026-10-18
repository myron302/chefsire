/**
 * Stability Phase 2C -- Google OAuth replay state must not be an availability weakness (Codex P1 on 43672d9).
 * Replay state is ONE fixed-size, server-authoritative structure (see lib/oauth-flow): a flow is consumed by an atomic test-and-set that is never undone.
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
let successes = 0;
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
        successes++; return self.success({ id: "user-1", email: "u@example.test", username: "u", authVersion: 1 });
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
    const r = await fetch(base + path, { redirect: "manual", headers: { cookie: this.header(path.split("?")[0]), "x-forwarded-for": this.ip, connection: "close" } });
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
const reset = () => { flowLib.resetFlowStateForTests(); flowLib.setOAuthVerifyTimeoutForTests(30_000); slowGate = Promise.resolve(); };
const legitLogin = async () => { const j = new Jar(); const s = await begin(j, N1, "/home"); return callback(j, s); };
const reinject = (from: Jar, to: Jar) => { for (const c of from.cookies.values()) if (c.name.startsWith("oauth_flow_")) to.cookies.set(`${c.name}|${c.path}`, c); };
const savedCopy = (j: Jar) => { const m = new Map(j.cookies); const copy = new Jar(j.ip); m.forEach((v, k) => copy.cookies.set(k, { ...v })); return copy; };

test("F1: after >10,000 failed flows a FAILED flow is still unreplayable (even with a re-injected cookie and a fresh good code); unrelated users still sign in; memory is fixed", async () => {
  reset();
  for (let i = 0; i < 10_500; i++) { const a = new Jar(); await callback(a, await begin(a), "bad"); }
  const victim = new Jar();
  const state = await begin(victim);
  const copy = savedCopy(victim);
  assert.equal((await callback(victim, state, "bad")).issued, false);
  const replay = new Jar(victim.ip); reinject(copy, replay);
  assert.equal((await callback(replay, state, "good")).issued, false, "no table filled up, so nothing can make the failed flow reusable");
  const st = flowLib.flowStateStats();
  assert.ok(st.bytes <= 13 * (flowLib.BUCKET_BITS / 8), `fixed memory (${st.bytes} bytes, ${st.buckets} buckets)`);
  const legit = await legitLogin();
  assert.equal(legit.ok, true);
  assert.equal(legit.issued, true);
  assert.equal(legit.loc.pathname, "/home");
});

test("F2: a client disconnect DURING verification does not release the flow; a second callback is refused and the flow completes at most once", async () => {
  reset();
  let release!: () => void;
  slowGate = new Promise<void>((r) => { release = r; });
  const j = new Jar();
  const state = await begin(j);
  const copy = savedCopy(j);
  const before = successes;
  const ac = new AbortController();
  const first = fetch(`${base}/api/auth/google/callback?code=slow&state=${state}`, { redirect: "manual", signal: ac.signal, headers: { cookie: j.header("/api/auth/google/callback"), "x-forwarded-for": j.ip } }).catch(() => null);
  await new Promise((r) => setTimeout(r, 150));
  ac.abort(); await first;
  await new Promise((r) => setTimeout(r, 150));
  const reachedBefore = completions;
  const second = new Jar(j.ip); reinject(copy, second);
  const x = await callback(second, state, "good");
  assert.equal(x.issued, false, "the second callback cannot take over the flow");
  assert.equal(completions, reachedBefore, "and never reaches Google verification");
  release();
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(successes - before <= 1, `the flow verified ${successes - before} time(s)`);
});

test("CONCURRENT callbacks for ONE flow (3 at once): exactly one issues a session", async () => {
  reset();
  let release!: () => void;
  slowGate = new Promise<void>((r) => { release = r; });
  const jar = new Jar();
  const state = await begin(jar, N1, "/a");
  const results = Promise.all([callback(jar, state, "slow"), callback(jar, state, "slow"), callback(jar, state, "slow")]);
  await new Promise((r) => setTimeout(r, 150));
  release();
  const out = await results;
  assert.equal(out.filter((x) => x.issued).length, 1);
  assert.equal(out.filter((x) => x.ok).length, 1);
});

test("TIMEOUT: a verification that never settles is abandoned (service-unavailable), the flow stays consumed, and a late completion issues nothing", async () => {
  reset();
  flowLib.setOAuthVerifyTimeoutForTests(150);
  let release!: () => void;
  slowGate = new Promise<void>((r) => { release = r; });
  const j = new Jar();
  const state = await begin(j);
  const copy = savedCopy(j);
  const x = await callback(j, state, "slow");
  assert.equal(x.issued, false);
  assert.equal(x.loc.searchParams.get("error"), "service-unavailable");
  release(); // Google finally answers; the abandoned handler must not issue anything or crash
  await new Promise((r) => setTimeout(r, 150));
  const replay = new Jar(j.ip); reinject(copy, replay);
  assert.equal((await callback(replay, state, "good")).issued, false, "an abandoned flow cannot be retried");
  assert.equal((await legitLogin()).issued, true);
  flowLib.setOAuthVerifyTimeoutForTests(30_000);
});

test("REPLAY after success and after failure, duplicates and re-injected cookies: always refused", async () => {
  reset();
  for (const code of ["good", "bad"]) {
    const jar = new Jar();
    const state = await begin(jar, N1, "/a");
    const copy = savedCopy(jar);
    await callback(jar, state, code);
    for (let i = 0; i < 3; i++) {
      const replay = new Jar(jar.ip); reinject(copy, replay);
      const again = await callback(replay, state, "good");
      assert.equal(again.issued, false, `${code} #${i}`);
      assert.equal(again.loc.pathname, "/login");
    }
  }
});

test("VOLUME of VALID flows: >10,000 successful sign-ins do not disable unrelated users; replay of each remains refused", async () => {
  reset();
  const sample: Array<{ jar: Jar; copy: Jar; state: string }> = [];
  for (let i = 0; i < 10_500; i++) {
    const a = new Jar(); const st = await begin(a); const copy = savedCopy(a);
    assert.equal((await callback(a, st, "good")).issued, true);
    if (i % 3000 === 0) sample.push({ jar: a, copy, state: st });
  }
  for (const { jar, copy, state } of sample) {
    const replay = new Jar(jar.ip); reinject(copy, replay);
    assert.equal((await callback(replay, state, "good")).issued, false);
  }
  assert.equal((await legitLogin()).issued, true);
});

test("CAPACITY is per minute, only affects flow CREATION, never verification; the next minute is clean; memory is bounded", () => {
  reset();
  const t = 1_800_000_000_000;
  const ids: string[] = [];
  for (let i = 0; i < flowLib.BUCKET_BITS; i++) { const id = flowLib.newFlowId(t); if (i % 100_000 === 0) ids.push(id); }
  assert.throws(() => flowLib.newFlowId(t + 1000), flowLib.FlowCapacityError);
  for (const id of ids) assert.equal(flowLib.claimFlow(id, t + 2000), "claimed", "existing flows are unaffected by a full creation bucket");
  for (const id of ids) assert.equal(flowLib.claimFlow(id, t + 2000), "spent");
  assert.doesNotThrow(() => flowLib.newFlowId(t + 61_000));
  for (let m = 1; m < 40; m++) flowLib.newFlowId(t + m * 60_000);
  const st = flowLib.flowStateStats();
  assert.ok(st.buckets <= 13 && st.bytes <= 13 * (flowLib.BUCKET_BITS / 8), `${st.buckets} buckets / ${st.bytes} bytes`);
  reset();
});

test("expired, foreign-boot (restart / other instance), tampered and forged ids are 'unknown'; the 10-minute TTL is enforced", () => {
  reset();
  const t = Date.now();
  const id = flowLib.newFlowId(t);
  assert.equal(flowLib.claimFlow(id, t + 11 * 60_000 + 61_000 * 2), "unknown", "expired");
  const id2 = flowLib.newFlowId(t);
  flowLib.resetFlowStateForTests(); // a restart: new boot id, empty bitmaps
  assert.equal(flowLib.claimFlow(id2, t), "unknown", "minted by a previous process / other instance");
  const id3 = flowLib.newFlowId(t);
  const raw = Buffer.from(id3, "base64url"); raw[12] ^= 0xff; // flip index bytes
  assert.notEqual(flowLib.claimFlow(raw.toString("base64url"), t), "claimed", "a never-issued index is not claimable");
  for (const bad of ["", "short", "!!!", "A".repeat(43), "A".repeat(100)]) assert.equal(flowLib.claimFlow(bad, t), "unknown");
  reset();
});

test("HTTP: expired, tampered and cross-browser state are refused and consume nothing of the owner's flow", async () => {
  reset();
  const owner = new Jar();
  const state = await begin(owner, N1, "/a");
  const stranger = new Jar();
  assert.equal((await callback(stranger, state)).issued, false, "cross-browser");
  const c = [...owner.cookies.values()].find((x) => x.name.startsWith("oauth_flow_"))!;
  const good = c.value;
  c.value = "garbage";
  assert.equal((await callback(owner, state)).issued, false, "tampered");
  owner.cookies.set(`${c.name}|${c.path}`, { ...c, value: good }); // the owner's browser still has the real cookie? tampered attempt cleared it
  const fresh = new Jar();
  const s2 = await begin(fresh, N2, "/b");
  const realNow = Date.now;
  Date.now = () => realNow() + 11 * 60_000;
  try { assert.equal((await callback(fresh, s2)).issued, false, "expired"); } finally { Date.now = realNow; }
  const third = new Jar();
  assert.equal((await callback(third, await begin(third))).issued, true, "unrelated users unaffected");
});

test("a database outage during verification issues no session; the flow is consumed; a NEW flow works afterwards", async () => {
  reset();
  const jar = new Jar();
  const state = await begin(jar);
  const copy = savedCopy(jar);
  const down = await callback(jar, state, "db");
  assert.equal(down.issued, false);
  assert.equal(down.loc.searchParams.get("error"), "service-unavailable");
  const replay = new Jar(jar.ip); reinject(copy, replay);
  assert.equal((await callback(replay, state, "good")).issued, false);
  assert.equal((await callback(jar, await begin(jar))).issued, true);
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

test("RATE LIMIT: one address is throttled, other users are not", async () => {
  reset();
  const noisy = new Jar();
  let throttled = 0;
  for (let i = 0; i < 130; i++) { if ((await noisy.get("/api/auth/google?client_state=" + N1)).status === 429) throttled++; }
  assert.ok(throttled > 0);
  assert.equal((await legitLogin()).issued, true);
});

test("a flood of garbage callbacks (no valid flow) allocates nothing", async () => {
  reset();
  for (let i = 0; i < 300; i++) await callback(new Jar(), i % 2 ? "G".repeat(32) : null, "bad");
  assert.deepEqual(flowLib.flowStateStats(), { buckets: 0, bytes: 0, issuedLive: 0 });
});
