import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const subscriptions = read("./subscriptions.ts");
const users = read("./users.ts");
const nutrition = read("./nutrition.ts");
const wedding = read("./wedding-subscription.ts");
const vendor = read("./vendor-subscription.ts");
const square = read("./square.ts");
const marketplace = read("./marketplace.ts");

test("all paid marketplace tier names lead only to the fail-closed upgrade route", () => {
  for (const tier of ["starter", "professional", "enterprise", "premium_plus"]) {
    assert.match(subscriptions, new RegExp(`z\\.enum\\(\\[[^\\]]*${tier}`));
  }
  assert.match(subscriptions, /router\.post\("\/upgrade", requireAuth/);
  assert.match(subscriptions, /return res\.status\(503\)\.json\(paidUpgradeUnavailableResponse\)/);
  assert.doesNotMatch(subscriptions, /subscriptionTier: tier/);
});

test("alternate paid-domain mutations fail closed while free downgrade remains", () => {
  for (const source of [nutrition, wedding, vendor]) {
    assert.match(source, /subscription\/change", requireAuth/);
    assert.match(source, /tier === "free"/);
    assert.match(source, /status\(503\)\.json\(paidUpgradeUnavailableResponse\)/);
  }
  assert.doesNotMatch(nutrition, /nutritionPremium: true/);
  assert.doesNotMatch(wedding, /weddingTier: tier/);
  assert.doesNotMatch(vendor, /vendorTier: tier/);
});

test("generic profile and direct subscription routes cannot mass assign paid fields or another user", () => {
  const profileBlock = users.slice(users.indexOf('r.put("/:id",'), users.indexOf('r.get("/:id/suggested"'));
  for (const field of ["subscriptionTier", "subscriptionStatus", "subscriptionEndsAt", "nutritionPremium", "weddingTier", "vendorTier"]) {
    assert.doesNotMatch(profileBlock, new RegExp(`${field}: z\\.`));
  }
  assert.match(users, /r\.put\("\/:id\/subscription", requireAuth/);
  assert.match(users, /principal\.id !== req\.params\.id/);
  assert.match(users, /z\.literal\("free"\)/);
});

test("trial self-grants are authenticated, owner-bound, and fail closed", () => {
  assert.match(users, /nutrition\/trial", requireAuth/);
  assert.match(nutrition, /users\/:id\/trial", requireAuth/);
  assert.doesNotMatch(nutrition, /enableNutritionPremium/);
});

test("cancellation never fabricates provider confirmation", () => {
  for (const source of [subscriptions, nutrition, wedding, vendor]) {
    assert.match(source, /status\(503\)\.json\(paidCancellationUnavailableResponse\)/);
  }
  assert.doesNotMatch(subscriptions, /subscriptionStatus: "cancelled"/);
});

test("Square checkout identity is authenticated and cannot be supplied by JSON", () => {
  assert.match(square, /subscription-link", requireAuth/);
  assert.match(square, /userId: principal\.id/);
  assert.doesNotMatch(square, /userId\?: string/);
});

test("premium marketplace feature gate uses canonical current entitlement", () => {
  assert.match(marketplace, /effectiveMarketplaceTier\(seller as any\)/);
});
