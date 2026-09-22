import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  coerceNutritionTierFromUser,
  deriveNutritionStatus,
  hasRecordedNutritionPremium,
} from "./nutrition/helpers";

const nutritionRoute = readFileSync(new URL("./nutrition.ts", import.meta.url), "utf8");
const cancelBlock = nutritionRoute.slice(
  nutritionRoute.indexOf('// POST /api/nutrition/subscription/cancel'),
  nutritionRoute.indexOf('export default r;'),
);

test("recorded premium remains unauthorized but requires provider-backed cancellation", () => {
  const recorded = { nutritionPremium: true, nutritionTrialEndsAt: "2099-01-01T00:00:00Z" };
  assert.equal(coerceNutritionTierFromUser(recorded), "free");
  assert.equal(deriveNutritionStatus(recorded), "inactive");
  assert.equal(hasRecordedNutritionPremium(recorded), true);
  assert.match(cancelBlock, /if \(!hasRecordedNutritionPremium\(user\)\)/);
  assert.match(cancelBlock, /status\(503\)\.json\(paidCancellationUnavailableResponse\)/);
});

test("a user without recorded premium follows the idempotent already-Free path", () => {
  const free = { nutritionPremium: false, nutritionTrialEndsAt: "2099-01-01T00:00:00Z" };
  assert.equal(coerceNutritionTierFromUser(free), "free");
  assert.equal(hasRecordedNutritionPremium(free), false);
  assert.match(cancelBlock, /Nutrition subscription is already on the Free plan/);
  assert.match(cancelBlock, /endsAt: null/);
});

test("cancellation uses only the server-loaded record and never mutates historical state", () => {
  assert.match(cancelBlock, /const user = await storage\.getUser\(userId\)/);
  assert.doesNotMatch(cancelBlock, /req\.body|updateUser|nutritionPremium:\s*false|logNutritionSubscriptionHistory/);
});
