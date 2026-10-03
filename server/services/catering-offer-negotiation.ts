import { and, asc, eq, ne } from "drizzle-orm";
import { cateringBookingInvoices, cateringBookingPayments, cateringBookings, cateringOfferRevisions, type CateringBooking, type CateringOfferRevision } from "@shared/schema";
import { cateringCentsToDecimal, cateringMoneyToCents } from "@shared/catering-booking-billing";
import {
  CATERING_OFFER_HISTORY_LIMIT, cateringOfferActions, cateringOfferNegotiationState,
  type CateringOfferErrorCode, type CateringOfferNegotiationView, type CateringOfferTermsInput,
} from "@shared/catering-offers";
import { serializeCateringOfferRevision } from "../serializers/catering-offer-revision";
import type { db } from "../db";

type Executor = typeof db;

/**
 * Phase 2N negotiation, one booking at a time.
 *
 * Every mutation here runs inside the caller's transaction and starts by taking the BOOKING row's lock. That single lock
 * is what serializes a provider revision against a customer acceptance, two provider revisions against each other, a
 * change request against a revision, and any of them against a cancellation (which updates the same row): whichever
 * transaction gets the lock first writes, and the others then judge the state it left. The unique constraints on the
 * revision table are only the backstop behind it.
 *
 * "Current" is not stored. The current offer is the offer revision with the highest number, so there cannot be two of
 * them, and a revision stops being current the instant a higher one commits.
 */

export async function lockCateringBookingForNegotiation(tx: Executor, bookingId: string): Promise<CateringBooking | undefined> {
  const [row] = await tx.select().from(cateringBookings).where(eq(cateringBookings.id, bookingId)).limit(1).for("update");
  return row;
}

/** The whole negotiation, oldest first. Bounded by construction: no write is accepted past CATERING_OFFER_HISTORY_LIMIT rows. */
export async function listCateringOfferRevisions(executor: Executor, bookingId: string): Promise<CateringOfferRevision[]> {
  return executor.select().from(cateringOfferRevisions).where(eq(cateringOfferRevisions.bookingId, bookingId)).orderBy(asc(cateringOfferRevisions.revisionNumber)).limit(CATERING_OFFER_HISTORY_LIMIT);
}

export function currentCateringOffer(revisions: readonly CateringOfferRevision[]): CateringOfferRevision | null {
  for (let index = revisions.length - 1; index >= 0; index -= 1) if (revisions[index].kind === "offer") return revisions[index];
  return null;
}

/** Whether the customer's latest word is still unanswered: nothing, offer or request, has been written after it. */
export function hasPendingCateringChangeRequest(revisions: readonly CateringOfferRevision[]): boolean {
  return revisions.length > 0 && revisions[revisions.length - 1].kind === "change_request";
}

/** The booking's own `numeric(12,2)` price, as the cents the negotiation speaks in. Null stays null: no price is not zero. */
export function bookingPriceCents(booking: Pick<CateringBooking, "agreedPrice">): number | null {
  return booking.agreedPrice === null ? null : cateringMoneyToCents(booking.agreedPrice);
}

/** The columns a revision's terms are written onto the booking as. Derived from cents, never the other way. */
export function bookingTermsFromRevision(revision: Pick<CateringOfferRevision, "priceCents" | "guestCount" | "currency">) {
  return {
    agreedPrice: revision.priceCents === null ? null : cateringCentsToDecimal(revision.priceCents),
    guestCount: revision.guestCount,
    currency: revision.currency,
  };
}

/**
 * Whether Phase 2L has real ledger activity for this booking: any invoice that has not been voided, or any payment row
 * (a voided payment is still part of the ledger's history). An inert deposit-terms row is deliberately NOT activity: it
 * is the provider's planning, asks the customer for nothing and freezes nothing by design. Read under the booking row
 * lock the caller already holds; invoice and payment writes take that same lock, so this answer cannot change under it.
 */
export async function cateringBillingLedgerActive(executor: Executor, bookingId: string): Promise<boolean> {
  const [invoice] = await executor.select({ id: cateringBookingInvoices.id }).from(cateringBookingInvoices)
    .where(and(eq(cateringBookingInvoices.bookingId, bookingId), ne(cateringBookingInvoices.status, "void"))).limit(1);
  if (invoice) return true;
  const [payment] = await executor.select({ id: cateringBookingPayments.id }).from(cateringBookingPayments).where(eq(cateringBookingPayments.bookingId, bookingId)).limit(1);
  return Boolean(payment);
}

