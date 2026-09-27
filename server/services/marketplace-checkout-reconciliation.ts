// server/services/marketplace-checkout-reconciliation.ts
//
// Reconciles or expires capture_pending/capture_reconciliation orders that a
// crash, an abandoned browser session, or a lost response left behind. This
// is the automatic counterpart to the manual retry path in
// POST /api/payments/create-payment: it reuses the same provider-evidence
// primitives (never invents evidence of its own) so a reservation is not
// permanently stranded merely because nobody ever retried it.
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, products, users, commissions } from "../../shared/schema";
import {
  findSquarePaymentByReference,
  getCaptureReconciliationWindow,
  getDefinitiveSquarePaymentFailure,
  requireCompletedSquarePayment,
} from "../lib/marketplace-payment";
import { executeRecoverableProviderOperation, ProviderReconciliationRequiredError } from "../lib/provider-reconciliation";
import { getSquareClient } from "../lib/square-client";

type OrderRow = typeof orders.$inferSelect;

// An ordinary in-flight checkout should never be raced by this job; only a
// capture_pending reservation older than this is considered for reconciliation.
export const RECONCILIATION_MIN_AGE_MS = 2 * 60 * 1000;

/**
 * Release an abandoned reservation exactly once and restore its stock. Shared
 * by the "never submitted" expiry path and a definitive Square decline so
 * both go through one auditable release, never a duplicated inline copy.
 */
export async function releaseAbandonedCaptureReservation(
  order: Pick<OrderRow, "id" | "captureIdempotencyKey">,
  failureCode: string,
  requireNeverSubmitted: boolean,
) {
  return db.transaction(async (tx: any) => {
    const conditions = [
      eq(orders.id, order.id),
      eq(orders.paymentStatus, "capture_pending"),
      eq(orders.captureIdempotencyKey, order.captureIdempotencyKey!),
      eq(orders.inventoryStatus, "reserved"),
    ];
    if (requireNeverSubmitted) conditions.push(isNull(orders.captureRequestSubmittedAt));
    const [releasedOrder] = await tx.update(orders).set({
      paymentStatus: "unverified",
      paymentProvider: null,
      captureIdempotencyKey: null,
      captureAttemptedAt: null,
      captureRequestSubmittedAt: null,
      lastPaymentFailureCode: failureCode,
      inventoryStatus: "released",
      updatedAt: new Date(),
    }).where(and(...conditions)).returning();
    if (!releasedOrder) return undefined;
    await tx.update(products).set({
      inventory: sql`${products.inventory} + ${releasedOrder.quantity}`,
    }).where(and(eq(products.id, releasedOrder.productId), sql`${products.inventory} IS NOT NULL`));
    return releasedOrder;
  });
}

/**
 * Finalize a capture whose provider outcome is now (or was already) known,
 * through the exact same exactly-once accounting transaction used by the
 * manual retry path: capture_reconciliation -> sold, commission inserted,
 * seller revenue credited, and sales_count incremented exactly once (never
 * for a migrated P1-03 order whose legacy checkout already counted it).
 */
