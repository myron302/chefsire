// server/routes/payouts.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { orders, users } from "../../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware";

const router = Router();

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

    // TODO: Verify seller has Square account connected
    // const sellerSquareAccount = seller.squareAccountId;
    // if (!sellerSquareAccount) {
    //   return res.status(400).json({
    //     ok: false,
    //     error: "Seller must connect Square account to receive payouts"
    //   });
    // }

    // TODO: Process payout via Square Connect
    // const squareClient = new Client({
    //   accessToken: process.env.SQUARE_ACCESS_TOKEN,
    //   environment: process.env.NODE_ENV === 'production'
    //     ? Environment.Production
    //     : Environment.Sandbox
    // });

    // const { result } = await squareClient.payoutsApi.createPayout({
    //   idempotencyKey: `payout_${sellerId}_${Date.now()}`,
    //   destination: {
    //     type: 'SQUARE_ACCOUNT',
    //     id: sellerSquareAccount
    //   },
    //   amountMoney: {
    //     amount: BigInt(Math.round(totalPayout * 100)),
    //     currency: 'USD'
    //   },
    //   note: `ChefSire payout for ${ordersToPayout.length} orders`
    // });

    // Simulate successful payout
    const simulatedPayout = {
      id: `payout_${Date.now()}`,
      status: "SENT",
      amount: totalPayout,
      createdAt: new Date().toISOString(),
    };

    // Update orders to mark as paid out
    await db
      .update(orders)
      .set({
        // payoutStatus: 'completed',
        // payoutId: simulatedPayout.id,
        // payoutAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(orders.id, ordersToPayout.map((o) => o.id)));

    // Log the transaction
    // TODO: Create payouts table to track all transfers
    // await db.insert(payouts).values({
    //   sellerId,
    //   amount: totalPayout,
    //   commission: totalCommission,
    //   orderCount: ordersToPayout.length,
    //   squarePayoutId: simulatedPayout.id,
    //   status: 'completed'
    // });

    res.json({
      ok: true,
      message: `Payout processed for ${ordersToPayout.length} orders`,
      payout: {
        id: simulatedPayout.id,
        sellerId,
        sellerUsername: seller.username,
        amount: totalPayout.toFixed(2),
        commission: totalCommission.toFixed(2),
        orderCount: ordersToPayout.length,
        status: simulatedPayout.status,
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

    // TODO: Query payouts table
    // const payouts = await db
    //   .select()
    //   .from(payouts)
    //   .where(eq(payouts.sellerId, sellerId))
    //   .orderBy(desc(payouts.createdAt));

    // For now, calculate from orders
    const paidOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.sellerId, sellerId)
          // eq(orders.payoutStatus, 'completed')
        )
      );

    const totalPaidOut = paidOrders.reduce(
      (sum, order) => sum + parseFloat(order.sellerAmount),
      0
    );

    const totalCommission = paidOrders.reduce(
      (sum, order) => sum + parseFloat(order.platformFee),
      0
    );

    res.json({
      ok: true,
      summary: {
        totalPaidOut: totalPaidOut.toFixed(2),
        totalCommission: totalCommission.toFixed(2),
        orderCount: paidOrders.length,
      },
      // payouts: payouts // Would come from payouts table
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
