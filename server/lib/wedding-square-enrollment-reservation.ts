import { randomUUID, createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import type { verifyWeddingEnrollmentConsent } from "./wedding-square-enrollment-consent";
import type { weddingSquareSandboxPreflight } from "./wedding-square-enrollment-preflight";
import { prepareWeddingSquareSubscriptionRequest } from "./wedding-square-subscription-request";

type Consent = ReturnType<typeof verifyWeddingEnrollmentConsent>;
type Configuration = ReturnType<typeof weddingSquareSandboxPreflight>;
type SqlClient = Pick<PoolClient, "query" | "release">;
type SqlPool = { connect(): Promise<SqlClient> };

export class WeddingEnrollmentReservationError extends Error {
  constructor() {
    super("Wedding Square enrollment cannot be reserved. Check existing enrollment state.");
    this.name = "WeddingEnrollmentReservationError";
  }
}

/**
 * Creates a *durable* reservation inside Neon, with a single stable UUID key.
 * NEVER calls Square, captures card details or grants paid access.
 *
 * No route calls this function yet. The SQL in docs/sql-pending must be reviewed
 * and applied explicitly before wiring up a caller.
 *
 * Important: the calling service must have independently authenticated the user
 * and verified that Square customer/card records belong to that user.
 * These server-resolved IDs must never come from a browser request body.
 */
export function createWeddingEnrollmentReservationService(database: SqlPool) {
  return {
    async reserve(input: {
      consent: Consent;
      config: Configuration;
      verifiedSquareCustomerId: string;
      verifiedSquareCardId: string;
    }): Promise<{ attemptId: string; idempotencyKey: string; status: "reserved" }> {
      // Do not even reserve if the operator has not explicitly enabled sandbox.
      if (process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          process.env.SQUARE_ENV !== "sandbox") throw new WeddingEnrollmentReservationError();

      const idempotencyKey = randomUUID();
      // Shared builder rejects mismatched tier, price, UTC and trial start.
      const request = prepareWeddingSquareSubscriptionRequest({
        consent: input.consent,
        config: input.config,
        providerCustomerId: input.verifiedSquareCustomerId,
        providerCardId: input.verifiedSquareCardId,
        persistedIdempotencyKey: idempotencyKey,
      });
      const fingerprint = createHash("sha256").update(JSON.stringify(request)).digest("hex");
      const client = await database.connect();
      let begun = false;
      try {
        await client.query("BEGIN");
        begun = true;
        // Serialize reservations for a user; the partial unique index also guards
        // concurrent writers that do not acquire this lock.
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.consent.userId]);
        const result = await client.query<{ id: string }>(
          `INSERT INTO wedding_square_enrollment_attempts (
            user_id, square_environment, tier, consent_terms_version,
            consented_at, consented_amount_cents, consented_currency,
            trial_expires_at, requested_start_date, requested_timezone,
            square_location_id, square_plan_variation_id, square_customer_id,
            square_card_id, idempotency_key, request_fingerprint, status
          ) VALUES (
            $1,'sandbox',$2,$3,$4,$5,$6,$7,$8,'UTC',$9,$10,$11,$12,$13,$14,'reserved'
          )
          ON CONFLICT DO NOTHING RETURNING id`,
          [
            input.consent.userId, input.consent.tier, input.consent.consentTermsVersion,
            input.consent.billingConsentAt, input.consent.agreedMonthlyAmountCents,
            input.consent.agreedCurrency, input.consent.trialExpiresAt,
            input.consent.requestedStartDate, input.config.locationId,
            input.config.planVariationId, request.customerId, request.cardId,
            idempotencyKey, fingerprint,
          ],
        );
        if (result.rows.length !== 1) throw new WeddingEnrollmentReservationError();
        await client.query("COMMIT");
        begun = false;
        return { attemptId: result.rows[0].id, idempotencyKey, status: "reserved" };
      } catch (error) {
        if (begun) {
          try { await client.query("ROLLBACK"); } catch { /* preserve failure */ }
        }
        if (error instanceof WeddingEnrollmentReservationError) throw error;
        // Fail closed and do not leak database or provider identifiers in errors.
        throw new WeddingEnrollmentReservationError();
      } finally {
        client.release();
      }
    },
  };
}

// Exported for future *internal* service wiring only. No live route calls it.
// Database connections are not opened until reserve() is explicitly invoked.
export const weddingEnrollmentReservations = createWeddingEnrollmentReservationService(pool as SqlPool);
