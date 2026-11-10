/**
 * Permanent closure rollout safety switch. This is intentionally NOT controlled
 * by an environment variable or a staff permission: the provider, content,
 * legal-retention and storage gates must all be completed and reviewed before
 * this hard block can be removed in a separate explicitly approved PR.
 *
 * Test fixtures can exercise internal mutation primitives in isolated Postgres
 * when NODE_ENV=test AND CS_TEST_PG_URL has been set. No application routes
 * import the primitives.
 */
export const PERMANENT_CLOSURE_AVAILABLE = false as const;

export function assertInternalClosureMutationAllowed(): void {
  if (
    PERMANENT_CLOSURE_AVAILABLE !== false ||
    process.env.NODE_ENV !== "test" ||
    !process.env.CS_TEST_PG_URL?.trim()
  ) {
    throw new Error("Permanent closure is disabled. No account data was changed.");
  }
}
