import assert from "node:assert/strict";
import test from "node:test";
import { customerReviewAction, pageAfterReviewDeletion } from "./catering-review-state";

test("customer without a review may create after ownership resolves", () => {
  assert.equal(customerReviewAction({ authLoading: false, viewerId: "customer", providerId: "chef", viewerReview: null }), "create");
});
test("customer with an existing review manages it regardless of visible page", () => {
  assert.equal(customerReviewAction({ authLoading: false, viewerId: "customer", providerId: "chef", viewerReview: { id: "outside-page", rating: 4, title: null, body: "A persisted review" } }), "manage");
});
test("unresolved auth or ownership and provider self-view expose no customer action", () => {
  assert.equal(customerReviewAction({ authLoading: true, providerId: "chef", viewerReview: undefined }), "none");
  assert.equal(customerReviewAction({ authLoading: false, viewerId: "chef", providerId: "chef", viewerReview: null }), "none");
});
test("deleting the only result on a later page moves back one page", () => {
  assert.equal(pageAfterReviewDeletion(3, 1), 2);
  assert.equal(pageAfterReviewDeletion(1, 1), 1);
  assert.equal(pageAfterReviewDeletion(3, 2), 3);
});
