import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createWeddingSquareVerifiedClaimService, WeddingSquareVerifiedClaimError } from "./wedding-square-verified-claim";

const attemptId = "b5cb4c11-d000-4000-8000-0cdb457e1990";
const request = Object.freeze({
  idempotencyKey: "saved-key", locationId: "location",
  planVariationId: "premium-plan", customerId: "customer",
  cardId: "card", timezone: "UTC" as const, startDate: "2026-11-11",
});
const fingerprint = createHash("sha256").update(JSON.stringify(request)).digest("hex");

test("preclaim precedes atomic claim and verifies returned persisted fingerprint", async () => {
  const order: string[] = [];
  const preclaim = { inspect: async () => { order.push("inspect"); return { attemptId, request }; } };
  const submission = {
    claim: async () => { order.push("claim"); return { attemptId, persistedIdempotencyKey: "saved-key", requestFingerprint: fingerprint, status: "submitting" as const }; },
    markUnknown: async () => { order.push("unknown"); return { attemptId, status: "needs_reconciliation" as const }; },
  };
  const result = await createWeddingSquareVerifiedClaimService(preclaim, submission).prepareClaim(attemptId, "user-1");
  assert.deepEqual(order, ["inspect", "claim"]);
  assert.equal(result.request, request);
  assert.equal(result.status, "submitting");
});

test("failed preclaim never mutates submission state", async () => {
  let writes = 0;
  const preclaim = { inspect: async (): Promise<any> => { throw Error("sensitive"); } };
  const submission = { claim: async (): Promise<any> => { writes++; }, markUnknown: async (): Promise<any> => { writes++; } };
  await assert.rejects(createWeddingSquareVerifiedClaimService(preclaim, submission).prepareClaim(attemptId, "user-1"),
    (e: unknown) => e instanceof WeddingSquareVerifiedClaimError && !e.message.includes("sensitive"));
  assert.equal(writes, 0);
});

test("claimed fingerprint mismatch transitions to reconciliation, never submits", async () => {
  const order: string[] = [];
  const preclaim = { inspect: async () => ({ attemptId, request }) };
  const submission = {
    claim: async () => { order.push("claim"); return { attemptId, persistedIdempotencyKey: "saved-key", requestFingerprint: "a".repeat(64), status: "submitting" as const }; },
    markUnknown: async (id: string, userId: string) => {
      assert.deepEqual([id, userId], [attemptId, "user-1"]);
      order.push("unknown"); return { attemptId, status: "needs_reconciliation" as const };
    },
  };
  await assert.rejects(createWeddingSquareVerifiedClaimService(preclaim, submission).prepareClaim(attemptId, "user-1"), WeddingSquareVerifiedClaimError);
  assert.deepEqual(order, ["claim", "unknown"]);
});

test("ambiguous claim failure is never automatically retried or assumed successful", async () => {
  let claims = 0;
  let unknowns = 0;
  const preclaim = { inspect: async () => ({ attemptId, request }) };
  const submission = {
    claim: async (): Promise<any> => { claims++; throw Error("database timeout"); },
    markUnknown: async (): Promise<any> => { unknowns++; },
  };
  await assert.rejects(createWeddingSquareVerifiedClaimService(preclaim, submission).prepareClaim(attemptId, "user-1"), WeddingSquareVerifiedClaimError);
  assert.equal(claims, 1);
  assert.equal(unknowns, 0);
});
