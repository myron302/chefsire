import { z } from "zod";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareSandboxMerchantAttestation } from "./wedding-square-sandbox-merchant-attestation";
import { weddingSquareCancelTransport } from "./wedding-square-sandbox-cancel-transport";
import { WEDDING_CONSENT_VERSION, WEDDING_MONTHLY_CENTS } from "./wedding-square-billing-policy";

/**
 * Authenticated, sandbox-only cancel-at-period-end for the exact user-owned
 * Square subscription. No subscription ID comes from the browser.
 *
 * A single atomic Neon claim is persisted BEFORE one Square cancellation POST.
 * An unknown outcome is blocked for provider reconciliation; NEVER retry POST.
 * This does not revoke a cardless trial, change paidThrough, or grant/revoke
 * paid entitlements. Square cancel schedules end of current billing period.
 */
type Db = Pick<PoolClient, "query">;
type Merchant = Pick<typeof weddingSquareSandboxMerchantAttestation, "inspect">;
type Provider = Pick<typeof weddingSquareCancelTransport, "get" | "cancel">;
type Row = {
  id: string; user_id: string; tier: string;
  square_merchant_id: string; square_location_id: string;
  square_customer_id: string; square_card_id: string | null;
  square_plan_variation_id: string; square_subscription_id: string;
  billing_consent_terms_version: string; agreed_monthly_amount_cents: number;
  agreed_currency: string; provider_status: string;
};
const canonical = z.string().min(1).max(200).refine(s=>!/[\s\x00-\x1f\x7f]/.test(s));
const uuid = z.string().uuid();

export class WeddingSquareSandboxCancellationError extends Error {
  constructor() {
    super("Wedding Square cancellation needs operator reconciliation.");
    this.name = "WeddingSquareSandboxCancellationError";
  }
}

