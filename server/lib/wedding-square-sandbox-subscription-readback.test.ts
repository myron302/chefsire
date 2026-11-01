import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import {
  createWeddingSquareSandboxSubscriptionReadback,
  WeddingSquareSandboxReadbackUnavailableError,
} from "./wedding-square-sandbox-subscription-readback";
import { createWeddingSquareSandboxCatalogAttestation } from "./wedding-square-sandbox-catalog-attestation";
import type { weddingSquareSandboxCatalogAttestation } from "./wedding-square-sandbox-catalog-attestation";
import type { weddingSquareReconciliationReadback } from "./wedding-square-reconciliation-readback";

type AttestationEvidence = Awaited<ReturnType<typeof weddingSquareSandboxCatalogAttestation.inspect>>;
type SavedEnrollment = Awaited<ReturnType<typeof weddingSquareReconciliationReadback.inspect>>;

const saved = {
  attemptId: "enrollment-1",
  status: "confirmed" as const,
  persistedIdempotencyKey: "saved-idempotency",
  persistedRequestFingerprint: "a".repeat(64),
  providerSubscriptionId: "sub-confirmed",
  customerId: "customer-1",
  cardId: "card-1",
  locationId: "wedding-location",
  planVariationId: "wedding-premium",
};
const subscription = {
  id: "sub-confirmed",
  customerId: "customer-1",
  cardId: "card-1",
  locationId: "wedding-location",
  planVariationId: "wedding-premium",
  status: "ACTIVE",
};
const expectedError = WeddingSquareSandboxReadbackUnavailableError;

async function sandbox<T>(fn: () => Promise<T>): Promise<T> {
  const overrides = {
    SQUARE_ENV: "sandbox",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    SQUARE_LOCATION_ID: "wedding-location",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "chef-merchant",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "wedding-premium",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "wedding-elite",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: "wedding-premium-plan",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: "wedding-elite-plan",
  };
  const before = Object.fromEntries(Object.keys(overrides).map((k) => [k, process.env[k]]));
  Object.assign(process.env, overrides);
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
function service(
  persisted: SavedEnrollment = saved,
  returned: unknown = { subscription },
  attestationResponse: unknown = {
    merchantId: "chef-merchant", locationId: "wedding-location",
    currency: "USD", verifiedSandboxCatalogTerms: true,
    premiumPlanVariationId: "wedding-premium", elitePlanVariationId: "wedding-elite",
    premiumPlanId: "wedding-premium-plan", elitePlanId: "wedding-elite-plan",
    authorizesSubscriptionCreation: false, grantsEntitlement: false,
    safeToResubmit: false,
  },
) {
  let dbReads = 0;
  let providerReads = 0;
  let attestationReads = 0;
  const readback = createWeddingSquareSandboxSubscriptionReadback(
    { async inspect(attemptId: string, userId: string) {
      dbReads++;
      if (attemptId !== "enrollment-1" || userId !== "chef-user") throw new Error("not owner");
      return persisted;
    } },
    async (subscriptionId) => {
      providerReads++;
      assert.equal(subscriptionId, "sub-confirmed");
      if (returned instanceof Error) throw returned;
      return returned;
    },
    { async inspect() {
      attestationReads++;
      if (attestationResponse instanceof Error) throw attestationResponse;
      return attestationResponse as AttestationEvidence;
    } },
  );
  return { readback, calls: () => ({ dbReads, attestationReads, providerReads }) };
}

test("Square v43 has the real read-only subscriptions.get SDK method", () => {
  const sdk = new SquareClient({ token: "offline-contract-test", environment: SquareEnvironment.Sandbox });
  assert.equal(typeof sdk.subscriptions.get, "function");
});

test("verified saved subscription returns only operator evidence", () => sandbox(async () => {
  const { readback, calls } = service();
  const result = await readback.inspect("enrollment-1", "chef-user");
  assert.equal(result.providerSubscriptionId, "sub-confirmed");
  assert.equal(result.existingIdMatches, true);
  assert.equal(result.providerStatus, "ACTIVE");
  assert.equal(result.requiresOperatorReconciliation, true);
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.safeToResubmit, false);
  assert.deepEqual(calls(), { dbReads: 1, attestationReads: 1, providerReads: 1 });
}));

test("COMPLETED subscription is legitimate terminal readback, not payment evidence", () => sandbox(async () => {
  const { readback } = service(saved, { subscription: { ...subscription, status: "COMPLETED" } });
  const result = await readback.inspect("enrollment-1", "chef-user");
  assert.equal(result.providerStatus, "COMPLETED");
  assert.equal(result.requiresOperatorReconciliation, true);
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.safeToResubmit, false);
}));

