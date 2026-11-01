import { z } from "zod";
import { weddingSquareRawSubscriptionApi } from "./wedding-square-sandbox-subscription-http";
import { weddingSquareSandboxCatalogAttestation } from "./wedding-square-sandbox-catalog-attestation";
import { weddingSquareOwnershipClaim } from "./wedding-square-ownership-claim";
import { weddingSquareConfirmationCoordinator } from "./wedding-square-confirmation-coordinator";
import { weddingSquareSubmissionState } from "./wedding-square-submission-state";
import type { prepareWeddingSquareSubscriptionRequest } from "./wedding-square-subscription-request";

/**
 * Internal ONLY: the first actual Square CreateSubscription integration.
 *
 * NO HTTP route calls this service. A future authenticated route must load
 * the saved customer binding from Neon and read Square customer/card objects
 * independently before constructing the ownership input. The browser is NEVER
 * permitted to pass provider customer/card IDs or a pretend ownership record.
 *
 * This service first attests the token-owned sandbox merchant and Wedding plans,
 * then uses the existing owner-bound reservation/atomic claim. The claim is
 * committed BEFORE a single provider POST. Unknown responses are NEVER retried:
 * they require a provider GET/readback and operator reconciliation.
 *
 * Even a confirmed Square subscription is not a paid invoice, paid-through
 * period or entitlement. No premium access is conferred here.
 */
type Request = ReturnType<typeof prepareWeddingSquareSubscriptionRequest>;
type Ownership = Pick<typeof weddingSquareOwnershipClaim, "prepare">;
type Catalog = Pick<typeof weddingSquareSandboxCatalogAttestation, "inspect">;
type Coordinator = Pick<typeof weddingSquareConfirmationCoordinator, "confirm">;
type State = Pick<typeof weddingSquareSubmissionState, "markUnknown">;
type CreateProvider = (request: Request) => Promise<unknown>;

const canonicalId = z.string().min(1).max(200).refine((value) =>
  !/[\s\x00-\x1f\x7f]/.test(value),
);
const envelope = z.object({
  errors: z.array(z.unknown()).length(0).optional(),
  subscription: z.object({
    id: canonicalId,
    locationId: canonicalId,
    customerId: canonicalId,
    planVariationId: canonicalId,
    cardId: canonicalId,
    timezone: z.literal("UTC"),
    startDate: z.string(),
    status: z.enum(["PENDING", "ACTIVE"]),
  }).passthrough(),
}).passthrough();

export class WeddingSquareSandboxSubmissionError extends Error {
  constructor() {
    super("Wedding Square enrollment requires reconciliation or operator review.");
    this.name = "WeddingSquareSandboxSubmissionError";
  }
}

export function createWeddingSquareSandboxSubscriptionSubmitter(
  catalogAttestation: Catalog,
  ownershipClaim: Ownership,
  createSubscription: CreateProvider,
  confirmation: Coordinator,
  submissionState: State,
) {
  return {
    async submit(input: Parameters<Ownership["prepare"]>[0]) {
      // No network, Neon changes or Square client creation when disabled.
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !canonicalId.safeParse(input?.attemptId).success ||
          !canonicalId.safeParse(input?.authenticatedUserId).success ||
          !canonicalId.safeParse(input?.expectedSandboxMerchantId).success) {
        throw new WeddingSquareSandboxSubmissionError();
      }

      // Read-only attestation before the claim, not a license to bypass owner
      // checks. The returned evidence explicitly grants no entitlement.
      let attested: Awaited<ReturnType<Catalog["inspect"]>>;
      try {
        attested = await catalogAttestation.inspect();
        if (!attested || attested.verifiedSandboxCatalogTerms !== true ||
            attested.merchantId !== input.expectedSandboxMerchantId ||
            attested.locationId !== process.env.SQUARE_LOCATION_ID ||
            attested.authorizesSubscriptionCreation !== false ||
            attested.grantsEntitlement !== false ||
            attested.safeToResubmit !== false) {
          throw new WeddingSquareSandboxSubmissionError();
        }
      } catch {
        throw new WeddingSquareSandboxSubmissionError();
      }

      // This service is not exposed as a route. Its ownership records MUST
      // come from trusted server-side Neon + Square GETs, not req.body.
      let claimed: Awaited<ReturnType<Ownership["prepare"]>>;
      try {
        claimed = await ownershipClaim.prepare(input);
      } catch {
        // The verified-claim service already leaves uncertain claims blocked.
        // Do not blindly mark an attempt whose claim might not exist.
        throw new WeddingSquareSandboxSubmissionError();
      }

      try {
        if (!claimed || claimed.attemptId !== input.attemptId ||
            claimed.status !== "submitting" ||
            !canonicalId.safeParse(claimed.request?.idempotencyKey).success ||
            !canonicalId.safeParse(claimed.request?.cardId).success ||
            !canonicalId.safeParse(claimed.request?.customerId).success ||
            claimed.request.locationId !== attested.locationId ||
            claimed.request.timezone !== "UTC" ||
            ![
              attested.premiumPlanVariationId,
              attested.elitePlanVariationId,
            ].includes(claimed.request.planVariationId)) {
          throw new WeddingSquareSandboxSubmissionError();
        }

        // Capture this at the exact submit boundary, not when consent was
        // originally signed. Square assigns today's date for no-trial starts.
        const submissionUtcDate = new Date().toISOString().slice(0, 10);

        // One attempted Square POST, direct transport with zero retries. A timeout/5xx/invalid
        // response may STILL have created a subscription. No automatic retry.
        const squareResult = envelope.safeParse(await createSubscription(claimed.request));
        if (!squareResult.success) throw new WeddingSquareSandboxSubmissionError();

        const confirmed = await confirmation.confirm({
          attemptId: input.attemptId,
          authenticatedUserId: input.authenticatedUserId,
          claimedRequest: claimed.request,
          claimStatus: "submitting",
          providerResponse: squareResult.data.subscription,
          submissionUtcDate,
        });
        if (confirmed.attemptId !== input.attemptId ||
            confirmed.status !== "confirmed" ||
            !canonicalId.safeParse(confirmed.providerSubscriptionId).success) {
          throw new WeddingSquareSandboxSubmissionError();
        }
        return Object.freeze({
          attemptId: confirmed.attemptId,
          status: "confirmed" as const,
          providerSubscriptionId: confirmed.providerSubscriptionId,
          grantsEntitlement: false as const,
          safeToResubmit: false as const,
          requiresPaymentReconciliation: true as const,
        });
      } catch {
        // Always block the claimed attempt after ANY uncertain outcome.
        // markUnknown may itself fail (e.g. an ambiguous COMMIT), in which case
        // 'submitting' remains blocked by DB uniqueness until manual readback.
        try { await submissionState.markUnknown(input.attemptId, input.authenticatedUserId); }
        catch { /* fail closed */ }
        throw new WeddingSquareSandboxSubmissionError();
      }
    },
  };
}

export const weddingSquareSandboxSubscriptionSubmitter =
  createWeddingSquareSandboxSubscriptionSubmitter(
    weddingSquareSandboxCatalogAttestation,
    weddingSquareOwnershipClaim,
    async (request) => weddingSquareRawSubscriptionApi.create(request),
    weddingSquareConfirmationCoordinator,
    weddingSquareSubmissionState,
  );
