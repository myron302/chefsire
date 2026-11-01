import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import pg from "pg";
import { createWeddingSquareEvidenceRefresh,WeddingSquareEvidenceRefreshError } from "./wedding-square-evidence-refresh";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const evidenceId="11111111-1111-4111-8111-111111111111";
test("PostgreSQL 16: actual owner/payment row refreshes, provider outage invalidates freshness",{
 skip:!url?"Requires disposable PostgreSQL 16":undefined,
},async()=>{
 if(!url)throw Error("Missing disposable DB URL");
 const u=new URL(url);
 if(!["localhost","127.0.0.1","::1"].includes(u.hostname)||!/test/i.test(u.pathname))
   throw Error("Remote or non-test DB prohibited");
 const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
 const schema="wedding_refresh_test_"+randomUUID().replaceAll("-","");
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
   "WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED",
   "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"]as const;
 const before=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",
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
     "20261101_04_wedding_square_reconciliation_revision.sql"]){
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
   let deny=false;
   const service=createWeddingSquareEvidenceRefresh(
     {query:(sql:string,args?:unknown[])=>client.query(sql,args)}as any,
     {inspect:async()=>deny?{paymentId:"pay-1",noRefundsOrDisputes:false,
       grantsEntitlement:false,requiresIndependentPeriodVerification:true}:
       {paymentId:"pay-1",noRefundsOrDisputes:true,
         grantsEntitlement:false,requiresIndependentPeriodVerification:true}}as any);
   assert.equal((await service.refresh(evidenceId,"owner-1")).status,"payment_rechecked");
   let row=(await client.query(`SELECT last_payment_reconciled_at,payment_revoked_at
     FROM wedding_square_invoice_evidence WHERE id=$1`,[evidenceId])).rows[0];
   assert.ok(row.last_payment_reconciled_at instanceof Date);
   assert.equal(row.payment_revoked_at,null);
   deny=true;
   assert.equal((await service.refresh(evidenceId,"owner-1")).status,"reconciliation_required");
   row=(await client.query(`SELECT last_payment_reconciled_at,payment_revoked_at
     FROM wedding_square_invoice_evidence WHERE id=$1`,[evidenceId])).rows[0];
   assert.equal(row.last_payment_reconciled_at,null);
   assert.equal(row.payment_revoked_at,null);
   // Concurrency regression: both workers saw NULL freshness. A slow clean
   // read MUST NOT supersede a later provider failure (NULL -> NULL update).
   deny=false;
   let notifyStarted:()=>void=()=>undefined;
   let allowReturn:()=>void=()=>undefined;
   const started=new Promise<void>(resolve=>{notifyStarted=resolve;});
   const allowed=new Promise<void>(resolve=>{allowReturn=resolve;});
   const slow=createWeddingSquareEvidenceRefresh(
     {query:(sql:string,args?:unknown[])=>client.query(sql,args)}as any,
     {inspect:async()=>{
       notifyStarted();
       await allowed;
       return{paymentId:"pay-1",noRefundsOrDisputes:true,grantsEntitlement:false,
         requiresIndependentPeriodVerification:true};
     }}as any);
   const inFlight=slow.refresh(evidenceId,"owner-1");
   await started;
   deny=true;
   assert.equal((await service.refresh(evidenceId,"owner-1")).status,"reconciliation_required");
   allowReturn();
   await assert.rejects(inFlight,WeddingSquareEvidenceRefreshError);
   const afterRace=(await client.query(`SELECT last_payment_reconciled_at,
     reconciliation_revision FROM wedding_square_invoice_evidence WHERE id=$1`,[evidenceId])).rows[0];
   assert.equal(afterRace.last_payment_reconciled_at,null,
     "older clean provider result must not overwrite later NULL invalidation");
   assert.equal(afterRace.reconciliation_revision,3,
     "each SQL update must advance revision, including NULL-to-NULL");
   await assert.rejects(service.refresh(evidenceId,"foreign"),WeddingSquareEvidenceRefreshError);
   await client.query("UPDATE wedding_square_invoice_evidence SET payment_revoked_at=now() WHERE id=$1",[evidenceId]);
   deny=false;
   assert.equal((await service.refresh(evidenceId,"owner-1")).status,"operator_review");
   row=(await client.query(`SELECT last_payment_reconciled_at FROM wedding_square_invoice_evidence WHERE id=$1`,[evidenceId])).rows[0];
   assert.equal(row.last_payment_reconciled_at,null,"revoked invoice cannot regain freshness");
 }finally{
   if(connected){
     await client.query("ROLLBACK").catch(()=>undefined);
     await client.query("SET search_path TO public").catch(()=>undefined);
     await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
     await client.end();
   }
   keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});
 }
});
