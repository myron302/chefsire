import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { enforceMealPlanPaymentIntegrity, MealPlanPaymentIntegrityConflictError } from "./meal-plan-payment-enforcement";

const pushSchema = readFileSync(new URL("./push-schema.ts", import.meta.url), "utf8");

test("meal-plan preflight runs before Drizzle and enforcement runs after", () => {
  const pre = pushSchema.indexOf('enforce-meal-plan-payment-integrity.ts", "--allow-missing"');
  const drizzle = pushSchema.indexOf('"drizzle-kit", "push"');
  const post = pushSchema.lastIndexOf('enforce-meal-plan-payment-integrity.ts"');
  assert.ok(pre >= 0 && pre < drizzle);
  assert.ok(post > drizzle);
});

test("fresh bootstrap is allowed only when requested", async () => {
  const calls: string[] = [];
  const client = { query: async (statement: string) => {
    calls.push(statement);
    return { rows: [{ purchases: null }] };
  } };
  assert.deepEqual(await enforceMealPlanPaymentIntegrity(client, true), { purchases: false });
  assert.equal(calls.length, 1);
  await assert.rejects(enforceMealPlanPaymentIntegrity(client, false), /does not exist/);
});

function fakeClient(opts: { entitlement?: unknown[]; provider?: unknown[] } = {}) {
  const calls: string[] = [];
  const client = { query: async (statement: string) => {
    calls.push(statement);
    if (statement.includes("to_regclass")) return { rows: [{ purchases: "meal_plan_purchases" }] };
    if (statement.includes("HAVING") && statement.includes("payment_status IN")) return { rows: opts.entitlement ?? [] };
    if (statement.includes("HAVING")) return { rows: opts.provider ?? [] };
    return { rows: [] };
  } };
  return { client, calls };
}

test("enforcement is one transaction: normalize, detect conflicts, indexes, CHECK, commit", async () => {
  const { client, calls } = fakeClient();
  await enforceMealPlanPaymentIntegrity(client, true);
  const order = [
    "BEGIN", "LOCK TABLE", "ADD COLUMN IF NOT EXISTS acquisition_type", "GROUP BY user_id, blueprint_id",
    "GROUP BY payment_provider, provider_payment_id", "CREATE UNIQUE INDEX meal_plan_purchases_entitlement_identity_uidx",
    "ADD CONSTRAINT meal_plan_purchases_authoritative_evidence_chk CHECK", "COMMIT",
  ];
  const positions = order.map((needle) => calls.findIndex((c, idx) => idx > 0 && c.includes(needle)));
  assert.ok(positions.every((p) => p > 0), JSON.stringify(positions));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  const prepare = calls.find((c) => c.includes("ADD COLUMN IF NOT EXISTS acquisition_type"))!;
  assert.match(prepare, /payment_status IN \('completed', 'verified_paid', 'free_acquired'\) THEN 'legacy_unverified'/);
  assert.match(prepare, /NOT \(\s*payment_status = 'verified_paid'[\s\S]*provider_payment_status = 'COMPLETED'/);
  assert.match(prepare, /NOT \(\s*payment_status = 'free_acquired'[\s\S]*price_paid_cents = 0/);
  for (const c of calls) assert.doesNotMatch(c, /DELETE FROM meal_plan_purchases|INSERT INTO meal_plan_purchases|creator_analytics|sales_count/);
  const idx = calls.find((c) => c.includes("CREATE UNIQUE INDEX"))!;
  assert.match(idx, /meal_plan_purchases_entitlement_identity_uidx[\s\S]*\(user_id, blueprint_id\)\s+WHERE payment_status IN \('free_acquired', 'verified_paid'\)/);
  assert.match(idx, /meal_plan_purchases_provider_payment_uidx[\s\S]*\(payment_provider, provider_payment_id\)\s+WHERE provider_payment_id IS NOT NULL/);
});

test("conflict queries mirror the partial unique index semantics", async () => {
  const { client, calls } = fakeClient();
  await enforceMealPlanPaymentIntegrity(client, true);
  const ent = calls.find((c) => c.includes("GROUP BY user_id, blueprint_id"))!;
  assert.match(ent, /WHERE payment_status IN \('free_acquired', 'verified_paid'\)/);
  const prov = calls.find((c) => c.includes("GROUP BY payment_provider"))!;
  assert.match(prov, /provider_payment_id IS NOT NULL AND payment_provider IS NOT NULL/);
  assert.doesNotMatch(prov, /GROUP BY provider_payment_id/);
});

test("entitlement conflict rolls back before any index DDL and names user/blueprint/purchases", async () => {
  const { client, calls } = fakeClient({ entitlement: [{ user_id: "u1", blueprint_id: "b1", purchase_ids: ["p1", "p2"] }] });
  await assert.rejects(enforceMealPlanPaymentIntegrity(client, true), (error: Error) => {
    assert.ok(error instanceof MealPlanPaymentIntegrityConflictError);
    assert.match(error.message, /user_id=u1 blueprint_id=b1 purchase_ids=\[p1,p2\]/);
    return true;
  });
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.ok(!calls.includes("COMMIT"));
  assert.ok(!calls.some((c) => /CREATE UNIQUE INDEX|ADD CONSTRAINT/.test(c)));
});

test("provider-payment conflict rolls back before any index DDL and is consistent when repeated", async () => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { client, calls } = fakeClient({ provider: [{ payment_provider: "square", provider_payment_id: "pay1", purchase_ids: ["p1", "p2"] }] });
    await assert.rejects(enforceMealPlanPaymentIntegrity(client, true), /payment_provider=square provider_payment_id=pay1 purchase_ids=\[p1,p2\]/);
    assert.equal(calls.at(-1), "ROLLBACK");
    assert.ok(!calls.some((c) => /CREATE UNIQUE INDEX|ADD CONSTRAINT|COMMIT/.test(c)));
  }
});

test("a mid-transaction error rolls back and rethrows", async () => {
  const calls: string[] = [];
  const client = { query: async (statement: string) => {
    calls.push(statement);
    if (statement.includes("to_regclass")) return { rows: [{ purchases: "meal_plan_purchases" }] };
    if (statement.includes("CREATE UNIQUE INDEX")) throw new Error("boom");
    return { rows: [] };
  } };
  await assert.rejects(enforceMealPlanPaymentIntegrity(client, true), /boom/);
  assert.equal(calls.at(-1), "ROLLBACK");
});