/**
 * The only terms an invoice depends on are the agreed price (what a deposit or balance is derived from) and the currency
 * it is denominated in. Guest count and the terms note are not part of any billing row.
 */
export function changesBillingSensitiveTerms(booking: Pick<CateringBooking, "agreedPrice" | "currency">, proposed: { priceCents: number | null; currency: string }): boolean {
  return bookingPriceCents(booking) !== proposed.priceCents || booking.currency !== proposed.currency;
}

export const CATERING_BILLING_TERMS_LOCKED_MESSAGE = "Billing has started for this booking, so its price and currency can no longer change. You can still update the guest count or the terms description.";

const bookingIsOpen = (booking: Pick<CateringBooking, "status" | "customerConfirmedAt">) => booking.status === "pending_confirmation" && booking.customerConfirmedAt === null;

export type NegotiationRefusal = { kind: "refused"; status: 404 | 409; code?: CateringOfferErrorCode; message: string };
const refuse = (status: 404 | 409, message: string, code?: CateringOfferErrorCode): NegotiationRefusal => ({ kind: "refused", status, message, code });
export const CATERING_OFFER_CLOSED_MESSAGE = "This offer can no longer be changed. Open the booking for its current status.";
const STALE_MESSAGE = "The offer changed while you were looking at it. Review the latest terms and try again.";

export type CateringOfferRevisionTerms = Pick<CateringOfferTermsInput, "priceCents" | "guestCount" | "note" | "currency">;

export type ProviderRevisionResult =
  | NegotiationRefusal
  | { kind: "created" | "duplicate"; revision: CateringOfferRevision; booking: CateringBooking };

/**
 * A provider's new offer revision. Also the shape of the very first revision of an offer: `expectedRevisionId` null means
 * "I was looking at an offer with no revisions", which is true of a brand-new booking and of a legacy one alike.
 */
export async function createProviderOfferRevision(tx: Executor, input: { bookingId: string; providerId: string; terms: CateringOfferRevisionTerms; expectedRevisionId: string | null; clientRequestId: string; now: Date }): Promise<ProviderRevisionResult> {
  const booking = await lockCateringBookingForNegotiation(tx, input.bookingId);
  if (!booking || booking.providerId !== input.providerId) return refuse(404, "Booking not found");
  const revisions = await listCateringOfferRevisions(tx, booking.id);
  const retried = revisions.find((row) => row.proposedByUserId === input.providerId && row.clientRequestId === input.clientRequestId);
  if (retried) return { kind: "duplicate", revision: retried, booking };
  if (!bookingIsOpen(booking)) return refuse(409, CATERING_OFFER_CLOSED_MESSAGE, "negotiation_closed");
  const current = currentCateringOffer(revisions);
  if ((current?.id ?? null) !== input.expectedRevisionId) return refuse(409, STALE_MESSAGE, "stale_revision");
  // Judged under the booking lock, against what the booking itself carries (which is what every invoice was derived from), so a legacy
  // offer that already has an invoice cannot enter the revision history with a different price or currency either.
  if (changesBillingSensitiveTerms(booking, { priceCents: input.terms.priceCents ?? null, currency: input.terms.currency }) && await cateringBillingLedgerActive(tx, booking.id)) return refuse(409, CATERING_BILLING_TERMS_LOCKED_MESSAGE, "billing_terms_locked");
  if (revisions.length >= CATERING_OFFER_HISTORY_LIMIT) return refuse(409, "This negotiation has reached its revision limit. Cancel it and start a new request.", "revision_limit");
  const revision = await insertRevision(tx, booking, revisions, {
    kind: "offer", userId: input.providerId, role: "provider", clientRequestId: input.clientRequestId, respondsToRevisionId: null,
    priceCents: input.terms.priceCents ?? null, guestCount: input.terms.guestCount ?? null, note: input.terms.note ?? null, currency: input.terms.currency,
  });
  // The booking mirrors the current offer, in this same transaction, so a reader never sees terms the history disagrees with.
  const [synced] = await tx.update(cateringBookings).set({ ...bookingTermsFromRevision(revision), providerConfirmedAt: input.now, updatedAt: input.now })
    .where(and(eq(cateringBookings.id, booking.id), eq(cateringBookings.status, "pending_confirmation"))).returning();
  if (!synced) throw new Error("offer booking was not pending after its lock");
  return { kind: "created", revision, booking: synced };
}

