import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isMealPlanEntitlement } from "../lib/meal-plan-entitlement";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("./meal-plans.ts");
const helpers = read("./meal-plans/utils.ts");
const schema = read("../../shared/schema/domains/meal-planning.ts");
const migration = read("../migrations/20260928_meal_plan_payment_fail_closed.sql");
const purchaseStart = route.indexOf('router.post("/meal-plans/:id/purchase"');
const purchaseEnd = route.indexOf("// Get user's purchased meal plans", purchaseStart);
const purchaseHandler = route.slice(purchaseStart, purchaseEnd);
const libraryStart = route.indexOf('router.get("/my-purchases"');
const libraryEnd = route.indexOf("// Add review", libraryStart);
const libraryHandler = route.slice(libraryStart, libraryEnd);
const reviewStart = route.indexOf('router.post("/meal-plans/:id/review"');
const reviewEnd = route.indexOf("// Update meal plan blueprint", reviewStart);
const reviewHandler = route.slice(reviewStart, reviewEnd);

test("legacy, unverified, pending, failed, and cancelled rows grant no entitlement", () => {
  for (const paymentStatus of ["legacy_unverified", "unverified", "pending", "failed", "cancelled", "completed"]) {
    assert.equal(isMealPlanEntitlement({ paymentStatus, acquisitionType: "legacy_unverified", pricePaidCents: 2500 }), false);
  }
});

test("only complete provider evidence establishes paid entitlement", () => {
  const complete = {
    paymentStatus: "verified_paid", acquisitionType: "paid", pricePaidCents: 2500,
    paymentProvider: "square", providerPaymentId: "payment-1",
    providerPaymentStatus: "COMPLETED", paymentVerifiedAt: new Date(),
  };
  assert.equal(isMealPlanEntitlement(complete), true);
  for (const key of ["paymentProvider", "providerPaymentId", "providerPaymentStatus", "paymentVerifiedAt"] as const) {
    assert.equal(isMealPlanEntitlement({ ...complete, [key]: null }), false);
  }
});

test("free entitlement is explicit and contains no fabricated provider evidence", () => {
  assert.equal(isMealPlanEntitlement({
    paymentStatus: "free_acquired", acquisitionType: "free", pricePaidCents: 0,
    paymentProvider: null, providerPaymentId: null, providerPaymentStatus: null, paymentVerifiedAt: null,
  }), true);
  assert.equal(isMealPlanEntitlement({ paymentStatus: "free_acquired", acquisitionType: "free", pricePaidCents: 1 }), false);
});

test("published zero-price acquisition is atomic and idempotent", () => {
  assert.match(purchaseHandler, /plan\.priceInCents === 0/);
  assert.match(purchaseHandler, /INSERT INTO meal_plan_purchases/);
  assert.match(purchaseHandler, /FROM meal_plan_blueprints b[\s\S]*b\.status = 'published'[\s\S]*b\.price_in_cents = 0/);
  assert.match(purchaseHandler, /ON CONFLICT DO NOTHING/);
  assert.match(schema, /meal_plan_purchases_entitlement_identity_uidx/);
  assert.match(purchaseHandler, /'free', NULL, NULL, NULL, NULL, NULL, NULL/);
  assert.doesNotMatch(purchaseHandler, /insert\(creatorAnalytics\)|salesCount.*\+ 1/);
});

test("paid checkout remains fail closed and cannot fabricate evidence", () => {
  assert.match(purchaseHandler, /status\(503\).*MEAL_PLAN_CHECKOUT_UNAVAILABLE/s);
  assert.doesNotMatch(purchaseHandler, /paymentStatus:\s*"completed"|buildSimulatedTransactionId/);
  assert.doesNotMatch(helpers, /sim_/);
});

test("library and review eligibility use the centralized entitlement predicate", () => {
  assert.match(libraryHandler, /mealPlanEntitlementPredicate/);
  assert.match(reviewHandler, /mealPlanEntitlementPredicate/);
  assert.doesNotMatch(libraryHandler, /where\(eq\(mealPlanPurchases\.userId, userId\)\)/);
  assert.doesNotMatch(reviewHandler, /where\(and\(eq\(mealPlanPurchases\.userId, userId\), eq\(mealPlanPurchases\.blueprintId, planId\)\)\)/);
});

test("financial queries count verified paid rows, never legacy or free acquisitions", () => {
  assert.doesNotMatch(route, /p\.payment_status = 'completed'/);
  assert.match(route, /p\.payment_status = 'verified_paid'/);
  assert.match(migration, /SET sales_count = authoritative\.paid_sales/);
  assert.match(migration, /SET total_sales = authoritative\.paid_sales/);
  assert.match(migration, /total_revenue_cents = authoritative\.paid_revenue/);
  assert.match(migration, /payment_status = 'verified_paid'/);
});

test("database guard rejects stale completed writes on insert and update", () => {
  assert.match(schema, /check\("meal_plan_purchases_authoritative_evidence_chk"/);
  assert.match(migration, /ADD CONSTRAINT meal_plan_purchases_authoritative_evidence_chk CHECK/);
  assert.match(migration, /payment_status NOT IN \('completed', 'verified_paid', 'free_acquired'\)/);
  assert.match(migration, /payment_status = 'verified_paid'[\s\S]*provider_payment_status = 'COMPLETED'/);
  assert.match(migration, /payment_status = 'free_acquired'[\s\S]*price_paid_cents = 0/);
  assert.ok(migration.indexOf("UPDATE meal_plan_purchases") < migration.indexOf("ADD CONSTRAINT meal_plan_purchases_authoritative_evidence_chk"));
});

test("legacy history is retained and explicitly unverified", () => {
  assert.match(migration, /SET payment_status = 'legacy_unverified'/);
  assert.doesNotMatch(migration, /DELETE FROM meal_plan_purchases/);
});
