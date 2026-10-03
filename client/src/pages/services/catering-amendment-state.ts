import { cateringBookingBillingKey, cateringMoneyToCents } from "@shared/catering-booking-billing";
import { cateringBookingWorkspaceKey } from "@shared/catering-booking-operations";
import { calendarDateParts } from "@shared/catering-availability";
import { CATERING_OFFER_GUEST_MAX, CATERING_OFFER_NOTE_MAX_LENGTH } from "@shared/catering-offers";
import { CATERING_CURRENCY_PATTERN, cateringAmendmentsKey, isCateringAmendmentConflict, type CateringAmendmentTerms } from "@shared/catering-amendments";

export { cateringAmendmentsKey };

export type CateringAmendmentAction = "propose" | "accept" | "decline" | "withdraw";
export type AmendmentIdentity = { userId: string; bookingId: string };

export class CateringAmendmentRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) { super(message); }
  /** The amendment or the booking moved under the user: show the newest state, do not retry the old request. */
  get isConflict() { return this.status === 409 && isCateringAmendmentConflict(this.code); }
  /** Not a stale view: the form stays open with the explanation (billing started, or the date is unavailable). */
  get isRefusal() { return this.status === 409 && (this.code === "billing_terms_locked" || this.code === "date_unavailable" || this.code === "no_change"); }
}

/**
 * Everything an amendment can change on screen. An accepted amendment rewrites the booking's own terms, so both people's
 * workspace and booking lists are refreshed, and so is the billing view that derives its total from the agreed price.
 * Every key carries the acting user's id; another user's cache is never named.
 */
export function cateringAmendmentInvalidationKeys(input: { surfaceUserId: string; bookingId: string; action: CateringAmendmentAction }) {
  const keys: (readonly string[])[] = [
    cateringAmendmentsKey(input.surfaceUserId, input.bookingId),
    cateringBookingWorkspaceKey(input.surfaceUserId, input.bookingId),
    ["catering", "bookings", input.surfaceUserId],
  ];
  if (input.action === "accept") keys.push(cateringBookingBillingKey(input.surfaceUserId, input.bookingId));
  return keys;
}

/** A response belongs on screen only if the user and booking it was sent for are still the ones being shown. */
export function isCurrentAmendmentTarget(shown: AmendmentIdentity, submitted: AmendmentIdentity): boolean {
  return shown.userId === submitted.userId && shown.bookingId === submitted.bookingId;
}

export type AmendmentDraft = { eventDate: string; guestCount: string; price: string; currency: string; termsNote: string; message: string };
export type AmendmentDraftErrors = Partial<Record<keyof AmendmentDraft, string>> & { form?: string };

const centsText = (cents: number | null) => (cents === null ? "" : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`);

/** The editor starts from the terms in force, so a proposal changes only what the person edits. */
export function amendmentDraftFromTerms(terms: CateringAmendmentTerms): AmendmentDraft {
  return { eventDate: terms.eventDate, guestCount: terms.guestCount === null ? "" : String(terms.guestCount), price: centsText(terms.priceCents), currency: terms.currency, termsNote: terms.termsNote ?? "", message: "" };
}

export type AmendmentProposalBody = { eventDate?: string; guestCount?: number | null; priceCents?: number | null; currency?: string; termsNote?: string | null; message?: string };

/**
 * Turns what was typed into ONLY the terms that differ from the ones in force; an untouched field is absent, never resent,
 * so a proposal can neither restore an old value nor clear one by accident. A blank guest count / price / description is
 * an explicit clear. Money is parsed from text to cents once, by the billing phase's string parser. The server validates
 * all of this again and is the authority.
 */
export function buildAmendmentProposal(draft: AmendmentDraft, current: CateringAmendmentTerms, options: { billingTermsLocked: boolean }): { ok: true; body: AmendmentProposalBody } | { ok: false; errors: AmendmentDraftErrors } {
  const errors: AmendmentDraftErrors = {};
  const body: AmendmentProposalBody = {};
  if (draft.eventDate !== current.eventDate) {
    if (calendarDateParts(draft.eventDate) === null) errors.eventDate = "Choose a valid event date";
    else body.eventDate = draft.eventDate;
  }
  const guestText = draft.guestCount.trim();
  if (guestText !== centsFreeGuestText(current.guestCount)) {
    if (guestText === "") body.guestCount = null;
    else if (!/^\d+$/.test(guestText) || Number(guestText) < 1 || Number(guestText) > CATERING_OFFER_GUEST_MAX) errors.guestCount = `Enter a whole number of guests from 1 to ${CATERING_OFFER_GUEST_MAX.toLocaleString()}`;
    else body.guestCount = Number(guestText);
  }
  const priceText = draft.price.trim().replace(/^\$/, "").replace(/,/g, "");
  if (priceText !== centsText(current.priceCents)) {
    const cents = priceText === "" ? null : cateringMoneyToCents(priceText);
    if (priceText !== "" && cents === null) errors.price = "Enter an amount such as 1250 or 1250.50";
    else if (cents !== current.priceCents) {
      if (options.billingTermsLocked) errors.price = "Billing has started, so the price can no longer change.";
      else body.priceCents = cents;
    }
  }
  // Canonical form is upper-case; only a code that differs from the one in force is a change, and it is judged against the same pattern the server uses.
  const currency = draft.currency.trim().toUpperCase();
  if (currency !== current.currency) {
    if (!CATERING_CURRENCY_PATTERN.test(currency)) errors.currency = "Enter a 3-letter currency code such as USD or EUR";
    else if (options.billingTermsLocked) errors.currency = "Billing has started, so the currency can no longer change.";
    else body.currency = currency;
  }
  const note = draft.termsNote.trim();
  if (note !== (current.termsNote ?? "")) {
    if (note.length > CATERING_OFFER_NOTE_MAX_LENGTH) errors.termsNote = `Terms can be at most ${CATERING_OFFER_NOTE_MAX_LENGTH} characters`;
    else body.termsNote = note === "" ? null : note;
  }
  const message = draft.message.trim();
  if (message.length > 1000) errors.message = "A message can be at most 1000 characters";
  else if (message !== "") body.message = message;
  if (Object.keys(errors).length) return { ok: false, errors };
  if (body.eventDate === undefined && body.guestCount === undefined && body.priceCents === undefined && body.currency === undefined && body.termsNote === undefined) return { ok: false, errors: { form: "Change at least one term to propose an amendment." } };
  return { ok: true, body };
}

const centsFreeGuestText = (guestCount: number | null) => (guestCount === null ? "" : String(guestCount));
