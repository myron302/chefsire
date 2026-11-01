import { z } from "zod";
import type { prepareWeddingSquareSubscriptionRequest } from "./wedding-square-subscription-request";

/**
 * Validate a Square CreateSubscription response BEFORE recording confirmation.
 * This is not payment verification and never grants subscription entitlements.
 * A missing or mismatched provider response requires manual/readback reconciliation.
 */
// The subscription ID is persisted and later used as an exact Square GET key.
// Reject padded or control-character IDs before ever confirming an attempt.
const exactSubscriptionId = z.string().min(1).refine(
  (id) => id === id.trim() && !/[\\s\\x00-\\x1f\\x7f]/.test(id),
);

const subscriptionSchema = z.object({
  id: exactSubscriptionId,
  locationId: z.string().min(1),
  customerId: z.string().min(1),
  planVariationId: z.string().min(1),
  cardId: z.string().min(1),
  timezone: z.literal("UTC"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PENDING", "ACTIVE"]),
}).passthrough();

export class WeddingSquareReconciliationRequiredError extends Error {
  constructor() {
    super("Square subscription response requires provider reconciliation.");
    this.name = "WeddingSquareReconciliationRequiredError";
  }
}

type PreparedRequest = ReturnType<typeof prepareWeddingSquareSubscriptionRequest>;

/**
 * Must only receive the response from the independently authenticated
 * sandbox Square client for the saved enrollment's customer/merchant.
 */
export function verifyWeddingSquareCreatedSubscription(
  request: PreparedRequest,
  response: unknown,
  // Mandatory for an immediate-start request: UTC calendar date captured immediately
  // before the Square create call. A date-boundary race fails closed to readback.
  submissionUtcDate?: string,
) {
  const parsed = subscriptionSchema.safeParse(response);
  if (!parsed.success) throw new WeddingSquareReconciliationRequiredError();
  const result = parsed.data;
  // Square may assign the actual start date when the request omits startDate.
  // Accept only the submission-day UTC date; future/backdated dates and missing
  // submission evidence require reconciliation rather than silent confirmation.
  const immediate = request.startDate === undefined;
  if (immediate && (!submissionUtcDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(submissionUtcDate) ||
      !Number.isFinite(Date.parse(submissionUtcDate + "T00:00:00.000Z")) ||
      new Date(submissionUtcDate + "T00:00:00.000Z").toISOString().slice(0, 10) !== submissionUtcDate ||
      result.startDate !== submissionUtcDate)) {
    throw new WeddingSquareReconciliationRequiredError();
  }
  if (
    result.locationId !== request.locationId ||
    result.customerId !== request.customerId ||
    result.cardId !== request.cardId ||
    result.planVariationId !== request.planVariationId ||
    result.timezone !== request.timezone ||
    (request.startDate !== undefined && result.startDate !== request.startDate)
  ) throw new WeddingSquareReconciliationRequiredError();

  // Requests without startDate begin immediately. Never infer paid entitlement
  // from provider status, even if Square responds ACTIVE.
  return Object.freeze({
    providerSubscriptionId: result.id,
    providerStatus: result.status,
    verifiedLocationId: result.locationId,
    verifiedPlanVariationId: result.planVariationId,
  });
}
