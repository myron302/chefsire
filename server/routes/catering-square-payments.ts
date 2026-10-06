import { Router, type Request, type RequestHandler } from "express";
import { z } from "zod";
import { WebhooksHelper } from "square";
import { cateringBookingIdSchema } from "@shared/catering-bookings";
import {
  CATERING_ATTEMPT_UNAVAILABLE_CODE,
  CATERING_SQUARE_COPY,
  cateringSquarePayRequestSchema,
  cateringSquarePaymentAttemptIdSchema,
} from "@shared/catering-square-payments";
import { cateringSquareWebhookConfig, type CateringSquareWebhookConfig } from "../lib/square-checkout";
import { requireAuth } from "../middleware";
import { cateringSquarePayLimiter, cateringSquareStatusLimiter } from "../middleware/rate-limit";
import { serializeCateringPaymentAttempt } from "../serializers/catering-booking-payment-attempt";
import { CATERING_BILLING_NOT_FOUND_REFUSAL } from "../services/catering-booking-billing-policy";
import type { CateringSquarePayments, SquareWebhookInput } from "../services/catering-square-payments";
import { cateringSquarePayments } from "../services/catering-square-payments-instance";
import { requireSameOriginJson } from "./square-connection";

/**
 * Catering Phase 2Q routes: a customer pays an issued invoice through Square's hosted checkout, created under the PROVIDER's own
 * connected Square account. See `shared/catering-square-payments.ts` for the funds flow and the attempt state machine.
 *
 * AUTHORIZATION, as in every Catering billing route: the actor is `req.user.id`; the booking is resolved from the PERSISTED
 * participants, so a stranger and a wrong booking id are the same 404; the role is derived from the booking. Paying is
 * CUSTOMER-ONLY: a provider can neither create nor impersonate a customer's payment. A request carries no amount, currency,
 * merchant, location or role -- the pay request body is an empty object, validated strictly.
 *
 * The webhook is UNAUTHENTICATED by nature and so is guarded by Square's HMAC signature over the exact raw body and the exact
 * configured notification URL. A verified delivery is only a trigger: nothing it contains is used as payment evidence.
 */

export { cateringSquareWebhookConfig, type CateringSquareWebhookConfig };

const webhookEnvelope = z.object({
  event_id: z.string().trim().min(1).max(128),
  type: z.string().trim().min(1).max(64),
  merchant_id: z.string().trim().min(1).max(128).optional(),
  data: z.object({ object: z.record(z.unknown()).optional() }).passthrough().optional(),
}).passthrough();

const text = (value: unknown): string | null => (typeof value === "string" && value.length > 0 && value.length <= 128 ? value : null);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? value as Record<string, unknown> : {});

/** Pulls only the identifiers needed to FIND the attempt out of a delivery. The rest of the payload is ignored and never stored. */
export function squareWebhookInputOf(body: unknown): SquareWebhookInput | null {
  const parsed = webhookEnvelope.safeParse(body);
  if (!parsed.success) return null;
  const object = record(parsed.data.data?.object);
  const payment = record(object.payment);
  const orderUpdated = record(object.order_updated);
  const orderCreated = record(object.order_created);
  const order = record(object.order);
  return {
    eventId: parsed.data.event_id,
    eventType: parsed.data.type,
    merchantId: parsed.data.merchant_id ?? null,
    orderId: text(payment.order_id) ?? text(orderUpdated.order_id) ?? text(orderCreated.order_id) ?? text(order.id),
    paymentId: text(payment.id),
  };
}

export function createCateringSquarePaymentsRouter(service: CateringSquarePayments, options: { webhookConfig?: () => CateringSquareWebhookConfig | null; payLimiter?: RequestHandler; statusLimiter?: RequestHandler } = {}) {
  // The shared in-memory limiters by default; a suite that makes many calls from one address passes its own.
  const payLimiter = options.payLimiter ?? cateringSquarePayLimiter;
  const statusLimiter = options.statusLimiter ?? cateringSquareStatusLimiter;
  const router = Router();
  const webhookConfig = options.webhookConfig ?? cateringSquareWebhookConfig;
  const userId = (req: Request) => (req.user as { id: string }).id;
  const unavailable = { message: "Online payment is not available right now.", code: CATERING_ATTEMPT_UNAVAILABLE_CODE };

  router.post("/bookings/:id/billing/invoices/:invoiceId/pay", payLimiter, requireAuth, requireSameOriginJson, async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      const bookingId = cateringBookingIdSchema.parse(req.params.id);
      const invoiceId = z.string().trim().min(1).max(64).parse(req.params.invoiceId);
      cateringSquarePayRequestSchema.parse(req.body ?? {});
      const result = await service.createPayment({ bookingId, invoiceId, userId: userId(req) });
      if (result.kind === "not_found") return res.status(404).json({ message: CATERING_BILLING_NOT_FOUND_REFUSAL.message });
      if (result.kind === "forbidden") return res.status(403).json({ message: "Only the customer on this booking can pay it." });
      if (result.kind === "unavailable") return res.status(503).json(unavailable);
      if (result.kind === "refused") return res.status(result.status).json({ message: result.message, code: result.code });
      // `creating` means Square's answer was uncertain: the same request again resumes the same checkout.
      res.status(result.attempt.state === "creating" ? 202 : 200).json({
        attempt: serializeCateringPaymentAttempt(result.attempt, "customer"),
        reused: result.reused,
        ...(result.attempt.state === "creating" ? { message: CATERING_SQUARE_COPY.creating } : {}),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
      next(error);
    }
  });

  router.get("/bookings/:id/billing/payment-attempts/:attemptId", statusLimiter, requireAuth, async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      const bookingId = cateringBookingIdSchema.parse(req.params.id);
      const attemptId = cateringSquarePaymentAttemptIdSchema.parse(req.params.attemptId);
      const result = await service.getAttempt({ bookingId, attemptId, userId: userId(req) });
      if (result.kind === "not_found") return res.status(404).json({ message: CATERING_BILLING_NOT_FOUND_REFUSAL.message });
      res.json({ attempt: serializeCateringPaymentAttempt(result.attempt, result.role) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
      next(error);
    }
  });

  router.post("/webhooks/square", async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      // Fail closed BEFORE looking at the delivery: not sandbox, or not configured.
      if (!service.enabled()) return res.status(503).json({ ok: false });
      const config = webhookConfig();
      if (!config) return res.status(503).json({ ok: false });
      const signatureHeader = req.get("x-square-hmacsha256-signature");
      const rawBody = (req as Request & { rawBody?: string }).rawBody;
      if (!signatureHeader || typeof rawBody !== "string") return res.status(401).json({ ok: false });
      let valid = false;
      try {
        valid = await WebhooksHelper.verifySignature({ requestBody: rawBody, signatureHeader, signatureKey: config.signatureKey, notificationUrl: config.notificationUrl });
      } catch {
        valid = false;
      }
      if (!valid) return res.status(401).json({ ok: false });
      const input = squareWebhookInputOf(req.body);
      if (!input) return res.status(400).json({ ok: false });
      const result = await service.handleWebhookEvent(input);
      if (result.kind === "retry" || result.kind === "in_flight") return res.status(503).json({ ok: false });
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Catering Square webhook error:", error instanceof Error ? error.name : "unknown");
      return res.status(500).json({ ok: false });
    }
  });

  return router;
}

export default createCateringSquarePaymentsRouter(cateringSquarePayments);
