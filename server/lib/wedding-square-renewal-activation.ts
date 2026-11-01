import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareSandboxSubscriptionReadback } from "./wedding-square-sandbox-subscription-readback";

/**
 * Narrow, owner-bound Square PENDING -> ACTIVE lifecycle transition.
 * The Square platform credential independently GETs the exact previously
 * saved subscription and verifies customer, card, plan, location, catalog,
 * merchant and enrollment fingerprint. Only ACTIVE provider status may
 * advance the local row; an invoice must STILL pass independent captured
 * payment and refund/dispute checks before recording paid coverage.
 *
 * Never change cancelled, paused, deactivated or mismatched subscriptions.
 * Never alter paidThrough, trials, invoice evidence, or another account.
 */
type Db = Pick<PoolClient,"query">;
type Provider = Pick<typeof weddingSquareSandboxSubscriptionReadback,"inspect">;
type Updated={id:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaque=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);

export class WeddingSquareRenewalActivationError extends Error {
  constructor(){super("Wedding Square first-charge status needs reconciliation.");this.name="WeddingSquareRenewalActivationError";}
}

export function createWeddingSquareRenewalActivation(db:Db,readProvider:Provider){
  return{
    async activate(attemptId:string,userId:string,expectedSubscriptionId:string){
      const merchant=process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const location=process.env.SQUARE_LOCATION_ID;
      if(process.env.SQUARE_ENV!=="sandbox"||
         process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
         process.env.WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED!=="true"||
         !uuid.test(attemptId)||!opaque(userId)||
         !opaque(expectedSubscriptionId)||!opaque(merchant)||!opaque(location))
        throw new WeddingSquareRenewalActivationError();
      try{
        const verified=await readProvider.inspect(attemptId,userId);
        if(!verified||verified.attemptId!==attemptId||
           verified.providerSubscriptionId!==expectedSubscriptionId||
           verified.providerStatus!=="ACTIVE"||
           verified.existingIdMatches!==true||
           verified.requiresOperatorReconciliation!==true||
           verified.grantsEntitlement!==false||
           verified.safeToResubmit!==false)
          throw new WeddingSquareRenewalActivationError();
        const result=await db.query<Updated>(
          `UPDATE wedding_square_subscriptions s
              SET provider_status='ACTIVE',
                  last_reconciled_at=now(),updated_at=now()
             FROM wedding_square_enrollment_attempts a
            WHERE a.id=$1::uuid AND a.user_id=$2 AND a.status='confirmed'
              AND a.square_environment='sandbox'
              AND a.provider_subscription_id=$3
              AND s.user_id=a.user_id
              AND s.square_environment='sandbox'
              AND s.square_merchant_id=$4
              AND s.square_location_id=$5
              AND s.square_subscription_id=a.provider_subscription_id
              AND s.square_customer_id=a.square_customer_id
              AND s.square_card_id=a.square_card_id
              AND s.square_plan_variation_id=a.square_plan_variation_id
              AND s.tier=a.tier
              AND s.billing_consent_terms_version=a.consent_terms_version
              AND s.agreed_monthly_amount_cents=a.consented_amount_cents
              AND s.agreed_currency=a.consented_currency
              AND s.provider_status='PENDING'
              AND (
                (s.tier='premium' AND s.agreed_monthly_amount_cents=2499
                 AND s.square_plan_variation_id=$6)
                OR (s.tier='elite' AND s.agreed_monthly_amount_cents=4999
                 AND s.square_plan_variation_id=$7)
              )
           RETURNING s.id::text AS id`,
          [attemptId,userId,expectedSubscriptionId,merchant,location,
           process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID??"",
           process.env.WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID??""],
        );
        if(!result||result.rows.length!==1||!uuid.test(result.rows[0].id))
          throw new WeddingSquareRenewalActivationError();
        return Object.freeze({
          activated:true as const,subscriptionId:expectedSubscriptionId,
          grantsEntitlement:false as const,
        });
      }catch{throw new WeddingSquareRenewalActivationError();}
    },
  };
}
export const weddingSquareRenewalActivation=createWeddingSquareRenewalActivation(
  pool as Db,weddingSquareSandboxSubscriptionReadback,
);
