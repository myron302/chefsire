import type { PoolClient } from "pg";
import { pool } from "../db";
import { WEDDING_CONSENT_VERSION, WEDDING_MONTHLY_CENTS } from "./wedding-square-billing-policy";
import type { verifyWeddingSquareCreatedSubscription } from "./wedding-square-subscription-response";

/**
 * Commit provider identity AND the owning Wedding subscription record in one
 * transaction after the response validator has checked the Square result.
 * The Square CREATE request was already made using a previously saved,
 * one-shot idempotency key. Nothing here charges, retries, or grants access.
 *
 * An ACTIVE provider subscription is NOT proof of a completed paid invoice.
 * verified_paid_through is never set here. Any failed or ambiguous transaction
 * stays reconciliation-required; the caller must never re-submit to Square.
 */
type VerifiedResponse = ReturnType<typeof verifyWeddingSquareCreatedSubscription>;
type SqlClient = Pick<PoolClient, "query" | "release">;
type SqlPool = { connect(): Promise<SqlClient> };
type AttemptRow = {
  id: string;
  user_id: string;
  tier: string;
  square_location_id: string;
  square_plan_variation_id: string;
  square_customer_id: string;
  square_card_id: string;
  consent_terms_version: string;
  consented_at: Date | string;
  consented_amount_cents: number;
  consented_currency: string;
  requested_start_date: string | null;
  requested_timezone: string;
};

const exactId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 &&
  value.length <= 200 && !/[\s\x00-\x1f\x7f]/.test(value);

export class WeddingSquareConfirmationPersistenceError extends Error {
  constructor() {
    super("Square enrollment confirmation needs safe reconciliation.");
    this.name = "WeddingSquareConfirmationPersistenceError";
  }
}

