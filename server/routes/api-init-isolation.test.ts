/**
 * Stability Phase 2A: a failing meal-planner social schema initialization must not take the rest of the API with it.
 *
 * The defect (confirmed against main before the repair): routes/index.ts mounts the meal-social router WITHOUT a path prefix, and
 * meal-social.ts registered its schema initialization as ROUTER-LEVEL middleware. Express runs router-level middleware for every request
 * that reaches the router, whether or not one of its routes matches, so every request that fell through the routers mounted before it
 * ran the DDL first: `GET /api`, `/api/dm/*`, `/api/notifications`, the Square catering webhook, `/api/wedding/*`, every unknown
 * `/api/*` path. While the DDL was failing they all answered `500 {"message":"Meal planner social schema is not ready"}`. The
 * rejected promise was also cached for the life of the process, so one transient failure at the first request kept them failing
 * after the database came back, until a restart.
 *
 * These are driven through the REAL `server/app.ts` (the same middleware, the same router tree, the same final 404 and error handler),
 * with `db.execute` replaced by a double that fails or succeeds on demand and records every statement. One test, first, uses the real
 * Neon driver against an address nothing listens on, so an actual connection failure is exercised as well as a simulated one.
 */
import "../test-support/accept-test-sessions";
import { testAuthHeader } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import { PgDialect } from "drizzle-orm/pg-core";

process.env.NODE_ENV = "test";
// An address nothing listens on: the one test that uses the real driver gets ECONNREFUSED immediately; every other test replaces
// `db.execute` and never opens a connection.
process.env.DATABASE_URL = "postgres://app:secret@127.0.0.1:9/chefsire_unreachable_test";
process.env.SQUARE_ENV = "sandbox";
process.env.SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY = "test-signature-key";
process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL = "https://chefsire.test/api/catering/webhooks/square";

const { db } = await import("../db");
const { default: app } = await import("../app");
const { mealSocialSchema } = await import("./meal-social");
const { advancedMealPlanningSchemaInit } = await import("./meal-planner-advanced/schema");

const dialect = new PgDialect();
const DRIVER_SECRET = 'connect ECONNREFUSED ep-private-host.neon.tech:5432 role "neondb_owner" password authentication failed';
const SOCIAL_TABLES = ["meal_plan_likes", "meal_plan_saves", "meal_plan_comments", "shared_week_likes", "shared_week_saves", "shared_week_comments", "meal_plan_creator_profiles"];

// ---- the database double ---------------------------------------------------------------------------------------------------
const calls = { ddl: [] as string[], other: [] as string[] };
let ddlMode: "down" | "up" | "gated" = "up";
let queryMode: "ok" | "fail" = "ok";
let gate: Promise<void> = Promise.resolve();
let inFlightDdl = 0;
let maxInFlightDdl = 0;

const isDdl = (text: string) => /^\s*(CREATE|ALTER)\b/i.test(text) || /^\s*UPDATE\s+(meal_prep_schedules|leftovers|grocery_list_items)\s+SET\s+is_running_low/i.test(text);

function installDatabaseDouble() {
  (db as any).execute = async (query: unknown) => {
    const text = typeof query === "string" ? query : dialect.sqlToQuery(query as never).sql;
    if (isDdl(text)) {
      calls.ddl.push(text.replace(/\s+/g, " ").trim());
      inFlightDdl += 1;
      maxInFlightDdl = Math.max(maxInFlightDdl, inFlightDdl);
      try {
        if (ddlMode === "gated") await gate;
        if (ddlMode === "down") throw new Error(DRIVER_SECRET);
      } finally {
        inFlightDdl -= 1;
      }
      return { rows: [] };
    }
    calls.other.push(text.replace(/\s+/g, " ").trim());
    if (queryMode === "fail") throw new Error(DRIVER_SECRET);
    // Soft-deleting a comment only matches rows the viewer owns; the double owns none.
    if (/UPDATE meal_plan_comments/i.test(text)) return { rows: [] };
    return { rows: [{ id: "plan-1", like_count: 1, save_count: 0, comment_count: 0, viewer_has_liked: true, viewer_has_saved: false }] };
  };
  // Enough of the query builder for the catering webhook service: every call returns the same thenable chain.
  const chain = (rows: unknown[]) => {
    const proxy: any = new Proxy(function () {}, {
      get: (_target, prop) => (prop === "then" ? (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) : () => proxy),
      apply: () => proxy,
    });
    return proxy;
  };
  (db as any).insert = () => chain([]);
  (db as any).update = () => chain([{ id: "event-row", state: "processing" }]);
  (db as any).select = () => chain([]);
}

/** Back to the real Neon-backed drizzle methods (they live on the prototype; the double is own-properties on the instance). */
function useRealDatabase() {
  for (const method of ["execute", "insert", "update", "select"]) delete (db as any)[method];
}

