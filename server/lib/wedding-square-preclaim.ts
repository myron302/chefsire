import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareSandboxPreflight } from "./wedding-square-enrollment-preflight";
import { verifyWeddingSquareClaimFingerprint } from "./wedding-square-claim-fingerprint";

/**
 * Read-only, server-side prerequisite for a future enrollment submitter.
 * Must succeed BEFORE advancing reserved -> submitting. Does not call Square,
 * mutate Neon, grant benefits, or accept customer/card IDs from a browser.
 */
type Database = Pick<PoolClient, "query">;
export class WeddingSquarePreclaimError extends Error {
  constructor() {
    super("Saved Square enrollment requires operator review before submission.");
    this.name = "WeddingSquarePreclaimError";
  }
}
// Reject malformed persisted/request identities before returning a reusable
// Square subscription request. Never normalize opaque provider identifiers.
const canonicalId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !/[\s\x00-\x1f\x7f]/.test(value);

type EnrollmentRow = {
  id: string;
  tier: "premium" | "elite";
  square_location_id: string;
  square_plan_variation_id: string;
  square_customer_id: string;
  square_card_id: string;
  requested_start_date: string | null;
  requested_timezone: string;
  idempotency_key: string;
  request_fingerprint: string;
  consented_amount_cents: number;
  consented_currency: string;
};

export function createWeddingSquarePreclaimService(database: Database) {
  return {
    async inspect(attemptId: string, authenticatedUserId: string) {
      if (!canonicalId(attemptId) || !canonicalId(authenticatedUserId) ||
          process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !database || typeof database.query !== "function") throw new WeddingSquarePreclaimError();
      try {
        const result = await database.query<EnrollmentRow>(
          `SELECT id, tier, square_location_id, square_plan_variation_id,
                  square_customer_id, square_card_id, requested_start_date::text AS requested_start_date,
                  requested_timezone, idempotency_key, request_fingerprint,
                  consented_amount_cents, consented_currency
             FROM wedding_square_enrollment_attempts
            WHERE id = $1::uuid AND user_id = $2
              AND square_environment = 'sandbox' AND status = 'reserved'`,
          [attemptId, authenticatedUserId],
        );
        if (result.rows.length !== 1) throw new WeddingSquarePreclaimError();
        const saved = result.rows[0];
        if (saved.id !== attemptId ||
            !canonicalId(saved.idempotency_key) ||
            !canonicalId(saved.square_customer_id) ||
            !canonicalId(saved.square_card_id)) throw new WeddingSquarePreclaimError();
        const configuration = weddingSquareSandboxPreflight(process.env, saved.tier);
        if (saved.consented_currency !== "USD" ||
            saved.consented_amount_cents !== (saved.tier === "premium" ? 2499 : 4999) ||
            saved.square_location_id !== configuration.locationId ||
            saved.square_plan_variation_id !== configuration.planVariationId ||
            saved.requested_timezone !== "UTC") throw new WeddingSquarePreclaimError();

        // Cast DATE to canonical YYYY-MM-DD text in PostgreSQL, before a
        // timezone-dependent JS DATE parser can shift its calendar day.
        const startDate = saved.requested_start_date ?? undefined;
        if (startDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          throw new WeddingSquarePreclaimError();
        }
        const request = Object.freeze({
          idempotencyKey: saved.idempotency_key,
          locationId: saved.square_location_id,
          planVariationId: saved.square_plan_variation_id,
          customerId: saved.square_customer_id,
          cardId: saved.square_card_id,
          timezone: "UTC" as const,
          ...(startDate ? { startDate } : {}),
        });
        verifyWeddingSquareClaimFingerprint({
          claimedIdempotencyKey: saved.idempotency_key,
          persistedRequestFingerprint: saved.request_fingerprint,
          preparedRequest: request,
        });
        return Object.freeze({ attemptId: saved.id, request });
      } catch {
        throw new WeddingSquarePreclaimError();
      }
    },
  };
}

export const weddingSquarePreclaim = createWeddingSquarePreclaimService(pool as Database);
