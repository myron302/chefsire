import { cateringBookingBillingKey, cateringMoneyToCents, formatCateringMoney } from "@shared/catering-booking-billing";
import { cateringBookingWorkspaceKey } from "@shared/catering-booking-operations";
import { cateringAmendmentsKey } from "@shared/catering-amendments";
import {
  CATERING_ADJUSTMENT_ACTION_LABEL,
  CATERING_ADJUSTMENT_EFFECT_COPY,
  CATERING_ADJUSTMENT_KIND_LABEL,
  CATERING_ADJUSTMENT_MAXIMUM_CENTS,
  CATERING_ADJUSTMENT_REASON_MAX_LENGTH,
  CATERING_ADJUSTMENT_REFERENCE_MAX_LENGTH,
  type CateringAdjustmentActions,
  type CateringAdjustmentKind,
  type CateringAdjustmentView,
} from "@shared/catering-billing-adjustments";

/**
 * The pure state the Phase 2P adjustment section is built from.
 *
 * Every function is total in its arguments: no React, no fetch, no clock. And, as in Phase 2L, NO BALANCE IS COMPUTED
 * HERE. Every figure on screen arrives already derived by the server; the only number this file produces is the integer
 * of cents the provider typed, parsed once by the billing phase's exact string parser, which the server then validates
 * again against the ledger under the booking's lock. The limits a form states (`maxCreditCents`, `maxRefundCents`) are the
 * server's own, carried on the payload.
 *
 * Identity scoping is built in from the first line: the booking workspace stays mounted across `/bookings/A` -> `/bookings/B`,
 * so every form carries the `userId:bookingId` it belongs to and every predicate compares it before anything submits.
 */

export type CateringAdjustmentIdentity = string;
export const cateringAdjustmentIdentity = (userId: string, bookingId: string): CateringAdjustmentIdentity => `${userId}:${bookingId}`;

export type CateringAdjustmentForm = {
  identity: CateringAdjustmentIdentity;
  kind: CateringAdjustmentKind;
  /** Major units, as the provider types them. */
  amount: string;
  reason: string;
  /** Refunds only. The empty string is "not tied to one payment". */
  paymentId: string;
  /** Refunds only, provider-only, and not verified by ChefSire. */
  reference: string;
  /** Minted when the form OPENS and kept for its lifetime, so every retry of one attempt is one entry. */
  idempotencyKey: string;
} | null;

export const openCateringAdjustmentForm = (identity: CateringAdjustmentIdentity, kind: CateringAdjustmentKind, idempotencyKey: string): CateringAdjustmentForm =>
  ({ identity, kind, amount: "", reason: "", paymentId: "", reference: "", idempotencyKey });

/** The open form, but only if it belongs to the booking on screen and the provider may still write. */
export function activeCateringAdjustmentForm(form: CateringAdjustmentForm, identity: CateringAdjustmentIdentity, canWrite: boolean): NonNullable<CateringAdjustmentForm> | null {
  return form && form.identity === identity && canWrite ? form : null;
}

export function editCateringAdjustmentForm(form: CateringAdjustmentForm, identity: CateringAdjustmentIdentity, patch: Partial<Pick<NonNullable<CateringAdjustmentForm>, "amount" | "reason" | "paymentId" | "reference">>): CateringAdjustmentForm {
  return form && form.identity === identity ? { ...form, ...patch } : form;
}

export type CateringAdjustmentFormCheck = { ok: true; amountCents: number } | { ok: false; field: "amount" | "reason" | "reference"; message: string };

/**
 * What the form is worth sending. The amount is parsed by the exact decimal parser (never `parseFloat`), must be more than
 * nothing, and may not exceed the limit the SERVER stated for credits and refunds. The server judges all of it again.
 */