test("unknown/unlinked subscription never triggers a provider search or GET", () => sandbox(async () => {
  const { readback, calls } = service({ ...saved, status: "needs_reconciliation", providerSubscriptionId: null });
  await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
  assert.deepEqual(calls(), { dbReads: 1, attestationReads: 0, providerReads: 0 });
}));

test("another user and invalid attempts cannot fetch a subscription", () => sandbox(async () => {
  const { readback, calls } = service();
  await assert.rejects(readback.inspect("enrollment-1", "other-user"), expectedError);
  await assert.rejects(readback.inspect("wrong-id", "chef-user"), expectedError);
  assert.equal(calls().providerReads, 0);
}));

test("cross-location and unmapped Wedding plan fail before provider retrieval", () => sandbox(async () => {
  for (const changed of [
    { locationId: "another-location" },
    { planVariationId: "marketplace-plan" },
  ]) {
    const { readback, calls } = service({ ...saved, ...changed });
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
    assert.equal(calls().providerReads, 0);
  }
}));

test("saved and fetched subscription identities must agree exactly", () => sandbox(async () => {
  for (const field of ["id", "customerId", "cardId", "locationId", "planVariationId"] as const) {
    const { readback } = service(saved, {
      subscription: { ...subscription, [field]: "mismatched-provider-id" },
    });
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
  }
}));

test("2xx Square envelopes mixing a matching subscription with errors fail closed", () => sandbox(async () => {
  for (const returned of [
    { subscription, errors: [{ category: "API_ERROR", code: "INTERNAL_SERVER_ERROR" }] },
    { subscription, errors: [null] },
    { subscription, errors: "not-an-array" },
    { subscription, errors: null },
  ]) {
    const { readback, calls } = service(saved, returned);
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
    assert.deepEqual(calls(), { dbReads: 1, attestationReads: 1, providerReads: 1 });
  }
  // Square permits an absent or empty errors array on successful responses.
  const { readback } = service(saved, { subscription, errors: [] });
  const result = await readback.inspect("enrollment-1", "chef-user");
  assert.equal(result.requiresOperatorReconciliation, true);
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.safeToResubmit, false);
}));

test("whitespace-padded provider identifiers and statuses are never normalized", () => sandbox(async () => {
  for (const field of ["id", "customerId", "cardId", "locationId", "planVariationId", "status"] as const) {
    for (const invalid of [` ${subscription[field]} `, "   "]) {
      const { readback } = service(saved, {
        subscription: { ...subscription, [field]: invalid },
      });
      await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
    }
  }
}));

test("malformed, incomplete and unknown provider statuses fail closed", () => sandbox(async () => {
  for (const returned of [
    {},
    { subscription: { ...subscription, cardId: undefined } },
    { subscription: { ...subscription, status: "UNRECOGNIZED_STATUS" } },
    { subscription: null },
  ]) {
    const { readback } = service(saved, returned);
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
  }
}));

test("Square errors, missing records and timeouts never authorize resubmission", () => sandbox(async () => {
  for (const response of [new Error("secret provider response"), { subscription: null }]) {
    const { readback } = service(saved, response);
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), (error: unknown) => {
      assert.ok(error instanceof WeddingSquareSandboxReadbackUnavailableError);
      assert.doesNotMatch(error.message, /secret provider response|sub-confirmed/);
      return true;
    });
  }
}));

test("production, disabled enrollment and wrong sandbox configuration make no reads", () => sandbox(async () => {
  const { readback, calls } = service();
  const originalEnv = process.env.SQUARE_ENV;
  const originalEnabled = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  try {
    process.env.SQUARE_ENV = "production";
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
    process.env.SQUARE_ENV = "sandbox";
    process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "false";
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
    assert.deepEqual(calls(), { dbReads: 0, attestationReads: 0, providerReads: 0 });
  } finally {
    process.env.SQUARE_ENV = originalEnv;
    process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = originalEnabled;
  }
}));

test("missing or duplicate plan mappings fail closed with no provider request", () => sandbox(async () => {
  const { readback, calls } = service();
  delete process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID;
  await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
  process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID = "wedding-premium";
  process.env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID = "wedding-premium";
  await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
  assert.equal(calls().providerReads, 0);
}));