function resetState({ real = false }: { real?: boolean } = {}) {
  if (real) useRealDatabase();
  else installDatabaseDouble();
  calls.ddl.length = 0;
  calls.other.length = 0;
  ddlMode = "up";
  queryMode = "ok";
  gate = Promise.resolve();
  inFlightDdl = 0;
  maxInFlightDdl = 0;
  mealSocialSchema.resetForTests();
  mealSocialSchema.setClockForTests(null);
  advancedMealPlanningSchemaInit.resetForTests();
  advancedMealPlanningSchemaInit.setClockForTests(null);
}

// ---- the server ------------------------------------------------------------------------------------------------------------
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => { server.close(); server.closeAllConnections?.(); });

const unhandled: unknown[] = [];
process.on("unhandledRejection", (reason) => { unhandled.push(reason); });

async function call(method: string, path: string, init: { headers?: Record<string, string>; body?: string } = {}) {
  const response = await fetch(base + path, { method, headers: init.headers, body: init.body });
  const text = await response.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: response.status, headers: response.headers, text, json };
}
const asUser = (id = "user-1") => testAuthHeader(id);
const ddlFor = (table: string) => calls.ddl.filter((s) => new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(s));

function signedSquareDelivery(body: string, key = "test-signature-key") {
  const signature = createHmac("sha256", key).update(process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL! + body).digest("base64");
  return { "content-type": "application/json", "x-square-hmacsha256-signature": signature };
}

function assertNoDriverDetail(text: string) {
  for (const secret of ["ECONNREFUSED", "neon.tech", "neondb_owner", "password authentication", "5432", "secret@"]) {
    assert.ok(!text.includes(secret), `response leaked "${secret}": ${text}`);
  }
  assert.ok(!/at .*\.(ts|js):\d+/.test(text), "response leaked a stack trace");
}

// ---- 1. a REAL connection failure ------------------------------------------------------------------------------------------
test("real driver, unreachable database: the failure stays inside the meal-social routes", async () => {
  resetState({ real: true });

  const banner = await call("GET", "/api");
  assert.equal(banner.status, 200);
  assert.equal(banner.json?.name, "ChefSire API");

  const notFound = await call("GET", "/api/definitely-not-a-route");
  assert.equal(notFound.status, 404);
  assert.deepEqual(notFound.json, { error: "API endpoint not found" });

  const social = await call("GET", "/api/meal-plan-creators");
  assert.equal(social.status, 503, social.text);
  assert.deepEqual(social.json, { message: "Meal planner social schema is not ready", code: "meal_planner_social_unavailable", retryable: true });
  assert.ok(Number(social.headers.get("retry-after")) >= 1);
  assertNoDriverDetail(social.text);
  assert.equal(mealSocialSchema.stats().attempts, 1);
});

