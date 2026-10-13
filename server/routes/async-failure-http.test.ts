/**
 * Stability Phase 2B: the REAL server/app.ts under database and provider failure, with the app-wide async error forwarding.
 *
 * Before the change (verified on main 8785ca5 with async-failure-app-child.ts): `GET /api/dm/threads` with a failing database rejected
 * inside an async handler, hit `unhandledRejection`, and the process exited(1) with no response sent. These tests pin the corrected
 * behaviour and the payment/auth contracts that must not move.
 */
import "../test-support/accept-test-sessions";
import { testAuthHeader } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://app:secret@127.0.0.1:9/chefsire_unreachable_test";
process.env.SQUARE_ENV = "sandbox";
process.env.SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY = "test-signature-key";
process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL = "https://chefsire.test/api/catering/webhooks/square";

const SECRET = 'connect ECONNREFUSED ep-private-host.neon.tech:5432 role "neondb_owner" password authentication failed';
const { db } = await import("../db");
const { default: app } = await import("../app");

let dbCalls = 0;
const chain: any = new Proxy(function () {}, {
  get: (_t, p) => (p === "then" ? (_res: any, rej: any) => { dbCalls++; rej(new Error(SECRET)); } : () => chain),
  apply: () => chain,
});
for (const m of ["select", "insert", "update", "delete"]) (db as any)[m] = () => chain;
(db as any).execute = async () => { dbCalls++; throw new Error(SECRET); };

const unhandled: unknown[] = [];
process.on("unhandledRejection", (reason) => { unhandled.push(reason); });
const logged: unknown[][] = [];
const realError = console.error;
console.error = (...a: unknown[]) => { logged.push(a); };

const server = http.createServer(app);
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => { console.error = realError; server.close(); server.closeAllConnections?.(); });

async function call(method: string, path: string, init: { headers?: Record<string, string>; body?: string } = {}) {
  const r = await fetch(base + path, { method, headers: init.headers, body: init.body });
  const text = await r.text();
  let json: any; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, text, json };
}
const json = { "content-type": "application/json" };
const asUser = () => testAuthHeader("user-1");
function assertSafe(text: string) {
  for (const s of ["ECONNREFUSED", "neon.tech", "neondb_owner", "password authentication", "5432", "secret@", "SELECT", "select "]) assert.ok(!text.includes(s), `leaked ${s}: ${text}`);
  assert.ok(!/at .*\.(ts|js):\d+/.test(text), "stack trace leaked");
}
function sign(body: string, key = "test-signature-key") {
  const signature = createHmac("sha256", key).update(process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL! + body).digest("base64");
  return { ...json, "x-square-hmacsha256-signature": signature };
}

// Handlers the Phase 2B audit classified as unguarded/partial and that really await the database.
const FAILING_DB_ROUTES: Array<[string, string, unknown?]> = [
  ["GET", "/api/dm/threads"],
  ["GET", "/api/dm/threads/t-1/messages"],
  ["POST", "/api/dm/threads/t-1/read", {}],
  ["GET", "/api/follows/requests/incoming"],
  ["DELETE", "/api/follows/user-2"],
  ["POST", "/api/follows/requests/r-1/accept", {}],
  ["GET", "/api/meal-planner/week/shared/tok/comments"],
];

