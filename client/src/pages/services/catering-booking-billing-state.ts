import {
  CATERING_BILLING_STATE_CODE,
  CATERING_BILLING_NOT_AVAILABLE_CODE,
  CATERING_BILLING_VERSION_CONFLICT_CODE,
  CATERING_BILLING_VERSION_CONFLICT_MESSAGE,
  cateringMoneyToCents,
  cateringPercentToBasisPoints,
  type CateringDepositMode,
  type CateringInvoiceView,
  type CateringPaymentMethod,
} from "@shared/catering-booking-billing";

/**
 * The pure state the Phase 2L billing section is built from.
 *
 * Every function here is total in its arguments. No React, no fetch, no clock -- and, deliberately, NO MONEY
 * ARITHMETIC: not one total on this client is computed here. Amounts arrive already derived from the authoritative
 * ledger, and the only figure this file turns into a number is the one the provider types into the payment form,
 * which the server then bounds against what the invoice actually has left before it is credited to anything.
 *
 * Identity scoping is built in from the first line, exactly as Phases 2J and 2K learned to do it: the booking
 * workspace stays MOUNTED across `/bookings/A` -> `/bookings/B`, so every piece of state here carries the
 * `userId:bookingId` it belongs to and every predicate compares it before letting anything render or submit.
 */

export type CateringBillingError = { message: string; code?: string; offline?: boolean; unreadable?: boolean };

/** A refused optimistic-concurrency precondition: reload the newer record rather than retrying the same one. */
export function isCateringBillingConflict(error: CateringBillingError | null | undefined): boolean {
  return error?.code === CATERING_BILLING_VERSION_CONFLICT_CODE;
}
/** A refusal about what the billing state permits -- the view on screen no longer describes the server. */
export function isCateringBillingStateRefusal(error: CateringBillingError | null | undefined): boolean {
  return error?.code === CATERING_BILLING_STATE_CODE || error?.code === CATERING_BILLING_NOT_AVAILABLE_CODE;
}

/**
 * Whether the authoritative view must be re-read after a refusal.
 *
 * A conflict and a state refusal both describe a server this client's copy no longer matches. A transport failure
 * deliberately does NOT refetch: the write may have been applied and its response lost, and a refetch on a
 * connection that just failed is likely to fail too.
 */
export function shouldRefetchBillingAfterError(error: CateringBillingError | null | undefined): boolean {
  if (!error || error.offline) return false;
  return isCateringBillingConflict(error) || isCateringBillingStateRefusal(error);
}

/**
 * What the provider is told about a failed write, and whether retrying is the right response.
 *
 * A lost or unreadable response is retryable and keeps the draft, and says so plainly: recording a payment is
 * idempotent by the key the form carries, so trying again cannot credit the money twice.
 */
