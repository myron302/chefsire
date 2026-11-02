import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import pg from "pg";
import {createWeddingSquareLifecycleEvents} from "./wedding-square-lifecycle-events";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const evidenceId="11111111-1111-4111-8111-111111111111";
test("PostgreSQL 16: lifecycle acknowledgements do not promote PENDING or refresh paid evidence",{
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
   const attempt=(await client.query(`INSERT INTO wedding_square_enrollment_attempts
     (user_id,tier,consent_terms_version,consented_at,consented_amount_cents,consented_currency,
      square_location_id,square_plan_variation_id,square_customer_id,square_card_id,idempotency_key,request_fingerprint,status,provider_subscription_id)
     VALUES('owner-1','premium',$1,now(),2499,'USD','loc-1','premium-var','cust-1','card-1','once',repeat('a',64),'confirmed','sub-1') RETURNING id`,
     [WEDDING_CONSENT_VERSION])).rows[0];
   let status='CANCELED';
   const service=createWeddingSquareLifecycleEvents({query:(sql:string,args?:unknown[])=>client.query(sql,args)} as any,
     {inspect:async()=>({attemptId:attempt.id,providerSubscriptionId:'sub-1',providerStatus:status,existingIdMatches:true,
      grantsEntitlement:false,safeToResubmit:false,requiresOperatorReconciliation:true})} as any,
     async()=>Response.json({invoice:{id:'inv-1',subscription_id:'sub-1',location_id:'loc-1',primary_recipient:{customer_id:'cust-1'},status:'UNPAID'}}));
   const before=(await client.query('SELECT verified_paid_through FROM wedding_square_subscriptions')).rows[0];
   const evidenceBefore=(await client.query('SELECT last_payment_reconciled_at FROM wedding_square_invoice_evidence')).rows[0];
   async function enqueue(eventId:string,eventType:string,objectId:string){
    return (await client.query(`INSERT INTO wedding_square_webhook_events
      (event_id,square_environment,square_merchant_id,event_type,square_object_id,last_reconciliation_attempt_at)
      VALUES($1,'sandbox','merchant-1',$2,$3,statement_timestamp()) RETURNING event_id,event_type,square_object_id,
       last_reconciliation_attempt_at::text AS attempted_at`,[eventId,eventType,objectId])).rows[0];
   }
   const canceled=await enqueue('sub-event','subscription.updated','sub-1');
   assert.equal((await service.handle(canceled)).processed,true);
   const after=(await client.query('SELECT provider_status,provider_cancelled_at,verified_paid_through FROM wedding_square_subscriptions')).rows[0];
   assert.equal(after.provider_status,'CANCELED');assert.ok(after.provider_cancelled_at instanceof Date);
   assert.deepEqual(after.verified_paid_through,before.verified_paid_through);
   await client.query("UPDATE wedding_square_subscriptions SET provider_status='PENDING',provider_cancelled_at=NULL");
   status='ACTIVE';
   const invoice=await enqueue('invoice-event','invoice.scheduled_charge_failed','inv-1');
   const oldToken=process.env.SQUARE_ACCESS_TOKEN;process.env.SQUARE_ACCESS_TOKEN='offline-test-token';
   try{assert.equal((await service.handle(invoice)).processed,true);}finally{
    if(oldToken===undefined)delete process.env.SQUARE_ACCESS_TOKEN;else process.env.SQUARE_ACCESS_TOKEN=oldToken;
   }
   assert.equal((await client.query('SELECT provider_status FROM wedding_square_subscriptions')).rows[0].provider_status,'PENDING');
   assert.deepEqual((await client.query('SELECT last_payment_reconciled_at FROM wedding_square_invoice_evidence')).rows[0],evidenceBefore);
   const lost=await enqueue('lost-event','subscription.updated','sub-1');
   await client.query("UPDATE wedding_square_webhook_events SET last_reconciliation_attempt_at=now()+interval '1 minute' WHERE event_id='lost-event'");
   status='CANCELED';assert.equal((await service.handle(lost)).processed,false);
   assert.equal((await client.query('SELECT provider_status FROM wedding_square_subscriptions')).rows[0].provider_status,'PENDING');
 }finally{
   if(connected){
     await client.query("SET search_path TO public").catch(()=>undefined);
     await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
     await client.end();
   }
   keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});
 }
});
