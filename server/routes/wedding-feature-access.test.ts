import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
process.env.DATABASE_URL ||= "postgresql://unused:unused@localhost/unused_test";
const { db } = await import("../db");
const { default: calendar } = await import("./wedding-calendar-events");
const { default: registry } = await import("./wedding-registry-links");
const { default: details } = await import("./wedding-event-details");
const { default: insights } = await import("./wedding-insights");
const { default: rsvp } = await import("./wedding-rsvp");
function route(router: any, path: string, method: string) { return router.stack.find((x: any) => x.route?.path === path && x.route.methods[method]).route; }

test("real premium route middleware permits active trials, denies expired/cross-account access, and keeps saved calendar readable", async (t) => {
  let active = true;
  const records = Array.from({ length: 200 }, (_, id) => ({ id, eventDate: "2026-11-01", title: `Personal event ${id}`, notes: "keep", createdAt: new Date() }));
  t.mock.method(db, "execute", async (statement: any) => {
    const { sql, params } = new PgDialect().sqlToQuery(statement);
    assert.doesNotMatch(sql, /DELETE|UPDATE|INSERT/i, "authorization/reads cannot mutate saved content");
    assert.equal(params[0], "owner", "body userId cannot change the account scope");
    if (sql.includes("wedding_intro_trials")) return { rows: [{ tier: "elite", activatedAt: new Date(), expiresAt: new Date(), revokedAt: null, active, remainingDays: active ? 1 : 0 }] };
    assert.match(sql, /FROM wedding_calendar_events/);
    return { rows: records };
  });
  const protectedRoutes = [[calendar, "/calendar-events"], [registry, "/registry-links"], [details, "/event-details"], [insights, "/insights"], [rsvp, "/send-invitations"]] as const;
  for (const [router, path] of protectedRoutes) {
    const stack = route(router, path, "post").stack;
    let status = 200; let passed = false;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } };
    await stack[0].handle({ headers: {} }, res, () => { throw new Error("anonymous request must stop before trial lookup"); });
    assert.equal(status, 401);
    assert.equal(stack.length, 3, "authentication and entitlement precede the write handler");
    active = true;
    await stack[1].handle({ user: { id: "owner" }, body: { userId: "victim", tier: "elite", expiresAt: "2099-01-01" } }, res, () => { passed = true; });
    assert.equal(passed, true);
    active = false;
    passed = false;
    await stack[1].handle({ user: { id: "owner" }, body: { userId: "victim" } }, res, () => { passed = true; });
    assert.equal(status, 403);
    assert.equal(passed, false);
  }
  const stack = route(calendar, "/calendar-events", "get").stack;
  assert.equal(stack.length, 2, "saved-data reads require authentication without a premium gate");
  let payload: any;
  await stack.at(-1).handle({ user: { id: "owner" } }, { json(data: any) { payload = data; }, status() { throw new Error("read failed"); } });
  assert.equal(payload.events.length, 200, "expired accounts can read records above Free limits");
  assert.equal(payload.events[199].notes, "keep");
  assert.equal(records.length, 200);
});
