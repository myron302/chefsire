import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import type { verifyWeddingEnrollmentConsent } from "./wedding-square-enrollment-consent";
import type { weddingSquareSandboxPreflight } from "./wedding-square-enrollment-preflight";
import { weddingSquareSandboxCatalogAttestation } from "./wedding-square-sandbox-catalog-attestation";
import { weddingSquareSandboxCardSetupTransport } from "./wedding-square-sandbox-card-setup-transport";
import { weddingSquareSandboxCustomerCardApi } from "./wedding-square-sandbox-customer-card-api";
import { weddingEnrollmentReservations } from "./wedding-square-enrollment-reservation";

type Consent = ReturnType<typeof verifyWeddingEnrollmentConsent>;
type Config = ReturnType<typeof weddingSquareSandboxPreflight>;
type Client = Pick<PoolClient, "query" | "release">;
type Db = { connect(): Promise<Client>; query(sql: string, args?: unknown[]): Promise<{ rowCount: number | null; rows: any[] }> };
type Transport = Pick<typeof weddingSquareSandboxCardSetupTransport, "createCustomer" | "createCard">;
type Catalog = Pick<typeof weddingSquareSandboxCatalogAttestation, "inspect">;
type Readback = Pick<typeof weddingSquareSandboxCustomerCardApi, "getCustomer" | "getCard">;
type Reservations = Pick<typeof weddingEnrollmentReservations, "reserve">;
const valid = (s: unknown, limit = 200): s is string =>
  typeof s === "string" && s.length > 0 && s.length <= limit &&
  s === s.trim() && !/[\s\x00-\x1f\x7f]/.test(s);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WeddingSquareCardSetupReconciliationError extends Error {
  constructor() {
    super("Square card setup requires reconciliation before another attempt.");
    this.name = "WeddingSquareCardSetupReconciliationError";
  }
}

/**
 * Full internal one-shot path: commit Neon owner intent, then exactly one
 * Square Customer POST followed by exactly one Card POST with a Square Web
 * Payments SDK nonce. An unknown provider result NEVER gets retried.
 * Completed setup must pass fresh Square GETs before reserving the existing,
 * separately idempotent subscription attempt. No charge or entitlement occurs.
 *
 * No customer/card IDs or Square nonce ever originate from browser data.
 */
