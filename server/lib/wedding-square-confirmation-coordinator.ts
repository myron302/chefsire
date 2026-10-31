import { createHash } from "node:crypto";
import { verifyWeddingSquareCreatedSubscription } from "./wedding-square-subscription-response";
import { weddingSquareConfirmationPersistence } from "./wedding-square-confirmation-persistence";
import { weddingSquareSubmissionState } from "./wedding-square-submission-state";
import type { prepareWeddingSquareSubscriptionRequest } from "./wedding-square-subscription-request";

/**
 * Internal-only confirmation boundary for a future trusted sandbox Square caller.
 * The caller must pass the verified claim from ownershipClaim.prepare(), then
 * an independently obtained Square subscription response. Never accept the
 * provider response or authenticated user ID from the browser.
 * This neither calls Square nor grants premium entitlements.
 */
type Request = ReturnType<typeof prepareWeddingSquareSubscriptionRequest>;
type Persist = Pick<typeof weddingSquareConfirmationPersistence, "confirm">;
type State = Pick<typeof weddingSquareSubmissionState, "markUnknown">;

export class WeddingSquareConfirmationCoordinatorError extends Error {
  constructor() {
    super("Square enrollment confirmation requires reconciliation.");
    this.name = "WeddingSquareConfirmationCoordinatorError";
  }
}

export function createWeddingSquareConfirmationCoordinator(persist: Persist, state: State) {
  return {
    async confirm(input: {
      attemptId: string;
      authenticatedUserId: string;
      claimedRequest: Request;
      claimStatus: "submitting";
      providerResponse: unknown;
      submissionUtcDate?: string;
    }) {
      const { attemptId, authenticatedUserId, claimedRequest } = input;
      if (!attemptId?.trim() || !authenticatedUserId?.trim() ||
          input.claimStatus !== "submitting" ||
          !claimedRequest?.idempotencyKey?.trim()) {
        throw new WeddingSquareConfirmationCoordinatorError();
      }

      // An invalid response is never treated as proof that Square did not
      // create the subscription. Block this attempt for readback/reconciliation.
      let verified: ReturnType<typeof verifyWeddingSquareCreatedSubscription>;
      try {
        verified = verifyWeddingSquareCreatedSubscription(
          claimedRequest, input.providerResponse, input.submissionUtcDate,
        );
      } catch {
        try { await state.markUnknown(attemptId, authenticatedUserId); } catch { /* stay blocked */ }
        throw new WeddingSquareConfirmationCoordinatorError();
      }
      try {
        return await persist.confirm({
          attemptId, authenticatedUserId,
          persistedIdempotencyKey: claimedRequest.idempotencyKey,
          persistedRequestFingerprint: createHash("sha256").update(JSON.stringify(claimedRequest)).digest("hex"),
          verifiedResponse: verified,
        });
      } catch {
        // Database write outcomes can be ambiguous: never re-submit to Square.
        // A failed markUnknown does not make it safe to retry automatically.
        try { await state.markUnknown(attemptId, authenticatedUserId); } catch { /* requires readback */ }
        throw new WeddingSquareConfirmationCoordinatorError();
      }
    },
  };
}

export const weddingSquareConfirmationCoordinator =
  createWeddingSquareConfirmationCoordinator(weddingSquareConfirmationPersistence, weddingSquareSubmissionState);
