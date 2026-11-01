import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import {
  createWeddingSquareSandboxMerchantAttestation,
  WeddingSquareSandboxMerchantAttestationError,
} from "./wedding-square-sandbox-merchant-attestation";

const merchant = { id: "chef-merchant", status: "ACTIVE", currency: "USD", country: "US" };
const location = {
  id: "chef-location", merchantId: "chef-merchant",
  status: "ACTIVE", currency: "USD", country: "US",
  capabilities: ["CREDIT_CARD_PROCESSING"],
};
const safeError = WeddingSquareSandboxMerchantAttestationError;

async function sandbox<T>(run: () => Promise<T>): Promise<T> {
  const settings = {
    SQUARE_ENV: "sandbox",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "chef-merchant",
    SQUARE_LOCATION_ID: "chef-location",
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
  merchantEnvelope: unknown = { merchant },
  locationEnvelope: unknown = { location },
) {
  const requests: string[] = [];
  const attestation = createWeddingSquareSandboxMerchantAttestation(
    async (id) => {
      requests.push(`GET merchant:${id}`);
      assert.equal(id, "me", "must inspect the bearer token's merchant, not a configured ID");
      if (merchantEnvelope instanceof Error) throw merchantEnvelope;
      return merchantEnvelope;
    },
    async (id) => {
      requests.push(`GET location:${id}`);
      if (locationEnvelope instanceof Error) throw locationEnvelope;
      return locationEnvelope;
    },
  );
  return { attestation, requests };
}

test("Square v43 exposes direct read-only merchant and location GETs", () => {
  const client = new SquareClient({
    token: "offline-contract-token", environment: SquareEnvironment.Sandbox,
  });
  assert.equal(typeof client.merchants.get, "function");
  assert.equal(typeof client.locations.get, "function");
});

test("verified active platform merchant and owned location are evidence only", () => sandbox(async () => {
  const { attestation, requests } = service();
  const result = await attestation.inspect();
  assert.equal(result.merchantId, "chef-merchant");
  assert.equal(result.locationId, "chef-location");
  assert.equal(result.currency, "USD");
  assert.equal(result.verifiedSandboxMerchantContext, true);
  assert.equal(result.authorizesSubscriptionCreation, false);
  assert.equal(result.grantsEntitlement, false);
  assert.equal(result.safeToResubmit, false);
  assert.deepEqual(requests, ["GET merchant:me", "GET location:chef-location"]);
}));

test("absent or empty Square errors arrays are accepted only with valid identities", () => sandbox(async () => {
  const { attestation } = service({ merchant, errors: [] }, { location, errors: [] });
  const result = await attestation.inspect();
  assert.equal(result.verifiedSandboxMerchantContext, true);
  assert.equal(result.grantsEntitlement, false);
}));

test("2xx mixed success and errors envelopes fail closed", () => sandbox(async () => {
  for (const malformed of [
    [{ code: "ERROR" }], [null], "not-array", null,
  ]) {
    const first = service({ merchant, errors: malformed });
    await assert.rejects(first.attestation.inspect(), safeError);
    assert.deepEqual(first.requests, ["GET merchant:me"]);
    const second = service({ merchant }, { location, errors: malformed });
    await assert.rejects(second.attestation.inspect(), safeError);
    assert.deepEqual(second.requests, ["GET merchant:me", "GET location:chef-location"]);
  }
}));

test("merchant mismatch, inactive account and non-US currency never read location", () => sandbox(async () => {
  for (const bad of [
    { id: "wrong-merchant" }, { id: " chef-merchant " },
    { status: "INACTIVE" }, { currency: "CAD" },
    { country: "CA" }, { status: undefined }, { currency: undefined },
  ]) {
    const { attestation, requests } = service({ merchant: { ...merchant, ...bad } });
    await assert.rejects(attestation.inspect(), safeError);
    assert.deepEqual(requests, ["GET merchant:me"]);
  }
}));

test("location ID, merchant ownership, activity and currency must match exactly", () => sandbox(async () => {
  for (const bad of [
    { id: "wrong-location" }, { id: " chef-location " },
    { merchantId: "wrong-merchant" }, { merchantId: " chef-merchant " },
    { status: "INACTIVE" }, { currency: "EUR" },
    { country: "CA" }, { status: undefined }, { merchantId: undefined },
    { capabilities: undefined }, { capabilities: [] },
    { capabilities: ["OTHER"] }, { capabilities: [" CREDIT_CARD_PROCESSING "] },
    { capabilities: "CREDIT_CARD_PROCESSING" },
  ]) {
    const { attestation, requests } = service({ merchant }, { location: { ...location, ...bad } });
    await assert.rejects(attestation.inspect(), safeError);
    assert.deepEqual(requests, ["GET merchant:me", "GET location:chef-location"]);
  }
}));

test("additional Square location capabilities do not replace required card processing", () => sandbox(async () => {
  const { attestation } = service({ merchant }, {
    location: { ...location, capabilities: ["OTHER", "CREDIT_CARD_PROCESSING"] },
  });
  const evidence = await attestation.inspect();
  assert.equal(evidence.verifiedSandboxMerchantContext, true);
  assert.equal(evidence.grantsEntitlement, false);
}));

test("missing provider fields and malformed envelopes fail closed", () => sandbox(async () => {
  for (const [m, l] of [
    [null, { location }], [{}, { location }], [{ merchant: null }, { location }],
    [{ merchant }, null], [{ merchant }, { location: null }],
    [{ merchant }, {}],
  ] as const) {
    const { attestation } = service(m, l);
    await assert.rejects(attestation.inspect(), safeError);
  }
}));

test("errors, timeouts and unexpected provider responses are sanitized", () => sandbox(async () => {
  for (const [m, l] of [
    [new Error("credential=SECRET"), { location }],
    [{ merchant }, new Error("provider sub-internal-123")],
  ] as const) {
    const { attestation } = service(m, l);
    await assert.rejects(attestation.inspect(), (error: unknown) => {
      assert.ok(error instanceof WeddingSquareSandboxMerchantAttestationError);
      assert.doesNotMatch(error.message, /SECRET|sub-internal-123|chef-merchant|chef-location/);
      return true;
    });
  }
}));

test("production, disabled flag, missing/malformed operator config make zero API calls", () => sandbox(async () => {
  const badConfigs = [
    ["SQUARE_ENV", "production"],
    ["SQUARE_ENV", ""],
    ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "false"],
    ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID", ""],
    ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID", " chef-merchant "],
    ["SQUARE_LOCATION_ID", " chef-location "],
    ["SQUARE_LOCATION_ID", ""],
    ["SQUARE_CURRENCY", "CAD"],
  ] as const;

  for (const [key, value] of badConfigs) {
    const saved = process.env[key];
    process.env[key] = value;
    try {
      const { attestation, requests } = service();
      await assert.rejects(attestation.inspect(), safeError);
      assert.deepEqual(requests, []);
    } finally {
      if (saved === undefined) delete process.env[key]; else process.env[key] = saved;
    }
  }
}));

