import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareSandboxMerchantAttestation } from "./wedding-square-sandbox-merchant-attestation";
import { weddingSquareEvidenceRefresh } from "./wedding-square-evidence-refresh";
import { weddingSquareRefundReadback } from "./wedding-square-refund-readback";
import { weddingSquareLifecycleEvents } from "./wedding-square-lifecycle-events";
import { weddingSquareDisputeReadback } from "./wedding-square-dispute-readback";

type Db=Pick<PoolClient,"query">;
type Merchant=Pick<typeof weddingSquareSandboxMerchantAttestation,"inspect">;
type Refresh=Pick<typeof weddingSquareEvidenceRefresh,"refresh">;
type Refund=Pick<typeof weddingSquareRefundReadback,"inspect">;
type Lifecycle=Pick<typeof weddingSquareLifecycleEvents,"handle">;
type Dispute=Pick<typeof weddingSquareDisputeReadback,"inspect">;
type Event={event_id:string;event_type:string;square_object_id:string;attempted_at:string};
type Evidence={id:string;user_id:string;square_customer_id:string;square_payment_id:string;
  agreed_monthly_amount_cents:number;reconciliation_revision:number};
const valid=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class WeddingSquarePaymentEventsError extends Error{
  constructor(){super("Wedding payment event reconciliation unavailable.");}
}
/** Only exact, owner-bound provider reads can consume payment/refund hints. */
export function createWeddingSquarePaymentEvents(db:Db,merchant:Merchant,refresh:Refresh,refund:Refund,lifecycle?:Lifecycle,dispute:Dispute=weddingSquareDisputeReadback){
  let running=false;
  return {async run(){
    const merchantId=process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
    const location=process.env.SQUARE_LOCATION_ID;
    if(process.env.SQUARE_ENV!=="sandbox"||process.env.SQUARE_LIVE_PAYMENTS_ENABLED==="true"||
       process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
       process.env.WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED!=="true"||
       process.env.WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED!=="true"||
       process.env.WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED!=="true"||
       !valid(merchantId)||!valid(location))return {status:"disabled" as const,scanned:0,processed:0,pending:0};
    if(running)return {status:"already_running" as const,scanned:0,processed:0,pending:0};
    running=true;
    try{
      const m=await merchant.inspect();
      if(m.verifiedSandboxMerchantContext!==true||m.merchantId!==merchantId||m.locationId!==location||
         m.grantsEntitlement!==false||m.authorizesSubscriptionCreation!==false)throw new WeddingSquarePaymentEventsError();
      // Claim only the event about to be checked. A payment risk audit permits
      // at most 51 GETs x 15 seconds, below this event's 15-minute lease.
      // There is no sequential batch waiting with already-aging leases.
      const queue=await db.query<Event>(`WITH selected AS (
        SELECT event_id FROM wedding_square_webhook_events
         WHERE square_environment='sandbox' AND square_merchant_id=$1
           AND processing_status='pending' AND square_object_id IS NOT NULL
           AND (event_type IN ('payment.created','payment.updated','refund.created','refund.updated','dispute.created','dispute.state.updated')
             OR event_type LIKE 'subscription.%' OR event_type LIKE 'invoice.%')
           AND (last_reconciliation_attempt_at IS NULL OR last_reconciliation_attempt_at<now()-interval '15 minutes')
         ORDER BY last_reconciliation_attempt_at ASC NULLS FIRST,received_at,event_id
         LIMIT 1 FOR UPDATE SKIP LOCKED
      ) UPDATE wedding_square_webhook_events w SET last_reconciliation_attempt_at=statement_timestamp()
         FROM selected WHERE w.event_id=selected.event_id AND w.square_environment='sandbox' AND w.square_merchant_id=$1
       RETURNING w.event_id,w.event_type,w.square_object_id,w.last_reconciliation_attempt_at::text AS attempted_at`,[merchantId]);
      if(!Array.isArray(queue.rows)||queue.rows.length>1)throw new WeddingSquarePaymentEventsError();
      const seen=new Set<string>();
      for(const e of queue.rows){
        if(!valid(e.event_id)||!valid(e.square_object_id)||
           !(/^(subscription|invoice)\.[a-z_]+$/.test(e.event_type)||
             ["payment.created","payment.updated","refund.created","refund.updated","dispute.created","dispute.state.updated"].includes(e.event_type))||
           typeof e.attempted_at!=="string"||!Number.isFinite(Date.parse(e.attempted_at))||seen.has(e.event_id))
          throw new WeddingSquarePaymentEventsError();
        seen.add(e.event_id);
      }
      let processed=0;
      for(const event of queue.rows){
        try{
          if(/^(subscription|invoice)\./.test(event.event_type)){
            const result=await lifecycle?.handle(event);
            if(result?.processed===true&&result.grantsEntitlement===false)processed++;
            continue;
          }
          const refundProof=event.event_type.startsWith("refund.")?await refund.inspect(event.square_object_id):null;
          if(refundProof&&(refundProof.refundId!==event.square_object_id||refundProof.completedRefund!==true||
             refundProof.grantsEntitlement!==false||refundProof.locationId!==location))continue;
          const disputeProof=event.event_type.startsWith("dispute.")?await dispute.inspect(event.square_object_id):null;
          if(disputeProof&&(disputeProof.disputeId!==event.square_object_id||
             disputeProof.grantsEntitlement!==false||disputeProof.locationId!==location))continue;
          const adverseProof=refundProof??disputeProof;
          const paymentId=adverseProof?.paymentId??event.square_object_id;
          if(!valid(paymentId))continue;
          const selected=await db.query<Evidence>(`SELECT e.id::text AS id,s.user_id,s.square_customer_id,
              e.square_payment_id,s.agreed_monthly_amount_cents,e.reconciliation_revision
            FROM wedding_square_invoice_evidence e JOIN wedding_square_subscriptions s
              ON s.id=e.wedding_subscription_id AND s.square_subscription_id=e.square_subscription_id
             AND s.square_environment=e.square_environment AND s.square_merchant_id=e.square_merchant_id
           WHERE e.square_environment='sandbox' AND e.square_merchant_id=$1 AND s.square_location_id=$2
             AND e.square_payment_id=$3 AND s.provider_status IN ('ACTIVE','CANCELED')
           LIMIT 2`,[merchantId,location,paymentId]);
          if(selected.rows.length!==1)continue;
          const row=selected.rows[0];
          if(!uuid.test(row.id)||!valid(row.user_id)||!valid(row.square_customer_id)||row.square_payment_id!==paymentId||
             ![2499,4999].includes(row.agreed_monthly_amount_cents)||
             !Number.isSafeInteger(row.reconciliation_revision)||row.reconciliation_revision<0)continue;
          if(adverseProof&&(adverseProof.customerId!==row.square_customer_id||
             adverseProof.amountCents!==row.agreed_monthly_amount_cents))continue;
          if(!adverseProof){
            const result=await refresh.refresh(row.id,row.user_id);
            if(result.status!=="payment_rechecked"||result.grantsEntitlement!==false)continue;
          }
          // Exact queue lease + evidence revision CAS. Completed refunds revoke
          // only this payment, atomically with event acknowledgement. Unknown
          // provider outcomes keep the event pending; they cannot restore access.
          const result=adverseProof?await db.query(`WITH locked_queue AS MATERIALIZED (
            SELECT event_id FROM wedding_square_webhook_events WHERE event_id=$5
              AND square_environment='sandbox' AND square_merchant_id=$2 AND processing_status='pending'
              AND square_object_id=$6 AND last_reconciliation_attempt_at=$7::timestamptz FOR UPDATE
          ), revoked AS (
            UPDATE wedding_square_invoice_evidence SET payment_revoked_at=COALESCE(payment_revoked_at,now()),
              last_payment_reconciled_at=NULL,reconciliation_revision=reconciliation_revision+1
             WHERE id=$1::uuid AND square_environment='sandbox' AND square_merchant_id=$2
               AND square_payment_id=$3 AND reconciliation_revision=$4
               AND EXISTS (SELECT 1 FROM locked_queue)
             RETURNING id
          ) UPDATE wedding_square_webhook_events SET processing_status='processed',processed_at=now()
             WHERE event_id=$5 AND square_environment='sandbox' AND square_merchant_id=$2
               AND processing_status='pending' AND square_object_id=$6
               AND last_reconciliation_attempt_at=$7::timestamptz AND EXISTS(SELECT 1 FROM revoked)`,
            [row.id,merchantId,paymentId,row.reconciliation_revision,event.event_id,event.square_object_id,event.attempted_at])
          :await db.query(`UPDATE wedding_square_webhook_events SET processing_status='processed',processed_at=now()
             WHERE event_id=$5 AND square_environment='sandbox' AND square_merchant_id=$2
               AND processing_status='pending' AND square_object_id=$6 AND last_reconciliation_attempt_at=$7::timestamptz
               AND EXISTS(SELECT 1 FROM wedding_square_invoice_evidence WHERE id=$1::uuid
                 AND square_environment='sandbox' AND square_merchant_id=$2 AND square_payment_id=$3
                 AND reconciliation_revision=$4 AND payment_revoked_at IS NULL
                 AND last_payment_reconciled_at>=$7::timestamptz)`,
            [row.id,merchantId,paymentId,row.reconciliation_revision+1,event.event_id,event.square_object_id,event.attempted_at]);
          if(result.rowCount===1)processed++;
        }catch{/* A later fair scan may independently GET again; never replay a provider write. */}
      }
      return {status:"completed" as const,scanned:queue.rows.length,processed,pending:queue.rows.length-processed};
    }catch{throw new WeddingSquarePaymentEventsError();}finally{running=false;}
  }};
}
export const weddingSquarePaymentEvents=createWeddingSquarePaymentEvents(pool as Db,
  weddingSquareSandboxMerchantAttestation,weddingSquareEvidenceRefresh,weddingSquareRefundReadback,weddingSquareLifecycleEvents);
