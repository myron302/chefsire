import { z } from "zod";

/**
 * Catering Phase 2Q -- Square SANDBOX processor-backed customer payments. The shared contract.
 *
 * FUNDS FLOW
 *
 *   CUSTOMER -> Square hosted checkout -> THE PROVIDER'S OWN connected Square account -> settles to that provider.
 *
 * The checkout is created under the provider's OAuth credential, at the provider's verified merchant and location. ChefSire
 * never receives, holds or routes the money, takes no platform fee, and moves nothing by itself: it only RECORDS a payment in
 * the Catering ledger after reading fresh, authenticated Square evidence back with the provider's own credential.
 *
 * A browser return from Square is NOT evidence of anything. A webhook is a TRIGGER to go and look, never the evidence.
 *
 * SANDBOX ONLY. The server refuses to create, verify or settle anything unless Square is configured for its sandbox, and the
 * attempts table carries a CHECK that makes a non-sandbox row unrepresentable.
 */

export const CATERING_SQUARE_PROCESSOR = "square" as const;
export const CATERING_SQUARE_CURRENCY = "USD" as const;

/**
 * Square identifier maximums, one per field (never one generic length). Square documents payment, order and payment-link ids of up to 192
 * characters; event ids are UUIDs and merchant/location ids are short, so those keep a generous 128. The persisted columns that hold them are
 * `text` (unbounded) except the Phase 2L ledger column `catering_booking_payments.processor_payment_id`, which is `varchar(255)`: it must hold
 * the longest valid payment id, and a test pins that the column is never narrower than SQUARE_PAYMENT_ID_MAX_LENGTH.
 */
/**
 * The largest value `catering_booking_payment_attempts.processor_amount_cents` may hold (the `<= 9999999999` CHECK; the same ceiling as every
 * Catering money row). An attempt-level AGGREGATE of several payments is optional summary metadata: when it cannot fit, it is NULL and the
 * individual evidence rows (each within this ceiling) remain the authority.
 */
export const CATERING_ATTEMPT_PROCESSOR_AMOUNT_MAX_CENTS = 9_999_999_999;

export const SQUARE_PAYMENT_ID_MAX_LENGTH = 192;
export const SQUARE_ORDER_ID_MAX_LENGTH = 192;
export const SQUARE_PAYMENT_LINK_ID_MAX_LENGTH = 192;
export const SQUARE_EVENT_ID_MAX_LENGTH = 128;
export const SQUARE_MERCHANT_ID_MAX_LENGTH = 128;
export const CATERING_LEDGER_PROCESSOR_PAYMENT_ID_COLUMN_LENGTH = 255;

/**
 * The attempt state machine. FAIL CLOSED: a new state is `creating`, and the only way to `completed` is the single settlement
 * transaction that also writes the ledger row.
 *
 *   creating -> pending                 Square created the checkout (idempotent; a retry resumes it)
 *   creating -> failed                  Square definitively refused to create it
 *   pending  -> completed               Square evidence: a COMPLETED payment for exactly this attempt, and it fits the ledger now
 *   pending  -> reconciliation_required Square evidence: money MOVED but cannot be credited as-is (see reasons below)
 *   pending  -> cancelled | expired     the checkout was closed before any money moved (invoice void, booking cancelled, Square cancelled)
 *   pending  -> superseded              the amount payable changed and a new attempt replaced this one
 *   cancelled | expired | superseded | failed -> completed | reconciliation_required
 *                                       a payment can still arrive on a checkout ChefSire believed closed; its evidence is never discarded
 */
export const CATERING_PAYMENT_ATTEMPT_STATES = ["creating", "pending", "completed", "failed", "expired", "cancelled", "superseded", "reconciliation_required"] as const;
export type CateringPaymentAttemptState = typeof CATERING_PAYMENT_ATTEMPT_STATES[number];

