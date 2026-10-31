import { createHash, timingSafeEqual } from "node:crypto";
import type { prepareWeddingSquareSubscriptionRequest } from "./wedding-square-subscription-request";

/**
 * Compares a persisted reservation's request fingerprint against the exact
 * request reconstructed from trusted server-side enrollment records.
 * Prevents submitting a different plan/customer/card/date on a saved key.
 *
 * Pure function: does not call Square, mutate Neon, or grant paid access.
 */
export class WeddingSquareFingerprintMismatchError extends Error {
  constructor() {
    super("Saved Square enrollment request no longer matches its reservation.");
    this.name = "WeddingSquareFingerprintMismatchError";
  }
}
type Request = ReturnType<typeof prepareWeddingSquareSubscriptionRequest>;

export function verifyWeddingSquareClaimFingerprint(input: {
  claimedIdempotencyKey: string;
  persistedRequestFingerprint: string;
  preparedRequest: Request;
}): Request {
  const { claimedIdempotencyKey, persistedRequestFingerprint, preparedRequest } = input;
  if (!claimedIdempotencyKey || claimedIdempotencyKey !== preparedRequest.idempotencyKey ||
      !/^[a-f0-9]{64}$/.test(persistedRequestFingerprint ?? "")) {
    throw new WeddingSquareFingerprintMismatchError();
  }
  // The reservation phase hashes JSON.stringify(request) in this exact order.
  // Do not change serializer or field order without a versioned migration.
  const digest = createHash("sha256").update(JSON.stringify(preparedRequest)).digest();
  const stored = Buffer.from(persistedRequestFingerprint, "hex");
  if (stored.length !== digest.length || !timingSafeEqual(stored, digest)) {
    throw new WeddingSquareFingerprintMismatchError();
  }
  return preparedRequest;
}
