import "../test-support/auth-test-env";
import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
process.env.DATABASE_URL ||= "postgresql://unused:unused@localhost/unused_test";
const { db } = await import("../db");
const { storage } = await import("../storage");
const { default: router } = await import("./wedding-subscription");
const { requireWeddingTier, weddingEntitlement } = await import("../lib/wedding-entitlement");
const { hasAuthoritativePaidEntitlement } = await import("../lib/subscription-security");

const handler = (method: string, path: string) => router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method])!.route.stack.at(-1).handle;
async function call(method: string, path: string, id: string, body?: unknown) {
  let status = 200;
  let payload: any;
  const res = { status(code: number) { status = code; return this; }, json(data: any) { payload = data; return this; } };
  await handler(method, path)({ user: { id }, body }, res);
  return { status, payload };
}

test("trial activation, isolation, expiration, cancellation and failures", async (t) => {
  let now = Date.UTC(2026, 9, 25, 16);
  let fail = false;
  const trials = new Map<string, any>();
  // More records than Free permits, spanning all saved-data categories. No
  // subscription operation may touch these or call storage deletion methods.
  const content = { guests: Array.from({ length: 200 }, (_, id) => ({ id, rsvp: "accepted" })), vendors: Array.from({ length: 30 }, (_, id) => ({ id })), budget: { total: 50000 }, tasks: ["venue"], calendar: ["fitting"], quotes: ["q"], registry: ["r"], documents: ["doc"], attachments: ["r2/key"] };
  const before = structuredClone(content);
  const history: any[] = [];
  t.mock.method(storage, "getUser", async (id: string) => ({ id, weddingTier: "free" }));
  t.mock.method(storage, "updateUser", async () => ({}));
  t.mock.method(db, "insert", () => ({ values: async (row: any) => history.push(row) }));
  t.mock.method(db, "select", () => ({ from: () => ({ where: () => ({ limit: async () => history }) }) }));
  t.mock.method(db, "execute", async (statement: any) => {
    const { sql, params } = new PgDialect().sqlToQuery(statement);
    if (!sql.includes("wedding_intro_trials")) return { rows: [] };
    if (fail) throw new Error("simulated unavailable database");
    if (sql.includes("INSERT INTO")) {
      assert.match(sql, /ON CONFLICT \(user_id\) DO NOTHING/);
      assert.equal(params.length, 2, "client dates/status never reach SQL");
      const [id, tier] = params as string[];
      if (trials.has(id)) return { rows: [] };
      const row = { tier, activatedAt: new Date(now), expiresAt: new Date(now + 14 * 86400000), revokedAt: null, active: true, remainingDays: 14 };
      trials.set(id, row);
      return { rows: [row] };
    }
    const id = params[0] as string;
    const row = trials.get(id);
    if (sql.includes("UPDATE")) { if (row) row.revokedAt = new Date(now); return { rows: [] }; }
    assert.match(sql, /WHERE user_id = \$1/);
    assert.match(sql, /expires_at > statement_timestamp\(\)/);
    return { rows: row ? [{ ...row, active: !row.revokedAt && +row.activatedAt <= now && +row.expiresAt > now, remainingDays: row.revokedAt ? 0 : Math.max(0, Math.ceil((+row.expiresAt - now) / 86400000)) }] : [] };
  });

  const initial = await call("get", "/subscription", "a");
  assert.equal(initial.payload.trial.eligible, true);
  const results = await Promise.all([call("post", "/subscription/trial", "a", { tier: "premium" }), call("post", "/subscription/trial", "a", { tier: "elite" })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(trials.size, 1);
  const started = results.find((r) => r.status === 200)!.payload;
  assert.equal(+new Date(started.endsAt) - +new Date(started.trial.activatedAt), 14 * 86400000);
  for (const tier of ["premium", "elite"]) assert.equal((await call("post", "/subscription/trial", "a", { tier })).status, 409);
  for (const body of [{ tier: "free" }, { tier: "elite", userId: "victim" }, { tier: "elite", expiresAt: "2099-01-01" }, { tier: "elite", status: "active" }]) {
    assert.equal((await call("post", "/subscription/trial", "b", body)).status, 400);
  }
  assert.equal((await weddingEntitlement("b", "elite")).currentTier, "free", "legacy paid state cannot grant access");
  assert.equal((await call("post", "/subscription/trial", "b", { tier: "elite" })).status, 200);
  assert.equal((await weddingEntitlement("b")).currentTier, "elite");

  async function guard(id: string | undefined, minimum: "premium" | "elite") {
    let status = 200; let passed = false;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } };
    await requireWeddingTier(minimum)({ user: id ? { id } : undefined } as any, res as any, () => { passed = true; });
    return { status, passed };
  }
  assert.deepEqual(await guard(undefined, "premium"), { status: 401, passed: false });
  assert.deepEqual(await guard("a", "premium"), { status: 200, passed: true });
  assert.deepEqual(await guard("a", "elite"), { status: 403, passed: false });
  assert.deepEqual(await guard("b", "elite"), { status: 200, passed: true });
  assert.deepEqual(await guard("victim", "premium"), { status: 403, passed: false });
  now = +trials.get("a").expiresAt - 1;
  assert.equal((await weddingEntitlement("a")).trial.remainingDays, 1);
  assert.deepEqual(await guard("a", "premium"), { status: 200, passed: true });
  now += 1;
  assert.deepEqual(await guard("a", "premium"), { status: 403, passed: false });
  const expired = (await call("get", "/subscription", "a")).payload;
  assert.equal(expired.currentTier, "free");
  assert.equal(expired.onboardingCompleted, true);
  assert.equal(expired.trial.status, "expired");
  assert.equal(expired.trial.remainingDays, 0);
  assert.equal(expired.trial.eligible, false);
  assert.equal((await call("post", "/subscription/trial", "a", { tier: "elite" })).status, 409);
  assert.deepEqual(content, before);
  // Re-enable the clock only for account b to exercise cancellation/downgrade.
  now = +trials.get("b").activatedAt + 1;
  assert.equal((await call("post", "/subscription/cancel", "b")).payload.trial.status, "cancelled");
  assert.equal((await call("post", "/subscription/trial", "b", { tier: "premium" })).status, 409);
  await call("post", "/subscription/trial", "c", { tier: "elite" });
  assert.equal((await call("post", "/subscription/change", "c", { tier: "free" })).status, 200);
  assert.equal((await weddingEntitlement("c")).currentTier, "free");
  assert.equal((await weddingEntitlement("c")).trial.eligible, false);
  fail = true;
  assert.equal((await call("post", "/subscription/trial", "d", { tier: "elite" })).status, 503);
  assert.equal(trials.has("d"), false);
  assert.deepEqual(await guard("a", "premium"), { status: 503, passed: false });
  fail = false;
  assert.equal((await call("post", "/subscription/trial", "d", { tier: "elite" })).status, 200);
  assert.equal(hasAuthoritativePaidEntitlement(), false);
  assert.equal((await call("post", "/subscription/change", "a", { tier: "elite" })).status, 503);
  assert.deepEqual(content, before);
});
