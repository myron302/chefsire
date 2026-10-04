import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CATERING_PAYMENT_METHOD_COPY, cateringBookingBillingKey, formatCateringMoney, type CateringBookingBillingView } from "@shared/catering-booking-billing";
import {
  CATERING_ADJUSTMENT_ACTION_LABEL,
  CATERING_ADJUSTMENT_EFFECT_COPY,
  CATERING_ADJUSTMENT_KIND_LABEL,
  CATERING_ADJUSTMENT_REASON_MAX_LENGTH,
  CATERING_ADJUSTMENT_REFERENCE_MAX_LENGTH,
  CATERING_ADJUSTMENT_STATUS_LABEL,
  CATERING_REFUND_DISCLOSURE,
  cateringBookingAdjustmentReversePath,
  cateringBookingAdjustmentsPath,
  type CateringAdjustmentKind,
  type CateringAdjustmentView,
} from "@shared/catering-billing-adjustments";
import {
  activeCateringAdjustmentForm,
  buildCateringAdjustmentRequest,
  cateringAdjustmentAmountText,
  cateringAdjustmentEffectSentence,
  cateringAdjustmentIdentity,
  cateringAdjustmentInvalidationKeys,
  cateringAdjustmentSnapshot,
  cateringAdjustmentSourceText,
  checkCateringAdjustmentForm,
  cateringRefundLimitForForm,
  chronologicalCateringAdjustments,
  describeCateringAdjustmentConfirmation,
  describeCateringReversalConfirmation,
  editCateringAdjustmentForm,
  isCurrentCateringAdjustmentTarget,
  maySubmitCateringAdjustment,
  openCateringAdjustmentForm,
  settleCateringAdjustmentForm,
  type CateringAdjustmentForm,
  type CateringAdjustmentSnapshot,
} from "@/pages/services/catering-booking-adjustment-state";
import { cateringBillingFailureNotice, shouldRefetchBillingAfterError, type CateringBillingError } from "@/pages/services/catering-booking-billing-state";

/**
 * The Phase 2P section of the existing booking billing card: adjustments, credits and external refund records.
 *
 * NO MONEY IS COMPUTED HERE and none moves. Every figure arrives already derived by the server; this component only
 * presents it and sends a kind, an integer of cents, an explicit currency and a reason. A refund is a RECORD that money
 * was returned outside ChefSire and is worded as one everywhere, including the confirmation: ChefSire sends nothing.
 *
 * The customer sees the same ledger and the same summary and is read-only. Mobile first: one column below `sm`, controls
 * at least 44px, long reasons wrap, and no table anywhere.
 */
type Mutation = { started: string; userId: string; bookingId: string; path: string; body: unknown; submitted?: CateringAdjustmentSnapshot };