for (const [method, path, body] of FAILING_DB_ROUTES) {
  test(`database failure in ${method} ${path}: safe generic 500, no driver detail, process keeps serving`, async () => {
    const res = await call(method, path, { headers: { ...asUser(), ...(body === undefined ? {} : json) }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.ok([500, 503].includes(res.status), `${res.status} ${res.text}`);
    assertSafe(res.text);
    assert.equal((await call("GET", "/healthz")).status, 200);
    assert.equal(unhandled.length, 0);
  });
}

test("error logged once per failed request (no duplicate logging by the forwarding layer)", async () => {
  logged.length = 0;
  await call("GET", "/api/dm/threads", { headers: asUser() });
  assert.equal(logged.filter((l) => l[0] === "[ERROR]").length, 1);
});

test("auth failure comes BEFORE the protected handler: 401, database never touched", async () => {
  dbCalls = 0;
  for (const [m, p] of [["GET", "/api/dm/threads"], ["GET", "/api/follows/requests/incoming"], ["POST", "/api/subscriptions/upgrade"]] as const) {
    const res = await call(m, p, { headers: json, body: m === "POST" ? "{}" : undefined });
    assert.equal(res.status, 401, `${m} ${p}`);
  }
  assert.equal(dbCalls, 0);
  const bad = await call("GET", "/api/dm/threads", { headers: { authorization: "Bearer not-a-token" } });
  assert.equal(bad.status, 401);
  assert.equal(dbCalls, 0);
});

test("intentional statuses unchanged: unknown API path 404; static 503 payment surfaces", async () => {
  assert.equal((await call("GET", "/api/definitely-not-a-route")).status, 404);
  assert.equal((await call("GET", "/api/square/locations")).status, 503);
  const payout = await call("GET", "/api/payouts/pending-balance", { headers: asUser() });
  assert.equal(payout.status, 503);
  assert.equal(payout.json.code, "PAYOUT_ELIGIBILITY_UNVERIFIABLE");
});

// ---- payments: the financial-integrity contracts ----------------------------------------------------------------------------
test("Square catering webhook fails closed: unsigned 401, forged 401, no database access before the signature is verified", async () => {
  dbCalls = 0;
  const body = JSON.stringify({ event_id: "evt-1", type: "payment.updated" });
  assert.equal((await call("POST", "/api/catering/webhooks/square", { headers: json, body })).status, 401);
  assert.equal((await call("POST", "/api/catering/webhooks/square", { headers: sign(body, "wrong-key"), body })).status, 401);
  assert.equal(dbCalls, 0, "an unauthenticated delivery caused no database work");
});

test("Square webhook processing failure (valid signature, database down): non-2xx so Square retries; fixed body; no leak; no unhandled rejection", async () => {
  const body = JSON.stringify({ event_id: "evt-db-down", type: "payment.updated", merchant_id: "M1", data: { object: { payment: { id: "pay-1", order_id: "o-1", status: "COMPLETED" } } } });
  const res = await call("POST", "/api/catering/webhooks/square", { headers: sign(body), body });
  assert.ok(res.status >= 500, `a failed delivery must not be acknowledged: ${res.status}`);
  assert.notEqual(res.status, 200);
  assert.deepEqual(res.json, { ok: false });
  assertSafe(res.text);
  assert.equal(unhandled.length, 0);
});

const B = "11111111-1111-4111-8111-111111111111";
const I = "22222222-2222-4222-8222-222222222222";
const A = "33333333-3333-4333-8333-333333333333";

test("catering payment-attempt status with the database down: an error, never a 200 that reads as 'unpaid'; no driver detail", async () => {
  const res = await call("GET", `/api/catering/bookings/${B}/billing/payment-attempts/${A}`, { headers: asUser() });
  assert.ok(res.status >= 500, `expected a server-side failure, got ${res.status} ${res.text}`);
  assertSafe(res.text);
  assert.ok(!/"attempt"|"verification"|unpaid|paid/i.test(res.text), res.text);
});

test("catering pay with the database down: error, no success payload, no credentials; origin/JSON guard still runs first", async () => {
  const pay = `/api/catering/bookings/${B}/billing/invoices/${I}/pay`;
  dbCalls = 0;
  const noJson = await call("POST", pay, { headers: { ...asUser(), "content-type": "text/plain" }, body: "x" });
  assert.ok([400, 403, 415].includes(noJson.status), `${noJson.status}`);
  assert.equal(dbCalls, 0, "refused before any database work");
  const res = await call("POST", pay, { headers: { ...asUser(), ...json }, body: JSON.stringify({}) });
  assert.ok(res.status >= 400 && res.status !== 404, `${res.status} ${res.text}`);
  assertSafe(res.text);
  for (const k of ["accessToken", "access_token", "paymentId", "receipt"]) assert.ok(!res.text.includes(k), res.text);
});

// ---- CSRF / origin protections still in force -------------------------------------------------------------------------------
test("cross-site cookie-credentialed mutation is still refused before any handler (origin protection intact)", async () => {
  dbCalls = 0;
  const res = await call("POST", "/api/dm/threads/t-1/read", { headers: { ...json, origin: "https://evil.example", cookie: "token=x" }, body: "{}" });
  assert.ok([401, 403].includes(res.status), `${res.status}`);
  assert.equal(dbCalls, 0);
});

// ---- process survival, in an isolated process ------------------------------------------------------------------------------
test("isolated process with server/index.ts's exit-on-unhandledRejection policy survives a failing request and serves the next", () => {
  const reqs = JSON.stringify([
    { method: "GET", path: "/api/dm/threads", auth: true },
    { method: "GET", path: "/api/follows/requests/incoming", auth: true },
    { method: "GET", path: "/healthz" },
  ]);
  const out = spawnSync(process.execPath, ["--import", "tsx", "server/routes/async-failure-app-child.ts", reqs], { encoding: "utf8", timeout: 60_000, env: { ...process.env, SQUARE_ENV: "sandbox" } });
  const events = out.stdout.split("\n").filter((l) => l.startsWith("@@")).map((l) => JSON.parse(l.slice(2)));
  assert.equal(out.status, 0, out.stderr.slice(-500));
  assert.ok(!events.some((e) => e.event === "unhandledRejection"));
  const responses = events.filter((e) => e.event === "response");
  assert.deepEqual(responses.map((e) => e.status), [500, 500, 200]);
  for (const r of responses) assertSafe(r.body);
});
