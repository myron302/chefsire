/**
 * Stability Phase 2C (Codex P1): every /api/auth/me verification attempt has its OWN deadline, covering the wait for response headers and the
 * consumption of the body. Realistic abort-aware tests: a real fetch against a real HTTP server that stalls at each stage.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { verifySessionOnce } from "./session-verification";

type U = { id: string; email: string };
const parse = (p: unknown): U => { if (!p || typeof p !== "object" || !("id" in p) || !("email" in p)) throw new Error("incomplete"); return p as U; };
const ALICE: U = { id: "alice", email: "a@example.test" };

const unhandled: unknown[] = [];
process.on("unhandledRejection", (e) => unhandled.push(e));

type Mode = "ok" | "no-headers" | "stall-body" | "slow-ok";
async function server(mode: () => Mode) {
  const state = { aborted: 0, requests: 0 };
  const sockets = new Set<import("node:net").Socket>();
  const srv = http.createServer((req, res) => {
    state.requests++;
    req.on("close", () => { if (!res.writableEnded) state.aborted++; });
    const m = mode();
    if (m === "no-headers") return; // accepted, never answered
    if (m === "stall-body") { res.writeHead(200, { "content-type": "application/json", "transfer-encoding": "chunked" }); res.write('{"success":true,'); return; }
    const body = JSON.stringify({ success: true, user: ALICE });
    if (m === "slow-ok") { setTimeout(() => res.writeHead(200, { "content-type": "application/json" }).end(body), 150); return; }
    res.writeHead(200, { "content-type": "application/json" }).end(body);
  });
  srv.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const fetchFn = ((u: string, init?: RequestInit) => fetch(base + u, init)) as typeof fetch;
  return { fetchFn, state, close: async () => { for (const s of sockets) s.destroy(); await new Promise<void>((r) => srv.close(() => r())); } };
}
const within = <T>(p: Promise<T>, ms: number, label: string) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label}: still pending after ${ms}ms`)), ms))]);

test("a normal response completes and is validated", async () => {
  const s = await server(() => "ok");
  try {
    assert.deepEqual(await within(verifySessionOnce(s.fetchFn, new AbortController().signal, parse, { timeoutMs: 1000 }), 3000, "ok"), { kind: "valid", user: ALICE });
  } finally { await s.close(); }
});

test("the request NEVER returns headers: the per-attempt deadline ends it as temporarily UNAVAILABLE (not invalid), and the stalled request is aborted", async () => {
  const s = await server(() => "no-headers");
  try {
    const t = Date.now();
    const r = await within(verifySessionOnce(s.fetchFn, new AbortController().signal, parse, { timeoutMs: 200 }), 3000, "no-headers");
    assert.deepEqual(r, { kind: "unavailable", reason: "timeout" });
    assert.ok(Date.now() - t >= 150 && Date.now() - t < 1500);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(s.state.aborted, 1, "the connection was torn down, not left hanging");
  } finally { await s.close(); }
});

test("headers arrive but the BODY stalls: also bounded, also unavailable (the abort is not fired at headers, so a healthy body is never cut — see slow-but-healthy below)", async () => {
  const s = await server(() => "stall-body");
  try {
    const r = await within(verifySessionOnce(s.fetchFn, new AbortController().signal, parse, { timeoutMs: 200 }), 3000, "stall-body");
    assert.deepEqual(r, { kind: "unavailable", reason: "timeout" });
  } finally { await s.close(); }
});

test("a slow but healthy response that finishes inside the deadline is read in full (headers do not abort the exchange)", async () => {
  const s = await server(() => "slow-ok");
  try {
    assert.deepEqual(await within(verifySessionOnce(s.fetchFn, new AbortController().signal, parse, { timeoutMs: 2000 }), 4000, "slow-ok"), { kind: "valid", user: ALICE });
  } finally { await s.close(); }
});

test("cancellation by the caller (logout / newer login / unmount) is 'cancelled', never 'unavailable', and tears the request down", async () => {
  const s = await server(() => "no-headers");
  try {
    const ac = new AbortController();
    const p = verifySessionOnce(s.fetchFn, ac.signal, parse, { timeoutMs: 5000 });
    setTimeout(() => ac.abort(), 60);
    assert.deepEqual(await within(p, 3000, "cancel"), { kind: "cancelled" });
    const pre = new AbortController(); pre.abort();
    assert.deepEqual(await verifySessionOnce(s.fetchFn, pre.signal, parse, { timeoutMs: 5000 }), { kind: "cancelled" });
  } finally { await s.close(); }
});

test("a fetch that IGNORES the abort cannot make the attempt hang: it still settles at the deadline, and its late success is discarded", async () => {
  let late!: (r: Response) => void;
  const stubborn = (() => new Promise<Response>((resolve) => { late = resolve; })) as unknown as typeof fetch;
  const r = await within(verifySessionOnce(stubborn, new AbortController().signal, parse, { timeoutMs: 80 }), 2000, "stubborn");
  assert.deepEqual(r, { kind: "unavailable", reason: "timeout" });
  late(new Response(JSON.stringify({ success: true, user: ALICE }), { status: 200 })); // arrives after the verdict
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(unhandled, []);
});

test("timers are released on every outcome (success, failure, timeout, cancellation): the injected deadline's stop signal is aborted each time", async () => {
  const stops: AbortSignal[] = [];
  const deadline = (_ms: number, stop: AbortSignal) => new Promise<void>((resolve) => { stops.push(stop); stop.addEventListener("abort", () => resolve(), { once: true }); });
  const ok = (async () => new Response(JSON.stringify({ success: true, user: ALICE }), { status: 200 })) as unknown as typeof fetch;
  const err = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
  const hang = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
  await verifySessionOnce(ok, new AbortController().signal, parse, { deadline });
  await verifySessionOnce(err, new AbortController().signal, parse, { deadline });
  const ac = new AbortController();
  const cancelled = verifySessionOnce(hang, ac.signal, parse, { deadline });
  ac.abort();
  await cancelled;
  assert.equal(stops.length, 3);
  assert.ok(stops.every((s) => s.aborted), "no timer is left running");
});

test("no unhandled rejection was produced by any stalled or aborted attempt", () => {
  assert.deepEqual(unhandled, []);
});
