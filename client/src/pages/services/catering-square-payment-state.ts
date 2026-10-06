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

export function cateringSquareDisplay(attempt: Pick<CateringPaymentAttemptView, "state" | "checkoutUrl">, role: "provider" | "customer"): CateringSquareDisplay {
  switch (attempt.state) {
    case "creating": return { phase: "creating", label: CATERING_SQUARE_COPY.creating, polling: false, canContinue: false };
    case "pending": return { phase: "awaiting", label: role === "customer" ? CATERING_SQUARE_COPY.pending : "A customer has opened a Square checkout for this request.", polling: true, canContinue: role === "customer" && Boolean(attempt.checkoutUrl) };
    case "completed": return { phase: "confirmed", label: CATERING_SQUARE_COPY.completed, polling: false, canContinue: false };
    case "reconciliation_required": return { phase: "reconciliation", label: role === "customer" ? CATERING_SQUARE_COPY.reconciliation : CATERING_SQUARE_COPY.reconciliationProvider, polling: false, canContinue: false };
    case "failed": return { phase: "failed", label: CATERING_SQUARE_COPY.failed, polling: false, canContinue: false };
    // expired, cancelled and superseded are all a checkout that was closed before any money moved.
    default: return { phase: "closed", label: CATERING_SQUARE_COPY.closed, polling: false, canContinue: false };
  }
}

export function cateringSquareReconciliationCopy(reason: CateringReconciliationReason | undefined, role: "provider" | "customer"): string | null {
  return reason ? CATERING_SQUARE_RECONCILIATION_COPY[reason][role] : null;
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
