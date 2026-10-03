import { z } from "zod";
import type { CateringBookingStatus } from "./catering-bookings";
import { cateringCentsToDecimal, cateringMoneyToCents } from "./catering-booking-billing";

/**
 * Phase 2N: pre-confirmation quote / offer negotiation.
 *
 * An offer is, and stays, a `catering_bookings` row in `pending_confirmation`. This module adds the persisted
 * negotiation history around that row: provider offer revisions and customer change requests. Money here is integer
 * cents everywhere; the booking's legacy `numeric(12,2)` price is only ever derived from these cents.
 */

export const CATERING_OFFER_PRICE_MAX_CENTS = 9_999_999_999;
export const CATERING_OFFER_GUEST_MAX = 100_000;
export const CATERING_OFFER_NOTE_MAX_LENGTH = 2000;
/** A negotiation holds at most this many rows (offer revisions and change requests together), which also bounds every history read. */
export const CATERING_OFFER_HISTORY_LIMIT = 50;

export const CATERING_OFFER_REVISION_KINDS = ["offer", "change_request"] as const;
export type CateringOfferRevisionKind = typeof CATERING_OFFER_REVISION_KINDS[number];

/**
 * Whole cents from a dollar figure sent by a pre-2N client, or null if it is not an exact non-negative amount with at
 * most two decimals. It goes through the same string parser the billing phase uses on the booking column, so a float
 * artefact such as 0.1 + 0.2 is refused rather than rounded into money.
 */
export function dollarsToCents(dollars: number): number | null {
  return Number.isFinite(dollars) ? cateringMoneyToCents(String(dollars)) : null;
}

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const priceCentsSchema = z.number().int("Price must be a whole number of cents").min(0, "Price cannot be negative").max(CATERING_OFFER_PRICE_MAX_CENTS, "Price is too large");
const guestCountSchema = z.number().int("Guest count must be a whole number").min(1, "Guest count must be at least 1").max(CATERING_OFFER_GUEST_MAX, "Guest count is too large");
const noteSchema = z.preprocess(blankToUndefined, z.string().trim().max(CATERING_OFFER_NOTE_MAX_LENGTH, `Terms can be at most ${CATERING_OFFER_NOTE_MAX_LENGTH} characters`).optional());
const clientRequestIdSchema = z.string().uuid("A request id is required");
const revisionIdSchema = z.string().uuid();

/** The negotiable terms a provider can put on an offer. Everything is optional: an offer may carry only a price, only a note, or neither. */
export const cateringOfferTermsSchema = z.object({
  priceCents: priceCentsSchema.nullish(),
  guestCount: guestCountSchema.nullish(),
  note: noteSchema,
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code").default("USD"),
}).strict();
export type CateringOfferTermsInput = z.infer<typeof cateringOfferTermsSchema>;

/**
 * The body of the existing `provider-confirm` offer. A pre-2N client sends `agreedPrice` in dollars and nothing else; it is
 * accepted as before, converted to cents exactly once, and rejected if it is not an exact two-decimal amount. Supplying
 * both spellings of the price is ambiguous and refused. The result is always expressed as cents.
 */
export const cateringFirstOfferSchema = cateringOfferTermsSchema.extend({
  agreedPrice: z.coerce.number().finite().min(0).max(99_999_999.99).optional(),
}).strict().transform((input, context) => {
  if (input.agreedPrice !== undefined && input.priceCents !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Send the price once, as priceCents or agreedPrice" });
    return z.NEVER;
  }
  const priceCents = input.agreedPrice !== undefined ? dollarsToCents(input.agreedPrice) : input.priceCents ?? null;
  if (input.agreedPrice !== undefined && priceCents === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Price must be an exact amount with at most two decimals" });
    return z.NEVER;
  }
  return { priceCents, guestCount: input.guestCount, note: input.note, currency: input.currency };
});

/**
 * A provider revision. `expectedRevisionId` names the offer revision the provider was looking at (null when they were
 * looking at a legacy offer that has no revisions); the server refuses it if that is no longer the current one.
 * `clientRequestId` makes a retry of the same submission resolve to the same revision instead of a second one.
 */
export const cateringOfferRevisionRequestSchema = cateringOfferTermsSchema.extend({
  expectedRevisionId: revisionIdSchema.nullable(),
  clientRequestId: clientRequestIdSchema,
}).strict();

export const cateringOfferChangeRequestSchema = z.object({
  /** The offer revision being responded to; null only for a legacy offer that has no revisions. */
  revisionId: revisionIdSchema.nullable(),
  message: z.string().trim().min(1, "Describe the changes you would like").max(CATERING_OFFER_NOTE_MAX_LENGTH, `Message can be at most ${CATERING_OFFER_NOTE_MAX_LENGTH} characters`),
  clientRequestId: clientRequestIdSchema,
}).strict();

/** Body of the existing customer confirmation. Absent / null means "the legacy offer"; the server decides if that is still true. */
export const cateringOfferAcceptSchema = z.object({ revisionId: revisionIdSchema.nullish() }).strict();

