import assert from "node:assert/strict";
import test from "node:test";
import { cateringReviewRelationshipLockIds } from "./catering-review-relationship-lock";

test("review creation and completion derive the identical relationship lock identity", () => {
  assert.deepEqual(cateringReviewRelationshipLockIds("customer-1", "provider-1"), cateringReviewRelationshipLockIds("customer-1", "provider-1"));
});
test("customer and provider dimensions cannot be swapped or substituted", () => {
  assert.notDeepEqual(cateringReviewRelationshipLockIds("customer-1", "provider-1"), cateringReviewRelationshipLockIds("provider-1", "customer-1"));
  assert.notDeepEqual(cateringReviewRelationshipLockIds("customer-2", "provider-1"), cateringReviewRelationshipLockIds("customer-1", "provider-1"));
  assert.notDeepEqual(cateringReviewRelationshipLockIds("customer-1", "provider-2"), cateringReviewRelationshipLockIds("customer-1", "provider-1"));
});
