/** Strict owner billing readback gate for opening Square sandbox card entry. */
export function mayBeginWeddingSquareSandboxCheckout(
  configured: boolean,
  billing: { billingMode?: unknown; enrollmentStatus?: unknown; ok?: unknown; billingLive?: unknown } | null,
): boolean {
  return configured === true && billing?.ok === true &&
    billing.billingLive === false && billing.billingMode === "sandbox" &&
    billing.enrollmentStatus === "not_enrolled";
}
