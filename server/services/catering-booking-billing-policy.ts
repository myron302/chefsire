import type { CateringBookingBillingRecord, CateringBookingInvoice, CateringBookingPayment } from "@shared/schema";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import {
  CATERING_BILLING_NOT_AVAILABLE_CODE,
  CATERING_BILLING_STATE_CODE,
  CATERING_BILLING_VERSION_CONFLICT_CODE,
  CATERING_BILLING_VERSION_CONFLICT_MESSAGE,
  EMPTY_CATERING_DEPOSIT_TERMS,
  cateringBillingIsActionable,
  cateringMoneyToCents,
  type CateringBillingFacts,
  type CateringDepositTerms,
  type CateringInvoiceFact,
  type CateringPaymentFact,
  type CateringInvoiceKind,
  type CateringPaymentMethod,
  type CateringPaymentSource,
  type CateringPaymentStatus,
  type CateringInvoiceStatus,
} from "@shared/catering-booking-billing";
import type { CateringBookingStatus } from "@shared/catering-bookings";
import type { db } from "../db";
import { providerCalendarDate } from "./catering-provider-calendar";

/**
 * The Phase 2L policy layer: everything the routes decide, decided here instead, as pure functions over rows.
 *
 * Nothing in this file reads a request body, a session or a clock of its own. The routes resolve the actor, the
 * booking and the current date and hand them in, which is what lets every rule below -- who may act, what an
 * amount may be, whether a precondition holds, whether a retry is a duplicate -- be tested exactly as it runs.
 */

export type CateringBillingGuard = "ok" | "forbidden" | "not_available";

export const CATERING_BILLING_FORBIDDEN_MESSAGE = "Only the caterer on this booking can change its billing.";
export const CATERING_BILLING_NOT_FOUND_REFUSAL = { status: 404, message: "Booking billing not found" } as const;
export const CATERING_BILLING_NOT_AVAILABLE_REFUSAL = {
  status: 409,
  message: "This booking's billing is closed because the booking was cancelled.",
  code: CATERING_BILLING_NOT_AVAILABLE_CODE,
} as const;
export const CATERING_BILLING_CONFLICT_REFUSAL = {
  status: 409,
  message: CATERING_BILLING_VERSION_CONFLICT_MESSAGE,
  code: CATERING_BILLING_VERSION_CONFLICT_CODE,
} as const;
export function cateringBillingStateRefusal(message: string) {
  return { status: 409, message, code: CATERING_BILLING_STATE_CODE } as const;
}

/**
 * The one gate every Phase 2L mutation passes, before its transaction and again against the LOCKED booking.
 *
 * Two independent questions, answered in a fixed order so the more specific one cannot be masked. Every mutation
 * in this phase is provider-only: a customer has no billing action at all, because there is nothing behind one --
 * ChefSire takes no catering payment, so there is no "pay" for a customer to press, and a customer must certainly
 * not be able to declare their own money received.
 */
export function cateringBillingGuard(booking: { providerId: string; customerId: string; status: string }, actorId: string): CateringBillingGuard {
  if (cateringWorkspaceRole(booking, actorId) !== "provider") return "forbidden";
  if (!cateringBillingIsActionable(booking.status as CateringBookingStatus)) return "not_available";
  return "ok";
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Rows to facts
 * ------------------------------------------------------------------------------------------------------------- */

export function cateringDepositTermsOf(record: CateringBookingBillingRecord | undefined): CateringDepositTerms {
  if (!record) return EMPTY_CATERING_DEPOSIT_TERMS;
  return {
    mode: record.depositMode as CateringDepositTerms["mode"],
    amountCents: record.depositAmountCents ?? null,
    percentBasisPoints: record.depositPercentBp ?? null,
    dueOn: record.depositDueOn ?? null,
  };
}

export function cateringInvoiceFactOf(row: CateringBookingInvoice): CateringInvoiceFact {
  return {
    id: row.id,
    number: row.invoiceNumber,
    kind: row.invoiceKind as CateringInvoiceKind,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status as CateringInvoiceStatus,
    dueOn: row.dueOn ?? null,
    issuedAt: row.issuedAt?.toISOString() ?? null,
  };
}

export function cateringPaymentFactOf(row: CateringBookingPayment): CateringPaymentFact {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    amountCents: row.amountCents,
    currency: row.currency,
    method: row.paymentMethod as CateringPaymentMethod,
    source: row.paymentSource as CateringPaymentSource,
    status: row.status as CateringPaymentStatus,
    receivedOn: row.receivedOn,
  };
}

