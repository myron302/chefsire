import { cateringMoneyToCents } from "@shared/catering-booking-billing";
import {
  CATERING_OFFER_GUEST_MAX, CATERING_OFFER_NOTE_MAX_LENGTH, cateringOfferRevisionKey, isCateringOfferConflict,
  type CateringOfferNegotiationView, type CateringOfferTermsInput,
} from "@shared/catering-offers";
import { cateringBookingWorkspaceKey } from "@shared/catering-booking-operations";
import { cateringCustomerInquiriesKey } from "./catering-customer-inquiry-state";
import { cateringProviderInquiryKey } from "./catering-inquiry-booking-state";

export { cateringOfferRevisionKey };

export type CateringOfferAction = "revise" | "request-changes" | "accept" | "decline";

/**
 * What a negotiation action refreshes: this booking's offer for the acting user, the booking lists and workspace that show
 * its terms, and the provider-side projections the booking feeds. Nothing is cleared globally, and another user's offer
 * cache is never named: every key carries the acting user's id or the provider's.
 */
export function cateringOfferInvalidationKeys(input: { surfaceUserId: string; providerId: string | null; bookingId: string; action: CateringOfferAction }) {
  const keys: (readonly string[])[] = [
    cateringOfferRevisionKey(input.surfaceUserId, input.bookingId),
    cateringBookingWorkspaceKey(input.surfaceUserId, input.bookingId),
    ["catering", "bookings", input.surfaceUserId],
  ];
  if (input.providerId) keys.push(["catering", "bookings", input.providerId], cateringProviderInquiryKey(input.providerId), ["catering", "dashboard", input.providerId]);
  // Only an acceptance or a decline changes what the customer's request list derives from the booking.
  if (input.action === "accept" || input.action === "decline") keys.push(cateringCustomerInquiriesKey(input.surfaceUserId));
  return keys.filter((key, index) => keys.findIndex((candidate) => candidate.join("\0") === key.join("\0")) === index);
}

export type OfferMutationIdentity = { userId: string; bookingId: string };

/** A response belongs on screen only if the user and booking it was sent for are still the ones being shown. */
export function isCurrentOfferTarget(shown: OfferMutationIdentity, submitted: OfferMutationIdentity): boolean {
  return shown.userId === submitted.userId && shown.bookingId === submitted.bookingId;
}

export class CateringOfferRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) { super(message); }
  /** The offer moved under the user: show the newest terms, do not retry the old request. */
  get isConflict() { return this.status === 409 && isCateringOfferConflict(this.code); }
}

export function newCateringClientRequestId(): string {
  const cryptoApi = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes); else for (let index = 0; index < 16; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type OfferDraft = { price: string; guestCount: string; note: string };
export type OfferDraftErrors = Partial<Record<keyof OfferDraft, string>>;

/** Pre-fills a revision with what is currently offered, so a revision changes only what the provider changes. */
export function offerDraftFromNegotiation(negotiation: Pick<CateringOfferNegotiationView, "legacy" | "legacyTerms" | "revisions" | "currentRevisionId">): OfferDraft {
  const current = negotiation.revisions.find((revision) => revision.id === negotiation.currentRevisionId);
  const priceCents = current ? current.priceCents : negotiation.legacyTerms?.priceCents ?? null;
  const guestCount = current ? current.guestCount : negotiation.legacyTerms?.guestCount ?? null;
  return { price: priceCents === null ? "" : `${Math.floor(priceCents / 100)}.${String(priceCents % 100).padStart(2, "0")}`, guestCount: guestCount === null ? "" : String(guestCount), note: current?.note ?? "" };
}

/**
 * Validates what the provider typed and converts it ONCE to the terms the server takes. The price is parsed from text by
 * the billing phase's string parser, so there is no float anywhere between the keyboard and the persisted cents. The
 * server validates all of this again; this exists so the form can say what is wrong before a request is made.
 */
export function validateOfferDraft(draft: OfferDraft, currency = "USD"): { ok: true; terms: Pick<CateringOfferTermsInput, "priceCents" | "guestCount" | "note" | "currency"> } | { ok: false; errors: OfferDraftErrors } {
  const errors: OfferDraftErrors = {};
  const priceText = draft.price.trim().replace(/^\$/, "").replace(/,/g, "");
  let priceCents: number | null = null;
  if (priceText !== "") {
    priceCents = cateringMoneyToCents(priceText);
    if (priceCents === null) errors.price = "Enter an amount such as 1250 or 1250.50";
  }
  const guestText = draft.guestCount.trim();
  let guestCount: number | null = null;
  if (guestText !== "") {
    if (!/^\d+$/.test(guestText) || Number(guestText) < 1 || Number(guestText) > CATERING_OFFER_GUEST_MAX) errors.guestCount = `Enter a whole number of guests from 1 to ${CATERING_OFFER_GUEST_MAX.toLocaleString()}`;
    else guestCount = Number(guestText);
  }
  const note = draft.note.trim();
  if (note.length > CATERING_OFFER_NOTE_MAX_LENGTH) errors.note = `Terms can be at most ${CATERING_OFFER_NOTE_MAX_LENGTH} characters`;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, terms: { priceCents, guestCount, note: note === "" ? undefined : note, currency } };
}

