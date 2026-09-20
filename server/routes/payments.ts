// server/routes/payments.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { orders, users, commissions } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware";
import { SUBSCRIPTION_TIERS } from "./subscriptions";
import { requireCompletedSquarePayment } from "../lib/marketplace-payment";
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
  try {
    const schema = z.object({
      orderId: z.string(), // Order created earlier via /api/orders/checkout
      sourceId: z.string(), // Square payment token from frontend
      verificationToken: z.string().optional(), // 3D Secure verification
    }).strict();

    const { orderId, sourceId, verificationToken } = schema.parse(req.body);
    const buyerId = req.user!.id;

    // Get the order
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    // Verify buyer owns this order
    if (order.buyerId !== buyerId) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    // Payment state is independent of fulfillment state.
    if (order.paymentStatus !== "unverified") {
      return res.status(400).json({ ok: false, error: "Order already processed" });
    }

    // Calculate total amount in cents
    const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);

    // Get seller info for commission calculation
    const [seller] = await db
      .select()
      .from(users)
      .where(eq(users.id, order.sellerId))
      .limit(1);

    if (!seller) {
      return res.status(404).json({ ok: false, error: "Seller not found" });
    }

    if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
      return res.status(503).json({
        ok: false,
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
        error: "Marketplace payment capture cannot be verified",
      });
    }

    const squareClient = getSquareClient();
    const { result } = await squareClient.paymentsApi.createPayment({
          sourceId,
          idempotencyKey: orderId, // Use orderId as idempotency key
          amountMoney: {
            amount: BigInt(amountInCents),
            currency: 'USD'
          },
          autocomplete: true, // ChefSire receives money immediately
          locationId: process.env.SQUARE_LOCATION_ID!,
          note: `ChefSire Order ${orderId}`,
          buyerEmailAddress: req.user!.email,
          ...(verificationToken && { verificationToken })
    });
    const paymentEvidence = requireCompletedSquarePayment(
      result.payment,
      BigInt(amountInCents),
      "USD",
    );

    // Create commission record for audit trail
    const tier = seller.subscriptionTier || 'free';
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const commissionRate = tierInfo ? tierInfo.commissionRate : 10;

    const updatedOrder = await db.transaction(async (tx: any) => {
      const [capturedOrder] = await tx
        .update(orders)
        .set({ ...paymentEvidence, updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "unverified")))
        .returning();
      if (!capturedOrder) {
        const conflict = new Error("Payment was already recorded");
        (conflict as Error & { code: string }).code = "PAYMENT_STATE_CONFLICT";
        throw conflict;
      }

      // A commission is created only after exact provider capture verification.
      // The same transaction makes the conditional payment transition the
      // idempotency gate for commission/revenue side effects.
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
    });

    res.json({
      ok: true,
      message: "Payment processed successfully",
      payment: {
        id: paymentEvidence.squarePaymentId,
        status: paymentEvidence.providerPaymentStatus,
        amount: order.totalAmount,
        platformFee: order.platformFee,
        sellerReceives: order.sellerAmount,
        commissionRate: `${commissionRate}%`,
      },
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Payment processing error:", error);

    if (error?.code === "PAYMENT_CAPTURE_UNVERIFIED") {
      return res.status(502).json({ ok: false, code: error.code, error: error.message });
    }
    if (error?.code === "PAYMENT_STATE_CONFLICT") {
      return res.status(409).json({ ok: false, code: error.code, error: error.message });
    }
    // Handle Square-specific errors
    if (error?.errors) {
      return res.status(400).json({
        ok: false,
        error: "Payment failed",
        details: error.errors,
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
  try {
    const schema = z.object({
      orderId: z.string(),
      amount: z.number().optional(), // Partial refund amount
      reason: z.string().optional(),
    });

    const { orderId, amount, reason } = schema.parse(req.body);
    const userId = req.user!.id;

    // Get order
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    // Only seller or admin can refund
    if (order.sellerId !== userId) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    // Calculate refund amount
    const refundAmount = amount || parseFloat(order.totalAmount);
    const refundAmountCents = Math.round(refundAmount * 100);
    if (refundAmountCents !== Math.round(parseFloat(order.totalAmount) * 100)) {
      return res.status(400).json({ ok: false, code: "PARTIAL_REFUND_UNSUPPORTED", error: "Marketplace partial refunds are not safely supported" });
    }

    if (order.paymentStatus !== "captured" || !order.squarePaymentId) {
      return res.status(409).json({ ok: false, code: "PAYMENT_CAPTURE_UNVERIFIED", error: "Order has no verified captured payment" });
    }
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return res.status(503).json({ ok: false, code: "PAYMENT_PROVIDER_UNAVAILABLE", error: "Refund provider unavailable" });
    }

    const squareClient = getSquareClient();
    const { result } = await squareClient.refundsApi.refundPayment({
          idempotencyKey: `refund_${orderId}_${Date.now()}`,
          amountMoney: {
            amount: BigInt(refundAmountCents),
            currency: 'USD',
          },
          paymentId: order.squarePaymentId!,
          reason: reason || 'Customer requested refund',
    });
    const providerRefund = result.refund;
    if (
      !providerRefund?.id || providerRefund.status !== "COMPLETED" ||
      providerRefund.amountMoney?.amount === undefined ||
      BigInt(providerRefund.amountMoney.amount) !== BigInt(refundAmountCents) ||
      providerRefund.amountMoney.currency !== "USD"
    ) {
      return res.status(502).json({ ok: false, code: "REFUND_UNVERIFIED", error: "Square did not return verifiable completed refund evidence" });
    }

    const updatedOrder = await db.transaction(async (tx: any) => {
      const [refundedOrder] = await tx.update(orders).set({
        paymentStatus: "refunded",
        providerPaymentStatus: "REFUNDED",
        squareRefundId: providerRefund.id,
        updatedAt: new Date(),
      }).where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "captured"))).returning();
      if (!refundedOrder) return undefined;
      await tx.update(commissions).set({ status: "refunded" }).where(eq(commissions.orderId, orderId));
      await tx.update(users).set({
        monthlyRevenue: sql`greatest(coalesce(${users.monthlyRevenue}, 0) - ${order.sellerAmount}, 0)`,
      }).where(eq(users.id, order.sellerId));
      return refundedOrder;
    });
    if (!updatedOrder) {
      return res.status(409).json({ ok: false, code: "PAYMENT_STATE_CONFLICT", error: "Payment state changed; reload and retry" });
    }

    res.json({
      ok: true,
      message: "Refund processed successfully",
      refund: {
        amount: refundAmount,
        id: providerRefund.id,
        status: "completed",
      },
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Refund error:", error);
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
