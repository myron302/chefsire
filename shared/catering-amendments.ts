import { z } from "zod";
import type { CateringBookingStatus } from "./catering-bookings";
import { calendarDateParts, formatCateringCalendarDate } from "./catering-availability";
import { cateringCentsToDecimal } from "./catering-booking-billing";
import { CATERING_OFFER_GUEST_MAX, CATERING_OFFER_NOTE_MAX_LENGTH, CATERING_OFFER_PRICE_MAX_CENTS } from "./catering-offers";

/**
 * Phase 2O: post-confirmation booking amendments.
 *
 * `pending_confirmation` is Phase 2N's offer negotiation; `confirmed` is this. A confirmed booking's terms change only by
 * one participant proposing an amendment and the OTHER accepting it; until then the booking's own columns remain the
 * agreement. `completed` and `cancelled` bookings are history and cannot be amended. Money is integer cents.
 *
 * The server allowlist is exactly the five fields below. Package and snapshot fields, identity, ownership, lifecycle
 * timestamps and billing identifiers are not amendable and no request key can reach them.
 */
export const CATERING_AMENDMENT_FIELDS = ["event_date", "guest_count", "price_cents", "currency", "terms_note"] as const;
export type CateringAmendmentField = typeof CATERING_AMENDMENT_FIELDS[number];
/** Price and currency are the only terms an invoice depends on. */
export const CATERING_AMENDMENT_BILLING_FIELDS: readonly CateringAmendmentField[] = ["price_cents", "currency"];

export const CATERING_AMENDMENT_STATUSES = ["pending", "accepted", "declined", "withdrawn", "superseded"] as const;
export type CateringAmendmentStatus = typeof CATERING_AMENDMENT_STATUSES[number];
/** A booking holds at most this many amendments, which also bounds every history read. */
export const CATERING_AMENDMENT_HISTORY_LIMIT = 50;
export const CATERING_AMENDMENT_MESSAGE_MAX_LENGTH = 1000;

const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);
/** The one currency contract: the ISO-style three-letter code every Catering schema already validates. The server and the editor both use this. */
export const CATERING_CURRENCY_PATTERN = /^[A-Z]{3}$/;
const eventDateSchema = z.string().refine((value) => calendarDateParts(value) !== null, "Event date must be a real date (YYYY-MM-DD)");

/**
 * The body of a proposal. A key that is ABSENT leaves that term alone; `guestCount`, `priceCents` and `termsNote` may be an
 * explicit null, which proposes clearing them. Anything outside the allowlist is rejected (strict), and so is a proposal that
 * names no term at all.
 */
export const cateringAmendmentProposalSchema = z.object({
  eventDate: eventDateSchema.optional(),
  guestCount: z.number().int("Guest count must be a whole number").min(1, "Guest count must be at least 1").max(CATERING_OFFER_GUEST_MAX, "Guest count is too large").nullable().optional(),
  priceCents: z.number().int("Price must be a whole number of cents").min(0, "Price cannot be negative").max(CATERING_OFFER_PRICE_MAX_CENTS, "Price is too large").nullable().optional(),
  currency: z.string().trim().regex(CATERING_CURRENCY_PATTERN, "Currency must be a 3-letter code").optional(),
  termsNote: z.preprocess(blankToNull, z.string().trim().max(CATERING_OFFER_NOTE_MAX_LENGTH, `Terms can be at most ${CATERING_OFFER_NOTE_MAX_LENGTH} characters`).nullable().optional()),
  message: z.preprocess(blankToNull, z.string().trim().max(CATERING_AMENDMENT_MESSAGE_MAX_LENGTH, `Message can be at most ${CATERING_AMENDMENT_MESSAGE_MAX_LENGTH} characters`).nullable().optional()),
  /** The latest ACCEPTED amendment the proposer was looking at (null: the original confirmed terms). */
  expectedBaseAmendmentId: z.string().uuid().nullable(),
  clientRequestId: z.string().uuid("A request id is required"),
}).strict().refine((value) => value.eventDate !== undefined || value.guestCount !== undefined || value.priceCents !== undefined || value.currency !== undefined || value.termsNote !== undefined, "Choose at least one term to change");
export type CateringAmendmentProposalInput = z.infer<typeof cateringAmendmentProposalSchema>;

/** Accept / decline / withdraw carry no body: the amendment is named by the path and the actor by the session. */
export const cateringAmendmentResponseSchema = z.object({}).strict();
export const cateringAmendmentIdSchema = z.string().uuid();

export const CATERING_AMENDMENT_ERROR_CODES = ["amendment_closed", "amendment_pending", "amendment_not_pending", "stale_terms", "billing_terms_locked", "date_unavailable", "no_change", "history_limit", "not_counterparty", "not_proposer"] as const;
export type CateringAmendmentErrorCode = typeof CATERING_AMENDMENT_ERROR_CODES[number];

export type CateringAmendmentTerms = { eventDate: string; guestCount: number | null; priceCents: number | null; currency: string; termsNote: string | null };

