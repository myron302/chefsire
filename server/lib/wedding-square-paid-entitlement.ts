import { sql } from "drizzle-orm";
import { db } from "../db";
import { WEDDING_MONTHLY_CENTS, type WeddingPaidTier } from "./wedding-square-billing-policy";

/**
 * Wedding-only paid access read model: no legacy tier field, webhook payload,
 * pending subscription, or payment candidate can grant access.
 *
 * The write path for verified invoice evidence and refund reconciliation is
 * NOT yet enabled. This reader is separately OFF by default until the provider
 * settlement/refund lifecycle has been audited and activated.
 *
 * Every access requires a CURRENT, unique subscription with a matching immutable
 * invoice/payment evidence row for the precise billed period, recent provider
 * payment-specific reconciliation, and provider-derived paid_through. An untrusted future
 * paidThrough timestamp never extends access beyond the evidenced period.
 */
export type VerifiedWeddingPaid = Readonly<{
  tier: WeddingPaidTier;
  paidThrough: string;
}>;
type Execution = Pick<typeof db, "execute">;
const canonical = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200 && !/[\s\x00-\x1f\x7f]/.test(v);

export class WeddingSquarePaidEvidenceUnavailableError extends Error {
  constructor() {
    super("Wedding Square payment evidence is not available.");
    this.name = "WeddingSquarePaidEvidenceUnavailableError";
  }
}

/**
 * Reads fail closed if Neon is unavailable. A valid result may be used to
 * authorize the corresponding Wedding tier; nothing else can create it.
 */
export async function readVerifiedWeddingPaid(
  userId: string,
  executor: Execution = db,
): Promise<VerifiedWeddingPaid | null> {
  if (process.env.WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED !== "true") return null;
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      !canonical(userId)) {
    throw new WeddingSquarePaidEvidenceUnavailableError();
  }

  try {
    const result = await executor.execute(sql`
      SELECT s.id::text AS "subscriptionId", s.tier AS "tier",
             MAX(LEAST(e.period_ends_at, s.verified_paid_through)) AS "paidThrough",
             COUNT(DISTINCT e.id)::int AS "evidenceCount"
        FROM wedding_square_subscriptions s
        JOIN wedding_square_invoice_evidence e
          ON e.wedding_subscription_id = s.id
         AND e.square_environment = s.square_environment
         AND e.square_merchant_id = s.square_merchant_id
         AND e.square_subscription_id = s.square_subscription_id
       WHERE s.user_id = ${userId}
         AND s.square_environment = 'sandbox'
         AND s.square_merchant_id = ${process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID ?? ""}
         AND s.square_location_id = ${process.env.SQUARE_LOCATION_ID ?? ""}
         AND s.provider_status IN ('ACTIVE','CANCELED')
         AND s.tier IN ('premium','elite')
         AND s.agreed_currency = 'USD'
         AND ((s.tier = 'premium' AND s.agreed_monthly_amount_cents = 2499)
           OR (s.tier = 'elite' AND s.agreed_monthly_amount_cents = 4999))
         AND e.verified_currency = 'USD'
         AND e.verified_amount_cents = s.agreed_monthly_amount_cents
         AND e.provider_paid_at <= statement_timestamp()
         AND e.period_starts_at <= statement_timestamp()
         AND e.period_ends_at > statement_timestamp()
         AND s.verified_paid_through >= e.period_ends_at
         -- Only a fresh reconciliation of THIS invoice/payment can
         -- prove refunds/disputes have not invalidated its paid coverage.
         -- A cancellation or subscription GET cannot refresh this column.
         AND e.last_payment_reconciled_at >= statement_timestamp() - interval '24 hours'
         AND e.payment_revoked_at IS NULL
       GROUP BY s.id, s.tier
       ORDER BY s.id
       LIMIT 2
    `);
    const rows = (result as { rows?: unknown[] }).rows;
    if (!Array.isArray(rows)) throw new WeddingSquarePaidEvidenceUnavailableError();
    if (rows.length === 0) return null;
    // Two different paid subscriptions covering the same instant cannot be
    // arbitrarily merged or upgraded into Elite; require reconciliation.
    if (rows.length !== 1) throw new WeddingSquarePaidEvidenceUnavailableError();
    const row = rows[0] as Record<string, unknown>;
    if (!canonical(row.subscriptionId) ||
        (row.tier !== "premium" && row.tier !== "elite") ||
        (typeof row.evidenceCount !== "number" || !Number.isSafeInteger(row.evidenceCount) || row.evidenceCount < 1) ||
        !row.paidThrough) {
      throw new WeddingSquarePaidEvidenceUnavailableError();
    }
    const date = new Date(row.paidThrough as string | Date);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now() ||
        !Number.isSafeInteger(WEDDING_MONTHLY_CENTS[row.tier])) {
      throw new WeddingSquarePaidEvidenceUnavailableError();
    }
    return Object.freeze({ tier: row.tier, paidThrough: date.toISOString() });
  } catch {
    throw new WeddingSquarePaidEvidenceUnavailableError();
  }
}
