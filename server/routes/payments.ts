// server/routes/payments.ts
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { orders, users, commissions } from "../../shared/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { requireAuth } from "../middleware";
import { SUBSCRIPTION_TIERS } from "./subscriptions";
import { buildSquareRefundRequest, canonicalizeMarketplaceRefundReason, findSquarePaymentByReference, getDefinitiveSquarePaymentFailure, getDefinitiveSquareRefundFailure, hasLegacyPaymentIndicators, requireCompletedSquarePayment, requireSquareRefundEvidence } from "../lib/marketplace-payment";
import { executeRecoverableProviderOperation, ProviderReconciliationRequiredError } from "../lib/provider-reconciliation";
// Square is a CommonJS module - import it properly
import square from "square";
const { Client, Environment } = square;

const router = Router();

// Initialize Square client
const getSquareClient = () => {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN not configured");
  }

  return new Client({
    accessToken,
    environment: process.env.NODE_ENV === 'production'
      ? Environment.Production
      : Environment.Sandbox
  });
};
/**
 * SQUARE PAYMENT PROCESSING
 * -------------------------
 * ChefSire receives ALL payments via Square
 * Commission is automatically deducted
 * Sellers are paid out separately via Square Connect
 *
 * Required Square Setup:
 * 1. Square Application ID & Access Token
 * 2. Square Connect enabled for payouts
 * 3. Environment variables set
 */

// Square SDK would go here - for now showing the architecture
// import { Client, Environment } from "square";

/**
 * POST /api/payments/create-payment
 * Process payment through Square and create order
 */
