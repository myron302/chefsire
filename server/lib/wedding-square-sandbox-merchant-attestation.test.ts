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
  assert.deepEqual(requests, ["GET merchant:chef-merchant", "GET location:chef-location"]);
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
    assert.deepEqual(first.requests, ["GET merchant:chef-merchant"]);
    const second = service({ merchant }, { location, errors: malformed });
    await assert.rejects(second.attestation.inspect(), safeError);
    assert.deepEqual(second.requests, ["GET merchant:chef-merchant", "GET location:chef-location"]);
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
    assert.deepEqual(requests, ["GET merchant:chef-merchant"]);
  }
}));

test("location ID, merchant ownership, activity and currency must match exactly", () => sandbox(async () => {
  for (const bad of [
    { id: "wrong-location" }, { id: " chef-location " },
    { merchantId: "wrong-merchant" }, { merchantId: " chef-merchant " },
    { status: "INACTIVE" }, { currency: "EUR" },
    { country: "CA" }, { status: undefined }, { merchantId: undefined },
  ]) {
    const { attestation, requests } = service({ merchant }, { location: { ...location, ...bad } });
    await assert.rejects(attestation.inspect(), safeError);
    assert.deepEqual(requests, ["GET merchant:chef-merchant", "GET location:chef-location"]);
  }
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
