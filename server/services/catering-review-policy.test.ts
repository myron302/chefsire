import assert from "node:assert/strict";
import test from "node:test";
import { canMutateCustomerReview, cateringReviewViewerId, reviewEligibility, reviewVerification } from "./catering-review-policy";

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
test("only the reviewer may mutate customer review content", () => {
  assert.equal(canMutateCustomerReview("customer", "customer"), true);
  assert.equal(canMutateCustomerReview("customer", "another-customer"), false);
  assert.equal(canMutateCustomerReview("customer", "provider"), false);
});
test("viewer ownership lookup is anonymous-safe and never fabricates provider ownership", () => {
  assert.equal(cateringReviewViewerId(undefined, "chef"), null);
  assert.equal(cateringReviewViewerId("chef", "chef"), null);
  assert.equal(cateringReviewViewerId("customer", "chef"), "customer");
});
