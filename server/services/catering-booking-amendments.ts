import { and, asc, eq, gte, lte } from "drizzle-orm";
import { cateringAvailabilityExceptions, cateringBookingAmendments, cateringBookings, cateringOfferRevisions, type CateringBooking, type CateringBookingAmendment } from "@shared/schema";
import { cateringCentsToDecimal } from "@shared/catering-booking-billing";
import {
  CATERING_AMENDMENT_BILLING_FIELDS, CATERING_AMENDMENT_HISTORY_LIMIT, cateringAmendmentActions,
  type CateringAmendmentErrorCode, type CateringAmendmentField, type CateringAmendmentProposalInput, type CateringAmendmentTerms, type CateringAmendmentsView,
} from "@shared/catering-amendments";
import { serializeCateringAmendment } from "../serializers/catering-booking-amendment";
import { evaluateBookingDateForConfirmation } from "./catering-booking-availability";
import { bookingActor } from "./catering-booking-policy";
import { providerCalendarDate } from "./catering-provider-calendar";
import { bookingPriceCents, cateringBillingLedgerActive, lockCateringBookingForNegotiation } from "./catering-offer-negotiation";
import type { db } from "../db";

type Executor = typeof db;

/**
 * Phase 2O amendments, one booking at a time.
 *
 * Every mutation runs inside the caller's transaction and starts by taking the BOOKING row's lock. That one lock serializes
 * two proposals, a proposal against a response, a response against a cancellation or completion (which update the same
 * row), and an acceptance against Phase 2L billing writes (which take the same lock). Whoever gets it first writes; the
 * others then judge the state it left. The partial unique index on pending rows is only the backstop behind it.
 *
 * `catering_bookings` stays the current truth. An amendment never reaches it except in the single transaction that accepts
 * it, and nothing else in ChefSire replays amendment history to learn the booking's terms.
 */

export const CATERING_AMENDMENT_BILLING_LOCKED_MESSAGE = "Billing has started for this booking, so its price and currency can no longer change. You can still amend the event date, guest count or terms description.";
export const CATERING_AMENDMENT_STALE_MESSAGE = "The booking's terms changed while you were looking at them. Review the current terms and try again.";
export const CATERING_AMENDMENT_CLOSED_MESSAGE = "This booking can no longer be amended. Only a confirmed booking can be.";

export type AmendmentRefusal = { kind: "refused"; status: 403 | 404 | 409; code?: CateringAmendmentErrorCode; message: string };
const refuse = (status: 403 | 404 | 409, message: string, code?: CateringAmendmentErrorCode): AmendmentRefusal => ({ kind: "refused", status, message, code });

/** The whole history, oldest first. Bounded by construction: no write is accepted past CATERING_AMENDMENT_HISTORY_LIMIT rows. */
export async function listCateringAmendments(executor: Executor, bookingId: string): Promise<CateringBookingAmendment[]> {
  return executor.select().from(cateringBookingAmendments).where(eq(cateringBookingAmendments.bookingId, bookingId)).orderBy(asc(cateringBookingAmendments.amendmentNumber)).limit(CATERING_AMENDMENT_HISTORY_LIMIT);
}

export const latestAcceptedAmendment = (amendments: readonly CateringBookingAmendment[]) => [...amendments].reverse().find((row) => row.status === "accepted") ?? null;
export const pendingAmendment = (amendments: readonly CateringBookingAmendment[]) => amendments.find((row) => row.status === "pending") ?? null;

/**
 * The terms description in force. The booking has no column for it, so it is the latest accepted amendment that changed it,
 * else the note of the Phase 2N offer revision the customer accepted, else none.
 */
export async function currentTermsNote(executor: Executor, bookingId: string, amendments: readonly CateringBookingAmendment[]): Promise<string | null> {
  const amended = [...amendments].reverse().find((row) => row.status === "accepted" && row.changedFields.includes("terms_note"));
  if (amended) return amended.termsNote;
  return acceptedOfferNote(executor, bookingId);
}

async function acceptedOfferNote(executor: Executor, bookingId: string): Promise<string | null> {
  const rows = await executor.select({ note: cateringOfferRevisions.note, acceptedAt: cateringOfferRevisions.acceptedAt }).from(cateringOfferRevisions)
    .where(and(eq(cateringOfferRevisions.bookingId, bookingId), eq(cateringOfferRevisions.kind, "offer")));
  return rows.find((row: { acceptedAt: Date | null }) => row.acceptedAt !== null)?.note ?? null;
}

