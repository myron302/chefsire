import { Router, type Request } from "express";
import { WebhooksHelper } from "square";
import { z } from "zod";
import { pool } from "../db";

/**
 * Wedding Square sandbox-only webhook intake.
 *
 * SECURITY: The raw UTF-8 body comes from server/app.ts express.json verify,
 * and is authenticated against the EXACT operator-configured Square webhook
 * notification URL and dedicated Wedding signature key. It is never rebuilt
 * using req.protocol/Host/forwarded headers or JSON.stringify(req.body).
 *
 * A signed event is an UNTRUSTED notification, never proof of payment, period
 * coverage, refund status, customer ownership, or paid entitlement.
 */
const canonicalId = z.string().min(1).max(200).refine((v) =>
  !/[\s\x00-\x1f\x7f]/.test(v),
);
const eventSchema = z.object({
  event_id: canonicalId,
  type: z.string().min(1).max(100).refine((v) => v === v.trim() && !/[\x00-\x1f\x7f]/.test(v)),
  merchant_id: canonicalId,
}).passthrough();

type EventEvidence = Readonly<{
  eventId: string;
  eventType: string;
  merchantId: string;
}>;

export type WeddingSquareWebhookSink = {
  record(event: EventEvidence): Promise<"recorded" | "duplicate">;
};

type SqlPool = {
  query(sql: string, parameters: string[]): Promise<{ rowCount: number | null }>;
};

export class WeddingSquareWebhookIntakeError extends Error {
  constructor() {
    super("Wedding Square webhook event could not be durably recorded.");
    this.name = "WeddingSquareWebhookIntakeError";
  }
}

const WEBHOOK_PATH = "/api/wedding/subscription/webhooks/square";

function sandboxWebhookConfig() {
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      process.env.WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED !== "true") {
    return null;
  }
  const merchantId = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
  const signatureKey = process.env.WEDDING_SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.WEDDING_SQUARE_WEBHOOK_NOTIFICATION_URL;
  if (!canonicalId.safeParse(merchantId).success ||
      typeof signatureKey !== "string" || signatureKey.length < 20 ||
      typeof notificationUrl !== "string") {
    return null;
  }
  try {
    const parsed = new URL(notificationUrl);
    if (parsed.protocol !== "https:" ||
        !parsed.hostname || parsed.username || parsed.password ||
        parsed.search || parsed.hash || parsed.pathname !== WEBHOOK_PATH) return null;
    return { merchantId: merchantId!, signatureKey, notificationUrl };
  } catch {
    return null;
  }
}

export function createWeddingSquareWebhookIntake(database: SqlPool): WeddingSquareWebhookSink {
  return {
    async record(event: EventEvidence) {
      const config = sandboxWebhookConfig();
      if (!config ||
          event.merchantId !== config.merchantId ||
          !canonicalId.safeParse(event.eventId).success ||
          !eventSchema.shape.type.safeParse(event.eventType).success) {
        throw new WeddingSquareWebhookIntakeError();
      }

      try {
        // Unique primary key (environment, merchant, event_id) in the pending
        // SQL foundation makes webhook retries idempotent. Do not store raw body,
        // user/card data or any unverified paid timestamps/amounts.
        const result = await database.query(
          `INSERT INTO wedding_square_webhook_events
            (event_id, square_environment, square_merchant_id, event_type, processing_status)
           VALUES ($1, 'sandbox', $2, $3, 'pending')
           ON CONFLICT (square_environment, square_merchant_id, event_id) DO NOTHING`,
          [event.eventId, event.merchantId, event.eventType],
        );
        if (result.rowCount === 1) return "recorded";
        if (result.rowCount === 0) return "duplicate";
        throw new WeddingSquareWebhookIntakeError();
      } catch {
        // Missing/not-yet-approved migration, Neon outage, or unknown DB state:
        // fail closed with retryable non-2xx. No silent event loss.
        throw new WeddingSquareWebhookIntakeError();
      }
    },
  };
}

export function createWeddingSquareWebhookRouter(sink: WeddingSquareWebhookSink) {
  const router = Router();

  // Final path: POST /api/wedding/subscription/webhooks/square.
  // This route must not use requireAuth: Square authenticates via signature.
  router.post("/subscription/webhooks/square", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const config = sandboxWebhookConfig();
    if (!config) return res.status(503).json({ ok: false });

    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    const signatureHeader = req.get("x-square-hmacsha256-signature");
    if (typeof rawBody !== "string" || rawBody.length === 0 ||
        typeof signatureHeader !== "string" || signatureHeader.length === 0) {
      return res.status(401).json({ ok: false });
    }
    let verified = false;
    try {
      verified = await WebhooksHelper.verifySignature({
        requestBody: rawBody,
        signatureHeader,
        signatureKey: config.signatureKey,
        notificationUrl: config.notificationUrl,
      });
    } catch {
      verified = false;
    }
    if (!verified) return res.status(401).json({ ok: false });

    const event = eventSchema.safeParse(req.body);
    if (!event.success || event.data.merchant_id !== config.merchantId) {
      // A signed but malformed/cross-merchant delivery must NEVER be stored.
      return res.status(400).json({ ok: false });
    }

    // Dedicated Wedding webhook may receive unrelated subscribed event types.
    // Acknowledge and ignore them, never insert into Wedding's evidence queue.
    if (!/^(subscription|invoice|payment|refund)\./.test(event.data.type)) {
      return res.status(204).end();
    }

    try {
      const result = await sink.record({
        eventId: event.data.event_id,
        eventType: event.data.type,
        merchantId: event.data.merchant_id,
      });
      if (result !== "recorded" && result !== "duplicate") throw new WeddingSquareWebhookIntakeError();
      // Durable pending event only; not processed and not paid. Future worker
      // must independently GET provider records before any paid entitlement.
      return res.status(202).json({ ok: true, queued: true });
    } catch {
      res.set("Retry-After", "5");
      return res.status(503).json({ ok: false });
    }
  });

  return router;
}

// Nothing queries or writes Neon until a valid, enabled, signed webhook arrives.
export const weddingSquareWebhookIntake = createWeddingSquareWebhookIntake(pool as unknown as SqlPool);
export default createWeddingSquareWebhookRouter(weddingSquareWebhookIntake);
