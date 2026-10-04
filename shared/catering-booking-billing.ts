import { z } from "zod";
import { calendarDateSchema } from "./catering-availability";
import { cateringBookingWorkspacePath } from "./catering-booking-operations";
import type { CateringBookingStatus } from "./catering-bookings";
import { CATERING_INVOICE_MAXIMUM_CENTS, deriveCateringLedgerPosition, type CateringAdjustmentFact, type CateringAdjustmentView, type CateringAdjustmentActions } from "./catering-billing-adjustments";

/**
 * PHASE 2L -- THE CATERING BILLING CONTRACT.
 *
 * One place where the server, the client and the tests agree on what a catering booking's money means. There is no
 * React, no fetch, no database and no clock in this file, which is what lets every rule below be tested exactly as
 * both sides will run it.
 *
 * WHAT THIS PHASE IS, STATED HONESTLY AT THE TOP.
 *
 * The architecture audit found ChefSire's only working payment processor path to be Square, reached through
 * `server/lib/square.ts` and used by drinks collection checkout: a payment link, a checkout session row, and a
 * webhook whose signature is verified, whose event ids are deduplicated, and whose amount, currency and ownership
 * are checked against the session before anything is granted. That path charges into the PLATFORM's own single
 * Square location, which is right for a product ChefSire itself sells.
 *
 * Catering is not that. The caterer is the seller, and money owed to them cannot be taken into the platform's
 * account without a payout path back out. `server/routes/payouts.ts` is that path in name only: it is written
 * against `square.Client`, which does not exist in the installed SDK, no provider Square identity is persisted
 * anywhere, and no client code calls it. So this phase moves NO money and pretends to move none.
 *
 * What it does instead is make the money that already changes hands outside ChefSire truthful and auditable:
 *
 *  - the provider states their deposit terms;
 *  - the provider issues a deposit invoice and, later, a final balance invoice, both for amounts this file derives
 *    from the booking's own agreed price rather than from anything a client sends;
 *  - the provider RECORDS payments they have actually received, attributed and dated;
 *  - both parties read one derived summary of what is owed, what is paid and what remains.
 *
 * Every customer-facing word for a recorded payment says who recorded it. A payment in this system is a caterer's
 * receipt, not a ChefSire charge, and the copy at the bottom of this file never lets those read as the same thing.
 * The customer is given no payment button, because there is nothing behind one.
 *
 * The processor seam is left open deliberately and narrowly: `catering_booking_payments` carries `processor` and
 * `processor_payment_id` columns, null today and uniquely indexed, so a later phase can add processor-backed
 * payments as new rows in the same ledger without a second source of financial truth to reconcile.
 */

/* ------------------------------------------------------------------------------------------------------------- *
 * Money
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Authoritative money is INTEGER MINOR UNITS, everywhere in Phase 2L.
 *
 * `catering_bookings.agreed_price` is `decimal(12, 2)`, which Drizzle hands back as a STRING -- exact, but awkward
 * to add up, and one `Number()` away from the floating-point rounding this phase may never have. So it is parsed
 * once, by the exact string parser below, and every amount this phase stores, sums, compares and sends is an
 * integer number of cents. That also matches the money representation the Square path already uses, so a later
 * processor integration needs no conversion layer of its own.
 */
export const CATERING_BILLING_MINOR_UNITS = 100;
/** A hard ceiling, well inside `Number.MAX_SAFE_INTEGER` and inside `decimal(12, 2)`. */
export const CATERING_BILLING_MAXIMUM_CENTS = CATERING_INVOICE_MAXIMUM_CENTS;

/**
 * `decimal(12, 2)` as it arrives from the database, converted to cents WITHOUT floating point.
 *
 * Rejects anything that is not a plain non-negative decimal with at most two fractional digits, and returns null
 * rather than guessing. A booking with no agreed price is a real state -- `agreed_price` is nullable and nothing
 * ever updates it -- so null flows through the derivation as "not configured", never as zero.
 */
export function cateringMoneyToCents(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    // Only an exact integer number of major units is accepted from a number; anything else may already have lost
    // precision before it reached this function, and guessing at its intent is how rounding errors become money.
    return Number.isSafeInteger(value) && value >= 0 ? value * CATERING_BILLING_MINOR_UNITS : null;
  }
  if (typeof value !== "string") return null;
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * CATERING_BILLING_MINOR_UNITS + Number(`${match[2] ?? ""}00`.slice(0, 2));
  return Number.isSafeInteger(cents) && cents <= CATERING_BILLING_MAXIMUM_CENTS ? cents : null;
}

/** Cents back to the `decimal(12, 2)` spelling, for anything that has to compare against the booking's own column. */
export function cateringCentsToDecimal(cents: number): string {
  const whole = Math.floor(cents / CATERING_BILLING_MINOR_UNITS);
  return `${whole}.${String(cents - whole * CATERING_BILLING_MINOR_UNITS).padStart(2, "0")}`;
}

/**
 * A currency-aware rendering of an amount in cents.
 *
 * `Intl` is given the currency the booking itself carries, never a hardcoded dollar sign, and an unrecognized code
 * falls back to `CODE 1,234.56` rather than throwing inside a render. Two fractional digits are assumed throughout
 * Phase 2L because `agreed_price` is `decimal(12, 2)`: the whole existing catering model already assumes them, and
 * inventing per-currency minor units here would make this phase disagree with the price it is billing.
 */
