import type { CateringBookingAdjustment } from "@shared/schema";
import type { CateringAdjustmentKind, CateringAdjustmentSource, CateringAdjustmentStatus, CateringAdjustmentView } from "@shared/catering-billing-adjustments";

/**
 * EXPLICIT PROJECTION. Not one spread of a database row.
 *
 * SHARED, because it is the customer's own money: kind, amount, currency, reason, status, when it was recorded and when
 * it was reversed, the amendment it reconciles and the payment a refund names. The reason is customer-visible by
 * definition -- the form says so before it is written.
 *
 * PROVIDER ONLY: `reference`, the provider's own note on an external refund, which ChefSire has not verified.
 *
 * NEITHER: who recorded or reversed an entry, the idempotency key, and the reason a reversal was entered is shared only
 * as the text the provider wrote for the customer to read.
 */
export function serializeCateringAdjustment(row: CateringBookingAdjustment, role: "provider" | "customer", amendmentNumbers: ReadonlyMap<string, number>): CateringAdjustmentView {
  const shared: CateringAdjustmentView = {
    id: row.id,
    kind: row.entryKind as CateringAdjustmentKind,
    source: row.source as CateringAdjustmentSource,
    status: row.status as CateringAdjustmentStatus,
    amountCents: row.amountCents,
    currency: row.currency,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    reversedAt: row.reversedAt?.toISOString() ?? null,
    reversalReason: row.reversalReason ?? null,
    amendmentNumber: row.amendmentId ? amendmentNumbers.get(row.amendmentId) ?? null : null,
    paymentId: row.paymentId ?? null,
  };
  return role === "provider" ? { ...shared, reference: row.reference ?? null } : shared;
}
