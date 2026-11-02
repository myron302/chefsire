import type { PoolClient } from "pg";
import { pool } from "../db";
import { readVerifiedWeddingPaid } from "./wedding-square-paid-entitlement";
import { WEDDING_CONSENT_VERSION, WEDDING_MONTHLY_CENTS } from "./wedding-square-billing-policy";

/**
 * Server-owned, privacy-preserving Wedding billing management read model.
 * Never expose Square provider/customer/card IDs, bearer credentials,
 * webhook payloads, idempotency keys or raw payment history.
 *
 * A saved subscription is not proof of a charge. Only the independently
 * attested paid-evidence reader may return a paid coverage date.
 */
type Db = Pick<PoolClient, "query">;
type PaidReader = typeof readVerifiedWeddingPaid;
type Row = {
  tier: string;
  agreed_monthly_amount_cents: number;
  agreed_currency: string;
  billing_consent_terms_version: string;
  provider_status: string;
  requested_start_date: string | null;
  cancellation_requested_at: Date | string | null;
  provider_cancelled_at: Date | string | null;
  last_reconciled_at: Date | string | null;
};
const valid = (s:unknown):s is string =>
  typeof s==="string" && s.length>0 && s.length<=200 &&
  !/[\s\x00-\x1f\x7f]/.test(s);