/**
 * Every fact the derivation needs, assembled in one place.
 *
 * `agreedTotalCents` comes from the booking's own `decimal(12, 2)` column through the exact string parser, so the
 * number this phase bills against is the number the booking agreement recorded -- not a rounded copy of it, and
 * not anything a client sent.
 */
export function cateringBillingFacts(input: {
  booking: { status: string; agreedPrice: string | null; currency: string };
  terms: CateringBookingBillingRecord | undefined;
  invoices: readonly CateringBookingInvoice[];
  payments: readonly CateringBookingPayment[];
  asOfDate: string;
}): CateringBillingFacts {
  return {
    bookingStatus: input.booking.status as CateringBookingStatus,
    agreedTotalCents: cateringMoneyToCents(input.booking.agreedPrice),
    currency: input.booking.currency,
    terms: cateringDepositTermsOf(input.terms),
    invoices: input.invoices.map(cateringInvoiceFactOf),
    payments: input.payments.map(cateringPaymentFactOf),
    asOfDate: input.asOfDate,
  };
}

/**
 * THE BILLING DAY IS THE PROVIDER'S CALENDAR DAY.
 *
 * Not UTC, not the server host's zone, not the caller's browser. A caterer in Los Angeles asked for a deposit by
 * the 20th means the 20th where they are; judged in UTC their invoice turns red at 4pm on the 19th, and a payment
 * they take in hand on the evening of the 19th is refused as "dated in the future" because UTC has already rolled
 * over. A caterer in Tokyo gets the mirror image.
 *
 * Catering already answers "what day is it for this provider" -- `catering_availability_settings.timezone` through
 * `calendarDateInTimezone` -- and Phase 2L reads exactly that, through the same `providerCalendarDate` the booking
 * offer and confirmation rules use. No second timezone model is introduced, and the customer is told nothing about
 * where their caterer is: they receive the resulting `asOfDate`, never the identifier it came from.
 *
 * The date is resolved ONCE at the route boundary, from the booking this request is about, and the resulting
 * `YYYY-MM-DD` is passed into every pure helper below. That keeps the shared contract timezone-agnostic -- it
 * compares two date strings and knows nothing about zones -- and it means a request that crosses midnight uses one
 * day throughout instead of deciding twice and disagreeing with itself.
 */
