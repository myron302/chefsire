import { z } from "zod";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareSandboxMerchantAttestation } from "./wedding-square-sandbox-merchant-attestation";
import { weddingSquareSandboxCustomerCardApi } from "./wedding-square-sandbox-customer-card-api";
import { verifyWeddingSquareCustomerCardOwnership } from "./wedding-square-customer-card-ownership";

/**
 * Internal trusted source for the existing Wedding ownershipClaim.prepare().
 *
 * The browser may only identify an authenticated user and their attempt ID;
 * customer/card IDs are loaded from a reserved, owner-bound Neon row. Square
 * customer and card are fetched under the token-owned sandbox merchant. The
 * customer API does NOT return merchantId; it is supplied only from the
 * independently verified 'me' merchant attestation, and card.merchantId must
 * also match. No fake customer/card object is accepted from HTTP request data.
 *
 * This read-only service is invoked exclusively by the gated, authenticated
 * sandbox attempt-submit route. It creates no Square subscriptions itself,
 * never grants paid entitlement, and supplies the only trusted input for the
 * one-shot submitter.
 */
type Database = Pick<PoolClient, "query">;
type Merchant = Pick<typeof weddingSquareSandboxMerchantAttestation, "inspect">;
type Provider = Pick<typeof weddingSquareSandboxCustomerCardApi, "getCustomer" | "getCard">;

const canonicalId = z.string().min(1).max(200).refine((id) =>
  !/[\s\x00-\x1f\x7f]/.test(id),
);
const uuid = z.string().uuid();
const rowSchema = z.object({
  id: uuid,
  user_id: canonicalId,
  square_environment: z.literal("sandbox"),
  square_customer_id: canonicalId,
  square_card_id: canonicalId,
}).strict();

export class WeddingSquareOwnerCardReadbackError extends Error {
  constructor() {
    super("Wedding Square customer and card ownership require operator reconciliation.");
    this.name = "WeddingSquareOwnerCardReadbackError";
  }
}

export function createWeddingSquareOwnerCardReadback(
  database: Database,
  merchant: Merchant,
  provider: Provider,
) {
  return {
    async inspect(attemptId: string, authenticatedUserId: string) {
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          !uuid.safeParse(attemptId).success ||
          !canonicalId.safeParse(authenticatedUserId).success) {
        throw new WeddingSquareOwnerCardReadbackError();
      }

      try {
        // This read-only API call uses token-owned 'me'. Fail before accessing
        // saved IDs or creating any Square client for customer/card GETs.
        const verifiedMerchant = await merchant.inspect();
        if (verifiedMerchant?.verifiedSandboxMerchantContext !== true ||
            verifiedMerchant.authorizesSubscriptionCreation !== false ||
            verifiedMerchant.grantsEntitlement !== false ||
            verifiedMerchant.safeToResubmit !== false ||
            verifiedMerchant.locationId !== process.env.SQUARE_LOCATION_ID ||
            verifiedMerchant.merchantId !== process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID) {
          throw new WeddingSquareOwnerCardReadbackError();
        }

        // Only one reserved attempt belonging to this exact authenticated
        // account may supply saved provider IDs. A provider customer/card
        // mentioned on any other user's attempt is a conflict, even if aborted.
        const result = await database.query(
          `SELECT a.id::text AS id, a.user_id, a.square_environment,
                  a.square_customer_id, a.square_card_id
             FROM wedding_square_enrollment_attempts AS a
            WHERE a.id = $1::uuid AND a.user_id = $2
              AND a.square_environment = 'sandbox'
              AND a.status = 'reserved'
              AND NOT EXISTS (
                SELECT 1 FROM wedding_square_enrollment_attempts AS other
                 WHERE other.square_environment = 'sandbox'
                   AND other.user_id <> a.user_id
                   AND (other.square_customer_id = a.square_customer_id
                     OR other.square_card_id = a.square_card_id)
              )`,
          [attemptId, authenticatedUserId],
        );
        if (result.rows?.length !== 1) throw new WeddingSquareOwnerCardReadbackError();
        const parsed = rowSchema.safeParse(result.rows[0]);
        if (!parsed.success || parsed.data.id !== attemptId ||
            parsed.data.user_id !== authenticatedUserId) {
          throw new WeddingSquareOwnerCardReadbackError();
        }
        const saved = parsed.data;

        const customer = await provider.getCustomer(saved.square_customer_id);
        if (!customer || customer.id !== saved.square_customer_id ||
            // Square Customer.referenceId is optional; if set, it must never
            // designate a different ChefSire identity.
            (customer.referenceId !== null && customer.referenceId !== authenticatedUserId)) {
          throw new WeddingSquareOwnerCardReadbackError();
        }
        const card = await provider.getCard(saved.square_card_id);
        if (!card || card.id !== saved.square_card_id ||
            card.customerId !== saved.square_customer_id ||
            card.merchantId !== verifiedMerchant.merchantId ||
            card.enabled !== true) {
          throw new WeddingSquareOwnerCardReadbackError();
        }

        // The pure verifier checks that server-attested merchant, DB-owned
        // binding and Square card/customer agree. None come from req.body.
        const input = Object.freeze({
          attemptId,
          authenticatedUserId,
          expectedSandboxMerchantId: verifiedMerchant.merchantId,
          savedBinding: Object.freeze({
            userId: saved.user_id,
            squareEnvironment: "sandbox" as const,
            squareMerchantId: verifiedMerchant.merchantId,
            squareCustomerId: saved.square_customer_id,
          }),
          providerCustomer: Object.freeze({
            id: customer.id,
            squareMerchantId: verifiedMerchant.merchantId,
          }),
          providerCard: Object.freeze({
            id: card.id,
            customerId: card.customerId,
          }),
        });
        verifyWeddingSquareCustomerCardOwnership(input);
        return input;
      } catch {
        // Never leak SQL errors, Square provider/customer/card IDs, or tokens.
        throw new WeddingSquareOwnerCardReadbackError();
      }
    },
  };
}

export const weddingSquareOwnerCardReadback =
  createWeddingSquareOwnerCardReadback(
    pool as Database,
    weddingSquareSandboxMerchantAttestation,
    weddingSquareSandboxCustomerCardApi,
  );