export function checkCateringAdjustmentForm(form: NonNullable<CateringAdjustmentForm>, limits: Pick<CateringAdjustmentActions, "maxCreditCents" | "maxRefundCents">): CateringAdjustmentFormCheck {
  const text = form.amount.trim().replace(/^\$/, "").replace(/,/g, "");
  const cents = text === "" ? null : cateringMoneyToCents(text);
  if (cents === null || cents <= 0) return { ok: false, field: "amount", message: "Enter an amount such as 250 or 250.50" };
  if (cents > CATERING_ADJUSTMENT_MAXIMUM_CENTS) return { ok: false, field: "amount", message: "That amount is too large" };
  if (form.kind === "credit" && cents > limits.maxCreditCents) return { ok: false, field: "amount", message: "A credit cannot be more than your customer currently owes." };
  if (form.kind === "refund" && cents > limits.maxRefundCents) return { ok: false, field: "amount", message: "A refund record cannot be more than the money already recorded as received and not yet recorded as returned." };
  const reason = form.reason.trim();
  if (reason === "") return { ok: false, field: "reason", message: "Give your customer a reason. They will see it." };
  if (reason.length > CATERING_ADJUSTMENT_REASON_MAX_LENGTH) return { ok: false, field: "reason", message: `The reason can be at most ${CATERING_ADJUSTMENT_REASON_MAX_LENGTH} characters` };
  if (form.reference.trim().length > CATERING_ADJUSTMENT_REFERENCE_MAX_LENGTH) return { ok: false, field: "reference", message: `Your note can be at most ${CATERING_ADJUSTMENT_REFERENCE_MAX_LENGTH} characters` };
  return { ok: true, amountCents: cents };
}

export const maySubmitCateringAdjustment = (form: NonNullable<CateringAdjustmentForm>, limits: Pick<CateringAdjustmentActions, "maxCreditCents" | "maxRefundCents">, pending: boolean): boolean =>
  !pending && checkCateringAdjustmentForm(form, limits).ok;

/** The request body: cents, an EXPLICIT currency (the booking's own), the kind, the reason and the attempt key. Never an actor. */
export function buildCateringAdjustmentRequest(form: NonNullable<CateringAdjustmentForm>, currency: string, amountCents: number) {
  return {
    kind: form.kind,
    amountCents,
    currency,
    reason: form.reason.trim(),
    ...(form.kind === "refund" && form.paymentId ? { paymentId: form.paymentId } : {}),
    ...(form.kind === "refund" && form.reference.trim() ? { reference: form.reference.trim() } : {}),
    idempotencyKey: form.idempotencyKey,
  };
}

/** The exact entry a request was built from, so a completion settles what it accounts for and nothing else. */
export type CateringAdjustmentSnapshot = { identity: CateringAdjustmentIdentity; kind: CateringAdjustmentKind; amount: string; reason: string; paymentId: string; reference: string; idempotencyKey: string };
export const cateringAdjustmentSnapshot = (form: NonNullable<CateringAdjustmentForm>): CateringAdjustmentSnapshot => ({ ...form });

/**
 * Closes the form ONLY if it is still the entry the response settled. The form stays editable while a request is in flight,
 * so newer edits are kept -- under a FRESH key, because they are a new entry the provider has yet to ask for, not a retry
 * of the one just recorded.
 */
