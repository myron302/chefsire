import { sql } from "drizzle-orm";

/**
 * Part 3b: local obligation inventory ONLY. Does not close an account and must
 * not be used as authorization to erase personal data.
 *
 * These are conservative checks: any unresolved financial state blocks closure.
 * Unknown or missing tables ERROR rather than being interpreted as zero rows.
 * Provider-backed subscription/payment/refund/dispute checks remain mandatory
 * before permanent closure can ever be enabled.
 */
export type ClosureBlockerCode =
  | "MARKETPLACE_ORDERS"
  | "MARKETPLACE_PAYMENTS"
  | "SELLER_COMMISSIONS"
  | "SELLER_PAYOUTS"
  | "WEDDING_SUBSCRIPTIONS"
  | "WEDDING_ENROLLMENTS"
  | "CATERING_BOOKINGS"
  | "CATERING_INVOICES"
  | "DRINK_BUNDLE_CHECKOUTS"
  | "MARKETPLACE_PAID_PLAN"
  | "SUBSCRIPTION_HISTORY";

export type ClosureBlocker = { code: ClosureBlockerCode; count: number; message: string };
const rowsOf = (x: any): any[] => x?.rows ?? (Array.isArray(x) ? x : []);
const countOf = (x: any) => Number(rowsOf(x)[0]?.n ?? NaN);

export class ClosureObligationsUnavailableError extends Error {
  readonly code = "CLOSURE_OBLIGATIONS_UNAVAILABLE";
  constructor(readonly check: ClosureBlockerCode, cause: unknown) {
    super(`Cannot verify closure obligations (${check}). Do not proceed with closure.`, { cause });
  }
}

/** Must be invoked within the future closure transaction AFTER locking users.id FOR UPDATE. */
export async function inspectLocalClosureObligations(tx: any, userId: string): Promise<ClosureBlocker[]> {
  // Use explicit SQL rather than a single UNION: every failed/missing ledger is
  // attributed accurately; a missing expected ledger must NEVER mean "clear".
  const checks: {
    code: ClosureBlockerCode;
    message: string;
    query: ReturnType<typeof sql>;
  }[] = [
    {
      code: "MARKETPLACE_ORDERS",
      message: "Finish or resolve open marketplace orders as buyer or seller.",
      query: sql`SELECT count(*)::int AS n FROM orders
        WHERE (buyer_id = ${userId} OR seller_id = ${userId})
          AND (status IS NULL OR status NOT IN ('delivered', 'cancelled', 'refunded'))`,
    },
    {
      code: "MARKETPLACE_PAYMENTS",
      message: "Marketplace payment, refund, or reconciliation is still unresolved.",
      query: sql`SELECT count(*)::int AS n FROM orders
        WHERE (buyer_id = ${userId} OR seller_id = ${userId})
          AND (payment_status IS NULL OR payment_status NOT IN ('captured', 'refunded', 'unverified')
            OR inventory_status IN ('reserved', 'legacy_unverified')
            OR (refund_idempotency_key IS NOT NULL AND payment_status <> 'refunded')
            OR capture_request_snapshot IS NOT NULL)`,
    },
    {
      code: "SELLER_COMMISSIONS",
      message: "Seller commissions or earnings are not fully settled.",
      query: sql`SELECT count(*)::int AS n FROM commissions
        WHERE seller_id = ${userId} AND (status IS NULL OR status NOT IN ('paid', 'refunded'))`,
    },
    {
      code: "SELLER_PAYOUTS",
      message: "Seller payouts have unresolved settlement status.",
      query: sql`SELECT count(*)::int AS n FROM payouts
        WHERE seller_id = ${userId} AND (status IS NULL OR status NOT IN ('completed', 'cancelled'))`,
    },
    {
      code: "WEDDING_SUBSCRIPTIONS",
      message: "Wedding subscription has not reached a verified terminal provider state.",
      query: sql`SELECT count(*)::int AS n FROM wedding_square_subscriptions
        WHERE user_id = ${userId} AND (provider_status IS NULL
          OR provider_status NOT IN ('CANCELED', 'DEACTIVATED'))`,
    },
    {
      code: "WEDDING_ENROLLMENTS",
      message: "Wedding subscription enrollment or recovery remains unresolved.",
      query: sql`SELECT count(*)::int AS n FROM wedding_square_enrollment_attempts
        WHERE user_id = ${userId} AND status IN ('reserved', 'submitting', 'needs_reconciliation')`,
    },
    {
      code: "CATERING_BOOKINGS",
      message: "Catering bookings or payments need resolution before closure.",
      query: sql`SELECT count(*)::int AS n FROM catering_bookings
        WHERE (customer_id = ${userId} OR provider_id = ${userId})
          AND (status IS NULL OR status NOT IN ('completed', 'cancelled'))`,
    },
    {
      code: "CATERING_INVOICES",
      message: "Outstanding catering invoices or payments must be settled.",
      query: sql`SELECT count(*)::int AS n FROM catering_booking_invoices i
        JOIN catering_bookings b ON b.id = i.booking_id
        WHERE (b.customer_id = ${userId} OR b.provider_id = ${userId})
          AND i.status = 'issued'
          AND coalesce((
            SELECT sum(p.amount_cents) FROM catering_booking_payments p
            WHERE p.invoice_id = i.id AND p.status = 'recorded'
          ), 0) < i.amount_cents`,
    },
    {
      code: "DRINK_BUNDLE_CHECKOUTS",
      message: "A paid drink bundle checkout needs provider reconciliation.",
      query: sql`SELECT count(*)::int AS n FROM drink_bundle_checkout_sessions
        WHERE user_id = ${userId}
          AND (status IS NULL OR status NOT IN ('completed', 'refunded', 'failed', 'cancelled', 'expired'))`,
    },
    {
      code: "MARKETPLACE_PAID_PLAN",
      message: "Seller subscription tier or paid plan remains active or cannot be verified.",
      query: sql`SELECT count(*)::int AS n FROM users
        WHERE id = ${userId}
          AND (coalesce(subscription_tier, 'free') NOT IN ('free', 'none')
            OR coalesce(vendor_tier, 'free') NOT IN ('free', 'none'))`,
    },
    {
      code: "SUBSCRIPTION_HISTORY",
      message: "A historic subscription row still reports an active or unpaid plan.",
      query: sql`SELECT count(*)::int AS n FROM subscription_history
        WHERE user_id = ${userId} AND (status IS NULL
          OR status NOT IN ('cancelled', 'canceled', 'expired', 'ended', 'completed', 'refunded'))`,
    },
  ];

  const blockers: ClosureBlocker[] = [];
  for (const check of checks) {
    let n: number;
    try {
      n = countOf(await tx.execute(check.query));
      if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid ledger count");
    } catch (error) {
      throw new ClosureObligationsUnavailableError(check.code, error);
    }
    if (n > 0) blockers.push({ code: check.code, count: n, message: check.message });
  }
  return blockers;
}