export function createWeddingSquareSandboxCancellation(db: Db, merchant: Merchant, provider: Provider) {
  return {
    async cancel(userId: string) {
      const merchantId = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const locationId = process.env.SQUARE_LOCATION_ID;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          process.env.WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED !== "true" ||
          !canonical.safeParse(userId).success ||
          !canonical.safeParse(merchantId).success ||
          !canonical.safeParse(locationId).success) {
        throw new WeddingSquareSandboxCancellationError();
      }
      try {
        const a = await merchant.inspect();
        if (!a || a.verifiedSandboxMerchantContext !== true ||
            a.merchantId !== merchantId || a.locationId !== locationId ||
            a.currency !== "USD" || a.authorizesSubscriptionCreation !== false ||
            a.grantsEntitlement !== false || a.safeToResubmit !== false) {
          throw new WeddingSquareSandboxCancellationError();
        }

        const record = await db.query<Row>(
          `SELECT id::text AS id, user_id, tier, square_merchant_id, square_location_id,
                  square_customer_id, square_card_id, square_plan_variation_id,
                  square_subscription_id, billing_consent_terms_version,
                  agreed_monthly_amount_cents, agreed_currency, provider_status
             FROM wedding_square_subscriptions
            WHERE user_id=$1 AND square_environment='sandbox'
              AND square_merchant_id=$2 AND square_location_id=$3
              AND cancellation_requested_at IS NULL AND provider_cancelled_at IS NULL
              AND provider_status = 'ACTIVE'
            LIMIT 2`,
          [userId, merchantId, locationId],
        );
        if (record.rows.length !== 1) throw new WeddingSquareSandboxCancellationError();
        const row = record.rows[0];
        const expectedPlan = row.tier === "premium"
          ? process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID
          : row.tier === "elite"
            ? process.env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID
            : undefined;
        if (!uuid.safeParse(row.id).success || row.user_id !== userId ||
            row.square_merchant_id !== merchantId || row.square_location_id !== locationId ||
            !canonical.safeParse(row.square_customer_id).success ||
            !canonical.safeParse(row.square_subscription_id).success ||
            !canonical.safeParse(expectedPlan).success ||
            row.square_plan_variation_id !== expectedPlan ||
            (row.square_card_id != null && !canonical.safeParse(row.square_card_id).success) ||
            (row.tier !== "premium" && row.tier !== "elite") ||
            row.agreed_monthly_amount_cents !== WEDDING_MONTHLY_CENTS[row.tier] ||
            row.agreed_currency !== "USD" ||
            row.billing_consent_terms_version !== WEDDING_CONSENT_VERSION ||
            row.provider_status !== "ACTIVE") {
          throw new WeddingSquareSandboxCancellationError();
        }

        // Before claiming the one-shot write, independently check that the
        // token-owned provider still identifies this subscription/customer.
        const before = await provider.get(row.square_subscription_id);
        if (!before || before.id !== row.square_subscription_id ||
            before.customerId !== row.square_customer_id ||
            before.locationId !== row.square_location_id ||
            before.planVariationId !== row.square_plan_variation_id ||
            (before.cardId != null && before.cardId !== row.square_card_id) ||
            before.providerStatus !== "ACTIVE" ||
            before.canceledDate !== null) {
          throw new WeddingSquareSandboxCancellationError();
        }

        // A single atomic claim prevents double-cancel requests across nodes.
        // If POST or ACK becomes unknown, this claim remains for reconciliation.
        const claimed = await db.query<{ id: string }>(
          `UPDATE wedding_square_subscriptions
              SET cancellation_requested_at=now(), updated_at=now()
            WHERE id=$1::uuid AND user_id=$2
              AND square_environment='sandbox' AND square_merchant_id=$3
              AND square_subscription_id=$4
              AND provider_status = 'ACTIVE'
              AND cancellation_requested_at IS NULL AND provider_cancelled_at IS NULL
           RETURNING id::text AS id`,
          [row.id, userId, merchantId, row.square_subscription_id],
        );
        if (claimed.rows.length !== 1 || claimed.rows[0].id !== row.id)
          throw new WeddingSquareSandboxCancellationError();

        // Exactly ONE Square POST, no retry after any failure or malformed 2xx.
        const after = await provider.cancel(row.square_subscription_id);
        if (!after || after.id !== row.square_subscription_id ||
            after.customerId !== row.square_customer_id ||
            after.locationId !== row.square_location_id ||
            after.planVariationId !== row.square_plan_variation_id ||
            (after.cardId != null && after.cardId !== row.square_card_id) ||
            !after.canceledDate ||
            !["PENDING","ACTIVE","PAUSED","CANCELED"].includes(after.providerStatus)) {
          throw new WeddingSquareSandboxCancellationError();
        }

        const updated = await db.query<{ id: string }>(
          `UPDATE wedding_square_subscriptions
              SET provider_status=$3, last_reconciled_at=now(),
                  provider_cancelled_at=CASE WHEN $3='CANCELED' THEN now() ELSE provider_cancelled_at END,
                  updated_at=now()
            WHERE id=$1::uuid AND user_id=$2 AND square_environment='sandbox'
              AND square_merchant_id=$4 AND square_subscription_id=$5
              AND cancellation_requested_at IS NOT NULL
           RETURNING id::text AS id`,
          [row.id, userId, after.providerStatus, merchantId, row.square_subscription_id],
        );
        if (updated.rows.length !== 1 || updated.rows[0].id !== row.id)
          throw new WeddingSquareSandboxCancellationError();

        return Object.freeze({
          cancellationScheduled: true as const,
          scheduledEndDate: after.canceledDate,
          chargesAfterScheduledEnd: false as const,
          paidEntitlementChanged: false as const,
          safeToRetryCancellation: false as const,
        });
      } catch {
        throw new WeddingSquareSandboxCancellationError();
      }
    },
  };
}

export const weddingSquareSandboxCancellation = createWeddingSquareSandboxCancellation(
  pool as Db,
  weddingSquareSandboxMerchantAttestation,
  weddingSquareCancelTransport,
);
