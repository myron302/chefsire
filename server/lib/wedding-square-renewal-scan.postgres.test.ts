import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import pg from "pg";
import { createWeddingSquareRenewalScan } from "./wedding-square-renewal-scan";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
test("Postgres 16: renewal scan claims confirmed owner attempts fairly, includes pending, skips paid invoice",{
 skip:!url?"Requires disposable PostgreSQL":undefined,
},async()=>{
 if(!url)throw Error("Missing local test DB");
 const parsed=new URL(url);
 if(!["localhost","127.0.0.1","::1"].includes(parsed.hostname)||
    !/test/i.test(parsed.pathname))throw Error("Refuse non-local/non-test DB");
 const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
 const schema="wedding_renewal_test_"+randomUUID().replaceAll("-","");
 const env=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
  "WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED",
  "WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED",
  "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"]as const;
 const old=env.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1"});
 let connected=false;
 try{
  await client.connect();connected=true;
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query("CREATE TABLE users(id varchar PRIMARY KEY)");
  await client.query("INSERT INTO users(id) VALUES ('owner-1'),('owner-2'),('owner-3')");
  for(const file of [
   "20261101_01_wedding_square_enrollment_attempts.sql",
   "20261101_02_wedding_square_billing_foundation.sql",
   "20261101_03_wedding_square_payment_reconciliation.sql",
   "20261101_04_wedding_square_reconciliation_revision.sql",
   "20261101_05_wedding_square_renewal_scan.sql",
  ])await client.query(readFileSync(path.join(root,"server/migrations",file),"utf8"));
  for(let n=1;n<=3;n++){
   const status=n===2?"PENDING":"ACTIVE";
   const attempt=n===3?"reserved":"confirmed";
   await client.query(`INSERT INTO wedding_square_enrollment_attempts
    (user_id,tier,consent_terms_version,consented_at,
     consented_amount_cents,consented_currency,square_location_id,
     square_plan_variation_id,square_customer_id,square_card_id,
     idempotency_key,request_fingerprint,status,provider_subscription_id)
    VALUES($1,'premium',$2,now(),2499,'USD','loc-1',
     'premium-var',$3,$4,$5,repeat('a',64),$6,$7)`,
    [`owner-${n}`,WEDDING_CONSENT_VERSION,`cust-${n}`,`card-${n}`,
     `key-${n}`,attempt,attempt==="confirmed"?`sub-${n}`:null]);
   await client.query(`INSERT INTO wedding_square_subscriptions
    (user_id,tier,square_environment,square_merchant_id,square_location_id,
     square_customer_id,square_plan_variation_id,square_subscription_id,
     billing_consent_at,billing_consent_terms_version,agreed_monthly_amount_cents,
     agreed_currency,provider_status)
    VALUES($1,'premium','sandbox','merchant-1','loc-1',$2,'premium-var',
     $3,now(),$4,2499,'USD',$5)`,
    [`owner-${n}`,`cust-${n}`,`sub-${n}`,WEDDING_CONSENT_VERSION,status]);
  }
  const calls:string[]=[];
  const worker=createWeddingSquareRenewalScan(
   {query:(sql:string,args?:unknown[])=>client.query(sql,args)} as any,
   {inspect:async(_attempt:string,user:string)=>{
    calls.push("provider:"+user);
    return{subscriptionId:user==="owner-2"?"sub-2":"sub-1",
     invoiceId:user==="owner-2"?"inv-2":"inv-1",
     paymentId:user==="owner-2"?"pay-2":"pay-1",
     grantsEntitlement:false,safeToResubmit:false,
     requiresOperatorReconciliation:true,requiresAmountAndCoverageVerification:true};
   }} as any,
   {record:async(_attempt:string,user:string)=>{
    calls.push("ledger:"+user);
    return{status:"recorded",subscriptionId:user==="owner-2"?"sub-2":"sub-1",
      invoiceId:user==="owner-2"?"inv-2":"inv-1",
      paidEntitlementGranted:false,safeToResubmit:false};
   }} as any,
  );
  assert.deepEqual(await worker.run(),{
   status:"completed",scanned:2,recorded:2,existing:0,pending:0,
  });
  assert.deepEqual([...calls].sort(),[
   "provider:owner-1","ledger:owner-1","provider:owner-2","ledger:owner-2",
  ].sort(),"UUID sort order must not affect owner selection");
  assert.equal((await worker.run()).scanned,0,"claimed records should not immediately repeat");
  const marks=(await client.query(`SELECT user_id,last_renewal_scan_at
     FROM wedding_square_subscriptions ORDER BY user_id`)).rows;
  assert.ok(marks[0].last_renewal_scan_at instanceof Date);
  assert.ok(marks[1].last_renewal_scan_at instanceof Date);
  assert.equal(marks[2].last_renewal_scan_at,null,"unconfirmed attempt never selected");

  // Force due scan, store one existing invoice. The second poll must skip
  // the already-verified invoice rather than duplicate a payment record.
  const id1=(await client.query<{id:string}>(`SELECT id FROM wedding_square_subscriptions
     WHERE user_id='owner-1'`)).rows[0].id;
  await client.query(`INSERT INTO wedding_square_invoice_evidence
   (wedding_subscription_id,square_environment,square_merchant_id,
    square_invoice_id,square_payment_id,square_subscription_id,
    verified_amount_cents,verified_currency,provider_paid_at,
    period_starts_at,period_ends_at)
   VALUES($1,'sandbox','merchant-1','inv-1','pay-1','sub-1',
    2499,'USD',now()-interval '1 day',now()-interval '1 day',
    now()+interval '12 days')`,[id1]);
  await client.query(`UPDATE wedding_square_subscriptions
    SET last_renewal_scan_at=now()-interval '2 hours' WHERE user_id='owner-1'`);
  calls.length=0;
  const res=await worker.run();
  assert.deepEqual(res,{status:"completed",scanned:1,recorded:0,existing:1,pending:0});
  assert.deepEqual(calls,["provider:owner-1"]);
 }finally{
  if(connected){
   await client.query("ROLLBACK").catch(()=>undefined);
   await client.query("SET search_path TO public").catch(()=>undefined);
   await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
   await client.end();
  }
  env.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});
 }
});
