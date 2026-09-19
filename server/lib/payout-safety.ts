import { z } from "zod";

export const PAYOUTS_UNAVAILABLE_ERROR =
  "Marketplace payouts are unavailable because no verified transfer provider is configured.";

export const payoutRequestSchema = z.object({
  sellerId: z.string().min(1),
  orderIds: z.array(z.string().min(1)).optional(),
}).strict();

/**
 * Payout execution is deliberately a side-effect-free rejection until an
 * external provider submission and verification implementation exists.
 */
export function rejectUnavailablePayout(input: unknown) {
  payoutRequestSchema.parse(input);
  return {
    status: 503,
    body: {
      ok: false as const,
      code: "PAYOUT_PROVIDER_UNAVAILABLE" as const,
      error: PAYOUTS_UNAVAILABLE_ERROR,
      payout: null,
    },
  };
}
