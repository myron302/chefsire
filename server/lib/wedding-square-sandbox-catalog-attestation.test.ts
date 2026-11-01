import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import {
  createWeddingSquareSandboxCatalogAttestation,
  WeddingSquareSandboxCatalogAttestationError,
} from "./wedding-square-sandbox-catalog-attestation";

const errorType = WeddingSquareSandboxCatalogAttestationError;
const merchantEvidence = {
  merchantId: "chef-merchant", locationId: "chef-location", currency: "USD",
  verifiedSandboxMerchantContext: true,
  authorizesSubscriptionCreation: false, grantsEntitlement: false, safeToResubmit: false,
} as const;

function variation(id: string, cents: bigint) {
  return {
    object: {
      type: "SUBSCRIPTION_PLAN_VARIATION", id, isDeleted: false,
      presentAtAllLocations: true,
      subscriptionPlanVariationData: {
        subscriptionPlanId: "wedding-plan",
        name: "Wedding plan",
        phases: [{
          cadence: "MONTHLY", ordinal: 0,
          pricing: { type: "STATIC", priceMoney: { amount: cents, currency: "USD" } },
        }],
      },
    },
  };
}

async function sandbox<T>(run: () => Promise<T>): Promise<T> {
  const settings = {
    SQUARE_ENV: "sandbox",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "chef-merchant",
    SQUARE_LOCATION_ID: "chef-location",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "premium-variation",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "elite-variation",
    SQUARE_CURRENCY: "USD",
  };
  const before = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  try { return await run(); }
  finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function service(
  premium: unknown = variation("premium-variation", 2499n),
  elite: unknown = variation("elite-variation", 4999n),
  attestation: unknown = merchantEvidence,
) {
  let merchantReads = 0;
  const catalogReads: string[] = [];
  const result = createWeddingSquareSandboxCatalogAttestation(
    { async inspect() {
      merchantReads++;
      if (attestation instanceof Error) throw attestation;
      return attestation as typeof merchantEvidence;
    } },
    async (id) => {
      catalogReads.push(id);
      const response = id === "premium-variation" ? premium : elite;
      if (response instanceof Error) throw response;
      return response;
    },
  );
  return { result, calls: () => ({ merchantReads, catalogReads }) };
}

test("Square v43 has a read-only catalog object GET method", () => {
  const client = new SquareClient({ token: "offline-contract", environment: SquareEnvironment.Sandbox });
  assert.equal(typeof client.catalog.object.get, "function");
});

test("matching active indefinite monthly USD Premium and Elite catalog terms are evidence only", () => sandbox(async () => {
  const { result, calls } = service();
  const evidence = await result.inspect();
  assert.equal(evidence.verifiedSandboxCatalogTerms, true);
  assert.equal(evidence.premiumPlanVariationId, "premium-variation");
  assert.equal(evidence.elitePlanVariationId, "elite-variation");
  assert.equal(evidence.currency, "USD");
  assert.equal(evidence.authorizesSubscriptionCreation, false);
  assert.equal(evidence.grantsEntitlement, false);
  assert.equal(evidence.safeToResubmit, false);
  assert.deepEqual(calls(), {
    merchantReads: 1, catalogReads: ["premium-variation", "elite-variation"],
  });
}));

test("explicit location inclusion is accepted when presentAtAllLocations is false", () => sandbox(async () => {
  const premium = variation("premium-variation", 2499n);
  premium.object.presentAtAllLocations = false;
  const { result } = service({
    object: { ...premium.object, presentAtLocationIds: ["chef-location"] },
  });
  assert.equal((await result.inspect()).verifiedSandboxCatalogTerms, true);
}));

test("wrong prices, currencies, cadence, finite duration and discounts fail closed", () => sandbox(async () => {
  const baseline = variation("premium-variation", 2499n);
  const phase = baseline.object.subscriptionPlanVariationData.phases[0];
  const failures: unknown[] = [
    variation("premium-variation", 2498n),
    { object: { ...baseline.object, subscriptionPlanVariationData: {
      ...baseline.object.subscriptionPlanVariationData,
      phases: [{ ...phase, cadence: "WEEKLY" }],
    } } },
    { object: { ...baseline.object, subscriptionPlanVariationData: {
      ...baseline.object.subscriptionPlanVariationData,
      phases: [{ ...phase, periods: 1 }],
    } } },
    { object: { ...baseline.object, subscriptionPlanVariationData: {
      ...baseline.object.subscriptionPlanVariationData,
      phases: [phase, phase],
    } } },
    { object: { ...baseline.object, subscriptionPlanVariationData: {
      ...baseline.object.subscriptionPlanVariationData,
      phases: [{ ...phase, pricing: { type: "RELATIVE", priceMoney: { amount: 2499n, currency: "USD" } } }],
    } } },
    { object: { ...baseline.object, subscriptionPlanVariationData: {
      ...baseline.object.subscriptionPlanVariationData,
      phases: [{ ...phase, pricing: { type: "STATIC", priceMoney: { amount: 2499n, currency: "CAD" } } }],
    } } },
    { object: { ...baseline.object, subscriptionPlanVariationData: {
      ...baseline.object.subscriptionPlanVariationData,
      phases: [{ ...phase, recurringPriceMoney: { amount: 1000n, currency: "USD" } }],
    } } },
    { object: { ...baseline.object, subscriptionPlanVariationData: {
      ...baseline.object.subscriptionPlanVariationData,
      phases: [{ ...phase, pricing: { ...phase.pricing, price: { amount: 1000n, currency: "USD" } } }],
    } } },
  ];
  for (const response of failures) {
    const { result, calls } = service(response);
    await assert.rejects(result.inspect(), errorType);
    assert.deepEqual(calls(), { merchantReads: 1, catalogReads: ["premium-variation"] });
  }
}));

test("missing, deleted, deprecated, proration and location-ineligible variations fail closed", () => sandbox(async () => {
  const base = variation("premium-variation", 2499n).object;
  const failures: unknown[] = [
    { ...base, id: "wrong-plan" },
    { ...base, type: "ITEM_VARIATION" },
    { ...base, isDeleted: true },
    { ...base, presentAtAllLocations: false },
    { ...base, absentAtLocationIds: ["chef-location"] },
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, subscriptionPlanId: "" } },
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, successorPlanVariationId: "replacement" } },
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, canProrate: true } },
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, monthlyBillingAnchorDate: 15 } },
  ];
  for (const object of failures) {
    const { result, calls } = service({ object });
    await assert.rejects(result.inspect(), errorType);
    assert.deepEqual(calls(), { merchantReads: 1, catalogReads: ["premium-variation"] });
  }
}));

