import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isMealPlanEntitlement } from "../lib/meal-plan-entitlement";

const plans = readFileSync(new URL("./meal-plans.ts", import.meta.url), "utf8");
const social = readFileSync(new URL("./meal-social.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/20260928_meal_plan_payment_fail_closed.sql", import.meta.url), "utf8");

const invalidStatuses = ["legacy_unverified", "unverified", "pending", "failed", "cancelled"];

test("historical and other unverified purchasers cannot validate reviews", () => {
  for (const paymentStatus of invalidStatuses) {
    assert.equal(isMealPlanEntitlement({ paymentStatus, acquisitionType: "legacy_unverified", pricePaidCents: 1000 }), false);
  }
});

test("verified paid and free purchasers remain eligible reviewers", () => {
  assert.equal(isMealPlanEntitlement({
    paymentStatus: "verified_paid", acquisitionType: "paid", pricePaidCents: 1000,
    paymentProvider: "square", providerPaymentId: "payment", providerPaymentStatus: "COMPLETED", paymentVerifiedAt: new Date(),
  }), true);
  assert.equal(isMealPlanEntitlement({
    paymentStatus: "free_acquired", acquisitionType: "free", pricePaidCents: 0,
  }), true);
});

test("plan detail review list and rating aggregate require current entitlement", () => {
  const detail = plans.slice(plans.indexOf('// Get single meal plan details'), plans.indexOf('// Purchase meal plan'));
  assert.match(detail, /from\(mealPlanReviews\)[\s\S]*mealPlanReviewEntitlementPredicate/);
  assert.match(detail, /avg\(\$\{mealPlanReviews\.rating\}\)[\s\S]*mealPlanReviewEntitlementPredicate/);
  assert.doesNotMatch(detail, /\.where\(eq\(mealPlanReviews\.blueprintId, planId\)\)/);
});

test("marketplace, discovery, recommendations, and creator analytics filter invalid reviews", () => {
  assert.match(plans, /leftJoin\(mealPlanReviews, and\([\s\S]*mealPlanReviewEntitlementPredicate/);
  assert.match(plans, /ORDER BY[\s\S]*mealPlanReviewEntitlementPredicate[\s\S]*DESC NULLS LAST/);
  for (const line of plans.split("\n").filter((line) => /SELECT (AVG\(r\.rating\)|COUNT\(\*\).*meal_plan_reviews r)/.test(line))) {
    assert.match(line, /mealPlanReviewEntitlementPredicate/);
  }
  assert.match(plans, /LEFT JOIN meal_plan_reviews r ON r\.blueprint_id = b\.id[\s\S]*mealPlanReviewEntitlementPredicate/);
});

test("creator storefront and saved-plan review aggregates use the same predicate", () => {
  const reviewAggregateLines = social.split("\n").filter((line) => line.includes("meal_plan_reviews r"));
  assert.ok(reviewAggregateLines.length >= 5);
  for (const line of reviewAggregateLines) assert.match(line, /mealPlanReviewEntitlementPredicate/);
});

test("review submission uses the centralized entitlement rule and history is preserved", () => {
  const handler = plans.slice(plans.indexOf('router.post("/meal-plans/:id/review"'), plans.indexOf('// Update meal plan blueprint'));
  assert.match(handler, /mealPlanEntitlementPredicate/);
  assert.doesNotMatch(migration, /DELETE FROM meal_plan_reviews|UPDATE meal_plan_reviews/);
});
