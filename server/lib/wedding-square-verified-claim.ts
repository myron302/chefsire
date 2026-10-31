import { verifyWeddingSquareClaimFingerprint } from "./wedding-square-claim-fingerprint";
import { weddingSquarePreclaim } from "./wedding-square-preclaim";
import { weddingSquareSubmissionState } from "./wedding-square-submission-state";

/**
 * Internal-only bridge between read-only preclaim and the atomic state claim.
 * No route calls this service. No Square API request, payment, or entitlement.
 *
 * The second fingerprint check compares the record returned by the atomic
 * claim against the preclaim snapshot; concurrent edits fail closed.
 * A claimed attempt with an uncertain snapshot requires reconciliation,
 * never a fresh idempotency key.
 */
type Preclaim = Pick<typeof weddingSquarePreclaim, "inspect">;
type Submission = Pick<typeof weddingSquareSubmissionState, "claim" | "markUnknown">;

export class WeddingSquareVerifiedClaimError extends Error {
  constructor() {
    super("Square enrollment claim requires provider reconciliation or operator review.");
    this.name = "WeddingSquareVerifiedClaimError";
  }
}

export function createWeddingSquareVerifiedClaimService(preclaim: Preclaim, submission: Submission) {
  return {
    async prepareClaim(attemptId: string, authenticatedUserId: string) {
      // Must inspect first; never mutate an invalid or disabled reservation.
      let inspected: Awaited<ReturnType<Preclaim["inspect"]>>;
      try {
        inspected = await preclaim.inspect(attemptId, authenticatedUserId);
      } catch {
        throw new WeddingSquareVerifiedClaimError();
      }
      let claimed: Awaited<ReturnType<Submission["claim"]>>;
      try {
        claimed = await submission.claim(attemptId, authenticatedUserId);
      } catch {
        // May be an ambiguous database acknowledgement. Do not automatically
        // retry or mark unknown without knowing that claim actually succeeded.
        throw new WeddingSquareVerifiedClaimError();
      }
      try {
        if (inspected.attemptId !== claimed.attemptId || claimed.status !== "submitting") {
          throw new WeddingSquareVerifiedClaimError();
        }
        const request = verifyWeddingSquareClaimFingerprint({
          claimedIdempotencyKey: claimed.persistedIdempotencyKey,
          persistedRequestFingerprint: claimed.requestFingerprint,
          preparedRequest: inspected.request,
        });
        return Object.freeze({ attemptId: claimed.attemptId, request, status: "submitting" as const });
      } catch {
        // We do know the claim succeeded; do not leave a mismatched request
        // eligible for Square submission. If transition fails, still fail shut.
        try { await submission.markUnknown(attemptId, authenticatedUserId); } catch { /* leave blocked in submitting */ }
        throw new WeddingSquareVerifiedClaimError();
      }
    },
  };
}

export const weddingSquareVerifiedClaim = createWeddingSquareVerifiedClaimService(
  weddingSquarePreclaim, weddingSquareSubmissionState,
);
