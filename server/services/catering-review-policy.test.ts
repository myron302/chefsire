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
  assert.equal(reviewVerification(inquiry, [], "customer", "chef"), false);
  assert.throws(() => reviewVerification(inquiry, [], "attacker", "chef"), /INQUIRY_MISMATCH/);
  assert.throws(() => reviewVerification(inquiry, [], "customer", "other"), /INQUIRY_MISMATCH/);
});
test("normal UI review is verified from completed reviewer-provider evidence without inquiry ID", () => {
  assert.equal(reviewVerification(null, [{ customerId: "customer", providerId: "chef", status: "completed", completedAt: new Date() }], "customer", "chef"), true);
  assert.equal(reviewVerification(null, [], "customer", "chef"), false);
});
test("a pre-existing participant review upgrades only after explicit completion", () => {
  const relationship = { customerId: "customer", providerId: "chef" };
  assert.equal(reviewVerification(null, [{ ...relationship, status: "confirmed", completedAt: null }], "customer", "chef"), false);
  assert.equal(reviewVerification(null, [{ ...relationship, status: "completed", completedAt: new Date() }], "customer", "chef"), true);
});
test("only completed state qualifies and multiple completed bookings remain unambiguous", () => {
  const relationship = { customerId: "customer", providerId: "chef" };
  for (const status of ["pending_confirmation", "confirmed", "cancelled"]) assert.equal(reviewVerification(null, [{ ...relationship, status, completedAt: status === "confirmed" ? new Date() : null }], "customer", "chef"), false);
  assert.equal(reviewVerification(null, [{ ...relationship, status: "completed", completedAt: new Date() }, { ...relationship, status: "completed", completedAt: new Date() }], "customer", "chef"), true);
});
test("completed evidence is scoped to the exact customer and provider", () => {
  const completed = { status: "completed", completedAt: new Date() };
  assert.equal(reviewVerification(null, [{ ...completed, customerId: "other", providerId: "chef" }], "customer", "chef"), false);
  assert.equal(reviewVerification(null, [{ ...completed, customerId: "customer", providerId: "other" }], "customer", "chef"), false);
});
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
