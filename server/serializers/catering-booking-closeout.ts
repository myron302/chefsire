import type { CateringBookingCloseoutItem, CateringBookingCloseoutRecord } from "@shared/schema";
import {
  CATERING_CLOSEOUT_ITEM_DESCRIPTIONS,
  CATERING_CLOSEOUT_ITEM_KEYS,
  CATERING_CLOSEOUT_ITEM_LABELS,
  cateringCloseoutItemIsRequired,
  cateringProviderProfilePath,
  type CateringCloseoutCustomerReviewView,
  type CateringCloseoutItemKey,
  type CateringCloseoutItemState,
  type CateringCloseoutItemView,
  type CateringCloseoutProviderReviewView,
  type CateringCloseoutRecordView,
} from "@shared/catering-booking-closeout";

/**
 * The Phase 2K serializers, written as EXPLICIT projections rather than as a spread of the row with a few fields
 * deleted -- the same rule Phase 2J established.
 *
 * Every function here names the fields it emits. Nothing is serialized and then expected to be ignored by the
 * client, and a column added to one of these tables later cannot start reaching a customer merely because it
 * exists: it would have to be added to a view here, deliberately.
 *
 * What is never emitted to ANY actor: `bookingId` (the caller supplied it), `resolvedBy`, `closedOutBy`,
 * `lastReopenedBy` and `updatedBy`. All four are internal attribution, persisted for audit, needed by no
 * participant's interface, and exactly the kind of thing this phase promises not to expose.
 */

/**
 * The whole checklist, PROVIDER ONLY.
 *
 * There is no customer variant of this function and the route never calls it for a customer: a customer's closeout
 * payload carries no `checklist` key at all. The absence is the privacy boundary -- not a filter that could be
 * called with the wrong argument.
 *
 * Every allowlisted key is reported, including those with no row yet, so the provider sees the whole checklist
 * rather than only the parts they have already touched. A key with no row has `updatedAt: null`, which is exactly
 * the precondition the client sends back to create it, and `state: "pending"`, which is what an untouched item
 * means. `resolvedAt` comes straight from the row, whose database CHECK guarantees it is present exactly when the
 * item is resolved.
 */
export function serializeCloseoutChecklist(rows: readonly CateringBookingCloseoutItem[]): CateringCloseoutItemView[] {
  const byKey = new Map(rows.map((row) => [row.itemKey, row] as const));
  return CATERING_CLOSEOUT_ITEM_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key: key as CateringCloseoutItemKey,
      label: CATERING_CLOSEOUT_ITEM_LABELS[key],
      description: CATERING_CLOSEOUT_ITEM_DESCRIPTIONS[key],
      required: cateringCloseoutItemIsRequired(key),
      state: (row?.state ?? "pending") as CateringCloseoutItemState,
      providerNote: row?.providerNote ?? null,
      resolvedAt: row?.resolvedAt?.toISOString() ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

/**
 * The closeout record, in the one place the provider-only fields are decided.
 *
 * A customer's object does not carry `providerNotes` as null -- it does not carry the KEY. A null would still tell
 * them the field exists, and an interface built on that shape would have somewhere to render it the moment a
 * serializer changed. The same rule Phase 2J applies to the access record's private note.
 *
 * `updatedAt` is provider-only for the same reason, and the reason is sharper here than it was there. This row
 * carries provider-private notes, so a provider who edits only those notes moves the version while every
 * customer-readable field stays identical -- and a customer who could compare versions across polls would read off
 * that internal activity happened and when, and on a private-only first save that a closeout record now exists at
 * all. The provider keeps it because their optimistic concurrency is built on it; the customer, who never writes
 * this object, is given no key rather than a derived stand-in that would have to be trusted not to track the very
 * private edits it was invented to hide.
 *
 * `closedOutAt`, `reopenCount` and `lastReopenedAt` ARE customer-visible, and deliberately. All three describe
 * something the customer was already told through shared activity and their own closeout state: the caterer
 * finished wrapping up, or undid that. Withholding them would leave their view unable to explain itself, and they
 * disclose nothing internal -- no note, no incident, no checklist item and no actor.
 */
export function serializeCloseoutRecord(
  row: CateringBookingCloseoutRecord | undefined,
  role: "provider" | "customer",
): CateringCloseoutRecordView {
  const shared: CateringCloseoutRecordView = {
    closedOut: Boolean(row?.closedOutAt),
    closedOutAt: row?.closedOutAt?.toISOString() ?? null,
    reopenCount: row?.reopenCount ?? 0,
    lastReopenedAt: row?.lastReopenedAt?.toISOString() ?? null,
  };
  if (role !== "provider") return shared;
  return { ...shared, updatedAt: row?.updatedAt.toISOString() ?? null, providerNotes: row?.providerNotes ?? null };
}

/**
 * What a provider is told about review follow-up: one boolean and nothing else.
 *
 * It reports only whether a review by this booking's customer for this booking's provider exists. Published
 * catering reviews are public and attributed on the provider's own profile page, so this discloses nothing the
 * provider could not already read -- and the review system has no drafts, so there is no unpublished state that
 * could leak through it. No rating, no title, no body, no review id and no timestamp is carried, because none of
 * them is needed to answer "is review follow-up still worth doing".
 *
 * It grants nothing. A provider cannot create, alter or revoke a customer's ability to review from this or any
 * other Phase 2K surface; the existing Phase 2E eligibility rules are the only thing that decides that.
 */
export function serializeProviderCloseoutReview(customerReviewExists: boolean): CateringCloseoutProviderReviewView {
  return { customerReviewExists };
}

/**
 * What a customer is told about reviewing.
 *
 * Eligibility is the EXISTING Phase 2E rule, evaluated server-side from the provider's listing state and the
 * self-review rule, and merely reported here. `alreadyReviewed` reflects the existing unique constraint on
 * (reviewer, provider), so the interface offers to update an existing review rather than a create the server would
 * refuse -- Phase 2K neither relaxes that constraint nor adds a second review table, row or endpoint.
 *
 * `reviewPath` is the existing public provider page, which is where the existing review flow already lives.
 */
export function serializeCustomerCloseoutReview(input: {
  mayReview: boolean;
  alreadyReviewed: boolean;
  providerId: string;
}): CateringCloseoutCustomerReviewView {
  return { mayReview: input.mayReview, alreadyReviewed: input.alreadyReviewed, reviewPath: cateringProviderProfilePath(input.providerId) };
}
