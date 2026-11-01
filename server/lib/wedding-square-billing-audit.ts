import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareProviderPaymentReadback } from "./wedding-square-provider-payment-readback";
import { weddingSquareReconciliationReadback } from "./wedding-square-reconciliation-readback";
import { weddingSquareSandboxMerchantAttestation } from "./wedding-square-sandbox-merchant-attestation";
import { weddingSquareSandboxPaymentRiskApi } from "./wedding-square-sandbox-payment-risk-api";
import { WEDDING_MONTHLY_CENTS, WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";

type Db = Pick<PoolClient,"query">;
type Candidate = Pick<typeof weddingSquareProviderPaymentReadback,"inspect">;
type Saved = Pick<typeof weddingSquareReconciliationReadback,"inspect">;
type Merchant = Pick<typeof weddingSquareSandboxMerchantAttestation,"inspect">;
type Risk = Pick<typeof weddingSquareSandboxPaymentRiskApi,"inspect">;
type Row = {
  user_id:string; tier:"premium"|"elite"; square_merchant_id:string;
  square_customer_id:string; square_location_id:string;
  square_subscription_id:string; agreed_monthly_amount_cents:number;
  agreed_currency:string; billing_consent_terms_version:string;
  provider_status:string;
};
const valid = (s:unknown):s is string => typeof s==="string" &&
  s.length>0 && s.length<=200 && !/[\s\x00-\x1f\x7f]/.test(s);
export class WeddingSquareBillingAuditError extends Error {
  constructor(){
    super("Wedding Square payment evidence needs operator reconciliation.");
    this.name="WeddingSquareBillingAuditError";
  }
}
/**
 * Trusted, owner-bound, read-only assessment. Merchant, saved attempt,
 * subscription price, invoice/order/payment and refund/dispute status are
 * checked independently. Browser IDs and webhook claims are never accepted.
 * Returns NO paid period or entitlement: a later stage must prove coverage.
 */
export function createWeddingSquareBillingAudit(db:Db,candidate:Candidate,saved:Saved,merchant:Merchant,risk:Risk){
  return {async inspect(attemptId:string,userId:string){
    if(process.env.SQUARE_ENV!=="sandbox"||
       process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
       !valid(attemptId)||!valid(userId))throw new WeddingSquareBillingAuditError();
    try{
      const m=await merchant.inspect();
      if(m.verifiedSandboxMerchantContext!==true||
         m.merchantId!==process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID||
         m.locationId!==process.env.SQUARE_LOCATION_ID||
         m.authorizesSubscriptionCreation!==false||
         m.grantsEntitlement!==false||
         m.safeToResubmit!==false||m.currency!=="USD")throw Error("Merchant invalid");
      const owner=await saved.inspect(attemptId,userId);
      if(owner.attemptId!==attemptId||owner.status!=="confirmed"||
         !valid(owner.providerSubscriptionId)||
         !valid(owner.customerId)||owner.locationId!==m.locationId)throw Error("Owner invalid");
      const records=await db.query<Row>(
        `SELECT user_id,tier,square_merchant_id,square_customer_id,square_location_id,
                square_subscription_id,agreed_monthly_amount_cents,agreed_currency,
                billing_consent_terms_version,provider_status
           FROM wedding_square_subscriptions
          WHERE user_id=$1 AND square_environment='sandbox'
            AND square_merchant_id=$2 AND square_subscription_id=$3
            AND square_customer_id=$4 AND square_location_id=$5
          LIMIT 2`,
        [userId,m.merchantId,owner.providerSubscriptionId,owner.customerId,owner.locationId]);
      if(records.rows.length!==1)throw Error("Subscription ambiguous");
      const row=records.rows[0];
      if(row.user_id!==userId||row.square_merchant_id!==m.merchantId||
         row.square_customer_id!==owner.customerId||
         row.square_location_id!==owner.locationId||
         row.square_subscription_id!==owner.providerSubscriptionId||
         row.agreed_currency!=="USD"||
         row.billing_consent_terms_version!==WEDDING_CONSENT_VERSION||
         (row.tier!=="premium"&&row.tier!=="elite")||
         row.agreed_monthly_amount_cents!==WEDDING_MONTHLY_CENTS[row.tier]||
         !["ACTIVE","CANCELED"].includes(row.provider_status))throw Error("Subscription invalid");
      const proof=await candidate.inspect(attemptId,userId);
      if(proof.subscriptionId!==row.square_subscription_id||
         !valid(proof.invoiceId)||!valid(proof.paymentId)||
         proof.requiresOperatorReconciliation!==true||
         proof.requiresAmountAndCoverageVerification!==true||
         proof.grantsEntitlement!==false||proof.safeToResubmit!==false)
        throw Error("Invoice evidence mismatch");
      const audit=await risk.inspect(proof.paymentId,row.square_customer_id,
        row.square_location_id,row.agreed_monthly_amount_cents);
      if(audit.paymentId!==proof.paymentId||
         audit.noRefundsOrDisputes!==true||
         audit.grantsEntitlement!==false||
         audit.requiresIndependentPeriodVerification!==true)
        throw Error("Provider risk evidence invalid");
      return Object.freeze({
        invoiceId:proof.invoiceId,paymentId:proof.paymentId,
        subscriptionId:row.square_subscription_id,
        verifiedAmountCents:row.agreed_monthly_amount_cents,
        noRefundsOrDisputes:true as const,
        requiresIndependentPeriodVerification:true as const,
        grantsEntitlement:false as const,safeToResubmit:false as const,
      });
    }catch{throw new WeddingSquareBillingAuditError();}
  }};
}
export const weddingSquareBillingAudit=createWeddingSquareBillingAudit(
  pool as Db,weddingSquareProviderPaymentReadback,
  weddingSquareReconciliationReadback,
  weddingSquareSandboxMerchantAttestation,
  weddingSquareSandboxPaymentRiskApi);
