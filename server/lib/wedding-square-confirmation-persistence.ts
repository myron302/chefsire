import type { PoolClient } from "pg";
import { pool } from "../db";
import type { verifyWeddingSquareCreatedSubscription } from "./wedding-square-subscription-response";

/**
 * Persists a previously verified Square provider subscription identity.
 * No API call, paid entitlement, route, migration, or billing operation.
 * A database acknowledgement failure requires readback/reconciliation.
 */
type VerifiedResponse = ReturnType<typeof verifyWeddingSquareCreatedSubscription>;
type Database = Pick<PoolClient, "query">;

export class WeddingSquareConfirmationPersistenceError extends Error {
  constructor() {
    super("Square enrollment confirmation needs safe reconciliation.");
    this.name = "WeddingSquareConfirmationPersistenceError";
  }
}

export function createWeddingSquareConfirmationPersistence(database: Database) {
  return {
    async confirm(input: {
      attemptId: string;
      authenticatedUserId: string;
      persistedIdempotencyKey: string;
      persistedRequestFingerprint: string;
      verifiedResponse: VerifiedResponse;
    }): Promise<{ attemptId: string; status: "confirmed"; providerSubscriptionId: string }> {
      const { attemptId, authenticatedUserId, persistedIdempotencyKey,
        persistedRequestFingerprint, verifiedResponse } = input;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !attemptId?.trim() || !authenticatedUserId?.trim() ||
          !persistedIdempotencyKey?.trim() ||
          !/^[a-f0-9]{64}$/.test(persistedRequestFingerprint ?? "") ||
          !verifiedResponse?.providerSubscriptionId?.trim() ||
          !verifiedResponse?.verifiedLocationId?.trim() ||
          !verifiedResponse?.verifiedPlanVariationId?.trim() ||
          !["PENDING", "ACTIVE"].includes(verifiedResponse.providerStatus) ||
          !database || typeof database.query !== "function") {
        throw new WeddingSquareConfirmationPersistenceError();
      }
      try {
        const result = await database.query<{ id: string; provider_subscription_id: string }>(
          `UPDATE wedding_square_enrollment_attempts
              SET status = 'confirmed', provider_subscription_id = $5,
                  updated_at = now(), last_error_code = NULL
            WHERE id = $1::uuid AND user_id = $2
              AND square_environment = 'sandbox'
              AND status = 'submitting'
              AND idempotency_key = $3 AND request_fingerprint = $4
              AND square_location_id = $6 AND square_plan_variation_id = $7
              AND provider_subscription_id IS NULL
          RETURNING id, provider_subscription_id`,
          [attemptId, authenticatedUserId, persistedIdempotencyKey,
            persistedRequestFingerprint, verifiedResponse.providerSubscriptionId,
            verifiedResponse.verifiedLocationId, verifiedResponse.verifiedPlanVariationId],
        );
        if (result.rows.length !== 1 ||
            result.rows[0].id !== attemptId ||
            result.rows[0].provider_subscription_id !== verifiedResponse.providerSubscriptionId) {
          throw new WeddingSquareConfirmationPersistenceError();
        }
        // Status confirmed = matching provider response, NEVER proof of
        // a paid invoice or any premium entitlement.
        return Object.freeze({
          attemptId, status: "confirmed" as const,
          providerSubscriptionId: verifiedResponse.providerSubscriptionId,
        });
      } catch {
        throw new WeddingSquareConfirmationPersistenceError();
      }
    },
  };
}

export const weddingSquareConfirmationPersistence =
  createWeddingSquareConfirmationPersistence(pool as Database);
