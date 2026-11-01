import { z } from "zod";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquarePeriodReadback } from "./wedding-square-period-readback";
import { weddingSquareBillingAudit } from "./wedding-square-billing-audit";
import { WEDDING_CONSENT_VERSION, WEDDING_MONTHLY_CENTS } from "./wedding-square-billing-policy";

/**
 * The first write-side evidence recording boundary for Wedding Square.
 * The public app does not call this service. A separately disabled sandbox
 * switch must be explicitly enabled by an operator after provider testing.
 *
 * Important: a successful subscription, PAID invoice or refund-free Payment
 * is not by itself enough to write a paid period. Independently verify the
 * linked Square subscription/invoice/payment, conservative captured-at period,
 * then recheck refunds and ALL disputes directly before one DB transaction.
 *
 * Never infer payment from a webhook event, legacy users.wedding_tier or
 * browser-supplied IDs/dates. This does NOT enable or grant paid entitlements.
 */
type Connection = Pick<PoolClient,"query"|"release">;
type Database = {connect():Promise<Connection>};
type Period = Pick<typeof weddingSquarePeriodReadback,"inspect">;
type Risk = Pick<typeof weddingSquareBillingAudit,"inspect">;
type SavedRow = {
  id:string;user_id:string;tier:"premium"|"elite";
  square_merchant_id:string;square_location_id:string;
  square_subscription_id:string;agreed_monthly_amount_cents:number;
  agreed_currency:string;billing_consent_terms_version:string;
  provider_status:string;
};
const id=z.string().min(1).max(200).refine(s=>!/[\s\x00-\x1f\x7f]/.test(s));
const uuid=z.string().uuid();
const date=z.string().datetime({offset:true});
export class WeddingSquareEvidenceLedgerError extends Error {
  constructor() {
    super("Wedding Square payment recording requires operator reconciliation.");
    this.name="WeddingSquareEvidenceLedgerError";
  }
}

