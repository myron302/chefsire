import assert from "node:assert/strict";
import { test } from "node:test";
import { transitionWeddingEnrollmentAttempt } from "./wedding-square-attempt-state";

test("only reserved attempts may begin submission", () => {
  assert.equal(transitionWeddingEnrollmentAttempt("reserved", "start_submission"), "submitting");
  for (const state of ["submitting", "needs_reconciliation", "confirmed", "aborted"] as const) {
    assert.throws(() => transitionWeddingEnrollmentAttempt(state, "start_submission"));
  }
});
test("ambiguous network outcome must remain pending reconciliation", () => {
  assert.equal(transitionWeddingEnrollmentAttempt("submitting", "unknown_outcome"), "needs_reconciliation");
  assert.equal(transitionWeddingEnrollmentAttempt("needs_reconciliation", "provider_found"), "confirmed");
  assert.equal(transitionWeddingEnrollmentAttempt("needs_reconciliation", "provider_absent"), "aborted");
});
test("provider creation is not paid entitlement", () => {
  assert.equal(transitionWeddingEnrollmentAttempt("submitting", "provider_created"), "confirmed");
  assert.throws(() => transitionWeddingEnrollmentAttempt("confirmed", "provider_created"));
});
test("invalid transitions fail closed", () => {
  assert.throws(() => transitionWeddingEnrollmentAttempt("reserved", "provider_created"));
  assert.throws(() => transitionWeddingEnrollmentAttempt("aborted", "start_submission"));
});
