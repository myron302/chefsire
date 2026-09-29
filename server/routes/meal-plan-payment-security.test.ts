import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("./meal-plans.ts");
const helpers = read("./meal-plans/utils.ts");
const schema = read("../../shared/schema/domains/meal-planning.ts");
const migration = read("../migrations/20260928_meal_plan_payment_fail_closed.sql");

test("meal-plan purchase fails closed before entitlement or accounting mutation", () => {
  const start = route.indexOf('router.post("/meal-plans/:id/purchase"');
  const end = route.indexOf("// Get user's purchased meal plans", start);
  const handler = route.slice(start, end);

  assert.match(handler, /status\(503\).*MEAL_PLAN_CHECKOUT_UNAVAILABLE/s);
  assert.doesNotMatch(handler, /insert\(mealPlanPurchases\)/);
  assert.doesNotMatch(handler, /salesCount.*\+ 1/);
  assert.doesNotMatch(handler, /insert\(creatorAnalytics\)/);
  assert.doesNotMatch(handler, /paymentMethod/);
  assert.doesNotMatch(handler, /transactionId/);
});

test("meal-plan code cannot fabricate provider transaction evidence", () => {
  assert.doesNotMatch(route, /buildSimulatedTransactionId|paymentStatus:\s*"completed"/);
  assert.doesNotMatch(helpers, /sim_/);
  assert.match(schema, /paymentStatus: text\("payment_status"\)\.notNull\(\)\.default\("unverified"\)/);
});

test("legacy purchase history remains present but explicitly unverified", () => {
  assert.match(migration, /ALTER COLUMN payment_status SET DEFAULT 'unverified'/);
  assert.match(migration, /SET payment_status = 'legacy_unverified'/);
  assert.match(migration, /WHERE payment_status = 'completed'/);
  assert.doesNotMatch(migration, /DELETE FROM meal_plan_purchases/);
});
