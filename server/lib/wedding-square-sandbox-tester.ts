/** Operator-selected account for a controlled public-host sandbox acceptance window.
 * This is an additional restriction, never a substitute for authentication,
 * first-party origin checks, owner binding, consent or provider verification.
 * Read only the authenticated server identity, never a request body/header.
 */
export function isWeddingSquareSandboxTester(userId: unknown): boolean {
  const selected = process.env.WEDDING_SQUARE_SANDBOX_TEST_USER_ID;
  const canonical = (id: unknown): id is string => typeof id === "string" &&
    id.length > 0 && id.length <= 200 && !/[\s\x00-\x1f\x7f]/.test(id);
  return process.env.SQUARE_ENV === "sandbox" &&
    process.env.SQUARE_LIVE_PAYMENTS_ENABLED === "false" &&
    canonical(selected) && canonical(userId) && userId === selected;
}
