// server/routes/square.ts
import { Router } from "express";
import { Client, Environment } from "square";

const router = Router();

/**
 * REQUIRED ENV VARS
 * -----------------
 * SQUARE_ENV=production|sandbox
 * SQUARE_ACCESS_TOKEN=xxx
 * SQUARE_LOCATION_ID=xxx
 *
 * # Subscription plan VARIATION IDs (use Catalog API or Dashboard to get them)
 * SQUARE_PLAN_PRO            = <subscription plan variation id for Pro (no trial)>
 * SQUARE_PLAN_PRO_TRIAL      = <plan variation id for Pro WITH 100% off first period>
 * SQUARE_PLAN_ENTERPRISE     = <subscription plan variation id for Enterprise (no trial)>
 * SQUARE_PLAN_ENTERPRISE_TRIAL = <plan variation id for Enterprise WITH trial>
 *
 * Notes:
 * - Square Checkout API can create a hosted **subscription checkout** using a plan variation id.
 * - Trials are modeled as an initial PHASE with 100% discount on the plan variation itself.
 */

const {
  SQUARE_ENV = "sandbox",
  SQUARE_ACCESS_TOKEN,
  SQUARE_LOCATION_ID,
  SQUARE_PLAN_PRO,
  SQUARE_PLAN_PRO_TRIAL,
  SQUARE_PLAN_ENTERPRISE,
  SQUARE_PLAN_ENTERPRISE_TRIAL,
} = process.env;

if (!SQUARE_ACCESS_TOKEN) {
  // Don't crash the app, but log loudly
  // eslint-disable-next-line no-console
  console.warn("[square] Missing SQUARE_ACCESS_TOKEN");
}

const client = new Client({
  accessToken: SQUARE_ACCESS_TOKEN,
  environment: SQUARE_ENV === "production" ? Environment.Production : Environment.Sandbox,
});

/**
 * POST /api/square/subscription-link
 * Body: { tier: "pro" | "enterprise", trial?: boolean, userId?: string, email?: string }
 *
 * Returns: { url: string }
 *
 * Implementation: uses Checkout API -> createPaymentLink with subscription plan variation id.
 */
router.post("/subscription-link", async (req, res) => {
  try {
    const { tier, trial = false, userId, email } = req.body as {
      tier: "pro" | "enterprise";
      trial?: boolean;
      userId?: string;
      email?: string;
    };

    let planVariationId: string | undefined;

    if (tier === "pro") {
      planVariationId = trial ? SQUARE_PLAN_PRO_TRIAL : SQUARE_PLAN_PRO;
    } else if (tier === "enterprise") {
      planVariationId = trial ? SQUARE_PLAN_ENTERPRISE_TRIAL : SQUARE_PLAN_ENTERPRISE;
    }

    if (!planVariationId) {
      return res.status(400).json({
        ok: false,
        error: `Missing plan variation id for tier="${tier}" trial=${trial}`,
      });
    }

    // Optional prefill metadata you might want back in your webhook
    const referenceId = `sub_${tier}_${trial ? "trial" : "paid"}_${userId || "anon"}_${Date.now()}`;

    // Square Checkout API – create hosted checkout for a subscription plan
    // Docs: CreatePaymentLink with a "subscription_plan_id" referencing a *plan variation id*.
    // The name of the field is a little confusing — it expects the variation id.
    const body: any = {
      idempotencyKey: referenceId,
      quickPay: undefined, // not used (that's for one-time)
      subscriptionPlanId: planVariationId, // 👈 plan variation id here
      // Optional: redirect after completion
      checkoutOptions: {
        redirectUrl: process.env.APP_BASE_URL
          ? `${process.env.APP_BASE_URL}/store` // send them back to the store dashboard or success page
          : undefined,
        askForShippingAddress: false,
        allowTipping: false,
      },
      // Optional: prepopulate buyer info
      prePopulatedData: email ? { buyerEmail: email } : undefined,
      // Optional: additional metadata echoed in webhooks
      metadata: {
        tier,
        trial: String(trial),
        userId: userId || "",
      },
      // Required by Square behind the scenes
      // locationId can be omitted when using subscriptionPlanId; but it’s OK to include:
      // locationId: SQUARE_LOCATION_ID,
    };

    const { result } = await client.checkoutApi.createPaymentLink(body);
    if (!result?.paymentLink?.url) {
      return res.status(500).json({ ok: false, error: "Failed to create Square payment link." });
    }

    res.json({ ok: true, url: result.paymentLink.url });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[square] create subscription link error", err);
    res.status(500).json({
      ok: false,
      error: err?.body || err?.message || "Square error",
    });
  }
});

/**
 * Optional: expose your Square locations for sanity checks in dev only.
 */
router.get("/locations", async (_req, res) => {
  try {
    const { result } = await client.locationsApi.listLocations();
    res.json({ ok: true, locations: result.locations });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.body || e?.message });
  }
});

export default router;
