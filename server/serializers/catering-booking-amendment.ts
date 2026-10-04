import type { CateringBookingAmendment } from "@shared/schema";
import type { CateringAmendmentField, CateringAmendmentStatus, CateringAmendmentView } from "@shared/catering-amendments";
import { amendmentBaseTerms, amendmentResultingTerms } from "../services/catering-booking-amendments";

/**
 * Explicit participant projection of one amendment row, field by field. The proposer's and responder's user ids, the retry
 * key and the booking id never reach a client, so a column added to the table later is invisible until someone adds it
 * here on purpose. Both participants see the same shared amendment; nothing in it is provider-private.
 */
export function serializeCateringAmendment(row: CateringBookingAmendment): CateringAmendmentView {
  return {
    id: row.id,
    amendmentNumber: row.amendmentNumber,
    proposedBy: row.proposedByRole === "customer" ? "customer" : "provider",
    status: row.status as CateringAmendmentStatus,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
    message: row.message,
    changedFields: row.changedFields as CateringAmendmentField[],
    before: amendmentBaseTerms(row),
    after: amendmentResultingTerms(row),
  };
}