export const CATERING_OFFER_ERROR_CODES = ["stale_revision", "offer_revision_required", "negotiation_closed", "change_request_pending", "revision_limit"] as const;
export type CateringOfferErrorCode = typeof CATERING_OFFER_ERROR_CODES[number];

export type CateringOfferRevisionView = {
  id: string;
  revisionNumber: number;
  kind: CateringOfferRevisionKind;
  proposedBy: "provider" | "customer";
  createdAt: string;
  priceCents: number | null;
  currency: string;
  guestCount: number | null;
  /** Provider: the customer-visible terms text. Customer: the requested changes. */
  note: string | null;
  /** For a change request, the number of the offer revision it responds to (null when it responded to a legacy offer). */
  respondsToRevisionNumber: number | null;
  /** True only on the one offer revision the customer can currently accept. */
  isCurrent: boolean;
  acceptedAt: string | null;
};

export type CateringOfferLegacyTerms = { priceCents: number | null; currency: string; guestCount: number | null; offeredAt: string | null };

export type CateringOfferNegotiationState = "open" | "accepted" | "closed";

export type CateringOfferNegotiationView = {
  bookingId: string;
  role: "provider" | "customer";
  bookingStatus: CateringBookingStatus;
  /** open: terms can still change; accepted: confirmed with the accepted revision; closed: the booking was cancelled. */
  state: CateringOfferNegotiationState;
  /** True when the offer predates revisions: its terms are the booking's own and there is no history to show. */
  legacy: boolean;
  /** The terms the customer can accept right now: the current revision, or for a legacy offer the booking's stored terms. */
  currentRevisionId: string | null;
  legacyTerms: CateringOfferLegacyTerms | null;
  /** A customer change request is waiting for the provider's answer. */
  changeRequestPending: boolean;
  actions: { canRevise: boolean; canAccept: boolean; canRequestChanges: boolean; canDecline: boolean };
  /** Newest first, at most CATERING_OFFER_HISTORY_LIMIT. */
  revisions: CateringOfferRevisionView[];
};

export const cateringOfferRevisionKey = (userId: string, bookingId: string) => ["catering", "offer", userId, bookingId] as const;

/**
 * What each side may do, from the booking's status and the negotiation's own facts. The server enforces every one of
 * these under the booking row lock; this is the same decision, made once, so the UI can only offer what is legal.
 */
export function cateringOfferActions(input: {
  role: "provider" | "customer";
  bookingStatus: string;
  customerConfirmedAt: boolean;
  changeRequestPending: boolean;
  historyFull: boolean;
}): CateringOfferNegotiationView["actions"] {
  const open = input.bookingStatus === "pending_confirmation" && !input.customerConfirmedAt;
  return {
    canRevise: open && input.role === "provider" && !input.historyFull,
    canAccept: open && input.role === "customer",
    canRequestChanges: open && input.role === "customer" && !input.changeRequestPending && !input.historyFull,
    canDecline: open && input.role === "customer",
  };
}

export function cateringOfferNegotiationState(bookingStatus: string): CateringOfferNegotiationState {
  if (bookingStatus === "pending_confirmation") return "open";
  if (bookingStatus === "confirmed" || bookingStatus === "completed") return "accepted";
  return "closed";
}

export const CATERING_OFFER_STATE_LABELS: Record<CateringOfferNegotiationState, string> = {
  open: "Negotiation open",
  accepted: "Terms accepted",
  closed: "Negotiation closed",
};

export function formatCateringOfferMoney(cents: number | null, currency: string): string {
  return cents === null ? "Not specified" : `${currency} ${cateringCentsToDecimal(cents)}`;
}

/** The terms that differ between two offer revisions, in words a person can scan. Revision order decides which is "before". */
export function describeCateringOfferChanges(before: Pick<CateringOfferRevisionView, "priceCents" | "guestCount" | "note" | "currency"> | null, after: Pick<CateringOfferRevisionView, "priceCents" | "guestCount" | "note" | "currency">): string[] {
  if (!before) return [];
  const changes: string[] = [];
  if (before.priceCents !== after.priceCents || before.currency !== after.currency) changes.push(`Price: ${formatCateringOfferMoney(before.priceCents, before.currency)} → ${formatCateringOfferMoney(after.priceCents, after.currency)}`);
  if (before.guestCount !== after.guestCount) changes.push(`Guests: ${before.guestCount ?? "Not specified"} → ${after.guestCount ?? "Not specified"}`);
  if ((before.note ?? "") !== (after.note ?? "")) changes.push("Terms description updated");
  return changes;
}

/** Whether a server answer means the offer moved under the user, so the UI must show the newest terms rather than retry. */
export function isCateringOfferConflict(code: unknown): boolean {
  return code === "stale_revision" || code === "offer_revision_required" || code === "negotiation_closed" || code === "change_request_pending";
}
