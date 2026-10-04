// server/routes/payouts.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { pool } from "../db";
import { payouts } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware";
import { PAYOUTS_UNAVAILABLE_ERROR, rejectUnavailablePayout } from "../lib/payout-safety";
import { squareOauthInitiationLimiter } from "../middleware/rate-limit";
import {
  createSquareOauthBrowserBinding,
  createSquareOauthClaimId,
  createSquareOauthState,
  hashSquareOauthBrowserBinding,
  hashSquareOauthState,
  SQUARE_OAUTH_BROWSER_BINDING_COOKIE,
  SQUARE_OAUTH_BROWSER_BINDING_COOKIE_PATH,
  SQUARE_OAUTH_STATE_TTL_MS,
  squareOauthBrowserBindingCookieOptions,
} from "../lib/square-oauth-state";
import { squareConnections } from "../lib/square-connection";
import type { AuthorizationFailure } from "../lib/square-connection-service";
import { isSecretBoxConfigured } from "../lib/secret-box";
import { SQUARE_CONNECTION_SCOPES, squareOauthApplication, squareOauthAuthorizeUrl } from "../lib/square-integration";

type PayoutRecord = typeof payouts.$inferSelect;

/** Fixed local destinations only: nothing from the request or from Square is ever placed in a redirect. */
const SQUARE_CALLBACK_FAILURE_REDIRECTS: Record<AuthorizationFailure, string> = {
  provider_rejected: "/settings/payouts?error=square_auth_failed",
  unavailable: "/settings/payouts?error=square_auth_failed",
  merchant_mismatch: "/settings/payouts?error=merchant_mismatch",
  scopes_insufficient: "/settings/payouts?error=scopes_insufficient",
  not_configured: "/settings/payouts?error=square_not_configured",
};

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
 * Initiate Square OAuth flow — returns the auth URL for the seller to visit.
 *
 * Two independent 256-bit CSPRNG secrets are minted: the OAuth `state` nonce
 * (round-tripped through Square) and a browser-binding secret (held only in a
 * host-only, path-scoped cookie on this browser). Only their SHA-256 digests
 * are persisted. Binding the callback to the initiating browser prevents a
 * forwarded authorization URL from letting a different browser's Square
 * authorization complete this ChefSire account's connection.
 *
 * Exactly one transaction row is kept per authenticated user (upsert on
 * user_id), so repeated initiations cannot grow the table, and a stale nonce
 * from an earlier attempt stops matching as soon as a newer one replaces it.
 */
