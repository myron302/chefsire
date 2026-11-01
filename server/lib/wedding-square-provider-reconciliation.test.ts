import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyWeddingSquareProviderReconciliation, WeddingSquareProviderReadbackMismatchError } from "./wedding-square-provider-reconciliation";
const saved = {
  attemptId: "attempt-1", status: "needs_reconciliation" as const,
  persistedIdempotencyKey: "key", persistedRequestFingerprint: "a".repeat(64),
  providerSubscriptionId: null, customerId: "customer", cardId: "card",
  locationId: "location", planVariationId: "plan",
  requestedStartDate: "2026-11-11", requestedTimezone: "UTC",
};
const provider = {
  id: "sub-1", customerId: "customer", cardId: "card",
  locationId: "location", planVariationId: "plan", status: "ACTIVE",
  startDate: "2026-11-11", timezone: "UTC",
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
test("COMPLETED readback with matching saved subscription ID only returns operator evidence", () => sandbox(() => {
  const confirmed = {
    ...saved, status: "confirmed" as const, providerSubscriptionId: "sub-1",
  };
  const result = verifyWeddingSquareProviderReconciliation(confirmed, { ...provider, status: "COMPLETED" });
  assert.equal(result.providerSubscriptionId, "sub-1");
  assert.equal(result.providerStatus, "COMPLETED");
  assert.equal(result.existingIdMatches, true);
  assert.equal(result.requiresOperatorReconciliation, true);
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.safeToResubmit, false);
}));
test("COMPLETED readback without a saved subscription ID still cannot grant or resubmit", () => sandbox(() => {
  const result = verifyWeddingSquareProviderReconciliation(saved, { ...provider, status: "COMPLETED" });
  assert.equal(result.existingIdMatches, false);
  assert.equal(result.requiresOperatorReconciliation, true);
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.safeToResubmit, false);
}));
test("rejects cross-customer, card, location and plan records", () => sandbox(() => {
  for (const key of ["customerId", "cardId", "locationId", "planVariationId"] as const) {
    assert.throws(() => verifyWeddingSquareProviderReconciliation(saved, { ...provider, [key]: "other" }), WeddingSquareProviderReadbackMismatchError);
  }
}));
test("rejects provider start dates or timezones that differ from saved consented billing terms", () => sandbox(() => {
  for (const patch of [
    { startDate: "2026-11-10" },
    { startDate: "2026-11-12" },
    { startDate: "2026-02-30" },
    { startDate: "2026-11-11T00:00:00Z" },
    { timezone: "America/New_York" },
    { timezone: undefined },
    { startDate: undefined },
  ]) {
    assert.throws(() => verifyWeddingSquareProviderReconciliation(saved, { ...provider, ...patch }), WeddingSquareProviderReadbackMismatchError);
  }
  for (const patch of [
    { requestedStartDate: "2026-11-10" },
    { requestedTimezone: "America/New_York" },
    { requestedStartDate: undefined },
  ]) {
    assert.throws(() => verifyWeddingSquareProviderReconciliation({ ...saved, ...patch } as typeof saved, provider), WeddingSquareProviderReadbackMismatchError);
  }
}));

test("immediate-start attempts still require a canonical UTC provider date", () => sandbox(() => {
  const immediate = { ...saved, requestedStartDate: null };
  assert.equal(verifyWeddingSquareProviderReconciliation(immediate, provider).grantsEntitlement, false);
  assert.throws(() => verifyWeddingSquareProviderReconciliation(immediate, { ...provider, startDate: "2026-02-30" }), WeddingSquareProviderReadbackMismatchError);
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

test("provider reconciliation rejects malformed identities even when saved and provider IDs match", () => sandbox(() => {
  const bad = "same" + String.fromCharCode(0) + "id";
  for (const key of ["customerId", "cardId", "locationId", "planVariationId"] as const) {
    assert.throws(
      () => verifyWeddingSquareProviderReconciliation(
        { ...saved, [key]: bad },
        { ...provider, [key]: bad },
      ),
      WeddingSquareProviderReadbackMismatchError,
    );
  }
  for (const key of ["id", "customerId", "cardId", "locationId", "planVariationId"] as const) {
    assert.throws(
      () => verifyWeddingSquareProviderReconciliation(saved, { ...provider, [key]: "bad\\tvalue" }),
      WeddingSquareProviderReadbackMismatchError,
    );
  }
  for (const patch of [
    { attemptId: "attempt" + String.fromCharCode(127) + "-1" },
    { persistedIdempotencyKey: "key\\nother" },
  ]) {
    assert.throws(
      () => verifyWeddingSquareProviderReconciliation({ ...saved, ...patch }, provider),
      WeddingSquareProviderReadbackMismatchError,
    );
  }
}));

test("confirmed provider evidence requires a canonical saved subscription ID", () => sandbox(() => {
  assert.throws(
    () => verifyWeddingSquareProviderReconciliation({ ...saved, status: "confirmed" }, provider),
    WeddingSquareProviderReadbackMismatchError,
  );
  const bad = "sub" + String.fromCharCode(0) + "-1";
  assert.throws(
    () => verifyWeddingSquareProviderReconciliation(
      { ...saved, status: "confirmed", providerSubscriptionId: bad },
      { ...provider, id: bad },
    ),
    WeddingSquareProviderReadbackMismatchError,
  );
}));
