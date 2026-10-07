import {
  CATERING_SQUARE_COPY,
  CATERING_SQUARE_RECONCILIATION_COPY,
  cateringAttemptIsOpen,
  type CateringPaymentAttemptView,
  type CateringReconciliationReason,
} from "@shared/catering-square-payments";
import type { CateringBookingBillingView, CateringInvoiceView } from "@shared/catering-booking-billing";

/**
 * The pure state the Phase 2Q Square payment controls are built from. No money is computed here: every figure arrives from the
 * server, and the customer never types or sends an amount.
 */

export type CateringSquareDisplay = {
  /** The one phase a screen shows. */
  phase: "creating" | "awaiting" | "confirmed" | "failed" | "closed" | "reconciliation";
  label: string;
  /** Whether this attempt still needs the screen to ask the server again. */
  polling: boolean;
  /** Only ever true while the attempt is pending and the server handed over its checkout URL. */
  canContinue: boolean;
};

export function cateringSquareDisplay(attempt: Pick<CateringPaymentAttemptView, "state" | "checkoutUrl"> & { ledgerCredited?: boolean }, role: "provider" | "customer"): CateringSquareDisplay {
  switch (attempt.state) {
    case "creating": return { phase: "creating", label: CATERING_SQUARE_COPY.creating, polling: false, canContinue: false };
    case "pending": return { phase: "awaiting", label: role === "customer" ? CATERING_SQUARE_COPY.pending : "A customer has opened a Square checkout for this request.", polling: true, canContinue: role === "customer" && Boolean(attempt.checkoutUrl) };
    case "completed": return { phase: "confirmed", label: CATERING_SQUARE_COPY.completed, polling: false, canContinue: false };
    case "reconciliation_required": return { phase: "reconciliation", label: role === "customer" ? CATERING_SQUARE_COPY.reconciliation : attempt.ledgerCredited ? CATERING_SQUARE_COPY.reconciliationProviderPartlyCredited : CATERING_SQUARE_COPY.reconciliationProviderNothingCredited, polling: false, canContinue: false };
    case "failed": return { phase: "failed", label: CATERING_SQUARE_COPY.failed, polling: false, canContinue: false };
    // expired, cancelled and superseded are all a checkout that was closed before any money moved.
    default: return { phase: "closed", label: CATERING_SQUARE_COPY.closed, polling: false, canContinue: false };
  }
}

export function cateringSquareReconciliationCopy(reason: CateringReconciliationReason | undefined, role: "provider" | "customer"): string | null {
  return reason ? CATERING_SQUARE_RECONCILIATION_COPY[reason][role] : null;
}

/**
 * The headline amount of an attempt in the provider's list, formatted by `format(cents, currency)`.
 *
 * Processor money is ONLY ever shown in the currency Square reported for it: one evidence row uses its own amount and currency; several rows of
 * ONE currency show the SERVER's aggregate with the count, when it has one; when it has none (mixed currencies, or a total that cannot be represented) nothing is
 * summed here and the headline is neutral (each payment is listed on its own row below). Before any money moved the figure is the amount ASKED for, in the invoice's currency.
 */
export function cateringSquareHeadline(
  attempt: Pick<CateringPaymentAttemptView, "amountCents" | "currency" | "processorAmountCents" | "processorCurrency" | "processorPayments">,
  format: (cents: number, currency: string) => string,
): string {
  const payments = attempt.processorPayments ?? [];
  if (payments.length === 1) return format(payments[0].amountCents, payments[0].currency);
  if (payments.length > 1) {
    // The aggregate is the SERVER's: it exists only for one currency and a total that fits. When it is absent (mixed currencies, or a total that
    // cannot be represented) nothing is summed here either: a neutral headline, with every payment listed on its own row.
    if (attempt.processorAmountCents !== undefined && attempt.processorCurrency) return `${format(attempt.processorAmountCents, attempt.processorCurrency)} across ${payments.length} Square payments`;
    return CATERING_SQUARE_COPY.reconciliationNeutralHeadline;
  }
  if (attempt.processorAmountCents !== undefined) {
    return attempt.processorCurrency ? format(attempt.processorAmountCents, attempt.processorCurrency) : CATERING_SQUARE_COPY.reconciliationNeutralHeadline;
  }
  return format(attempt.amountCents, attempt.currency);
}

/** How a provider-facing evidence row is labelled: backs the ledger payment, is an additional unresolved payment, or simply was not credited. */
export function cateringSquareEvidenceLabel(payment: { creditedToLedger?: boolean }, ledgerCredited: boolean | undefined): string {
  if (payment.creditedToLedger) return CATERING_SQUARE_COPY.evidenceCredited;
  return ledgerCredited ? CATERING_SQUARE_COPY.evidenceAdditional : CATERING_SQUARE_COPY.evidenceNotCredited;
}

/** The attempt that is this invoice's open checkout, if any. */
export function cateringOpenAttemptFor(attempts: readonly CateringPaymentAttemptView[], invoiceId: string): CateringPaymentAttemptView | undefined {
  return attempts.find((attempt) => attempt.invoiceId === invoiceId && cateringAttemptIsOpen(attempt.state));
}