export function bookingTerms(booking: Pick<CateringBooking, "eventDate" | "guestCount" | "agreedPrice" | "currency">, termsNote: string | null): CateringAmendmentTerms {
  return { eventDate: booking.eventDate, guestCount: booking.guestCount, priceCents: bookingPriceCents(booking), currency: booking.currency, termsNote };
}

/** Which of the proposed terms really differ from the base. A term equal to what is in force is not a change. */
export function changedAmendmentFields(base: CateringAmendmentTerms, input: Pick<CateringAmendmentProposalInput, "eventDate" | "guestCount" | "priceCents" | "currency" | "termsNote">): CateringAmendmentField[] {
  const fields: CateringAmendmentField[] = [];
  if (input.eventDate !== undefined && input.eventDate !== base.eventDate) fields.push("event_date");
  if (input.guestCount !== undefined && input.guestCount !== base.guestCount) fields.push("guest_count");
  if (input.priceCents !== undefined && input.priceCents !== base.priceCents) fields.push("price_cents");
  if (input.currency !== undefined && input.currency !== base.currency) fields.push("currency");
  if (input.termsNote !== undefined && (input.termsNote ?? null) !== (base.termsNote ?? null)) fields.push("terms_note");
  return fields;
}

export const changesBillingSensitiveFields = (fields: readonly string[]) => fields.some((field) => (CATERING_AMENDMENT_BILLING_FIELDS as readonly string[]).includes(field));

/** The base terms of a stored amendment. */
export function amendmentBaseTerms(row: CateringBookingAmendment): CateringAmendmentTerms {
  return { eventDate: row.baseEventDate, guestCount: row.baseGuestCount, priceCents: row.basePriceCents, currency: row.baseCurrency, termsNote: row.baseTermsNote };
}

/** The base terms with the amendment's changed fields applied. */
export function amendmentResultingTerms(row: CateringBookingAmendment): CateringAmendmentTerms {
  const fields = row.changedFields;
  const base = amendmentBaseTerms(row);
  return {
    eventDate: fields.includes("event_date") && row.eventDate ? row.eventDate : base.eventDate,
    guestCount: fields.includes("guest_count") ? row.guestCount : base.guestCount,
    priceCents: fields.includes("price_cents") ? row.priceCents : base.priceCents,
    currency: fields.includes("currency") && row.currency ? row.currency : base.currency,
    termsNote: fields.includes("terms_note") ? row.termsNote : base.termsNote,
  };
}

async function dateAvailable(tx: Executor, booking: Pick<CateringBooking, "providerId">, targetDate: string, now: Date): Promise<boolean> {
  const exceptions = await tx.select().from(cateringAvailabilityExceptions).where(and(eq(cateringAvailabilityExceptions.providerId, booking.providerId), lte(cateringAvailabilityExceptions.startDate, targetDate), gte(cateringAvailabilityExceptions.endDate, targetDate)));
  return evaluateBookingDateForConfirmation({ targetDate, currentDate: await providerCalendarDate(tx, booking.providerId, now), exceptions }).available;
}
const DATE_UNAVAILABLE_MESSAGE = "That event date is in the past or explicitly blocked on the provider's calendar, so the booking cannot move to it.";

export type ProposeResult = AmendmentRefusal | { kind: "created" | "duplicate"; amendment: CateringBookingAmendment; booking: CateringBooking; role: "provider" | "customer" };

