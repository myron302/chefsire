import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import {
  createWeddingSquareSandboxSubscriptionSubmitter,
  WeddingSquareSandboxSubmissionError,
} from "./wedding-square-sandbox-subscription-submitter";

const claimRequest = Object.freeze({
  idempotencyKey: "persistent-key",
  locationId: "location-1",
  planVariationId: "premium-var",
  customerId: "customer-1",
  cardId: "card-1",
  timezone: "UTC" as const,
  startDate: "2026-11-22",
});
const owner = {
  attemptId: "attempt-1",
  authenticatedUserId: "user-1",
  expectedSandboxMerchantId: "merchant-1",
  savedBinding: { userId: "user-1", squareEnvironment: "sandbox", squareMerchantId: "merchant-1", squareCustomerId: "customer-1" },
  providerCustomer: { id: "customer-1", squareMerchantId: "merchant-1" },
  providerCard: { id: "card-1", customerId: "customer-1" },
} as const;
const attestation = Object.freeze({
  merchantId: "merchant-1", locationId: "location-1",
  premiumPlanVariationId: "premium-var", elitePlanVariationId: "elite-var",
  verifiedSandboxCatalogTerms: true,
  authorizesSubscriptionCreation: false,
  grantsEntitlement: false,
  safeToResubmit: false,
});
const provider = {
  subscription: {
    id: "sub-1", locationId: "location-1", planVariationId: "premium-var",
    customerId: "customer-1", cardId: "card-1", timezone: "UTC",
    startDate: "2026-11-22", status: "PENDING",
  },
};

async function sandbox(run: () => Promise<void>) {
  const keys = ["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","SQUARE_LOCATION_ID"] as const;
  const prior = keys.map((k) => process.env[k]);
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_LOCATION_ID = "location-1";
  try { await run(); } finally {
    keys.forEach((k, i) => { if (prior[i] === undefined) delete process.env[k]; else process.env[k] = prior[i]; });
  }
}

function mock(options: {
  attest?: unknown;
  claim?: unknown;
  response?: unknown;
  confirmed?: unknown;
  fail?: "attest" | "claim" | "create" | "confirm" | "unknown";
} = {}) {
  const calls: string[] = [];
  const inspect = async () => {
    calls.push("attest");
    if (options.fail === "attest") throw new Error("secret access token");
    return options.attest === undefined ? attestation : options.attest;
  };
  const prepare = async (input: unknown) => {
    calls.push("claim");
    assert.deepEqual(input, owner);
    if (options.fail === "claim") throw new Error("private user identity");
    return options.claim === undefined
      ? { attemptId: "attempt-1", status: "submitting", request: claimRequest } : options.claim;
  };
  const create = async (request: unknown) => {
    calls.push("square-create");
    assert.deepEqual(request, claimRequest);
    if (options.fail === "create") throw new Error("provider token or card PAN");
    return options.response === undefined ? provider : options.response;
  };
  const confirm = async (input: any) => {
    calls.push("confirm");
    assert.equal(input.attemptId, "attempt-1");
    assert.equal(input.authenticatedUserId, "user-1");
    assert.deepEqual(input.claimedRequest, claimRequest);
    assert.equal(input.claimStatus, "submitting");
    assert.deepEqual(input.providerResponse, provider.subscription);
    assert.match(input.submissionUtcDate, /^\d{4}-\d{2}-\d{2}$/);
    if (options.fail === "confirm") throw new Error("sensitive SQL failure");
    return options.confirmed === undefined
      ? { attemptId: "attempt-1", status: "confirmed", providerSubscriptionId: "sub-1" } : options.confirmed;
  };
  const markUnknown = async (attemptId: string, userId: string) => {
    calls.push("unknown");
    assert.equal(attemptId, "attempt-1");
    assert.equal(userId, "user-1");
    if (options.fail === "unknown") throw new Error("Neon unavailable");
    return { attemptId, status: "needs_reconciliation" };
  };
  return {
    calls,
    submitter: createWeddingSquareSandboxSubscriptionSubmitter(
      { inspect } as any,
      { prepare } as any,
      create,
      { confirm } as any,
      { markUnknown } as any,
    ),
  };
}

test("actual Square SDK v43 has sandbox subscriptions.create (no provider calls)", () => {
  const sdk = new SquareClient({ token: "offline-test-only", environment: SquareEnvironment.Sandbox });
  assert.equal(typeof sdk.subscriptions.create, "function");
});

test("valid verified claim sends only its persisted request exactly once, then confirms without entitlement", () =>
  sandbox(async () => {
    const { calls, submitter } = mock();
    const result = await submitter.submit(owner as any);
    assert.deepEqual(calls, ["attest", "claim", "square-create", "confirm"]);
    assert.deepEqual(result, {
      attemptId: "attempt-1", status: "confirmed", providerSubscriptionId: "sub-1",
      grantsEntitlement: false, safeToResubmit: false, requiresPaymentReconciliation: true,
    });
    assert.equal(Object.isFrozen(result), true);
  }));

