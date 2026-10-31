import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import {
  createWeddingSquareSandboxSubscriptionReadback,
  WeddingSquareSandboxReadbackUnavailableError,
} from "./wedding-square-sandbox-subscription-readback";

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
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "wedding-premium",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "wedding-elite",
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
  persisted: typeof saved | (Omit<typeof saved, "providerSubscriptionId"> & { providerSubscriptionId: null }) = saved,
  returned: unknown = { subscription },
) {
  let dbReads = 0;
  let providerReads = 0;
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
  );
  return { readback, calls: () => ({ dbReads, providerReads }) };
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
  assert.deepEqual(calls(), { dbReads: 1, providerReads: 1 });
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
  assert.deepEqual(calls(), { dbReads: 1, providerReads: 0 });
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
    assert.deepEqual(calls(), { dbReads: 1, providerReads: 1 });
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
    assert.deepEqual(calls(), { dbReads: 0, providerReads: 0 });
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
