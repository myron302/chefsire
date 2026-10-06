import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cateringBookingBillingKey, formatCateringMoney, type CateringBookingBillingView, type CateringInvoiceView } from "@shared/catering-booking-billing";
import {
  CATERING_SQUARE_COPY,
  cateringInvoicePayPath,
  cateringPaymentAttemptPath,
  type CateringPaymentAttemptView,
} from "@shared/catering-square-payments";
import {
  CATERING_ATTEMPT_LOOKUP_FAILED_COPY,
  CateringAttemptLookupError,
  cateringAttemptLookupIsTerminal,
  cateringAttemptPollInterval,
  CATERING_SQUARE_CREATE_RETRIES,
  CATERING_SQUARE_CREATE_RETRY_MS,
  cateringOpenAttemptFor,
  cateringProviderVisibleAttempts,
  cateringReturnedAttemptId,
  cateringSafeCheckoutUrl,
  cateringSquareDisplay,
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
  const open = cateringOpenAttemptFor(billing.paymentAttempts, invoice.id);
  const available = cateringSquarePayAvailable({ role: billing.role, billing, invoice });
  const refreshBilling = () => cache.invalidateQueries({ queryKey: cateringBookingBillingKey(userId, bookingId) });

  const start = useMutation({
    mutationFn: async () => {
      let response: Response;
      try {
        // An empty object: there is no field in which an amount, merchant or location could be sent.
        response = await fetch(cateringInvoicePayPath(bookingId, invoice.id), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      } catch { throw new Error("We couldn't reach ChefSire. Nothing was charged. Please try again."); }
      const body = await readJson(response);
      if (!response.ok) throw new Error(typeof body.message === "string" && body.message ? body.message : "We could not open a Square checkout. Nothing was charged.");
      return body as { attempt?: CateringPaymentAttemptView };
    },
    onSuccess: async (body) => {
      setMessage(null);
      const attempt = body.attempt;
      const url = cateringSafeCheckoutUrl(attempt?.checkoutUrl);
      await refreshBilling();
      if (attempt?.state === "pending" && url) { setCreating(false); window.location.assign(url); return; }
      if (attempt?.state === "creating" && retries.current < CATERING_SQUARE_CREATE_RETRIES) {
        // Square's answer was uncertain; asking again resumes the SAME checkout rather than creating another.
        retries.current += 1;
        setTimeout(() => start.mutate(), CATERING_SQUARE_CREATE_RETRY_MS);
        return;
      }
      setCreating(false);
      if (attempt?.state === "failed") setMessage(CATERING_SQUARE_COPY.failed);
    },
    onError: async (error: Error) => { setCreating(false); setMessage(error.message); await refreshBilling(); },
  });

  if (billing.role !== "customer") return null;
  if (!available && !open) return null;
  const display = open ? cateringSquareDisplay(open, "customer") : null;
  const url = cateringSafeCheckoutUrl(open?.checkoutUrl);
  const busy = creating || start.isPending;

  return <div className="mt-3 space-y-2 rounded-md border border-dashed p-3" aria-live="polite">
    {available && <>
      <Button className="min-h-11" disabled={busy} onClick={() => { retries.current = 0; setCreating(true); setMessage(null); start.mutate(); }}>
        {busy ? CATERING_SQUARE_COPY.creating : `${CATERING_SQUARE_COPY.payAction} · ${formatCateringMoney(invoice.payableCents, invoice.currency)}`}
      </Button>
      <p className="text-xs text-muted-foreground">{CATERING_SQUARE_COPY.disclosure}</p>
    </>}
    {open && display && <div className="space-y-2">
      <p className="break-words text-sm">{display.label}</p>
      {display.canContinue && url && <Button className="min-h-11" asChild><a href={url}>Continue to Square checkout</a></Button>}
      {display.phase === "creating" && !busy && <Button className="min-h-11" variant="outline" onClick={() => { retries.current = 0; start.mutate(); }}>Try again</Button>}
    </div>}
    {message && <p role="alert" className="break-words text-sm text-destructive">{message}</p>}
  </div>;
}

/**
 * Polls the server for ONE attempt while it is the checkout the person is waiting on (open, or just returned from), and refreshes the
 * billing view when it settles. Polling is not authority: the server asks Square and answers with what Square showed it.
 */
function useAttemptPolling(bookingId: string, userId: string, attemptId: string | null, onSettled: () => void) {
  const query = useQuery({
    queryKey: attemptKey(userId, bookingId, attemptId ?? "none"),
    enabled: attemptId !== null,
    // A deterministic 4xx (unknown, stale or inaccessible attempt) is never retried and ends polling at once; transient failures are retried
    // a bounded number of times. Absent data never means "keep polling forever".
    retry: (failures: number, error: unknown) => !cateringAttemptLookupIsTerminal(error) && failures < 2,
    refetchInterval: (polled: { state: { data?: CateringPaymentAttemptView; error?: unknown; errorUpdateCount?: number } }) => cateringAttemptPollInterval(polled.state),
    queryFn: async (): Promise<CateringPaymentAttemptView> => {
      let response: Response;
      try { response = await fetch(cateringPaymentAttemptPath(bookingId, attemptId!), { credentials: "include" }); }
      catch { throw new CateringAttemptLookupError("This payment could not be checked right now.", null); }
      const body = await readJson(response);
      if (!response.ok) throw new CateringAttemptLookupError("This payment could not be checked right now.", response.status);
      if (typeof body.attempt !== "object" || body.attempt === null) throw new CateringAttemptLookupError("This payment could not be checked right now.", null);
      return body.attempt as CateringPaymentAttemptView;
    },
  });
  const state = query.data?.state;
  const settled = useRef<string | null>(null);
  useEffect(() => {
    if (!state || state === "pending" || state === "creating" || settled.current === `${attemptId}:${state}`) return;
    settled.current = `${attemptId}:${state}`;
    onSettled();
  }, [state, attemptId]);
  return { attempt: query.data, failed: query.isError && !query.data };
}

/**
 * The status banner for a customer returning from Square, and the provider's panel of Square payments for the booking.
 * Renders nothing when there is nothing to say.
 */
export function SquarePaymentsPanel({ bookingId, userId, billing }: { bookingId: string; userId: string; billing: CateringBookingBillingView }) {
  const cache = useQueryClient();
  const customer = billing.role === "customer";
  const [returned, setReturned] = useState<string | null>(() => (typeof window === "undefined" ? null : cateringReturnedAttemptId(window.location.search)));
  const refreshBilling = () => cache.invalidateQueries({ queryKey: cateringBookingBillingKey(userId, bookingId) });
  const { attempt: polled, failed } = useAttemptPolling(bookingId, userId, customer ? returned : null, refreshBilling);
  const money = (cents: number, currency: string) => formatCateringMoney(cents, currency);

  const dismiss = () => {
    setReturned(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("squareAttempt");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const attempts = customer ? billing.paymentAttempts : cateringProviderVisibleAttempts(billing.paymentAttempts);
  // A customer's banner is for the checkout they just came back from; the provider's panel lists the booking's Square payments.
  const showBanner = customer && returned !== null;
  if (!showBanner && (customer || attempts.length === 0)) return null;

  return <section className="space-y-3" aria-live="polite">
    {showBanner && <div className="rounded-md border p-3 text-sm" role="status">
      {failed ? <>
        <p role="alert" className="break-words">{CATERING_ATTEMPT_LOOKUP_FAILED_COPY}</p>
        <Button variant="outline" className="mt-2 min-h-11" onClick={dismiss}>Dismiss</Button>
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
            <p className="break-words font-medium tabular-nums">{money(attempt.processorAmountCents ?? attempt.amountCents, attempt.currency)}</p>
            <Badge variant={display.phase === "reconciliation" ? "destructive" : display.phase === "confirmed" ? "default" : "outline"}>
              {display.phase === "reconciliation" ? "Needs your attention" : display.phase === "confirmed" ? "Confirmed by Square" : display.phase === "awaiting" ? "Awaiting payment" : display.phase === "creating" ? "Opening checkout" : display.phase === "failed" ? "Could not open" : "Closed"}
            </Badge>
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">{display.label}</p>
          {attempt.state === "reconciliation_required" && <p className="mt-1 break-words text-sm">{cateringSquareReconciliationCopy(attempt.reconciliationReason, "provider")}</p>}
          {attempt.squarePaymentId && <p className="mt-1 break-all text-xs text-muted-foreground">Square payment reference: {attempt.squarePaymentId}</p>}
        </li>;
      })}</ul>
    </>}
  </section>;
}