test("mixed success and errors envelopes and provider exceptions never return verified terms", () => sandbox(async () => {
  const premium = variation("premium-variation", 2499n);
  for (const response of [
    { ...premium, errors: [{ code: "ERROR" }] },
    { ...premium, errors: "not-an-array" },
    { ...premium, errors: null },
    new Error("token=SECRET"),
    null,
  ]) {
    const { result } = service(response);
    await assert.rejects(result.inspect(), (error: unknown) => {
      assert.ok(error instanceof errorType);
      assert.doesNotMatch(error.message, /SECRET|premium-variation|chef-merchant/);
      return true;
    });
  }
}));

test("Elite failure occurs only after verified Premium, with no extra requests", () => sandbox(async () => {
  const { result, calls } = service(variation("premium-variation", 2499n), variation("elite-variation", 2499n));
  await assert.rejects(result.inspect(), errorType);
  assert.deepEqual(calls(), {
    merchantReads: 1, catalogReads: ["premium-variation", "elite-variation"],
  });
}));

test("wrong token-owned merchant, location or positive entitlement flags block catalog GET", () => sandbox(async () => {
  for (const attestation of [
    null, new Error("provider SECRET"),
    { ...merchantEvidence, merchantId: "another-merchant" },
    { ...merchantEvidence, locationId: "another-location" },
    { ...merchantEvidence, currency: "CAD" },
    { ...merchantEvidence, verifiedSandboxMerchantContext: false },
    { ...merchantEvidence, grantsEntitlement: true },
    { ...merchantEvidence, authorizesSubscriptionCreation: true },
    { ...merchantEvidence, safeToResubmit: true },
  ]) {
    const { result, calls } = service(undefined, undefined, attestation);
    await assert.rejects(result.inspect(), errorType);
    assert.deepEqual(calls(), { merchantReads: 1, catalogReads: [] });
  }
}));

test("production, disabled feature and invalid operator mappings cause zero provider requests", () => sandbox(async () => {
  const badConfigs = [
    ["SQUARE_ENV", "production"],
    ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "false"],
    ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID", " chef-merchant "],
    ["SQUARE_LOCATION_ID", ""],
    ["WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID", " premium-variation "],
    ["WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID", ""],
    ["WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID", "premium-variation"],
    ["SQUARE_CURRENCY", "CAD"],
  ] as const;
  for (const [key, value] of badConfigs) {
    const before = process.env[key];
    process.env[key] = value;
    try {
      const { result, calls } = service();
      await assert.rejects(result.inspect(), errorType);
      assert.deepEqual(calls(), { merchantReads: 0, catalogReads: [] });
    } finally {
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    }
  }
}));
