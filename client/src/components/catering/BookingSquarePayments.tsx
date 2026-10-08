import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cateringBookingBillingKey, formatCateringMoney, type CateringBookingBillingView, type CateringInvoiceView } from "@shared/catering-booking-billing";
import {
  CATERING_ATTEMPT_VERIFICATION_UNAVAILABLE_MESSAGE,
  CATERING_SQUARE_COPY,
  cateringInvoicePayPath,
  cateringPaymentAttemptPath,
  type CateringPaymentAttemptView,
} from "@shared/catering-square-payments";
import {
  CATERING_ATTEMPT_LOOKUP_FAILED_COPY,
  CateringAttemptLookupError,
  CATERING_ATTEMPT_LOOKUP_UNREACHABLE_COPY,
  cateringLookupCountsAsSuccess,
  cateringLookupIsVerificationUnavailable,
  cateringAttemptLookupStatus,
  cateringAttemptPollIdentity,
  cateringAttemptPollInterval,
  createConsecutiveFailureCounter,
  CATERING_SQUARE_CREATE_RETRIES,
  CATERING_SQUARE_CREATE_RETRY_MS,
  cateringCheckoutIdentity,
  cateringCheckoutRedirectTarget,
  createCheckoutRetryScheduler,
  cateringInvoicePaymentInReview,
  cateringOpenAttemptFor,
  cateringProviderVisibleAttempts,
  cateringActiveReturnedAttempt,
  cateringReturnedAttemptIdentity,
  cateringSafeCheckoutUrl,
  cateringSquareDisplay,
  cateringSquareEvidenceLabel,
  cateringSquareHeadline,
  cateringSquarePayAvailable,
  cateringSquareReconciliationCopy,
} from "@/pages/services/catering-square-payment-state";

/**
 * Catering Phase 2Q: paying an issued invoice through Square's hosted checkout (SANDBOX ONLY), and reading the result.
 *
 * WHAT THIS COMPONENT NEVER DOES
 *  - It never asks for, holds or sends a card number: the customer is sent to Square's own page.
 *  - It never sends an amount. The pay request is an empty object; the server derives what is payable.
 *  - It never treats coming back from Square as payment. The return only starts asking the server, which asks Square; "confirmed" is
 *    shown only when the server says an attempt is `completed`.
 *
 * Mobile first: every control is at least 44px tall and every row wraps to one column.
 */

const attemptKey = (userId: string, bookingId: string, attemptId: string) => ["catering", "square-attempt", userId, bookingId, attemptId] as const;

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try { const parsed = await response.json(); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}

