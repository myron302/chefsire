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
