// server/services/marketplace-checkout-reconciliation.ts
//
// The single implementation of the marketplace capture lifecycle, shared by
// POST /api/payments/create-payment (first attempt and manual retry) and the
// background reconciler. Every state below is recoverable without guessing:
//
//   unverified/unreserved
//     -- reserve stock + capture_pending + idempotency key + immutable
//        CreatePayment request snapshot, in ONE transaction -->
//   capture_pending/reserved
//     -- dispatch, or later replay, of that identical request under that
//        identical key; Square's idempotency returns the original payment if
//        it was ever processed and processes it now if it never arrived -->
//   capture_reconciliation (durable provider evidence)
//     -- exactly-once accounting transaction --> captured/sold
//
//   capture_pending -- definitive provider failure --> unverified/released
//
// A local marker written before or after the network call can never prove
// whether Square received it, so none is used. Uncertainty is resolved only by
// provider evidence reached through the original immutable identity; anything
// short of that leaves the reservation in place (fail closed).
import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { db as productionDb } from "../db";
import { orders, products, users, commissions } from "../../shared/schema";
import {
  buildSquareCaptureRequest,
  createCaptureRequestSnapshot,
  evaluateSquareCapturePayment,
  findSquarePaymentByReference,
  getCaptureReconciliationWindow,
  getDefinitiveSquarePaymentFailure,
  requireCompletedSquarePayment,
  type SquarePaymentEvidence,
} from "../lib/marketplace-payment";
import { executeRecoverableProviderOperation, ProviderReconciliationRequiredError } from "../lib/provider-reconciliation";
import { getSquareClient } from "../lib/square-client";

type OrderRow = typeof orders.$inferSelect;

export type SquarePaymentsClient = {
  paymentsApi: {
    createPayment(request: ReturnType<typeof buildSquareCaptureRequest>): Promise<{ result: { payment?: SquarePaymentEvidence | null } }>;
    listPayments(...args: any[]): Promise<{ result: { payments?: SquarePaymentEvidence[] | null; cursor?: string | null } }>;
  };
};

export type CheckoutDeps = {
  db: any;
  getSquareClient: () => SquarePaymentsClient;
};

export const productionCheckoutDeps: CheckoutDeps = {
  db: productionDb,
  getSquareClient: getSquareClient as unknown as () => SquarePaymentsClient,
};

function codedError(message: string, code: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

/**
 * Reserve finite stock and persist the capture identity together with the
 * complete CreatePayment request, atomically. After this commits, the order can
 * always be driven to a terminal state by replaying that one request.
 */
export async function reserveMarketplaceCapture(
  deps: CheckoutDeps,
  order: OrderRow,
  request: { sourceId: string; verificationToken?: string | null; buyerEmailAddress?: string | null; locationId: string },
) {
  const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);
  const captureIdempotencyKey = randomUUID();
  const captureAttemptedAt = new Date();
  const captureRequestSnapshot = createCaptureRequestSnapshot({
    idempotencyKey: captureIdempotencyKey,
    referenceId: captureIdempotencyKey,
    sourceId: request.sourceId,
    verificationToken: request.verificationToken,
    amountCents: amountInCents,
    locationId: request.locationId,
    orderId: order.id,
    buyerEmailAddress: request.buyerEmailAddress,
  });

  return deps.db.transaction(async (tx: any) => {
    // One conditional UPDATE is the stock check and reservation. It locks
    // this product row, so concurrent attempts cannot both claim the last
    // unit. NULL inventory remains the existing unlimited-stock sentinel.
    const [reservedProduct] = await tx.update(products).set({
      inventory: sql`CASE WHEN ${products.inventory} IS NULL THEN NULL ELSE ${products.inventory} - ${order.quantity} END`,
    }).where(and(
      eq(products.id, order.productId),
      eq(products.isActive, true),
      or(isNull(products.inventory), gte(products.inventory, order.quantity)),
    )).returning({ id: products.id });
    if (!reservedProduct) throw codedError("Inventory is no longer available", "INSUFFICIENT_INVENTORY");

    const [preparedOrder] = await tx.update(orders).set({
      paymentStatus: "capture_pending",
      paymentProvider: "square",
      captureIdempotencyKey,
      captureAttemptedAt,
      captureRequestSnapshot,
      reconciliationAttemptedAt: null,
      lastPaymentFailureCode: null,
      inventoryStatus: "reserved",
      updatedAt: new Date(),
    }).where(and(
      eq(orders.id, order.id),
      eq(orders.paymentStatus, "unverified"),
      eq(orders.inventoryStatus, "unreserved"),
      notInArray(orders.status, ["cancelled", "refunded"]),
    )).returning();
    if (!preparedOrder) throw codedError("Order state changed; reload and retry", "PAYMENT_STATE_CONFLICT");
    return preparedOrder as OrderRow;
  });
}

