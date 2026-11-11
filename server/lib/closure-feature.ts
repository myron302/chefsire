import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

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
  const disabled = () => new Error("Permanent closure is disabled. No account data was changed.");
  if (
    PERMANENT_CLOSURE_AVAILABLE !== false ||
    process.env.NODE_ENV !== "test" ||
    !process.env.CS_TEST_PG_URL?.trim()
  ) throw disabled();

  // This gate is for disposable, local PostgreSQL tests only. A mere nonempty
  // CS_TEST_PG_URL can otherwise be set beside a real Neon DATABASE_URL, with
  // all closure mutation helpers writing against the wrong underlying pool.
  // The harness's sentinel URL is permitted only because it explicitly
  // rebinds the shared pool to the validated CS_TEST_PG_URL.
  try {
    parseLocalTestDatabaseUrl(process.env.CS_TEST_PG_URL);
    const liveUrl = process.env.DATABASE_URL?.trim();
    if (liveUrl && liveUrl !== "postgres://u:p@p3c-tests.invalid/none") {
      parseLocalTestDatabaseUrl(liveUrl);
    }
  } catch {
    throw disabled();
  }
}
