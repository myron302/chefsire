import type { PoolClient } from "pg";
import { pool } from "../db";

/**
 * Legacy cardless trial cancellation cannot cancel a provider subscription.
 * Check for ANY owner-bound unresolved Square attempt or nonterminal Square
 * subscription, independent of environment switches and stored legacy tier.
 *
 * A Square CreateSubscription timeout may already have started billing
 * even when Neon has no subscription row. Fail closed on query uncertainty.
 */
type Db=Pick<PoolClient,"query">;
const valid=(s:unknown):s is string=>typeof s==="string"&&s.length>0&&s.length<=200&&!/[\s\x00-\x1f\x7f]/.test(s);
export class WeddingSquareLegacyCancellationBlocked extends Error {
 constructor(){super("Wedding recurring billing must be canceled and verified through Square.");this.name="WeddingSquareLegacyCancellationBlocked";}
}
export function createWeddingSquareLegacyCancelGuard(db:Db){
 return{
  async assertCardlessOnly(userId:string){
   if(!valid(userId))throw new WeddingSquareLegacyCancellationBlocked();
   try{
    const check=await db.query<{blocked:boolean}>(
     `SELECT (
       EXISTS (
        SELECT 1 FROM wedding_square_enrollment_attempts a
         WHERE a.user_id=$1 AND a.square_environment='sandbox'
           AND a.status IN ('reserved','submitting','needs_reconciliation')
       )
       OR EXISTS (
        SELECT 1 FROM wedding_square_enrollment_attempts a
         WHERE a.user_id=$1 AND a.square_environment='sandbox'
           AND a.status='confirmed'
           AND NOT EXISTS (
            SELECT 1 FROM wedding_square_subscriptions s
             WHERE s.user_id=a.user_id
               AND s.square_environment='sandbox'
               AND s.square_subscription_id=a.provider_subscription_id
               AND s.provider_status IN ('CANCELED','COMPLETED','DEACTIVATED')
           )
       )
       OR EXISTS (
        SELECT 1 FROM wedding_square_subscriptions s
         WHERE s.user_id=$1 AND s.square_environment='sandbox'
           AND (
             s.provider_status IN ('PENDING','ACTIVE','PAUSED')
             OR (s.cancellation_requested_at IS NOT NULL
                 AND s.provider_cancelled_at IS NULL)
           )
       )
     ) AS blocked`,
     [userId],
    );
    if(!check||!Array.isArray(check.rows)||check.rows.length!==1||
       check.rows[0].blocked!==false)throw new WeddingSquareLegacyCancellationBlocked();
    return Object.freeze({legacyCancellationSafe:true as const});
   }catch{throw new WeddingSquareLegacyCancellationBlocked();}
  },
 };
}
export const weddingSquareLegacyCancelGuard=createWeddingSquareLegacyCancelGuard(pool as Db);