/**
 * Release a reservation exactly once, only on a definitive provider failure,
 * and restore its stock in the same transaction.
 */
export async function releaseMarketplaceReservation(deps: CheckoutDeps, order: Pick<OrderRow, "id" | "captureIdempotencyKey">, definitiveFailure: string) {
  return deps.db.transaction(async (tx: any) => {
    const [releasedOrder] = await tx.update(orders).set({
      paymentStatus: "unverified",
      paymentProvider: null,
      captureIdempotencyKey: null,
      captureAttemptedAt: null,
      captureRequestSnapshot: null,
      reconciliationAttemptedAt: null,
      lastPaymentFailureCode: definitiveFailure,
      inventoryStatus: "released",
      updatedAt: new Date(),
    }).where(and(
      eq(orders.id, order.id),
      eq(orders.paymentStatus, "capture_pending"),
      eq(orders.captureIdempotencyKey, order.captureIdempotencyKey!),
      eq(orders.inventoryStatus, "reserved"),
    )).returning();
    if (!releasedOrder) return undefined;
    await tx.update(products).set({
      inventory: sql`${products.inventory} + ${releasedOrder.quantity}`,
    }).where(and(eq(products.id, releasedOrder.productId), sql`${products.inventory} IS NOT NULL`));
    return releasedOrder as OrderRow;
  });
}

async function acquireCaptureEvidence(
  order: OrderRow,
  squareClient: SquarePaymentsClient | null,
  isNewCaptureAttempt: boolean,
  amountInCents: number,
) {
  if (order.paymentStatus === "capture_reconciliation") {
    return requireCompletedSquarePayment({
      id: order.squarePaymentId,
      status: order.providerPaymentStatus,
      totalMoney: { amount: BigInt(amountInCents), currency: "USD" },
      createdAt: order.paymentCapturedAt?.toISOString(),
    }, BigInt(amountInCents), "USD");
  }
  if (!isNewCaptureAttempt) {
    // Recovery of an attempt whose dispatch outcome is unknown. A read-only
    // search is tried first; a no-match is never treated as proof of anything.
    if (order.captureAttemptedAt) {
      const reconciliationWindow = getCaptureReconciliationWindow(order.captureAttemptedAt);
      const matchedPayment = await findSquarePaymentByReference({
        referenceId: order.captureIdempotencyKey!,
        listPage: async (cursor) => {
          const { result } = await squareClient!.paymentsApi.listPayments(
            reconciliationWindow.beginTime,
            reconciliationWindow.endTime,
            "DESC",
            cursor,
            buildLocationFilter(order),
            BigInt(amountInCents),
            undefined,
            undefined,
            100,
          );
          return { payments: result.payments, cursor: result.cursor };
        },
      });
      if (matchedPayment) return evaluateSquareCapturePayment(matchedPayment, BigInt(amountInCents));
    }
    if (!order.captureRequestSnapshot) {
      // Legacy P1-03 attempt with no durable request: it cannot be replayed
      // under its original identity, and a new request would risk a second
      // charge, so it stays reserved until provider evidence appears.
      throw codedError("Original Square capture could not be authoritatively reconciled", "CAPTURE_OUTCOME_AMBIGUOUS");
    }
  }
  // Dispatch -- or idempotently replay -- the one immutable request bound to
  // this key. Whether the earlier attempt never left this process or Square
  // processed it and the response was lost, the same key yields one payment.
  const { result } = await squareClient!.paymentsApi.createPayment(buildSquareCaptureRequest(order));
  return evaluateSquareCapturePayment(result.payment, BigInt(amountInCents));
}

function buildLocationFilter(order: OrderRow) {
  return order.captureRequestSnapshot?.locationId ?? process.env.SQUARE_LOCATION_ID!;
}

/**
 * Drive one capture_pending/capture_reconciliation order to verified capture,
 * applying accounting exactly once. Throws coded errors on every other
 * outcome; callers pass them to settleMarketplaceCaptureFailure.
 */
