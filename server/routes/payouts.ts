// server/routes/payouts.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { pool } from "../db";
import { payouts } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware";
import { PAYOUTS_UNAVAILABLE_ERROR, rejectUnavailablePayout } from "../lib/payout-safety";
import {
  createSquareOauthClaimId,
  createSquareOauthState,
  hashSquareOauthState,
  SQUARE_OAUTH_STATE_TTL_MS,
} from "../lib/square-oauth-state";
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

    if (!process.env.SQUARE_APPLICATION_ID || !pool) {
      return res.status(503).json({ ok: false, error: "Square not configured" });
    }

    const state = createSquareOauthState();
    const nonceHash = hashSquareOauthState(state)!;
    const expiresAt = new Date(Date.now() + SQUARE_OAUTH_STATE_TTL_MS);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Serializing on the authenticated principal makes concurrent initiations
      // deterministic and prevents an older callback from replacing a newer link.
      const seller = await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [sellerId]);
      if (seller.rowCount !== 1) throw new Error("Authenticated seller no longer exists");
      await client.query(
        `UPDATE square_oauth_transactions
         SET superseded_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL AND superseded_at IS NULL`,
        [sellerId],
      );
      await client.query(
        `INSERT INTO square_oauth_transactions (nonce_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [nonceHash, sellerId, expiresAt],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const authUrl = new URL("https://connect.squareup.com/oauth2/authorize");
    authUrl.searchParams.set("client_id", process.env.SQUARE_APPLICATION_ID);
    authUrl.searchParams.set("scope", "MERCHANT_PROFILE_READ PAYMENTS_WRITE");
    authUrl.searchParams.set("session", "false");
    authUrl.searchParams.set("state", state);

    res.json({ ok: true, authUrl: authUrl.toString(), expiresAt: expiresAt.toISOString() });
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
    const { code, state, error: oauthError } = req.query as Record<string, string>;
    const nonceHash = typeof state === "string" ? hashSquareOauthState(state) : null;
    if (!nonceHash || !pool) {
      return res.status(400).json({ ok: false, error: "Missing code or state" });
    }

    // Claim is a single conditional write. Exactly one callback can cross this
    // boundary; failures intentionally require the seller to start again.
    const claimId = createSquareOauthClaimId();
    const claim = await pool.query(
      `UPDATE square_oauth_transactions
       SET claim_id = $2, claimed_at = now()
       WHERE nonce_hash = $1
         AND claimed_at IS NULL
         AND consumed_at IS NULL
         AND superseded_at IS NULL
         AND expires_at > now()
       RETURNING user_id`,
      [nonceHash, claimId],
    ) as { rowCount: number; rows: Array<{ user_id: string }> };
    if (claim.rowCount !== 1) {
      return res.status(400).json({ ok: false, error: "Invalid or expired OAuth state" });
    }
    const sellerId = claim.rows[0].user_id;

    if (oauthError || !code) {
      await pool.query(
        `UPDATE square_oauth_transactions SET consumed_at = now()
         WHERE nonce_hash = $1 AND claim_id = $2 AND consumed_at IS NULL`,
        [nonceHash, claimId],
      );
      return res.redirect("/settings/payouts?error=square_auth_failed");
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
      // Do not log Square's response: it can contain authorization material.
      console.error("Square token exchange failed with status", tokenResponse.status);
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
    const profileMerchantId = merchantResult.merchant?.id;
    if (!tokenData.access_token || !tokenData.refresh_token || !tokenData.merchant_id ||
        (profileMerchantId && profileMerchantId !== tokenData.merchant_id)) {
      return res.redirect("/settings/payouts?error=square_auth_failed");
    }

    const accountDetails = {
      merchantId: tokenData.merchant_id,
      locationId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_at,
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [sellerId]);
      const transaction = await client.query(
        `SELECT id FROM square_oauth_transactions
         WHERE nonce_hash = $1 AND user_id = $2 AND claim_id = $3
           AND consumed_at IS NULL AND superseded_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [nonceHash, sellerId, claimId],
      );
      if (transaction.rowCount !== 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "OAuth transaction is no longer current" });
      }

      const existing = await client.query(
        `SELECT id FROM payment_methods
         WHERE user_id = $1 AND provider = 'square'
         ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
        [sellerId],
      );
      if (existing.rowCount) {
        await client.query(
          `UPDATE payment_methods SET provider_id = $2, account_status = 'active',
             account_details = $3::jsonb, verified_at = now(), last_verified_at = now(), updated_at = now()
           WHERE id = $1`,
          [existing.rows[0].id, tokenData.merchant_id, JSON.stringify(accountDetails)],
        );
      } else {
        await client.query(
          `INSERT INTO payment_methods
             (user_id, provider, provider_id, account_status, account_details, is_default, verified_at, last_verified_at)
           VALUES ($1, 'square', $2, 'active', $3::jsonb, true, now(), now())`,
          [sellerId, tokenData.merchant_id, JSON.stringify(accountDetails)],
        );
      }
      await client.query(
        `UPDATE square_oauth_transactions SET consumed_at = now()
         WHERE nonce_hash = $1 AND claim_id = $2`,
        [nonceHash, claimId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.redirect("/settings/payouts?connected=true");
  } catch (error) {
    console.error("Square callback error:", error);
    res.redirect("/settings/payouts?error=callback_failed");
  }
});

export default router;