async function finalizeReconciledCapture(order: OrderRow) {
  const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);
  const tier = order.sellerTierSnapshot!;
  const commissionRate = order.commissionRateSnapshot!;
  const squareClient = order.paymentStatus === "capture_reconciliation" ? null : getSquareClient();

  return executeRecoverableProviderOperation({
    operation: "capture",
    idempotencyKey: order.captureIdempotencyKey!,
    invokeProvider: async () => {
      if (order.paymentStatus === "capture_reconciliation") {
        return requireCompletedSquarePayment({
          id: order.squarePaymentId,
          status: order.providerPaymentStatus,
          totalMoney: { amount: BigInt(amountInCents), currency: "USD" },
          createdAt: order.paymentCapturedAt?.toISOString(),
        }, BigInt(amountInCents), "USD");
      }
      if (!order.captureAttemptedAt) {
        const error = new Error("Capture outcome is ambiguous and lacks a reconciliation window");
        (error as Error & { code: string }).code = "CAPTURE_OUTCOME_AMBIGUOUS";
        throw error;
      }
      const reconciliationWindow = getCaptureReconciliationWindow(order.captureAttemptedAt);
      const matchedPayment = await findSquarePaymentByReference({
        referenceId: order.captureIdempotencyKey!,
        listPage: async (cursor) => {
          const { result } = await squareClient!.paymentsApi.listPayments(
            reconciliationWindow.beginTime,
            reconciliationWindow.endTime,
            "DESC",
            cursor,
            process.env.SQUARE_LOCATION_ID!,
            BigInt(amountInCents),
            undefined,
            undefined,
            100,
          );
          return { payments: result.payments as any, cursor: result.cursor };
        },
      });
      if (!matchedPayment) {
        const error = new Error("Original Square capture could not be authoritatively reconciled");
        (error as Error & { code: string }).code = "CAPTURE_OUTCOME_AMBIGUOUS";
        throw error;
      }
      if (["FAILED", "CANCELED"].includes(matchedPayment.status ?? "")) {
        const error = new Error("Square definitively rejected the original capture");
        Object.assign(error, { code: "CAPTURE_DEFINITIVE_FAILURE", providerCode: matchedPayment.status });
        throw error;
      }
      return requireCompletedSquarePayment(matchedPayment, BigInt(amountInCents), "USD");
    },
    persistProviderEvidence: async (paymentEvidence) => {
      if (order.paymentStatus === "capture_reconciliation") return paymentEvidence;
      const [evidenceOrder] = await db.update(orders).set({
        ...paymentEvidence,
        paymentStatus: "capture_reconciliation",
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, order.id),
        eq(orders.paymentStatus, "capture_pending"),
        eq(orders.captureIdempotencyKey, order.captureIdempotencyKey!),
      )).returning();
      if (!evidenceOrder) throw new Error("capture evidence could not be recorded for reconciliation");
      return paymentEvidence;
    },
    applyLocally: async (paymentEvidence) => db.transaction(async (tx: any) => {
      const [capturedOrder] = await tx.update(orders).set({
        ...paymentEvidence,
        sellerRevenueStatus: "credited",
        inventoryStatus: "sold",
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, order.id),
        eq(orders.paymentStatus, "capture_reconciliation"),
        eq(orders.captureIdempotencyKey, order.captureIdempotencyKey!),
        eq(orders.sellerRevenueStatus, "uncredited"),
        eq(orders.inventoryStatus, "reserved"),
      )).returning();
      if (!capturedOrder) throw new Error("capture state changed before reconciliation");

      await tx.insert(commissions).values({
        orderId: order.id,
        sellerId: order.sellerId,
        subscriptionTier: tier,
        commissionRate: commissionRate.toString(),
        orderTotal: order.totalAmount,
        commissionAmount: order.platformFee,
        sellerAmount: order.sellerAmount,
        status: "pending",
      });
      await tx.update(users).set({
        monthlyRevenue: sql`coalesce(${users.monthlyRevenue}, 0) + ${order.sellerAmount}`,
      }).where(eq(users.id, order.sellerId));
      if (order.sellerTierSnapshot !== "legacy_p1_03") {
        await tx.update(products).set({
          salesCount: sql`coalesce(${products.salesCount}, 0) + 1`,
        }).where(eq(products.id, order.productId));
      }
      return capturedOrder;
    }),
  });
}

export type ReconciliationOutcome =
  | { kind: "finalized"; orderId: string }
  | { kind: "released"; orderId: string; failureCode: string }
  | { kind: "declined"; orderId: string; providerCode: string }
  | { kind: "ambiguous"; orderId: string }
  | { kind: "skipped"; orderId: string; reason: string }
  | { kind: "error"; orderId: string; message: string };

/**
 * Reconcile or expire a single stalled order. Never throws: every outcome,
 * including an unexpected error, is reported so a batch run can continue.
 */
