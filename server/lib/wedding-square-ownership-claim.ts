import { verifyWeddingSquareCustomerCardOwnership } from "./wedding-square-customer-card-ownership";
import { weddingSquarePreclaim } from "./wedding-square-preclaim";
import { weddingSquareVerifiedClaim } from "./wedding-square-verified-claim";
import { weddingSquareSubmissionState } from "./wedding-square-submission-state";

/**
 * Server-only composition boundary. The caller must independently load the
 * ownership binding from trusted storage and read back customer/card from
 * Square sandbox. Never accept these records from the browser.
 *
 * No route calls this service; no Square API call or paid access is granted.
 */
type OwnershipInput = Parameters<typeof verifyWeddingSquareCustomerCardOwnership>[0];
type Preclaim = Pick<typeof weddingSquarePreclaim, "inspect">;
type Claim = Pick<typeof weddingSquareVerifiedClaim, "prepareClaim">;
type Submission = Pick<typeof weddingSquareSubmissionState, "markUnknown">;

export class WeddingSquareOwnershipClaimError extends Error {
  constructor() {
    super("Square enrollment claim requires verified customer and card ownership.");
    this.name = "WeddingSquareOwnershipClaimError";
  }
}

export function createWeddingSquareOwnershipClaimService(
  preclaim: Preclaim, claim: Claim, submission: Submission,
) {
  return {
    async prepare(input: OwnershipInput & { attemptId: string }) {
      let verified: ReturnType<typeof verifyWeddingSquareCustomerCardOwnership>;
      let saved: Awaited<ReturnType<Preclaim["inspect"]>>;
      try {
        verified = verifyWeddingSquareCustomerCardOwnership(input);
        saved = await preclaim.inspect(input.attemptId, input.authenticatedUserId);
        if (saved.attemptId !== input.attemptId ||
            saved.request.customerId !== verified.verifiedSquareCustomerId ||
            saved.request.cardId !== verified.verifiedSquareCardId) {
          throw new WeddingSquareOwnershipClaimError();
        }
      } catch {
        // No claim was made. Do not advance the persisted attempt's state.
        throw new WeddingSquareOwnershipClaimError();
      }

      let claimed: Awaited<ReturnType<Claim["prepareClaim"]>>;
      try {
        claimed = await claim.prepareClaim(input.attemptId, input.authenticatedUserId);
      } catch {
        // Claim failure could be ambiguous; never retry automatically.
        throw new WeddingSquareOwnershipClaimError();
      }

      if (claimed.attemptId !== saved.attemptId ||
          claimed.request.customerId !== verified.verifiedSquareCustomerId ||
          claimed.request.cardId !== verified.verifiedSquareCardId ||
          claimed.request.idempotencyKey !== saved.request.idempotencyKey) {
        try { await submission.markUnknown(input.attemptId, input.authenticatedUserId); }
        catch { /* remain blocked in submitting; operator reconciliation required */ }
        throw new WeddingSquareOwnershipClaimError();
      }
      return Object.freeze({ attemptId: claimed.attemptId, request: claimed.request, status: "submitting" as const });
    },
  };
}

export const weddingSquareOwnershipClaim = createWeddingSquareOwnershipClaimService(
  weddingSquarePreclaim, weddingSquareVerifiedClaim, weddingSquareSubmissionState,
);