/** The states in which an attempt is the invoice's one open checkout. Mirrors the partial unique index. */
export const CATERING_OPEN_ATTEMPT_STATES: readonly CateringPaymentAttemptState[] = ["creating", "pending"];

/** The states from which money can still arrive and be recognised: everything except the two that already consumed a payment. */
export const CATERING_SETTLEABLE_ATTEMPT_STATES: readonly CateringPaymentAttemptState[] = ["creating", "pending", "failed", "expired", "cancelled", "superseded"];

/**
 * Why Square confirmed money that the ledger cannot take as a normal credit. The evidence is KEPT on the attempt (the Square
 * payment, the amount and currency that actually moved); nothing is clamped, refunded or silently credited.
 */
export const CATERING_RECONCILIATION_REASONS = [
  "payable_changed",      // the invoice's current payable is now less than what Square took (adjustments, paid elsewhere, sibling invoice)
  "invoice_not_payable",  // the invoice was voided or is no longer issued
  "booking_cancelled",    // the booking was cancelled after checkout was created
  "amount_mismatch",      // Square's payment total is not the amount ChefSire asked for (e.g. a tip)
  "currency_mismatch",    // Square's payment is in another currency
  "multiple_payments",    // Square shows more than one completed payment on the one order; EVERY one is kept, none is chosen
  "payment_refunded",     // Square's authoritative payment shows refund activity (refund ids or refunded money): COMPLETED no longer means the full amount stands
  "payment_timestamp_invalid", // Square's completion time is missing, malformed or in the future, so no honest received-on date exists
] as const;
export type CateringReconciliationReason = typeof CATERING_RECONCILIATION_REASONS[number];

export const CATERING_ATTEMPT_UNAVAILABLE_CODE = "catering_square_unavailable";
export const CATERING_ATTEMPT_PROVIDER_NOT_READY_CODE = "catering_square_provider_not_ready";
export const CATERING_ATTEMPT_STATE_CODE = "catering_square_payment_state";

export const cateringSquarePaymentAttemptIdSchema = z.string().trim().min(1).max(64);

/** The Pay request carries NOTHING: the amount, currency, merchant and location are all derived by the server. */
export const cateringSquarePayRequestSchema = z.object({}).strict();

/**
 * An attempt as a client sees it. What each actor may read:
 *
 *  - CUSTOMER: their own attempts only, with the checkout URL while the attempt is pending. No Square identifier of any kind.
 *  - PROVIDER: every attempt on the booking, never the checkout URL (a provider is not the payer), and -- only on a state that
 *    represents money that moved -- the Square payment reference so they can find it in their own Square dashboard.
 */
export type CateringPaymentAttemptView = {
  id: string;
  invoiceId: string;
  state: CateringPaymentAttemptState;
  amountCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** CUSTOMER ONLY, and only while `state` is `pending`. */
  checkoutUrl?: string;
  /** What actually moved at Square, once Square has confirmed a payment. Absent before that. Always read WITH `processorCurrency`, never with `currency` (the invoice's). */
  processorAmountCents?: number;
  /** The currency of `processorAmountCents`, as Square reported it. Present when it is unambiguous (every completed payment shares one currency). */
  processorCurrency?: string;
  /**
   * PROVIDER ONLY. Whether a payment from this attempt WAS credited to the Catering ledger (the attempt's ledger payment exists). With it, the
   * evidence row that backs that ledger payment says so (`creditedToLedger`); every other completed payment is an additional, uncredited one.
   */
  ledgerCredited?: boolean;
  /** True once Square showed refund activity on a payment of this attempt AFTER it was credited or reconciled: its state and ledger payment are unchanged, but a refund discrepancy is unresolved. */
  refundReview?: boolean;
  /** How many completed Square payments the order showed. Present once money moved. More than one is always a reconciliation. */
  processorPaymentCount?: number;
  /** Every completed Square payment, each with its own amount and time. Present once money moved. A customer is not given the Square ids. */
  processorPayments?: CateringProcessorPaymentView[];
  /** Present only on `reconciliation_required`. */
  reconciliationReason?: CateringReconciliationReason;
  /** The ledger payment this attempt credited. Present only on `completed`. */
  paymentId?: string;
  /** PROVIDER ONLY, only when exactly ONE Square payment moved. With several there is no single reference: see `processorPayments`. */
  squarePaymentId?: string;
};

