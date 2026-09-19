// server/routes/payouts.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { payouts, paymentMethods } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware";
import { PAYOUTS_UNAVAILABLE_ERROR, rejectUnavailablePayout } from "../lib/payout-safety";
// Square is a CommonJS module - import it properly
import square from "square";
const { Client, Environment } = square;

type PayoutRecord = typeof payouts.$inferSelect;

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
router.post("/process-seller-payout", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Square Connect account linkage is not a transfer API. Until a provider can
    // submit and verify a transfer, do not calculate, claim, or persist anything.
    const rejection = rejectUnavailablePayout(req.body);
    return res.status(rejection.status).json(rejection.body);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Invalid payout request" });
    }
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
    let sellerPayouts: PayoutRecord[];
    try {
      sellerPayouts = await db
        .select()
        .from(payouts)
        .where(eq(payouts.sellerId, sellerId))
        .orderBy(payouts.createdAt);
    } catch (_error: unknown) {
      // Table doesn't exist yet - return empty state
      return res.json({
        ok: true,
        summary: {
          totalPaidOut: "0.00",
          pendingPayouts: "0.00",
          payoutCount: 0,
        },
        payouts: [],
        message: "Payout system not fully configured. Run database migration to enable this feature."
      });
    }

    // This application has never had a provider-confirmation implementation.
    // Preserve legacy rows, but do not present their local `completed` value as
    // proof that money moved.
    const totalPaidOut = 0;

    const pendingPayouts = sellerPayouts
      .filter(p => ['pending', 'processing'].includes(p.status!))
      .reduce((sum, payout) => sum + parseFloat(payout.amount), 0);

    res.json({
      ok: true,
      summary: {
        totalPaidOut: totalPaidOut.toFixed(2),
        pendingPayouts: pendingPayouts.toFixed(2),
        payoutCount: 0,
      },
      payouts: sellerPayouts.map(payout => ({
        id: payout.id,
        amount: payout.amount,
        status: payout.status === "completed" ? "unverified_legacy" : payout.status,
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
  // Marketplace orders have a nullable Square ID but no provider-verified
  // capture lifecycle. Delivery alone therefore cannot prove payout eligibility.
  res.status(503).json({
    ok: false,
    code: "PAYOUT_ELIGIBILITY_UNVERIFIABLE",
    error: PAYOUTS_UNAVAILABLE_ERROR,
    pendingBalance: "0.00",
    orderCount: 0,
    orders: [],
  });
});

/**
 * GET /api/payouts/connect-square
 * Initiate Square OAuth flow — returns the auth URL for the seller to visit
 */
router.get("/connect-square", requireAuth, async (req, res) => {
  try {
    const sellerId = req.user!.id;

    if (!process.env.SQUARE_APPLICATION_ID) {
      return res.status(503).json({ ok: false, error: "Square not configured" });
    }

    const authUrl = `https://connect.squareup.com/oauth2/authorize?client_id=${
      encodeURIComponent(process.env.SQUARE_APPLICATION_ID)
    }&scope=MERCHANT_PROFILE_READ+PAYMENTS_WRITE&session=false&state=${encodeURIComponent(sellerId)}`;

    res.json({ ok: true, authUrl });
  } catch (error) {
    console.error("Square connect error:", error);
    res.status(500).json({ ok: false, error: "Failed to initiate Square connection" });
  }
});

/**
 * GET /api/payouts/square-callback
 * Square OAuth callback — exchanges auth code for access token and stores it
 */
router.get("/square-callback", async (req, res) => {
  try {
    const { code, state: sellerId, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      return res.redirect(`/settings/payouts?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !sellerId) {
      return res.status(400).json({ ok: false, error: "Missing code or state" });
    }

    if (!process.env.SQUARE_APPLICATION_ID || !process.env.SQUARE_APPLICATION_SECRET) {
      return res.status(503).json({ ok: false, error: "Square not fully configured" });
    }

    // Exchange auth code for access token
    const tokenResponse = await fetch("https://connect.squareup.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Square-Version": "2024-01-18" },
      body: JSON.stringify({
        client_id: process.env.SQUARE_APPLICATION_ID,
        client_secret: process.env.SQUARE_APPLICATION_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error("Square token exchange failed:", tokenError);
      return res.redirect("/settings/payouts?error=square_auth_failed");
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_at: string;
      merchant_id: string;
    };

    // Fetch merchant profile to get location ID
    const squareClient = new Client({
      accessToken: tokenData.access_token,
      environment: process.env.NODE_ENV === "production" ? Environment.Production : Environment.Sandbox,
    });
    const { result: merchantResult } = await squareClient.merchantsApi.retrieveMerchant("me");
    const locationId = merchantResult.merchant?.mainLocationId || undefined;

    // Upsert payment method record for this seller
    const existing = await db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.userId, sellerId), eq(paymentMethods.provider, "square")))
      .limit(1);

    const accountDetails = {
      merchantId: tokenData.merchant_id,
      locationId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_at,
    };

    if (existing.length > 0) {
      await db
        .update(paymentMethods)
        .set({
          accountStatus: "active",
          accountDetails,
          providerId: tokenData.merchant_id,
          verifiedAt: new Date(),
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentMethods.id, existing[0].id));
    } else {
      await db.insert(paymentMethods).values({
        userId: sellerId,
        provider: "square",
        providerId: tokenData.merchant_id,
        accountStatus: "active",
        accountDetails,
        isDefault: true,
        verifiedAt: new Date(),
        lastVerifiedAt: new Date(),
      });
    }

    res.redirect("/settings/payouts?connected=true");
  } catch (error) {
    console.error("Square callback error:", error);
    res.redirect("/settings/payouts?error=callback_failed");
  }
});

export default router;
