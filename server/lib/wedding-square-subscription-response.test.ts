import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyWeddingSquareCreatedSubscription, WeddingSquareReconciliationRequiredError } from "./wedding-square-subscription-response";

const request = {
  idempotencyKey: "stable-enrollment-attempt",
  locationId: "loc-1",
  customerId: "cust-1",
  planVariationId: "plan-premium",
  cardId: "card-1",
  timezone: "UTC" as const,
  startDate: "2026-11-11",
};
const response = {
  id: "square-sub-1",
  locationId: "loc-1",
  customerId: "cust-1",
  planVariationId: "plan-premium",
  cardId: "card-1",
  timezone: "UTC",
  startDate: "2026-11-11",
  status: "PENDING",
};

test("confirms a matching provider response without creating entitlement", () => {
  const verified = verifyWeddingSquareCreatedSubscription(request, response);
  assert.deepEqual(verified, {
    providerSubscriptionId: "square-sub-1",
    providerStatus: "PENDING",
    verifiedLocationId: "loc-1",
    verifiedPlanVariationId: "plan-premium",
  });
  assert.equal("paid" in verified, false);
});

test("mismatched provider ownership, plan, timezone or date requires reconciliation", () => {
  for (const patch of [
    { locationId: "other" }, { customerId: "other" },
    { cardId: "other" }, { planVariationId: "plan-elite" },
    { timezone: "America/New_York" }, { startDate: "2026-11-10" },
    { id: "" },
  ]) {
    assert.throws(() => verifyWeddingSquareCreatedSubscription(request, { ...response, ...patch }), WeddingSquareReconciliationRequiredError);
  }
});

test("missing, malformed or unexpected subscription statuses fail closed", () => {
  for (const result of [undefined, null, {}, { ...response, status: "CANCELED" }, { ...response, status: "FAILED" }]) {
    assert.throws(() => verifyWeddingSquareCreatedSubscription(request, result), WeddingSquareReconciliationRequiredError);
  }
});

test("an ACTIVE provider subscription is not proof of payment", () => {
  const verified = verifyWeddingSquareCreatedSubscription(request, { ...response, status: "ACTIVE" });
  assert.equal(verified.providerStatus, "ACTIVE");
  assert.equal("verifiedPaidThrough" in verified, false);
});

test("immediate start accepts Square's same-day UTC start when submission date is known", () => {
  const { startDate: _omitted, ...immediateRequest } = request;
  const verified = verifyWeddingSquareCreatedSubscription(
    immediateRequest, { ...response, startDate: "2026-10-29", status: "ACTIVE" }, "2026-10-29",
  );
  assert.equal(verified.providerSubscriptionId, "square-sub-1");
  assert.equal("verifiedPaidThrough" in verified, false);
});

test("immediate start rejects unexpected, delayed and missing provider start dates", () => {
  const { startDate: _omitted, ...immediateRequest } = request;
  for (const unexpected of ["2026-10-28", "2026-10-30", "2026-11-11", undefined]) {
    assert.throws(() => verifyWeddingSquareCreatedSubscription(
      immediateRequest, { ...response, startDate: unexpected }, "2026-10-29",
    ), WeddingSquareReconciliationRequiredError);
  }
});

test("immediate start requires an authenticated submission UTC date", () => {
  const { startDate: _omitted, ...immediateRequest } = request;
  for (const submissionDate of [undefined, "", "2026-02-30", "2026-99-99"]) {
    assert.throws(() => verifyWeddingSquareCreatedSubscription(
      immediateRequest, { ...response, startDate: "2026-10-29" }, submissionDate,
    ), WeddingSquareReconciliationRequiredError);
  }
});
