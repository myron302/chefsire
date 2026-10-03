import type { CateringOfferRevision } from "@shared/schema";
import type { CateringOfferRevisionKind, CateringOfferRevisionView } from "@shared/catering-offers";

/**
 * Explicit participant projection of one negotiation row. Built field by field: the proposer's user id, the retry key
 * and the booking id never reach a client, so a column added to the table later is invisible until someone adds it
 * here on purpose. Both participants of a booking see the same shared negotiation; nothing in it is provider-private.
 */
export function serializeCateringOfferRevision(row: CateringOfferRevision, context: { currentId: string | null; respondsToNumber: number | null }): CateringOfferRevisionView {
  return {
    id: row.id,
    revisionNumber: row.revisionNumber,
    kind: row.kind as CateringOfferRevisionKind,
    proposedBy: row.proposedByRole === "customer" ? "customer" : "provider",
    createdAt: row.createdAt.toISOString(),
    priceCents: row.priceCents,
    currency: row.currency,
    guestCount: row.guestCount,
    note: row.note,
    respondsToRevisionNumber: context.respondsToNumber,
    isCurrent: row.kind === "offer" && row.id === context.currentId,
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
  };
}
