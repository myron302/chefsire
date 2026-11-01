import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareSandboxPaymentRiskApi } from "./wedding-square-sandbox-payment-risk-api";
import { WEDDING_CONSENT_VERSION,WEDDING_MONTHLY_CENTS } from "./wedding-square-billing-policy";
import { z } from "zod";

/**
 * Owner-bound, internal payment-specific refresh.
 * Cancelling a subscription is not a refund/dispute verification. Only a
 * CURRENT Square payment GET and a COMPLETE all-state dispute page walk can
 * refresh this invoice evidence timestamp. Provider outage marks it stale,
 * never treats uncertainty as a clean paid period.
 *
 * No HTTP route, Square mutation, paid grant or card details. Disabled until
 * an operator explicitly configures sandbox reconciliation and scheduling.
 */
type Db=Pick<PoolClient,"query">;
type Risk=Pick<typeof weddingSquareSandboxPaymentRiskApi,"inspect">;
type Row={
  id:string;user_id:string;tier:"premium"|"elite";
  square_invoice_id:string;square_payment_id:string;
  square_subscription_id:string;square_merchant_id:string;
  square_customer_id:string;square_location_id:string;
  agreed_monthly_amount_cents:number;agreed_currency:string;
  billing_consent_terms_version:string;verified_amount_cents:number;
  last_payment_reconciled_at:Date|string|null;payment_revoked_at:Date|string|null;
  provider_status:string;
};
const uuid=z.string().uuid();
const id=z.string().min(1).max(200).refine(s=>!/[\s\x00-\x1f\x7f]/.test(s));
export class WeddingSquareEvidenceRefreshError extends Error{
  constructor(){super("Square invoice evidence refresh requires operator reconciliation.");this.name="WeddingSquareEvidenceRefreshError";}
}
export function createWeddingSquareEvidenceRefresh(db:Db,risk:Risk){
  return {async refresh(evidenceId:string,userId:string){
    const merchant=process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
    const location=process.env.SQUARE_LOCATION_ID;
    if(process.env.SQUARE_ENV!=="sandbox"||
       process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
       process.env.WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED!=="true"||
       !uuid.safeParse(evidenceId).success||!id.safeParse(userId).success||
       !id.safeParse(merchant).success||!id.safeParse(location).success)
      throw new WeddingSquareEvidenceRefreshError();
    let row:Row;
    try{
      const selected=await db.query<Row>(
        `SELECT e.id::text AS id,s.user_id,s.tier,
                e.square_invoice_id,e.square_payment_id,e.square_subscription_id,
                e.square_merchant_id,s.square_customer_id,s.square_location_id,
                s.agreed_monthly_amount_cents,s.agreed_currency,
                s.billing_consent_terms_version,
                e.verified_amount_cents,e.last_payment_reconciled_at,
                e.payment_revoked_at,s.provider_status
           FROM wedding_square_invoice_evidence e
           JOIN wedding_square_subscriptions s ON s.id=e.wedding_subscription_id
          WHERE e.id=$1::uuid AND s.user_id=$2
            AND e.square_environment='sandbox'
            AND s.square_environment=e.square_environment
            AND e.square_merchant_id=$3 AND s.square_merchant_id=$3
            AND s.square_location_id=$4
            AND e.square_subscription_id=s.square_subscription_id
          LIMIT 2`,
        [evidenceId,userId,merchant,location],
      );
      if(selected.rows.length!==1)throw new WeddingSquareEvidenceRefreshError();
      row=selected.rows[0];
      if(row.id!==evidenceId||row.user_id!==userId||
         row.square_merchant_id!==merchant||
         row.square_location_id!==location||
         !id.safeParse(row.square_payment_id).success||
         !id.safeParse(row.square_invoice_id).success||
         !id.safeParse(row.square_subscription_id).success||
         !id.safeParse(row.square_customer_id).success||
         (row.tier!=="premium"&&row.tier!=="elite")||
         row.agreed_currency!=="USD"||
         row.agreed_monthly_amount_cents!==WEDDING_MONTHLY_CENTS[row.tier]||
         row.verified_amount_cents!==row.agreed_monthly_amount_cents||
         row.billing_consent_terms_version!==WEDDING_CONSENT_VERSION||
         !["ACTIVE","CANCELED"].includes(row.provider_status))
        throw new WeddingSquareEvidenceRefreshError();
      if(row.payment_revoked_at!==null)
        return Object.freeze({status:"operator_review" as const,grantsEntitlement:false as const});
    }catch{throw new WeddingSquareEvidenceRefreshError();}

    let verified=false;
    try{
      const result=await risk.inspect(row.square_payment_id,row.square_customer_id,
        row.square_location_id,row.agreed_monthly_amount_cents);
      verified=result.paymentId===row.square_payment_id&&
        result.noRefundsOrDisputes===true&&result.grantsEntitlement===false&&
        result.requiresIndependentPeriodVerification===true;
    }catch{/* unknown provider outcome is not good payment evidence */}

    try{
      if(!verified){
        // A provider error, refund, dispute or missing permission cannot
        // leave this evidence marked recently checked.
        const stale=await db.query(
          `UPDATE wedding_square_invoice_evidence e
              SET last_payment_reconciled_at=NULL
             FROM wedding_square_subscriptions s
            WHERE e.id=$1::uuid AND e.wedding_subscription_id=s.id
              AND s.user_id=$2 AND e.square_environment='sandbox'
              AND s.square_environment='sandbox'
              AND e.square_merchant_id=$3 AND s.square_merchant_id=$3
              AND e.square_payment_id=$4
          RETURNING e.id`,
          [evidenceId,userId,merchant,row.square_payment_id],
        );
        if(stale.rows.length!==1)throw new WeddingSquareEvidenceRefreshError();
        return Object.freeze({status:"reconciliation_required" as const,grantsEntitlement:false as const});
      }
      // Compare previous evidence timestamp to avoid restoring a row another
      // worker revoked/invalidated during the provider network calls.
      const refreshed=await db.query(
        `UPDATE wedding_square_invoice_evidence e
            SET last_payment_reconciled_at=now()
           FROM wedding_square_subscriptions s
          WHERE e.id=$1::uuid AND e.wedding_subscription_id=s.id
            AND s.user_id=$2 AND e.square_environment='sandbox'
            AND s.square_environment='sandbox'
            AND e.square_merchant_id=$3 AND s.square_merchant_id=$3
            AND e.square_payment_id=$4
            AND e.payment_revoked_at IS NULL
            AND e.last_payment_reconciled_at IS NOT DISTINCT FROM $5::timestamptz
        RETURNING e.id`,
        [evidenceId,userId,merchant,row.square_payment_id,row.last_payment_reconciled_at],
      );
      if(refreshed.rows.length!==1)throw new WeddingSquareEvidenceRefreshError();
      return Object.freeze({
        status:"payment_rechecked" as const,grantsEntitlement:false as const,
        paidThroughChanged:false as const,
      });
    }catch{
      throw new WeddingSquareEvidenceRefreshError();
    }
  }};
}
export const weddingSquareEvidenceRefresh=createWeddingSquareEvidenceRefresh(
  pool as Db,weddingSquareSandboxPaymentRiskApi);
