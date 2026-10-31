import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyWeddingSquareProviderReconciliation, WeddingSquareProviderReadbackMismatchError } from "./wedding-square-provider-reconciliation";
const saved = {
  attemptId: "attempt-1", status: "needs_reconciliation" as const,
  persistedIdempotencyKey: "key", persistedRequestFingerprint: "a".repeat(64),
  providerSubscriptionId: null, customerId: "customer", cardId: "card",
  locationId: "location", planVariationId: "plan",
};
const provider = {
  id: "sub-1", customerId: "customer", cardId: "card",
  locationId: "location", planVariationId: "plan", status: "ACTIVE",
};
function sandbox(fn: () => void) {
  const env = process.env.SQUARE_ENV, enabled = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  process.env.SQUARE_ENV = "sandbox"; process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  try { fn(); } finally {
    if (env === undefined) delete process.env.SQUARE_ENV; else process.env.SQUARE_ENV = env;
    if (enabled === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED; else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = enabled;
  }
}
test("matching provider record is only an operator-reconciliation candidate", () => sandbox(() => {
  const result = verifyWeddingSquareProviderReconciliation(saved, provider);
  assert.equal(result.providerSubscriptionId, "sub-1");
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.safeToResubmit, false);
  assert.equal(result.requiresOperatorReconciliation, true);
}));
test("rejects cross-customer, card, location and plan records", () => sandbox(() => {
  for (const key of ["customerId", "cardId", "locationId", "planVariationId"] as const) {
    assert.throws(() => verifyWeddingSquareProviderReconciliation(saved, { ...provider, [key]: "other" }), WeddingSquareProviderReadbackMismatchError);
  }
}));
test("never swaps a previously confirmed subscription ID", () => sandbox(() => {
  assert.throws(() => verifyWeddingSquareProviderReconciliation({
    ...saved, status: "confirmed", providerSubscriptionId: "sub-original",
  }, provider), WeddingSquareProviderReadbackMismatchError);
}));
test("disabled mode and malformed statuses fail closed", () => sandbox(() => {
  assert.throws(() => verifyWeddingSquareProviderReconciliation(saved, { ...provider, status: "UNKNOWN" }), WeddingSquareProviderReadbackMismatchError);
  const old = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  try { assert.throws(() => verifyWeddingSquareProviderReconciliation(saved, provider), WeddingSquareProviderReadbackMismatchError); }
  finally { if (old !== undefined) process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = old; }
}));
