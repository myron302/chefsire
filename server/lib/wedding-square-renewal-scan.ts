import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareProviderPaymentReadback } from "./wedding-square-provider-payment-readback";
import { weddingSquareEvidenceLedger } from "./wedding-square-evidence-ledger";
import { weddingSquareRenewalActivation } from "./wedding-square-renewal-activation";

/**
 * Discover initial and recurring Square invoices without a browser callback.
 * All owner/customer/subscription identities originate in confirmed Neon
 * enrollment and the already attested provider readback. This is an
 * operator-gated, sandbox-only background reconciliation worker.
 *
 * Atomically claim a bounded and FAIR batch before provider network reads.
 * PENDING subscriptions are included: first charge can occur after the
 * cardless trial. Subsequent ACTIVE renewals use the same saved Square
 * subscription, without ever resubmitting CreateSubscription.
 *
 * An already recorded invoice is skipped, never recaptured or rewritten.
 * Unknown/failed provider requests remain retryable on a later scan, while
 * the existing verified paid period and cardless trial stay unchanged.
 */
type Db = Pick<PoolClient, "query">;
type Payment = Pick<typeof weddingSquareProviderPaymentReadback, "inspect">;
type Ledger = Pick<typeof weddingSquareEvidenceLedger, "record">;
type Activation = Pick<typeof weddingSquareRenewalActivation, "activate">;
type Claimed = { attempt_id: string; user_id: string; subscription_id: string; square_subscription_id: string; provider_status: string };
type Existing = { square_payment_id: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaque = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200 &&
  !/[\s\x00-\x1f\x7f]/.test(value);
export class WeddingSquareRenewalScanError extends Error {
  constructor() {
    super("Wedding Square renewal discovery requires reconciliation.");
    this.name = "WeddingSquareRenewalScanError";
  }
}
export function createWeddingSquareRenewalScan(db: Db, payment: Payment, ledger: Ledger, activation: Activation) {
  let running = false;
  return {
    async run() {
      const merchant = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const location = process.env.SQUARE_LOCATION_ID;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          process.env.WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED !== "true" ||
          process.env.WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED !== "true" ||
          !opaque(merchant) || !opaque(location)) {
        return Object.freeze({ status: "disabled" as const, scanned: 0, recorded: 0, existing: 0, pending: 0 });
      }
      if (running) return Object.freeze({ status: "already_running" as const, scanned: 0, recorded: 0, existing: 0, pending: 0 });
      running = true;
      try {
        // FOR UPDATE SKIP LOCKED distributes work across multiple app nodes.
        // Scan timestamps are advanced AT CLAIM TIME even when the provider is
        // unavailable, preventing one broken payment from starving new owners.
        // The 45-minute eligibility cushion keeps a roughly hourly cadence.
        const claimed = await db.query<Claimed>(
          `WITH selected AS (
             SELECT s.id AS subscription_id, a.id AS attempt_id,
                    s.user_id, s.square_subscription_id, s.provider_status
               FROM wedding_square_subscriptions s
               JOIN wedding_square_enrollment_attempts a
                 ON a.user_id = s.user_id
                AND a.provider_subscription_id = s.square_subscription_id
                AND a.square_environment = 'sandbox'
                AND a.status = 'confirmed'
              WHERE s.square_environment = 'sandbox'
                AND s.square_merchant_id = $1
                AND s.square_location_id = $2
                AND s.provider_status IN ('PENDING','ACTIVE')
                AND (s.last_renewal_scan_at IS NULL OR
                     s.last_renewal_scan_at < statement_timestamp() - interval '45 minutes')
              ORDER BY s.last_renewal_scan_at ASC NULLS FIRST, s.id ASC
              LIMIT 20
              FOR UPDATE OF s SKIP LOCKED
           )
           UPDATE wedding_square_subscriptions s
              SET last_renewal_scan_at = statement_timestamp()
             FROM selected
            WHERE s.id = selected.subscription_id
           RETURNING selected.attempt_id::text AS attempt_id,
                     selected.user_id,
                     selected.subscription_id::text AS subscription_id,
                     selected.square_subscription_id,
                     selected.provider_status`,
          [merchant, location],
        );
        if (!claimed || !Array.isArray(claimed.rows) || claimed.rows.length > 20)
          throw new WeddingSquareRenewalScanError();
        const seen = new Set<string>();
        for (const row of claimed.rows) {
          if (!uuid.test(row.attempt_id) || !uuid.test(row.subscription_id) ||
              !opaque(row.user_id) || !opaque(row.square_subscription_id) ||
              !["PENDING","ACTIVE"].includes(row.provider_status) ||
              seen.has(row.subscription_id)) {
            throw new WeddingSquareRenewalScanError();
          }
          seen.add(row.subscription_id);
        }

        let recorded = 0, existing = 0, pending = 0;
        for (const row of claimed.rows) {
          try {
            const candidate = await payment.inspect(row.attempt_id, row.user_id);
            if (!candidate || candidate.subscriptionId !== row.square_subscription_id ||
                !opaque(candidate.invoiceId) || !opaque(candidate.paymentId) ||
                candidate.grantsEntitlement !== false ||
                candidate.safeToResubmit !== false ||
                candidate.requiresOperatorReconciliation !== true ||
                candidate.requiresAmountAndCoverageVerification !== true)
              throw new WeddingSquareRenewalScanError();

            if (row.provider_status === "PENDING") {
              // A confirmed pending trial may have produced its FIRST paid
              // invoice. Verify Square ACTIVE and transition the saved owner
              // row before ledger.record(), which correctly rejects PENDING.
              const transitioned = await activation.activate(row.attempt_id, row.user_id, row.square_subscription_id);
              if (!transitioned || transitioned.activated !== true ||
                  transitioned.subscriptionId !== row.square_subscription_id ||
                  transitioned.grantsEntitlement !== false)
                throw new WeddingSquareRenewalScanError();
            }

            // This is an identity comparison ONLY. A stale existing payment is
            // never refreshed by this selector; the independent refund/dispute
            // service handles its time-specific paid-access freshness.
            const check = await db.query<Existing>(
              `SELECT square_payment_id
                 FROM wedding_square_invoice_evidence
                WHERE wedding_subscription_id = $1::uuid
                  AND square_environment = 'sandbox'
                  AND square_merchant_id = $2
                  AND square_subscription_id = $3
                  AND square_invoice_id = $4
                LIMIT 2`,
              [row.subscription_id, merchant, row.square_subscription_id, candidate.invoiceId],
            );
            if (!check || !Array.isArray(check.rows) || check.rows.length > 1)
              throw new WeddingSquareRenewalScanError();
            if (check.rows.length === 1) {
              if (check.rows[0].square_payment_id !== candidate.paymentId)
                throw new WeddingSquareRenewalScanError();
              existing++;
              continue;
            }
            // Reverify the full current provider capture, invoice coverage and
            // refund/dispute history BEFORE the immutable financial DB insert.
            const outcome = await ledger.record(row.attempt_id, row.user_id);
            if (outcome.status !== "recorded" ||
                outcome.subscriptionId !== row.square_subscription_id ||
                outcome.invoiceId !== candidate.invoiceId ||
                outcome.paidEntitlementGranted !== false ||
                outcome.safeToResubmit !== false) {
              throw new WeddingSquareRenewalScanError();
            }
            recorded++;
          } catch {
            // PENDING can legitimately mean no first paid invoice yet. For
            // ACTIVE it can mean outage, latest invoice unpaid, or ambiguity.
            // All are unverified: no entitlement or prior evidence mutation.
            pending++;
          }
        }
        return Object.freeze({
          status: "completed" as const,
          scanned: claimed.rows.length, recorded, existing, pending,
        });
      } catch {
        throw new WeddingSquareRenewalScanError();
      } finally {
        running = false;
      }
    },
  };
}
export const weddingSquareRenewalScan = createWeddingSquareRenewalScan(
  pool as Db, weddingSquareProviderPaymentReadback, weddingSquareEvidenceLedger,
  weddingSquareRenewalActivation,
);