test("disabled or production environment makes NO provider calls or DB changes", () =>
  sandbox(async () => {
    for (const [env, value] of [
      ["SQUARE_ENV", "production"],
      ["SQUARE_ENV", ""],
      ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "false"],
    ] as const) {
      const prior = process.env[env]; process.env[env] = value;
      try {
        const { calls, submitter } = mock();
        await assert.rejects(submitter.submit(owner as any), WeddingSquareSandboxSubmissionError);
        assert.deepEqual(calls, []);
      } finally {
        if (prior === undefined) delete process.env[env]; else process.env[env] = prior;
      }
    }
  }));

test("merchant and plan attestation fails before enrollment claim or Square POST", () =>
  sandbox(async () => {
    for (const bad of [
      { merchantId: "different-merchant" },
      { locationId: "different-location" },
      { verifiedSandboxCatalogTerms: false },
      { authorizesSubscriptionCreation: true },
      { grantsEntitlement: true },
      { safeToResubmit: true },
    ]) {
      const { calls, submitter } = mock({ attest: { ...attestation, ...bad } });
      await assert.rejects(submitter.submit(owner as any), WeddingSquareSandboxSubmissionError);
      assert.deepEqual(calls, ["attest"]);
    }
    const { calls, submitter } = mock({ fail: "attest" });
    await assert.rejects(submitter.submit(owner as any), WeddingSquareSandboxSubmissionError);
    assert.deepEqual(calls, ["attest"]);
  }));

test("ownership claim errors never cause a blind Square retry", () =>
  sandbox(async () => {
    const { calls, submitter } = mock({ fail: "claim" });
    await assert.rejects(submitter.submit(owner as any), WeddingSquareSandboxSubmissionError);
    assert.deepEqual(calls, ["attest", "claim"]);
  }));

test("post-claim mismatch blocks provider create and marks the known claim unknown", () =>
  sandbox(async () => {
    for (const change of [
      { attemptId: "wrong-attempt" },
      { status: "reserved" },
      { request: { ...claimRequest, planVariationId: "foreign-plan" } },
      { request: { ...claimRequest, locationId: "foreign-location" } },
      { request: { ...claimRequest, timezone: "America/New_York" } },
      { request: { ...claimRequest, idempotencyKey: "" } },
      { request: { ...claimRequest, cardId: "" } },
    ]) {
      const { calls, submitter } = mock({ claim: { attemptId: "attempt-1", status: "submitting", request: claimRequest, ...change } });
      await assert.rejects(submitter.submit(owner as any), WeddingSquareSandboxSubmissionError);
      assert.deepEqual(calls, ["attest", "claim", "unknown"]);
    }
  }));

test("unexpected Square success bodies fail shut and never confirm", () =>
  sandbox(async () => {
    for (const response of [
      {}, { errors: [{ code: "INTERNAL_SERVER_ERROR" }], ...provider },
      { ...provider, errors: null },
      { subscription: { ...provider.subscription, status: "FAILED" } },
      { subscription: { ...provider.subscription, id: "" } },
      { subscription: { ...provider.subscription, cardId: null } },
      { subscription: { ...provider.subscription, timezone: "America/New_York" } },
    ]) {
      const { calls, submitter } = mock({ response });
      await assert.rejects(submitter.submit(owner as any), WeddingSquareSandboxSubmissionError);
      assert.deepEqual(calls, ["attest", "claim", "square-create", "unknown"]);
    }
  }));

test("provider timeout after one POST marks unknown and never silently resubmits", () =>
  sandbox(async () => {
    const { calls, submitter } = mock({ fail: "create" });
    await assert.rejects(submitter.submit(owner as any), (e: unknown) => {
      assert.ok(e instanceof WeddingSquareSandboxSubmissionError);
      assert.doesNotMatch(e.message, /token|card|PAN|private/i);
      return true;
    });
    assert.deepEqual(calls, ["attest", "claim", "square-create", "unknown"]);
  }));

test("invalid confirmation or DB acknowledgement goes to reconciliation, no retry", () =>
  sandbox(async () => {
    for (const input of [{ fail: "confirm" as const },
      { confirmed: { attemptId: "wrong", status: "confirmed", providerSubscriptionId: "sub-1" } },
      { confirmed: { attemptId: "attempt-1", status: "confirmed", providerSubscriptionId: "" } },
      { confirmed: { attemptId: "attempt-1", status: "needs_reconciliation", providerSubscriptionId: "sub-1" } },
    ]) {
      const { calls, submitter } = mock(input);
      await assert.rejects(submitter.submit(owner as any), WeddingSquareSandboxSubmissionError);
      assert.deepEqual(calls, ["attest", "claim", "square-create", "confirm", "unknown"]);
    }
  }));

test("if markUnknown fails, no second Square POST is attempted", () =>
  sandbox(async () => {
    const { calls, submitter } = mock({ fail: "unknown", response: {} });
    await assert.rejects(submitter.submit(owner as any), WeddingSquareSandboxSubmissionError);
    assert.deepEqual(calls, ["attest", "claim", "square-create", "unknown"]);
  }));