export async function proposeCateringAmendment(tx: Executor, input: { bookingId: string; userId: string; proposal: CateringAmendmentProposalInput; now: Date }): Promise<ProposeResult> {
  const booking = await lockCateringBookingForNegotiation(tx, input.bookingId);
  const role = booking ? bookingActor(booking, input.userId) : null;
  if (!booking || !role) return refuse(404, "Booking not found");
  const amendments = await listCateringAmendments(tx, booking.id);
  // A retry of a submission that already landed is answered with that row, whatever state the booking has reached since.
  const retried = amendments.find((row) => row.proposedByUserId === input.userId && row.clientRequestId === input.proposal.clientRequestId);
  if (retried) return { kind: "duplicate", amendment: retried, booking, role };
  if (booking.status !== "confirmed") return refuse(409, CATERING_AMENDMENT_CLOSED_MESSAGE, "amendment_closed");
  const accepted = latestAcceptedAmendment(amendments);
  if ((accepted?.id ?? null) !== input.proposal.expectedBaseAmendmentId) return refuse(409, CATERING_AMENDMENT_STALE_MESSAGE, "stale_terms");
  if (pendingAmendment(amendments)) return refuse(409, "Another amendment is already waiting for a response. Wait for it to be answered or withdrawn.", "amendment_pending");
  if (amendments.length >= CATERING_AMENDMENT_HISTORY_LIMIT) return refuse(409, "This booking has reached its amendment limit.", "history_limit");
  const base = bookingTerms(booking, await currentTermsNote(tx, booking.id, amendments));
  const fields = changedAmendmentFields(base, input.proposal);
  if (fields.length === 0) return refuse(409, "Nothing in this proposal differs from the booking's current terms.", "no_change");
  if (changesBillingSensitiveFields(fields) && await cateringBillingLedgerActive(tx, booking.id)) return refuse(409, CATERING_AMENDMENT_BILLING_LOCKED_MESSAGE, "billing_terms_locked");
  if (fields.includes("event_date") && !(await dateAvailable(tx, booking, input.proposal.eventDate!, input.now))) return refuse(409, DATE_UNAVAILABLE_MESSAGE, "date_unavailable");
  const [inserted] = await tx.insert(cateringBookingAmendments).values({
    bookingId: booking.id, amendmentNumber: (amendments.length ? amendments[amendments.length - 1].amendmentNumber : 0) + 1,
    proposedByUserId: input.userId, proposedByRole: role, clientRequestId: input.proposal.clientRequestId, changedFields: fields,
    baseAcceptedAmendmentId: accepted?.id ?? null, baseEventDate: base.eventDate, baseGuestCount: base.guestCount, basePriceCents: base.priceCents, baseCurrency: base.currency, baseTermsNote: base.termsNote,
    eventDate: fields.includes("event_date") ? input.proposal.eventDate! : null,
    guestCount: fields.includes("guest_count") ? input.proposal.guestCount ?? null : null,
    priceCents: fields.includes("price_cents") ? input.proposal.priceCents ?? null : null,
    currency: fields.includes("currency") ? input.proposal.currency! : null,
    termsNote: fields.includes("terms_note") ? input.proposal.termsNote ?? null : null,
    message: input.proposal.message ?? null,
  }).returning();
  return { kind: "created", amendment: inserted, booking, role };
}

export type AmendmentAction = "accept" | "decline" | "withdraw";
export type RespondResult = AmendmentRefusal | { kind: "done" | "duplicate"; amendment: CateringBookingAmendment; booking: CateringBooking; role: "provider" | "customer" };
const TARGET_STATUS = { accept: "accepted", decline: "declined", withdraw: "withdrawn" } as const;

async function closePending(tx: Executor, id: string, status: "accepted" | "declined" | "withdrawn" | "superseded", userId: string | null, now: Date): Promise<CateringBookingAmendment | undefined> {
  const [row] = await tx.update(cateringBookingAmendments).set({ status, respondedByUserId: userId, respondedAt: now })
    .where(and(eq(cateringBookingAmendments.id, id), eq(cateringBookingAmendments.status, "pending"))).returning();
  return row;
}

