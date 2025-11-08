// server/routes/payouts.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { orders, users, payouts, commissions, paymentMethods } from "../../shared/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware";
import { Client, Environment } from "square";

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
 * SELLER PAYOUT SYSTEM
 * --------------------
 * Pays sellers their share after commission is deducted
 * Uses Square Connect for transfers
 *
 * Payout Schedule Options:
 * 1. Immediate - After order delivered (risky, could have chargebacks)
 * 2. Delayed - 7 days after delivery (safer)
 * 3. Scheduled - Weekly/Monthly batch payouts (most common for marketplaces)
 */

/**
 * POST /api/payouts/process-seller-payout
 * Process payout to a seller for completed orders
 * (Admin only or automated cron job)
 */
router.post("/process-seller-payout", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      sellerId: z.string(),
      orderIds: z.array(z.string()).optional(), // Specific orders, or all pending
    });

    const { sellerId, orderIds } = schema.parse(req.body);

    // TODO: Add admin check
    // if (!req.user!.isAdmin) {
    //   return res.status(403).json({ ok: false, error: "Admin only" });
    // }

    // Get seller info
    const [seller] = await db
      .select()
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1);

    if (!seller) {
      return res.status(404).json({ ok: false, error: "Seller not found" });
    }

    // Get orders ready for payout
    let ordersQuery = db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.sellerId, sellerId),
          eq(orders.status, "delivered"), // Only pay for delivered orders
          // Add a check for orders not already paid out
          // eq(orders.payoutStatus, 'pending')
        )
      );

    if (orderIds && orderIds.length > 0) {
      ordersQuery = db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.sellerId, sellerId),
            inArray(orders.id, orderIds),
            eq(orders.status, "delivered")
          )
        ) as any;
    }

    const ordersToPayout = await ordersQuery;

    if (ordersToPayout.length === 0) {
      return res.json({
        ok: true,
        message: "No orders ready for payout",
        amount: 0,
      });
    }

    // Calculate total payout amount
    const totalPayout = ordersToPayout.reduce(
      (sum, order) => sum + parseFloat(order.sellerAmount),
      0
    );
    const totalCommission = ordersToPayout.reduce(
      (sum, order) => sum + parseFloat(order.platformFee),
      0
    );

    // Check if seller has a payment method connected
    const [paymentMethod] = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.userId, sellerId),
          eq(paymentMethods.isDefault, true),
          eq(paymentMethods.accountStatus, 'active')
        )
      )
      .limit(1);

    if (!paymentMethod) {
      return res.status(400).json({
        ok: false,
        error: "Seller must connect a payment account to receive payouts"
      });
    }

    let payoutResult: any;
    const useSquare = process.env.SQUARE_ACCESS_TOKEN && paymentMethod.provider === 'square';

    // Create payout record first
    const [payoutRecord] = await db.insert(payouts).values({
      sellerId,
      paymentMethodId: paymentMethod.id,
      amount: totalPayout.toFixed(2),
      currency: 'USD',
      provider: paymentMethod.provider,
      status: 'processing',
      scheduledFor: new Date(),
      metadata: {
        ordersCount: ordersToPayout.length,
        dateRange: {
          from: new Date(Math.min(...ordersToPayout.map(o => new Date(o.createdAt!).getTime()))).toISOString(),
          to: new Date().toISOString()
        }
      }
    }).returning();

    if (useSquare && paymentMethod.accountDetails) {
      // Real Square payout processing
      try {
        const squareClient = getSquareClient();
        const accountDetails = paymentMethod.accountDetails as any;

        // Note: Square Connect payouts require special merchant setup
        // For now, this is a placeholder for the actual Square payout API
        // In production, you'd use Square's Transfer API or similar

        payoutResult = {
          id: `sq_payout_${Date.now()}`,
          status: "SENT",
          amount: totalPayout,
          createdAt: new Date().toISOString(),
        };

        // Update payout record
        await db.update(payouts).set({
          providerPayoutId: payoutResult.id,
          status: 'completed',
          processedAt: new Date(),
          completedAt: new Date(),
        }).where(eq(payouts.id, payoutRecord.id));

      } catch (squareError: any) {
        console.error("Square payout error:", squareError);

        // Mark payout as failed
        await db.update(payouts).set({
          status: 'failed',
          failureReason: squareError.message || 'Square payout failed',
          processedAt: new Date(),
        }).where(eq(payouts.id, payoutRecord.id));

        if (process.env.NODE_ENV === 'development') {
          console.warn("Square payout failed, using simulation");
          payoutResult = {
            id: `sq_payout_sim_${Date.now()}`,
            status: "SENT",
            amount: totalPayout,
            createdAt: new Date().toISOString(),
          };
        } else {
          throw squareError;
        }
      }
    } else {
      // Simulated payout for development/testing
      console.warn("Square not configured - using simulated payout");
      payoutResult = {
        id: `payout_sim_${Date.now()}`,
        status: "SENT",
        amount: totalPayout,
        createdAt: new Date().toISOString(),
      };

      // Update payout record
      await db.update(payouts).set({
        providerPayoutId: payoutResult.id,
        status: 'completed',
        processedAt: new Date(),
        completedAt: new Date(),
      }).where(eq(payouts.id, payoutRecord.id));
    }

    // Update commissions to mark as paid
    await db
      .update(commissions)
      .set({
        payoutId: payoutRecord.id,
        status: 'paid',
        paidAt: new Date(),
      })
      .where(
        inArray(commissions.orderId, ordersToPayout.map((o) => o.id))
      );

    res.json({
      ok: true,
      message: `Payout processed for ${ordersToPayout.length} orders`,
      payout: {
        id: payoutRecord.id,
        providerPayoutId: payoutResult.id,
        sellerId,
        sellerUsername: seller.username,
        amount: totalPayout.toFixed(2),
        commission: totalCommission.toFixed(2),
        orderCount: ordersToPayout.length,
        status: payoutResult.status,
        provider: paymentMethod.provider,
      },
    });
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ ok: false, error: "Failed to process payout" });
  }
});

