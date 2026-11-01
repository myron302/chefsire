import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware";
import { weddingSquareEnrollmentSubmitLimiter } from "../middleware/rate-limit";
import { weddingSquareSandboxCancellation } from "../lib/wedding-square-sandbox-cancellation";

/**
 * Owner-only sandbox cancellation. No subscription ID, payment ID, card ID
 * or customer identifier may come from request body. Legacy cancel endpoint
 * remains unchanged until the complete billing-management UI is implemented.
 */
type Service = Pick<typeof weddingSquareSandboxCancellation, "cancel">;
const noBody = z.object({}).strict();

export function createWeddingSquareSandboxCancellationRouter(
  service: Service,
  auth: RequestHandler = requireAuth,
  limiter: RequestHandler = weddingSquareEnrollmentSubmitLimiter,
) {
  const router = Router();
  router.post("/subscription/sandbox/cancel", auth, limiter, async(req,res) => {
    res.set("Cache-Control","no-store");
    const origin = process.env.WEDDING_SQUARE_ALLOWED_ORIGIN;
    if (process.env.SQUARE_ENV !== "sandbox" ||
        process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
        process.env.WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED !== "true" ||
        !origin) return res.status(503).json({ ok:false, code:"WEDDING_SQUARE_CANCEL_DISABLED" });
    try {
      const url=new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin || url.pathname !== "/" ||
          url.username || url.password || url.search || url.hash) {
        return res.status(503).json({ok:false,code:"WEDDING_SQUARE_CANCEL_DISABLED"});
      }
    } catch {
      return res.status(503).json({ok:false,code:"WEDDING_SQUARE_CANCEL_DISABLED"});
    }
    if (req.get("origin") !== origin)
      return res.status(403).json({ok:false,code:"WEDDING_SQUARE_ORIGIN_REQUIRED"});
    if (!noBody.safeParse(req.body ?? {}).success || !req.user?.id)
      return res.status(400).json({ok:false,code:"WEDDING_SQUARE_CANCEL_INVALID"});
    try {
      const result=await service.cancel(req.user.id);
      if (!result.cancellationScheduled || result.paidEntitlementChanged !== false ||
          result.safeToRetryCancellation !== false) throw Error("Unknown provider outcome");
      return res.status(202).json({
        ok:true, status:"cancellation_scheduled", scheduledEndDate:result.scheduledEndDate,
        paidEntitlementChanged:false,
      });
    } catch {
      return res.status(409).json({
        ok:false, code:"WEDDING_SQUARE_CANCEL_RECONCILIATION_REQUIRED",
        safeToRetryCancellation:false,
      });
    }
  });
  return router;
}
export default createWeddingSquareSandboxCancellationRouter(weddingSquareSandboxCancellation);
