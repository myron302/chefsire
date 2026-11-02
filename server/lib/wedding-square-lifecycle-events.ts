import {z} from "zod";
import type {PoolClient} from "pg";
import {pool} from "../db";
import {weddingSquareSandboxSubscriptionReadback,createWeddingSquareSandboxSubscriptionReadback} from "./wedding-square-sandbox-subscription-readback";
import {weddingSquareReconciliationReadback} from "./wedding-square-reconciliation-readback";
import {weddingSquareSandboxCatalogAttestation} from "./wedding-square-sandbox-catalog-attestation";
type Db=Pick<PoolClient,"query">;
type Provider=Pick<typeof weddingSquareSandboxSubscriptionReadback,"inspect">;
type Sender=(url:string,init:RequestInit)=>Promise<Response>;
export type WeddingLifecycleEvent={event_id:string;event_type:string;square_object_id:string;attempted_at:string};
type Row={id:string;user_id:string;attempt_id:string;square_subscription_id:string;square_customer_id:string};
const id=z.string().min(1).max(200).refine(s=>!/[\s\x00-\x1f\x7f]/.test(s));
const invoiceEnvelope=z.object({errors:z.array(z.unknown()).length(0).optional(),invoice:z.object({
 id,subscription_id:id,location_id:id,primary_recipient:z.object({customer_id:id}),
})});
const uuid=z.string().uuid();
// Validate ORIGINAL errors before adapting raw snake_case to the existing
// owner/fingerprint/catalog verifier. SDK normalization can erase errors:null.
export async function readWeddingSquareLifecycleSubscription(subscriptionId:string,sender:Sender=fetch){
 if(process.env.SQUARE_ENV!=="sandbox"||process.env.SQUARE_LIVE_PAYMENTS_ENABLED==="true"||
    !id.safeParse(process.env.SQUARE_ACCESS_TOKEN).success||!id.safeParse(subscriptionId).success)throw Error("Subscription read unavailable");
 const response=await sender("https://connect.squareupsandbox.com/v2/subscriptions/"+encodeURIComponent(subscriptionId),{
  method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),headers:{
   Authorization:`Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,"Square-Version":"2025-10-16",Accept:"application/json",
  },
 });
 if(response.status!==200)throw Error("Subscription read unavailable");
 const length=response.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))throw Error("Subscription read unavailable");
 const raw=await response.text();if(raw.length>65536)throw Error("Subscription read unavailable");
 const s=z.object({errors:z.array(z.unknown()).length(0).optional(),subscription:z.record(z.unknown())}).parse(JSON.parse(raw)).subscription;
 return {subscription:{id:s.id,customerId:s.customer_id,cardId:s.card_id,locationId:s.location_id,
  planVariationId:s.plan_variation_id,status:s.status,startDate:s.start_date,timezone:s.timezone}};
}
/** Current lifecycle identity only. Invoice status never becomes paid coverage. */
export function createWeddingSquareLifecycleEvents(db:Db,provider:Provider,sender:Sender=fetch){
 return {async handle(event:WeddingLifecycleEvent){
  const pending={processed:false as const,grantsEntitlement:false as const};
  const merchant=process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID;
  const location=process.env.SQUARE_LOCATION_ID;
  if(process.env.SQUARE_ENV!=="sandbox"||process.env.SQUARE_LIVE_PAYMENTS_ENABLED==="true"||
     process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
     process.env.WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED!=="true"||
     process.env.WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED!=="true"||
     !id.safeParse(merchant).success||!id.safeParse(location).success||
     !id.safeParse(event.event_id).success||!id.safeParse(event.square_object_id).success||
     !/^(subscription|invoice)\.[a-z_]+$/.test(event.event_type)||
     !Number.isFinite(Date.parse(event.attempted_at)))return pending;
  try{
   let subscriptionId=event.square_object_id;
   let invoiceCustomer:string|null=null;
   if(event.event_type.startsWith("invoice.")){
    if(!id.safeParse(process.env.SQUARE_ACCESS_TOKEN).success)return pending;
    const response=await sender("https://connect.squareupsandbox.com/v2/invoices/"+encodeURIComponent(event.square_object_id),{
     method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),headers:{
      Authorization:`Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,"Square-Version":"2025-10-16",Accept:"application/json",
     },
    });
    if(response.status!==200)return pending;
    const length=response.headers.get("content-length");
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))return pending;
    const raw=await response.text();if(raw.length>65536)return pending;
    const invoice=invoiceEnvelope.parse(JSON.parse(raw)).invoice;
    if(invoice.id!==event.square_object_id||invoice.location_id!==location)return pending;
    subscriptionId=invoice.subscription_id;invoiceCustomer=invoice.primary_recipient.customer_id;
   }
   const records=await db.query<Row>(`SELECT s.id::text AS id,s.user_id,a.id::text AS attempt_id,
     s.square_subscription_id,s.square_customer_id FROM wedding_square_subscriptions s
     JOIN wedding_square_enrollment_attempts a ON a.user_id=s.user_id AND a.square_environment=s.square_environment
      AND a.provider_subscription_id=s.square_subscription_id AND a.status='confirmed'
    WHERE s.square_environment='sandbox' AND s.square_merchant_id=$1 AND s.square_location_id=$2
      AND s.square_subscription_id=$3 LIMIT 2`,[merchant,location,subscriptionId]);
   if(records.rows.length!==1)return pending;
   const row=records.rows[0];
   if(!uuid.safeParse(row.id).success||!uuid.safeParse(row.attempt_id).success||!id.safeParse(row.user_id).success||
      !id.safeParse(row.square_customer_id).success||row.square_subscription_id!==subscriptionId||
      (invoiceCustomer!==null&&invoiceCustomer!==row.square_customer_id))return pending;
   const proof=await provider.inspect(row.attempt_id,row.user_id);
   if(proof.attemptId!==row.attempt_id||proof.providerSubscriptionId!==subscriptionId||proof.existingIdMatches!==true||
      proof.grantsEntitlement!==false||proof.safeToResubmit!==false||proof.requiresOperatorReconciliation!==true||
      !["PENDING","ACTIVE","PAUSED","CANCELED","DEACTIVATED","COMPLETED"].includes(proof.providerStatus))return pending;
   const result=await db.query(`WITH locked_queue AS MATERIALIZED (
     SELECT event_id FROM wedding_square_webhook_events WHERE square_environment='sandbox' AND square_merchant_id=$1
      AND event_id=$2 AND event_type=$3 AND square_object_id=$4 AND processing_status='pending'
      AND last_reconciliation_attempt_at=$5::timestamptz FOR UPDATE
    ), checked AS (
     UPDATE wedding_square_subscriptions SET
       provider_status=CASE WHEN provider_status='PENDING' AND $6='ACTIVE' THEN 'PENDING' ELSE $6 END,
       provider_cancelled_at=CASE WHEN $6='CANCELED' THEN COALESCE(provider_cancelled_at,now()) ELSE provider_cancelled_at END,
       last_reconciled_at=now(),updated_at=now()
      WHERE id=$7::uuid AND user_id=$8 AND square_environment='sandbox' AND square_merchant_id=$1
       AND square_location_id=$9 AND square_subscription_id=$10 AND square_customer_id=$11
       AND EXISTS(SELECT 1 FROM locked_queue) RETURNING id
    ) UPDATE wedding_square_webhook_events SET processing_status='processed',processed_at=now()
      WHERE square_environment='sandbox' AND square_merchant_id=$1 AND event_id=$2
       AND processing_status='pending' AND event_type=$3 AND square_object_id=$4
       AND last_reconciliation_attempt_at=$5::timestamptz AND EXISTS(SELECT 1 FROM checked)`,
    [merchant,event.event_id,event.event_type,event.square_object_id,event.attempted_at,proof.providerStatus,
     row.id,row.user_id,location,subscriptionId,row.square_customer_id]);
   return {processed:result.rowCount===1,grantsEntitlement:false as const};
  }catch{return pending;}
 }};
}
const rawSubscriptionReadback=createWeddingSquareSandboxSubscriptionReadback(weddingSquareReconciliationReadback,
 readWeddingSquareLifecycleSubscription,weddingSquareSandboxCatalogAttestation);
export const weddingSquareLifecycleEvents=createWeddingSquareLifecycleEvents(pool as Db,rawSubscriptionReadback);
