// server/routes/payments.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { orders, products, users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware";
import { SUBSCRIPTION_TIERS } from "./subscriptions";

const router = Router();

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
    });

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

    // Verify order hasn't been paid yet
    if (order.status !== "pending") {
      return res.status(400).json({ ok: false, error: "Order already processed" });
    }

    // TODO: Initialize Square client
    // const squareClient = new Client({
    //   accessToken: process.env.SQUARE_ACCESS_TOKEN,
    //   environment: process.env.NODE_ENV === 'production'
    //     ? Environment.Production
    //     : Environment.Sandbox
    // });

    // Calculate total amount in cents
    const amountInCents = Math.round(parseFloat(order.totalAmount) * 100);

    // TODO: Process payment via Square
    // const { result, statusCode } = await squareClient.paymentsApi.createPayment({
    //   sourceId,
    //   idempotencyKey: orderId, // Use orderId as idempotency key
    //   amountMoney: {
    //     amount: BigInt(amountInCents),
    //     currency: 'USD'
    //   },
    //   autocomplete: true, // ChefSire receives money immediately
    //   locationId: process.env.SQUARE_LOCATION_ID,
    //   note: `ChefSire Order ${orderId}`,
    //   buyerEmailAddress: req.user!.email,
    //   verificationToken
    // });

    // TEMPORARY: Simulate successful payment
    const simulatedPayment = {
      id: `sq_payment_${Date.now()}`,
      status: "COMPLETED",
      totalMoney: { amount: amountInCents, currency: "USD" },
      createdAt: new Date().toISOString(),
    };

    // Update order status to paid
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: "paid",
        // Store Square payment ID for refunds/disputes
        // squarePaymentId: result.payment.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // TODO: Schedule seller payout
    // This would typically be done:
    // 1. Immediately after payment (risky)
    // 2. After order is marked "delivered" (safer)
    // 3. On a schedule (e.g., weekly payouts)

    res.json({
      ok: true,
      message: "Payment processed successfully",
      payment: {
        id: simulatedPayment.id,
        status: simulatedPayment.status,
        amount: order.totalAmount,
        platformFee: order.platformFee,
        sellerReceives: order.sellerAmount,
      },
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Payment processing error:", error);

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

    // TODO: Process refund via Square
    // const { result } = await squareClient.refundsApi.refundPayment({
    //   idempotencyKey: `refund_${orderId}_${Date.now()}`,
    //   amountMoney: {
    //     amount: BigInt(refundAmountCents),
    //     currency: 'USD'
    //   },
    //   paymentId: order.squarePaymentId,
    //   reason: reason || 'Customer requested refund'
    // });

    // Update order status
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: "refunded",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // TODO: If seller was already paid, deduct from their balance
    // or request repayment via Square Connect

    res.json({
      ok: true,
      message: "Refund processed successfully",
      refund: {
        amount: refundAmount,
        // id: result.refund.id,
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
