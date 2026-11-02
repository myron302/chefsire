import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import pg from "pg";
import { createWeddingSquareEvidenceRefresh } from "./wedding-square-evidence-refresh";
import { createWeddingSquarePaymentEvents } from "./wedding-square-payment-events";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const evidenceId="11111111-1111-4111-8111-111111111111";
test("PostgreSQL 16: event-bound payment acknowledgement and refund revocation are atomic",{
 skip:!url?"Requires disposable PostgreSQL 16":undefined,
},async()=>{
 if(!url)throw Error("Missing disposable DB URL");
 const u=new URL(url);
 if(!["localhost","127.0.0.1","::1"].includes(u.hostname)||!/test/i.test(u.pathname))
   throw Error("Remote or non-test DB prohibited");
 const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
 const schema="wedding_refresh_test_"+randomUUID().replaceAll("-","");
 const keys=["SQUARE_ENV","SQUARE_LIVE_PAYMENTS_ENABLED","WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED","WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
   "WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED",
   "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"]as const;
 const before=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED:"true",WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1"});
 let connected=false;
 try{
   await client.connect();connected=true;
   await client.query(`CREATE SCHEMA "${schema}"`);
   await client.query(`SET search_path TO "${schema}"`);
   await client.query("CREATE TABLE users(id varchar PRIMARY KEY)");
   await client.query("INSERT INTO users(id) VALUES('owner-1'),('foreign')");
   for(const name of ["20261101_01_wedding_square_enrollment_attempts.sql",
     "20261101_02_wedding_square_billing_foundation.sql",
     "20261101_03_wedding_square_payment_reconciliation.sql",
     "20261101_04_wedding_square_reconciliation_revision.sql",
     "20261102_03_wedding_square_webhook_object_correlation.sql",
     "20261102_04_wedding_square_webhook_reconciliation_lease.sql"]){
     await client.query(readFileSync(path.join(root,"server/migrations",name),"utf8"));
   }
   const subscription=(await client.query<{id:string}>(`INSERT INTO wedding_square_subscriptions
     (user_id,tier,square_environment,square_merchant_id,square_location_id,
      square_customer_id,square_plan_variation_id,square_subscription_id,
      billing_consent_at,billing_consent_terms_version,
      agreed_monthly_amount_cents,agreed_currency,provider_status,verified_paid_through)
     VALUES('owner-1','premium','sandbox','merchant-1','loc-1',
      'cust-1','premium-var','sub-1',now(),$1,2499,'USD','ACTIVE',
      now()+interval '12 days') RETURNING id`,[WEDDING_CONSENT_VERSION])).rows[0];
   await client.query(`INSERT INTO wedding_square_invoice_evidence
     (id,wedding_subscription_id,square_environment,square_merchant_id,
      square_invoice_id,square_payment_id,square_subscription_id,
      verified_amount_cents,verified_currency,provider_paid_at,
      period_starts_at,period_ends_at,last_payment_reconciled_at)
     VALUES($1,$2,'sandbox','merchant-1','inv-1','pay-1','sub-1',
      2499,'USD',now()-interval '1 day',now()-interval '1 day',
      now()+interval '12 days',now()-interval '1 hour')`,[evidenceId,subscription.id]);
   const db={query:(sql:string,args?:unknown[])=>client.query(sql,args)} as any;
   const refresh=createWeddingSquareEvidenceRefresh(db,{inspect:async()=>({paymentId:"pay-1",noRefundsOrDisputes:true,
     grantsEntitlement:false,requiresIndependentPeriodVerification:true})} as any);
   const worker=createWeddingSquarePaymentEvents(db,{inspect:async()=>({verifiedSandboxMerchantContext:true,
     merchantId:"merchant-1",locationId:"loc-1",grantsEntitlement:false,authorizesSubscriptionCreation:false})} as any,
     refresh,{inspect:async()=>({refundId:"refund-1",paymentId:"pay-1",customerId:"cust-1",locationId:"loc-1",
       amountCents:2499,completedRefund:true,grantsEntitlement:false})} as any);
   await client.query(`INSERT INTO wedding_square_webhook_events
     (event_id,square_environment,square_merchant_id,event_type,square_object_id)
     VALUES('payment-event','sandbox','merchant-1','payment.updated','pay-1')`);
   assert.deepEqual(await worker.run(),{status:"completed",scanned:1,processed:1,pending:0});
   assert.equal((await client.query("SELECT processing_status FROM wedding_square_webhook_events")).rows[0].processing_status,"processed");
   await client.query(`INSERT INTO wedding_square_webhook_events
     (event_id,square_environment,square_merchant_id,event_type,square_object_id)
     VALUES('refund-event','sandbox','merchant-1','refund.updated','refund-1')`);
   assert.equal((await worker.run()).processed,1);
   const after=(await client.query("SELECT payment_revoked_at,last_payment_reconciled_at FROM wedding_square_invoice_evidence")).rows[0];
   assert.ok(after.payment_revoked_at instanceof Date);
   assert.equal(after.last_payment_reconciled_at,null);
   assert.equal((await worker.run()).scanned,0,"processed notifications are never replayed");
 }finally{
   if(connected){
     await client.query("SET search_path TO public").catch(()=>undefined);
     await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
     await client.end();
   }
   keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});
 }
});