export type CateringAmendmentView = {
  id: string;
  amendmentNumber: number;
  proposedBy: "provider" | "customer";
  status: CateringAmendmentStatus;
  createdAt: string;
  respondedAt: string | null;
  message: string | null;
  changedFields: CateringAmendmentField[];
  /** The terms this was proposed against, and those terms with the change applied. Only `changedFields` differ. */
  before: CateringAmendmentTerms;
  after: CateringAmendmentTerms;
};

export type CateringAmendmentsView = {
  bookingId: string;
  role: "provider" | "customer";
  bookingStatus: CateringBookingStatus;
  /** The booking's authoritative terms right now (the note is the latest accepted terms description). */
  currentTerms: CateringAmendmentTerms;
  /** The terms as first confirmed; null when the booking was never amended, so nothing is reconstructed. */
  originalTerms: CateringAmendmentTerms | null;
  /** The accepted amendment a new proposal is based on (null: the original confirmed terms). */
  latestAcceptedAmendmentId: string | null;
  pending: CateringAmendmentView | null;
  /** Newest first, at most CATERING_AMENDMENT_HISTORY_LIMIT, pending one included. */
  amendments: CateringAmendmentView[];
  /** True once billing has started, so price and currency can no longer be amended. */
  billingTermsLocked: boolean;
  actions: { canPropose: boolean; canAccept: boolean; canDecline: boolean; canWithdraw: boolean };
};

export const cateringAmendmentsKey = (userId: string, bookingId: string) => ["catering", "amendments", userId, bookingId] as const;

/** What each side may do. The server enforces every one under the booking row lock; this is the same decision, made once. */
export function cateringAmendmentActions(input: { role: "provider" | "customer"; bookingStatus: string; pendingProposedBy: "provider" | "customer" | null; historyFull: boolean }): CateringAmendmentsView["actions"] {
  const confirmed = input.bookingStatus === "confirmed";
  const pending = input.pendingProposedBy !== null;
  const mine = input.pendingProposedBy === input.role;
  return {
    canPropose: confirmed && !pending && !input.historyFull,
    canAccept: confirmed && pending && !mine,
    canDecline: confirmed && pending && !mine,
    canWithdraw: confirmed && pending && mine,
  };
}

export function formatCateringAmendmentMoney(cents: number | null, currency: string): string {
  if (cents === null) return "Not specified";
  const [whole, fraction] = cateringCentsToDecimal(cents).split(".");
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}

export const CATERING_AMENDMENT_FIELD_LABELS: Record<CateringAmendmentField, string> = {
  event_date: "Event date", guest_count: "Guests", price_cents: "Agreed price", currency: "Currency", terms_note: "Terms description",
};

export type CateringAmendmentChange = { field: CateringAmendmentField; label: string; before: string; after: string };

/**
 * The changed terms only, as text, each with its own before and after. An unchanged term never appears, whatever the two sides hold.
 */
export function describeCateringAmendmentChanges(amendment: Pick<CateringAmendmentView, "changedFields" | "before" | "after">): CateringAmendmentChange[] {
  const { changedFields: fields, before, after } = amendment;
  const changes: CateringAmendmentChange[] = [];
  if (fields.includes("event_date")) changes.push({ field: "event_date", label: CATERING_AMENDMENT_FIELD_LABELS.event_date, before: formatCateringCalendarDate(before.eventDate), after: formatCateringCalendarDate(after.eventDate) });
  if (fields.includes("guest_count")) changes.push({ field: "guest_count", label: CATERING_AMENDMENT_FIELD_LABELS.guest_count, before: before.guestCount === null ? "Not specified" : String(before.guestCount), after: after.guestCount === null ? "Not specified" : String(after.guestCount) });
  // Price and currency are separate rows so neither can hide the other. The price row appears when the amount changes, or when the
  // currency changes under a stated amount (the same number in another currency is a different price). A currency change with no
  // price at all has nothing to show on a money row, so it is carried entirely by the explicit Currency row.
  const priceStated = before.priceCents !== null || after.priceCents !== null;
  if (fields.includes("price_cents") || (fields.includes("currency") && priceStated)) {
    changes.push({ field: "price_cents", label: CATERING_AMENDMENT_FIELD_LABELS.price_cents, before: formatCateringAmendmentMoney(before.priceCents, before.currency), after: formatCateringAmendmentMoney(after.priceCents, after.currency) });
  }
  if (fields.includes("currency")) changes.push({ field: "currency", label: CATERING_AMENDMENT_FIELD_LABELS.currency, before: before.currency, after: after.currency });
  if (fields.includes("terms_note")) changes.push({ field: "terms_note", label: CATERING_AMENDMENT_FIELD_LABELS.terms_note, before: before.termsNote ?? "None", after: after.termsNote ?? "None" });
  return changes;
}

export const CATERING_AMENDMENT_STATUS_LABELS: Record<CateringAmendmentStatus, string> = {
  pending: "Awaiting response", accepted: "Accepted", declined: "Declined", withdrawn: "Withdrawn", superseded: "Closed when the booking ended",
};

/** Whether a server answer means the amendment moved under the user, so the UI must show the newest state rather than retry. */
export function isCateringAmendmentConflict(code: unknown): boolean {
  return code === "amendment_closed" || code === "amendment_pending" || code === "amendment_not_pending" || code === "stale_terms";
}