test("catalog attestation failure, wrong merchant/location/plan or unsafe flags prevent subscription GET", () => sandbox(async () => {
  const valid = {
    merchantId: "chef-merchant", locationId: "wedding-location",
    currency: "USD", verifiedSandboxCatalogTerms: true,
    premiumPlanVariationId: "wedding-premium", elitePlanVariationId: "wedding-elite",
    premiumPlanId: "wedding-premium-plan", elitePlanId: "wedding-elite-plan",
    authorizesSubscriptionCreation: false, grantsEntitlement: false,
    safeToResubmit: false,
  };
  for (const attestation of [
    new Error("Square credential=SECRET"),
    null, {},
    { ...valid, merchantId: "other-merchant" },
    { ...valid, merchantId: " chef-merchant " },
    { ...valid, locationId: "other-location" },
    { ...valid, currency: "CAD" },
    { ...valid, currency: undefined },
    { ...valid, verifiedSandboxCatalogTerms: false },
    { ...valid, verifiedSandboxCatalogTerms: undefined },
    { ...valid, premiumPlanVariationId: "marketplace-plan" },
    { ...valid, elitePlanVariationId: "marketplace-plan" },
    { ...valid, premiumPlanId: "marketplace-plan" },
    { ...valid, elitePlanId: "marketplace-plan" },
    { ...valid, premiumPlanId: undefined },
    { ...valid, premiumPlanVariationId: undefined },
    { ...valid, authorizesSubscriptionCreation: true },
    { ...valid, grantsEntitlement: true },
    { ...valid, safeToResubmit: true },
  ]) {
    const { readback, calls } = service(saved, { subscription }, attestation);
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), (error: unknown) => {
      assert.ok(error instanceof WeddingSquareSandboxReadbackUnavailableError);
      assert.doesNotMatch(error.message, /SECRET|sub-confirmed|chef-merchant/);
      return true;
    });
    assert.deepEqual(calls(), { dbReads: 1, attestationReads: 1, providerReads: 0 });
  }
}));

test("missing or padded expected merchant ID blocks all DB and provider access", () => sandbox(async () => {
  for (const value of [undefined, "", " chef-merchant "]) {
    const before = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
    if (value === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
    else process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID = value;
    try {
      const { readback, calls } = service();
      await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
      assert.deepEqual(calls(), { dbReads: 0, attestationReads: 0, providerReads: 0 });
    } finally {
      if (before === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      else process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID = before;
    }
  }
}));

test("invalid saved enrollment does not trigger merchant or subscription provider calls", () => sandbox(async () => {
  for (const record of [
    { ...saved, providerSubscriptionId: null },
    { ...saved, locationId: "wrong-location" },
    { ...saved, planVariationId: "wrong-plan" },
  ]) {
    const { readback, calls } = service(record);
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
    assert.deepEqual(calls(), { dbReads: 1, attestationReads: 0, providerReads: 0 });
  }
}));

test("malformed sandbox location, plan and currency configuration blocks even Neon reads", () => sandbox(async () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["SQUARE_LOCATION_ID", " wedding-location "],
    ["SQUARE_LOCATION_ID", ""],
    ["WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID", " wedding-premium "],
    ["WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID", "wedding-elite "],
    ["WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID", " wedding-premium-plan "],
    ["WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID", ""],
    ["WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID", ""],
    ["SQUARE_CURRENCY", "CAD"],
    ["SQUARE_CURRENCY", " USD "],
  ];
  for (const [key, value] of cases) {
    const before = process.env[key];
    process.env[key] = value;
    try {
      const { readback, calls } = service();
      await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
      assert.deepEqual(calls(), { dbReads: 0, attestationReads: 0, providerReads: 0 });
    } finally {
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    }
  }
}));

test("padded attempt and authenticated user identifiers block all reads", () => sandbox(async () => {
  for (const [attemptId, userId] of [
    [" enrollment-1 ", "chef-user"],
    ["enrollment-1", " chef-user "],
    ["", "chef-user"],
    ["enrollment-1", ""],
  ]) {
    const { readback, calls } = service();
    await assert.rejects(readback.inspect(attemptId, userId), expectedError);
    assert.deepEqual(calls(), { dbReads: 0, attestationReads: 0, providerReads: 0 });
  }
}));