// ---- 2. unrelated APIs while the DDL is failing ---------------------------------------------------------------------------
test("unrelated APIs stay reachable while meal-social initialization is failing, and never trigger it", async () => {
  resetState();
  ddlMode = "down";

  const banner = await call("GET", "/api");
  assert.equal(banner.status, 200);

  const unknownGet = await call("GET", "/api/definitely-not-a-route");
  assert.equal(unknownGet.status, 404);
  assert.deepEqual(unknownGet.json, { error: "API endpoint not found" });
  const unknownPost = await call("POST", "/api/definitely/not/a/route", { headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(unknownPost.status, 404);
  assert.deepEqual(unknownPost.json, { error: "API endpoint not found" });

  // Protected routers still do their own job: an anonymous caller is told to authenticate, not that a meal-planner table is missing.
  for (const path of ["/api/dm/threads", "/api/notifications", "/api/quests", "/api/catering/bookings", "/api/wedding/subscription/status"]) {
    const response = await call("GET", path);
    assert.notEqual(response.status, 500, `${path}: ${response.text}`);
    assert.ok(!/Meal planner/i.test(response.text), `${path} answered with the meal-planner message: ${response.text}`);
  }
  const dm = await call("GET", "/api/dm/threads");
  assert.equal(dm.status, 401);

  assert.equal(calls.ddl.length, 0, "no unrelated request may run the meal-social DDL");
  assert.equal(mealSocialSchema.stats().attempts, 0);
});

// ---- 3. catering Square webhook routing ------------------------------------------------------------------------------------
test("the catering Square webhook is routed to its own handler while meal-social initialization is failing", async () => {
  resetState();
  ddlMode = "down";

  const unsigned = await call("POST", "/api/catering/webhooks/square", { headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(unsigned.status, 401, unsigned.text);
  assert.deepEqual(unsigned.json, { ok: false });

  const wrongKey = JSON.stringify({ event_id: "evt-1", type: "payment.updated" });
  const forged = await call("POST", "/api/catering/webhooks/square", { headers: signedSquareDelivery(wrongKey, "some-other-key"), body: wrongKey });
  assert.equal(forged.status, 401);

  const signedGarbage = "{\"nope\":true}";
  const rejected = await call("POST", "/api/catering/webhooks/square", { headers: signedSquareDelivery(signedGarbage), body: signedGarbage });
  assert.equal(rejected.status, 400, "signature verified, payload refused by the handler itself");
  assert.deepEqual(rejected.json, { ok: false });

  // A correctly signed delivery runs the real service end to end (an event type the service ignores, so no payment state is needed).
  const body = JSON.stringify({ event_id: "evt-sandbox-1", type: "customer.created", merchant_id: "MERCHANT_1", data: { object: {} } });
  const accepted = await call("POST", "/api/catering/webhooks/square", { headers: signedSquareDelivery(body), body });
  assert.equal(accepted.status, 200, accepted.text);
  assert.deepEqual(accepted.json, { ok: true });

  assert.equal(calls.ddl.length, 0, "the webhook path never runs the meal-social DDL");
});

// ---- 4. the meal-social routes themselves ----------------------------------------------------------------------------------
test("initial database failure: meal-social routes answer 503 with a fixed body and no database internals", async () => {
  resetState();
  ddlMode = "down";

  for (const [method, path] of [
    ["GET", "/api/meal-plan-creators"],
    ["GET", "/api/meal-plans/plan-1/comments"],
    ["POST", "/api/meal-plans/plan-1/like"],
    ["GET", "/api/me/saved-meal-planner-items"],
    ["POST", "/api/meal-planner/week/shared/abcdefgh12/like"],
  ] as const) {
    const response = await call(method, path, { headers: { ...asUser(), "content-type": "application/json" } });
    assert.equal(response.status, 503, `${method} ${path}: ${response.text}`);
    assert.ok(Number(response.headers.get("retry-after")) >= 1);
    assert.deepEqual(response.json, { message: "Meal planner social schema is not ready", code: "meal_planner_social_unavailable", retryable: true });
    assertNoDriverDetail(response.text);
  }
});

test("authentication runs first: an anonymous caller gets 401 and can neither trigger the DDL nor learn its state", async () => {
  resetState();
  ddlMode = "down";
  for (const [method, path] of [
    ["POST", "/api/meal-plans/plan-1/like"],
    ["DELETE", "/api/meal-plans/plan-1/comments/c-1"],
    ["POST", "/api/meal-plans/plan-1/comments"],
    ["PUT", "/api/meal-plan-creators/me"],
    ["GET", "/api/me/saved-meal-planner-items"],
  ] as const) {
    const response = await call(method, path);
    assert.equal(response.status, 401, `${method} ${path}: ${response.text}`);
  }
  assert.equal(calls.ddl.length, 0);
  assert.equal(mealSocialSchema.stats().attempts, 0);
});

test("no unbounded retries: a flood of requests during an outage causes one attempt, then one per backoff window", async () => {
  resetState();
  ddlMode = "down";
  let clock = 5_000_000;
  mealSocialSchema.setClockForTests(() => clock);

  const flood = await Promise.all(Array.from({ length: 150 }, () => call("GET", "/api/meal-plan-creators")));
  assert.ok(flood.every((r) => r.status === 503));
  assert.equal(mealSocialSchema.stats().attempts, 1);
  assert.equal(calls.ddl.length, 1, "the first CREATE TABLE failed, so exactly one statement was ever attempted");

  clock += 999;
  await Promise.all(Array.from({ length: 150 }, () => call("GET", "/api/meal-plan-creators")));
  assert.equal(mealSocialSchema.stats().attempts, 1, "still inside the window");

  clock += 1; // 1 000 ms: the first window ends
  await call("GET", "/api/meal-plan-creators");
  assert.equal(mealSocialSchema.stats().attempts, 2);
  const retryAfter = Number((await call("GET", "/api/meal-plan-creators")).headers.get("retry-after"));
  assert.ok(retryAfter >= 1 && retryAfter <= 30, `Retry-After ${retryAfter}`);
  assert.equal(mealSocialSchema.stats().attempts, 2);
});

test("recovery after a transient failure: the next attempt after the window succeeds and the feature heals without a restart", async () => {
  resetState();
  ddlMode = "down";
  let clock = 9_000_000;
  mealSocialSchema.setClockForTests(() => clock);

  assert.equal((await call("GET", "/api/meal-plan-creators", { headers: asUser() })).status, 503);

  ddlMode = "up"; // the database is back, but the window has not elapsed yet
  assert.equal((await call("GET", "/api/meal-plan-creators", { headers: asUser() })).status, 503);
  assert.equal(calls.ddl.length, 1);

  clock += 1_000;
  const healed = await call("GET", "/api/meal-plan-creators", { headers: asUser() });
  assert.equal(healed.status, 200, healed.text);
  // The failed first attempt only got as far as the first table; the second attempt created all of them.
  assert.equal(ddlFor("meal_plan_likes").length, 2);
  for (const table of SOCIAL_TABLES.slice(1)) assert.equal(ddlFor(table).length, 1, table);
  assert.equal(mealSocialSchema.isReady(), true);

  const ddlAfterHealing = calls.ddl.length;
  for (let i = 0; i < 20; i += 1) assert.equal((await call("GET", "/api/meal-plan-creators", { headers: asUser() })).status, 200);
  assert.equal(calls.ddl.length, ddlAfterHealing, "after healing the DDL never runs again");

  // And a write route works end to end through the same guard.
  const liked = await call("POST", "/api/meal-plans/plan-1/like", { headers: { ...asUser(), "content-type": "application/json" } });
  assert.equal(liked.status, 200, liked.text);
  assert.equal(liked.json?.likeCount, 1);
});

test("concurrent requests during initialization run the DDL once, never concurrently", async () => {
  resetState();
  ddlMode = "gated";
  let release!: () => void;
  gate = new Promise<void>((resolve) => { release = resolve; });

  const pending = Array.from({ length: 40 }, () => call("GET", "/api/meal-plan-creators", { headers: asUser() }));
  // Let every request reach the guard and park on the single in-flight initialization.
  for (let i = 0; i < 50 && inFlightDdl === 0; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(inFlightDdl, 1, "one statement in flight for forty requests");
  release();
  const responses = await Promise.all(pending);

  assert.ok(responses.every((r) => r.status === 200), responses.map((r) => r.status).join(","));
  assert.equal(maxInFlightDdl, 1, "the DDL never ran concurrently");
  for (const table of SOCIAL_TABLES) assert.equal(ddlFor(table).length, 1, `${table} created once`);
  assert.equal(mealSocialSchema.stats().attempts, 1);
});

test("a database failure inside a meal-social handler is a generic 500 that cannot take the process down", async () => {
  resetState();
  assert.equal((await call("GET", "/api/meal-plan-creators", { headers: asUser() })).status, 200); // initialize
  queryMode = "fail";
  unhandled.length = 0;

  const before = unhandled.length;
  const failed = await call("POST", "/api/meal-plans/plan-1/like", { headers: { ...asUser(), "content-type": "application/json" } });
  assert.equal(failed.status, 500, failed.text);
  assert.deepEqual(failed.json, { error: "Internal Server Error" });
  assertNoDriverDetail(failed.text);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(unhandled.length, before, "the rejection is handled: this process exits on unhandledRejection");

  queryMode = "ok";
  assert.equal((await call("GET", "/api/meal-plan-creators", { headers: asUser() })).status, 200);
});

test("authorization on the meal-social routes is unchanged", async () => {
  resetState();
  queryMode = "ok";
  // A comment the viewer does not own: the UPDATE (scoped to the viewer's own rows) matches nothing.
  const response = await call("DELETE", "/api/meal-plans/plan-1/comments/someone-elses", { headers: asUser("user-2") });
  assert.equal(response.status, 404);
  assert.equal(response.json?.message, "Comment not found or not owned by viewer");
  const update = calls.other.find((statement) => /UPDATE meal_plan_comments/i.test(statement));
  assert.ok(update && /user_id = \$\d+/.test(update), "the delete is still scoped to the authenticated user");
});

// ---- 5. the sibling meal-planner initializers -------------------------------------------------------------------------------
test("meal-planner advanced init: a failure is a sanitized 503 (no `details`), is retried, and recovers", async () => {
  resetState();
  ddlMode = "down";
  let clock = 20_000_000;
  advancedMealPlanningSchemaInit.setClockForTests(() => clock);

  const down = await call("GET", "/api/meal-planner/leftovers", { headers: asUser() });
  assert.equal(down.status, 503, down.text);
  assert.equal(down.json?.code, "meal_planner_advanced_unavailable");
  assert.ok(!("details" in (down.json ?? {})), "the previous handler returned details: e.message");
  assertNoDriverDetail(down.text);
  // The failure is confined to /api/meal-planner: nothing else is affected.
  assert.equal((await call("GET", "/api")).status, 200);
  assert.equal((await call("GET", "/api/dm/threads")).status, 401);

  ddlMode = "up";
  clock += 1_000;
  const anonymous = await call("GET", "/api/meal-planner/leftovers");
  assert.notEqual(anonymous.status, 503, "initialization recovered; the route's own authentication answers now");
  assert.equal(anonymous.status, 401);
});