export default function BookingAdjustments({ bookingId, userId, role, billing }: { bookingId: string; userId: string; role: "provider" | "customer"; billing: CateringBookingBillingView }) {
  const cache = useQueryClient();
  const identity = cateringAdjustmentIdentity(userId, bookingId);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const provider = role === "provider";
  const { summary } = billing;
  const currency = summary.currency;
  const money = (cents: number) => formatCateringMoney(cents, currency);
  const actions = billing.adjustmentActions;
  const limitsFor = (paymentId: string) => ({
    maxCreditCents: actions?.maxCreditCents ?? 0,
    maxRefundCents: actions?.maxRefundCents ?? 0,
    maxChargeCents: actions?.maxChargeCents,
    // The selected payment's own remainder, as the server derived it; a payment the payload does not vouch for allows nothing.
    selectedPaymentRefundableCents: paymentId ? billing.payments.find((payment) => payment.id === paymentId)?.refundableCents ?? 0 : null,
  });

  // Assigned during RENDER, as in the rest of billing, so the one committed render of booking B before the reset flushes
  // can neither show nor submit booking A's draft.
  const [localIdentity, setLocalIdentity] = useState(identity);
  const [form, setForm] = useState<CateringAdjustmentForm>(null);
  const [confirming, setConfirming] = useState<{ type: "post" } | { type: "reverse"; entry: CateringAdjustmentView } | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<{ identity: string; message: string } | null>(null);
  useEffect(() => {
    if (localIdentity === identity) return;
    setLocalIdentity(identity);
    setForm(null); setConfirming(null); setReverseReason(""); setShowErrors(false); setNotice(null);
  }, [identity, localIdentity]);
  const current = localIdentity === identity;

  const mutation = useMutation({
    mutationFn: async ({ path, body }: Mutation) => {
      let response: Response;
      try {
        response = await fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch (transportError) {
        // No answer. The write may have been applied and its response lost -- which is why the form keeps its key: a retry
        // resolves to the same entry rather than a second one.
        throw Object.assign(new Error(String((transportError as Error)?.message ?? transportError)), { offline: true });
      }
      let parsed: unknown;
      let unreadable = false;
      try { parsed = await response.json(); } catch { unreadable = true; }
      const answer = (unreadable || parsed === null || typeof parsed !== "object" ? {} : parsed) as Record<string, unknown>;
      if (!response.ok) throw Object.assign(new Error(typeof answer.message === "string" && answer.message ? answer.message : "This billing change could not be saved"), { code: typeof answer.code === "string" ? answer.code : undefined });
      // A 2xx that does not carry the re-derived view is an INDETERMINATE write, not a success.
      if (unreadable || typeof answer.summary !== "object" || answer.summary === null) throw Object.assign(new Error("ChefSire's answer could not be read"), { offline: true, unreadable: true });
      return answer;
    },
    onSuccess: async (value, variables) => {
      // The response IS the whole re-derived view: installed directly, values and versions together.
      cache.setQueryData(cateringBookingBillingKey(variables.userId, variables.bookingId), value as unknown as CateringBookingBillingView);
      // Only what a financial write can change, and only for the user who made it. Never the whole cache.
      for (const queryKey of cateringAdjustmentInvalidationKeys({ surfaceUserId: variables.userId, bookingId: variables.bookingId })) cache.invalidateQueries({ queryKey });
      if (!isCurrentCateringAdjustmentTarget(identityRef.current, variables.started)) return;
      setNotice(null);
      setConfirming(null);
      setReverseReason("");
      if (variables.submitted) setForm((open) => settleCateringAdjustmentForm(open, variables.started, variables.submitted!, newKey()));
    },
    onError: async (error: CateringBillingError, variables) => {
      if (shouldRefetchBillingAfterError(error)) await cache.invalidateQueries({ queryKey: cateringBookingBillingKey(variables.userId, variables.bookingId) }).catch(() => undefined);
      if (!isCurrentCateringAdjustmentTarget(identityRef.current, variables.started)) return;
      setConfirming(null);
      setNotice({ identity: variables.started, message: cateringBillingFailureNotice(error).message });
    },
  });
  const pending = mutation.isPending;

  const open = activeCateringAdjustmentForm(form, identity, provider && current);
  const limits = limitsFor(open?.paymentId ?? "");
  const check = open ? checkCateringAdjustmentForm(open, limits) : null;
  const entries = chronologicalCateringAdjustments(billing.adjustments);
  const recordedPayments = billing.payments.filter((payment) => payment.status === "recorded");
  const activeNotice = notice && notice.identity === identity ? notice : null;
  const hasLedger = entries.length > 0;

  const review = (event: FormEvent) => {
    event.preventDefault();
    if (!open || !check) return;
    if (!check.ok) { setShowErrors(true); return; }
    setShowErrors(false);
    setConfirming({ type: "post" });
  };
  const confirmPost = () => {
    if (!open || !check?.ok || !current || pending) return;
    mutation.mutate({ started: identity, userId, bookingId, path: cateringBookingAdjustmentsPath(bookingId), body: buildCateringAdjustmentRequest(open, currency, check.amountCents), submitted: cateringAdjustmentSnapshot(open) });
  };
  const confirmReverse = (entry: CateringAdjustmentView) => {
    if (!current || pending || reverseReason.trim() === "") return;
    mutation.mutate({ started: identity, userId, bookingId, path: cateringBookingAdjustmentReversePath(bookingId, entry.id), body: { reason: reverseReason.trim() } });
  };
  const startForm = (kind: CateringAdjustmentKind) => { setShowErrors(false); setNotice(null); setForm(openCateringAdjustmentForm(identity, kind, newKey())); };

  const confirmation = confirming?.type === "post" && open && check?.ok ? describeCateringAdjustmentConfirmation(open, currency, check.amountCents)
    : confirming?.type === "reverse" ? describeCateringReversalConfirmation(confirming.entry) : null;

  return (
    <section className="min-w-0 space-y-3" aria-labelledby={`catering-adjustments-${bookingId}`}>
      <h3 id={`catering-adjustments-${bookingId}`} className="font-semibold">Adjustments, credits and refunds</h3>
      <p className="rounded-md bg-muted p-3 text-sm">{provider ? CATERING_REFUND_DISCLOSURE.helper : CATERING_REFUND_DISCLOSURE.customer}</p>
      {activeNotice && <p role="alert" className="break-words rounded-md border border-destructive/50 p-3 text-sm text-destructive">{activeNotice.message}</p>}

      {summary.refundPotentiallyDueCents > 0 && <p role="status" className="break-words rounded-md border p-3 text-sm">
        {provider
          ? <>Your customer has paid <strong className="tabular-nums">{money(summary.refundPotentiallyDueCents)}</strong> more than they now owe. A refund may be due. Nothing has been returned until you record it.</>
          : <>You have paid <strong className="tabular-nums">{money(summary.refundPotentiallyDueCents)}</strong> more than you now owe. A refund may be due from your caterer. It is not a refund until they record that they returned it.</>}
      </p>}

      {hasLedger && <dl className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2" aria-label="Financial position">
        <Figure label="Originally agreed" value={summary.originalAgreedCents === null ? "—" : money(summary.originalAgreedCents)} />
        <Figure label="Additional charges" value={`+${money(summary.adjustmentChargesCents)}`} />
        <Figure label="Credits" value={`-${money(summary.adjustmentCreditsCents)}`} />
        <Figure label="Current total owed" value={summary.obligationCents === null ? "—" : money(summary.obligationCents)} strong />
        <Figure label="Payments recorded" value={money(summary.paidTotalCents)} />
        <Figure label="Refunds recorded (returned outside ChefSire)" value={money(summary.refundsRecordedCents)} />
        <Figure label="Received, net of refunds" value={money(summary.netReceivedCents)} />
        <Figure label="Balance still owed" value={summary.balanceDueCents === null ? "—" : money(summary.balanceDueCents)} strong />
      </dl>}

      {entries.length === 0
        ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{provider ? "You have not recorded any charge, credit or refund on this booking." : "No additional charges, credits or refunds have been recorded on this booking."}</p>
        : <ol className="space-y-2" aria-label="Adjustment history, oldest first">{entries.map((entry) => {
          const source = cateringAdjustmentSourceText(entry);
          // The server's own verdict for THIS entry, never a guess from its kind. It is a snapshot hint; the endpoint judges again.
          const reversible = provider && current && entry.reversible === true;
          const blockedReason = provider && current && entry.status === "posted" && entry.reversible === false ? entry.reversalBlockedReason ?? null : null;
          return <li key={entry.id} className="min-w-0 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium">{CATERING_ADJUSTMENT_KIND_LABEL[entry.kind]} · <span className="tabular-nums">{cateringAdjustmentAmountText(entry)}</span> <span className="text-sm text-muted-foreground">({entry.currency})</span></p>
                <p className="break-words text-sm text-muted-foreground">{formatDate(entry.createdAt)}{source ? ` · ${source}` : ""}{entry.paymentId ? " · Against a recorded payment" : ""}</p>
              </div>
              <Badge variant={entry.status === "reversed" ? "outline" : "default"}>{CATERING_ADJUSTMENT_STATUS_LABEL[entry.status]}</Badge>
            </div>
            <p className="mt-2 break-words text-sm"><span className="font-medium">Reason: </span>{entry.reason}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{cateringAdjustmentEffectSentence(entry, role)}</p>
            {entry.status === "reversed" && <p className="mt-1 break-words text-sm"><span className="font-medium">Reversed{entry.reversedAt ? ` on ${formatDate(entry.reversedAt)}` : ""}: </span>{entry.reversalReason}</p>}
            {provider && entry.reference && <p className="mt-1 break-words text-sm text-muted-foreground">Your note: {entry.reference}</p>}
            {blockedReason && <p className="mt-2 break-words text-sm text-muted-foreground">This entry cannot be reversed right now. {blockedReason}</p>}
            {reversible && <Button variant="outline" className="mt-3 min-h-11" disabled={pending} onClick={() => { setReverseReason(""); setConfirming({ type: "reverse", entry }); }}>Reverse entry</Button>}
          </li>;
        })}</ol>}

      {provider && current && actions && actions.kinds.length > 0 && !open && <div className="flex flex-wrap gap-2">
        {actions.kinds.map((kind) => <Button key={kind} variant="outline" className="min-h-11" disabled={pending} onClick={() => startForm(kind)}>{CATERING_ADJUSTMENT_ACTION_LABEL[kind]}</Button>)}
      </div>}
      {provider && actions && actions.kinds.length === 0 && billing.bookingStatus !== "pending_confirmation" && <p className="text-sm text-muted-foreground">No adjustment can be recorded on this booking right now.</p>}

      {open && <form onSubmit={review} className="space-y-3 rounded-lg border p-4" aria-label={CATERING_ADJUSTMENT_ACTION_LABEL[open.kind]}>
        <h4 className="font-semibold">{CATERING_ADJUSTMENT_ACTION_LABEL[open.kind]}</h4>
        <p className="text-sm text-muted-foreground">{open.kind === "refund" ? CATERING_REFUND_DISCLOSURE.helper : CATERING_ADJUSTMENT_EFFECT_COPY[open.kind]}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`adjustment-amount-${bookingId}`}>{`Amount (${currency})`}</Label>
            <Input id={`adjustment-amount-${bookingId}`} className="min-h-11" inputMode="decimal" autoComplete="off" value={open.amount} aria-invalid={showErrors && check?.ok === false && check.field === "amount"} aria-describedby={`adjustment-amount-help-${bookingId}`}
              onChange={(event) => setForm((value) => editCateringAdjustmentForm(value, identity, { amount: event.target.value }))} />
            <p id={`adjustment-amount-help-${bookingId}`} className={showErrors && check?.ok === false && check.field === "amount" ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={showErrors && check?.ok === false && check.field === "amount" ? "alert" : undefined}>
              {showErrors && check?.ok === false && check.field === "amount" ? check.message
                : open.kind === "credit" ? `At most ${money(limits.maxCreditCents)}, what your customer currently owes.`
                : open.kind === "refund" ? (open.paymentId
                  ? `At most ${money(cateringRefundLimitForForm(open, limits))}: what is left of the selected payment, and never more than the ${money(limits.maxRefundCents)} recorded as received and not yet recorded as returned.`
                  : `At most ${money(limits.maxRefundCents)}, the money recorded as received and not yet recorded as returned.`)
                : "In the booking's currency. ChefSire does not convert currencies."}
            </p>
          </div>
          {open.kind === "refund" && <div className="space-y-1">
            <Label htmlFor={`adjustment-payment-${bookingId}`}>Which payment was returned (optional)</Label>
            <select id={`adjustment-payment-${bookingId}`} className="min-h-11 w-full rounded-md border bg-background px-3" value={open.paymentId}
              onChange={(event) => setForm((value) => editCateringAdjustmentForm(value, identity, { paymentId: event.target.value }))}>
              <option value="">Not tied to one payment</option>
              {recordedPayments.map((payment) => <option key={payment.id} value={payment.id} disabled={(payment.refundableCents ?? 0) === 0}>{money(payment.amountCents)} · {CATERING_PAYMENT_METHOD_COPY[payment.method]} · {payment.receivedOn} · {money(payment.refundableCents ?? 0)} left to record as returned</option>)}
            </select>
          </div>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`adjustment-reason-${bookingId}`}>Reason your customer will see</Label>
          <Textarea id={`adjustment-reason-${bookingId}`} rows={3} maxLength={CATERING_ADJUSTMENT_REASON_MAX_LENGTH} value={open.reason} aria-invalid={showErrors && check?.ok === false && check.field === "reason"} aria-describedby={`adjustment-reason-help-${bookingId}`}
            onChange={(event) => setForm((value) => editCateringAdjustmentForm(value, identity, { reason: event.target.value }))} />
          <p id={`adjustment-reason-help-${bookingId}`} className={showErrors && check?.ok === false && check.field === "reason" ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={showErrors && check?.ok === false && check.field === "reason" ? "alert" : undefined}>
            {showErrors && check?.ok === false && check.field === "reason" ? check.message : "Both of you can read this."}
          </p>
        </div>
        {open.kind === "refund" && <div className="space-y-1">
          <Label htmlFor={`adjustment-reference-${bookingId}`}>Your note (optional)</Label>
          <Input id={`adjustment-reference-${bookingId}`} className="min-h-11" autoComplete="off" maxLength={CATERING_ADJUSTMENT_REFERENCE_MAX_LENGTH} value={open.reference} aria-describedby={`adjustment-reference-help-${bookingId}`}
            onChange={(event) => setForm((value) => editCateringAdjustmentForm(value, identity, { reference: event.target.value }))} />
          <p id={`adjustment-reference-help-${bookingId}`} className="text-xs text-muted-foreground">Only you can see this, and ChefSire does not verify it.</p>
        </div>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={pending || (showErrors && !maySubmitCateringAdjustment(open, limits, pending))}>Review before recording</Button>
          <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => { setForm(null); setShowErrors(false); }}>Cancel</Button>
        </div>
      </form>}

      <AlertDialog open={confirmation !== null} onOpenChange={(next) => { if (!next && !pending) setConfirming(null); }}>
        <AlertDialogContent>
          {confirmation && <>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmation.effect}</AlertDialogDescription>
            </AlertDialogHeader>
            <dl className="space-y-2 text-sm">{confirmation.lines.map((line) => <div key={line.label}><dt className="text-muted-foreground">{line.label}</dt><dd className="break-words font-medium">{line.value}</dd></div>)}</dl>
            {confirming?.type === "reverse" && <div className="space-y-1">
              <Label htmlFor={`adjustment-reverse-reason-${bookingId}`}>Reason your customer will see</Label>
              <Textarea id={`adjustment-reverse-reason-${bookingId}`} rows={2} maxLength={CATERING_ADJUSTMENT_REASON_MAX_LENGTH} value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} />
            </div>}
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11" disabled={pending}>Go back</AlertDialogCancel>
              <Button className="min-h-11" variant={confirming?.type === "reverse" ? "destructive" : "default"} disabled={pending || (confirming?.type === "reverse" && reverseReason.trim() === "")}
                onClick={() => (confirming?.type === "reverse" ? confirmReverse(confirming.entry) : confirmPost())}>
                {pending ? "Saving…" : confirmation.action}
              </Button>
            </AlertDialogFooter>
          </>}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className={`break-words tabular-nums ${strong ? "text-lg font-semibold" : ""}`}>{value}</dd></div>;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** A key for ONE attempt: minted when a form opens, unchanged for its lifetime, so every retry is one entry. */
function newKey(): string {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : null;
  return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}
