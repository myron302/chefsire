import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { abortableSleep, classifySessionStatus, SESSION_RECHECK_DELAYS_MS, verifySessionOnce } from "./session-verification";

const parse = (p: unknown) => { if (!p || typeof p !== "object" || !("id" in p)) throw new Error("incomplete"); return p as { id: string }; };
const res = (status: number, body?: unknown) => async () => new Response(body === undefined ? "" : JSON.stringify(body), { status });

test("only the server's definitive 'no' (401/4xx) invalidates the session; outages never do", () => {
  assert.equal(classifySessionStatus(200), "valid");
  assert.equal(classifySessionStatus(401), "invalid");
  assert.equal(classifySessionStatus(403), "invalid");
  for (const status of [500, 502, 503, 504, 429, 408]) assert.equal(classifySessionStatus(status), "unavailable", String(status));
});

test("verifySessionOnce: one request, one answer, user taken from that same response", async () => {
  let calls = 0;
  const f = (async (...args: unknown[]) => { calls++; assert.equal((args[1] as RequestInit).credentials, "include"); return new Response(JSON.stringify({ success: true, user: { id: "u1" } }), { status: 200 }); }) as unknown as typeof fetch;
  const r = await verifySessionOnce(f, new AbortController().signal, parse);
  assert.deepEqual(r, { kind: "valid", user: { id: "u1" } });
  assert.equal(calls, 1);
});

test("verifySessionOnce: 401 invalid; 503/429/network unavailable; malformed 200 unavailable; abort cancelled", async () => {
  const sig = () => new AbortController().signal;
  assert.deepEqual(await verifySessionOnce(res(401) as never, sig(), parse), { kind: "invalid" });
  for (const status of [500, 503, 429, 408]) assert.deepEqual(await verifySessionOnce(res(status) as never, sig(), parse), { kind: "unavailable", reason: "status" });
  assert.deepEqual(await verifySessionOnce((async () => { throw new TypeError("Failed to fetch"); }) as never, sig(), parse), { kind: "unavailable", reason: "network" });
  assert.deepEqual(await verifySessionOnce(res(200, { success: true }) as never, sig(), parse), { kind: "unavailable", reason: "malformed" });
  assert.deepEqual(await verifySessionOnce((async () => new Response("<html>", { status: 200 })) as never, sig(), parse), { kind: "unavailable", reason: "malformed" });
  const ac = new AbortController(); ac.abort();
  assert.deepEqual(await verifySessionOnce((async () => { throw Object.assign(new Error("x"), { name: "AbortError" }); }) as never, ac.signal, parse), { kind: "cancelled" });
});

test("abortableSleep resolves on timeout and immediately on abort (no dangling timer)", async () => {
  const t = Date.now();
  await abortableSleep(20, new AbortController().signal);
  assert.ok(Date.now() - t >= 15);
  const ac = new AbortController();
  const p = abortableSleep(60_000, ac.signal);
  ac.abort();
  await p; // would hang the test if the timer were still the only way out
  await abortableSleep(60_000, ac.signal);
});

test("retry schedule is bounded: three delays, increasing", () => {
  assert.deepEqual([...SESSION_RECHECK_DELAYS_MS], [5000, 15000, 45000]);
});

test("UserProvider delegates every session decision to the controller: no direct /api/auth/me fetch, no direct localStorage user writes", () => {
  const src = fs.readFileSync(new URL("../contexts/UserContext.tsx", import.meta.url), "utf8");
  assert.match(src, /createSessionController/);
  assert.ok(!/fetch\(\s*['"`]\/api\/auth\/me/.test(src), "the only reader of /api/auth/me is verifySessionOnce");
  assert.ok(!/localStorage\.(setItem|removeItem)\(\s*["']user["']/.test(src), "the controller owns the stored user");
  assert.ok(!/fetch\(\s*["']\/api\/auth\/(login|logout)/.test(src));
  assert.match(src, /controller\.dispose\(\)/, "unmount aborts everything");
  assert.match(src, /retrySession/);
  assert.match(src, /showOutageNotice/);
});