export type ChangeRequestResult =
  | NegotiationRefusal
  | { kind: "created" | "duplicate"; revision: CateringOfferRevision; booking: CateringBooking };

/**
 * A customer's request for changes. It is a row in the negotiation and nothing more: the booking's terms are not read
 * for update, let alone written, so the customer cannot move any provider-owned term by asking.
 */
export async function createCustomerChangeRequest(tx: Executor, input: { bookingId: string; customerId: string; revisionId: string | null; message: string; clientRequestId: string }): Promise<ChangeRequestResult> {
  const booking = await lockCateringBookingForNegotiation(tx, input.bookingId);
  if (!booking || booking.customerId !== input.customerId) return refuse(404, "Booking not found");
  const revisions = await listCateringOfferRevisions(tx, booking.id);
  const retried = revisions.find((row) => row.proposedByUserId === input.customerId && row.clientRequestId === input.clientRequestId);
  if (retried) return { kind: "duplicate", revision: retried, booking };
  if (!bookingIsOpen(booking)) return refuse(409, CATERING_OFFER_CLOSED_MESSAGE, "negotiation_closed");
  const current = currentCateringOffer(revisions);
  if ((current?.id ?? null) !== input.revisionId) return refuse(409, STALE_MESSAGE, "stale_revision");
  if (hasPendingCateringChangeRequest(revisions)) return refuse(409, "You already asked for changes. Wait for the caterer to respond.", "change_request_pending");
  if (revisions.length >= CATERING_OFFER_HISTORY_LIMIT) return refuse(409, "This negotiation has reached its revision limit. Cancel it and start a new request.", "revision_limit");
  const revision = await insertRevision(tx, booking, revisions, {
    kind: "change_request", userId: input.customerId, role: "customer", clientRequestId: input.clientRequestId, respondsToRevisionId: current?.id ?? null,
    priceCents: null, guestCount: null, note: input.message, currency: booking.currency,
  });
  return { kind: "created", revision, booking };
}

async function insertRevision(tx: Executor, booking: CateringBooking, existing: readonly CateringOfferRevision[], row: { kind: "offer" | "change_request"; userId: string; role: "provider" | "customer"; clientRequestId: string; respondsToRevisionId: string | null; priceCents: number | null; guestCount: number | null; note: string | null; currency: string }): Promise<CateringOfferRevision> {
  const revisionNumber = (existing.length ? existing[existing.length - 1].revisionNumber : 0) + 1;
  const [inserted] = await tx.insert(cateringOfferRevisions).values({
    bookingId: booking.id, revisionNumber, kind: row.kind, proposedByUserId: row.userId, proposedByRole: row.role, clientRequestId: row.clientRequestId,
    respondsToRevisionId: row.respondsToRevisionId, priceCents: row.priceCents, currency: row.currency, guestCount: row.guestCount, note: row.note,
  }).returning();
  return inserted;
}

export type AcceptanceResolution =
  | NegotiationRefusal
  | { kind: "ok"; revision: CateringOfferRevision | null };

/**
 * Which terms the customer is accepting, judged under the booking lock the caller already holds. A booking that has
 * offer revisions can only be accepted by naming the CURRENT one; a legacy offer, which has none, only by naming none.
 * Anything else means the terms moved under the customer, and nothing is confirmed.
 */
export function resolveCateringOfferAcceptance(revisions: readonly CateringOfferRevision[], revisionId: string | null): AcceptanceResolution {
  const current = currentCateringOffer(revisions);
  if (!current) return revisionId === null ? { kind: "ok", revision: null } : refuse(409, STALE_MESSAGE, "stale_revision");
  if (revisionId === null) return refuse(409, "Review the latest offer before accepting it.", "offer_revision_required");
  return current.id === revisionId ? { kind: "ok", revision: current } : refuse(409, STALE_MESSAGE, "stale_revision");
}

/** True when a customer's retry names something other than what was actually accepted. */
export function acceptanceRetryContradictsAccepted(revisions: readonly CateringOfferRevision[], revisionId: string | null | undefined): boolean {
  if (revisionId === null || revisionId === undefined) return false;
  const accepted = revisions.find((row) => row.acceptedAt !== null);
  return accepted ? accepted.id !== revisionId : false;
}

