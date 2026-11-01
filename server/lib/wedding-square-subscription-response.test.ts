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

test("noncanonical provider subscription IDs require reconciliation, not persistence", () => {
  for (const id of [
    " square-sub-1", "square-sub-1 ", "\tsquare-sub-1",
    "square\nsub-1", "square\u0000sub-1", "square\u007fsub-1",
    " ", "\n", 12, null,
  ]) {
    assert.throws(
      () => verifyWeddingSquareCreatedSubscription(request, { ...response, id }),
      WeddingSquareReconciliationRequiredError,
    );
  }
  // Valid opaque provider identifiers remain untouched, never normalized.
  assert.equal(
    verifyWeddingSquareCreatedSubscription(request, { ...response, id: "SUB_123-abc" }).providerSubscriptionId,
    "SUB_123-abc",
  );
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

test("matching malformed request and provider identities cannot confirm an attempt", () => {
  for (const field of ["locationId", "customerId", "cardId", "planVariationId"] as const) {
    for (const invalid of [" padded ", "matching\ncontrol", "matching\u0000nul", "matching\u007fdel"]) {
      const claimed = { ...request, [field]: invalid };
      const provider = { ...response, [field]: invalid };
      assert.throws(
        () => verifyWeddingSquareCreatedSubscription(claimed, provider),
        WeddingSquareReconciliationRequiredError,
      );
    }
  }
});

test("malformed or missing claimed idempotency and request evidence fail closed", () => {
  for (const invalid of [" key ", "key\nvalue", "key\u0000value", "key\u007fvalue", "", null, 123]) {
    assert.throws(
      () => verifyWeddingSquareCreatedSubscription({ ...request, idempotencyKey: invalid } as any, response),
      WeddingSquareReconciliationRequiredError,
    );
  }
  for (const claimed of [null, {}, { ...request, customerId: undefined }, { ...request, timezone: "EST" }]) {
    assert.throws(
      () => verifyWeddingSquareCreatedSubscription(claimed as any, response),
      WeddingSquareReconciliationRequiredError,
    );
  }
});

test("matching impossible calendar dates are not valid provider confirmation evidence", () => {
  for (const invalid of ["2026-02-30", "2026-11-31", "2026-13-01", "2026-00-10"]) {
    assert.throws(
      () => verifyWeddingSquareCreatedSubscription(
        { ...request, startDate: invalid }, { ...response, startDate: invalid },
      ),
      WeddingSquareReconciliationRequiredError,
    );
  }
  const valid = verifyWeddingSquareCreatedSubscription(
    { ...request, startDate: "2028-02-29" },
    { ...response, startDate: "2028-02-29" },
  );
  assert.equal(valid.providerSubscriptionId, "square-sub-1");
});
