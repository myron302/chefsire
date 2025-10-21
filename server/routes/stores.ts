// /httpdocs/server/routes/square.ts
import { Router, Request, Response } from "express";
import express from "express";
import { Client, Environment, WebhooksHelper } from "square";
import { randomUUID } from "node:crypto";

const router = Router();

/**
 * REQUIRED ENV VARS
 * -----------------
 * SQUARE_ENV=production|sandbox
 * SQUARE_ACCESS_TOKEN=xxx
 * SQUARE_LOCATION_ID=xxx
 *
 * # Subscription plan VARIATION IDs (Catalog variation IDs)
 * SQUARE_PLAN_PRO
 * SQUARE_PLAN_PRO_TRIAL
 * SQUARE_PLAN_ENTERPRISE
 * SQUARE_PLAN_ENTERPRISE_TRIAL
 *
 * # Webhooks
 * SQUARE_WEBHOOK_SIGNATURE_KEY   <-- from your Square Webhook subscription
 * SQUARE_WEBHOOK_URL             <-- must match EXACTLY the Notification URL in Square
 *                                  e.g. https://chefsire.com/api/square/webhook
 */

const {
  SQUARE_ENV = "sandbox",
  SQUARE_ACCESS_TOKEN,
  SQUARE_LOCATION_ID,
  SQUARE_PLAN_PRO,
  SQUARE_PLAN_PRO_TRIAL,
  SQUARE_PLAN_ENTERPRISE,
  SQUARE_PLAN_ENTERPRISE_TRIAL,
  SQUARE_WEBHOOK_SIGNATURE_KEY,
  SQUARE_WEBHOOK_URL,
} = process.env;

if (!SQUARE_ACCESS_TOKEN) {
  console.warn("[square] Missing SQUARE_ACCESS_TOKEN");
}
if (!SQUARE_LOCATION_ID) {
  console.warn("[square] Missing SQUARE_LOCATION_ID");
}
if (!SQUARE_WEBHOOK_SIGNATURE_KEY) {
  console.warn("[square] Missing SQUARE_WEBHOOK_SIGNATURE_KEY (webhook verification will fail)");
}
if (!SQUARE_WEBHOOK_URL) {
  console.warn("[square] Missing SQUARE_WEBHOOK_URL (webhook verification will fail)");
}

const client = new Client({
  accessToken: SQUARE_ACCESS_TOKEN,
  environment: SQUARE_ENV === "production" ? Environment.Production : Environment.Sandbox,
});

/**
 * POST /api/square/subscription-link
 * Body: { tier: "pro" | "enterprise", trial?: boolean, userId?: string, email?: string }
 * Returns: { ok: true, url: string }
 *
 * Creates a hosted checkout for a subscription plan variation.
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

    const idempotencyKey = `sub_${tier}_${trial ? "trial" : "paid"}_${userId || "anon"}_${Date.now()}`;

    // Square Checkout: subscription link via plan variation id
    const { result } = await client.checkoutApi.createPaymentLink({
      idempotencyKey,
      subscriptionPlanId: planVariationId,
      checkoutOptions: {
        redirectUrl: process.env.APP_BASE_URL
          ? `${process.env.APP_BASE_URL}/store`
          : undefined,
        askForShippingAddress: false,
        allowTipping: false,
      },
      prePopulatedData: email ? { buyerEmail: email } : undefined,
      metadata: {
        tier,
        trial: String(trial),
        userId: userId || "",
      },
      // locationId optional here for subscriptions; harmless to include:
      // locationId: SQUARE_LOCATION_ID,
    });

    if (!result?.paymentLink?.url) {
      return res.status(502).json({ ok: false, error: "Failed to create Square payment link." });
    }

    res.json({ ok: true, url: result.paymentLink.url });
  } catch (err: any) {
    console.error("[square] create subscription link error", err);
    res.status(500).json({
      ok: false,
      error: err?.body || err?.message || "Square error",
    });
  }
});

/**
 * OPTIONAL: One-time payment link for a single charge (non-subscription)
 * POST /api/square/checkout-link
 * Body: { name: string, amount: number|string, currency?: string, referenceId?: string, redirectUrl?: string, note?: string }
 */
router.post("/checkout-link", async (req, res) => {
  try {
    const { name, amount, currency = "USD", referenceId, redirectUrl, note } = req.body ?? {};
    if (!name) return res.status(400).json({ ok: false, error: "name is required" });
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ ok: false, error: "amount must be a positive number" });
    }

    const smallestUnit = Math.round(amountNumber * 100);
    const idempotencyKey = referenceId || randomUUID();

    const { result } = await client.checkoutApi.createPaymentLink({
      idempotencyKey,
      quickPay: {
        name,
        priceMoney: {
          amount: BigInt(smallestUnit),
          currency,
        },
        locationId: SQUARE_LOCATION_ID!,
      },
      referenceId,
      redirectUrl,
      checkoutOptions: {
        allowTipping: false,
        note,
      },
    });

    if (!result?.paymentLink?.url) {
      return res.status(502).json({ ok: false, error: "Square did not return a payment link" });
    }

    return res.json({
      ok: true,
      id: result.paymentLink.id,
      url: result.paymentLink.url,
      orderId: result.paymentLink.orderId,
      version: result.paymentLink.version,
    });
  } catch (err: any) {
    const sqErrors = err?.result?.errors;
    if (sqErrors?.length) {
      return res.status(400).json({ ok: false, error: sqErrors });
    }
    console.error("Square checkout-link error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * GET /api/square/locations
 * Dev sanity check.
 */
router.get("/locations", async (_req, res) => {
  try {
    const { result } = await client.locationsApi.listLocations();
    res.json({ ok: true, locations: result.locations });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.body || e?.message });
  }
});

/**
 * POST /api/square/webhook
 * Verifies Square webhook signatures using the SDK helper.
 *
 * IMPORTANT:
 *  - We use express.raw({ type: 'application/json' }) on THIS route only
 *    so we can access the raw body for signature verification.
 *  - SQUARE_WEBHOOK_URL must EXACTLY match your Square subscription's Notification URL.
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    try {
      const sigHeader = req.header("x-square-hmacsha256-signature");
      const envHeader = req.header("square-environment"); // "Sandbox" or "Production" (informational)

      if (!SQUARE_WEBHOOK_SIGNATURE_KEY || !SQUARE_WEBHOOK_URL) {
        console.error("[square] webhook missing env vars");
        return res.status(500).send("Webhook misconfigured");
      }
      if (!sigHeader) {
        console.warn("[square] webhook missing signature header");
        return res.status(400).send("Missing signature");
      }

      const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(String(req.body || ""));
      const isValid = WebhooksHelper.verifySignature(
        sigHeader,
        SQUARE_WEBHOOK_SIGNATURE_KEY,
        SQUARE_WEBHOOK_URL,
        rawBody
      );

      if (!isValid) {
        console.warn("[square] webhook signature INVALID");
        return res.status(400).send("Invalid signature");
      }

      // At this point the event is trusted. Parse JSON and handle.
      const event = JSON.parse(rawBody.toString("utf8"));

      // Minimal safe logging (no PII)
      console.log("[square] webhook OK", {
        type: event?.type,
        env: envHeader,
        created_at: event?.created_at,
        id: event?.event_id,
      });

      // TODO: handle event types your app needs (payments, subscriptions, orders, etc.)
      // Example:
      // if (event.type === "subscription.created") { ... }
      // if (event.type === "payment.updated") { ... }

      return res.status(200).send("ok");
    } catch (err) {
      console.error("[square] webhook handler error", err);
      return res.status(500).send("server error");
    }
  }
);

export default router;