export function formatCateringMoney(cents: number, currency: string): string {
  const major = cents / CATERING_BILLING_MINOR_UNITS;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/** Percentages are stored in BASIS POINTS, so a half-percent deposit is exact and no fraction is ever persisted. */
export const CATERING_BILLING_BASIS_POINTS = 10_000;

/**
 * A percentage of an amount, rounded HALF UP to the nearest cent, with integer arithmetic only.
 *
 * Half up rather than banker's rounding because a deposit is quoted to a customer and has to match what any
 * calculator they reach for will say. The result is capped by the caller, not here.
 */
export function cateringPercentageOfCents(cents: number, basisPoints: number): number {
  return Math.floor((cents * basisPoints + CATERING_BILLING_BASIS_POINTS / 2) / CATERING_BILLING_BASIS_POINTS);
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Enumerations
 * ------------------------------------------------------------------------------------------------------------- */

/** How a deposit is expressed. `none` is a real, explicit answer: this caterer asks for no deposit. */
export const CATERING_DEPOSIT_MODES = ["none", "fixed", "percentage"] as const;
export type CateringDepositMode = typeof CATERING_DEPOSIT_MODES[number];

/**
 * The invoices a catering booking can have: the deposit, the balance, and (Phase 2P) a request for payment of what was
 * ADDED afterwards.
 *
 * Phase 2L deliberately had no third kind. `agreed_price` was written once, when the booking was created from the
 * provider's accepted offer, and nothing ever updated it, so an invoice beyond that price would have been a charge with
 * no agreement behind it. Phase 2O added the agreement (an accepted amendment) and Phase 2P the ledger that records it,
 * so there is now something for an `adjustment` request to be FOR: it is issued only for the headroom the current
 * obligation has over the live invoices, never edits an earlier invoice, and exists because a balance that is already
 * live cannot be re-issued for a larger amount.
 */
export const CATERING_INVOICE_KINDS = ["deposit", "balance", "adjustment"] as const;
export type CateringInvoiceKind = typeof CATERING_INVOICE_KINDS[number];

/**
 * What is PERSISTED about an invoice. Three values, none of them derivable from anything else.
 *
 * `paid`, `partially_paid` and `overdue` are absent on purpose. They are functions of the payment ledger and the
 * current date, and storing them would create a second copy of the truth that a lost update could leave disagreeing
 * with the payments themselves. They are derived instead, in `cateringInvoiceState` below.
 */
export const CATERING_INVOICE_STATUSES = ["draft", "issued", "void"] as const;
export type CateringInvoiceStatus = typeof CATERING_INVOICE_STATUSES[number];

/** What an invoice IS right now, derived from its status, its payments and the billing day it is judged on. */
export const CATERING_INVOICE_STATES = ["draft", "issued", "partially_paid", "paid", "void"] as const;
export type CateringInvoiceState = typeof CATERING_INVOICE_STATES[number];

/**
 * How the caterer received a payment they are recording.
 *
 * Every one of these is something that happened OUTSIDE ChefSire. There is no `chefsire` or `online` value, because
 * this phase processes nothing, and offering one would be the first lie in the ledger.
 */
export const CATERING_PAYMENT_METHODS = ["cash", "bank_transfer", "card_in_person", "cheque", "other"] as const;
export type CateringPaymentMethod = typeof CATERING_PAYMENT_METHODS[number];

/**
 * Where the knowledge of a payment came from.
 *
 * `provider_recorded` is the only value this phase writes, and it is what every customer-facing string about a
 * payment is worded from. `processor` exists in the allowlist so the column, the CHECK constraint and the client's
 * exhaustive handling are already in place when a processor-backed payment is added: such a row will be written by
 * a verified webhook and by nothing else.
 */
export const CATERING_PAYMENT_SOURCES = ["provider_recorded", "processor"] as const;
export type CateringPaymentSource = typeof CATERING_PAYMENT_SOURCES[number];

/** A recorded payment counts; a voided one is kept for audit and counts for nothing. */
export const CATERING_PAYMENT_STATUSES = ["recorded", "voided"] as const;
export type CateringPaymentStatus = typeof CATERING_PAYMENT_STATUSES[number];

/**
 * Where a booking stands financially. FIVE values, and none of them is a booking status.
 *
 * Phase 2G owns `pending_confirmation`, `confirmed`, `cancelled` and `completed`, and this phase writes to
 * `catering_bookings` never. A booking is routinely `confirmed` while its financial status is `deposit_due`; those
 * are two independent facts about the same event and collapsing them would make one domain unable to describe a
 * state the other permits.
 */
export const CATERING_FINANCIAL_STATUSES = ["not_configured", "no_payment_required", "not_invoiced", "no_active_invoice", "deposit_due", "balance_not_requested", "balance_due", "settled"] as const;
export type CateringFinancialStatus = typeof CATERING_FINANCIAL_STATUSES[number];

/* ------------------------------------------------------------------------------------------------------------- *
 * Facts, as the server reads them
 * ------------------------------------------------------------------------------------------------------------- */

/** The deposit terms a provider has configured, or the absence of any. */
export type CateringDepositTerms = {
  mode: CateringDepositMode;
  /** Cents, for `fixed`. Null for every other mode. */
  amountCents: number | null;
  /** Basis points, for `percentage`. Null for every other mode. */
  percentBasisPoints: number | null;
  /** Date-only, in the booking's own calendar, exactly as `catering_bookings.event_date` is. */
  dueOn: string | null;
};

export const EMPTY_CATERING_DEPOSIT_TERMS: CateringDepositTerms = { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null };

export type CateringInvoiceFact = {
  id: string;
  number: number;
  kind: CateringInvoiceKind;
  amountCents: number;
  currency: string;
  status: CateringInvoiceStatus;
  dueOn: string | null;
  issuedAt: string | null;
};

export type CateringPaymentFact = {
  id: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  method: CateringPaymentMethod;
  source: CateringPaymentSource;
  status: CateringPaymentStatus;
  receivedOn: string;
};

export type CateringBillingFacts = {
  bookingStatus: CateringBookingStatus;
  /** Null when the booking carries no agreed price at all, which is a state the schema permits. */
  agreedTotalCents: number | null;
  currency: string;
  terms: CateringDepositTerms;
  invoices: readonly CateringInvoiceFact[];
  payments: readonly CateringPaymentFact[];
  /**
   * The Phase 2P adjustment ledger. Optional because a booking that predates it has none, and an absent list is exactly
   * an empty one: every figure below then equals what Phase 2L derived, with no adjustment row fabricated.
   */
  adjustments?: readonly CateringAdjustmentFact[];
  /**
   * The billing day, date-only, resolved by the SERVER from the provider's own calendar and passed in.
   *
   * A plain `YYYY-MM-DD`, which is what keeps everything in this file timezone-agnostic: it compares two date
   * strings and knows nothing about zones, offsets or clocks. Where that string comes from is the server's
   * business -- see `cateringBillingDay` -- and it is never the browser's.
   */
  asOfDate: string;
};

/* ------------------------------------------------------------------------------------------------------------- *
 * Derivation
 * ------------------------------------------------------------------------------------------------------------- */

/** A payment counts towards a total only while it is recorded. Voiding is the only way to take one back. */
export function cateringPaymentCounts(payment: CateringPaymentFact): boolean {
  return payment.status === "recorded";
}
/** An invoice counts towards what has been billed only once it is issued and not voided. A draft asks for nothing. */
export function cateringInvoiceCounts(invoice: CateringInvoiceFact): boolean {
  return invoice.status === "issued";
}

export function cateringPaidTowards(invoiceId: string, payments: readonly CateringPaymentFact[]): number {
  return payments.reduce((total, payment) => (payment.invoiceId === invoiceId && cateringPaymentCounts(payment) ? total + payment.amountCents : total), 0);
}

/**
 * What an invoice IS, from its own status and the ledger. Never stored -- see `CATERING_INVOICE_STATUSES`.
 *
 * `paid` requires the credited total to REACH the amount, so a part payment reads as `partially_paid` and the
 * remainder stays visible to both parties. It can never be reached by anything except recorded payments, which is
 * the whole point of not persisting it.
 */
export function cateringInvoiceState(invoice: CateringInvoiceFact, payments: readonly CateringPaymentFact[]): CateringInvoiceState {
  if (invoice.status === "void") return "void";
  if (invoice.status === "draft") return "draft";
  const paid = cateringPaidTowards(invoice.id, payments);
  if (paid >= invoice.amountCents) return "paid";
  return paid > 0 ? "partially_paid" : "issued";
}

/**
 * Whether an invoice is past its due date, compared DATE-ONLY against the billing day it is given.
 *
 * Due dates are dates, not instants: a caterer who says "deposit due on the 14th" means the day where THEY are,
 * and it must not turn red while it is still the 14th for them. Both sides of this comparison are `YYYY-MM-DD`
 * strings resolved by the server from the provider's own calendar, so the answer is the same on every device and
 * the same for both participants.
 */
export function cateringInvoiceIsOverdue(invoice: CateringInvoiceFact, payments: readonly CateringPaymentFact[], asOfDate: string): boolean {
  if (!invoice.dueOn) return false;
  const state = cateringInvoiceState(invoice, payments);
  if (state !== "issued" && state !== "partially_paid") return false;
  return invoice.dueOn < asOfDate;
}

/**
 * The deposit this booking's terms actually require, in cents, or null if it cannot be stated.
 *
 * A percentage of an unknown total is unknowable, so a booking with no agreed price yields null rather than zero.
 * A fixed deposit is capped at the agreed total, because a deposit larger than the whole job is not a deposit.
 */
export function cateringDepositRequirement(terms: CateringDepositTerms, agreedTotalCents: number | null): number | null {
  if (terms.mode === "none") return null;
  if (terms.mode === "fixed") {
    if (terms.amountCents === null) return null;
    return agreedTotalCents === null ? terms.amountCents : Math.min(terms.amountCents, agreedTotalCents);
  }
  if (terms.percentBasisPoints === null || agreedTotalCents === null) return null;
  return Math.min(cateringPercentageOfCents(agreedTotalCents, terms.percentBasisPoints), agreedTotalCents);
}

/**
 * ONE canonical financial summary, derived here and nowhere else.
 *
 * Every total below is a sum over authoritative rows. Nothing is persisted twice, no component recomputes money of
 * its own, and no number a client sends is ever an input -- the request bodies in this phase carry no amounts at
 * all for invoices, and the one amount a payment does carry is bounded against these same derived values on the
 * server, under the booking's advisory lock.
 */
export type CateringBillingSummary = {
  currency: string;
  agreedTotalCents: number | null;
  /** Issued, non-void invoices only. What the customer has actually been asked for. */
  invoicedTotalCents: number;
  paidTotalCents: number;
  /** Issued minus paid, floored at zero: what is on the table right now. */
  outstandingInvoicedCents: number;
  /**
   * Agreed price minus payments, floored at zero: what remains of the AGREEMENT. Charges, credits and refunds do not move it
   * (so it can never exceed the agreed total); the amount actually due after them is `balanceDueCents`. Null without an agreed price.
   */
  remainingOfAgreedCents: number | null;
  /** Agreed minus invoiced, floored at zero: what the provider has still to bill. Null without an agreed price. */
  uninvoicedCents: number | null;
  depositRequiredCents: number | null;
  depositPaidCents: number;
  /** The oldest unsettled issued invoice, which is what both parties are told about next. */
  nextAmountDueCents: number | null;
  nextDueOn: string | null;
  nextDueIsOverdue: boolean;
  status: CateringFinancialStatus;
  /** True when ANY issued invoice is past its due date. Derived from the server date, never the browser's. */
  hasOverdue: boolean;
  /**
   * PHASE 2P. The agreed price before any amendment that was reconciled into the ledger, and what is owed now:
   * `agreed + provider charges - provider credits`. Equal to `agreedTotalCents` on a booking with no adjustments.
   * `originalAgreedCents` is the agreed price when billing began (see the ledger position), not the booking's first confirmed terms.
   */
  originalAgreedCents: number | null;
  obligationCents: number | null;
  adjustmentChargesCents: number;
  adjustmentCreditsCents: number;
  /** Recorded refunds: money the caterer says they returned OUTSIDE ChefSire. Not a credit and not a ChefSire action. */
  refundsRecordedCents: number;
  /** Payments recorded less refunds recorded. */
  netReceivedCents: number;
  /** Obligation less net received, floored at zero. Null without an agreed price. */
  balanceDueCents: number | null;
  /** Net received above the obligation. A prompt that a refund may be due, never a statement that one happened. */
  refundPotentiallyDueCents: number;
};

/**
 * What each live, unpaid request is ACTUALLY asking for right now, by invoice id.
 *
 * An invoice's raw remainder is a historical fact about that request; what the customer currently owes is the booking's
 * balance due, which credits can take below the sum of the raw remainders (and to zero). The balance is applied to the
 * requests oldest first, so a request is only "currently payable" for the part of the balance that reaches it. A request
 * left at zero stays visible and unpaid in the history -- it is never mutated -- but it asks for nothing and so can never
 * be overdue. With no adjustments the balance always covers every remainder, so each request's figure is its raw remainder
 * and nothing changes for a booking that predates Phase 2P.
 */
export function cateringEffectivePayables(live: readonly CateringInvoiceFact[], payments: readonly CateringPaymentFact[], balanceDueCents: number | null): Map<string, number> {
  const effective = new Map<string, number>();
  let available = balanceDueCents;
  for (const invoice of [...live].sort((left, right) => left.number - right.number)) {
    const remaining = Math.max(0, invoice.amountCents - cateringPaidTowards(invoice.id, payments));
    const asked = available === null ? remaining : Math.min(remaining, available);
    if (available !== null) available -= asked;
    effective.set(invoice.id, asked);
  }
  return effective;
}

/** One invoice's effective payable amount for a set of facts. Zero when it is paid, not live, or the balance no longer reaches it. */
export function cateringEffectivePayableCents(invoice: CateringInvoiceFact, facts: CateringBillingFacts): number {
  const summaryLedger = deriveCateringLedgerPosition({
    agreedTotalCents: facts.agreedTotalCents,
    paidTotalCents: facts.payments.reduce((total, payment) => (cateringPaymentCounts(payment) ? total + payment.amountCents : total), 0),
    adjustments: facts.adjustments ?? [],
  });
  return cateringEffectivePayables(facts.invoices.filter(cateringInvoiceCounts), facts.payments, summaryLedger.balanceDueCents).get(invoice.id) ?? 0;
}

export function deriveCateringBillingSummary(facts: CateringBillingFacts): CateringBillingSummary {
  const live = facts.invoices.filter(cateringInvoiceCounts);
  const invoicedTotalCents = live.reduce((total, invoice) => total + invoice.amountCents, 0);
  const paidTotalCents = facts.payments.reduce((total, payment) => (cateringPaymentCounts(payment) ? total + payment.amountCents : total), 0);
  const deposit = live.find((invoice) => invoice.kind === "deposit");
  const depositPaidCents = deposit ? cateringPaidTowards(deposit.id, facts.payments) : 0;
  const ledger = deriveCateringLedgerPosition({ agreedTotalCents: facts.agreedTotalCents, paidTotalCents, adjustments: facts.adjustments ?? [] });
  const obligationCents = ledger.obligationCents;

  // The next thing owed: the oldest live invoice that is CURRENTLY asking for something, ordered by its own number so the
  // deposit precedes the balance whatever order the rows come back in. A request the balance no longer reaches (a credit
  // took it to zero) is history, not "next".
  const effective = cateringEffectivePayables(live, facts.payments, ledger.balanceDueCents);
  const unsettled = live
    .filter((invoice) => cateringInvoiceState(invoice, facts.payments) !== "paid" && (effective.get(invoice.id) ?? 0) > 0)
    .sort((left, right) => left.number - right.number);
  const next = unsettled[0];
  // Capped by what is actually still owed, so a credit granted after a request was sent can never leave the customer
  // being told to pay more than the obligation. With no adjustments the cap never binds: payments never exceed invoices.
  const capped = (cents: number) => (ledger.balanceDueCents === null ? cents : Math.min(cents, ledger.balanceDueCents));
  const nextAmountDueCents = next ? effective.get(next.id) ?? 0 : null;

  // The AGREEMENT's own remainder, with its original meaning: the agreed price less what has been paid, never above the agreed
  // total. It does not move with charges, credits or refunds -- those are in `balanceDueCents`, the adjusted amount due.
  const remainingOfAgreedCents = facts.agreedTotalCents === null ? null : Math.max(0, facts.agreedTotalCents - paidTotalCents);
  const uninvoicedCents = obligationCents === null ? null : Math.max(0, obligationCents - invoicedTotalCents);

  return {
    currency: facts.currency,
    agreedTotalCents: facts.agreedTotalCents,
    invoicedTotalCents,
    paidTotalCents,
    outstandingInvoicedCents: capped(Math.max(0, invoicedTotalCents - paidTotalCents)),
    remainingOfAgreedCents,
    uninvoicedCents,
    depositRequiredCents: cateringDepositRequirement(facts.terms, obligationCents),
    depositPaidCents,
    nextAmountDueCents,
    nextDueOn: next?.dueOn ?? null,
    // Overdue only ever describes a POSITIVE current amount: a past-due request the balance no longer reaches is not overdue.
    nextDueIsOverdue: next ? cateringInvoiceIsOverdue(next, facts.payments, facts.asOfDate) : false,
    status: deriveCateringFinancialStatus(facts, { live, netReceivedCents: ledger.netReceivedCents, obligationCents, next }),
    hasOverdue: live.some((invoice) => (effective.get(invoice.id) ?? 0) > 0 && cateringInvoiceIsOverdue(invoice, facts.payments, facts.asOfDate)),
    originalAgreedCents: ledger.originalAgreedCents,
    obligationCents,
    adjustmentChargesCents: ledger.chargesCents,
    adjustmentCreditsCents: ledger.creditsCents,
    refundsRecordedCents: ledger.refundsCents,
    netReceivedCents: ledger.netReceivedCents,
    balanceDueCents: ledger.balanceDueCents,
    refundPotentiallyDueCents: ledger.refundPotentiallyDueCents,
  };
}

/**
 * Where the booking stands, in order, with the first matching rule winning.
 *
 * MONEY REMAINING IS NOT THE SAME AS MONEY REQUESTED, and this used to conflate them. A provider who took a
 * deposit and had it paid, with the balance not yet invoiced, was reported as `balance_due` -- whose copy tells
 * both parties the remaining balance "has been requested". Nobody had requested anything: the provider was still
 * being offered the button to do it, and the customer was being told to pay something they had never been asked
 * for. The arithmetic was right and the sentence was false.
 *
 * A balance is DUE because a live balance invoice exists and is not covered. It is not due because
 * `agreedTotal - paidTotal > 0`. Where money remains and nothing is asking for it, that is its own state, and it
 * is named for what it is.
 *
 * `settled` still requires BOTH that nothing live is outstanding AND that the payments reach the agreed total, so
 * a booking whose balance was never invoiced cannot read as finished merely because its deposit is covered. A
 * booking with no agreed price can never be settled -- there is no total to have reached.
 *
 * Nothing here is persisted. Every one of these is a function of the invoice rows, the payment rows and the
 * provider's calendar day, so no stored copy can drift from the ledger it claims to describe.
 */
function deriveCateringFinancialStatus(
  facts: CateringBillingFacts,
  derived: { live: readonly CateringInvoiceFact[]; netReceivedCents: number; obligationCents: number | null; next: CateringInvoiceFact | undefined },
): CateringFinancialStatus {
  if (facts.agreedTotalCents === null || derived.obligationCents === null) return "not_configured";
  // A ZERO-DOLLAR AGREEMENT IS ITS OWN FACT, and it is checked before any arithmetic can swallow it. `agreed_price`
  // permits 0.00, and for such a booking `paid >= total` is trivially true with nothing invoiced, nothing recorded
  // and nothing having changed hands -- so the generic rule below reported `settled`, whose copy tells the customer
  // they paid the agreed total in full. They paid nothing, because nothing was owed. That is a different sentence.
  // Phase 2P: "owed nothing" is the OBLIGATION being zero with nothing held, so a fully credited booking that was never
  // paid reads the same as a zero-dollar agreement, while one that was paid first reads on as settled with a refund due.
  if (derived.obligationCents === 0 && derived.netReceivedCents === 0) return "no_payment_required";
  // Settled next, so a fully credited agreement reads as finished whatever became of the invoices that got it
  // there. It is now reachable only where there was a positive total to have reached.
  if (derived.netReceivedCents >= derived.obligationCents) return "settled";
  if (derived.live.length === 0) {
    // NOTHING LIVE, AND THE HISTORY DECIDES WHICH KIND OF NOTHING IT IS. "Nothing has been requested yet" was
    // printed above a list reading "Payment request withdrawn", which is a contradiction both parties could see at
    // once. A booking that has never been invoiced and one whose every request was taken back are different facts
    // and are now different states.
    return facts.invoices.length === 0 ? "not_invoiced" : "no_active_invoice";
  }
  // `next` is the oldest live invoice that is not fully covered, so both of these describe a real, payable ask.
  if (derived.next) return derived.next.kind === "deposit" ? "deposit_due" : "balance_due";
  // Every live invoice is covered and the agreed total is not reached: the rest has not been requested.
  return "balance_not_requested";
}

/* ------------------------------------------------------------------------------------------------------------- *
 * What each actor may do
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Whether billing may be CHANGED at all, from the booking's own Phase 2G status.
 *
 * A cancelled booking keeps its financial history and accepts no new writing: invoicing for an event that will not
 * happen, or recording a payment against it, is not something this surface should make easy, and the record of
 * what was billed and paid before the cancellation must stay exactly as it was. Everything else -- awaiting
 * confirmation, confirmed, completed -- may be billed, because caterers take deposits before confirmation and
 * settle balances after service, and this phase has no business narrowing either.
 *
 * Nothing here reads or writes a booking status. It is one predicate over a value Phase 2G owns.
 */
export function cateringBillingIsActionable(status: CateringBookingStatus): boolean {
  return status !== "cancelled";
}

/**
 * THE PARTITION INVARIANT, stated once and enforced everywhere from here.
 *
 * At every moment, the live invoices on a booking must sum to NO MORE than its agreed total, and together they
 * must read as a coherent division of that one number -- a deposit, then the balance that completes it.
 *
 * `cateringLiveInvoicedCents` is the left-hand side of that, and `cateringInvoiceHeadroomCents` is what is left of
 * the agreed total after it. Every issuance decision below is expressed in terms of the headroom rather than in
 * terms of the deposit alone, which is what closes the hole: reasoning only about "is there already a deposit"
 * missed the case where a live BALANCE had already claimed the whole total.
 */
export function cateringLiveInvoicedCents(facts: CateringBillingFacts): number {
  return facts.invoices.filter(cateringInvoiceCounts).reduce((total, invoice) => total + invoice.amountCents, 0);
}
/**
 * What the customer owes in total: the agreed price, moved by the provider's own posted charges and credits (Phase 2P).
 * Equal to the agreed price when there are none, which is every booking that predates the adjustment ledger.
 */
export function cateringObligationCents(facts: Pick<CateringBillingFacts, "agreedTotalCents" | "adjustments">): number | null {
  return deriveCateringLedgerPosition({ agreedTotalCents: facts.agreedTotalCents, paidTotalCents: 0, adjustments: facts.adjustments ?? [] }).obligationCents;
}
/** Refunds the provider has recorded and not reversed: money that stopped being net received. */
export function cateringRefundsRecordedCents(facts: Pick<CateringBillingFacts, "adjustments">): number {
  return (facts.adjustments ?? []).reduce((total, entry) => (entry.status === "posted" && entry.kind === "refund" ? total + entry.amountCents : total), 0);
}
/**
 * The most the live invoices may add up to: the current obligation PLUS recorded refunds.
 *
 * A refund is not a commercial charge -- it never moves the obligation -- but it does move NET RECEIVED, so what the
 * customer still owes is `obligation - (payments - refunds)`. Requests are paid against by recording payments, so for
 * every cent of balance due to have a request to be paid against, the live requests must be able to cover
 * `obligation + refunds`: the money that came back out is money that is owed in again, and it needs a target. Counting
 * refunds here (and nowhere in the obligation) is what keeps both true at once.
 */
export function cateringCollectibleTargetCents(facts: CateringBillingFacts): number | null {
  const obligation = cateringObligationCents(facts);
  return obligation === null ? null : obligation + cateringRefundsRecordedCents(facts);
}
/** What the collectible target has left to be requested. Null when there is nothing agreed to divide. */
export function cateringInvoiceHeadroomCents(facts: CateringBillingFacts): number | null {
  const target = cateringCollectibleTargetCents(facts);
  return target === null ? null : Math.max(0, target - cateringLiveInvoicedCents(facts));
}

/**
 * What a further (`adjustment`) request would be for: the part of the collectible target the live requests do not cover,
 * and never more than what is owed and not already asked for.
 *
 * It is derived from CURRENT COVERAGE, not from the ledger's lifetime totals. A credit that was posted before the balance
 * request is already inside that request's amount; netting a later charge against it would call a genuinely uncovered
 * charge "no addition" and strand it. So there is no running sum of charges and credits here at all: the live requests
 * already add up to whatever the obligation was when each was issued, and the target (obligation + refunds) minus them is
 * exactly what has happened since -- a later charge, a reversed credit, or a recorded refund -- whichever order they came in,
 * with earlier further requests already counted in the coverage.
 *
 * The gate is whether the ledger has ANY history, not whether an entry is still posted. Reversing a credit that a live balance
 * already reflects is not a new charge; it is the obligation growing back past what that balance asked for, which leaves the
 * restored amount uncovered with no entry left to point at. The coverage gap (target minus live requests, capped by what is owed
 * and unasked) is the whole rule; the history gate only keeps a booking that never used the ledger on its Phase 2L meaning,
 * where a gap beside a live balance (a withdrawn deposit) is resolved by withdrawing the balance and issuing the pair afresh.
 */
export function cateringAdjustmentRequestCents(facts: CateringBillingFacts): number {
  if ((facts.adjustments ?? []).length === 0) return 0;
  const paid = facts.payments.reduce((total, row) => (cateringPaymentCounts(row) ? total + row.amountCents : total), 0);
  const balanceDue = deriveCateringLedgerPosition({ agreedTotalCents: facts.agreedTotalCents, paidTotalCents: paid, adjustments: facts.adjustments ?? [] }).balanceDueCents ?? 0;
  // What is owed and not already asked for: a refund cannot create request capacity beyond a positive balance.
  const unaskedBalance = balanceDue - Math.max(0, cateringLiveInvoicedCents(facts) - paid);
  return Math.max(0, Math.min(cateringInvoiceHeadroomCents(facts) ?? 0, unaskedBalance));
}

/**
 * Which kinds may be issued right now.
 *
 * THREE conditions, and the second is the one the first version of this function was missing:
 *
 *  - never a second live invoice of the same kind (the database's own unique index says the same thing);
 *  - never a deposit once a BALANCE is live. A balance is by definition "the rest of the money", so asking for a
 *    deposit after it is not a division of the total but an addition to it. Reasoning only about whether a deposit
 *    already existed let a provider issue a full balance, then configure deposit terms, then issue a deposit --
 *    and the booking would be asking for more than was ever agreed. Voiding the deposit and reissuing a larger one
 *    beside a live balance is the same hole from the other side, and is closed by the same rule;
 *  - never more than the headroom. A deposit whose terms now exceed what is left cannot be issued, and a balance
 *    is issuable only while something remains.
 *
 * The order is deliberate: a deposit precedes a balance, so the way back from a live balance is to withdraw it --
 * explicitly, leaving its own history intact -- and issue the pair afresh. Nothing here mutates an issued invoice.
 */
export function cateringIssuableInvoiceKinds(facts: CateringBillingFacts): CateringInvoiceKind[] {
  if (facts.agreedTotalCents === null || !cateringBillingIsActionable(facts.bookingStatus)) return [];
  const live = facts.invoices.filter(cateringInvoiceCounts);
  const headroom = cateringInvoiceHeadroomCents(facts) ?? 0;
  const kinds: CateringInvoiceKind[] = [];
  const hasDeposit = live.some((invoice) => invoice.kind === "deposit");
  const hasBalance = live.some((invoice) => invoice.kind === "balance");
  const required = cateringDepositRequirement(facts.terms, cateringObligationCents(facts));
  if (!hasDeposit && !hasBalance && required !== null && required > 0 && required <= headroom) kinds.push("deposit");
  if (!hasBalance && headroom > 0) kinds.push("balance");
  // A live balance has already claimed what the obligation was when it was issued. Whatever the obligation has grown by
  // since is requested separately, for what was added, so the earlier invoice is never touched.
  if (hasBalance && cateringAdjustmentRequestCents(facts) > 0) kinds.push("adjustment");
  return kinds;
}

/**
 * The amount a balance invoice would be for: exactly the headroom.
 *
 * With a live deposit that is `agreedTotal - deposit`, which is what it always was; with none it is the whole
 * agreed total. Expressing it as the headroom rather than as "total minus the deposit" is what makes it correct
 * for any live invoice set rather than only for the one the original code imagined.
 *
 * A client cannot influence it: no amount is accepted on the issue request at all.
 */
export function cateringBalanceAmount(facts: CateringBillingFacts): number {
  return cateringInvoiceHeadroomCents(facts) ?? 0;
}

/**
 * Whether issuing this kind for this amount would keep the partition invariant.
 *
 * The last word, checked by the server inside the issuing transaction after it has derived the amount, so the
 * invariant is asserted against the rows that are actually about to be written beside -- not against whatever a
 * client believed when it pressed the button.
 */
export function cateringIssuanceKeepsPartition(facts: CateringBillingFacts, amountCents: number): boolean {
  const target = cateringCollectibleTargetCents(facts);
  if (target === null) return false;
  return amountCents > 0 && cateringLiveInvoicedCents(facts) + amountCents <= target;
}

/** The amount an invoice of this kind would be issued for, or null when it may not be issued. */
export function cateringInvoiceAmountFor(kind: CateringInvoiceKind, facts: CateringBillingFacts): number | null {
  if (!cateringIssuableInvoiceKinds(facts).includes(kind)) return null;
  if (kind === "adjustment") return cateringAdjustmentRequestCents(facts);
  return kind === "deposit" ? cateringDepositRequirement(facts.terms, cateringObligationCents(facts)) : cateringBalanceAmount(facts);
}

/**
 * Whether a replayed payment request describes the SAME payment the first attempt recorded.
 *
 * An idempotency key makes a retry safe; it does not make a retry mean whatever the second request says. The
 * payment form stays editable while a save is in flight -- deliberately, so a lost response does not throw away
 * what the provider typed -- and it keeps its key, so the retry is recognisably the same attempt. But if they
 * corrected the amount, the invoice, the method, the date or their reference before retrying, the two requests are
 * no longer the same attempt at all, and answering the second with "already done" would close the form over an
 * edit the ledger never received.
 *
 * So every field that decides what the payment IS is compared. The currency is not among them because a client
 * never sends one, and the status is not because it is not an input. `undefined` and `null` are one absence: a
 * reference that was omitted and one that was cleared are the same thing to the row.
 */
export function cateringPaymentReplayMatches(
  recorded: { invoiceId: string; amountCents: number; method: string; receivedOn: string; reference: string | null },
  attempt: { invoiceId: string; amountCents: number | null; method: string; receivedOn: string; reference?: string | null },
): boolean {
  return attempt.amountCents !== null
    && recorded.invoiceId === attempt.invoiceId
    && recorded.amountCents === attempt.amountCents
    && recorded.method === attempt.method
    && recorded.receivedOn === attempt.receivedOn
    && (recorded.reference ?? null) === (attempt.reference ?? null);
}

/**
 * The most a payment against this invoice may be: exactly what is left on it.
 *
 * Overpayment is refused rather than absorbed. A caterer who was handed more than the invoice asks for has either
 * mis-typed the figure or is recording something this booking's agreed price does not describe, and quietly
 * accepting it would put the ledger above the agreed total with no agreement behind the difference.
 */
export function cateringRemainingOnInvoice(invoice: CateringInvoiceFact, payments: readonly CateringPaymentFact[]): number {
  return Math.max(0, invoice.amountCents - cateringPaidTowards(invoice.id, payments));
}

/**
 * The most a payment against this invoice may be RIGHT NOW: what the invoice has left, and never more than the customer
 * still owes for the booking after credits and recorded refunds (Phase 2P). One derivation, used by the server's own check
 * and serialized to the provider so the payment form states the same limit instead of re-inventing the accounting.
 * Zero when nothing may be recorded: a cancelled booking, a request that is not live, or a booking owing nothing.
 */
export function cateringPayableCents(invoice: CateringInvoiceFact, facts: CateringBillingFacts): number {
  if (!cateringBillingIsActionable(facts.bookingStatus) || !cateringInvoiceCounts(invoice)) return 0;
  const remaining = cateringRemainingOnInvoice(invoice, facts.payments);
  const balanceDue = deriveCateringBillingSummary(facts).balanceDueCents;
  return balanceDue === null ? remaining : Math.min(remaining, balanceDue);
}

/** Whether a payment may be recorded against this invoice at all. */
export function cateringInvoiceAcceptsPayment(invoice: CateringInvoiceFact, facts: CateringBillingFacts): boolean {
  return cateringBillingIsActionable(facts.bookingStatus)
    && cateringInvoiceCounts(invoice)
    && cateringRemainingOnInvoice(invoice, facts.payments) > 0;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Serialized views
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * An invoice as either actor sees it. Every field here is a shared financial fact -- what was asked for, for how
 * much, by when, and where it stands.
 *
 * Internal attribution (`created_by`, `voided_by`) is absent from BOTH actors' payloads, exactly as Phase 2K keeps
 * `closed_out_by` internal, and the concurrency version is provider-only so a customer cannot infer provider
 * activity from a number moving.
 */
export type CateringInvoiceView = {
  id: string;
  number: number;
  kind: CateringInvoiceKind;
  reference: string;
  amountCents: number;
  currency: string;
  status: CateringInvoiceStatus;
  state: CateringInvoiceState;
  overdue: boolean;
  dueOn: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  paidCents: number;
  remainingCents: number;
  /** PROVIDER ONLY: the most a payment may be right now (server-derived; see `cateringPayableCents`). Absent for a customer. */
  maxPaymentCents?: number;
  /** PROVIDER ONLY: the optimistic-concurrency version. Absent as a key from a customer's payload. */
  updatedAt?: string;
};

/**
 * A payment as either actor sees it.
 *
 * `source` and `recordedByRole` are here on purpose and are what the customer-facing wording is built from: this
 * phase records money the caterer received, and every place it is shown says so. The provider's own bookkeeping
 * `reference` is PROVIDER ONLY -- it is their internal note, not a shared fact.
 */
export type CateringPaymentView = {
  id: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  method: CateringPaymentMethod;
  source: CateringPaymentSource;
  status: CateringPaymentStatus;
  receivedOn: string;
  recordedAt: string;
  voidedAt: string | null;
  /** PROVIDER ONLY: the caterer's own reference for this receipt. Absent as a key from a customer's payload. */
  reference?: string | null;
  /** PROVIDER ONLY (Phase 2P): what can still be recorded as returned against this payment. Server-derived. */
  refundableCents?: number;
  /** PROVIDER ONLY: whether the take-back endpoint would allow this payment to be taken back right now. Server-derived. */
  voidable?: boolean;
  /** PROVIDER ONLY: why a recorded payment cannot be taken back right now. Null otherwise. */
  voidBlockedReason?: string | null;
};

/** The deposit terms, PROVIDER ONLY as a whole: unissued terms are planning, not an ask. */
export type CateringDepositTermsView = CateringDepositTerms & {
  requiredCents: number | null;
  /** The optimistic-concurrency version every terms write states a precondition against. */
  updatedAt: string | null;
};

export type CateringBookingBillingView = {
  role: "provider" | "customer";
  bookingStatus: CateringBookingStatus;
  /** Whether Phase 2L writes are open. Derived from the authoritative booking, never from a client. */
  actionable: boolean;
  /**
   * The billing day both participants' due dates are judged against: the PROVIDER's calendar date.
   *
   * The customer receives the resulting date and nothing about where their caterer is -- no timezone identifier
   * reaches either payload.
   */
  asOfDate: string;
  summary: CateringBillingSummary;
  invoices: CateringInvoiceView[];
  payments: CateringPaymentView[];
  /** Phase 2P: the adjustment ledger, oldest first, reversed entries included. Empty for a booking with none. */
  adjustments: CateringAdjustmentView[];
  /** Absent keys rather than empty values: a customer's payload carries no provider-only object at all. */
  terms?: CateringDepositTermsView;
  issuable?: CateringInvoiceKind[];
  /** What each issuable kind would be for, so the provider previews before issuing and sends no amount. */
  issuablePreview?: { kind: CateringInvoiceKind; amountCents: number }[];
  /** PROVIDER ONLY: what may be recorded or reversed right now, and the limits the forms state. */
  adjustmentActions?: CateringAdjustmentActions;
};

/* ------------------------------------------------------------------------------------------------------------- *
 * Paths, keys and refusal codes
 * ------------------------------------------------------------------------------------------------------------- */

export const CATERING_BILLING_SECTION = "billing";
export const cateringBookingBillingPath = (bookingId: string) => `/api/catering/bookings/${bookingId}/billing`;
export const cateringBookingBillingKey = (userId: string, bookingId: string) => ["catering", "booking-billing", userId, bookingId] as const;

export const CATERING_BILLING_VERSION_CONFLICT_CODE = "catering_billing_version_conflict";
export const CATERING_BILLING_VERSION_CONFLICT_MESSAGE = "These billing details were changed somewhere else. Reload them and try again.";
export const CATERING_BILLING_NOT_AVAILABLE_CODE = "catering_billing_not_available";
export const CATERING_BILLING_STATE_CODE = "catering_billing_state";

/** A per-booking display reference for an invoice. Derived from the number, never stored twice. */
export function cateringInvoiceReference(bookingId: string, number: number): string {
  return `${bookingId.slice(0, 8).toUpperCase()}-${String(number).padStart(3, "0")}`;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Copy
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * PLAIN LANGUAGE, AND NOTHING THAT OVERSTATES WHAT HAPPENED.
 *
 * There is no "Paid" without a qualifier anywhere a payment's provenance matters, because ChefSire did not take the
 * money and cannot vouch for it beyond the caterer's word. "Recorded by your caterer" is the strongest truthful
 * claim this phase can make, and it is the one it makes.
 */
export const CATERING_INVOICE_STATE_COPY: Record<CateringInvoiceState, string> = {
  draft: "Draft",
  issued: "Awaiting payment",
  partially_paid: "Part paid",
  paid: "Settled",
  void: "Cancelled",
};

export const CATERING_FINANCIAL_STATUS_COPY: Record<CateringFinancialStatus, { label: string; provider: string; customer: string }> = {
  not_configured: {
    label: "No agreed price",
    provider: "This booking has no agreed price, so there is nothing to invoice yet.",
    customer: "No price has been agreed for this booking yet.",
  },
  no_payment_required: {
    // Nothing is owed, so nothing about this may read as having been paid, credited or settled BY a payment. The
    // agreed total is rendered beside this line, so the figure speaks for itself.
    label: "No payment required",
    provider: "No payment is required for this booking.",
    customer: "No payment is required for this booking.",
  },
  not_invoiced: {
    // TRULY nothing: not one invoice has ever been issued on this booking, so "yet" is accurate.
    label: "Nothing requested yet",
    provider: "Nothing has been requested from your customer yet.",
    customer: "Your caterer has not asked you for anything yet.",
  },
  no_active_invoice: {
    // Requests WERE made and have been withdrawn. Saying "nothing yet" here contradicted the history rendered
    // directly below the summary, so the wording is temporal and points at what is actually on screen.
    label: "No active request",
    provider: "There is no active payment request right now. Your earlier requests are in the history below.",
    customer: "There is no active payment request right now. Earlier requests are in the history below.",
  },
  deposit_due: {
    label: "Deposit due",
    provider: "A deposit has been requested and is not fully covered yet.",
    customer: "Your caterer has asked you for a deposit.",
  },
  balance_not_requested: {
    label: "Balance not requested yet",
    // Truthful in both directions: money remains under the agreement, and nobody has asked for it. The provider's
    // "Request balance" button is offered in exactly this state, so the sentence and the control agree.
    provider: "A remaining balance is still available to request.",
    customer: "A remaining balance remains, but your caterer has not requested it yet.",
  },
  balance_due: {
    label: "Balance due",
    provider: "The remaining balance has been requested and is not fully covered yet.",
    customer: "Your caterer has asked you for the remaining balance.",
  },
  settled: {
    label: "Settled",
    provider: "Your customer has paid the agreed total in full, by your own records.",
    customer: "Your caterer has recorded payment of the agreed total in full.",
  },
};

export const CATERING_PAYMENT_METHOD_COPY: Record<CateringPaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  card_in_person: "Card in person",
  cheque: "Cheque",
  other: "Other",
};

/**
 * The single most important sentence in this phase, shown wherever payments are.
 *
 * It exists so that no one reading a settled invoice believes ChefSire took their money, held it, or can return
 * it. The caterer received it directly and recorded it here.
 */
export const CATERING_BILLING_DISCLOSURE = {
  customer:
    "ChefSire does not take catering payments. You pay your caterer directly, and what you see here is what they have recorded.",
  provider:
    "ChefSire does not process catering payments. Record what you have actually received; your customer sees these records as yours.",
} as const;

export const CATERING_BILLING_NOTIFICATIONS = {
  invoiceIssued: {
    type: "catering_booking_invoice_issued",
    title: "Your caterer has requested a payment",
    message: "Open your booking to see the amount and when it is due.",
  },
  paymentRecorded: {
    type: "catering_booking_payment_recorded",
    title: "Your caterer recorded a payment",
    message: "Open your booking to see what they have recorded against your event.",
  },
} as const;

export function cateringBillingSectionPath(role: "provider" | "customer", bookingId: string): string {
  return `${cateringBookingWorkspacePath(role, bookingId)}#${CATERING_BILLING_SECTION}`;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Request schemas
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * NO REQUEST IN THIS PHASE CARRIES AN INVOICE AMOUNT.
 *
 * Issuing a deposit or a balance sends the KIND and nothing else; the server derives what it is for from the
 * booking's own agreed price and the terms it has persisted, recomputed under the booking's advisory lock at the
 * moment it writes. There is therefore no client-computed total to trust, and no request shape in which one could
 * arrive. The single amount a client does send is on a recorded payment, and it is bounded on the server against
 * what the invoice actually has left.
 *
 * Every schema is `.strict()`, so an unexpected key -- `providerId`, `customerId`, `amountCents` on an issue,
 * `status`, `paid` -- is a 400 rather than something silently ignored.
 */
export const cateringBillingVersionSchema = z.string().datetime();
/**
 * Date-only, and a date that actually EXISTS.
 *
 * The canonical `calendarDateSchema` -- the same one the availability, operations and execution phases use --
 * rather than a second implementation. A shape-only regex accepted `2026-02-30`, `2026-13-01` and `2026-00-15`,
 * which passed request validation and then failed in Postgres writing a `date` column: a malformed client input
 * turned into a 500 instead of the ordinary 400 the rest of this phase answers with.
 *
 * Calendar VALIDITY and calendar-day COMPARISON stay separate concerns. This asks only whether the string names a
 * real Gregorian day; whether that day is past, future or today is decided later, against the provider's own
 * calendar date (see `cateringBillingDay`), and no UTC reasoning is reintroduced here.
 */
export const cateringBillingDateSchema = calendarDateSchema;

export const cateringDepositTermsSaveSchema = z.object({
  mode: z.enum(CATERING_DEPOSIT_MODES),
  /** Major units, as the provider types them. Converted to cents by the exact parser, never by `parseFloat`. */
  amount: z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 250 or 250.00").optional(),
  /** Whole or half percents, as a string for the same reason. */
  percent: z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage like 25 or 12.5").optional(),
  dueOn: cateringBillingDateSchema.nullable().optional(),
  expectedUpdatedAt: cateringBillingVersionSchema.optional(),
}).strict();

export const cateringInvoiceIssueSchema = z.object({
  kind: z.enum(CATERING_INVOICE_KINDS),
  dueOn: cateringBillingDateSchema.nullable().optional(),
}).strict();

export const cateringInvoiceVoidSchema = z.object({
  reason: z.string().trim().min(1).max(200).optional(),
  expectedUpdatedAt: cateringBillingVersionSchema.optional(),
}).strict();

export const cateringPaymentRecordSchema = z.object({
  invoiceId: z.string().trim().min(1).max(64),
  amount: z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 250 or 250.00"),
  method: z.enum(CATERING_PAYMENT_METHODS),
  receivedOn: cateringBillingDateSchema,
  reference: z.string().trim().max(64).optional(),
  /**
   * The client's own key for THIS attempt, so a double-click, a browser retry or a lost response can be replayed
   * without crediting the money twice. Unique per booking in the database; a replay returns the payment the first
   * attempt created, and writes no second activity row and no second notification.
   */
  idempotencyKey: z.string().trim().min(8).max(64),
}).strict();

export const cateringPaymentVoidSchema = z.object({
  reason: z.string().trim().min(1).max(200).optional(),
}).strict();

/** The percentage a provider typed, in basis points, or null if it is not a usable percentage. */
export function cateringPercentToBasisPoints(value: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const points = Number(match[1]) * 100 + Number(`${match[2] ?? ""}00`.slice(0, 2));
  return points > 0 && points <= CATERING_BILLING_BASIS_POINTS ? points : null;
}
