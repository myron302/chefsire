import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWeddingSquareCardSetupCoordinator,
  WeddingSquareCardSetupReconciliationError,
} from "./wedding-square-card-setup-coordinator";

const setupId = "123e4567-e89b-42d3-a456-426614174000";
const subscriptionAttemptId = "123e4567-e89b-42d3-a456-426614174001";
const consent = {
  userId: "owner-1", tier: "premium", agreedMonthlyAmountCents: 2499,
  agreedCurrency: "USD", consentTermsVersion: "wedding-monthly-autorenew-v1",
  billingConsentAt: "2026-11-02T01:00:00.000Z", requestedStartDate: "2026-11-20",
  trialExpiresAt: "2026-11-19T14:00:00.000Z",
  subscriptionTimezone: "UTC", automaticRenewal: true,
};
const config = {
  environment: "sandbox", tier: "premium", merchantId: "merchant-1",
  locationId: "location-1", planId: "parent-1", planVariationId: "variation-1",
};
async function enabled(work: () => Promise<void>) {
  const keys = ["SQUARE_ENV", "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
    "WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED"];
  const before = keys.map(key => process.env[key]);
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED = "true";
  try { await work(); } finally {
    keys.forEach((key,i) => before[i] === undefined
      ? delete process.env[key] : process.env[key] = before[i]);
  }
}
function fixture(options: { customerFails?: boolean; blocked?: boolean; invalidCatalog?: boolean } = {}) {
  const trace: string[] = [];
  const argsSeen: unknown[][] = [];
  const client = {
    query: async (statement: string, args: unknown[] = []) => {
      trace.push(statement.trim().split(/\s+/).slice(0,3).join(" "));
      argsSeen.push(args);
      if (statement.includes("AS blocked")) return { rows: [{ blocked: options.blocked ?? false }], rowCount: 1 };
      if (statement.includes("RETURNING id::text AS id")) return { rows: [{ id: setupId }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release: () => { trace.push("released"); },
  };
  const db = {
    connect: async () => client,
    query: async (statement: string, args: unknown[] = []) => client.query(statement,args),
  };
  const catalog = { inspect: async () => {
    trace.push("catalog GET");
    return {
      verifiedSandboxCatalogTerms: !options.invalidCatalog,
      merchantId: "merchant-1", locationId: "location-1",
      premiumPlanVariationId: "variation-1", premiumPlanId: "parent-1",
      grantsEntitlement: false, authorizesSubscriptionCreation: false,
    };
  } };
  const transport = {
    createCustomer: async (input: any) => {
      trace.push("Square Customer POST");
      assert.equal(input.referenceId, "owner-1");
      if (options.customerFails) throw Error("raw provider secret");
      return { id: "cust-1", referenceId: "owner-1" };
    },
    createCard: async (input: any) => {
      trace.push("Square Card POST");
      assert.equal(input.customerId, "cust-1");
      assert.equal(input.sourceId, "cnon:valid-sandbox");
      return { id: "card-1", customerId: "cust-1", merchantId: "merchant-1", enabled: true };
    },
  };
  const readback = {
    getCustomer: async () => { trace.push("Square Customer GET"); return { id: "cust-1", referenceId: "owner-1" }; },
    getCard: async () => { trace.push("Square Card GET"); return {
      id: "card-1", customerId: "cust-1", merchantId: "merchant-1", enabled: true,
    }; },
  };
  const reservations = { reserve: async (input: any) => {
    trace.push("subscription reserve");
    assert.equal(input.verifiedSquareCardId, "card-1");
    return { attemptId: subscriptionAttemptId, status: "reserved", idempotencyKey: "subscription-key" };
  } };
  return { service: createWeddingSquareCardSetupCoordinator(db as any, catalog as any,
    transport as any, readback as any, reservations as any), trace, argsSeen };
}
const input = { consent: consent as any, config: config as any,
  sourceId: "cnon:valid-sandbox", verifiedEmailAddress: "owner@example.com" };
test("Neon owner intent COMMIT happens before any Square POST; no raw nonce persisted", async () => enabled(async () => {
  const x = fixture();
  const result = await x.service.setup(input);
  assert.equal(result.attemptId, subscriptionAttemptId);
  assert.equal(result.paidEntitlementGranted, false);
  assert.equal(result.safeToResubmit, false);
  const sequence = x.trace.join(" | ");
  assert.ok(sequence.indexOf("COMMIT") < sequence.indexOf("Square Customer POST"));
  assert.ok(sequence.indexOf("Square Customer POST") < sequence.indexOf("Square Card POST"));
  assert.ok(sequence.indexOf("Square Card GET") < sequence.indexOf("subscription reserve"));
  assert.doesNotMatch(JSON.stringify(x.argsSeen), /cnon:valid-sandbox|raw provider secret/);
}));
test("ambiguous Customer POST locks setup for operator reconciliation and never creates a card", async () => enabled(async () => {
  const x = fixture({ customerFails: true });
  await assert.rejects(x.service.setup(input), WeddingSquareCardSetupReconciliationError);
  assert.equal(x.trace.filter(entry => entry === "Square Customer POST").length,1);
  assert.ok(!x.trace.includes("Square Card POST"));
  assert.ok(x.trace.some(entry => entry.includes("UPDATE wedding_square_card_setup_attempts")));
}));
test("another unresolved owner subscription blocks before any Square POST", async () => enabled(async () => {
  const x = fixture({ blocked: true });
  await assert.rejects(x.service.setup(input), WeddingSquareCardSetupReconciliationError);
  assert.ok(!x.trace.includes("Square Customer POST"));
  assert.ok(!x.trace.includes("Square Card POST"));
}));
test("bad catalog and production gate stop before DB writes or Square creates", async () => enabled(async () => {
  const x = fixture({ invalidCatalog: true });
  await assert.rejects(x.service.setup(input), WeddingSquareCardSetupReconciliationError);
  assert.ok(!x.trace.includes("Square Customer POST"));
  assert.ok(!x.trace.includes("BEGIN"));
  const y = fixture();
  process.env.SQUARE_ENV = "production";
  await assert.rejects(y.service.setup(input), WeddingSquareCardSetupReconciliationError);
  assert.deepEqual(y.trace, []);
}));