/** A customer's "Pay securely with Square" control and open-checkout status for ONE invoice. Renders nothing for a provider. */
export function InvoiceSquarePayment({ bookingId, userId, billing, invoice }: { bookingId: string; userId: string; billing: CateringBookingBillingView; invoice: CateringInvoiceView }) {
  const cache = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const retries = useRef(0);
  const identity = cateringCheckoutIdentity(userId, bookingId, invoice.id);
  // ONE scheduler per mounted control. It holds the pending retry's handle, drops it when the identity (viewer, booking or invoice)
  // changes, and on unmount; and it is the single source of truth for "is this still the checkout on screen".
  const scheduler = useRef<ReturnType<typeof createCheckoutRetryScheduler>>();
  if (!scheduler.current) scheduler.current = createCheckoutRetryScheduler();
  const retryScheduler = scheduler.current;
  useEffect(() => {
    retryScheduler.setIdentity(identity);
    retries.current = 0;
    setCreating(false);
    setMessage(null);
    return () => retryScheduler.dispose();
  }, [identity, retryScheduler]);
  const open = cateringOpenAttemptFor(billing.paymentAttempts, invoice.id);
  const available = cateringSquarePayAvailable({ role: billing.role, billing, invoice });
  const refreshBilling = (target: { userId: string; bookingId: string }) => cache.invalidateQueries({ queryKey: cateringBookingBillingKey(target.userId, target.bookingId) });

  type PayRequest = { identity: string; userId: string; bookingId: string; invoiceId: string };
  const start = useMutation({
    mutationFn: async (request: PayRequest) => {
      let response: Response;
      try {
        // An empty object: there is no field in which an amount, merchant or location could be sent. The request names the booking and
        // invoice it was STARTED for, never whatever is on screen when it runs.
        response = await fetch(cateringInvoicePayPath(request.bookingId, request.invoiceId), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      } catch { throw new Error("We couldn't reach ChefSire. Nothing was charged. Please try again."); }
      const body = await readJson(response);
      if (!response.ok) throw new Error(typeof body.message === "string" && body.message ? body.message : "We could not open a Square checkout. Nothing was charged.");
      return body as { attempt?: CateringPaymentAttemptView };
    },
    onSuccess: async (body, request) => {
      // Always refresh the billing view that request was for; it is harmless for any identity.
      await refreshBilling(request);
      // But nothing else -- no message, no spinner, no retry, no REDIRECT -- unless that request's checkout is still the one on screen.
      if (!retryScheduler.isCurrent(request.identity)) return;
      setMessage(null);
      const attempt = body.attempt;
      const target = cateringCheckoutRedirectTarget({ startedFor: request.identity, isCurrent: (candidate) => retryScheduler.isCurrent(candidate), attempt });
      if (target) { setCreating(false); window.location.assign(target); return; }
      if (attempt?.state === "creating" && retries.current < CATERING_SQUARE_CREATE_RETRIES) {
        // Square's answer was uncertain; asking again resumes the SAME checkout (same server-side idempotency key) rather than creating another.
        retries.current += 1;
        retryScheduler.schedule(request.identity, () => start.mutate(request), CATERING_SQUARE_CREATE_RETRY_MS);
        return;
      }
      setCreating(false);
      if (attempt?.state === "failed") setMessage(CATERING_SQUARE_COPY.failed);
    },
    onError: async (error: Error, request) => {
      await refreshBilling(request);
      if (!retryScheduler.isCurrent(request.identity)) return;
      setCreating(false);
      setMessage(error.message);
    },
  });
  const pressPay = () => { retries.current = 0; setCreating(true); setMessage(null); start.mutate({ identity, userId, bookingId, invoiceId: invoice.id }); };

  if (billing.role !== "customer") return null;
  // A payment under review: no Pay button, and the customer is told NOT to pay again. The server refuses another checkout regardless.
  if (cateringInvoicePaymentInReview(billing.paymentAttempts, invoice.id)) {
    return <div className="mt-3 space-y-2 rounded-md border border-dashed p-3" aria-live="polite"><p role="status" className="break-words text-sm">{CATERING_SQUARE_COPY.paymentReview}</p></div>;
  }
  if (!available && !open) return null;
  const display = open ? cateringSquareDisplay(open, "customer") : null;
  const url = cateringSafeCheckoutUrl(open?.checkoutUrl);
  const busy = creating || start.isPending;

  return <div className="mt-3 space-y-2 rounded-md border border-dashed p-3" aria-live="polite">
    {available && <>
      <Button className="min-h-11" disabled={busy} onClick={pressPay}>
        {busy ? CATERING_SQUARE_COPY.creating : `${CATERING_SQUARE_COPY.payAction} · ${formatCateringMoney(invoice.payableCents, invoice.currency)}`}
      </Button>
      <p className="text-xs text-muted-foreground">{CATERING_SQUARE_COPY.disclosure}</p>
    </>}
    {open && display && <div className="space-y-2">
      <p className="break-words text-sm">{display.label}</p>
      {display.canContinue && url && <Button className="min-h-11" asChild><a href={url}>Continue to Square checkout</a></Button>}
      {display.phase === "creating" && !busy && <Button className="min-h-11" variant="outline" onClick={pressPay}>Try again</Button>}
    </div>}
    {message && <p role="alert" className="break-words text-sm text-destructive">{message}</p>}
  </div>;
}

/**
 * Polls the server for ONE attempt while it is the checkout the person is waiting on (open, or just returned from), and refreshes the
 * billing view when it settles. Polling is not authority: the server asks Square and answers with what Square showed it.
 */
function useAttemptPolling(bookingId: string, userId: string, attemptId: string | null, onSettled: () => void) {
  // ONE failure counter per polling identity (viewer + booking + attempt): a different invoice, booking or attempt starts from zero, and a
  // success resets it. It is deliberately not the query library's cumulative error tally, which a success never resets.
  const identity = cateringAttemptPollIdentity(userId, bookingId, attemptId);
  const counter = useMemo(() => createConsecutiveFailureCounter(), [identity]);
  const query = useQuery({
    queryKey: attemptKey(userId, bookingId, attemptId ?? "none"),
    enabled: attemptId !== null,
    // The poll interval IS the retry (bounded by the consecutive-failure cutoff below), so one failed fetch is one failure.
    retry: false,
    refetchInterval: (polled: { state: { data?: CateringPaymentAttemptView; error?: unknown } }) => cateringAttemptPollInterval({ data: polled.state.data, error: polled.state.error, consecutiveFailures: counter.count() }),
    queryFn: async (): Promise<CateringPaymentAttemptView> => {
      try {
        let response: Response;
        try { response = await fetch(cateringPaymentAttemptPath(bookingId, attemptId!), { credentials: "include" }); }
        catch { throw new CateringAttemptLookupError("This payment could not be checked right now.", null); }
        const body = await readJson(response);
        // An explicit "Square could not be asked" is a FAILED check (counted, bounded), never a successful one: the attempt is unchanged and unverified.
        if (!response.ok) throw new CateringAttemptLookupError("This payment could not be checked right now.", response.status, typeof body.code === "string" ? body.code : null);
        if (typeof body.attempt !== "object" || body.attempt === null) throw new CateringAttemptLookupError("This payment could not be checked right now.", null);
        // A throttled answer asked Square nothing: it is neither a success (it must not reset the count) nor a failure.
        if (cateringLookupCountsAsSuccess(body.verification)) counter.succeeded();
        return body.attempt as CateringPaymentAttemptView;
      } catch (error) {
        counter.failed();
        throw error;
      }
    },
  });
  const state = query.data?.state;
  const settled = useRef<string | null>(null);
  useEffect(() => {
    if (!state || state === "pending" || state === "creating" || settled.current === `${attemptId}:${state}`) return;
    settled.current = `${attemptId}:${state}`;
    onSettled();
  }, [state, attemptId]);
  // Judged AFTER the latest fetch: an error with a success since is no error at all (react-query clears `error` on success).
  const lookup = query.isError ? cateringAttemptLookupStatus({ error: query.error, consecutiveFailures: counter.count() }) : null;
  const recheck = () => { counter.reset(); void query.refetch(); };
  return { attempt: query.data, failed: lookup === "terminal", exhausted: lookup === "exhausted", squareUnavailable: query.isError && cateringLookupIsVerificationUnavailable(query.error), recheck };
}

/**
 * The status banner for a customer returning from Square, and the provider's panel of Square payments for the booking.
 * Renders nothing when there is nothing to say.
 */
export function SquarePaymentsPanel({ bookingId, userId, billing }: { bookingId: string; userId: string; billing: CateringBookingBillingView }) {
  const cache = useQueryClient();
  const customer = billing.role === "customer";
  // The returned attempt is DERIVED from the router's reactive search string on every render, never copied into state from the URL as it was at
  // mount: the workspace keeps this panel mounted across bookings, so a copy would carry one booking's attempt (and its polling) into the next, or
  // miss an attempt that appears later. Only the dismissal is state, and it names the exact viewer + booking + attempt it hides.
  const search = useSearch();
  const [dismissedIdentity, setDismissedIdentity] = useState<string | null>(null);
  const returned = cateringActiveReturnedAttempt({ search, userId, bookingId, dismissedIdentity });
  const refreshBilling = () => cache.invalidateQueries({ queryKey: cateringBookingBillingKey(userId, bookingId) });
  const { attempt: polled, failed, exhausted, squareUnavailable, recheck } = useAttemptPolling(bookingId, userId, customer ? returned : null, refreshBilling);
  const money = (cents: number, currency: string) => formatCateringMoney(cents, currency);

  const dismiss = () => {
    if (returned) setDismissedIdentity(cateringReturnedAttemptIdentity(userId, bookingId, returned));
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("squareAttempt");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const attempts = customer ? billing.paymentAttempts : cateringProviderVisibleAttempts(billing.paymentAttempts);
  // A customer's banner is for the checkout they just came back from; the provider's panel lists the booking's Square payments.
  const showBanner = customer && returned !== null;
  // An unresolved review of returned money is shown to BOTH actors, whether or not anyone just came back from Square: a booking that reads as paid must
  // not hide that Square reports part of that money returned.
  const reviewCount = billing.squareReturnReviewCount ?? 0;
  if (!showBanner && reviewCount === 0 && (customer || attempts.length === 0)) return null;

  return <section className="space-y-3" aria-live="polite">
    {reviewCount > 0 && <p role="alert" className="break-words rounded-md border border-destructive/50 p-3 text-sm">{customer ? CATERING_SQUARE_COPY.returnReviewNoticeCustomer : CATERING_SQUARE_COPY.returnReviewNoticeProvider}</p>}
    {showBanner && <div className="rounded-md border p-3 text-sm" role="status">
      {failed ? <>
        <p role="alert" className="break-words">{CATERING_ATTEMPT_LOOKUP_FAILED_COPY}</p>
        <Button variant="outline" className="mt-2 min-h-11" onClick={dismiss}>Dismiss</Button>
      </> : exhausted ? <>
        <p role="alert" className="break-words">{squareUnavailable ? CATERING_ATTEMPT_VERIFICATION_UNAVAILABLE_MESSAGE : CATERING_ATTEMPT_LOOKUP_UNREACHABLE_COPY}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={recheck}>Retry status check</Button>
          <Button variant="outline" className="min-h-11" onClick={dismiss}>Dismiss</Button>
        </div>
      </> : polled ? <>
        <p className="break-words font-medium">{polled.state === "pending" ? CATERING_SQUARE_COPY.verifying : cateringSquareDisplay(polled, "customer").label}</p>
        {polled.state === "reconciliation_required" && <p className="mt-1 break-words text-muted-foreground">{cateringSquareReconciliationCopy(polled.reconciliationReason, "customer")}</p>}
        {polled.state !== "pending" && <Button variant="outline" className="mt-2 min-h-11" onClick={dismiss}>Dismiss</Button>}
      </> : <p>{CATERING_SQUARE_COPY.verifying}</p>}
    </div>}
    {!customer && <>
      <h3 className="font-semibold">Square payments</h3>
      <p className="text-sm text-muted-foreground">Card payments your customers make through Square go directly to your Square account. ChefSire records them only after Square confirms them.</p>
      <ul className="space-y-2">{attempts.map((attempt) => {
        const display = cateringSquareDisplay(attempt, "provider");
        return <li key={attempt.id} className="min-w-0 rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="break-words font-medium tabular-nums">{cateringSquareHeadline(attempt, money)}</p>
            <Badge variant={display.phase === "reconciliation" ? "destructive" : display.phase === "confirmed" ? "default" : "outline"}>
              {display.phase === "reconciliation" ? "Needs your attention" : display.phase === "confirmed" ? "Confirmed by Square" : display.phase === "awaiting" ? "Awaiting payment" : display.phase === "creating" ? "Opening checkout" : display.phase === "failed" ? "Could not open" : "Closed"}
            </Badge>
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">{display.label}</p>
          {attempt.state === "reconciliation_required" && <p className="mt-1 break-words text-sm">{cateringSquareReconciliationCopy(attempt.reconciliationReason, "provider")}</p>}
          {attempt.state === "reconciliation_required" && <p className="mt-1 break-words text-sm">{CATERING_SQUARE_COPY.paymentReviewProvider}</p>}
          {attempt.squarePaymentId && !attempt.processorPayments?.length && <p className="mt-1 break-all text-xs text-muted-foreground">Square payment reference: {attempt.squarePaymentId}</p>}
          {attempt.processorPayments && attempt.processorPayments.length > 0 && <div className="mt-2 space-y-1" aria-label="Completed Square payments">
            <p className="text-xs font-medium">{attempt.processorPayments.length === 1 ? "Square payment" : `${attempt.processorPayments.length} completed Square payments`}</p>
            <ul className="space-y-1">{attempt.processorPayments.map((payment, index) => <li key={payment.squarePaymentId ?? index} className="break-all text-xs text-muted-foreground">
              <span className="tabular-nums">{money(payment.amountCents, payment.currency)}</span>
              {payment.completedAt ? ` · ${payment.completedAt}` : " · no usable Square time"}
              {payment.squarePaymentId ? ` · ${payment.squarePaymentId}` : ""}
              {attempt.state === "reconciliation_required" || attempt.state === "completed" ? <span className={`ml-1 font-medium ${payment.creditedToLedger ? "text-foreground" : ""}`}> · {cateringSquareEvidenceLabel(payment, attempt.ledgerCredited)}{payment.refunded ? ` · ${CATERING_SQUARE_COPY.evidenceRefunded}` : ""}</span> : null}
            </li>)}</ul>
          </div>}
        </li>;
      })}</ul>
    </>}
  </section>;
}