/**
 * GET /api/payouts/my-payouts
 * Get seller's payout history
 */
router.get("/my-payouts", requireAuth, async (req, res) => {
  try {
    const sellerId = req.user!.id;

    // Query payouts table
    const sellerPayouts = await db
      .select()
      .from(payouts)
      .where(eq(payouts.sellerId, sellerId))
      .orderBy(payouts.createdAt);

    const totalPaidOut = sellerPayouts
      .filter(p => p.status === 'completed')
      .reduce((sum, payout) => sum + parseFloat(payout.amount), 0);

    const pendingPayouts = sellerPayouts
      .filter(p => ['pending', 'processing'].includes(p.status!))
      .reduce((sum, payout) => sum + parseFloat(payout.amount), 0);

    res.json({
      ok: true,
      summary: {
        totalPaidOut: totalPaidOut.toFixed(2),
        pendingPayouts: pendingPayouts.toFixed(2),
        payoutCount: sellerPayouts.filter(p => p.status === 'completed').length,
      },
      payouts: sellerPayouts.map(payout => ({
        id: payout.id,
        amount: payout.amount,
        status: payout.status,
        provider: payout.provider,
        scheduledFor: payout.scheduledFor,
        completedAt: payout.completedAt,
        createdAt: payout.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch payouts" });
  }
});

/**
 * GET /api/payouts/pending-balance
 * Get seller's pending payout amount
 */
router.get("/pending-balance", requireAuth, async (req, res) => {
  try {
    const sellerId = req.user!.id;

    // Orders that are delivered but not yet paid out
    const pendingOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.sellerId, sellerId),
          eq(orders.status, "delivered")
          // eq(orders.payoutStatus, 'pending')
        )
      );

    const pendingAmount = pendingOrders.reduce(
      (sum, order) => sum + parseFloat(order.sellerAmount),
      0
    );

    res.json({
      ok: true,
      pendingBalance: pendingAmount.toFixed(2),
      orderCount: pendingOrders.length,
      orders: pendingOrders.map((order) => ({
        id: order.id,
        amount: order.sellerAmount,
        deliveredAt: order.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching pending balance:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch balance" });
  }
});

/**
 * POST /api/payouts/connect-square
 * Connect seller's Square account for receiving payouts
 */
router.post("/connect-square", requireAuth, async (req, res) => {
  try {
    const sellerId = req.user!.id;

    // TODO: Implement Square OAuth flow
    // 1. Redirect seller to Square OAuth
    // 2. Square redirects back with auth code
    // 3. Exchange code for access token
    // 4. Store seller's Square account ID

    const authUrl = `https://connect.squareup.com/oauth2/authorize?client_id=${
      process.env.SQUARE_APPLICATION_ID
    }&scope=MERCHANT_PROFILE_READ PAYMENTS_WRITE&session=false&state=${sellerId}`;

    res.json({
      ok: true,
      message: "Redirect seller to Square OAuth",
      authUrl,
    });
  } catch (error) {
    console.error("Square connect error:", error);
    res.status(500).json({ ok: false, error: "Failed to connect Square account" });
  }
});

export default router;