export type CateringProcessorPaymentView = {
  amountCents: number;
  tipCents: number;
  currency: string;
  /** Square's own completion time for this payment, or null if Square did not give a usable one. */
  completedAt: string | null;
  /** PROVIDER ONLY. */
  squarePaymentId?: string;
  /** PROVIDER ONLY. True when Square's own payment object showed refund activity (a refund id or refunded money) when ChefSire read it. */
  refunded?: boolean;
  /** PROVIDER ONLY. True only for the payment whose Square id is the one stored on the attempt's Catering ledger payment (matched by id, never by amount). */
  creditedToLedger?: boolean;
};

export type CateringSquareCheckoutAvailability = {
  /** Whether this deployment can take Square payments at all (sandbox configured). Says nothing about any one provider. */
  enabled: boolean;
};

export const cateringPaymentAttemptPath = (bookingId: string, attemptId: string) => `/api/catering/bookings/${bookingId}/billing/payment-attempts/${attemptId}`;
export const cateringInvoicePayPath = (bookingId: string, invoiceId: string) => `/api/catering/bookings/${bookingId}/billing/invoices/${invoiceId}/pay`;

/** Wording, in one place. None of it says ChefSire took or holds the money, because it did not and does not. */
export const CATERING_SQUARE_COPY = {
  payAction: "Pay securely with Square",
  creating: "Creating your secure Square checkout...",
  pending: "Your Square checkout is open. Finish paying there, then come back here.",
  verifying: "Checking your payment with Square...",
  completed: "Payment confirmed by Square.",
  returnReviewNoticeCustomer: "Square reports that part or all of a payment on this booking was returned. Your caterer is reviewing it, so this booking may not be fully settled.",
  returnReviewNoticeProvider: "Square reports refund activity on a payment already credited to this booking. Your ledger was NOT changed. Review it in Square, then record any return under the booking's payments.",
  completedRefundReviewCustomer: "Payment confirmed by Square. Square also reports that part or all of it was returned, and your caterer is reviewing that.",
  completedRefundReviewProvider: "Payment confirmed by Square and credited to the Catering ledger. Square now reports refund activity on it. The ledger was NOT changed; review it in Square and record any return under the booking's payments.",
  failed: "We could not open a Square checkout. Nothing was charged. Please try again.",
  closed: "This Square checkout was closed before any payment was made.",
  reconciliation: "Square received your payment, but what you owe changed while you were paying. Your caterer has been told and will sort out how it applies. You do not need to pay again.",
  /** Nothing from this checkout is in the Catering ledger. */
  reconciliationProviderNothingCredited: "Square confirmed payment activity that could not be credited automatically. No payment from this checkout was added to the Catering ledger. Review the Square payment evidence below.",
  /** One payment WAS credited normally; later Square payments are unresolved. Must never say nothing was credited. */
  reconciliationProviderPartlyCredited: "One Square payment was already credited to the Catering ledger. Additional Square payment activity was detected and was NOT credited automatically. Review the payment evidence below before taking any action, and do not apply the credited payment again.",
  evidenceCredited: "Credited to Catering ledger",
  evidenceAdditional: "Additional Square payment: not credited automatically",
  evidenceRefunded: "Square reports refund activity on this payment",
  evidenceNotCredited: "Not credited to the Catering ledger",
  reconciliationNeutralHeadline: "Square payments require reconciliation",
  disclosure: "Card payments are made on Square and go directly to your caterer. ChefSire does not receive or hold this money.",
  notReady: "This caterer cannot take Square payments right now. You can pay them directly instead.",
} as const;