export async function cateringBillingDay(executor: typeof db, providerId: string, now: Date = new Date()): Promise<string> {
  return providerCalendarDate(executor, providerId, now);
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Preconditions
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Whether a stated optimistic-concurrency precondition matches the authoritative row, compared as INSTANTS.
 *
 * Fails CLOSED in both directions that matter. A precondition stated against a row that does not exist is refused;
 * a row that exists and a request that states no precondition is refused too, because "I did not know there was
 * anything here" is not a licence to overwrite what somebody else wrote. Only the genuinely first write to a
 * booking with no terms row may omit it.
 */
export function cateringBillingVersionMatches(expected: string | undefined, actual: Date | null | undefined): boolean {
  if (!actual) return expected === undefined;
  if (expected === undefined) return false;
  const stated = Date.parse(expected);
  return Number.isFinite(stated) && stated === actual.getTime();
}

/** The terms a save would persist, or a refusal describing exactly which rule it broke. */
export type CateringTermsResolution =
  | { ok: true; mode: CateringDepositTerms["mode"]; amountCents: number | null; percentBasisPoints: number | null; dueOn: string | null }
  | { ok: false; message: string };

/**
 * Validates deposit terms against the booking they belong to.
 *
 * A fixed deposit may not exceed the agreed total, because a deposit larger than the whole job is not a deposit;
 * a percentage is already bounded to (0, 100] by its schema and its CHECK. The two figures can never both be
 * present, because the mode decides which one is read and the other is written as null -- the contradictory
 * configurations are unrepresentable rather than merely rejected.
 */
export function resolveCateringDepositTerms(input: {
  mode: CateringDepositTerms["mode"];
  amountCents: number | null;
  percentBasisPoints: number | null;
  dueOn: string | null;
  agreedTotalCents: number | null;
}): CateringTermsResolution {
  const dueOn = input.dueOn ?? null;
  if (input.mode === "none") return { ok: true, mode: "none", amountCents: null, percentBasisPoints: null, dueOn };
  if (input.mode === "fixed") {
    if (input.amountCents === null) return { ok: false, message: "Enter the deposit amount." };
    if (input.amountCents <= 0) return { ok: false, message: "A deposit has to be more than nothing. Choose 'no deposit' instead." };
    if (input.agreedTotalCents !== null && input.amountCents > input.agreedTotalCents) {
      return { ok: false, message: "A deposit cannot be more than the agreed price for the event." };
    }
    return { ok: true, mode: "fixed", amountCents: input.amountCents, percentBasisPoints: null, dueOn };
  }
  if (input.percentBasisPoints === null) return { ok: false, message: "Enter a deposit percentage between 0 and 100." };
  return { ok: true, mode: "percentage", amountCents: null, percentBasisPoints: input.percentBasisPoints, dueOn };
}

/**
 * Whether a recorded payment may be credited, and for how much.
 *
 * The amount a client sends is never taken as given: it is checked against what the invoice ACTUALLY has left,
 * recomputed here from the ledger rows read inside the same transaction, under the booking's advisory lock. An
 * overpayment is refused rather than absorbed, so the ledger can never climb above the agreed total with nothing
 * agreed behind the difference.
 */
export type CateringPaymentResolution = { ok: true; amountCents: number } | { ok: false; message: string };

export function resolveCateringPayment(input: {
  amountCents: number | null;
  currency: string;
  invoice: CateringInvoiceFact | undefined;
  facts: CateringBillingFacts;
  receivedOn: string;
}): CateringPaymentResolution {
  if (!input.invoice) return { ok: false, message: "That request for payment is no longer on this booking." };
  // A payment cannot have been received in the future. Compared date-only against the SERVER's date, so a caterer
  // whose device clock is a day ahead cannot record money as already in hand, and a customer reading the history
  // never sees a receipt dated after today.
  if (input.receivedOn > input.facts.asOfDate) return { ok: false, message: "A payment cannot be dated in the future." };
  if (input.invoice.status !== "issued") {
    return { ok: false, message: "Payments can only be recorded against a request that has been sent to your customer." };
  }
  if (input.amountCents === null || input.amountCents <= 0) return { ok: false, message: "Enter the amount you received." };
  // Currency is the booking's, on both sides. Nothing in this phase converts between currencies or adds across
  // them, and a mismatch is a refusal rather than a conversion.
  if (input.currency !== input.invoice.currency) return { ok: false, message: "That payment is in a different currency from this booking." };
  const remaining = Math.max(0, input.invoice.amountCents - input.facts.payments.reduce(
    (total, payment) => (payment.invoiceId === input.invoice!.id && payment.status === "recorded" ? total + payment.amountCents : total), 0));
  if (remaining === 0) return { ok: false, message: "This request is already fully covered by the payments you have recorded." };
  if (input.amountCents > remaining) return { ok: false, message: "That is more than this request still has outstanding." };
  return { ok: true, amountCents: input.amountCents };
}