export function createWeddingSquareCardSetupCoordinator(
  db: Db, catalog: Catalog, transport: Transport, provider: Readback,
  reservations: Reservations,
) {
  async function move(id: string, userId: string, from: string, to: string, extra = "", args: unknown[] = []) {
    const result = await db.query(
      `UPDATE wedding_square_card_setup_attempts SET status=$3,updated_at=now()${extra}
         WHERE id=$1::uuid AND user_id=$2 AND square_environment='sandbox' AND status=$4`,
      [id,userId,to,from,...args],
    );
    if (result.rowCount !== 1) throw new WeddingSquareCardSetupReconciliationError();
  }
  async function unknown(id: string, userId: string) {
    try {
      await db.query(
        `UPDATE wedding_square_card_setup_attempts SET status='needs_reconciliation',updated_at=now()
           WHERE id=$1::uuid AND user_id=$2 AND status IN
             ('customer_submitting','customer_confirmed','card_submitting','confirmed')`,
        [id,userId],
      );
    } catch { /* unknown Neon outcome remains fail closed */ }
  }
  async function reserve(consent: Consent, config: Config, sourceId: string) {
    const idempotencyCustomer = randomUUID();
    const idempotencyCard = randomUUID();
    const digest = createHash("sha256").update(sourceId).digest("hex");
    let client: Client | undefined;
    let active = false;
    let closed = false;
    try {
      client = await db.connect();
      await client.query("BEGIN"); active = true;
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [consent.userId]);
      // An ambiguous subscription or a still-billing provider record forbids
      // setting up another card with the intent to start a second subscription.
      const activeBilling = await client.query(
        `SELECT (
          EXISTS(SELECT 1 FROM wedding_square_enrollment_attempts
                  WHERE user_id=$1 AND status IN
                    ('reserved','submitting','needs_reconciliation','confirmed'))
          OR EXISTS(SELECT 1 FROM wedding_square_subscriptions
                  WHERE user_id=$1 AND provider_status IN ('PENDING','ACTIVE','PAUSED'))
        ) AS blocked`, [consent.userId],
      );
      if (activeBilling.rows.length !== 1 || activeBilling.rows[0].blocked !== false)
        throw new WeddingSquareCardSetupReconciliationError();
      const saved = await client.query(
        `INSERT INTO wedding_square_card_setup_attempts (
          user_id,square_environment,square_merchant_id,square_location_id,
          tier,consent_terms_version,consented_at,consented_amount_cents,
          consented_currency,trial_expires_at,requested_start_date,requested_timezone,
          source_digest,customer_idempotency_key,card_idempotency_key,status
        ) VALUES ($1,'sandbox',$2,$3,$4,$5,$6,$7,$8,$9,$10,'UTC',$11,$12,$13,'reserved')
        RETURNING id::text AS id`,
        [consent.userId,config.merchantId,config.locationId,consent.tier,
          consent.consentTermsVersion,consent.billingConsentAt,
          consent.agreedMonthlyAmountCents,consent.agreedCurrency,
          consent.trialExpiresAt,consent.requestedStartDate,digest,
          idempotencyCustomer,idempotencyCard],
      );
      if (saved.rows.length !== 1 || !uuid.test(saved.rows[0].id))
        throw new WeddingSquareCardSetupReconciliationError();
      await client.query("COMMIT"); active = false; closed = true;
      return { id: saved.rows[0].id as string, customerKey: idempotencyCustomer, cardKey: idempotencyCard };
    } catch {
      if (client && active) await client.query("ROLLBACK").catch(() => {});
      throw new WeddingSquareCardSetupReconciliationError();
    } finally {
      if (client) client.release(closed ? undefined : new Error("Discard uncertain Square card setup transaction"));
    }
  }

  return {
    async setup(input: {
      consent: Consent;
      config: Config;
      sourceId: string;
      verificationToken?: string;
      verifiedEmailAddress: string;
    }) {
      const { consent, config } = input;
      if (process.env.SQUARE_ENV !== "sandbox" ||
          process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED !== "true" ||
          process.env.WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED !== "true" ||
          !valid(consent?.userId,100) || !valid(input.verifiedEmailAddress,254) ||
          !valid(config?.merchantId) || !valid(config?.locationId) ||
          config.environment !== "sandbox" || config.tier !== consent.tier ||
          !["premium","elite"].includes(consent.tier) ||
          !valid(input.sourceId,16384) || !input.sourceId.startsWith("cnon:") ||
          (input.verificationToken !== undefined && !valid(input.verificationToken,16384)) ||
          consent.agreedCurrency !== "USD" ||
          !((consent.tier === "premium" && consent.agreedMonthlyAmountCents === 2499) ||
            (consent.tier === "elite" && consent.agreedMonthlyAmountCents === 4999))) {
        throw new WeddingSquareCardSetupReconciliationError();
      }
      // A trusted provider catalog must be read BEFORE any Neon mutation.
      try {
        const verified = await catalog.inspect();
        if (verified.verifiedSandboxCatalogTerms !== true ||
            verified.merchantId !== config.merchantId ||
            verified.locationId !== config.locationId ||
            (consent.tier === "premium"
              ? verified.premiumPlanVariationId !== config.planVariationId ||
                verified.premiumPlanId !== config.planId
              : verified.elitePlanVariationId !== config.planVariationId ||
                verified.elitePlanId !== config.planId) ||
            verified.grantsEntitlement !== false ||
            verified.authorizesSubscriptionCreation !== false) {
          throw new WeddingSquareCardSetupReconciliationError();
        }
      } catch { throw new WeddingSquareCardSetupReconciliationError(); }

      const saved = await reserve(consent, config, input.sourceId);
      try {
        await move(saved.id,consent.userId,"reserved","customer_submitting",
          ",customer_post_attempted_at=now()");
        const customer = await transport.createCustomer({
          idempotencyKey: saved.customerKey,
          referenceId: consent.userId,
          verifiedEmailAddress: input.verifiedEmailAddress,
        });
        if (!valid(customer.id) || customer.referenceId !== consent.userId)
          throw new WeddingSquareCardSetupReconciliationError();
        await move(saved.id,consent.userId,"customer_submitting","customer_confirmed",
          ",square_customer_id=$5",[customer.id]);
        await move(saved.id,consent.userId,"customer_confirmed","card_submitting",
          ",card_post_attempted_at=now()");
        const card = await transport.createCard({
          idempotencyKey: saved.cardKey,
          sourceId: input.sourceId,
          verificationToken: input.verificationToken,
          customerId: customer.id,
          referenceId: consent.userId,
          expectedMerchantId: config.merchantId,
        });
        if (!valid(card.id) || card.customerId !== customer.id ||
            card.merchantId !== config.merchantId || card.enabled !== true)
          throw new WeddingSquareCardSetupReconciliationError();
        // Keep the setup in the owner-blocking card_submitting state until
        // the separate subscription reservation has committed. Releasing the
        // partial unique lock here would permit concurrent card POSTs.
        await move(saved.id,consent.userId,"card_submitting","card_submitting",
          ",square_card_id=$5",[card.id]);

        // A valid POST response is not trusted in place of a fresh Square GET.
        const [readCustomer,readCard] = await Promise.all([
          provider.getCustomer(customer.id),provider.getCard(card.id),
        ]);
        if (readCustomer.id !== customer.id ||
            readCustomer.referenceId !== consent.userId ||
            readCard.id !== card.id || readCard.customerId !== customer.id ||
            readCard.merchantId !== config.merchantId || readCard.enabled !== true)
          throw new WeddingSquareCardSetupReconciliationError();

        // The existing Neon owner-locked one-shot subscription reservation is
        // the only path to the already reviewed CreateSubscription submitter.
        const attempt = await reservations.reserve({
          consent,config,verifiedSquareCustomerId:customer.id,
          verifiedSquareCardId:card.id,
        });
        if (!uuid.test(attempt.attemptId) || attempt.status !== "reserved")
          throw new WeddingSquareCardSetupReconciliationError();
        // A committed owner-bound enrollment now guards against another
        // setup; only at this point may the card setup leave the partial
        // unique unresolved-user index.
        await move(saved.id,consent.userId,"card_submitting","confirmed");
        return Object.freeze({ attemptId:attempt.attemptId,
          status:"reserved" as const, paidEntitlementGranted:false as const,
          safeToResubmit:false as const });
      } catch {
        await unknown(saved.id,consent.userId);
        throw new WeddingSquareCardSetupReconciliationError();
      }
    },
  };
}
export const weddingSquareCardSetupCoordinator = createWeddingSquareCardSetupCoordinator(
  pool as unknown as Db,weddingSquareSandboxCatalogAttestation,
  weddingSquareSandboxCardSetupTransport,weddingSquareSandboxCustomerCardApi,
  weddingEnrollmentReservations,
);