/**
 * Whether the customer is offered "Pay securely with Square" on this invoice.
 *
 * Judged from the server's own figures: the deployment offers Square, the booking is not cancelled, the request is live and has
 * something payable RIGHT NOW (`payableCents`), and there is not already an open checkout (that one is shown instead). A snapshot
 * for the screen only -- the pay endpoint judges again, under the billing lock.
 */
export function cateringSquarePayAvailable(input: {
  role: "provider" | "customer";
  billing: Pick<CateringBookingBillingView, "bookingStatus" | "squareCheckout" | "paymentAttempts">;
  invoice: Pick<CateringInvoiceView, "id" | "status" | "payableCents" | "currency">;
}): boolean {
  if (input.role !== "customer") return false;
  if (!input.billing.squareCheckout.enabled || input.billing.bookingStatus === "cancelled") return false;
  if (input.invoice.status !== "issued" || input.invoice.currency !== "USD" || input.invoice.payableCents <= 0) return false;
  return cateringOpenAttemptFor(input.billing.paymentAttempts, input.invoice.id) === undefined;
}

/** An attempt a provider's panel lists: superseded checkouts are replaced ones and would only be noise. */
export function cateringProviderVisibleAttempts(attempts: readonly CateringPaymentAttemptView[]): CateringPaymentAttemptView[] {
  return attempts.filter((attempt) => attempt.state !== "superseded");
}

/** The attempt id a browser returning from Square names in its URL, or null. It is only a hint of what to ask the server about. */
export function cateringReturnedAttemptId(search: string): string | null {
  const value = new URLSearchParams(search).get("squareAttempt");
  return value && /^[A-Za-z0-9-]{1,64}$/.test(value) ? value : null;
}

/** The identity a returned attempt (and so its dismissal) belongs to: the viewer, the booking AND the attempt. Nothing is shared across two of them. */
export const cateringReturnedAttemptIdentity = (userId: string, bookingId: string, attemptId: string) => `${userId}|${bookingId}|${attemptId}`;

/**
 * The returned Square attempt to act on RIGHT NOW, derived (on every render) from the CURRENT URL search and the current viewer and booking.
 * It is never stored from an earlier URL, so navigating to another booking, to a URL with no attempt, or to a different attempt cannot leave a
 * previous one behind. A dismissal hides exactly the identity (viewer + booking + attempt) that was dismissed, never a different booking's attempt.
 * The value is only a hint of what to ask the server about: the server decides whether this viewer may see it, and what Square showed.
 */
export function cateringActiveReturnedAttempt(input: { search: string; userId: string; bookingId: string; dismissedIdentity: string | null }): string | null {
  const attemptId = cateringReturnedAttemptId(input.search);
  if (!attemptId) return null;
  return cateringReturnedAttemptIdentity(input.userId, input.bookingId, attemptId) === input.dismissedIdentity ? null : attemptId;
}

/** The error a failed attempt lookup throws: the HTTP status (or null for a network failure) so polling can tell terminal from transient. */
export class CateringAttemptLookupError extends Error {
  constructor(message: string, readonly status: number | null) { super(message); this.name = "CateringAttemptLookupError"; }
}

/**
 * Whether a failed lookup can never succeed by asking again: Square-independent, deterministic 4xx answers -- an unknown, stale, deleted or
 * someone else's attempt (all the same non-enumerating 404), a refused session, a malformed id. Network faults, 5xx, 408 and 429 are
 * transient and may be retried a bounded number of times.
 */
