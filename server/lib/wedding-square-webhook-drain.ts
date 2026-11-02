import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareRenewalScan } from "./wedding-square-renewal-scan";
import { weddingSquareReconciliationBatch } from "./wedding-square-reconciliation-batch";

/**
 * Signed webhooks are hints, never payment evidence. Queue processing only
 * schedules the independent, owner-bound provider scanners already used by
 * cron. A processed notification never grants access or confirms its content.
 */
type Db=Pick<PoolClient,"query">;
type Scan={run():Promise<{status:string;scanned:number;recorded?:number;existing?:number;pending?:number;checked?:number;failed?:number}>};
const valid=(s:unknown):s is string=>typeof s==="string"&&s.length>0&&s.length<=200&&!/[\s\x00-\x1f\x7f]/.test(s);
type EventRow={event_id:string;event_type:string};
export class WeddingSquareWebhookDrainUnavailable extends Error{
 constructor(){super("Wedding Square notification queue requires operator reconciliation.");}
}
export function createWeddingSquareWebhookDrain(db:Db,renewal:Scan,reconcile:Scan){
 let running=false;
 return {
  async run(){
   if(process.env.SQUARE_ENV!=="sandbox"||
      process.env.SQUARE_LIVE_PAYMENTS_ENABLED==="true"||
      process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
      process.env.WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED!=="true"||
      process.env.WEDDING_SQUARE_SANDBOX_WEBHOOK_DRAIN_ENABLED!=="true"||
      process.env.WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED!=="true"||
      process.env.WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED!=="true"||
      process.env.WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED!=="true"||
      !valid(process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID))
     return {status:"disabled" as const,scanned:0,processed:0,pending:0};
   if(running)return {status:"already_running" as const,scanned:0,processed:0,pending:0};
   running=true;
   try{
    const merchant=process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID!;
    const rows=await db.query<EventRow>(
      `SELECT event_id,event_type FROM wedding_square_webhook_events
         WHERE square_environment='sandbox' AND square_merchant_id=$1
           AND processing_status='pending'
           AND (event_type LIKE 'subscription.%' OR event_type LIKE 'invoice.%')
         ORDER BY received_at ASC,event_id ASC LIMIT 10`,[merchant]);
    if(!Array.isArray(rows.rows)||rows.rows.length>10||
       rows.rows.some(e=>!valid(e.event_id)||typeof e.event_type!=="string"||
         !/^(subscription|invoice|payment|refund)\./.test(e.event_type)))
      throw new WeddingSquareWebhookDrainUnavailable();
    if(!rows.rows.length)return {status:"completed" as const,scanned:0,processed:0,pending:0};
    // A global scan cannot establish which event created a provider change.
    // This is a signal-handling acknowledgement ONLY. Never write paid coverage.
    const a=await renewal.run();
    const b=await reconcile.run();
    if(a.status!=="completed"||b.status!=="completed"||
       a.pending!==0 || b.failed!==0 ||
       !Number.isSafeInteger(a.scanned) || !Number.isSafeInteger(b.scanned) ||
       !Number.isSafeInteger(a.recorded) || !Number.isSafeInteger(a.existing) ||
       !Number.isSafeInteger(b.checked) ||
       a.scanned===0 || b.scanned===0 ||
       (a.recorded??0)+(a.existing??0)===0 || (b.checked??0)===0)
      return {status:"reconciliation_required" as const,scanned:rows.rows.length,processed:0,pending:rows.rows.length};
    let processed=0;
    for(const event of rows.rows){
      // Refund/payment notifications require payment-specific evidence checks,
      // not mere discovery. Keep them pending for provider reconciliation.
      if(!/^(subscription|invoice)\./.test(event.event_type))continue;
      const updated=await db.query(
        `UPDATE wedding_square_webhook_events
            SET processing_status='processed',processed_at=now()
          WHERE square_environment='sandbox' AND square_merchant_id=$1
            AND event_id=$2 AND processing_status='pending'`,
        [merchant,event.event_id]);
      if(updated.rowCount===1)processed++;
      else if(updated.rowCount!==0)throw new WeddingSquareWebhookDrainUnavailable();
    }
    return {status:"completed" as const,scanned:rows.rows.length,processed,pending:rows.rows.length-processed};
   }catch{
    throw new WeddingSquareWebhookDrainUnavailable();
   }finally{running=false;}
  },
 };
}
export const weddingSquareWebhookDrain=createWeddingSquareWebhookDrain(
 pool as Db,weddingSquareRenewalScan,weddingSquareReconciliationBatch);
