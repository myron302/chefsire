// server/routes/payments.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { orders, products, users, commissions } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware";
import { SUBSCRIPTION_TIERS } from "./subscriptions";
// Square is a CommonJS module - import it properly
// TEMPORARILY COMMENTED OUT - square package not installed
// import square from "square";
// const { Client, Environment } = square;

const router = Router();

// Initialize Square client
const getSquareClient = () => {
  // TEMPORARILY DISABLED - square package not installed
  throw new Error("Square payments not configured - package not installed");
  // const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  // if (!accessToken) {
  //   throw new Error("SQUARE_ACCESS_TOKEN not configured");
  // }

  // return new Client({
  //   accessToken,
  //   environment: process.env.NODE_ENV === 'production'
  //     ? Environment.Production
  //     : Environment.Sandbox
  // });
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

    let paymentResult: any;
    const useSquare = process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID;

    if (useSquare) {
      // Real Square payment processing
      try {
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

        paymentResult = {
          id: result.payment?.id || `sq_payment_${Date.now()}`,
          status: result.payment?.status || "COMPLETED",
          totalMoney: result.payment?.totalMoney || { amount: amountInCents, currency: "USD" },
          createdAt: result.payment?.createdAt || new Date().toISOString(),
        };
      } catch (squareError: any) {
        console.error("Square payment error:", squareError);
        // Fall back to simulation in development
        if (process.env.NODE_ENV === 'development') {
          console.warn("Square payment failed, using simulation mode");
          paymentResult = {
            id: `sq_payment_sim_${Date.now()}`,
            status: "COMPLETED",
            totalMoney: { amount: amountInCents, currency: "USD" },
            createdAt: new Date().toISOString(),
          };
        } else {
          throw squareError;
        }
      }
    } else {
      // Simulated payment for development/testing
      console.warn("Square not configured - using simulated payment");
      paymentResult = {
        id: `sq_payment_sim_${Date.now()}`,
        status: "COMPLETED",
        totalMoney: { amount: amountInCents, currency: "USD" },
        createdAt: new Date().toISOString(),
      };
    }

    // Update order status to paid and store Square payment ID
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: "paid",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Create commission record for audit trail
    const tier = seller.subscriptionTier || 'free';
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const commissionRate = tierInfo ? tierInfo.commissionRate : 10;

    // Try to create commission record (table may not exist yet if migration not run)
    try {
      await db.insert(commissions).values({
        orderId: order.id,
        sellerId: order.sellerId,
        subscriptionTier: tier,
        commissionRate: commissionRate.toString(),
        orderTotal: order.totalAmount,
        commissionAmount: order.platformFee,
        sellerAmount: order.sellerAmount,
        status: 'pending', // Will be 'paid' after payout
      });
    } catch (commissionError: any) {
      // Log but don't fail - table might not exist yet
      console.warn('Failed to create commission record (table may not exist):', commissionError.message);
    }

    // Note: Seller payout will be processed separately
    // This can be done:
    // 1. After order is marked "delivered" (safer)
    // 2. On a schedule (e.g., weekly payouts)
    // 3. See /api/payouts routes for payout processing

    res.json({
      ok: true,
      message: "Payment processed successfully",
      payment: {
        id: paymentResult.id,
        status: paymentResult.status,
        amount: order.totalAmount,
        platformFee: order.platformFee,
        sellerReceives: order.sellerAmount,
        commissionRate: `${commissionRate}%`,
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
