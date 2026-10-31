import type { PoolClient } from "pg";
import { pool } from "../db";

/**
 * Atomically claims a previously persisted Wedding Square sandbox enrollment
 * before any future Square CreateSubscription call.
 *
 * A claimed attempt is NEVER automatically re-claimed after a timeout:
 * callers must reconcile the provider using its original idempotency key.
 * No Square API call, charge, endpoint or entitlement is implemented here.
 */
type Queryable = Pick<PoolClient, "query">;

export class WeddingSquareSubmissionStateError extends Error {
  constructor() {
    super("Square enrollment state is unavailable or requires reconciliation.");
    this.name = "WeddingSquareSubmissionStateError";
  }
}

export function createWeddingSquareSubmissionStateService(database: Queryable) {
  return {
    async claim(attemptId: string, authenticatedUserId: string) {
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !attemptId?.trim() || !authenticatedUserId?.trim() ||
          !database || typeof database.query !== "function") {
        throw new WeddingSquareSubmissionStateError();
      }
      try {
        const result = await database.query<{
          id: string;
          idempotency_key: string;
          request_fingerprint: string;
        }>(
          `UPDATE wedding_square_enrollment_attempts
           SET status = 'submitting', updated_at = now()
           WHERE id = $1::uuid AND user_id = $2
             AND square_environment = 'sandbox' AND status = 'reserved'
           RETURNING id, idempotency_key, request_fingerprint`,
          [attemptId, authenticatedUserId],
        );
        if (result.rows.length !== 1 ||
            !result.rows[0].idempotency_key ||
            !result.rows[0].request_fingerprint) {
          throw new WeddingSquareSubmissionStateError();
        }
        return Object.freeze({
          attemptId: result.rows[0].id,
          persistedIdempotencyKey: result.rows[0].idempotency_key,
          requestFingerprint: result.rows[0].request_fingerprint,
          status: "submitting" as const,
        });
      } catch {
        throw new WeddingSquareSubmissionStateError();
      }
    },
    async markUnknown(attemptId: string, authenticatedUserId: string) {
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !attemptId?.trim() || !authenticatedUserId?.trim() ||
          !database || typeof database.query !== "function") {
        throw new WeddingSquareSubmissionStateError();
      }
      try {
        const result = await database.query<{ id: string }>(
          `UPDATE wedding_square_enrollment_attempts
           SET status = 'needs_reconciliation', updated_at = now()
           WHERE id = $1::uuid AND user_id = $2
             AND square_environment = 'sandbox' AND status = 'submitting'
           RETURNING id`,
          [attemptId, authenticatedUserId],
        );
        if (result.rows.length !== 1) throw new WeddingSquareSubmissionStateError();
        return Object.freeze({ attemptId: result.rows[0].id, status: "needs_reconciliation" as const });
      } catch {
        throw new WeddingSquareSubmissionStateError();
      }
    },
  };
}

// Not wired to a route. Proposed manual SQL must be approved and applied
// before this service can be invoked in a sandbox enrollment integration.
export const weddingSquareSubmissionState = createWeddingSquareSubmissionStateService(pool as Queryable);