export function cateringAttemptLookupIsTerminal(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export const CATERING_ATTEMPT_LOOKUP_MAX_FAILURES = 3;

/**
 * CONSECUTIVE lookup failures for ONE attempt: a failure adds one, a success resets to zero. TanStack Query's `errorUpdateCount` is NOT this --
 * it is cumulative over the cached query's whole life and is never reset by a success -- so it must not drive the cutoff. One counter belongs to
 * one checkout identity (viewer + booking + attempt); a different identity gets a fresh one.
 */
export function createConsecutiveFailureCounter() {
  let failures = 0;
  return {
    failed(): number { failures += 1; return failures; },
    succeeded(): void { failures = 0; },
    reset(): void { failures = 0; },
    count: () => failures,
  };
}

/** The identity a polling lifecycle (and so its failure counter) belongs to. */
export const cateringAttemptPollIdentity = (userId: string, bookingId: string, attemptId: string | null) => `${userId}:${bookingId}:${attemptId ?? "none"}`;

/**
 * The polling interval for ONE attempt's status query, as a pure function of the query state and the CONSECUTIVE failure count.
 *  - a pending (or still-creating) attempt: keep asking;
 *  - any other settled attempt: stop;
 *  - a terminal error (deterministic 4xx) stops at once;
 *  - transient errors stop only once the threshold of CONSECUTIVE failures is reached, and any success resets that, so an old failure can never
 *    contribute to a later cutoff;
 *  - NO data yet: keep asking only while nothing has gone wrong.
 */
export function cateringAttemptPollInterval(state: { data?: Pick<CateringPaymentAttemptView, "state" | "checkoutUrl">; error?: unknown; consecutiveFailures?: number }): number | false {
  if (cateringAttemptLookupIsTerminal(state.error)) return false;
  if ((state.consecutiveFailures ?? 0) >= CATERING_ATTEMPT_LOOKUP_MAX_FAILURES) return false;
  if (state.data) {
    const display = cateringSquareDisplay(state.data, "customer");
    return display.polling || state.data.state === "creating" ? CATERING_SQUARE_POLL_MS : false;
  }
  return CATERING_SQUARE_POLL_MS;
}

/**
 * Why a lookup has stopped being trusted, or null while it is healthy. `terminal`: the server said this attempt can never be read. `exhausted`:
 * the threshold of CONSECUTIVE failures was reached, so polling stopped and the screen must say so rather than sit on "Checking your payment".
 */
export function cateringAttemptLookupStatus(state: { error?: unknown; consecutiveFailures?: number }): "terminal" | "exhausted" | null {
  if (cateringAttemptLookupIsTerminal(state.error)) return "terminal";
  return (state.consecutiveFailures ?? 0) >= CATERING_ATTEMPT_LOOKUP_MAX_FAILURES ? "exhausted" : null;
}

export const CATERING_ATTEMPT_LOOKUP_UNREACHABLE_COPY = "We couldn't reach ChefSire to check this payment. If you paid on Square, your payment is safe and will be applied once ChefSire can confirm it. Check again, or reload the page. Nothing has been marked as paid here.";
export const CATERING_ATTEMPT_LOOKUP_FAILED_COPY = "We couldn't verify this payment attempt. Refresh your billing page, or start again if a payment is still due. Nothing has been marked as paid.";

/** Checkout creation answered `creating`: Square's answer was uncertain. The same request again resumes the same checkout. */
export const CATERING_SQUARE_CREATE_RETRIES = 3;
export const CATERING_SQUARE_CREATE_RETRY_MS = 2_000;
export const CATERING_SQUARE_POLL_MS = 3_000;

/**
 * Only an https URL on a Square host may be navigated to. The server only ever returns the URL Square gave it, but a screen that
 * navigates somewhere because a response said so checks where.
 */
export function cateringSafeCheckoutUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return /(^|\.)(squareup\.com|squareupsandbox\.com|square\.link|square\.site)$/i.test(parsed.hostname) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The uncertain-checkout retry lifecycle
 * ------------------------------------------------------------------------------------------------------------- */

/** One checkout's identity: the viewer, the booking and the invoice. A retry belongs to exactly one of these and to no other. */
export const cateringCheckoutIdentity = (userId: string, bookingId: string, invoiceId: string) => `${userId}:${bookingId}:${invoiceId}`;

export type CheckoutTimers = { setTimeout(run: () => void, ms: number): unknown; clearTimeout(handle: unknown): void };

/**
 * Owns the ONE pending "ask again" timer of an uncertain checkout, and the identity it belongs to.
 *
 * The handle is stored so it can be cleared; `setIdentity` cancels it whenever the booking, invoice or viewer changes; `dispose` cancels
 * it on unmount; and even a timer that somehow fires re-checks that its identity is still current before it runs anything. So a retry
 * can never POST against an invoice the customer has left.
 */
export function createCheckoutRetryScheduler(timers: CheckoutTimers = { setTimeout: (run, ms) => setTimeout(run, ms), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }) {
  let handle: unknown = null;
  let identity: string | null = null;
  const cancel = () => { if (handle !== null) { timers.clearTimeout(handle); handle = null; } };
  return {
    /** Adopts the identity currently on screen; a change cancels whatever was pending for the previous one. */
    setIdentity(next: string | null) { if (next !== identity) { cancel(); identity = next; } },
    isCurrent(candidate: string): boolean { return identity !== null && identity === candidate; },
    /** Schedules ONE retry for `forIdentity`; refused (false) if that is not the identity on screen. Replaces any earlier pending retry. */
    schedule(forIdentity: string, run: () => void, ms: number): boolean {
      if (identity === null || forIdentity !== identity) return false;
      cancel();
      handle = timers.setTimeout(() => { handle = null; if (identity === forIdentity) run(); }, ms);
      return true;
    },
    pending(): boolean { return handle !== null; },
    cancel,
    /** Unmount: nothing may fire afterwards, and nothing is current. */
    dispose() { cancel(); identity = null; },
  };
}

/**
 * Where, if anywhere, a finished pay request may send the browser. Only to a checkout the SAME identity asked for, only while that identity
 * is still on screen, and only to a Square URL: a response that lands after the customer moved on changes nothing and goes nowhere.
 */
export function cateringCheckoutRedirectTarget(input: { startedFor: string; isCurrent: (identity: string) => boolean; attempt: { state: string; checkoutUrl?: string } | undefined }): string | null {
  if (!input.isCurrent(input.startedFor)) return null;
  if (input.attempt?.state !== "pending") return null;
  return cateringSafeCheckoutUrl(input.attempt.checkoutUrl);
}
