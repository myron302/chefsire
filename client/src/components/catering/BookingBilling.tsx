import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATERING_BILLING_DISCLOSURE,
  CATERING_BILLING_SECTION,
  CATERING_FINANCIAL_STATUS_COPY,
  CATERING_INVOICE_STATE_COPY,
  CATERING_PAYMENT_METHOD_COPY,
  CATERING_PAYMENT_METHODS,
  cateringBookingBillingKey,
  cateringBookingBillingPath,
  formatCateringMoney,
  type CateringBookingBillingView,
  type CateringDepositMode,
  type CateringInvoiceKind,
  type CateringInvoiceView,
  type CateringPaymentMethod,
} from "@shared/catering-booking-billing";
import { cateringWorkspacePollInterval } from "@shared/catering-booking-operations";
import {
  activeCateringPaymentForm,
  cateringBillingCanStillChange,
  cateringBillingFailureNotice,
  cateringBillingIdentity,
  cateringMajorUnits,
  cateringPaymentProvenance,
  cateringTermsFormIsCurrent,
  editCateringPaymentForm,
  editCateringTermsForm,
  emptyCateringTermsForm,
  hydrateCateringTermsForm,
  isCateringBillingConflict,
  markCateringTermsConflict,
  maySubmitCateringPayment,
  maySubmitCateringTerms,
  mayReloadCateringTerms,
  openCateringPaymentForm,
  reloadCateringTermsForm,
  settleCateringTermsForm,
  shouldRefetchBillingAfterError,
  type CateringBillingError,
  type CateringPaymentForm,
  type CateringTermsForm,
} from "@/pages/services/catering-booking-billing-state";

/**
 * The Phase 2L billing section of the existing catering booking workspace.
 *
 * MOBILE FIRST throughout. Every control is at least 44px tall, every row stacks to one column below `sm`, amounts
 * are given `tabular-nums` and allowed to wrap, and the payment form is an ordinary inline form rather than a
 * dialog -- there is no desktop-only financial control anywhere in this file.
 *
 * NO MONEY IS COMPUTED HERE. Every figure rendered below arrives already derived from the authoritative ledger;
 * the component's only arithmetic-shaped act is turning the server's own `remainingCents` into the string that
 * prefills one form field. Issuing an invoice sends a kind and never an amount.
 *
 * WHAT IT NEVER SAYS. There is no customer payment button, because ChefSire processes no catering payment and a
 * button with nothing behind it would be the first lie on the page. Every payment is labelled with whose record it
 * is, and the disclosure sits above the section for both actors.
 */
