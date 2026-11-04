import { isWeddingSquareSandboxTester } from "./wedding-square-sandbox-tester";
/** Strict owner billing readback gate for opening Square sandbox card entry. */
export function mayBeginWeddingSquareSandboxCheckout(
  configured: boolean,
  billing: { billingMode?: unknown; enrollmentStatus?: unknown; ok?: unknown; billingLive?: unknown } | null,
): boolean {
  return configured === true && billing?.ok === true &&
    billing.billingLive === false && billing.billingMode === "sandbox" &&
    billing.enrollmentStatus === "not_enrolled";
}

/** Public-host card entry is available only to the operator-selected tester. */
export function mayBeginWeddingSquareSandboxCheckoutForTester(
  authenticatedUserId: unknown,
  configured: boolean,
  billing: Parameters<typeof mayBeginWeddingSquareSandboxCheckout>[1],
): boolean {
  return isWeddingSquareSandboxTester(authenticatedUserId) &&
    mayBeginWeddingSquareSandboxCheckout(configured, billing);
}