export async function stampCateringOfferAccepted(tx: Executor, revision: CateringOfferRevision, now: Date): Promise<void> {
  const stamped = await tx.update(cateringOfferRevisions).set({ acceptedAt: now })
    .where(and(eq(cateringOfferRevisions.id, revision.id), eq(cateringOfferRevisions.kind, "offer"))).returning({ id: cateringOfferRevisions.id });
  if (stamped.length !== 1) throw new Error("accepted revision could not be stamped");
}

/** The negotiation as one participant may see it. Provider-private data and internal attribution are not part of it. */
export function buildCateringOfferNegotiationView(booking: CateringBooking, role: "provider" | "customer", revisions: readonly CateringOfferRevision[]): CateringOfferNegotiationView {
  const current = currentCateringOffer(revisions);
  const numbers = new Map(revisions.map((row) => [row.id, row.revisionNumber]));
  const changeRequestPending = booking.status === "pending_confirmation" && hasPendingCateringChangeRequest(revisions);
  return {
    bookingId: booking.id,
    role,
    bookingStatus: booking.status as CateringOfferNegotiationView["bookingStatus"],
    state: cateringOfferNegotiationState(booking.status),
    legacy: current === null,
    currentRevisionId: current?.id ?? null,
    legacyTerms: current === null ? { priceCents: bookingPriceCents(booking), currency: booking.currency, guestCount: booking.guestCount, offeredAt: booking.providerConfirmedAt ? booking.providerConfirmedAt.toISOString() : null } : null,
    changeRequestPending,
    actions: cateringOfferActions({ role, bookingStatus: booking.status, customerConfirmedAt: booking.customerConfirmedAt !== null, changeRequestPending, historyFull: revisions.length >= CATERING_OFFER_HISTORY_LIMIT }),
    revisions: revisions.map((row) => serializeCateringOfferRevision(row, { currentId: current?.id ?? null, respondsToNumber: row.respondsToRevisionId ? numbers.get(row.respondsToRevisionId) ?? null : null })).reverse(),
  };
}

export type FirstOfferTerms = { priceCents: number | null; guestCount: number | null; note: string | null; currency: string };

/**
 * Whether a first-offer request that finds its inquiry already booked is a true retry of the offer that was written.
 * The comparison is between canonical stored values and the terms this request would itself have written: the first
 * offer revision when there is one, otherwise (a pre-2N offer) the booking's own columns. Cents compare as integers,
 * a guest count of null is "cleared" and never equal to a number, and a blank note is the same as none because that is
 * how a note is stored. No display string is involved. Anything that differs means the offer already exists with
 * other terms, and the request must not be answered as if its terms had been saved.
 */
export function firstOfferRetryMatches(existing: { booking: Pick<CateringBooking, "agreedPrice" | "guestCount" | "currency">; revisions: readonly CateringOfferRevision[] }, submitted: FirstOfferTerms): boolean {
  const first = existing.revisions.find((row) => row.kind === "offer") ?? null;
  const persisted: FirstOfferTerms = first
    ? { priceCents: first.priceCents, guestCount: first.guestCount, note: first.note ?? null, currency: first.currency }
    : { priceCents: bookingPriceCents(existing.booking), guestCount: existing.booking.guestCount, note: null, currency: existing.booking.currency };
  return persisted.priceCents === submitted.priceCents && persisted.guestCount === submitted.guestCount && persisted.note === (submitted.note ?? null) && persisted.currency === submitted.currency;
}

export const CATERING_OFFER_ALREADY_EXISTS_MESSAGE = "An offer already exists for this request, and the terms you sent are not the ones it was made with. It has been refreshed; use Revise offer on the booking to change its terms.";

/**
 * A last, independent check at acceptance: terms about to be written onto a booking whose ledger is live must not move its
 * price or currency. Revisions are refused for that already, and the booking mirrors the current revision, so this should
 * never fire; it exists so confirming can never be the way a ledger and a booking come to disagree.
 */
export async function acceptanceWouldContradictBilling(tx: Executor, booking: Pick<CateringBooking, "id" | "agreedPrice" | "currency">, revision: Pick<CateringOfferRevision, "priceCents" | "currency"> | null): Promise<boolean> {
  if (!revision || !changesBillingSensitiveTerms(booking, revision)) return false;
  return cateringBillingLedgerActive(tx, booking.id);
}
