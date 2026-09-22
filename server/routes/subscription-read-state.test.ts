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
  for (const source of [marketplace, nutrition, wedding, vendor]) {
    assert.match(source, /effectiveSubscriptionPresentation/);
    assert.match(source, /status: effectiveState\.status/);
    assert.match(source, /endsAt: effectiveState\.endsAt/);
  }
  assert.doesNotMatch(wedding, /recordedTier,/);
  assert.doesNotMatch(vendor, /recordedTier,/);
});

test("settings treats every effective Free domain as inactive with no renewal", () => {
  for (const domain of ["marketplace", "wedding", "vendor", "nutrition"]) {
    assert.match(settings, new RegExp(`const ${domain}Status = ${domain}CurrentTier === "free"[\\s\\S]*?\\? "inactive"`));
    assert.match(settings, new RegExp(`const ${domain}EndsAt = ${domain}CurrentTier === "free"[\\s\\S]*?\\? null`));
  }
  assert.doesNotMatch(settings, /CurrentTier =\s*[\s\S]{0,100}\?\.(subscriptionTier|weddingTier|vendorTier|nutritionPremium)/);
});
