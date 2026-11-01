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
// Independently callable evidence validation must reject noncanonical IDs even
// if the saved and provider values happen to match byte-for-byte.
const canonicalId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !/[\s\x00-\x1f\x7f]/.test(value);
const providerIdSchema = z.string().min(1).refine(canonicalId);
const providerSchema = z.object({
  id: providerIdSchema,
  customerId: providerIdSchema,
  cardId: providerIdSchema,
  locationId: providerIdSchema,
  planVariationId: providerIdSchema,
  status: z.enum(["PENDING", "ACTIVE", "CANCELED", "DEACTIVATED", "PAUSED", "COMPLETED"]),
  timezone: z.literal("UTC"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).passthrough();

export class WeddingSquareProviderReadbackMismatchError extends Error {
  constructor() {
    super("Square provider readback does not verify the saved enrollment.");
    this.name = "WeddingSquareProviderReadbackMismatchError";
  }
}

function canonicalUtcDate(value: string): boolean {
  const timestamp = Date.parse(value + "T00:00:00.000Z");
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function verifyWeddingSquareProviderReconciliation(saved: Saved, provider: unknown) {
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true") {
    throw new WeddingSquareProviderReadbackMismatchError();
  }
  const result = providerSchema.safeParse(provider);
  if (!saved || !result.success ||
      !["submitting", "needs_reconciliation", "confirmed"].includes(saved.status) ||
      !canonicalId(saved.persistedIdempotencyKey) ||
      !/^[a-f0-9]{64}$/.test(saved.persistedRequestFingerprint ?? "") ||
      !canonicalId(saved.attemptId) ||
      !canonicalId(saved.customerId) || !canonicalId(saved.cardId) ||
      !canonicalId(saved.locationId) || !canonicalId(saved.planVariationId) ||
      (saved.providerSubscriptionId !== null && !canonicalId(saved.providerSubscriptionId)) ||
      (saved.status === "confirmed" && saved.providerSubscriptionId === null) ||
      result.data.customerId !== saved.customerId ||
      result.data.cardId !== saved.cardId ||
      result.data.locationId !== saved.locationId ||
      result.data.planVariationId !== saved.planVariationId ||
      saved.requestedTimezone !== "UTC" ||
      (saved.requestedStartDate !== null &&
       (typeof saved.requestedStartDate !== "string" ||
        result.data.startDate !== saved.requestedStartDate)) ||
      !canonicalUtcDate(result.data.startDate) ||
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
