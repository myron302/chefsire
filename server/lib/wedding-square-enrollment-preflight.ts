import { z } from "zod";
import type { WeddingPaidTier } from "./wedding-square-billing-policy";

/**
 * Fail-closed gate for future Wedding Square sandbox enrollment.
 * Intentionally side-effect-free: does not instantiate Square, collect cards,
 * write to Neon, or grant entitlement.
 *
 * Wedding requires separate, explicitly reviewed subscription plan mappings.
 * Never silently reuse Marketplace, catering, or other Square product plans.
 * Require exact, distinct parent plan IDs as well as variation IDs; never
 * normalize provider identities by trimming whitespace.
 */
const exactProviderId = z.string().min(1).refine((value) => value === value.trim());

const sandboxEnvironmentSchema = z.object({
  SQUARE_ENV: z.literal("sandbox"),
  SQUARE_ACCESS_TOKEN: z.string().trim().min(1),
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
