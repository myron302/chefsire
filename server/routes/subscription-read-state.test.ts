import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const marketplace = read("./subscriptions.ts");
const nutrition = read("./nutrition.ts");
const wedding = read("./wedding-subscription.ts");
const vendor = read("./vendor-subscription.ts");
const settings = read("../../client/src/pages/settings.tsx");

test("every subscription read derives status and end date from effective tier", () => {
  // Nutrition is NOT in this list, and that is not an exemption. Marketplace and vendor reconcile recorded tier
  // columns through effectiveSubscriptionPresentation, so a lapsed member cannot be shown "active" from a stale
  // column. Nutrition reaches the same guarantee a stronger way: it asks nutritionEntitlement, which is
  // server-verified, and treats the legacy user columns as no evidence at all. Requiring the reconciliation
  // helper there would be requiring the weaker of the two. The test below pins nutrition's own rule instead, so
  // the protection is not lost -- only expressed where it actually lives.
  for (const source of [marketplace, vendor]) {
    assert.match(source, /effectiveSubscriptionPresentation/);
    assert.match(source, /status: effectiveState\.status/);
    assert.match(source, /endsAt: effectiveState\.endsAt/);
  }
  assert.match(wedding, /await weddingEntitlement\(user.id, recordedTier\)/);
  assert.match(wedding, /\.\.\.entitlement/);
  assert.doesNotMatch(vendor, /recordedTier,/);
});

test("the nutrition read derives status from the verified entitlement, never from legacy columns", () => {
  // The same guarantee as the test above, in nutrition's own terms: status and endsAt both come from
  // nutritionEntitlement, and nothing is read off the user row to decide whether premium is active.
  assert.match(nutrition, /const entitlement = await nutritionEntitlement\(user\.id\)/);
  assert.match(nutrition, /status: entitlement\.premium \? "active" : "inactive"/);
  assert.match(nutrition, /endsAt: entitlement\.endsAt/);
  assert.doesNotMatch(nutrition, /status:\s*\(user as any\)\.(nutritionStatus|subscriptionStatus)/);
  assert.doesNotMatch(nutrition, /endsAt:\s*\(user as any\)\./);
});

test("settings treats every effective Free domain as inactive with no renewal", () => {
  for (const domain of ["marketplace", "wedding", "vendor", "nutrition"]) {
    assert.match(settings, new RegExp(`const ${domain}Status = ${domain}CurrentTier === "free"[\\s\\S]*?\\? "inactive"`));
    assert.match(settings, new RegExp(`const ${domain}EndsAt = ${domain}CurrentTier === "free"[\\s\\S]*?\\? null`));
  }
  assert.doesNotMatch(settings, /CurrentTier =\s*[\s\S]{0,100}\?\.(subscriptionTier|weddingTier|vendorTier|nutritionPremium)/);
});