export async function reconcileStalledCaptureOrder(order: OrderRow): Promise<ReconciliationOutcome> {
  if (!["capture_pending", "capture_reconciliation"].includes(order.paymentStatus)) {
    return { kind: "skipped", orderId: order.id, reason: "not_reconcilable" };
  }
  if (!order.captureIdempotencyKey || !order.sellerTierSnapshot || !order.commissionRateSnapshot || !order.checkoutIdempotencyKey) {
    return { kind: "skipped", orderId: order.id, reason: "snapshot_unverified" };
  }
  const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);
  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    return { kind: "skipped", orderId: order.id, reason: "amount_invalid" };
  }

  // Case D: our own durable claim record proves no request could have been
  // dispatched under this idempotency key. No provider evidence could exist
  // either way, so this is released without ever contacting Square.
  if (order.paymentStatus === "capture_pending" && !order.captureRequestSubmittedAt) {
    const released = await releaseAbandonedCaptureReservation(order, "CAPTURE_NEVER_SUBMITTED", true);
    return released
      ? { kind: "released", orderId: order.id, failureCode: "CAPTURE_NEVER_SUBMITTED" }
      : { kind: "skipped", orderId: order.id, reason: "already_resolved" };
  }

  try {
    const updated = await finalizeReconciledCapture(order);
    return { kind: "finalized", orderId: updated.id };
  } catch (error: any) {
    const definitiveFailure = getDefinitiveSquarePaymentFailure(error)
      ?? (error?.code === "CAPTURE_DEFINITIVE_FAILURE" ? error.providerCode : null);
    if (definitiveFailure) {
      const released = await releaseAbandonedCaptureReservation(order, definitiveFailure, false);
      return released
        ? { kind: "declined", orderId: order.id, providerCode: definitiveFailure }
        : { kind: "skipped", orderId: order.id, reason: "release_conflict" };
    }
    if (error instanceof ProviderReconciliationRequiredError) {
      return { kind: "error", orderId: order.id, message: "provider evidence recorded but local reconciliation is incomplete" };
    }
    if (error?.code === "CAPTURE_OUTCOME_AMBIGUOUS" || error?.errors) {
      return { kind: "ambiguous", orderId: order.id };
    }
    return { kind: "error", orderId: order.id, message: error?.message ?? "unknown reconciliation error" };
  }
}

/**
 * Batch entry point for the cron job. A capture_reconciliation order already
 * carries durable provider evidence, so it is always eligible regardless of
 * age; a capture_pending reservation is only considered once it is old
 * enough that it cannot be an ordinary in-flight checkout still in progress.
 */
export async function reconcileAbandonedCheckoutReservations(options: { limit?: number; minAgeMs?: number } = {}) {
  const limit = options.limit ?? 25;
  const minAgeMs = options.minAgeMs ?? RECONCILIATION_MIN_AGE_MS;
  const cutoff = new Date(Date.now() - minAgeMs);

  const stalled: OrderRow[] = await db.select().from(orders).where(or(
    eq(orders.paymentStatus, "capture_reconciliation"),
    and(eq(orders.paymentStatus, "capture_pending"), lt(orders.captureAttemptedAt, cutoff)),
  )).limit(limit);

  const outcomes: ReconciliationOutcome[] = [];
  for (const order of stalled) {
    try {
      outcomes.push(await reconcileStalledCaptureOrder(order));
    } catch (error: any) {
      outcomes.push({ kind: "error", orderId: order.id, message: error?.message ?? "unknown reconciliation error" });
    }
  }
  return {
    scanned: stalled.length,
    finalized: outcomes.filter((o) => o.kind === "finalized").length,
    released: outcomes.filter((o) => o.kind === "released").length,
    declined: outcomes.filter((o) => o.kind === "declined").length,
    ambiguous: outcomes.filter((o) => o.kind === "ambiguous").length,
    skipped: outcomes.filter((o) => o.kind === "skipped").length,
    errors: outcomes.filter((o) => o.kind === "error").length,
    outcomes,
  };
}