export function cateringBillingFailureNotice(error: CateringBillingError): { message: string; retryable: boolean } {
  if (error.unreadable) return { message: "ChefSire's answer could not be read, so this may not have saved. Trying again is safe.", retryable: true };
  if (error.offline) return { message: "We could not reach ChefSire. Your entries are still here -- try again.", retryable: true };
  if (isCateringBillingConflict(error)) return { message: CATERING_BILLING_VERSION_CONFLICT_MESSAGE, retryable: false };
  return { message: error.message || "This billing change could not be saved", retryable: !error.code };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Identity-scoped local state
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringBillingIdentity = string;
export const cateringBillingIdentity = (userId: string, bookingId: string): CateringBillingIdentity => `${userId}:${bookingId}`;

/** The deposit-terms form, carrying the booking it belongs to and the version its values were hydrated from. */
export type CateringTermsForm = {
  identity: CateringBillingIdentity;
  mode: CateringDepositMode;
  amount: string;
  percent: string;
  dueOn: string;
  /** The authoritative `updatedAt` these values were hydrated from, or null before any terms row existed. */
  baseVersion: string | null;
  dirty: boolean;
  conflicted: boolean;
};

export const emptyCateringTermsForm = (): CateringTermsForm =>
  ({ identity: "", mode: "none", amount: "", percent: "", dueOn: "", baseVersion: null, dirty: false, conflicted: false });

/**
 * Hydrates the terms form from the authoritative payload, unless the provider has unsaved edits.
 *
 * The same four cases Phase 2K settled on, and for the same reasons. Another booking's form is REPLACED wholesale.
 * A clean form takes both the values and the version. A DIRTY one keeps both, so a draft written against V1 cannot
 * claim to have been based on the V2 another tab just wrote. A CONFLICTED one is returned completely untouched --
 * a poll is not a resolution, and only the explicit reload is.
 */
export function hydrateCateringTermsForm(
  current: CateringTermsForm,
  identity: CateringBillingIdentity,
  next: { mode: CateringDepositMode; amount: string; percent: string; dueOn: string },
  nextVersion: string | null,
): CateringTermsForm {
  if (current.identity !== identity) return { identity, ...next, baseVersion: nextVersion, dirty: false, conflicted: false };
  if (current.conflicted || current.dirty) return current;
  return { ...current, ...next, baseVersion: nextVersion };
}

/**
 * An ordinary local edit. It marks the form dirty and does NOT clear a conflict.
 *
 * Typing is not a resolution: an edit leaves `baseVersion` exactly where it was, so clearing the flag would
 * re-enable Save against the very version the server just refused and hide the reload that is the way out.
 */
export function editCateringTermsForm(current: CateringTermsForm, patch: Partial<Pick<CateringTermsForm, "mode" | "amount" | "percent" | "dueOn">>): CateringTermsForm {
  return { ...current, ...patch, dirty: true };
}
export function markCateringTermsConflict(current: CateringTermsForm): CateringTermsForm {
  return { ...current, dirty: true, conflicted: true };
}
/** The explicit escape from a conflict: take the authoritative terms, discarding this draft. */
export function reloadCateringTermsForm(
  identity: CateringBillingIdentity,
  authoritative: { mode: CateringDepositMode; amount: string; percent: string; dueOn: string },
  version: string | null,
): CateringTermsForm {
  return { identity, ...authoritative, baseVersion: version, dirty: false, conflicted: false };
}
/** After an accepted save the form settles onto exactly what was submitted, keeping anything typed since. */
export function settleCateringTermsForm(
  current: CateringTermsForm,
  identity: CateringBillingIdentity,
  submitted: { mode: CateringDepositMode; amount: string; percent: string; dueOn: string },
  version: string | null,
): CateringTermsForm {
  if (current.identity !== identity) return current;
  const moved = current.mode !== submitted.mode || current.amount !== submitted.amount
    || current.percent !== submitted.percent || current.dueOn !== submitted.dueOn;
  // Newer entries typed while the request was in flight are kept, and the version DOES advance, because this
  // form's own save produced it -- which is what lets the very next save succeed instead of conflicting.
  if (moved) return { ...current, baseVersion: version };
  return { identity, ...submitted, baseVersion: version, dirty: false, conflicted: false };
}

/** Whether the terms form belongs to the booking on screen. Read on the RENDER path, like every other guard here. */
export function cateringTermsFormIsCurrent(form: CateringTermsForm, identity: CateringBillingIdentity): boolean {
  return form.identity === identity;
}

/**
 * Whether the terms form may be submitted right now.
 *
 * The values have to be usable as well as owned: a fixed deposit needs a parsable amount and a percentage needs a
 * parsable percentage. This is a courtesy so the provider is not sent to the server to be told what the form could
 * have told them -- the server validates all of it again, against the booking's own agreed price, under the lock.
 */
export function maySubmitCateringTerms(form: CateringTermsForm, identity: CateringBillingIdentity, actionable: boolean, pending: boolean): boolean {
  if (!actionable || pending || form.conflicted || !cateringTermsFormIsCurrent(form, identity)) return false;
  if (form.mode === "fixed") return cateringMoneyToCents(form.amount) !== null;
  if (form.mode === "percentage") return cateringPercentToBasisPoints(form.percent) !== null;
  return true;
}
export function mayReloadCateringTerms(form: CateringTermsForm, identity: CateringBillingIdentity): boolean {
  return form.conflicted && cateringTermsFormIsCurrent(form, identity);
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The payment form
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * The open "record a payment" form for ONE invoice.
 *
 * `idempotencyKey` is minted when the form OPENS and kept for the life of that form, which is what makes a
 * double-click, a browser retry and a retry after a lost response all the same attempt: the server finds the
 * payment the first one created and credits nothing further. It is deliberately not re-minted on retry -- a fresh
 * key on every attempt would be no protection at all.
 */
export type CateringPaymentForm = {
  identity: CateringBillingIdentity;
  invoiceId: string;
  amount: string;
  method: CateringPaymentMethod;
  receivedOn: string;
  reference: string;
  idempotencyKey: string;
} | null;

export function openCateringPaymentForm(
  identity: CateringBillingIdentity,
  invoice: CateringInvoiceView,
  today: string,
  idempotencyKey: string,
): NonNullable<CateringPaymentForm> {
  return {
    identity,
    invoiceId: invoice.id,
    // Prefilled with what is actually left on the invoice, from the server's own figure -- not computed here.
    amount: cateringMajorUnits(invoice.remainingCents),
    method: "bank_transfer",
    receivedOn: today,
    reference: "",
    idempotencyKey,
  };
}

export function editCateringPaymentForm(form: CateringPaymentForm, identity: CateringBillingIdentity, patch: Partial<Omit<NonNullable<CateringPaymentForm>, "identity" | "invoiceId" | "idempotencyKey">>): CateringPaymentForm {
  if (!form || form.identity !== identity) return form;
  return { ...form, ...patch };
}

/**
 * The EXACT entry a request was built from, captured at submit time.
 *
 * Everything that decides what the payment is, plus the key that identifies the attempt. It travels on the mutation
 * so the completion can be settled against what was actually sent rather than against whatever is on screen when
 * the response lands -- which, on a form that deliberately stays editable, need not be the same thing at all.
 */
export type CateringPaymentSnapshot = {
  invoiceId: string;
  amount: string;
  method: CateringPaymentMethod;
  receivedOn: string;
  reference: string;
  idempotencyKey: string;
};

export function cateringPaymentSnapshot(form: NonNullable<CateringPaymentForm>): CateringPaymentSnapshot {
  return {
    invoiceId: form.invoiceId, amount: form.amount, method: form.method,
    receivedOn: form.receivedOn, reference: form.reference, idempotencyKey: form.idempotencyKey,
  };
}

/** Whether the form on screen is still, field for field, the entry that was submitted. */
export function cateringPaymentFormMatches(form: NonNullable<CateringPaymentForm>, submitted: CateringPaymentSnapshot): boolean {
  // Compared as TYPED, not as parsed money: "100" and "100.00" are the same amount but not the same entry, and the
  // only cost of treating them as different is that the form stays open -- which is the safe direction.
  return form.invoiceId === submitted.invoiceId
    && form.amount === submitted.amount
    && form.method === submitted.method
    && form.receivedOn === submitted.receivedOn
    && form.reference === submitted.reference;
}

/**
 * Settles the payment form against the EXACT entry the accepted response was for.
 *
 * The form stays editable while a save is in flight, deliberately: a provider on a venue car park should not be
 * frozen out of correcting a figure. But closing it unconditionally on success threw away whatever they had typed
 * since, and did it in the one way that reads as confirmation -- the form vanishes, the history refreshes, and a
 * correction that was never sent looks like the thing that was recorded.
 *
 * So a success may close only the entry it actually settled:
 *
 *  - ANOTHER BOOKING's form is returned untouched. A response for booking A must never close, rotate or disturb
 *    booking B's entry, and this is the render-path guard applied to the settlement path.
 *  - A DIFFERENT ATTEMPT -- a form the provider has already closed and reopened, carrying its own key -- is
 *    returned untouched too. That entry was never submitted, so this response has nothing to say about it.
 *  - THE SAME ENTRY, unchanged: closed. This is the ordinary case.
 *  - THE SAME ENTRY, edited since: KEPT, with every edit intact, and given a FRESH KEY.
 *
 * The key rotation is what keeps the previous correction honest. The old key now belongs to a payment the server
 * has recorded, so submitting the edited values under it would be a replay with a changed payload -- refused as a
 * conflict, correctly but uselessly, because this is not a retry of that payment at all. It is a new entry the
 * provider has yet to ask for. A fresh key says so, and nothing is resubmitted on their behalf.
 */
export function settleCateringPaymentForm(
  form: CateringPaymentForm,
  identity: CateringBillingIdentity,
  submitted: CateringPaymentSnapshot,
  freshKey: string,
): CateringPaymentForm {
  if (!form || form.identity !== identity) return form;
  if (form.idempotencyKey !== submitted.idempotencyKey) return form;
  if (cateringPaymentFormMatches(form, submitted)) return null;
  return { ...form, idempotencyKey: freshKey };
}

/**
 * The open form, or null. Refuses on identity FIRST, which is what stops booking A's half-filled payment form
 * rendering under booking B for the one committed render before a passive reset effect has flushed.
 */
export function activeCateringPaymentForm(form: CateringPaymentForm, identity: CateringBillingIdentity, actionable: boolean): NonNullable<CateringPaymentForm> | null {
  if (!actionable || !form || form.identity !== identity) return null;
  return form;
}

/**
 * Whether the payment form may be submitted.
 *
 * The amount has to parse and be at most what the invoice has left -- the server's own `remainingCents`, not a
 * figure this client worked out. The server checks it again from the ledger under the lock, so this is the form
 * being honest with the provider rather than the client being trusted.
 */
export function maySubmitCateringPayment(
  form: NonNullable<CateringPaymentForm>,
  invoice: CateringInvoiceView | undefined,
  pending: boolean,
): boolean {
  if (pending || !invoice || invoice.id !== form.invoiceId) return false;
  if (invoice.state !== "issued" && invoice.state !== "partially_paid") return false;
  const cents = cateringMoneyToCents(form.amount);
  if (cents === null || cents <= 0 || cents > invoice.remainingCents) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(form.receivedOn);
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Presentation helpers
 * ------------------------------------------------------------------------------------------------------------- */

/** Cents to the major-unit string a form field holds. Integer arithmetic; never `cents / 100` into a float field. */
export function cateringMajorUnits(cents: number): string {
  const whole = Math.floor(cents / 100);
  return `${whole}.${String(cents - whole * 100).padStart(2, "0")}`;
}

/**
 * What a payment is CALLED, wherever it is shown.
 *
 * ChefSire took no catering money, so nothing here says a bare "Paid" about a payment: a provider-recorded payment
 * is exactly that, and the customer is told whose record it is. `processor` is unreachable today -- no code path
 * writes one -- and is handled so that the day one exists it reads truthfully rather than falling through to a
 * word chosen for a different kind of fact.
 */
export function cateringPaymentProvenance(source: string, role: "provider" | "customer"): string {
  if (source === "processor") return "Paid through ChefSire";
  return role === "provider" ? "Recorded by you" : "Recorded by your caterer";
}

/** Whether a booking's billing can still change, which is what the section's polling is gated on. */
export function cateringBillingCanStillChange(status: string | undefined): boolean {
  return status !== undefined && status !== "cancelled";
}
