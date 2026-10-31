import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareOwnershipClaimService, WeddingSquareOwnershipClaimError } from "./wedding-square-ownership-claim";

const attemptId = "attempt-1";
const request = { idempotencyKey: "saved-key", locationId: "location", planVariationId: "premium-plan", customerId: "customer", cardId: "card", timezone: "UTC" as const, startDate: "2026-11-11" };
const ownership = {
  attemptId, authenticatedUserId: "user-1", expectedSandboxMerchantId: "merchant",
  savedBinding: { userId: "user-1", squareEnvironment: "sandbox" as const, squareMerchantId: "merchant", squareCustomerId: "customer" },
  providerCustomer: { id: "customer", squareMerchantId: "merchant" },
  providerCard: { id: "card", customerId: "customer" },
};
async function sandbox(fn: () => Promise<void>) {
  const old = [process.env.SQUARE_ENV, process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED];
  process.env.SQUARE_ENV = "sandbox"; process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  try { await fn(); } finally {
    if (old[0] === undefined) delete process.env.SQUARE_ENV; else process.env.SQUARE_ENV = old[0];
    if (old[1] === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED; else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = old[1];
  }
}
test("valid owned card is checked against saved enrollment before any claim", async () => sandbox(async () => {
  const order: string[] = [];
  const preclaim = { inspect: async () => { order.push("inspect"); return { attemptId, request }; } };
  const claim = { prepareClaim: async () => { order.push("claim"); return { attemptId, request, status: "submitting" as const }; } };
  const submission = { markUnknown: async () => { order.push("unknown"); return { attemptId, status: "needs_reconciliation" as const }; } };
  const result = await createWeddingSquareOwnershipClaimService(preclaim, claim, submission).prepare(ownership);
  assert.deepEqual(order, ["inspect", "claim"]);
  assert.equal(result.request.cardId, "card");
}));
test("wrong customer or card fails without claiming", async () => sandbox(async () => {
  let claims = 0;
  const preclaim = { inspect: async () => ({ attemptId, request: { ...request, cardId: "different" } }) };
  const claim = { prepareClaim: async () => { claims++; return { attemptId, request, status: "submitting" as const }; } };
  const submission = { markUnknown: async () => ({ attemptId, status: "needs_reconciliation" as const }) };
  await assert.rejects(createWeddingSquareOwnershipClaimService(preclaim, claim, submission).prepare(ownership), WeddingSquareOwnershipClaimError);
  assert.equal(claims, 0);
}));
test("changed customer after claim triggers reconciliation and refuses submission", async () => sandbox(async () => {
  let unknowns = 0;
  const preclaim = { inspect: async () => ({ attemptId, request }) };
  const claim = { prepareClaim: async () => ({ attemptId, request: { ...request, customerId: "other" }, status: "submitting" as const }) };
  const submission = { markUnknown: async () => { unknowns++; return { attemptId, status: "needs_reconciliation" as const }; } };
  await assert.rejects(createWeddingSquareOwnershipClaimService(preclaim, claim, submission).prepare(ownership), WeddingSquareOwnershipClaimError);
  assert.equal(unknowns, 1);
}));
test("ambiguous claim error is not retried", async () => sandbox(async () => {
  let claims = 0;
  const preclaim = { inspect: async () => ({ attemptId, request }) };
  const claim = { prepareClaim: async (): Promise<any> => { claims++; throw new Error("timeout"); } };
  const submission = { markUnknown: async () => ({ attemptId, status: "needs_reconciliation" as const }) };
  await assert.rejects(createWeddingSquareOwnershipClaimService(preclaim, claim, submission).prepare(ownership), WeddingSquareOwnershipClaimError);
  assert.equal(claims, 1);
}));