export function settleCateringAdjustmentForm(form: CateringAdjustmentForm, identity: CateringAdjustmentIdentity, submitted: CateringAdjustmentSnapshot, freshKey: string): CateringAdjustmentForm {
  if (!form || form.identity !== identity) return form;
  const same = form.kind === submitted.kind && form.amount === submitted.amount && form.reason === submitted.reason && form.paymentId === submitted.paymentId && form.reference === submitted.reference && form.idempotencyKey === submitted.idempotencyKey;
  return same ? null : { ...form, idempotencyKey: freshKey };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * What the provider confirms
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringAdjustmentConfirmation = { title: string; action: string; lines: { label: string; value: string }[]; effect: string };

/**
 * The confirmation shown BEFORE anything is written: the type, the amount, the currency, the reason the customer will read,
 * and what it will do. A refund is spelled as a RECORD of money returned outside ChefSire, never as a ChefSire action.
 */
export function describeCateringAdjustmentConfirmation(form: NonNullable<CateringAdjustmentForm>, currency: string, amountCents: number): CateringAdjustmentConfirmation {
  const lines = [
    { label: "Type", value: CATERING_ADJUSTMENT_KIND_LABEL[form.kind] },
    { label: "Amount", value: formatCateringMoney(amountCents, currency) },
    { label: "Currency", value: currency },
    { label: "Reason your customer will see", value: form.reason.trim() },
  ];
  if (form.kind === "refund" && form.reference.trim()) lines.push({ label: "Your note (only you can see it)", value: form.reference.trim() });
  return {
    title: form.kind === "refund" ? "Record this refund?" : form.kind === "credit" ? "Add this credit?" : "Add this charge?",
    action: CATERING_ADJUSTMENT_ACTION_LABEL[form.kind],
    lines,
    effect: CATERING_ADJUSTMENT_EFFECT_COPY[form.kind],
  };
}

export function describeCateringReversalConfirmation(entry: Pick<CateringAdjustmentView, "kind" | "amountCents" | "currency" | "reason">): CateringAdjustmentConfirmation {
  const effect = entry.kind === "charge" ? "Your customer will no longer owe this amount. The entry stays in the history, marked as reversed."
    : entry.kind === "credit" ? "Your customer will owe this amount again. The entry stays in the history, marked as reversed."
    : "This stops counting as money returned, so the net amount received goes back up. The entry stays in the history, marked as reversed.";
  return {
    title: "Reverse this entry?",
    action: "Reverse entry",
    lines: [
      { label: "Type", value: CATERING_ADJUSTMENT_KIND_LABEL[entry.kind] },
      { label: "Amount", value: formatCateringMoney(entry.amountCents, entry.currency) },
      { label: "Originally recorded because", value: entry.reason },
    ],
    effect,
  };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Display
 * ------------------------------------------------------------------------------------------------------------- */

/** Oldest first, ties broken by id, so the list is stable across refetches. A reversed entry stays where it was posted. */
export function chronologicalCateringAdjustments(entries: readonly CateringAdjustmentView[]): CateringAdjustmentView[] {
  return [...entries].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

/**
 * The sign and word an entry's amount is shown with. Never colour alone: a charge reads "+", a credit "-", and a refund
 * record is worded as what it is, so a screen reader and a colour-blind reader are told the same thing.
 */
export function cateringAdjustmentAmountText(entry: Pick<CateringAdjustmentView, "kind" | "amountCents" | "currency">): string {
  const money = formatCateringMoney(entry.amountCents, entry.currency);
  return entry.kind === "charge" ? `+${money}` : entry.kind === "credit" ? `-${money}` : money;
}

/**
 * What the entry does, as one sentence for assistive technology and for the row's subtitle.
 *
 * An ACTIVE entry says what it does now. A REVERSED entry says only that it was reversed and what it no longer does: it is
 * never given the active wording as well, which would read as a contradiction. Reversing a refund reverses ChefSire's RECORD
 * of it -- the external money movement is not something ChefSire can undo, and the copy does not suggest otherwise.
 */
export function cateringAdjustmentEffectSentence(entry: Pick<CateringAdjustmentView, "kind" | "amountCents" | "currency" | "status">, role: "provider" | "customer"): string {
  const money = formatCateringMoney(entry.amountCents, entry.currency);
  if (entry.status === "reversed") {
    return entry.kind === "charge" ? `This ${money} charge was reversed and no longer increases the amount owed.`
      : entry.kind === "credit" ? `This ${money} credit was reversed and no longer reduces the amount owed.`
      : `This ${money} external refund record was reversed and no longer counts toward recorded refunds. ChefSire reversed its record only; it did not move any money.`;
  }
  const who = role === "provider" ? "You" : "Your caterer";
  return entry.kind === "charge" ? `${role === "provider" ? "Your customer owes" : "You owe"} ${money} more.`
    : entry.kind === "credit" ? `What ${role === "provider" ? "your customer owes" : "you owe"} is reduced by ${money}. This does not mean money was returned.`
    : `${who} recorded ${money} as returned outside ChefSire. ChefSire did not send it.`;
}

export const cateringAdjustmentSourceText = (entry: Pick<CateringAdjustmentView, "source" | "amendmentNumber">): string | null =>
  entry.source === "amendment" ? (entry.amendmentNumber ? `From accepted amendment ${entry.amendmentNumber}` : "From an accepted amendment") : null;

/* ------------------------------------------------------------------------------------------------------------- *
 * Cache
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Everything a financial write can change on screen, and nothing else. Every key carries the acting user's id; another
 * user's cache is never named and the whole cache is never cleared.
 *
 *  - the billing view, which carries the ledger and the summary;
 *  - the booking workspace, which embeds billing in its activity and header;
 *  - the amendments projection, because the first ledger entry flips its `billingTermsLocked` (currency locks).
 *
 * Booking LISTS are deliberately absent: they show no balance or financial status, so there is nothing in them to refresh.
 */
export function cateringAdjustmentInvalidationKeys(input: { surfaceUserId: string; bookingId: string }): (readonly string[])[] {
  return [
    cateringBookingBillingKey(input.surfaceUserId, input.bookingId),
    cateringBookingWorkspaceKey(input.surfaceUserId, input.bookingId),
    cateringAmendmentsKey(input.surfaceUserId, input.bookingId),
  ];
}

/** A response belongs on screen only if the user and booking it was sent for are still the ones being shown. */
export const isCurrentCateringAdjustmentTarget = (shown: CateringAdjustmentIdentity, submitted: CateringAdjustmentIdentity): boolean => shown === submitted;
