import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createWeddingSquareConfirmationCoordinator, WeddingSquareConfirmationCoordinatorError } from "./wedding-square-confirmation-coordinator";

const attemptId = "b5cb4c11-d000-4000-8000-0cdb457e1990";
const request = { idempotencyKey: "saved-key", locationId: "location", planVariationId: "premium", customerId: "customer", cardId: "card", timezone: "UTC" as const, startDate: "2026-11-11" };
const response = { id: "sub-1", locationId: "location", planVariationId: "premium", customerId: "customer", cardId: "card", timezone: "UTC", startDate: "2026-11-11", status: "PENDING" };
const input = { attemptId, authenticatedUserId: "user-1", claimedRequest: request, claimStatus: "submitting" as const, providerResponse: response };

test("verified response persists exact fingerprint without granting entitlement", async () => {
  let persistArgs: any;
  const persistence = { confirm: async (args: any) => { persistArgs = args; return { attemptId, status: "confirmed" as const, providerSubscriptionId: "sub-1" }; } };
  const state = { markUnknown: async () => { throw Error("unexpected"); } };
  const result = await createWeddingSquareConfirmationCoordinator(persistence, state).confirm(input);
  assert.equal(result.providerSubscriptionId, "sub-1");
  assert.equal(persistArgs.persistedIdempotencyKey, request.idempotencyKey);
  assert.equal(persistArgs.persistedRequestFingerprint, createHash("sha256").update(JSON.stringify(request)).digest("hex"));
  assert.equal(persistArgs.verifiedResponse.providerSubscriptionId, "sub-1");
  assert.equal("entitlement" in result, false);
});

test("mismatched Square response is blocked and sent to reconciliation", async () => {
  let writes = 0; let unknowns = 0;
  const persistence = { confirm: async (): Promise<any> => { writes++; } };
  const state = { markUnknown: async (id: string, user: string) => { assert.deepEqual([id, user], [attemptId, "user-1"]); unknowns++; return { attemptId, status: "needs_reconciliation" as const }; } };
  await assert.rejects(createWeddingSquareConfirmationCoordinator(persistence, state).confirm({ ...input, providerResponse: { ...response, cardId: "other" } }), WeddingSquareConfirmationCoordinatorError);
  assert.equal(writes, 0); assert.equal(unknowns, 1);
});

test("ambiguous persistence failure never retries confirmation", async () => {
  let writes = 0; let unknowns = 0;
  const persistence = { confirm: async (): Promise<any> => { writes++; throw Error("connection lost after COMMIT"); } };
  const state = { markUnknown: async () => { unknowns++; return { attemptId, status: "needs_reconciliation" as const }; } };
  await assert.rejects(createWeddingSquareConfirmationCoordinator(persistence, state).confirm(input), WeddingSquareConfirmationCoordinatorError);
  assert.equal(writes, 1); assert.equal(unknowns, 1);
});

test("missing submitting status blocks both writes", async () => {
  let actions = 0;
  const persistence = { confirm: async (): Promise<any> => { actions++; } };
  const state = { markUnknown: async (): Promise<any> => { actions++; } };
  await assert.rejects(createWeddingSquareConfirmationCoordinator(persistence, state).confirm({ ...input, claimStatus: "reserved" as any }), WeddingSquareConfirmationCoordinatorError);
  assert.equal(actions, 0);
});
