import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { enforceMealPlanPaymentIntegrity } from "./meal-plan-payment-enforcement";

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

test("preflight is transactional, preserves rows, and normalizes only invalid authoritative claims", async () => {
  const calls: string[] = [];
  const client = { query: async (statement: string) => {
    calls.push(statement);
    if (statement.includes("to_regclass")) return { rows: [{ purchases: "meal_plan_purchases" }] };
    return { rows: [] };
  } };
  await enforceMealPlanPaymentIntegrity(client, true);
  assert.equal(calls[1], "BEGIN");
  assert.match(calls[2], /ADD COLUMN IF NOT EXISTS acquisition_type/);
  assert.match(calls[2], /payment_status IN \('completed', 'verified_paid', 'free_acquired'\) THEN 'legacy_unverified'/);
  assert.match(calls[2], /NOT \(\s*payment_status = 'verified_paid'[\s\S]*provider_payment_status = 'COMPLETED'/);
  assert.match(calls[2], /NOT \(\s*payment_status = 'free_acquired'[\s\S]*price_paid_cents = 0/);
  assert.match(calls[2], /ADD CONSTRAINT meal_plan_purchases_authoritative_evidence_chk CHECK/);
  assert.doesNotMatch(calls[2], /DELETE FROM meal_plan_purchases|INSERT INTO meal_plan_purchases|creator_analytics|sales_count/);
  assert.equal(calls[3], "COMMIT");
});