export default function BookingBilling({ bookingId, userId, role }: { bookingId: string; userId: string; role: "provider" | "customer" }) {
  const cache = useQueryClient();
  const identity = cateringBillingIdentity(userId, bookingId);
  const key = cateringBookingBillingKey(userId, bookingId);
  const provider = role === "provider";

  const query = useQuery({
    queryKey: key,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    // The same cadence constant every other workspace section uses. Billing keeps polling while the booking can
    // still produce a financial change, which is every status except cancelled: a customer must learn that their
    // caterer has requested a deposit without reloading the page.
    refetchInterval: (polled: { state: { data?: CateringBookingBillingView } }) =>
      cateringWorkspacePollInterval(cateringBillingCanStillChange(polled.state.data?.bookingStatus)),
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<CateringBookingBillingView> => {
      const response = await fetch(cateringBookingBillingPath(bookingId), { credentials: "include" });
      // A 2xx whose body cannot be read is not an answer. Returning `{}` would install an empty object as the
      // authoritative view -- over a good cached one -- and everything below reaches into `summary`.
      let parsed: unknown;
      let unreadable = false;
      try { parsed = await response.json(); } catch { unreadable = true; }
      const body = (unreadable || parsed === null || typeof parsed !== "object" ? {} : parsed) as Record<string, unknown>;
      if (!response.ok) throw Object.assign(new Error(typeof body.message === "string" && body.message ? body.message : "Billing could not be loaded"), { code: typeof body.code === "string" ? body.code : undefined });
      if (unreadable || typeof body.summary !== "object" || body.summary === null) throw new Error("Billing could not be loaded");
      return body as unknown as CateringBookingBillingView;
    },
  });
  const billing = query.data;
  const actionable = Boolean(billing?.actionable);
  const currency = billing?.summary.currency ?? "USD";

  /**
   * The booking every piece of local state belongs to.
   *
   * Assigned during RENDER, not in a passive effect, so the one committed render of booking B before the reset
   * flushes cannot submit or display booking A's draft -- the Phase 2J and 2K lesson, applied from the outset.
   */
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [localIdentity, setLocalIdentity] = useState(identity);
  const [termsForm, setTermsForm] = useState<CateringTermsForm>(emptyCateringTermsForm);
  const [paymentForm, setPaymentForm] = useState<CateringPaymentForm>(null);
  const [notice, setNotice] = useState<{ identity: string; message: string; retryable: boolean } | null>(null);
  /**
   * The due date being offered with each kind, before it is asked for.
   *
   * A deposit's date comes from the terms, which the provider has already set; a BALANCE has no terms, so without
   * a field here the only client path to issuing one sent no date at all and the server persisted null. Every
   * balance invoice created through this UI was therefore permanently undatable and could never become overdue,
   * while the summary and the invoice list both render exactly that. One input per issuable kind fixes it and
   * removes the asymmetry: the deposit's own date is now visible, and overridable, at the moment of asking.
   *
   * Identity-scoped like everything else here, and cleared by the same reset, so booking A's date cannot be
   * attached to booking B's invoice.
   */
  const [issueDueOn, setIssueDueOn] = useState<Record<string, string>>({});
  useEffect(() => {
    if (localIdentity === identity) return;
    setLocalIdentity(identity);
    setTermsForm(emptyCateringTermsForm());
    setPaymentForm(null);
    setIssueDueOn({});
    setNotice(null);
  }, [identity, localIdentity]);
  const localStateIsCurrent = localIdentity === identity;

  // Hydrate the terms form from the authoritative payload. A dirty form is left alone so a poll cannot replace
  // unsaved entries; a conflicted one keeps everything until the provider explicitly reloads.
  const terms = billing?.terms;
  const termsValues = {
    mode: (terms?.mode ?? "none") as CateringDepositMode,
    amount: terms?.amountCents != null ? cateringMajorUnits(terms.amountCents) : "",
    percent: terms?.percentBasisPoints != null ? String(terms.percentBasisPoints / 100) : "",
    dueOn: terms?.dueOn ?? "",
  };
  const termsVersion = terms?.updatedAt ?? null;
  useEffect(() => {
    if (!terms) return;
    setTermsForm((current) => hydrateCateringTermsForm(current, identity, termsValues, termsVersion));
    // The values are compared field by field rather than by object identity, which a fresh poll would break.
  }, [identity, Boolean(terms), termsValues.mode, termsValues.amount, termsValues.percent, termsValues.dueOn, termsVersion]);

  type BillingOrigin = { identity: string; bookingId: string; userId: string };
  type BillingMutation = {
    origin: BillingOrigin;
    /**
     * The route this request is for, stated as the server registers it.
     *
     * The method used to be hardcoded to POST inside `mutationFn`, which silently 404'd the ONE route that is a
     * PUT -- the deposit-terms save -- so a provider could fill the form in, press Save, and be told the change
     * could not be saved by a server that never saw a request it recognised. Carrying the method with the path
     * makes each call site state the contract it is calling, and makes a mismatch a visible difference between two
     * lines rather than an invisible default.
     */
    method: "PUT" | "POST";
    path: string;
    body: unknown;
    /** The exact terms this request was built from, so a completion settles what it accounts for and nothing else. */
    submittedTerms?: { mode: CateringDepositMode; amount: string; percent: string; dueOn: string };
    /** Set on the payment write, so an accepted one closes the form it came from and a refused one keeps it. */
    closesPaymentForm?: boolean;
  };
  const origin = (): BillingOrigin => ({ identity, bookingId, userId });
  const settlesHere = (started: BillingOrigin) => started.identity === identityRef.current;

  const mutation = useMutation({
    mutationFn: async ({ origin: started, method, path, body }: BillingMutation) => {
      let response: Response;
      try {
        response = await fetch(`/api/catering/bookings/${started.bookingId}${path}`, {
          method, credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (transportError) {
        // No answer at all. The write may have been applied and its response lost, which is exactly why the
        // payment form keeps its idempotency key: the retry resolves to the same payment rather than a second one.
        throw Object.assign(new Error(String((transportError as Error)?.message ?? transportError)), { offline: true });
      }
      let parsed: unknown;
      let unreadable = false;
      try { parsed = await response.json(); } catch { unreadable = true; }
      const answer = (unreadable || parsed === null || typeof parsed !== "object" ? {} : parsed) as Record<string, unknown>;
      if (!response.ok) {
        throw Object.assign(new Error(typeof answer.message === "string" && answer.message ? answer.message : "This billing change could not be saved"),
          { code: typeof answer.code === "string" ? answer.code : undefined });
      }
      // A 2xx that does not carry what the write is defined to return is an INDETERMINATE write, not a success:
      // settling from it would report money as recorded on the strength of a body nobody could read.
      const carries = typeof answer.summary === "object" && answer.summary !== null;
      const carriesTerms = typeof answer.terms === "object" && answer.terms !== null;
      if (unreadable || !(carries || carriesTerms)) {
        throw Object.assign(new Error("ChefSire's answer could not be read"), { offline: true, unreadable: true });
      }
      return answer;
    },
    onSuccess: async (value, variables) => {
      const started = variables.origin;
      // The response IS the whole re-derived view for every write except the terms save, so it is installed
      // directly: values and their versions together, never a version adopted without the values it describes.
      if (typeof value.summary === "object" && value.summary !== null) {
        cache.setQueryData(cateringBookingBillingKey(started.userId, started.bookingId), value as unknown as CateringBookingBillingView);
      }
      const reconciled = cache.invalidateQueries({ queryKey: cateringBookingBillingKey(started.userId, started.bookingId) }).catch(() => undefined);
      // The Activity panel above this card records issued invoices and recorded payments, and lives in the parent
      // workspace query, which does not poll. It is refreshed but never awaited: it governs no control here.
      cache.invalidateQueries({ queryKey: ["catering", "booking-workspace", started.userId, started.bookingId] });
      if (!settlesHere(started)) return;
      setNotice(null);
      if (variables.submittedTerms) {
        const saved = value.terms as { updatedAt?: string | null } | undefined;
        setTermsForm((current) => settleCateringTermsForm(current, started.identity, variables.submittedTerms!, typeof saved?.updatedAt === "string" ? saved.updatedAt : null));
      }
      if (variables.closesPaymentForm) setPaymentForm(null);
      // Held pending until the authoritative payload has landed, so no control is re-enabled against a view that
      // predates the change the provider just made.
      await reconciled;
    },
    onError: async (error: CateringBillingError, variables) => {
      const started = variables.origin;
      const reconciled = shouldRefetchBillingAfterError(error)
        ? cache.invalidateQueries({ queryKey: cateringBookingBillingKey(started.userId, started.bookingId) }).catch(() => undefined)
        : undefined;
      if (!settlesHere(started)) { await reconciled; return; }
      const outcome = cateringBillingFailureNotice(error);
      setNotice({ identity: started.identity, message: outcome.message, retryable: outcome.retryable });
      // ONLY a genuine concurrency refusal conflicts the form. A dropped connection or a 500 leaves it exactly as
      // it was -- same entries, same version, savable again the moment the transient problem clears.
      if (variables.submittedTerms && isCateringBillingConflict(error)) setTermsForm(markCateringTermsConflict);
      await reconciled;
    },
  });
  const pending = mutation.isPending;

  const submitTerms = (event: FormEvent) => {
    event.preventDefault();
    if (!localStateIsCurrent || !maySubmitCateringTerms(termsForm, identity, actionable, pending)) return;
    const submitted = { mode: termsForm.mode, amount: termsForm.amount, percent: termsForm.percent, dueOn: termsForm.dueOn };
    mutation.mutate({
      origin: origin(), method: "PUT", path: "/billing/deposit-terms",
      body: {
        mode: termsForm.mode,
        ...(termsForm.mode === "fixed" ? { amount: termsForm.amount } : {}),
        ...(termsForm.mode === "percentage" ? { percent: termsForm.percent } : {}),
        dueOn: termsForm.dueOn ? termsForm.dueOn : null,
        // The FORM's own base version, so another tab's intervening save is refused rather than overwritten.
        ...(termsForm.baseVersion ? { expectedUpdatedAt: termsForm.baseVersion } : {}),
      },
      submittedTerms: submitted,
    });
  };
  // Issuing sends the KIND and nothing else. There is no amount field on this request, so there is no
  // client-computed total for the server to have to distrust.
  const issueInvoice = (kind: CateringInvoiceKind) => {
    if (!localStateIsCurrent || !actionable || pending) return;
    // Absent when the provider has not touched the field, so a deposit still inherits its terms date. Present --
    // as a date or as an explicit null -- the moment they have, so clearing it means cleared rather than
    // reinstated from the terms they just chose not to use.
    const touched = issueDueOn[kind] !== undefined;
    const dueOn = issueDueOn[kind]?.trim() ?? "";
    mutation.mutate({
      origin: origin(), method: "POST", path: "/billing/invoices",
      // The kind, and the date to ask by. Still no amount: that is derived on the server from the booking's own
      // agreed price, under its lock.
      body: { kind, ...(touched ? { dueOn: dueOn === "" ? null : dueOn } : {}) },
    });
  };
  const voidInvoice = (invoice: CateringInvoiceView) => {
    if (!localStateIsCurrent || !actionable || pending) return;
    if (!window.confirm("Withdraw this request? Your customer will see that it was withdrawn.")) return;
    mutation.mutate({
      origin: origin(), method: "POST", path: `/billing/invoices/${invoice.id}/void`,
      body: invoice.updatedAt ? { expectedUpdatedAt: invoice.updatedAt } : {},
    });
  };
  const submitPayment = (event: FormEvent) => {
    event.preventDefault();
    const open = activeCateringPaymentForm(paymentForm, identity, actionable);
    const invoice = open ? billing?.invoices.find((row) => row.id === open.invoiceId) : undefined;
    if (!open || !localStateIsCurrent || !maySubmitCateringPayment(open, invoice, pending)) return;
    mutation.mutate({
      origin: origin(), method: "POST", path: "/billing/payments",
      body: {
        invoiceId: open.invoiceId, amount: open.amount, method: open.method, receivedOn: open.receivedOn,
        ...(open.reference ? { reference: open.reference } : {}),
        // Minted when the form OPENED and unchanged since, so a double-click, a browser retry and a retry after a
        // lost response are all one attempt and credit the money exactly once.
        idempotencyKey: open.idempotencyKey,
      },
      closesPaymentForm: true,
    });
  };
  const voidPayment = (paymentId: string) => {
    if (!localStateIsCurrent || !actionable || pending) return;
    if (!window.confirm("Take back this recorded payment? Your customer will see that it was withdrawn.")) return;
    mutation.mutate({ origin: origin(), method: "POST", path: `/billing/payments/${paymentId}/void`, body: {} });
  };

  if (query.isLoading) return <Card id={CATERING_BILLING_SECTION}><CardHeader><CardTitle>Payments</CardTitle></CardHeader><CardContent><p role="status">Loading payment details…</p></CardContent></Card>;
  if (query.isError || !billing) {
    return <Card id={CATERING_BILLING_SECTION}><CardHeader><CardTitle>Payments</CardTitle></CardHeader><CardContent className="space-y-2" role="alert">
      <p>Payment details could not be loaded.</p>
      <Button variant="outline" className="min-h-11" onClick={() => query.refetch()}>Retry loading payments</Button>
    </CardContent></Card>;
  }

  const { summary } = billing;
  const statusCopy = CATERING_FINANCIAL_STATUS_COPY[summary.status];
  const money = (cents: number) => formatCateringMoney(cents, currency);
  const openPayment = activeCateringPaymentForm(paymentForm, identity, actionable);
  const activeNotice = notice && notice.identity === identity ? notice : null;
  const termsAreCurrent = localStateIsCurrent && cateringTermsFormIsCurrent(termsForm, identity);

  return <Card id={CATERING_BILLING_SECTION}>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>Payments</CardTitle>
          <CardDescription className="break-words">{provider ? statusCopy.provider : statusCopy.customer}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={summary.hasOverdue ? "destructive" : summary.status === "settled" ? "default" : "outline"}>{statusCopy.label}</Badge>
          {summary.hasOverdue && <Badge variant="destructive">Overdue</Badge>}
        </div>
      </div>
      {/* The disclosure sits above everything, for both actors, on every render. */}
      <p className="mt-2 rounded-md bg-muted p-3 text-sm">{provider ? CATERING_BILLING_DISCLOSURE.provider : CATERING_BILLING_DISCLOSURE.customer}</p>
    </CardHeader>

    <CardContent className="space-y-6">
      {activeNotice && <p role="alert" className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{activeNotice.message}</p>}

      {/* Totals. One column on a phone, two from `sm`, all figures tabular so they line up and wrap rather than
          overflow when a currency and a long amount meet on a narrow screen. */}
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-sm text-muted-foreground">Agreed total</dt>
          <dd className="break-words text-lg font-semibold tabular-nums">{summary.agreedTotalCents === null ? "Not agreed yet" : money(summary.agreedTotalCents)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Recorded as paid</dt>
          <dd className="break-words text-lg font-semibold tabular-nums">{money(summary.paidTotalCents)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Remaining of the agreed total</dt>
          <dd className="break-words tabular-nums">{summary.remainingOfAgreedCents === null ? "—" : money(summary.remainingOfAgreedCents)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Requested and not yet covered</dt>
          <dd className="break-words tabular-nums">{money(summary.outstandingInvoicedCents)}</dd></div>
        {summary.nextAmountDueCents !== null && <div className="sm:col-span-2">
          <dt className="text-sm text-muted-foreground">Next payment</dt>
          <dd className="break-words tabular-nums">
            {money(summary.nextAmountDueCents)}
            {summary.nextDueOn ? ` · due ${summary.nextDueOn}` : ""}
            {summary.nextDueIsOverdue ? " · overdue" : ""}
          </dd></div>}
      </dl>

      {/* Requests. Both actors see the same list, including withdrawn ones: a customer who was asked for money is
          entitled to see that the ask was taken back rather than watch it disappear. */}
      <section className="space-y-3">
        <h3 className="font-semibold">Requests</h3>
        {billing.invoices.length === 0
          ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{provider ? "You have not requested anything yet." : "Your caterer has not requested anything yet."}</p>
          : <ul className="space-y-3">{billing.invoices.map((invoice) => <li key={invoice.id} className="min-w-0 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium">{invoice.kind === "deposit" ? "Deposit" : "Remaining balance"} · <span className="tabular-nums">{money(invoice.amountCents)}</span></p>
                <p className="break-words text-sm text-muted-foreground">
                  {invoice.reference}{invoice.dueOn ? ` · due ${invoice.dueOn}` : ""}
                  {invoice.paidCents > 0 && invoice.state !== "void" ? ` · ${money(invoice.paidCents)} recorded` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={invoice.state === "paid" ? "default" : invoice.overdue ? "destructive" : "outline"}>{CATERING_INVOICE_STATE_COPY[invoice.state]}</Badge>
                {invoice.overdue && <Badge variant="destructive">Overdue</Badge>}
              </div>
            </div>
            {provider && actionable && invoice.state !== "void" && <div className="mt-3 flex flex-wrap gap-2">
              {invoice.remainingCents > 0 && <Button className="min-h-11" disabled={pending}
                onClick={() => setPaymentForm(openCateringPaymentForm(identity, invoice, billing.asOfDate, cateringIdempotencyKey()))}>
                Record a payment
              </Button>}
              {invoice.paidCents === 0 && <Button className="min-h-11" variant="outline" disabled={pending} onClick={() => voidInvoice(invoice)}>Withdraw</Button>}
            </div>}
          </li>)}</ul>}

        {provider && actionable && (billing.issuablePreview ?? []).map(({ kind, amountCents }) => <div key={kind} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`catering-issue-due-${kind}`}>Due by (optional)</Label>
            <Input id={`catering-issue-due-${kind}`} className="min-h-11" type="date"
              value={issueDueOn[kind] ?? (kind === "deposit" ? terms?.dueOn ?? "" : "")}
              onChange={(event) => setIssueDueOn((current) => ({ ...current, [kind]: event.target.value }))} />
          </div>
          <Button className="min-h-11" disabled={pending} onClick={() => issueInvoice(kind)}>
            {/* The amount is the server's own preview, shown so nothing is requested unseen -- and it is NOT sent
                back: the request carries the kind and a due date, and the server re-derives the figure under its
                lock. */}
            {kind === "deposit" ? "Request deposit" : "Request balance"} · <span className="tabular-nums">{money(amountCents)}</span>
          </Button>
        </div>)}
      </section>

      {/* The payment form. Inline rather than a dialog, so it works the same at 320px as it does on a desktop. */}
      {provider && openPayment && <form onSubmit={submitPayment} className="space-y-3 rounded-lg border p-4">
        <h3 className="font-semibold">Record a payment you have received</h3>
        <p className="text-sm text-muted-foreground">This records money your customer has already paid you directly. ChefSire does not take the payment.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="catering-payment-amount">Amount received</Label>
            <Input id="catering-payment-amount" className="min-h-11" inputMode="decimal" value={openPayment.amount}
              onChange={(event) => setPaymentForm((current) => editCateringPaymentForm(current, identity, { amount: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="catering-payment-date">Date received</Label>
            <Input id="catering-payment-date" className="min-h-11" type="date" value={openPayment.receivedOn}
              onChange={(event) => setPaymentForm((current) => editCateringPaymentForm(current, identity, { receivedOn: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="catering-payment-method">How it was paid</Label>
            <select id="catering-payment-method" className="min-h-11 w-full rounded-md border bg-background px-3" value={openPayment.method}
              onChange={(event) => setPaymentForm((current) => editCateringPaymentForm(current, identity, { method: event.target.value as CateringPaymentMethod }))}>
              {CATERING_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{CATERING_PAYMENT_METHOD_COPY[method]}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="catering-payment-reference">Your reference (optional)</Label>
            <Input id="catering-payment-reference" className="min-h-11" value={openPayment.reference} maxLength={64}
              onChange={(event) => setPaymentForm((current) => editCateringPaymentForm(current, identity, { reference: event.target.value }))} />
            <p className="text-xs text-muted-foreground">Only you can see this.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={!maySubmitCateringPayment(openPayment, billing.invoices.find((row) => row.id === openPayment.invoiceId), pending)}>Record payment</Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setPaymentForm(null)}>Cancel</Button>
        </div>
      </form>}

      {/* Payment history. Every row says whose record it is. */}
      <section className="space-y-3">
        <h3 className="font-semibold">Payment history</h3>
        {billing.payments.length === 0
          ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
          : <ul className="space-y-2">{billing.payments.map((payment) => <li key={payment.id} className="flex min-w-0 flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="break-words font-medium tabular-nums">{money(payment.amountCents)}{payment.status === "voided" ? " · withdrawn" : ""}</p>
              <p className="break-words text-sm text-muted-foreground">
                {CATERING_PAYMENT_METHOD_COPY[payment.method]} · {payment.receivedOn} · {cateringPaymentProvenance(payment.source, role)}
                {provider && payment.reference ? ` · ${payment.reference}` : ""}
              </p>
            </div>
            {provider && actionable && payment.status === "recorded" && <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => voidPayment(payment.id)}>Take back</Button>}
          </li>)}</ul>}
      </section>

      {/* Deposit terms. PROVIDER ONLY -- the payload carries no `terms` key at all for a customer. */}
      {provider && terms && <form onSubmit={submitTerms} className="space-y-3 rounded-lg border p-4">
        <h3 className="font-semibold">Deposit terms</h3>
        <p className="text-sm text-muted-foreground">
          Only you can see these. Your customer sees the deposit once you request it{terms.requiredCents !== null ? `, which would be ${money(terms.requiredCents)}` : ""}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="catering-deposit-mode">Deposit</Label>
            <select id="catering-deposit-mode" className="min-h-11 w-full rounded-md border bg-background px-3" value={termsForm.mode}
              disabled={!actionable || termsForm.conflicted}
              onChange={(event) => setTermsForm((current) => editCateringTermsForm(current, { mode: event.target.value as CateringDepositMode }))}>
              <option value="none">No deposit</option>
              <option value="fixed">A fixed amount</option>
              <option value="percentage">A percentage of the agreed price</option>
            </select>
          </div>
          {termsForm.mode === "fixed" && <div className="space-y-1">
            <Label htmlFor="catering-deposit-amount">Amount</Label>
            <Input id="catering-deposit-amount" className="min-h-11" inputMode="decimal" value={termsForm.amount} disabled={!actionable || termsForm.conflicted}
              onChange={(event) => setTermsForm((current) => editCateringTermsForm(current, { amount: event.target.value }))} />
          </div>}
          {termsForm.mode === "percentage" && <div className="space-y-1">
            <Label htmlFor="catering-deposit-percent">Percentage</Label>
            <Input id="catering-deposit-percent" className="min-h-11" inputMode="decimal" value={termsForm.percent} disabled={!actionable || termsForm.conflicted}
              onChange={(event) => setTermsForm((current) => editCateringTermsForm(current, { percent: event.target.value }))} />
          </div>}
          {termsForm.mode !== "none" && <div className="space-y-1">
            <Label htmlFor="catering-deposit-due">Due by (optional)</Label>
            <Input id="catering-deposit-due" className="min-h-11" type="date" value={termsForm.dueOn} disabled={!actionable || termsForm.conflicted}
              onChange={(event) => setTermsForm((current) => editCateringTermsForm(current, { dueOn: event.target.value }))} />
          </div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={!maySubmitCateringTerms(termsForm, identity, actionable, pending)}>Save deposit terms</Button>
          {mayReloadCateringTerms(termsForm, identity) && <Button type="button" variant="outline" className="min-h-11"
            onClick={() => setTermsForm(reloadCateringTermsForm(identity, termsValues, termsVersion))}>
            Discard my changes and reload
          </Button>}
        </div>
        {termsForm.conflicted && termsAreCurrent && <p role="alert" className="text-sm text-destructive">These terms were changed somewhere else. Reload them before saving.</p>}
      </form>}
    </CardContent>
  </Card>;
}

/**
 * A key for ONE attempt at recording ONE payment.
 *
 * Minted when the form opens and kept for its lifetime, so every retry of that attempt carries the same key and
 * the server credits the money once. `crypto.randomUUID` where it exists, with a plain fallback for the older
 * browsers that lack it -- a key that is merely unlikely to collide is still a key.
 */
function cateringIdempotencyKey(): string {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : null;
  return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}