export const CATERING_SQUARE_RECONCILIATION_COPY: Record<CateringReconciliationReason, { customer: string; provider: string }> = {
  payable_changed: {
    customer: "What you owe changed while you were paying, so your payment is waiting to be applied by your caterer.",
    provider: "The amount payable on this invoice dropped below what Square took (an adjustment, another payment or an earlier invoice).",
  },
  invoice_not_payable: {
    customer: "This request for payment was withdrawn while you were paying, so your payment is waiting to be sorted out by your caterer.",
    provider: "The invoice was voided or is no longer issued, but Square took the payment.",
  },
  booking_cancelled: {
    customer: "This booking was cancelled while you were paying, so your payment is waiting to be sorted out by your caterer.",
    provider: "The booking was cancelled, but Square took the payment.",
  },
  amount_mismatch: {
    customer: "The amount Square took does not match what was requested, so your caterer needs to sort it out.",
    provider: "Square's payment total does not match the amount ChefSire requested (for example a tip).",
  },
  currency_mismatch: {
    customer: "Square took the payment in a different currency, so your caterer needs to sort it out.",
    provider: "Square's payment is in a different currency from the invoice.",
  },
  multiple_payments: {
    customer: "More than one payment was taken, so your caterer needs to sort it out.",
    provider: "Square shows more than one completed payment on the one checkout order. Every one is listed below with its own Square reference and whether it was credited to the Catering ledger; no payment is credited on another's behalf.",
  },
  payment_refunded: {
    customer: "Square shows that part or all of your payment was returned, so your caterer needs to review it before anything is applied.",
    provider: "Square reports refund activity on this payment (a refund or refunded money). ChefSire did NOT credit it to the Catering ledger as a normal payment and made no refund of its own. Review the payment in your Square account and with your customer.",
  },
  payment_timestamp_invalid: {
    customer: "Square took your payment, but your caterer needs to confirm it before it is applied.",
    provider: "Square confirmed a payment but its completion time was missing or invalid, so ChefSire could not date it honestly and did not add it to the ledger.",
  },
};

/** States after which a customer's screen has nothing left to wait for. */
export function cateringAttemptIsSettled(state: CateringPaymentAttemptState): boolean {
  return state === "completed" || state === "reconciliation_required" || state === "failed" || state === "expired" || state === "cancelled" || state === "superseded";
}

export function cateringAttemptIsOpen(state: string): boolean {
  return state === "creating" || state === "pending";
}

/** Notifications written after a settlement commits. Wording states what Square confirmed and says nothing about ChefSire holding funds. */
export const CATERING_SQUARE_NOTIFICATIONS = {
  customerConfirmed: {
    type: "catering_booking_square_payment_confirmed",
    title: "Your payment was confirmed",
    message: "Square confirmed your payment to your caterer. Open your booking to see it.",
  },
  providerConfirmed: {
    type: "catering_booking_square_payment_received",
    title: "A customer paid you through Square",
    message: "The payment settled to your Square account and was added to this booking's payments.",
  },
  customerReconciliation: {
    type: "catering_booking_square_payment_reconciliation",
    title: "Your payment needs your caterer's attention",
    message: "Square received your payment, but what you owe changed while you were paying. Your caterer has been told.",
  },
  providerRefundReview: {
    type: "catering_booking_square_payment_refund_review",
    title: "Square reports a refund on a payment you were credited",
    message: "A payment already recorded on this booking shows refund activity in Square. Nothing was changed in your ledger. Open the booking's billing section.",
  },
  providerReconciliation: {
    type: "catering_booking_square_payment_reconciliation_required",
    title: "A Square payment needs your attention",
    message: "A customer paid through Square but the payment could not be added automatically. Open the booking's billing section.",
  },
} as const;
