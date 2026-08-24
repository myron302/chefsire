import assert from "node:assert/strict";
import test from "node:test";
import { reviewEligibility, reviewVerification } from "./catering-review-policy";

test("rejects self reviews and unlisted providers", () => {
  assert.equal(reviewEligibility({ reviewerId: "one", providerId: "one", providerEnabled: true }).allowed, false);
  assert.equal(reviewEligibility({ reviewerId: "one", providerId: "two", providerEnabled: false }).allowed, false);
  assert.equal(reviewEligibility({ reviewerId: "one", providerId: "two", providerEnabled: true }).allowed, true);
});
test("inquiry association requires both customer and provider ownership", () => {
  const inquiry = { customerId: "customer", chefId: "chef", status: "accepted" };
  assert.equal(reviewVerification(inquiry, "customer", "chef"), false);
  assert.throws(() => reviewVerification(inquiry, "attacker", "chef"), /INQUIRY_MISMATCH/);
  assert.throws(() => reviewVerification(inquiry, "customer", "other"), /INQUIRY_MISMATCH/);
});
test("ordinary reviews remain unverified", () => assert.equal(reviewVerification(null, "customer", "chef"), false));