router.get("/connect-square", squareOauthInitiationLimiter, requireAuth, async (req, res) => {
  try {
    const sellerId = req.user!.id;

    // Refuse to start an authorization ChefSire could not complete or could not store safely: without the
    // application secret the code cannot be exchanged, and without the encryption key the token cannot be sealed.
    const application = squareOauthApplication();
    if (!application || !isSecretBoxConfigured() || !pool) {
      return res.status(503).json({ ok: false, error: "Square not configured" });
    }

    const state = createSquareOauthState();
    const nonceHash = hashSquareOauthState(state)!;
    const browserBinding = createSquareOauthBrowserBinding();
    const browserBindingHash = hashSquareOauthBrowserBinding(browserBinding)!;
    const expiresAt = new Date(Date.now() + SQUARE_OAUTH_STATE_TTL_MS);

    await pool.query(
      `INSERT INTO square_oauth_transactions
         (user_id, nonce_hash, browser_binding_hash, expires_at, claim_id, claimed_at, consumed_at)
       VALUES ($1, $2, $3, $4, NULL, NULL, NULL)
       ON CONFLICT (user_id) DO UPDATE
       SET nonce_hash = EXCLUDED.nonce_hash,
           browser_binding_hash = EXCLUDED.browser_binding_hash,
           expires_at = EXCLUDED.expires_at,
           claim_id = NULL,
           claimed_at = NULL,
           consumed_at = NULL,
           created_at = now()`,
      [sellerId, nonceHash, browserBindingHash, expiresAt],
    );

    res.cookie(SQUARE_OAUTH_BROWSER_BINDING_COOKIE, browserBinding, squareOauthBrowserBindingCookieOptions());

    const authUrl = new URL(squareOauthAuthorizeUrl());
    authUrl.searchParams.set("client_id", application.clientId);
    authUrl.searchParams.set("scope", SQUARE_CONNECTION_SCOPES.join(" "));
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
 * Square OAuth callback — exchanges auth code for access token and stores it.
 *
 * The claim below requires BOTH the state digest and the browser-binding
 * digest to match, in the same conditional write. A forwarded authorization
 * URL opened in a different browser carries the correct `state` but that
 * browser never received this session's binding cookie (host-only, scoped to
 * this path), so its binding digest cannot match and the WHERE clause simply
 * excludes the legitimate row: zero rows are claimed, nothing is consumed,
 * and the attacker's own initiation remains usable. A wrong or missing
 * binding therefore fails before any authorization-code exchange, merchant
 * lookup, or credential persistence — and never destroys another seller's
 * valid in-flight OAuth attempt.
 *
 * The browser-binding cookie is cleared only once a claim on THIS exact
 * cookie's digest has succeeded (see below). A different/newer OAuth attempt
 * in the same browser may already own the current cookie; clearing it before
 * a matching claim would let a stale, forged, or otherwise invalid callback
 * silently break that other, still-legitimate in-flight attempt.
 */
router.get("/square-callback", async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query as Record<string, string>;
    const nonceHash = typeof state === "string" ? hashSquareOauthState(state) : null;
    const browserBindingCookie = req.cookies?.[SQUARE_OAUTH_BROWSER_BINDING_COOKIE];
    const browserBindingHash =
      typeof browserBindingCookie === "string" ? hashSquareOauthBrowserBinding(browserBindingCookie) : null;

    if (!nonceHash || !browserBindingHash || !pool) {
      // Do not clear the cookie: it may belong to a different, still-active
      // transaction in this browser (e.g. an older tab whose flow was
      // replaced by a newer initiation).
      return res.status(400).json({ ok: false, error: "Missing or invalid OAuth state" });
    }

    // Claim is a single conditional write requiring both digests together.
    // Exactly one callback can cross this boundary; failures intentionally
    // require the seller to start again. `expires_at > now()` is enforced
    // here, at the point the callback is allowed to start/claim — not below,
    // after provider round-trips, where ordinary Square latency crossing the
    // deadline must not retroactively invalidate an already-valid claim.
    const claimId = createSquareOauthClaimId();
    const claim = await pool.query(
      `UPDATE square_oauth_transactions
       SET claim_id = $3, claimed_at = now()
       WHERE nonce_hash = $1
         AND browser_binding_hash = $2
         AND claimed_at IS NULL
         AND consumed_at IS NULL
         AND expires_at > now()
       RETURNING user_id`,
      [nonceHash, browserBindingHash, claimId],
    ) as { rowCount: number; rows: Array<{ user_id: string }> };
    if (claim.rowCount !== 1) {
      // Same reasoning: an invalid, stale, forged, wrong-binding, or expired
      // claim attempt must not delete the browser-binding cookie for a
      // different, still-valid transaction that may share this browser.
      return res.status(400).json({ ok: false, error: "Invalid or expired OAuth state" });
    }
    const sellerId = claim.rows[0].user_id;

    // The claim above matched this exact cookie's digest, so we now know it
    // belongs to the transaction being terminated. Clear it here regardless
    // of how the rest of this callback resolves (provider denial, exchange
    // failure, merchant mismatch, or success) — a later reconnect mints a
    // fresh cookie of its own, and this transaction can never be reclaimed
    // once claimed_at is set.
    res.clearCookie(SQUARE_OAUTH_BROWSER_BINDING_COOKIE, { path: SQUARE_OAUTH_BROWSER_BINDING_COOKIE_PATH });

    if (oauthError || !code) {
      await pool.query(
        `UPDATE square_oauth_transactions SET consumed_at = now()
         WHERE nonce_hash = $1 AND claim_id = $2 AND consumed_at IS NULL`,
        [nonceHash, claimId],
      );
      return res.redirect("/settings/payouts?error=square_auth_failed");
    }

    // Exchange the code and PROVE the identity behind the token (merchant profile, token status, scopes and
    // payment locations) with the installed SDK, before anything is stored. Any mismatch fails closed.
    const verification = await squareConnections.verifyAuthorizationCode(code);
    if (!verification.ok) {
      return res.redirect(SQUARE_CALLBACK_FAILURE_REDIRECTS[verification.reason]);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [sellerId]);
      // Ownership of the exact claimed attempt is verified by immutable
      // identifiers (nonce digest, user, claim id) plus consumed_at IS NULL.
      // expires_at is intentionally NOT re-checked here: expiration gates
      // whether a callback may START/CLAIM (enforced above), not whether an
      // already-claimed attempt may finish after ordinary Square round-trip
      // latency. claim_id is only ever set by the atomic claim UPDATE above,
      // so a match here already proves this row was validly claimed.
      const transaction = await client.query(
        `SELECT id FROM square_oauth_transactions
         WHERE nonce_hash = $1 AND user_id = $2 AND claim_id = $3
           AND claimed_at IS NOT NULL AND consumed_at IS NULL
         FOR UPDATE`,
        [nonceHash, sellerId, claimId],
      );
      if (transaction.rowCount !== 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "OAuth transaction is no longer current" });
      }

      // Tokens are sealed (AES-256-GCM) before they reach the database; see server/lib/secret-box.ts.
      await squareConnections.persistVerifiedConnection(client, sellerId, verification.verified);
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
    console.error("Square callback error:", error instanceof Error ? error.name : "unknown"); // never the error object: a database error can echo the row it rejected
    res.redirect("/settings/payouts?error=callback_failed");
  }
});

export default router;
