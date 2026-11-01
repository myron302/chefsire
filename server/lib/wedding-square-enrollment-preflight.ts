import { z } from "zod";
import type { WeddingPaidTier } from "./wedding-square-billing-policy";

/**
 * Fail-closed gate for future Wedding Square sandbox enrollment.
 * Intentionally side-effect-free: does not instantiate Square, collect cards,
 * write to Neon, or grant entitlement.
 *
 * Wedding requires separate, explicitly reviewed subscription plan mappings.
 * Never silently reuse Marketplace, catering, or other Square product plans.
 * Require exact merchant, location, distinct parent plan and variation IDs;
 * reject currency mismatches and never trim provider identities. This is
 * configuration validation only, NOT token-owned merchant attestation.
 */
const exactProviderId = z.string().min(1).refine(
  (value) => value === value.trim() && !/[\s\x00-\x1f\x7f]/.test(value),
);

const sandboxEnvironmentSchema = z.object({
  SQUARE_ENV: z.literal("sandbox"),
  // A padded token is not the exact credential the operator configured.
  SQUARE_ACCESS_TOKEN: exactProviderId,
  SQUARE_CURRENCY: z.literal("USD").optional(),
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID: exactProviderId,
  SQUARE_LOCATION_ID: exactProviderId,
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: exactProviderId,
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: exactProviderId,
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID: exactProviderId,
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID: exactProviderId,
}).passthrough();

export class WeddingSquareSandboxUnavailableError extends Error {
  constructor() {
    super("Wedding Square sandbox enrollment is not safely configured.");
    this.name = "WeddingSquareSandboxUnavailableError";
  }
}

export function weddingSquareSandboxPreflight(
  environment: Record<string, string | undefined>,
  tier: WeddingPaidTier,
) {
  // A separate explicit operator switch is required on every environment.
  // It must never enable a production subscription, even by mistake.
  if (environment.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true") {
    throw new WeddingSquareSandboxUnavailableError();
  }
  const safe = sandboxEnvironmentSchema.safeParse(environment);
  if (!safe.success || (tier !== "premium" && tier !== "elite")) {
    throw new WeddingSquareSandboxUnavailableError();
  }
  const cfg = safe.data;
  if (cfg.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID === cfg.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID ||
      cfg.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID === cfg.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID) {
    throw new WeddingSquareSandboxUnavailableError();
  }
  return Object.freeze({
    environment: "sandbox" as const,
    tier,
    merchantId: cfg.WEDDING_SQUARE_SANDBOX_MERCHANT_ID,
    locationId: cfg.SQUARE_LOCATION_ID,
    planId: tier === "premium"
      ? cfg.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID
      : cfg.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID,
    planVariationId: tier === "premium"
      ? cfg.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID
      : cfg.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID,
    // Access token must never be part of returned/read-only status or logs.
  });
}
