import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { verifyWeddingSquareClaimFingerprint, WeddingSquareFingerprintMismatchError } from "./wedding-square-claim-fingerprint";

const request = {
  idempotencyKey: "saved-enrollment-key",
  locationId: "loc",
  planVariationId: "premium-plan",
  customerId: "customer",
  cardId: "card",
  timezone: "UTC" as const,
  startDate: "2026-11-11",
};
const fingerprint = createHash("sha256").update(JSON.stringify(request)).digest("hex");

test("reconstructed request must equal persisted reservation", () => {
  assert.deepEqual(verifyWeddingSquareClaimFingerprint({
    claimedIdempotencyKey: request.idempotencyKey,
    persistedRequestFingerprint: fingerprint,
    preparedRequest: request,
  }), request);
});

test("saved idempotency key must exactly match reconstructed request", () => {
  assert.throws(() => verifyWeddingSquareClaimFingerprint({
    claimedIdempotencyKey: "different-key",
    persistedRequestFingerprint: fingerprint,
    preparedRequest: request,
  }), WeddingSquareFingerprintMismatchError);
});

test("changing any Square billing material fails closed", () => {
  for (const patch of [
    { planVariationId: "elite-plan" }, { customerId: "other" },
    { cardId: "other" }, { locationId: "other" },
    { startDate: "2026-11-12" }, { timezone: "America/New_York" },
  ]) {
    assert.throws(() => verifyWeddingSquareClaimFingerprint({
      claimedIdempotencyKey: request.idempotencyKey,
      persistedRequestFingerprint: fingerprint,
      preparedRequest: { ...request, ...patch } as any,
    }), WeddingSquareFingerprintMismatchError);
  }
});

test("missing or malformed saved fingerprint fails closed", () => {
  for (const bad of ["", "x".repeat(64), "a".repeat(63)]) {
    assert.throws(() => verifyWeddingSquareClaimFingerprint({
      claimedIdempotencyKey: request.idempotencyKey,
      persistedRequestFingerprint: bad,
      preparedRequest: request,
    }), WeddingSquareFingerprintMismatchError);
  }
});