test("control characters in configured merchant/location identities block all provider GETs", () => sandbox(async () => {
  for (const [key, value] of [
    ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID", "chef\nmerchant"],
    ["SQUARE_LOCATION_ID", "chef\u0001location"],
  ] as const) {
    const before = process.env[key];
    process.env[key] = value;
    try {
      const { attestation, requests } = service();
      await assert.rejects(attestation.inspect(), safeError);
      assert.deepEqual(requests, []);
    } finally {
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    }
  }
}));

test("control-character provider identity fields are rejected without normalization", () => sandbox(async () => {
  for (const bad of [
    { merchant: { ...merchant, id: "chef\u0000merchant" } },
    { merchant: { ...merchant, id: "chef\u007fmerchant" } },
  ]) {
    const { attestation, requests } = service(bad);
    await assert.rejects(attestation.inspect(), safeError);
    assert.deepEqual(requests, ["GET merchant:me"]);
  }
  for (const changed of [
    { id: "chef\u0000location" },
    { merchantId: "chef\nmerchant" },
  ]) {
    const { attestation, requests } = service({ merchant }, { location: { ...location, ...changed } });
    await assert.rejects(attestation.inspect(), safeError);
    assert.deepEqual(requests, ["GET merchant:me", "GET location:chef-location"]);
  }
}));


test("Square v43 merchant/me and location GET wire responses verify token-owned platform context", () => sandbox(async () => {
  // Unlike normalized fixtures, this exercises the installed SDK's real
  // snake_case decoder. All transport is intercepted; no provider network
  // request, database write, or commercial operation can occur.
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = input instanceof Request ? input.method : init?.method ?? "GET";
    assert.equal(method, "GET");
    paths.push(new URL(url).pathname);
    if (paths.length === 1) {
      assert.match(paths[0], /\/v2\/merchants\/me$/);
      return new Response(JSON.stringify({
        merchant: { id: "chef-merchant", status: "ACTIVE", currency: "USD", country: "US" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    assert.equal(paths.length, 2, "no unexpected extra Square requests");
    assert.match(paths[1], /\/v2\/locations\/chef-location$/);
    return new Response(JSON.stringify({
      location: {
        id: "chef-location", merchant_id: "chef-merchant",
        status: "ACTIVE", currency: "USD", country: "US",
        capabilities: ["CREDIT_CARD_PROCESSING"],
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const sdk = new SquareClient({
      token: "offline-contract-token", environment: SquareEnvironment.Sandbox,
    });
    const attestation = createWeddingSquareSandboxMerchantAttestation(
      (merchantId) => sdk.merchants.get({ merchantId }, { maxRetries: 0 }),
      (locationId) => sdk.locations.get({ locationId }, { maxRetries: 0 }),
    );
    const evidence = await attestation.inspect();
    assert.equal(evidence.verifiedSandboxMerchantContext, true);
    assert.equal(evidence.merchantId, "chef-merchant");
    assert.equal(evidence.locationId, "chef-location");
    assert.equal(evidence.currency, "USD");
    assert.equal(evidence.authorizesSubscriptionCreation, false);
    assert.equal(evidence.grantsEntitlement, false);
    assert.equal(evidence.safeToResubmit, false);
    assert.deepEqual(paths, ["/v2/merchants/me", "/v2/locations/chef-location"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));