export function createWeddingSquareEvidenceLedger(database:Database,period:Period,risk:Risk){
  return {
    async record(attemptId:string,userId:string) {
      const merchantId=process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const locationId=process.env.SQUARE_LOCATION_ID;
      if(process.env.SQUARE_ENV!=="sandbox"||
         process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
         process.env.WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED!=="true"||
         !uuid.safeParse(attemptId).success||!id.safeParse(userId).success||
         !id.safeParse(merchantId).success||!id.safeParse(locationId).success||
         !database||typeof database.connect!=="function")
        throw new WeddingSquareEvidenceLedgerError();

      // All provider evidence is read before the DB transaction, to avoid
      // holding row locks during network requests. A second risk readback is
      // mandatory immediately before the financial write.
      let verified:Awaited<ReturnType<Period["inspect"]>>;
      try {
        verified=await period.inspect(attemptId,userId);
        if(!verified||verified.grantsEntitlement!==false||
           verified.requiresOperatorReconciliation!==true||
           verified.requiresIndependentRefundDisputeRecheck!==true||
           !id.safeParse(verified.invoiceId).success||
           !id.safeParse(verified.paymentId).success||
           !id.safeParse(verified.subscriptionId).success||
           ![2499,4999].includes(verified.verifiedAmountCents))
          throw new WeddingSquareEvidenceLedgerError();

        const fresh=await risk.inspect(attemptId,userId);
        if(fresh.subscriptionId!==verified.subscriptionId||
           fresh.invoiceId!==verified.invoiceId||
           fresh.paymentId!==verified.paymentId||
           fresh.verifiedAmountCents!==verified.verifiedAmountCents||
           fresh.noRefundsOrDisputes!==true||
           fresh.grantsEntitlement!==false||
           fresh.requiresIndependentPeriodVerification!==true)
          throw new WeddingSquareEvidenceLedgerError();

        if(!date.safeParse(verified.providerPaidAt).success||
           !date.safeParse(verified.periodStartsAt).success||
           !date.safeParse(verified.periodEndsAt).success)
          throw new WeddingSquareEvidenceLedgerError();
        const capture=Date.parse(verified.providerPaidAt);
        const starts=Date.parse(verified.periodStartsAt);
        const ends=Date.parse(verified.periodEndsAt);
        const now=Date.now();
        if(![capture,starts,ends].every(Number.isFinite)||
           starts!==capture||capture>now||ends<=now||
           ends<=starts||ends-starts>35*86_400_000)
          throw new WeddingSquareEvidenceLedgerError();
      } catch { throw new WeddingSquareEvidenceLedgerError(); }

      let client:Connection|undefined;
      let started=false;
      let committed=false;
      try {
        client=await database.connect();
        await client.query("BEGIN");
        started=true;
        const selected=await client.query<SavedRow>(
          `SELECT s.id::text AS id,s.user_id,s.tier,s.square_merchant_id,
                  s.square_location_id,s.square_subscription_id,
                  s.agreed_monthly_amount_cents,s.agreed_currency,
                  s.billing_consent_terms_version,s.provider_status
             FROM wedding_square_subscriptions s
             JOIN wedding_square_enrollment_attempts a
               ON a.provider_subscription_id=s.square_subscription_id
              AND a.user_id=s.user_id
              AND a.square_environment='sandbox'
              AND a.status='confirmed'
            WHERE a.id=$1::uuid AND s.user_id=$2
              AND s.square_environment='sandbox'
              AND s.square_merchant_id=$3 AND s.square_location_id=$4
              AND s.square_subscription_id=$5
            FOR UPDATE OF s`,
          [attemptId,userId,merchantId,locationId,verified.subscriptionId],
        );
        if(selected.rows.length!==1)throw new WeddingSquareEvidenceLedgerError();
        const row=selected.rows[0];
        const expectedPlan=row.tier==="premium"
          ?process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID
          :row.tier==="elite"
            ?process.env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID:undefined;
        if(!uuid.safeParse(row.id).success||row.user_id!==userId||
           row.square_merchant_id!==merchantId||row.square_location_id!==locationId||
           row.square_subscription_id!==verified.subscriptionId||
           row.agreed_currency!=="USD"||
           row.billing_consent_terms_version!==WEDDING_CONSENT_VERSION||
           (row.tier!=="premium"&&row.tier!=="elite")||
           row.agreed_monthly_amount_cents!==WEDDING_MONTHLY_CENTS[row.tier]||
           row.agreed_monthly_amount_cents!==verified.verifiedAmountCents||
           !id.safeParse(expectedPlan).success||
           !["ACTIVE","CANCELED"].includes(row.provider_status))
          throw new WeddingSquareEvidenceLedgerError();

        // A different invoice can only create a distinct row with a distinct
        // Square payment ID. Conflicts fail; NEVER overwrite prior evidence.
        const insert=await client.query<{id:string}>(
          `INSERT INTO wedding_square_invoice_evidence
             (wedding_subscription_id,square_environment,square_merchant_id,
              square_invoice_id,square_payment_id,square_subscription_id,
              verified_amount_cents,verified_currency,provider_paid_at,
              period_starts_at,period_ends_at,last_payment_reconciled_at)
           VALUES($1::uuid,'sandbox',$2,$3,$4,$5,$6,'USD',$7,$8,$9,now())
           ON CONFLICT DO NOTHING RETURNING id::text AS id`,
          [row.id,merchantId,verified.invoiceId,verified.paymentId,
           verified.subscriptionId,verified.verifiedAmountCents,
           verified.providerPaidAt,verified.periodStartsAt,verified.periodEndsAt],
        );
        if(insert.rows.length!==1||!uuid.safeParse(insert.rows[0].id).success)
          throw new WeddingSquareEvidenceLedgerError();

        const change=await client.query<{id:string}>(
          `UPDATE wedding_square_subscriptions
              SET verified_paid_through=GREATEST(
                    COALESCE(verified_paid_through,'-infinity'::timestamptz),$3::timestamptz),
                  last_reconciled_at=now(),updated_at=now()
            WHERE id=$1::uuid AND user_id=$2
              AND square_environment='sandbox' AND square_merchant_id=$4
              AND square_subscription_id=$5
              AND provider_status IN ('ACTIVE','CANCELED')
           RETURNING id::text AS id`,
          [row.id,userId,verified.periodEndsAt,merchantId,verified.subscriptionId],
        );
        if(change.rows.length!==1||change.rows[0].id!==row.id)
          throw new WeddingSquareEvidenceLedgerError();
        await client.query("COMMIT");
        committed=true;started=false;
        return Object.freeze({
          status:"recorded" as const,
          subscriptionId:verified.subscriptionId,
          invoiceId:verified.invoiceId,
          verifiedPaidThrough:verified.periodEndsAt,
          paidEntitlementGranted:false as const,
          safeToResubmit:false as const,
        });
      }catch {
        if(client&&started){try{await client.query("ROLLBACK");}catch{/* connection discarded */}}
        throw new WeddingSquareEvidenceLedgerError();
      }finally{
        if(client){
          // Discard after ANY uncertain transaction/COMMIT outcome.
          if(!committed)client.release(new Error("Uncertain Wedding payment evidence transaction"));
          else client.release();
        }
      }
    },
  };
}
export const weddingSquareEvidenceLedger=createWeddingSquareEvidenceLedger(
  pool as Database,weddingSquarePeriodReadback,weddingSquareBillingAudit);
