import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware";
import { weddingSquareEnrollmentSubmitLimiter } from "../middleware/rate-limit";
import { weddingSquareOwnerCardReadback } from "../lib/wedding-square-owner-card-readback";
import { weddingSquareSandboxSubscriptionSubmitter } from "../lib/wedding-square-sandbox-subscription-submitter";

/**
 * Authenticated, *sandbox only* Wedding subscription submit endpoint.
 *
 * This route does NOT collect card data, receive provider IDs, create a saved
 * enrollment reservation, or grant paid access. Only an existing owner-bound,
 * previously consented and securely reserved attempt may be submitted.
 *
 * A separate OFF-by-default submit switch and explicit HTTPS browser origin
 * are required in addition to the existing Square sandbox-enrollment switch.
 * It is not an authorization to enable Square live billing.
 */
type Source = Pick<typeof weddingSquareOwnerCardReadback, "inspect">;
type Submitter = Pick<typeof weddingSquareSandboxSubscriptionSubmitter, "submit">;
const bodySchema = z.object({ attemptId: z.string().uuid() }).strict();

function sandboxSubmissionEnabled(): boolean {
  if (process.env.SQUARE_ENV !== "sandbox" ||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      process.env.WEDDING_SQUARE_SANDBOX_SUBMIT_ENABLED !== "true") return false;
  const origin = process.env.WEDDING_SQUARE_ALLOWED_ORIGIN;
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.origin === origin &&
      url.pathname === "/" && !url.username && !url.password &&
      !url.search && !url.hash && !!url.hostname;
  } catch {
    return false;
  }
}

export function createWeddingSquareSandboxSubmitRouter(
  ownerReadback: Source,
  submitter: Submitter,
  authenticate: RequestHandler = requireAuth,
  limit: RequestHandler = weddingSquareEnrollmentSubmitLimiter,
) {
  const router = Router();
  router.post("/subscription/sandbox/submit", authenticate, limit, async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!sandboxSubmissionEnabled()) return res.status(503).json({
      ok: false, code: "WEDDING_SQUARE_SANDBOX_DISABLED",
    });

    // Enforce an exact, independently configured first-party HTTPS origin on
    // all requests: protects cookie-authenticated users from cross-site POSTs.
    if (req.get("origin") !== process.env.WEDDING_SQUARE_ALLOWED_ORIGIN) {
      return res.status(403).json({ ok: false, code: "WEDDING_SQUARE_ORIGIN_REQUIRED" });
    }
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success || typeof req.user?.id !== "string" ||
        !req.user.id || /[\s\x00-\x1f\x7f]/.test(req.user.id)) {
      return res.status(400).json({ ok: false, code: "WEDDING_SQUARE_INVALID_REQUEST" });
    }

    try {
      // Neither the browser nor a webhook supplies customer/card/merchant IDs.
      // Owner and provider identity must both come from trusted readback.
      const verified = await ownerReadback.inspect(parsed.data.attemptId, req.user.id);
      if (verified.attemptId !== parsed.data.attemptId ||
          verified.authenticatedUserId !== req.user.id ||
          verified.expectedSandboxMerchantId !== process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID) {
        throw new Error("Unverified owner-bound enrollment.");
      }
      const result = await submitter.submit(verified);
      if (result.attemptId !== parsed.data.attemptId ||
          result.status !== "confirmed" ||
          result.grantsEntitlement !== false ||
          result.safeToResubmit !== false ||
          result.requiresPaymentReconciliation !== true) {
        throw new Error("Unconfirmed provider subscription.");
      }

      // A Square-created subscription is NOT a settled paid invoice. Return
      // neither provider/card/customer IDs nor a paid tier/coverage date.
      return res.status(202).json({
        ok: true,
        attemptId: parsed.data.attemptId,
        status: "pending_payment_verification",
        paidEntitlementGranted: false,
      });
    } catch {
      // A timeout or uncertain DB acknowledgement MAY already have created a
      // Square subscription. Never return 'retry safely' or create a new key.
      return res.status(409).json({
        ok: false,
        code: "WEDDING_SQUARE_RECONCILIATION_REQUIRED",
        safeToResubmit: false,
      });
    }
  });
  return router;
}

// This production-mounted router remains unavailable unless both sandbox
// feature switches and the exact HTTPS origin are operator-configured.
export default createWeddingSquareSandboxSubmitRouter(
  weddingSquareOwnerCardReadback,
  weddingSquareSandboxSubscriptionSubmitter,
);