router.post("/create-payment", requireAuth, async (req, res) => {
  let captureContext: { orderId: string; idempotencyKey: string } | undefined;
  try {
    const schema = z.object({
      orderId: z.string(),
      sourceId: z.string().optional(),
      verificationToken: z.string().optional(),
    }).strict();
    const { orderId, sourceId, verificationToken } = schema.parse(req.body);
    const buyerId = req.user!.id;

    let [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (order.buyerId !== buyerId) return res.status(403).json({ ok: false, error: "Not authorized" });
    if (order.paymentStatus === "unverified" && hasLegacyPaymentIndicators(order)) {
      return res.status(409).json({
        ok: false,
        code: "LEGACY_PAYMENT_RECONCILIATION_REQUIRED",
        error: "Historical payment activity must be reconciled before this order can be charged",
      });
    }
    if (["cancelled", "refunded"].includes(order.status ?? "")) {
      return res.status(409).json({ ok: false, code: "ORDER_NOT_PAYABLE", error: "A cancelled order cannot be charged" });
    }
    if (!["unverified", "capture_pending", "capture_reconciliation"].includes(order.paymentStatus)) {
      return res.status(400).json({ ok: false, error: "Order already processed" });
    }
    if (order.paymentStatus !== "capture_reconciliation" && (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID)) {
      return res.status(503).json({
        ok: false,
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
        error: "Marketplace payment capture cannot be verified",
      });
    }

    // Persist an explicit recoverable state and stable provider key before the
    // external call. If Square succeeds and local accounting later rolls back,
    // retrying this order recovers the same charge instead of creating another.
    let isNewCaptureAttempt = false;
    if (order.paymentStatus === "unverified") {
      if (!sourceId) return res.status(400).json({ ok: false, error: "A payment source is required" });
      const captureIdempotencyKey = randomUUID();
      const captureAttemptedAt = new Date();
      const [prepared] = await db.update(orders).set({
        paymentStatus: "capture_pending",
        paymentProvider: "square",
        captureIdempotencyKey,
        captureAttemptedAt,
        lastPaymentFailureCode: null,
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, orderId),
        eq(orders.paymentStatus, "unverified"),
        notInArray(orders.status, ["cancelled", "refunded"]),
      )).returning();
      if (!prepared) {
        return res.status(409).json({ ok: false, code: "PAYMENT_STATE_CONFLICT", error: "Order state changed; reload and retry" });
      }
      order = prepared;
      isNewCaptureAttempt = true;
    }
    if (!order.captureIdempotencyKey) {
      return res.status(409).json({ ok: false, code: "PAYMENT_RECONCILIATION_REQUIRED", error: "Capture is pending without a recoverable provider key" });
    }
    captureContext = { orderId, idempotencyKey: order.captureIdempotencyKey };

    const [seller] = await db.select().from(users).where(eq(users.id, order.sellerId)).limit(1);
    if (!seller) return res.status(404).json({ ok: false, error: "Seller not found" });
    const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);
    const tier = seller.subscriptionTier || "free";
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const commissionRate = tierInfo ? tierInfo.commissionRate : 10;
    const squareClient = order.paymentStatus === "capture_reconciliation" ? null : getSquareClient();

    const updatedOrder = await executeRecoverableProviderOperation({
      operation: "capture",
      idempotencyKey: order.captureIdempotencyKey,
      invokeProvider: async (idempotencyKey) => {
        if (order.paymentStatus === "capture_reconciliation") {
          return requireCompletedSquarePayment({
            id: order.squarePaymentId,
            status: order.providerPaymentStatus,
            totalMoney: { amount: BigInt(amountInCents), currency: "USD" },
            createdAt: order.paymentCapturedAt?.toISOString(),
          }, BigInt(amountInCents), "USD");
        }
        if (!isNewCaptureAttempt) {
          if (!order.captureAttemptedAt) {
            const error = new Error("Capture outcome is ambiguous and lacks a reconciliation window");
            (error as Error & { code: string }).code = "CAPTURE_OUTCOME_AMBIGUOUS";
            throw error;
          }
          const matchedPayment = await findSquarePaymentByReference({
            referenceId: order.captureIdempotencyKey,
            listPage: async (cursor) => {
              const { result } = await squareClient!.paymentsApi.listPayments(
                order.captureAttemptedAt!.toISOString(),
                undefined,
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
            Object.assign(error, {
              code: "CAPTURE_DEFINITIVE_FAILURE",
              providerCode: matchedPayment.status,
            });
            throw error;
          }
          return requireCompletedSquarePayment(matchedPayment, BigInt(amountInCents), "USD");
        }
        const { result } = await squareClient!.paymentsApi.createPayment({
          sourceId: sourceId!,
          idempotencyKey,
          amountMoney: { amount: BigInt(amountInCents), currency: "USD" },
          autocomplete: true,
          locationId: process.env.SQUARE_LOCATION_ID!,
          note: `ChefSire Order ${orderId}`,
          referenceId: idempotencyKey,
          buyerEmailAddress: req.user!.email,
          ...(verificationToken && { verificationToken }),
        });
        return requireCompletedSquarePayment(result.payment, BigInt(amountInCents), "USD");
      },
      persistProviderEvidence: async (paymentEvidence) => {
        if (order.paymentStatus === "capture_reconciliation") return paymentEvidence;
        const [evidenceOrder] = await db.update(orders).set({
          ...paymentEvidence,
          paymentStatus: "capture_reconciliation",
          updatedAt: new Date(),
        }).where(and(
          eq(orders.id, orderId),
          eq(orders.paymentStatus, "capture_pending"),
          eq(orders.captureIdempotencyKey, order.captureIdempotencyKey!),
        )).returning();
        if (!evidenceOrder) throw new Error("capture evidence could not be recorded for reconciliation");
        return paymentEvidence;
      },
      applyLocally: async (paymentEvidence) => db.transaction(async (tx: any) => {
        const [capturedOrder] = await tx.update(orders).set({
          ...paymentEvidence,
          updatedAt: new Date(),
        }).where(and(
          eq(orders.id, orderId),
          eq(orders.paymentStatus, "capture_reconciliation"),
          eq(orders.captureIdempotencyKey, order.captureIdempotencyKey!),
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
        return capturedOrder;
      }),
    });

    res.json({
      ok: true,
      message: "Payment processed successfully",
      payment: {
        id: updatedOrder.squarePaymentId,
        status: updatedOrder.providerPaymentStatus,
        amount: order.totalAmount,
        platformFee: order.platformFee,
        sellerReceives: order.sellerAmount,
        commissionRate: `${commissionRate}%`,
      },
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Payment processing error:", error);
    const definitiveFailure = getDefinitiveSquarePaymentFailure(error)
      ?? (error?.code === "CAPTURE_DEFINITIVE_FAILURE" ? error.providerCode : null);
    if (definitiveFailure && captureContext) {
      const [released] = await db.update(orders).set({
        paymentStatus: "unverified",
        paymentProvider: null,
        captureIdempotencyKey: null,
        captureAttemptedAt: null,
        lastPaymentFailureCode: definitiveFailure,
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, captureContext.orderId),
        eq(orders.paymentStatus, "capture_pending"),
        eq(orders.captureIdempotencyKey, captureContext.idempotencyKey),
      )).returning();
      if (!released) {
        return res.status(503).json({ ok: false, code: "PAYMENT_RECONCILIATION_REQUIRED", error: "Payment decline could not be safely released" });
      }
      return res.status(400).json({ ok: false, code: "PAYMENT_DECLINED", error: "Payment was declined", providerCode: definitiveFailure });
    }
    if (error instanceof ProviderReconciliationRequiredError) {
      return res.status(503).json({
        ok: false,
        code: error.code,
        error: "Square returned provider evidence; local reconciliation is still required. Retry this order safely.",
      });
    }
    if (error?.code === "PAYMENT_CAPTURE_UNVERIFIED") {
      return res.status(502).json({ ok: false, code: error.code, error: error.message });
    }
    if (error?.code === "CAPTURE_OUTCOME_AMBIGUOUS" || error?.errors) {
      return res.status(503).json({
        ok: false,
        code: "PAYMENT_RECONCILIATION_REQUIRED",
        error: "The original Square capture outcome is ambiguous; a new charge is blocked pending reconciliation",
      });
    }
    res.status(500).json({ ok: false, error: "Failed to process payment" });
  }
});

/**
 * POST /api/payments/refund
 * Process refund through Square (admin or seller)
 */
router.post("/refund", requireAuth, async (req, res) => {
  let refundInProgress = false;
  let refundContext: { orderId: string; idempotencyKey: string } | undefined;
  try {
    const schema = z.object({
      orderId: z.string(),
      amount: z.number().optional(),
      reason: z.string().max(192).optional(),
    }).strict();
    const { orderId, amount, reason } = schema.parse(req.body);
    const userId = req.user!.id;

    let [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (order.sellerId !== userId) return res.status(403).json({ ok: false, error: "Not authorized" });

    const fullRefundAmountCents = Math.round(parseFloat(order.totalAmount) * 100);
    if (!["captured", "refund_pending", "refund_reconciliation"].includes(order.paymentStatus) || !order.squarePaymentId) {
      return res.status(409).json({ ok: false, code: "PAYMENT_CAPTURE_UNVERIFIED", error: "Order has no verified captured payment" });
    }
    if (order.paymentStatus !== "refund_reconciliation" && !process.env.SQUARE_ACCESS_TOKEN) {
      return res.status(503).json({ ok: false, code: "PAYMENT_PROVIDER_UNAVAILABLE", error: "Refund provider unavailable" });
    }

    // Enter a conservative non-earning state and persist one stable logical
    // refund identity before asking Square to refund the customer.
    if (order.paymentStatus === "captured") {
      const requestedRefundAmountCents = Math.round((amount ?? parseFloat(order.totalAmount)) * 100);
      if (requestedRefundAmountCents !== fullRefundAmountCents) {
        return res.status(400).json({ ok: false, code: "PARTIAL_REFUND_UNSUPPORTED", error: "Marketplace partial refunds are not safely supported" });
      }
      const refundIdempotencyKey = randomUUID();
      const refundAttemptReason = canonicalizeMarketplaceRefundReason(reason);
      const [prepared] = await db.update(orders).set({
        paymentStatus: "refund_pending",
        refundIdempotencyKey,
        refundAttemptPaymentId: order.squarePaymentId,
        refundAttemptAmountCents: fullRefundAmountCents,
        refundAttemptCurrency: "USD",
        refundAttemptReason,
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, orderId),
        eq(orders.paymentStatus, "captured"),
      )).returning();
      if (!prepared) {
        return res.status(409).json({ ok: false, code: "PAYMENT_STATE_CONFLICT", error: "Payment state changed; reload and retry" });
      }
      order = prepared;
    }
    const refundRequest = buildSquareRefundRequest(order);
    refundInProgress = true;
    refundContext = { orderId, idempotencyKey: refundRequest.idempotencyKey };

    const squareClient = order.paymentStatus === "refund_reconciliation" ? null : getSquareClient();
    const refundEvidence = order.paymentStatus === "refund_reconciliation"
      ? requireSquareRefundEvidence({
          id: order.squareRefundId,
          status: "COMPLETED",
          amountMoney: refundRequest.amountMoney,
        }, refundRequest.amountMoney.amount, refundRequest.amountMoney.currency)
      : requireSquareRefundEvidence(
          order.squareRefundId
            ? (await squareClient!.refundsApi.getPaymentRefund(order.squareRefundId)).result.refund
            : (await squareClient!.refundsApi.refundPayment(refundRequest)).result.refund,
          refundRequest.amountMoney.amount,
          refundRequest.amountMoney.currency,
        );

    if (refundEvidence.providerRefundStatus === "PENDING") {
      const [pendingOrder] = await db.update(orders).set({
        squareRefundId: refundEvidence.squareRefundId,
        providerPaymentStatus: "REFUND_PENDING",
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, orderId),
        eq(orders.paymentStatus, "refund_pending"),
        eq(orders.refundIdempotencyKey, order.refundIdempotencyKey),
      )).returning();
      if (!pendingOrder) {
        return res.status(503).json({ ok: false, code: "PAYMENT_RECONCILIATION_REQUIRED", error: "Pending Square refund evidence could not be recorded" });
      }
      return res.status(202).json({
        ok: false,
        code: "REFUND_PENDING",
        error: "Square accepted the refund; provider completion is pending",
        refund: { id: refundEvidence.squareRefundId, status: "pending" },
      });
    }

    if (["FAILED", "REJECTED"].includes(refundEvidence.providerRefundStatus)) {
      const [restored] = await db.update(orders).set({
        paymentStatus: "captured",
        providerPaymentStatus: "COMPLETED",
        squareRefundId: null,
        refundIdempotencyKey: null,
        refundAttemptPaymentId: null,
        refundAttemptAmountCents: null,
        refundAttemptCurrency: null,
        refundAttemptReason: null,
        lastFailedRefundId: refundEvidence.squareRefundId,
        lastRefundFailureStatus: refundEvidence.providerRefundStatus,
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, orderId),
        eq(orders.paymentStatus, "refund_pending"),
        eq(orders.refundIdempotencyKey, order.refundIdempotencyKey),
      )).returning();
      if (!restored) {
        return res.status(503).json({ ok: false, code: "PAYMENT_RECONCILIATION_REQUIRED", error: "Failed Square refund could not be reconciled locally" });
      }
      return res.status(409).json({
        ok: false,
        code: "REFUND_FAILED",
        error: "Square definitively rejected the refund; a new refund attempt may be started",
        refund: { id: refundEvidence.squareRefundId, status: refundEvidence.providerRefundStatus.toLowerCase() },
      });
    }

    const updatedOrder = await executeRecoverableProviderOperation({
      operation: "refund",
      idempotencyKey: order.refundIdempotencyKey,
      // Square was already called/retrieved above; this wrapper makes local
      // failure explicit while retaining the durable pending state and key.
      invokeProvider: async () => refundEvidence,
      persistProviderEvidence: async (evidence) => {
        if (order.paymentStatus === "refund_reconciliation") return evidence;
        const [evidenceOrder] = await db.update(orders).set({
          paymentStatus: "refund_reconciliation",
          providerPaymentStatus: "REFUND_COMPLETED",
          squareRefundId: evidence.squareRefundId,
          updatedAt: new Date(),
        }).where(and(
          eq(orders.id, orderId),
          eq(orders.paymentStatus, "refund_pending"),
          eq(orders.refundIdempotencyKey, order.refundIdempotencyKey!),
        )).returning();
        if (!evidenceOrder) throw new Error("refund evidence could not be recorded for reconciliation");
        return evidence;
      },
      applyLocally: async (evidence) => db.transaction(async (tx: any) => {
        const [refundedOrder] = await tx.update(orders).set({
          paymentStatus: "refunded",
          providerPaymentStatus: "REFUNDED",
          squareRefundId: evidence.squareRefundId,
          updatedAt: new Date(),
        }).where(and(
          eq(orders.id, orderId),
          eq(orders.paymentStatus, "refund_reconciliation"),
          eq(orders.refundIdempotencyKey, order.refundIdempotencyKey!),
        )).returning();
        if (!refundedOrder) throw new Error("refund state changed before reconciliation");
        await tx.update(commissions).set({ status: "refunded" }).where(eq(commissions.orderId, orderId));
        await tx.update(users).set({
          monthlyRevenue: sql`greatest(coalesce(${users.monthlyRevenue}, 0) - ${order.sellerAmount}, 0)`,
        }).where(eq(users.id, order.sellerId));
        return refundedOrder;
      }),
    });

    res.json({
      ok: true,
      message: "Refund processed successfully",
      refund: { amount: Number(refundRequest.amountMoney.amount) / 100, id: refundEvidence.squareRefundId, status: "completed" },
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Refund error:", error);
    const definitiveFailure = getDefinitiveSquareRefundFailure(error);
    if (definitiveFailure && refundContext) {
      const [restored] = await db.update(orders).set({
        paymentStatus: "captured",
        providerPaymentStatus: "COMPLETED",
        squareRefundId: null,
        refundIdempotencyKey: null,
        refundAttemptPaymentId: null,
        refundAttemptAmountCents: null,
        refundAttemptCurrency: null,
        refundAttemptReason: null,
        lastFailedRefundId: null,
        lastRefundFailureStatus: definitiveFailure,
        updatedAt: new Date(),
      }).where(and(
        eq(orders.id, refundContext.orderId),
        eq(orders.paymentStatus, "refund_pending"),
        eq(orders.refundIdempotencyKey, refundContext.idempotencyKey),
      )).returning();
      if (!restored) {
        return res.status(503).json({ ok: false, code: "PAYMENT_RECONCILIATION_REQUIRED", error: "Rejected Square refund could not be reconciled locally" });
      }
      return res.status(400).json({
        ok: false,
        code: "REFUND_REJECTED",
        error: "Square rejected the refund before creating it; a new refund attempt may be started",
        providerCode: definitiveFailure,
      });
    }
    if (error instanceof ProviderReconciliationRequiredError) {
      return res.status(503).json({
        ok: false,
        code: error.code,
        error: "Square returned refund evidence; local reconciliation is still required. Retry this refund safely.",
      });
    }
    if (error?.code === "REFUND_UNVERIFIED") {
      return res.status(502).json({ ok: false, code: error.code, error: error.message });
    }
    if (refundInProgress && (error?.code === "REFUND_OUTCOME_AMBIGUOUS" || error?.errors)) {
      return res.status(503).json({
        ok: false,
        code: "PAYMENT_RECONCILIATION_REQUIRED",
        error: "The Square refund outcome is ambiguous; a new refund is blocked pending reconciliation",
      });
    }
    res.status(500).json({ ok: false, error: "Failed to process refund" });
  }
});

/**
 * GET /api/payments/square-config
 * Get Square configuration for frontend (public key only)
 */
router.get("/square-config", (_req, res) => {
  res.json({
    ok: true,
    config: {
      applicationId: process.env.SQUARE_APPLICATION_ID || "SANDBOX_APP_ID",
      locationId: process.env.SQUARE_LOCATION_ID || "SANDBOX_LOCATION_ID",
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
    },
  });
});

export default router;