export async function completeMarketplaceCapture(
  deps: CheckoutDeps,
  order: OrderRow,
  options: { isNewCaptureAttempt: boolean; squareClient?: SquarePaymentsClient | null },
) {
  const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);
  if (!order.captureIdempotencyKey || !order.sellerTierSnapshot || !order.commissionRateSnapshot) {
    throw codedError("Capture is pending without a recoverable provider identity", "PAYMENT_RECONCILIATION_REQUIRED");
  }
  const tier = order.sellerTierSnapshot;
  const commissionRate = order.commissionRateSnapshot;
  const squareClient = order.paymentStatus === "capture_reconciliation"
    ? null
    : options.squareClient ?? deps.getSquareClient();

  return executeRecoverableProviderOperation({
    operation: "capture",
    idempotencyKey: order.captureIdempotencyKey,
    invokeProvider: () => acquireCaptureEvidence(order, squareClient, options.isNewCaptureAttempt, amountInCents),
    persistProviderEvidence: async (paymentEvidence) => {
      if (order.paymentStatus === "capture_reconciliation") return paymentEvidence;
      const [evidenceOrder] = await deps.db.update(orders).set({
        ...paymentEvidence,
        paymentStatus: "capture_reconciliation",
        // Provider evidence is now durable; the request (and its single-use
        // payment token) is no longer needed and is not retained.
        captureRequestSnapshot: null,
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, order.id),
        eq(orders.paymentStatus, "capture_pending"),
        eq(orders.captureIdempotencyKey, order.captureIdempotencyKey!),
      )).returning();
      if (!evidenceOrder) throw new Error("capture evidence could not be recorded for reconciliation");
      return paymentEvidence;
    },
    applyLocally: async (paymentEvidence) => deps.db.transaction(async (tx: any) => {
      const [capturedOrder] = await tx.update(orders).set({
        ...paymentEvidence,
        sellerRevenueStatus: "credited",
        inventoryStatus: "sold",
        captureRequestSnapshot: null,
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
      // The pre-P1-05 checkout path already incremented sales_count for a
      // migrated P1-03 order at its original (pre-atomicity) checkout time.
      // Only a genuinely new atomic-checkout order -- never marked with the
      // migration's legacy-provenance sentinel -- counts as a sale here.
      if (order.sellerTierSnapshot !== "legacy_p1_03") {
        await tx.update(products).set({
          salesCount: sql`coalesce(${products.salesCount}, 0) + 1`,
        }).where(eq(products.id, order.productId));
      }
      return capturedOrder as OrderRow;
    }),
  });
}

export type CaptureFailureSettlement =
  | { kind: "declined"; providerCode: string; released: OrderRow | undefined }
  | { kind: "reconciliation_required"; code: string }
  | { kind: "unverified"; message: string }
  | { kind: "ambiguous" }
  | { kind: "unknown" };

/**
 * Only a definitive provider failure releases stock. Every other failure --
 * transport errors, provider outages, unverifiable responses, a search
 * no-match on a legacy attempt -- leaves the reservation in place.
 */
export async function settleMarketplaceCaptureFailure(deps: CheckoutDeps, order: OrderRow, error: any): Promise<CaptureFailureSettlement> {
  const definitiveFailure = getDefinitiveSquarePaymentFailure(error)
    ?? (error?.code === "CAPTURE_DEFINITIVE_FAILURE" ? error.providerCode : null);
  if (definitiveFailure) {
    return { kind: "declined", providerCode: definitiveFailure, released: await releaseMarketplaceReservation(deps, order, definitiveFailure) };
  }
  if (error instanceof ProviderReconciliationRequiredError) return { kind: "reconciliation_required", code: error.code };
  if (error?.code === "PAYMENT_CAPTURE_UNVERIFIED") return { kind: "unverified", message: error.message };
  if (error?.code === "CAPTURE_OUTCOME_AMBIGUOUS" || error?.code === "PAYMENT_RECONCILIATION_REQUIRED" || error?.errors) {
    return { kind: "ambiguous" };
  }
  return { kind: "unknown" };
}

export type ReconciliationOutcome =
  | { kind: "finalized"; orderId: string }
  | { kind: "declined"; orderId: string; providerCode: string }
  | { kind: "ambiguous"; orderId: string }
  | { kind: "skipped"; orderId: string; reason: string }
  | { kind: "error"; orderId: string; message: string };