export function validateChangeRequestMessage(message: string): string | null {
  const trimmed = message.trim();
  if (trimmed === "") return "Describe the changes you would like";
  return trimmed.length > CATERING_OFFER_NOTE_MAX_LENGTH ? `Message can be at most ${CATERING_OFFER_NOTE_MAX_LENGTH} characters` : null;
}

export function offerAuthorLabel(proposedBy: "provider" | "customer", viewerRole: "provider" | "customer"): string {
  return proposedBy === viewerRole ? "You" : proposedBy === "provider" ? "Caterer" : "Customer";
}

// ------------------------------------------------------------------------------------------------------------
// Snapshots: what a gesture was made against stays fixed, whatever a refetch brings in underneath it.
// ------------------------------------------------------------------------------------------------------------

type NegotiationFacts = Pick<CateringOfferNegotiationView, "legacy" | "legacyTerms" | "revisions" | "currentRevisionId">;

/**
 * The provider's revise editor, bound to the exact revision that seeded its draft. The draft and the revision it was
 * written against travel together: a refetch that brings in a newer revision does not touch either, so submitting sends
 * the ORIGINAL revision id with the original fields and the server answers with its stale-revision conflict instead of
 * accepting old fields as a fresh revision on top of the new one.
 */
export type ReviseSession = { revisionId: string | null; revisionNumber: number | null; draft: OfferDraft };

export function openReviseSession(negotiation: NegotiationFacts): ReviseSession {
  const current = negotiation.revisions.find((revision) => revision.id === negotiation.currentRevisionId) ?? null;
  return { revisionId: negotiation.currentRevisionId, revisionNumber: current?.revisionNumber ?? null, draft: offerDraftFromNegotiation(negotiation) };
}

/** True once the offer on the server has moved past the revision this editor was opened on. */
export function isSessionBehind(session: { revisionId: string | null }, negotiation: Pick<CateringOfferNegotiationView, "currentRevisionId">): boolean {
  return session.revisionId !== negotiation.currentRevisionId;
}

export function reviseSubmissionTarget(session: ReviseSession): { expectedRevisionId: string | null } {
  return { expectedRevisionId: session.revisionId };
}

/** The terms a customer's acceptance dialog displayed, frozen with the revision they describe. */
export type AcceptSession = { revisionId: string | null; revisionNumber: number | null; priceCents: number | null; currency: string; guestCount: number | null };

export function openAcceptSession(negotiation: NegotiationFacts): AcceptSession | null {
  const current = negotiation.revisions.find((revision) => revision.id === negotiation.currentRevisionId) ?? null;
  if (current) return { revisionId: current.id, revisionNumber: current.revisionNumber, priceCents: current.priceCents, currency: current.currency, guestCount: current.guestCount };
  if (!negotiation.legacyTerms) return null;
  return { revisionId: null, revisionNumber: null, priceCents: negotiation.legacyTerms.priceCents, currency: negotiation.legacyTerms.currency, guestCount: negotiation.legacyTerms.guestCount };
}

export function acceptSubmissionTarget(session: AcceptSession): { revisionId: string | null } {
  return { revisionId: session.revisionId };
}

/** A change request answers the revision the customer was reading when they opened the form, not whichever is current at click time. */
export type ChangeRequestSession = { revisionId: string | null };
export function openChangeRequestSession(negotiation: Pick<CateringOfferNegotiationView, "currentRevisionId">): ChangeRequestSession {
  return { revisionId: negotiation.currentRevisionId };
}

// ------------------------------------------------------------------------------------------------------------
// Idempotency: a request id belongs to one exact payload.
// ------------------------------------------------------------------------------------------------------------

/**
 * A canonical, order-independent spelling of a submission: object keys sorted, `undefined` and absent the same thing,
 * strings trimmed. Two submissions that mean the same thing have the same fingerprint, and any change to what would be
 * sent -- a field, the revision it targets -- changes it.
 */
export function offerPayloadFingerprint(payload: Record<string, unknown>): string {
  const canonical = (value: unknown): unknown => {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, inner]) => inner !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, inner]) => [key, canonical(inner)]));
    }
    return value === undefined ? null : value;
  };
  return JSON.stringify(canonical(payload));
}

export type BoundRequestId = { id: string; fingerprint: string };

/**
 * The request id for this submission. An identical payload (a dropped connection, a double tap) keeps the id it already
 * has, so the server collapses the retry onto the revision it already wrote; a payload that differs in any way gets a
 * fresh id, so an edited retry is judged as the new submission it is and can never be answered with the earlier one's
 * stored result. Nothing is generated until a submission is actually made, and a rerender never calls this.
 */
export function bindClientRequestId(previous: BoundRequestId | null, payload: Record<string, unknown>, makeId: () => string = newCateringClientRequestId): BoundRequestId {
  const fingerprint = offerPayloadFingerprint(payload);
  return previous && previous.fingerprint === fingerprint ? previous : { id: makeId(), fingerprint };
}

/** The first offer was refused because the request already has one with other terms: refresh, never treat the form as saved. */
export function isOfferAlreadyExists(error: unknown): boolean {
  return error instanceof CateringOfferRequestError && error.status === 409 && error.code === "offer_already_exists";
}
