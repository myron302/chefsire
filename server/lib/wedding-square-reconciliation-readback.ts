import type { PoolClient } from "pg";
import { pool } from "../db";

/**
 * Read-only status inspection for an ambiguous sandbox Square enrollment.
 * Never automatically resubmits a Square request, reclaims a reservation,
 * changes Neon state, or grants entitlement.
 * The future reconciliation service must independently read Square's state.
 */
type Database = Pick<PoolClient, "query">;
export class WeddingSquareReconciliationReadbackError extends Error {
  constructor() {
    super("Square enrollment reconciliation status is unavailable.");
    this.name = "WeddingSquareReconciliationReadbackError";
  }
}
type Row = {
  id: string;
  status: string;
  idempotency_key: string;
  request_fingerprint: string;
  provider_subscription_id: string | null;
  square_customer_id: string;
  square_card_id: string;
  square_location_id: string;
  square_plan_variation_id: string;
  requested_start_date: string | null;
  requested_timezone: string;
};

export function createWeddingSquareReconciliationReadback(database: Database) {
  return {
    async inspect(attemptId: string, authenticatedUserId: string) {
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !attemptId?.trim() || !authenticatedUserId?.trim() ||
          !database || typeof database.query !== "function") {
        throw new WeddingSquareReconciliationReadbackError();
      }
      try {
        const result = await database.query<Row>(
          `SELECT id, status, idempotency_key, request_fingerprint,
                  provider_subscription_id, square_customer_id, square_card_id,
                  square_location_id, square_plan_variation_id,
                  requested_start_date::text AS requested_start_date, requested_timezone
             FROM wedding_square_enrollment_attempts
            WHERE id = $1::uuid AND user_id = $2
              AND square_environment = 'sandbox'
              AND status IN ('submitting', 'needs_reconciliation', 'confirmed')`,
          [attemptId, authenticatedUserId],
        );
        if (result.rows.length !== 1) throw new WeddingSquareReconciliationReadbackError();
        const row = result.rows[0];
        if (!["submitting", "needs_reconciliation", "confirmed"].includes(row.status) ||
            !row.idempotency_key?.trim() ||
            !/^[a-f0-9]{64}$/.test(row.request_fingerprint ?? "") ||
            !row.square_customer_id?.trim() || !row.square_card_id?.trim() ||
            !row.square_location_id?.trim() || !row.square_plan_variation_id?.trim() ||
            row.requested_timezone !== "UTC" ||
            (row.requested_start_date !== null &&
             (typeof row.requested_start_date !== "string" ||
              !/^\d{4}-\d{2}-\d{2}$/.test(row.requested_start_date) ||
              !Number.isFinite(Date.parse(row.requested_start_date + "T00:00:00.000Z")) ||
              new Date(row.requested_start_date + "T00:00:00.000Z").toISOString().slice(0, 10) !== row.requested_start_date)) ||
            (row.status === "confirmed" && !row.provider_subscription_id?.trim())) {
          throw new WeddingSquareReconciliationReadbackError();
        }
        // Internal-only identity and stable evidence for independently authorized
        // Square provider readback. Do not expose these to the browser.
        return Object.freeze({
          attemptId: row.id,
          status: row.status as "submitting" | "needs_reconciliation" | "confirmed",
          persistedIdempotencyKey: row.idempotency_key,
          persistedRequestFingerprint: row.request_fingerprint,
          providerSubscriptionId: row.provider_subscription_id,
          customerId: row.square_customer_id,
          cardId: row.square_card_id,
          locationId: row.square_location_id,
          planVariationId: row.square_plan_variation_id,
          requestedStartDate: row.requested_start_date,
          requestedTimezone: row.requested_timezone,
        });
      } catch {
        throw new WeddingSquareReconciliationReadbackError();
      }
    },
  };
}
export const weddingSquareReconciliationReadback =
  createWeddingSquareReconciliationReadback(pool as Database);