/** Reconcile a single order. Never throws, so a batch always continues. */
export async function reconcileStalledCaptureOrder(deps: CheckoutDeps, order: OrderRow): Promise<ReconciliationOutcome> {
  if (!["capture_pending", "capture_reconciliation"].includes(order.paymentStatus) || order.inventoryStatus !== "reserved") {
    return { kind: "skipped", orderId: order.id, reason: "not_reconcilable" };
  }
  if (!order.captureIdempotencyKey || !order.sellerTierSnapshot || !order.commissionRateSnapshot || !order.checkoutIdempotencyKey) {
    return { kind: "skipped", orderId: order.id, reason: "snapshot_unverified" };
  }
  const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);
  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    return { kind: "skipped", orderId: order.id, reason: "amount_invalid" };
  }

  try {
    await completeMarketplaceCapture(deps, order, { isNewCaptureAttempt: false });
    return { kind: "finalized", orderId: order.id };
  } catch (error: any) {
    try {
      const settled = await settleMarketplaceCaptureFailure(deps, order, error);
      if (settled.kind === "declined") {
        return settled.released
          ? { kind: "declined", orderId: order.id, providerCode: settled.providerCode }
          : { kind: "skipped", orderId: order.id, reason: "release_conflict" };
      }
      if (settled.kind === "ambiguous") return { kind: "ambiguous", orderId: order.id };
      return { kind: "error", orderId: order.id, message: error?.message ?? settled.kind };
    } catch (settleError: any) {
      return { kind: "error", orderId: order.id, message: settleError?.message ?? "reconciliation settlement failed" };
    }
  }
}

// A capture_pending reservation younger than this is an ordinary in-flight
// checkout and is left to the request that created it.
export const RECONCILIATION_MIN_AGE_MS = 2 * 60 * 1000;
// A claimed order is not claimed again until this long after its last attempt.
// It bounds concurrent workers to one attempt per order and, with
// least-recently-attempted-first ordering, rotates the whole backlog.
export const RECONCILIATION_RETRY_INTERVAL_MS = 4 * 60 * 1000;

/**
 * Atomically claim up to `limit` eligible orders of one queue, least recently
 * attempted first (never-attempted first of all), stamping each claim. SKIP
 * LOCKED keeps concurrent workers' claims disjoint; the stamp moves every
 * claimed row -- ambiguous or not -- behind every row not yet attempted.
 */
async function claimReconciliationBatch(
  deps: CheckoutDeps,
  queue: "capture_reconciliation" | "capture_pending",
  limit: number,
  now: Date,
  minAgeMs: number,
  retryIntervalMs: number,
): Promise<OrderRow[]> {
  const claimedAt = now.toISOString();
  const retryCutoff = new Date(now.getTime() - retryIntervalMs).toISOString();
  const ageFilter = queue === "capture_pending"
    ? sql`AND capture_attempted_at < ${new Date(now.getTime() - minAgeMs).toISOString()}::timestamp`
    : sql``;
  const claimed = await deps.db.execute(sql`
    UPDATE orders SET reconciliation_attempted_at = ${claimedAt}::timestamp
    WHERE id IN (
      SELECT id FROM orders
      WHERE payment_status = ${queue}
        AND inventory_status = 'reserved'
        ${ageFilter}
        AND (reconciliation_attempted_at IS NULL OR reconciliation_attempted_at <= ${retryCutoff}::timestamp)
      ORDER BY reconciliation_attempted_at ASC NULLS FIRST, id ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`);
  const ids = ((claimed as any).rows ?? claimed).map((row: { id: string }) => row.id);
  if (ids.length === 0) return [];
  return deps.db.select().from(orders).where(inArray(orders.id, ids));
}

/**
 * Batch entry point for the cron job. The two queues have separate budgets:
 * capture_reconciliation rows already hold durable provider evidence and are
 * never starved by ambiguous capture_pending rows, and within each queue the
 * rotation guarantees every eligible row is attempted within
 * ceil(eligible / limit) runs no matter how many stay ambiguous.
 */
export async function reconcileAbandonedCheckoutReservations(options: {
  deps?: CheckoutDeps;
  limit?: number;
  minAgeMs?: number;
  retryIntervalMs?: number;
  now?: Date;
} = {}) {
  const deps = options.deps ?? productionCheckoutDeps;
  const limit = options.limit ?? 25;
  const now = options.now ?? new Date();
  const minAgeMs = options.minAgeMs ?? RECONCILIATION_MIN_AGE_MS;
  const retryIntervalMs = options.retryIntervalMs ?? RECONCILIATION_RETRY_INTERVAL_MS;

  const claimed = [
    ...await claimReconciliationBatch(deps, "capture_reconciliation", limit, now, minAgeMs, retryIntervalMs),
    ...await claimReconciliationBatch(deps, "capture_pending", limit, now, minAgeMs, retryIntervalMs),
  ];

  const outcomes: ReconciliationOutcome[] = [];
  for (const order of claimed) outcomes.push(await reconcileStalledCaptureOrder(deps, order));
  const count = (kind: ReconciliationOutcome["kind"]) => outcomes.filter((o) => o.kind === kind).length;
  return {
    scanned: claimed.length,
    finalized: count("finalized"),
    declined: count("declined"),
    ambiguous: count("ambiguous"),
    skipped: count("skipped"),
    errors: count("error"),
    outcomes,
  };
}