export function createWeddingSquareConfirmationPersistence(database: SqlPool) {
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
      const merchantId = process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const locationId = process.env.SQUARE_LOCATION_ID;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !exactId(merchantId) || !exactId(locationId) ||
          !exactId(attemptId) || !exactId(authenticatedUserId) ||
          !exactId(persistedIdempotencyKey) ||
          !/^[a-f0-9]{64}$/.test(persistedRequestFingerprint ?? "") ||
          !exactId(verifiedResponse?.providerSubscriptionId) ||
          verifiedResponse.verifiedLocationId !== locationId ||
          !exactId(verifiedResponse.verifiedPlanVariationId) ||
          !["PENDING", "ACTIVE"].includes(verifiedResponse.providerStatus) ||
          !database || typeof database.connect !== "function") {
        throw new WeddingSquareConfirmationPersistenceError();
      }

      let connection: SqlClient | undefined;
      let begun = false;
      let completed = false;
      let discard = false;
      try {
        connection = await database.connect();
        await connection.query("BEGIN");
        begun = true;

        // Lock the exact owner-bound, submitting attempt. A failed status,
        // changed claim fingerprint, or duplicate submit must not manufacture
        // a second provider subscription record.
        const locked = await connection.query<AttemptRow>(
          `SELECT id, user_id, tier, square_location_id, square_plan_variation_id,
                  square_customer_id, square_card_id, consent_terms_version,
                  consented_at, consented_amount_cents, consented_currency,
                  requested_start_date::text AS requested_start_date, requested_timezone
             FROM wedding_square_enrollment_attempts
            WHERE id = $1::uuid AND user_id = $2
              AND square_environment = 'sandbox' AND status = 'submitting'
              AND idempotency_key = $3 AND request_fingerprint = $4
              AND provider_subscription_id IS NULL
              AND square_location_id = $6 AND square_plan_variation_id = $7
            FOR UPDATE`,
          [attemptId, authenticatedUserId, persistedIdempotencyKey,
            persistedRequestFingerprint, verifiedResponse.providerSubscriptionId,
            verifiedResponse.verifiedLocationId, verifiedResponse.verifiedPlanVariationId],
        );
        if (locked.rows.length !== 1) throw new WeddingSquareConfirmationPersistenceError();
        const row = locked.rows[0];
        if (row.id !== attemptId || row.user_id !== authenticatedUserId ||
            row.square_location_id !== locationId ||
            row.square_plan_variation_id !== verifiedResponse.verifiedPlanVariationId ||
            !exactId(row.square_customer_id) || !exactId(row.square_card_id) ||
            (row.tier !== "premium" && row.tier !== "elite") ||
            row.consented_amount_cents !== WEDDING_MONTHLY_CENTS[row.tier] ||
            row.consented_currency !== "USD" ||
            row.consent_terms_version !== WEDDING_CONSENT_VERSION ||
            row.requested_timezone !== "UTC" ||
            !Number.isFinite(new Date(row.consented_at).getTime()) ||
            (row.requested_start_date !== null &&
             !/^\d{4}-\d{2}-\d{2}$/.test(row.requested_start_date))) {
          throw new WeddingSquareConfirmationPersistenceError();
        }

        // A duplicate customer subscription / reused provider ID conflicts
        // with DB uniqueness and aborts the entire transaction. No paid rows
        // are modified. Only the verified provider status is recorded.
        const record = await connection.query<{ id: string; square_subscription_id: string }>(
          `INSERT INTO wedding_square_subscriptions
             (user_id, tier, square_environment, square_merchant_id,
              square_location_id, square_customer_id, square_plan_variation_id,
              square_subscription_id, square_card_id, billing_consent_at,
              billing_consent_terms_version, agreed_monthly_amount_cents,
              agreed_currency, requested_start_date, provider_status)
           VALUES ($1,$2,'sandbox',$3,$4,$5,$6,$7,$8,$9,$10,$11,'USD',$12,$13)
           ON CONFLICT DO NOTHING
           RETURNING id, square_subscription_id`,
          [row.user_id, row.tier, merchantId, row.square_location_id,
            row.square_customer_id, row.square_plan_variation_id,
            verifiedResponse.providerSubscriptionId, row.square_card_id,
            row.consented_at, row.consent_terms_version, row.consented_amount_cents,
            row.requested_start_date, verifiedResponse.providerStatus],
        );
        if (record.rows.length !== 1 ||
            record.rows[0].square_subscription_id !== verifiedResponse.providerSubscriptionId) {
          throw new WeddingSquareConfirmationPersistenceError();
        }

        const confirmation = await connection.query<{ id: string; provider_subscription_id: string }>(
          `UPDATE wedding_square_enrollment_attempts
              SET status = 'confirmed', provider_subscription_id = $5,
                  updated_at = now(), last_error_code = NULL
            WHERE id = $1::uuid AND user_id = $2
              AND square_environment = 'sandbox' AND status = 'submitting'
              AND idempotency_key = $3 AND request_fingerprint = $4
              AND square_location_id = $6 AND square_plan_variation_id = $7
              AND provider_subscription_id IS NULL
           RETURNING id, provider_subscription_id`,
          [attemptId, authenticatedUserId, persistedIdempotencyKey,
            persistedRequestFingerprint, verifiedResponse.providerSubscriptionId,
            verifiedResponse.verifiedLocationId, verifiedResponse.verifiedPlanVariationId],
        );
        if (confirmation.rows.length !== 1 ||
            confirmation.rows[0].id !== attemptId ||
            confirmation.rows[0].provider_subscription_id !== verifiedResponse.providerSubscriptionId) {
          throw new WeddingSquareConfirmationPersistenceError();
        }

        await connection.query("COMMIT");
        completed = true;
        begun = false;
        return Object.freeze({
          attemptId, status: "confirmed" as const,
          providerSubscriptionId: verifiedResponse.providerSubscriptionId,
        });
      } catch {
        if (connection && begun) {
          try { await connection.query("ROLLBACK"); }
          catch { discard = true; }
        }
        // Lost COMMIT acknowledgement is unknown, even if ROLLBACK succeeds.
        if (connection && !completed) discard = true;
        throw new WeddingSquareConfirmationPersistenceError();
      } finally {
        if (connection) {
          if (discard) connection.release(new Error("Uncertain Wedding Square confirmation transaction"));
          else connection.release();
        }
      }
    },
  };
}

export const weddingSquareConfirmationPersistence =
  createWeddingSquareConfirmationPersistence(pool as SqlPool);
