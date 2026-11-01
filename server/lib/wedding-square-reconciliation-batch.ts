import type { PoolClient } from "pg";
import { pool } from "../db";
import { weddingSquareEvidenceRefresh } from "./wedding-square-evidence-refresh";

/**
 * Internal, bounded, read-only candidate selector for ongoing sandbox payment
 * reconciliation. NEVER accepts customer-supplied IDs or Square webhook data.
 *
 * Selects only currently covered, non-revoked, matched Wedding invoice records
 * that lack a fresh payment-specific provider audit. Provider checks run
 * sequentially with a small ceiling to avoid unbounded Square API charges.
 *
 * Revision ordering avoids repeatedly selecting the same failed NULL record
 * ahead of other eligible evidence: EVERY failed/clean audit increments it.
 * Multiple app instances are safe via the revision CAS in refresh(), but may
 * duplicate provider GETs; production scheduling still needs a single leader.
 *
 * There is no paid entitlement activation, Square POST or public endpoint.
 */
type Db = Pick<PoolClient,"query">;
type Refresh = Pick<typeof weddingSquareEvidenceRefresh,"refresh">;
type Selection = { evidence_id:string; user_id:string; reconciliation_revision:number };
const GUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUser=(s:unknown):s is string=>
  typeof s==="string" && s.length>0 && s.length<=200 &&
  !/[\s\x00-\x1f\x7f]/.test(s);
export class WeddingSquareBatchUnavailableError extends Error{
  constructor(){super("Wedding Square reconciliation batch unavailable.");this.name="WeddingSquareBatchUnavailableError";}
}
export function createWeddingSquareReconciliationBatch(db:Db,refresh:Refresh){
  let running=false;
  return {
    async run(){
      if(process.env.SQUARE_ENV!=="sandbox"||
         process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
         process.env.WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED!=="true"||
         process.env.WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED!=="true"||
         !validUser(process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID)||
         !validUser(process.env.SQUARE_LOCATION_ID)) {
        return Object.freeze({status:"disabled" as const,scanned:0,checked:0,failed:0});
      }
      if(running)return Object.freeze({status:"already_running" as const,scanned:0,checked:0,failed:0});
      running=true;
      try{
        // Every candidate's owner comes from a Neon JOIN; never from a call
        // argument, header or delivery. Numeric fields are validated as well.
        const result=await db.query<Selection>(
          `SELECT e.id::text AS evidence_id,s.user_id,e.reconciliation_revision
             FROM wedding_square_invoice_evidence e
             JOIN wedding_square_subscriptions s
               ON s.id=e.wedding_subscription_id
              AND s.square_environment=e.square_environment
              AND s.square_merchant_id=e.square_merchant_id
              AND s.square_subscription_id=e.square_subscription_id
            WHERE s.square_environment='sandbox'
              AND s.square_merchant_id=$1 AND s.square_location_id=$2
              AND s.provider_status IN ('ACTIVE','CANCELED')
              AND e.payment_revoked_at IS NULL
              AND e.period_starts_at<=statement_timestamp()
              AND e.period_ends_at>statement_timestamp()
              AND s.verified_paid_through>=e.period_ends_at
              AND (
                e.last_payment_reconciled_at IS NULL
                OR e.last_payment_reconciled_at<statement_timestamp()-interval '6 hours'
              )
            ORDER BY e.reconciliation_revision ASC,e.id ASC
            LIMIT 10`,
          [process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID,process.env.SQUARE_LOCATION_ID],
        );
        const rows=result?.rows;
        if(!Array.isArray(rows)||rows.length>10)throw new WeddingSquareBatchUnavailableError();
        const seen=new Set<string>();
        for(const item of rows){
          if(!item||typeof item.evidence_id!=="string"||
             !GUID.test(item.evidence_id)||
             !validUser(item.user_id)||
             !Number.isSafeInteger(item.reconciliation_revision)||
             item.reconciliation_revision<0||
             seen.has(item.evidence_id))throw new WeddingSquareBatchUnavailableError();
          seen.add(item.evidence_id);
        }
        let checked=0,failed=0;
        for(const item of rows){
          try{
            const status=await refresh.refresh(item.evidence_id,item.user_id);
            if(status.status==="payment_rechecked")checked++;
            else failed++;
          }catch{failed++;}
        }
        return Object.freeze({status:"completed" as const,scanned:rows.length,checked,failed});
      }catch{
        throw new WeddingSquareBatchUnavailableError();
      }finally{running=false;}
    },
  };
}
export const weddingSquareReconciliationBatch=createWeddingSquareReconciliationBatch(
  pool as Db,weddingSquareEvidenceRefresh);
