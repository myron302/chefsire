import { z } from "zod";
import type { weddingSquareReconciliationReadback } from "./wedding-square-reconciliation-readback";

/**
 * Validates an independently retrieved Square sandbox subscription against
 * the persisted Neon enrollment identity. Validation is read-only; it NEVER
 * updates state, automatically retries a subscription or grants paid access.
 *
 * Caller must verify the source is an authenticated Square sandbox response
 * for the expected merchant. Never accept browser-supplied provider records.
 */
type Saved = Awaited<ReturnType<typeof weddingSquareReconciliationReadback.inspect>>;
const providerSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  cardId: z.string().min(1),
  locationId: z.string().min(1),
  planVariationId: z.string().min(1),
  status: z.enum(["PENDING", "ACTIVE", "CANCELED", "DEACTIVATED", "PAUSED", "COMPLETED"]),
}).passthrough();

export class WeddingSquareProviderReadbackMismatchError extends Error {
  constructor() {
    super("Square provider readback does not verify the saved enrollment.");
    this.name = "WeddingSquareProviderReadbackMismatchError";
  }
}

export function verifyWeddingSquareProviderReconciliation(saved: Saved, provider: unknown) {
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true") {
    throw new WeddingSquareProviderReadbackMismatchError();
  }
  const result = providerSchema.safeParse(provider);
  if (!saved || !result.success ||
      !["submitting", "needs_reconciliation", "confirmed"].includes(saved.status) ||
      !saved.persistedIdempotencyKey?.trim() ||
      !/^[a-f0-9]{64}$/.test(saved.persistedRequestFingerprint ?? "") ||
      !saved.attemptId?.trim() ||
      result.data.customerId !== saved.customerId ||
      result.data.cardId !== saved.cardId ||
      result.data.locationId !== saved.locationId ||
      result.data.planVariationId !== saved.planVariationId ||
      (saved.providerSubscriptionId !== null &&
       result.data.id !== saved.providerSubscriptionId)) {
    throw new WeddingSquareProviderReadbackMismatchError();
  }

  // This result is a *candidate* for operator reconciliation, not proof of a
  // charge or proof that the original idempotent submission created it.
  // Unlinked records require separately verified provenance before linking.
  return Object.freeze({
    attemptId: saved.attemptId,
    providerSubscriptionId: result.data.id,
    providerStatus: result.data.status,
    existingIdMatches: saved.providerSubscriptionId === result.data.id,
    requiresOperatorReconciliation: true as const,
    grantsEntitlement: false as const,
    safeToResubmit: false as const,
  });
}
