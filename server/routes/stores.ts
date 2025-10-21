// /httpdocs/server/routes/square.ts
import { Router, Request, Response } from "express";
import express from "express";
import { Client, Environment, WebhooksHelper } from "square";
import { randomUUID } from "node:crypto";

// ✅ DB + schema
import { db } from "../db";
import { users } from "../db/schema"; // this is from your big monolithic schema.ts

const router = Router();

/**
 * REQUIRED ENV VARS
 * -----------------
 * SQUARE_ENV=production|sandbox
 * SQUARE_ACCESS_TOKEN=xxx
 * SQUARE_LOCATION_ID=xxx
 *
 * # Subscription plan VARIATION IDs
 * SQUARE_PLAN_PRO
 * SQUARE_PLAN_PRO_TRIAL
 * SQUARE_PLAN_ENTERPRISE
 * SQUARE_PLAN_ENTERPRISE_TRIAL
 *
 * # Webhooks
 * SQUARE_WEBHOOK_SIGNATURE_KEY
 * SQUARE_WEBHOOK_URL   e.g. https://chefsire.com/api/square/webhook (must EXACTLY match Dashboard)
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
  APP_BASE_URL,
} = process.env;

if (!SQUARE_ACCESS_TOKEN) console.warn("[square] Missing SQUARE_ACCESS_TOKEN");
if (!SQUARE_LOCATION_ID) console.warn("[square] Missing SQUARE_LOCATION_ID");
if (!SQUARE_WEBHOOK_SIGNATURE_KEY) console.warn("[square] Missing SQUARE_WEBHOOK_SIGNATURE_KEY");
if (!SQUARE_WEBHOOK_URL) console.warn("[square] Missing SQUARE_WEBHOOK_URL");

const client = new Client({
  accessToken: SQUARE_ACCESS_TOKEN,
  environment: SQUARE_ENV === "production" ? Environment.Production : Environment.Sandbox,
});

/* ---------------------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------------------*/

/**
 * Try to extract { userId, tier, trial } we stuffed in metadata when creating the link.
 * Square’s webhook payloads differ a bit by event; we probe common places safely.
 */
function extractMeta(evt: any): { userId?: string; tier?: string; trial?: string } {
  const obj =
    evt?.data?.object?.subscription ??
    evt?.data?.object?.order ??
    evt?.data?.object ??
    {};

  const meta =
    obj?.metadata ??
    obj?.customAttributes ??
    obj?.source?.metadata ??
    {};

  return {
    userId: String(meta?.userId ?? "").trim() || undefined,
    tier: String(meta?.tier ?? "").trim() || undefined,
    trial: String(meta?.trial ?? "").trim() || undefined,
  };
}

/**
 * Extract a reasonable “renews/ends at” date from Square’s subscription object if present.
 * Not all events include it; we treat it as optional.
 */
function extractSubscriptionEndsAt(evt: any): Date | null {
  const sub = evt?.data?.object?.subscription ?? {};
  const iso =
    sub?.chargedThroughDate ||
    sub?.invoicedThroughDate ||
    sub?.currentPhase?.endDate ||
    sub?.phases?.[0]?.endDate ||
    null;

  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Update a single user’s subscription fields.
 */
async function setUserSubscription({
  userId,
  tier,
  status,
  endsAt,
}: {
  userId: string;
  tier: "pro" | "enterprise";
  status: "active" | "canceled" | "paused" | "trialing";
  endsAt: Date | null;
}) {
  const { sql } = await import("drizzle-orm");
  await db
    .update(users)
    .set({
      subscriptionTier: tier,
      subscriptionStatus: status,
      subscriptionEndsAt: endsAt ?? null,
    })
    .where(sql`${users.id} = ${userId}`);
}

/* ---------------------------------------------------------------------------------------
 * Routes
 * -------------------------------------------------------------------------------------*/

/**
 * Create hosted checkout for a subscription plan variation.
 * Body: { tier: "pro" | "enterprise", trial?: boolean, userId?: string, email?: string }
 * Returns: { ok: true, url: string }
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

    // We put metadata here so it can flow into webhooks later.
    const { result } = await client.checkoutApi.createPaymentLink({
      idempotencyKey,
      subscriptionPlanId: planVariationId,
      checkoutOptions: {
        redirectUrl: APP_BASE_URL ? `${APP_BASE_URL}/store` : undefined,
        askForShippingAddress: false,
        allowTipping: false,
      },
      prePopulatedData: email ? { buyerEmail: email } : undefined,
      metadata: {
        userId: userId || "",
        tier,
        trial: String(trial),
      },
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
 * One-time payment link (non-subscription)
 * Body: { name, amount, currency?, referenceId?, redirectUrl?, note? }
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
 * Webhook — verifies signature and updates user on subscription events.
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    try {
      const sigHeader = req.header("x-square-hmacsha256-signature");
      const envHeader = req.header("square-environment"); // "Sandbox" | "Production"

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

      const event = JSON.parse(rawBody.toString("utf8"));
      const type: string = event?.type ?? "";

      console.log("[square] webhook OK", {
        type,
        env: envHeader,
        created_at: event?.created_at,
        id: event?.event_id,
      });

      // ----- Handle subscription lifecycle -----
      if (type.startsWith("subscription.")) {
        const meta = extractMeta(event);
        const endsAt = extractSubscriptionEndsAt(event);

        // Determine status mapping
        let status: "active" | "canceled" | "paused" | "trialing" | undefined;
        if (type === "subscription.activated") status = meta.trial === "true" ? "trialing" : "active";
        if (type === "subscription.canceled" || type === "subscription.terminated") status = "canceled";
        if (type === "subscription.paused") status = "paused";
        if (type === "subscription.resumed") status = "active";

        // Determine tier
        const trialFlag = meta.trial === "true";
        let tier: "pro" | "enterprise" | undefined;
        if (meta.tier === "pro" || meta.tier === "enterprise") tier = meta.tier as any;

        if (!meta.userId || !tier || !status) {
          // We can’t safely update without these; just log and ack.
          console.warn("[square] subscription event missing meta (userId/tier/status). Skipping update.", {
            userId: meta.userId,
            tier: meta.tier,
            status,
            type,
          });
        } else {
          try {
            await setUserSubscription({
              userId: meta.userId,
              tier,
              status,
              endsAt,
            });
            console.log("[square] user subscription updated", {
              userId: meta.userId,
              tier,
              status,
              endsAt,
              trialFlag,
            });
          } catch (dbErr) {
            console.error("[square] DB update failed", dbErr);
            // still 200 to stop retries; optionally alert/log for manual fix
          }
        }
      }

      // Acknowledge to Square
      return res.status(200).send("ok");
    } catch (err) {
      console.error("[square] webhook handler error", err);
      return res.status(500).send("server error");
    }
  }
);

export default router;
