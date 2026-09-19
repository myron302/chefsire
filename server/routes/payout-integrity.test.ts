import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rejectUnavailablePayout } from "../lib/payout-safety";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const route = fs.readFileSync(path.join(root, "server/routes/payouts.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "server/migrations/20260919_payout_integrity.sql"), "utf8");
const schema = fs.readFileSync(path.join(root, "shared/schema/domains/ops-wedding.ts"), "utf8");
const ordersSchema = fs.readFileSync(path.join(root, "shared/schema/domains/commerce-billing.ts"), "utf8");
const marketplaceDocs = fs.readFileSync(path.join(root, "MARKETPLACE_IMPLEMENTATION.md"), "utf8");

test("an unconfigured/simulated provider cannot report or persist payout completion", () => {
  const result = rejectUnavailablePayout({ sellerId: "seller-1", orderIds: ["order-1"] });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "PAYOUT_PROVIDER_UNAVAILABLE");
  assert.equal(result.body.payout, null);
  assert.doesNotMatch(route, /payout_(?:sim|\$\{Date\.now)/);
  assert.doesNotMatch(route, /status:\s*['"]completed['"]/);
});

test("failed preparation has no claim or paid side effect", () => {
  assert.throws(() => rejectUnavailablePayout({ sellerId: "", orderIds: ["order-1"] }));
  assert.doesNotMatch(route, /\.insert\(payouts\)|\.update\(commissions\)/);
});

test("the client cannot choose a payout amount", () => {
  assert.throws(() => rejectUnavailablePayout({ sellerId: "seller-1", amount: "1000000.00" }));
});

test("concurrent payout attempts both fail before claiming an earning", async () => {
  const attempts = await Promise.all(Array.from({ length: 2 }, async () =>
    rejectUnavailablePayout({ sellerId: "seller-1", orderIds: ["order-1"] })));
  assert.deepEqual(attempts.map((attempt) => attempt.status), [503, 503]);
  assert.ok(attempts.every((attempt) => attempt.body.payout === null));
});

test("database state prevents the same order entering two active payout claims", () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS commissions_active_payout_order_uidx/);
  assert.match(migration, /ON commissions \(order_id\)/);
  assert.match(migration, /status IN \('pending', 'processing', 'paid'\)/);
  assert.match(schema, /uniqueIndex\("commissions_active_payout_order_uidx"\)/);
});

test("legacy duplicate claims abort migration without deleting financial history", () => {
  assert.match(migration, /HAVING count\(\*\) > 1/);
  assert.match(migration, /RAISE EXCEPTION/);
  assert.doesNotMatch(migration, /\b(?:DELETE|UPDATE)\s+(?:FROM\s+)?(?:commissions|payouts)\b/i);
});

test("completed is constrained to a non-simulated provider confirmation", () => {
  assert.match(migration, /payouts_completed_transfer_check/);
  assert.match(migration, /provider_payout_id IS NOT NULL/);
  for (const predicate of [
    "left(provider_payout_id, 10) <> 'sq_payout_'",
    "left(provider_payout_id, 11) <> 'payout_sim_'",
  ]) assert.ok(migration.includes(predicate), predicate);
  assert.match(migration, /processed_at IS NOT NULL/);
  assert.match(migration, /completed_at IS NOT NULL/);
});

test("migration and Drizzle schema reject the same known synthetic payout prefixes", () => {
  assert.match(schema, /check\("payouts_completed_transfer_check"/);
  for (const prefix of ["sq_payout_", "payout_sim_"]) {
    assert.ok(migration.includes(prefix), `migration missing ${prefix}`);
    assert.ok(schema.includes(prefix), `schema missing ${prefix}`);
  }
  for (const evidence of ["providerPayoutId", "processedAt", "completedAt"]) {
    assert.ok(schema.includes(evidence), `schema missing ${evidence}`);
  }
});

test("completion constraint idempotency is scoped to the payouts relation", () => {
  assert.match(migration, /conrelid = 'payouts'::regclass/);
});

test("seller payout processing is admin authenticated and accepts no spoofable identity source", () => {
  assert.match(route, /router\.post\("\/process-seller-payout", requireAuth, requireAdmin/);
  assert.doesNotMatch(route, /req\.(?:query|headers).*seller/i);
});

test("unverified orders fail closed for payout eligibility", () => {
  assert.match(route, /PAYOUT_ELIGIBILITY_UNVERIFIABLE/);
  assert.match(route, /pendingBalance: "0\.00"/);
  assert.match(ordersSchema, /squarePaymentId: text\("square_payment_id"\)/);
  assert.doesNotMatch(ordersSchema.slice(ordersSchema.indexOf("export const orders"), ordersSchema.indexOf("export const subscriptionHistory")), /paymentStatus/);
});

test("authenticated seller payout history remains available and principal-scoped", () => {
  assert.match(route, /router\.get\("\/my-payouts", requireAuth/);
  assert.match(route, /const sellerId = req\.user!\.id/);
  assert.match(route, /eq\(payouts\.sellerId, sellerId\)/);
  assert.match(route, /payout\.status === "completed" \? "unverified_legacy"/);
  assert.match(route, /const totalPaidOut = 0/);
});

test("non-payout marketplace routes are not modified by containment", () => {
  assert.doesNotMatch(route, /router\.(?:post|get|patch|delete)\("\/(?:checkout|orders|products)/);
});

test("marketplace documentation describes both fail-closed endpoint contracts", () => {
  assert.match(marketplaceDocs, /503.*PAYOUT_PROVIDER_UNAVAILABLE/);
  assert.match(marketplaceDocs, /503.*PAYOUT_ELIGIBILITY_UNVERIFIABLE/);
  assert.match(marketplaceDocs, /must not interpret this response as a successful zero balance/);
});