const iso = (value:Date|string|null):string|null => {
  if(value===null)return null;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))throw new WeddingSquareBillingStatusError();
  return date.toISOString();
};
const day = (s:string|null):string|null => {
  if(s===null)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new WeddingSquareBillingStatusError();
  const timestamp=Date.parse(s+"T00:00:00.000Z");
  if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==s)
    throw new WeddingSquareBillingStatusError();
  return s;
};
export class WeddingSquareBillingStatusError extends Error {
  constructor(){super("Wedding billing status requires reconciliation.");this.name="WeddingSquareBillingStatusError";}
}
export function createWeddingSquareBillingStatus(db:Db, paidReader:PaidReader) {
  return {
    async inspect(userId:string) {
      if(!valid(userId))throw new WeddingSquareBillingStatusError();
      const merchant=process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
      const location=process.env.SQUARE_LOCATION_ID;
      // No authoritative configured merchant -> UNKNOWN, never claim Free or
      // a canceled plan. Cardless trial is served by the existing endpoint.
      if(process.env.SQUARE_ENV!=="sandbox"||!valid(merchant)||!valid(location)) {
        return Object.freeze({
          ok:true as const,billingMode:"disabled" as const,
          enrollmentStatus:"unavailable" as const,
          billingLive:false as const,requiresProviderVerification:true as const,
          tier:null,monthlyAmountCents:null,currency:null,
          requestedFirstChargeDate:null,cancellationRequestedAt:null,
          providerCancellationRecordedAt:null,lastProviderCheckAt:null,
          verifiedPaidAccessThrough:null,
        });
      }
      try {
        // An unacknowledged Square CREATE may have succeeded even when Neon
        // never saved its subscription row. Do NOT report "not enrolled" or
        // allow legacy trial cancellation while any owner-scoped attempt could
        // already exist at Square. A confirmed attempt without a matching
        // subscription row also demands reconciliation.
        const ambiguous=await db.query<{status:string}>(
          `SELECT a.status
             FROM wedding_square_enrollment_attempts a
            WHERE a.user_id=$1 AND a.square_environment='sandbox'
              AND (
                a.status IN ('reserved','submitting','needs_reconciliation')
                OR (a.status='confirmed' AND NOT EXISTS (
                  SELECT 1 FROM wedding_square_subscriptions s
                   WHERE s.user_id=a.user_id
                     AND s.square_subscription_id=a.provider_subscription_id
                     AND s.square_environment='sandbox'
                     AND s.square_merchant_id=$2 AND s.square_location_id=$3
                ))
              )
            LIMIT 2`,
          [userId,merchant,location],
        );
        if(!ambiguous||!Array.isArray(ambiguous.rows)||ambiguous.rows.length>1)
          throw new WeddingSquareBillingStatusError();
        if(ambiguous.rows.length===1) {
          if(!["reserved","submitting","needs_reconciliation","confirmed"].includes(ambiguous.rows[0].status))
            throw new WeddingSquareBillingStatusError();
          return Object.freeze({
            ok:true as const,billingMode:"sandbox" as const,
            enrollmentStatus:"needs_reconciliation" as const,
            billingLive:false as const,requiresProviderVerification:true as const,
            tier:null,monthlyAmountCents:null,currency:null,
            requestedFirstChargeDate:null,cancellationRequestedAt:null,
            providerCancellationRecordedAt:null,lastProviderCheckAt:null,
            verifiedPaidAccessThrough:null,
          });
        }
        const selected=await db.query<Row>(
          `SELECT tier,agreed_monthly_amount_cents,agreed_currency,
                  billing_consent_terms_version,provider_status,
                  requested_start_date::text AS requested_start_date,
                  cancellation_requested_at,provider_cancelled_at,
                  last_reconciled_at
             FROM wedding_square_subscriptions
            WHERE user_id=$1 AND square_environment='sandbox'
              AND square_merchant_id=$2 AND square_location_id=$3
            ORDER BY
              CASE WHEN provider_status IN ('PENDING','ACTIVE','PAUSED') THEN 0 ELSE 1 END,
              created_at DESC, id DESC
            LIMIT 2`,
          [userId,merchant,location],
        );
        if(!selected||!Array.isArray(selected.rows)||selected.rows.length>2)
          throw new WeddingSquareBillingStatusError();
        const current=selected.rows[0];
        if(!current){
          return Object.freeze({
            ok:true as const,billingMode:"sandbox" as const,
            enrollmentStatus:"not_enrolled" as const,
            billingLive:false as const,requiresProviderVerification:true as const,
            tier:null,monthlyAmountCents:null,currency:null,
            requestedFirstChargeDate:null,cancellationRequestedAt:null,
            providerCancellationRecordedAt:null,lastProviderCheckAt:null,
            verifiedPaidAccessThrough:null,
          });
        }
        // A partial unique index permits only one live subscription. Still
        // reject ambiguous migration/legacy rows instead of choosing Elite.
        const active=(s:string)=>["PENDING","ACTIVE","PAUSED"].includes(s);
        if(selected.rows.length===2&&active(current.provider_status)&&
           active(selected.rows[1].provider_status))
          throw new WeddingSquareBillingStatusError();
        if((current.tier!=="premium"&&current.tier!=="elite")||
           current.agreed_monthly_amount_cents!==WEDDING_MONTHLY_CENTS[current.tier]||
           current.agreed_currency!=="USD"||
           current.billing_consent_terms_version!==WEDDING_CONSENT_VERSION||
           !["PENDING","ACTIVE","PAUSED","CANCELED","COMPLETED","DEACTIVATED"].includes(current.provider_status))
          throw new WeddingSquareBillingStatusError();

        // Failed payment verification MUST NOT be presented as a paid period.
        // The independently disabled-by-default authorizer may return null.
        const paid=await paidReader(userId).catch(()=>{
          throw new WeddingSquareBillingStatusError();
        });
        const requested=iso(current.cancellation_requested_at);
        const confirmed=iso(current.provider_cancelled_at);
        const status=confirmed!==null||current.provider_status==="CANCELED"
          ?"canceled" as const : requested!==null
          ?"cancellation_requested" as const : current.provider_status==="ACTIVE"
          ?"active" as const :current.provider_status==="PENDING"
          ?"pending" as const :current.provider_status==="PAUSED"
          ?"paused" as const :"ended" as const;
        return Object.freeze({
          ok:true as const,billingMode:"sandbox" as const,enrollmentStatus:status,
          billingLive:false as const,requiresProviderVerification:true as const,
          tier:current.tier,monthlyAmountCents:current.agreed_monthly_amount_cents,
          currency:"USD" as const,
          requestedFirstChargeDate:day(current.requested_start_date),
          cancellationRequestedAt:requested,
          providerCancellationRecordedAt:confirmed,
          lastProviderCheckAt:iso(current.last_reconciled_at),
          verifiedPaidAccessThrough:paid?.paidThrough??null,
        });
      }catch{throw new WeddingSquareBillingStatusError();}
    },
  };
}
export const weddingSquareBillingStatus=createWeddingSquareBillingStatus(
  pool as Db,readVerifiedWeddingPaid,
);
