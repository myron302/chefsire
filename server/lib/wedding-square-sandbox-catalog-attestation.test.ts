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
        subscriptionPlanId: id === "premium-variation" ? "premium-plan" : "elite-plan",
        name: "Wedding plan",
        phases: [{
          cadence: "MONTHLY", ordinal: 0n,
          pricing: { type: "STATIC", priceMoney: { amount: cents, currency: "USD" } },
        }],
      },
    },
  };
}

function parentPlan(id: string) {
  return {
    object: {
      id, type: "SUBSCRIPTION_PLAN", isDeleted: false,
      presentAtAllLocations: true,
      subscriptionPlanData: { name: id === "premium-plan" ? "Wedding Premium" : "Wedding Elite" },
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
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: "premium-plan",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: "elite-plan",
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
  premiumParent: unknown = parentPlan("premium-plan"),
  eliteParent: unknown = parentPlan("elite-plan"),
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
      const response = id === "premium-plan" ? premiumParent
        : id === "elite-plan" ? eliteParent
        : id === "premium-variation" ? premium : elite;
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
  assert.equal(evidence.premiumPlanId, "premium-plan");
  assert.equal(evidence.elitePlanId, "elite-plan");
  assert.equal(evidence.currency, "USD");
  assert.equal(evidence.authorizesSubscriptionCreation, false);
  assert.equal(evidence.grantsEntitlement, false);
  assert.equal(evidence.safeToResubmit, false);
  assert.deepEqual(calls(), {
    merchantReads: 1, catalogReads: ["premium-plan", "premium-variation", "elite-plan", "elite-variation"],
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

test("Square SDK v43 deserializes JSON phase ordinals to bigint and validates the response", () => sandbox(async () => {
  // Intercept the SDK transport: no sandbox or production HTTP request occurs.
  const previousFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount++;
    return new Response(JSON.stringify({
      object: {
        type: "SUBSCRIPTION_PLAN_VARIATION",
        id: "premium-variation",
        // Deliberately omit present_at_all_locations: Square defaults it to true.
        subscription_plan_variation_data: {
          name: "Wedding Premium",
          subscription_plan_id: "premium-plan",
          phases: [{
            cadence: "MONTHLY", ordinal: 0,
            pricing: { type: "STATIC", price_money: { amount: 2499, currency: "USD" } },
          }],
        },
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const client = new SquareClient({
      token: "offline-contract", environment: SquareEnvironment.Sandbox,
    });
    const sdkResponse = await client.catalog.object.get(
      { objectId: "premium-variation" }, { maxRetries: 0 },
    );
    assert.equal(fetchCount, 1);
    assert.equal(sdkResponse.object?.subscriptionPlanVariationData?.phases?.[0]?.ordinal, 0n);
    const { result } = service(sdkResponse);
    assert.equal((await result.inspect()).verifiedSandboxCatalogTerms, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
}));

test("Square's omitted presentAtAllLocations defaults to globally available", () => sandbox(async () => {
  const { presentAtAllLocations: _omitted, ...object } = variation("premium-variation", 2499n).object;
  const { result } = service({ object });
  assert.equal((await result.inspect()).verifiedSandboxCatalogTerms, true);
}));

test("parent plans must exist, be active and eligible at the configured location", () => sandbox(async () => {
  const parent = parentPlan("premium-plan").object;
  const failures: unknown[] = [
    null,
    new Error("SECRET parent lookup failed"),
    { object: { ...parent, id: "unrelated-plan" } },
    { object: { ...parent, type: "ITEM" } },
    { object: { ...parent, isDeleted: true } },
    { object: { ...parent, presentAtAllLocations: false } },
    { object: { ...parent, absentAtLocationIds: ["chef-location"] } },
    { object: { ...parent, subscriptionPlanData: { name: " " } } },
    { object: { ...parent, subscriptionPlanData: null } },
    { object: parent, errors: [{ code: "INVALID_REQUEST_ERROR" }] },
    { object: parent, errors: "malformed" },
    { object: parent, errors: null },
  ];
  for (const response of failures) {
    const { result, calls } = service(undefined, undefined, undefined, response);
    await assert.rejects(result.inspect(), (error: unknown) => {
      assert.ok(error instanceof errorType);
      assert.doesNotMatch(error.message, /SECRET|premium-plan|chef-merchant/);
      return true;
    });
    assert.deepEqual(calls(), { merchantReads: 1, catalogReads: ["premium-plan"] });
  }
}));

test("explicitly location-eligible parent plans pass, while an invalid Elite parent stops Elite variation lookup", () => sandbox(async () => {
  const premium = parentPlan("premium-plan");
  const eligible = {
    object: { ...premium.object, presentAtAllLocations: false, presentAtLocationIds: ["chef-location"] },
  };
  const accepted = service(undefined, undefined, undefined, eligible);
  assert.equal((await accepted.result.inspect()).verifiedSandboxCatalogTerms, true);
  assert.deepEqual(accepted.calls(), {
    merchantReads: 1,
    catalogReads: ["premium-plan", "premium-variation", "elite-plan", "elite-variation"],
  });

  const elite = parentPlan("elite-plan");
  const blocked = service(undefined, undefined, undefined, undefined, {
    object: { ...elite.object, isDeleted: true },
  });
  await assert.rejects(blocked.result.inspect(), errorType);
  assert.deepEqual(blocked.calls(), {
    merchantReads: 1,
    catalogReads: ["premium-plan", "premium-variation", "elite-plan"],
  });
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
    assert.deepEqual(calls(), { merchantReads: 1, catalogReads: ["premium-plan", "premium-variation"] });
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
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, subscriptionPlanId: "marketplace-plan" } },
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, subscriptionPlanId: "elite-plan" } },
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, successorPlanVariationId: "replacement" } },
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, canProrate: true } },
    { ...base, subscriptionPlanVariationData: { ...base.subscriptionPlanVariationData, monthlyBillingAnchorDate: 15 } },
  ];
  for (const object of failures) {
    const { result, calls } = service({ object });
    await assert.rejects(result.inspect(), errorType);
    assert.deepEqual(calls(), { merchantReads: 1, catalogReads: ["premium-plan", "premium-variation"] });
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
    merchantReads: 1, catalogReads: ["premium-plan", "premium-variation", "elite-plan", "elite-variation"],
  });
}));

test("correctly priced Elite variation under the Premium parent plan fails closed", () => sandbox(async () => {
  const elite = variation("elite-variation", 4999n);
  elite.object.subscriptionPlanVariationData.subscriptionPlanId = "premium-plan";
  const { result, calls } = service(undefined, elite);
  await assert.rejects(result.inspect(), errorType);
  assert.deepEqual(calls(), {
    merchantReads: 1, catalogReads: ["premium-plan", "premium-variation", "elite-plan", "elite-variation"],
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
    ["WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID", ""],
    ["WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID", " elite-plan "],
    ["WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID", "premium-plan"],
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