test("malformed saved subscription, customer, card and fingerprint block provider requests", () => sandbox(async () => {
  for (const invalid of [
    { providerSubscriptionId: " sub-confirmed " },
    { providerSubscriptionId: "   " },
    { persistedIdempotencyKey: " saved-idempotency " },
    { persistedIdempotencyKey: "" },
    { persistedRequestFingerprint: "B".repeat(64) },
    { persistedRequestFingerprint: "" },
    { customerId: " customer-1 " },
    { customerId: "" },
    { cardId: "card-1 " },
    { cardId: "" },
    { attemptId: " enrollment-1 " },
  ]) {
    const { readback, calls } = service({ ...saved, ...invalid });
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
    assert.deepEqual(calls(), { dbReads: 1, attestationReads: 0, providerReads: 0 });
  }
}));

test("composed real catalog guard blocks invalid Premium/Elite price or cadence before subscription GET", () => sandbox(async () => {
  function composed(invalid?: { id: string; amount?: bigint; cadence?: string; parentDeleted?: boolean }) {
    const calls: string[] = [];
    const catalog = createWeddingSquareSandboxCatalogAttestation(
      { async inspect() {
        calls.push("merchant");
        return {
          merchantId: "chef-merchant", locationId: "wedding-location",
          currency: "USD", verifiedSandboxMerchantContext: true,
          authorizesSubscriptionCreation: false, grantsEntitlement: false,
          safeToResubmit: false,
        } as const;
      } },
      async (id) => {
        calls.push("catalog:" + id);
        if (id === "wedding-premium-plan" || id === "wedding-elite-plan") {
          return {
            object: {
              type: "SUBSCRIPTION_PLAN", id,
              isDeleted: invalid?.id === id && invalid.parentDeleted === true,
              subscriptionPlanData: { name: id === "wedding-premium-plan" ? "Wedding Premium" : "Wedding Elite" },
            },
          };
        }
        const expected = id === "wedding-premium" ? 2499n : 4999n;
        return {
          object: {
            type: "SUBSCRIPTION_PLAN_VARIATION", id,
            // Square defaults omitted presentAtAllLocations to true.
            subscriptionPlanVariationData: {
              name: "Wedding", subscriptionPlanId: id === "wedding-premium" ? "wedding-premium-plan" : "wedding-elite-plan",
              phases: [{
                cadence: invalid?.id === id && invalid.cadence ? invalid.cadence : "MONTHLY",
                ordinal: 0n,
                pricing: {
                  type: "STATIC",
                  priceMoney: {
                    amount: invalid?.id === id && invalid.amount !== undefined
                      ? invalid.amount : expected,
                    currency: "USD",
                  },
                },
              }],
            },
          },
        };
      },
    );
    const readback = createWeddingSquareSandboxSubscriptionReadback(
      { async inspect(attemptId: string, userId: string) {
        calls.push("db");
        assert.equal(attemptId, "enrollment-1");
        assert.equal(userId, "chef-user");
        return saved;
      } },
      async (subscriptionId) => {
        calls.push("subscription");
        assert.equal(subscriptionId, "sub-confirmed");
        return { subscription };
      },
      catalog,
    );
    return { readback, calls };
  }

  for (const invalid of [
    { id: "wedding-premium", amount: 2400n },
    { id: "wedding-elite", amount: 4900n },
    { id: "wedding-premium", cadence: "WEEKLY" },
    { id: "wedding-elite", cadence: "WEEKLY" },
    { id: "wedding-premium-plan", parentDeleted: true },
    { id: "wedding-elite-plan", parentDeleted: true },
  ]) {
    const { readback, calls } = composed(invalid);
    await assert.rejects(readback.inspect("enrollment-1", "chef-user"), expectedError);
    assert.equal(calls.filter((call) => call === "merchant").length, 1);
    assert.equal(calls.filter((call) => call === "subscription").length, 0);
    assert.equal(calls[0], "db");
    assert.equal(calls[1], "merchant");
    assert.equal(calls[2], "catalog:wedding-premium-plan");
    assert.equal(calls.includes("catalog:wedding-premium"), invalid.id !== "wedding-premium-plan");
    assert.equal(calls.includes("catalog:wedding-elite-plan"),
      invalid.id === "wedding-elite" || invalid.id === "wedding-elite-plan");
    assert.equal(calls.includes("catalog:wedding-elite"), invalid.id === "wedding-elite");
  }

  const { readback, calls } = composed();
  const result = await readback.inspect("enrollment-1", "chef-user");
  assert.equal(result.requiresOperatorReconciliation, true);
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.safeToResubmit, false);
  assert.deepEqual(calls, [
    "db", "merchant", "catalog:wedding-premium-plan",
    "catalog:wedding-premium", "catalog:wedding-elite-plan",
    "catalog:wedding-elite", "subscription",
  ]);
}));
