import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware";
import { weddingSquareEnrollmentSubmitLimiter } from "../middleware/rate-limit";
import { storage } from "../storage";
import { weddingEntitlement } from "../lib/wedding-entitlement";
import { verifyWeddingEnrollmentConsent } from "../lib/wedding-square-enrollment-consent";
import { weddingSquareSandboxPreflight } from "../lib/wedding-square-enrollment-preflight";
import { weddingSquareCardSetupCoordinator } from "../lib/wedding-square-card-setup-coordinator";

/**
 * Sandbox-only Web Payments SDK card setup. Never accepts a provider customer
 * or card ID, raw PAN/CVV, merchant ID, price, trial clock or Square response.
 * All provider ownership and billing terms are independently checked server
 * side before committing an intent and posting to Square exactly once.
 */
type Service = Pick<typeof weddingSquareCardSetupCoordinator, "setup">;
type Owner = Pick<typeof storage, "getUser">;
type Trial = typeof weddingEntitlement;
const id = z.string().min(1).max(200).refine(s =>
  s === s.trim() && !/[\s\x00-\x1f\x7f]/.test(s));
const bodySchema = z.object({
  sourceId: z.string().min(6).max(16384).startsWith("cnon:"),
  verificationToken: z.string().min(1).max(16384).optional(),
  consent: z.object({
    tier: z.enum(["premium","elite"]),
    consentVersion: z.literal("wedding-monthly-autorenew-v1"),
    acceptedAutomaticMonthlyRenewal: z.literal(true),
    acceptedAmountCents: z.number().int().positive(),
    acceptedCurrency: z.literal("USD"),
    acknowledgedFirstChargeStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }).strict(),
}).strict();

function enabled() {
  const env = process.env;
  if (env.SQUARE_ENV !== "sandbox" ||
      env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
      env.WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED !== "true" ||
      env.WEDDING_SQUARE_SANDBOX_CARD_SETUP_HTTP_ENABLED !== "true" ||
      !id.safeParse(env.SQUARE_APPLICATION_ID).success ||
      !id.safeParse(env.SQUARE_LOCATION_ID).success) return false;
  const origin = env.WEDDING_SQUARE_ALLOWED_ORIGIN;
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.origin === origin &&
      url.pathname === "/" && !url.username && !url.password &&
      !url.search && !url.hash;
  } catch { return false; }
}

export function createWeddingSquareCardSetupRouter(
  source: Service,
  readOwner: Owner,
  entitlement: Trial,
  auth: RequestHandler = requireAuth,
  limit: RequestHandler = weddingSquareEnrollmentSubmitLimiter,
) {
  const router = Router();
  router.get("/subscription/sandbox/card-config", auth, (req,res) => {
    res.set("Cache-Control","private, no-store");
    if (!enabled()) return res.status(503).json({ ok:false, code:"WEDDING_SQUARE_CARD_SETUP_DISABLED" });
    if (!id.safeParse(req.user?.id).success)
      return res.status(401).json({ ok:false, code:"AUTH_REQUIRED" });
    return res.json({
      ok:true, squareEnvironment:"sandbox",
      applicationId:process.env.SQUARE_APPLICATION_ID,
      locationId:process.env.SQUARE_LOCATION_ID,
      cardSetupAvailable:true,
      billingLive:false,
    });
  });
  router.post("/subscription/sandbox/card-setup", auth, limit, async (req,res) => {
    res.set("Cache-Control","private, no-store");
    if (!enabled()) return res.status(503).json({ ok:false, code:"WEDDING_SQUARE_CARD_SETUP_DISABLED" });
    if (req.get("origin") !== process.env.WEDDING_SQUARE_ALLOWED_ORIGIN)
      return res.status(403).json({ok:false,code:"WEDDING_SQUARE_ORIGIN_REQUIRED"});
    if (!id.safeParse(req.user?.id).success || !bodySchema.safeParse(req.body).success)
      return res.status(400).json({ok:false,code:"WEDDING_SQUARE_CARD_SETUP_INVALID"});
    const parsed = bodySchema.parse(req.body);
    const userId = req.user!.id;
    try {
      const owner = await readOwner(userId);
      // Square Customer requires a real, previously verified ChefSire email.
      if (!owner || owner.id !== userId ||
          !z.string().email().max(254).safeParse(owner.email).success ||
          !owner.emailVerifiedAt ||
          !["email_link","google"].includes(owner.emailVerifiedVia ?? "")) {
        return res.status(409).json({ok:false,code:"WEDDING_EMAIL_VERIFICATION_REQUIRED"});
      }
      const state = await entitlement(userId);
      const trialExpiry = state.trial.status === "active" && state.trial.expiresAt
        ? new Date(state.trial.expiresAt) : null;
      const consent = verifyWeddingEnrollmentConsent({
        userId, request:parsed.consent, now:new Date(), trialExpiresAt:trialExpiry,
      });
      const config = weddingSquareSandboxPreflight(process.env,consent.tier);
      const result = await source.setup({
        consent,config,sourceId:parsed.sourceId,
        verificationToken:parsed.verificationToken,
        verifiedEmailAddress:owner.email,
      });
      if (result.status !== "reserved" || result.paidEntitlementGranted !== false ||
          result.safeToResubmit !== false)
        throw Error("Uncertain Square setup state");
      // A saved card is not consent to a settled invoice; submit existing
      // owner-bound subscription attempt via its separately gated route.
      return res.status(202).json({
        ok:true, attemptId:result.attemptId,
        status:"subscription_reserved",paidEntitlementGranted:false,
        safeToResubmit:false,
      });
    } catch {
      return res.status(409).json({
        ok:false,code:"WEDDING_SQUARE_CARD_SETUP_RECONCILIATION_REQUIRED",
        safeToRetry:false,paidEntitlementGranted:false,
      });
    }
  });
  return router;
}
export default createWeddingSquareCardSetupRouter(
  weddingSquareCardSetupCoordinator,storage,weddingEntitlement,
);
