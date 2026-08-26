import assert from "node:assert/strict";
import test from "node:test";
import { cateringReviewAggregate, cateringReviewCreateSchema, cateringReviewEditSchema, cateringReviewQuerySchema, cateringReviewResponseSchema, qualifiesAsVerifiedCateringEvent } from "./catering-reviews";

test("review creation validates rating and trims content", () => {
  const valid = cateringReviewCreateSchema.parse({ providerId: "chef-1", rating: 5, title: " Great ", body: " Excellent service. " });
  assert.equal(valid.title, "Great"); assert.equal(valid.body, "Excellent service.");
  for (const rating of [0, 1.5, 6]) assert.equal(cateringReviewCreateSchema.safeParse({ providerId: "chef-1", rating, body: "Long enough review" }).success, false);
});
test("ownership and trust fields cannot be crafted", () => {
  assert.equal(cateringReviewCreateSchema.safeParse({ providerId: "chef-1", reviewerId: "attacker", verifiedEvent: true, rating: 5, body: "Long enough review" }).success, false);
  assert.equal(cateringReviewEditSchema.safeParse({ providerId: "chef-2", verifiedEvent: true }).success, false);
});
test("body, response, filters, and pagination are bounded", () => {
  assert.equal(cateringReviewCreateSchema.safeParse({ providerId: "chef-1", rating: 3, body: "  " }).success, false);
  assert.equal(cateringReviewResponseSchema.safeParse({ response: "x" }).success, false);
  assert.equal(cateringReviewQuerySchema.safeParse({ limit: "51" }).success, false);
  assert.deepEqual(cateringReviewQuerySchema.parse({}), { sort: "newest", page: 1, limit: 10 });
});
test("an inquiry is never treated as proof of a completed event", () => {
  assert.equal(qualifiesAsVerifiedCateringEvent({ status: "pending" }), false);
  assert.equal(qualifiesAsVerifiedCateringEvent({ status: "accepted" }), false);
});
test("aggregate returns weighted average, count, distribution, and truthful empty state", () => {
  assert.deepEqual(cateringReviewAggregate([]), { averageRating: null, reviewCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  assert.deepEqual(cateringReviewAggregate([{ rating: 5, count: 2 }, { rating: 2, count: 1 }]), { averageRating: 4, reviewCount: 3, distribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 2 } });
});
test("aggregate reflects review edits and deletions", () => {
  const before = cateringReviewAggregate([{ rating: 2, count: 1 }, { rating: 4, count: 1 }]);
  const afterEdit = cateringReviewAggregate([{ rating: 4, count: 1 }, { rating: 5, count: 1 }]);
  const afterDelete = cateringReviewAggregate([{ rating: 5, count: 1 }]);
  assert.equal(before.averageRating, 3);
  assert.equal(afterEdit.averageRating, 4.5);
  assert.equal(afterDelete.reviewCount, 1);
});
test("edit accepts customer content only and rejects a forced verified flag", () => {
  assert.deepEqual(cateringReviewEditSchema.parse({ rating: 3, title: null, body: "Updated review body" }), { rating: 3, title: null, body: "Updated review body" });
  assert.equal(cateringReviewEditSchema.safeParse({ rating: 5, verifiedEvent: true }).success, false);
  assert.equal(cateringReviewEditSchema.safeParse({ rating: 5, reviewerId: "other" }).success, false);
});
