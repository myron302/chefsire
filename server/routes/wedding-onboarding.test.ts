import "../test-support/auth-test-env";
import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

// Construct the real route and query builder, but never connect to a database.
process.env.DATABASE_URL ||= "postgresql://unused:unused@localhost/unused_test";
const { db } = await import("../db");
const { storage } = await import("../storage");
const { default: router } = await import("./wedding-subscription");

const handler = (method: string, path: string) => {
  const route = router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method])?.route;
  assert.ok(route);
  return route.stack.at(-1).handle;
};

test("authenticated Wedding routes persist onboarding in scoped history only after success", async (t) => {
  const users = new Map<string, any>([
    ["new", { weddingTier: "free", subscriptionTier: "elite" }],
    ["existing-free", { weddingTier: "free" }],
    ["legacy-paid", { weddingTier: "premium" }],
    ["other", { weddingTier: "free" }],
  ]);
  for (const [id, user] of users) user.id = id;
  const history: any[] = [{ userId: "existing-free", subscriptionType: "wedding", id: "old" }];
  let failWrite = false;
  let failHistory = false;
  t.mock.method(db, "execute", async () => ({}));
  t.mock.method(storage, "getUser", async (id: string) => users.get(id));
  t.mock.method(storage, "updateUser", async (id: string, patch: any) => {
    if (failWrite) throw new Error("simulated write failure");
    Object.assign(users.get(id), patch);
    return users.get(id);
  });
  t.mock.method(db, "insert", () => ({ values: async (row: any) => { if (failHistory) throw new Error("simulated history failure"); history.push({ ...row, id: "selection" }); } }));
  t.mock.method(db, "select", () => ({ from: () => ({ where: (condition: any) => ({ limit: async () => {
    const query = new PgDialect().sqlToQuery(condition);
    assert.match(query.sql, /"user_id" = \$1.*"subscription_type" = \$2/);
    const [userId, domain] = query.params;
    return history.filter((row) => row.userId === userId && row.subscriptionType === domain).slice(0, 1);
  } }) }) }));
  async function call(method: string, path: string, id: string, body?: unknown) {
    let status = 200;
    let payload: any;
    const res = { status(code: number) { status = code; return this; }, json(data: any) { payload = data; return this; } };
    await handler(method, path)({ user: { id }, body }, res);
    return { status, payload };
  }
  assert.equal((await call("get", "/subscription", "new")).payload.onboardingCompleted, false);
  assert.equal((await call("get", "/subscription", "new")).payload.currentTier, "free", "marketplace does not grant Wedding entitlement");
  for (const id of ["existing-free", "legacy-paid"]) {
    assert.equal((await call("get", "/subscription", id)).payload.onboardingCompleted, true);
    assert.equal((await call("get", "/subscription", id)).payload.currentTier, "free", "history never grants paid access");
  }
  failWrite = true;
  assert.equal((await call("post", "/subscription/change", "new", { tier: "free" })).status, 500);
  assert.equal((await call("get", "/subscription", "new")).payload.onboardingCompleted, false);
  failWrite = false;
  for (const tier of ["premium", "elite"]) {
    assert.equal((await call("post", "/subscription/change", "new", { tier })).status, 503);
    assert.equal((await call("get", "/subscription", "new")).payload.onboardingCompleted, false);
  }
  failHistory = true;
  assert.equal((await call("post", "/subscription/change", "new", { tier: "free" })).status, 500);
  assert.equal((await call("get", "/subscription", "new")).payload.onboardingCompleted, false);
  failHistory = false;
  const selected = await call("post", "/subscription/change", "new", { tier: "free" });
  assert.equal(selected.status, 200);
  assert.equal(selected.payload.onboardingCompleted, true);
  for (let visit = 0; visit < 3; visit++) {
    assert.equal((await call("get", "/subscription", "new")).payload.onboardingCompleted, true);
  }
  assert.equal((await call("get", "/subscription", "other")).payload.onboardingCompleted, false);
});