export async function respondToCateringAmendment(tx: Executor, input: { bookingId: string; amendmentId: string; userId: string; action: AmendmentAction; now: Date }): Promise<RespondResult> {
  const booking = await lockCateringBookingForNegotiation(tx, input.bookingId);
  const role = booking ? bookingActor(booking, input.userId) : null;
  if (!booking || !role) return refuse(404, "Booking not found");
  const amendments = await listCateringAmendments(tx, booking.id);
  const amendment = amendments.find((row) => row.id === input.amendmentId);
  if (!amendment) return refuse(404, "Amendment not found");
  const target = TARGET_STATUS[input.action];
  // The same participant repeating the response that already landed is a retry, not a conflict; nothing is written again.
  if (amendment.status === target && amendment.respondedByUserId === input.userId) return { kind: "duplicate", amendment, booking, role };
  if (amendment.status !== "pending") return refuse(409, "This amendment has already been answered.", "amendment_not_pending");
  const isProposer = amendment.proposedByUserId === input.userId;
  if (input.action === "withdraw" ? !isProposer : isProposer) {
    return input.action === "withdraw" ? refuse(403, "Only the person who proposed an amendment can withdraw it.", "not_proposer") : refuse(403, "You proposed this amendment. The other party has to respond to it.", "not_counterparty");
  }
  if (booking.status !== "confirmed") {
    // A pending amendment cannot outlive its booking's amendable life; it is closed so it can never be accepted later.
    await closePending(tx, amendment.id, "superseded", null, input.now);
    return refuse(409, CATERING_AMENDMENT_CLOSED_MESSAGE, "amendment_closed");
  }
  if (input.action !== "accept") {
    const closed = await closePending(tx, amendment.id, target, input.userId, input.now);
    if (!closed) throw new Error("amendment was not pending after its lock");
    return { kind: "done", amendment: closed, booking, role };
  }

  // Acceptance. Everything below is judged against the booking as it is NOW, under its lock, not as it was at proposal time.
  const accepted = latestAcceptedAmendment(amendments);
  const base = amendmentBaseTerms(amendment);
  const current = bookingTerms(booking, base.termsNote);
  const termsMoved = (accepted?.id ?? null) !== amendment.baseAcceptedAmendmentId
    || current.eventDate !== base.eventDate || current.guestCount !== base.guestCount || current.priceCents !== base.priceCents || current.currency !== base.currency
    || (await currentTermsNote(tx, booking.id, amendments)) !== base.termsNote;
  if (termsMoved) {
    await closePending(tx, amendment.id, "superseded", null, input.now);
    return refuse(409, CATERING_AMENDMENT_STALE_MESSAGE, "stale_terms");
  }
  if (changesBillingSensitiveFields(amendment.changedFields) && await cateringBillingLedgerActive(tx, booking.id)) return refuse(409, CATERING_AMENDMENT_BILLING_LOCKED_MESSAGE, "billing_terms_locked");
  if (amendment.changedFields.includes("event_date") && !(await dateAvailable(tx, booking, amendment.eventDate!, input.now))) return refuse(409, DATE_UNAVAILABLE_MESSAGE, "date_unavailable");
  const result = amendmentResultingTerms(amendment);
  const [updated] = await tx.update(cateringBookings).set({
    eventDate: result.eventDate, guestCount: result.guestCount, currency: result.currency,
    agreedPrice: result.priceCents === null ? null : cateringCentsToDecimal(result.priceCents), updatedAt: input.now,
  }).where(and(eq(cateringBookings.id, booking.id), eq(cateringBookings.status, "confirmed"))).returning();
  if (!updated) throw new Error("amended booking was not confirmed after its lock");
  const closed = await closePending(tx, amendment.id, "accepted", input.userId, input.now);
  if (!closed) throw new Error("amendment was not pending after its lock");
  return { kind: "done", amendment: closed, booking: updated, role };
}

/** The amendments as one participant may see them. Internal attribution and the retry key are not part of it. */
export async function buildCateringAmendmentsView(executor: Executor, booking: CateringBooking, role: "provider" | "customer"): Promise<CateringAmendmentsView> {
  const amendments = await listCateringAmendments(executor, booking.id);
  const pending = pendingAmendment(amendments);
  const accepted = latestAcceptedAmendment(amendments);
  // A booking that ended with an amendment still pending (cancel and complete deliberately know nothing of amendments) shows it as
  // closed; it can no longer be answered, and the first attempt to answer it closes the row for good.
  const ended = booking.status !== "confirmed";
  const shown = (row: CateringBookingAmendment) => serializeCateringAmendment(ended && row.status === "pending" ? { ...row, status: "superseded" } : row);
  const views = amendments.map(shown).reverse();
  return {
    bookingId: booking.id, role, bookingStatus: booking.status as CateringAmendmentsView["bookingStatus"],
    currentTerms: bookingTerms(booking, await currentTermsNote(executor, booking.id, amendments)),
    originalTerms: amendments.length ? amendmentBaseTerms(amendments[0]) : null,
    latestAcceptedAmendmentId: accepted?.id ?? null,
    pending: pending && !ended ? shown(pending) : null,
    amendments: views,
    billingTermsLocked: await cateringBillingLedgerActive(executor, booking.id),
    actions: cateringAmendmentActions({ role, bookingStatus: booking.status, pendingProposedBy: pending ? (pending.proposedByRole === "customer" ? "customer" : "provider") : null, historyFull: amendments.length >= CATERING_AMENDMENT_HISTORY_LIMIT }),
  };
}
