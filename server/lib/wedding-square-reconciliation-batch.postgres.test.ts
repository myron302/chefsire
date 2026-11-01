import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {test} from "node:test";
import pg from "pg";
import { createWeddingSquareReconciliationBatch } from "./wedding-square-reconciliation-batch";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
test("PostgreSQL 16 batch selects only actual owner-bound, covered and stale evidence",{
 skip:!url?"Requires isolated PG16":undefined,
},async()=>{
 if(!url)throw Error("Missing PG test URL");
 const uri=new URL(url);
 if(!["localhost","127.0.0.1","::1"].includes(uri.hostname)||!/test/i.test(uri.pathname))
   throw Error("Remote or non-test DB is forbidden");
 const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
 const schema="wedding_batch_test_"+randomUUID().replaceAll("-","");
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
   "WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED",
   "WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED",
   "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"]as const;
 const old=keys.map(k=>process.env[k]);
 Object.assign(process.env,{
   SQUARE_ENV:"sandbox",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1",
 });
 let connected=false;
 try{
  await client.connect();connected=true;
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query("CREATE TABLE users(id varchar PRIMARY KEY)");
  await client.query("INSERT INTO users(id) VALUES('owner-1'),('owner-2')");
  for(const file of [
    "20261101_01_wedding_square_enrollment_attempts.sql",
    "20261101_02_wedding_square_billing_foundation.sql",
    "20261101_03_wedding_square_payment_reconciliation.sql",
    "20261101_04_wedding_square_reconciliation_revision.sql",
  ]) await client.query(readFileSync(path.join(root,"server/migrations",file),"utf8"));
  const ids:string[]=[];
  for(let i=1;i<=2;i++){
    const sub=(await client.query<{id:string}>(`INSERT INTO wedding_square_subscriptions
      (user_id,tier,square_environment,square_merchant_id,square_location_id,
       square_customer_id,square_plan_variation_id,square_subscription_id,
       billing_consent_at,billing_consent_terms_version,agreed_monthly_amount_cents,
       agreed_currency,provider_status,verified_paid_through)
      VALUES($1,'premium','sandbox','merchant-1','loc-1',$2,
        'premium-var',$3,now(),$4,2499,'USD','ACTIVE',
        now()+interval '14 days') RETURNING id`,
      [`owner-${i}`,`cust-${i}`,`sub-${i}`,WEDDING_CONSENT_VERSION])).rows[0];
    const evid=(await client.query<{id:string}>(`INSERT INTO wedding_square_invoice_evidence
      (wedding_subscription_id,square_environment,square_merchant_id,
       square_invoice_id,square_payment_id,square_subscription_id,
       verified_amount_cents,verified_currency,provider_paid_at,
       period_starts_at,period_ends_at,last_payment_reconciled_at)
      VALUES($1,'sandbox','merchant-1',$2,$3,$4,2499,'USD',
        now()-interval '1 day',now()-interval '1 day',
        now()+interval '12 days',$5::timestamptz) RETURNING id`,
      [sub.id,`inv-${i}`,`pay-${i}`,`sub-${i}`,
       i===1?null:new Date().toISOString()])).rows[0];
    ids.push(evid.id);
  }
  const calls:string[]=[];
  const batch=createWeddingSquareReconciliationBatch(
    {query:(sql:string,args?:unknown[])=>client.query(sql,args)}as any,
    {refresh:async(evidenceId:string,ownerId:string)=>{
      calls.push(evidenceId+":"+ownerId);
      return{status:"payment_rechecked"};
    }}as any);
  assert.deepEqual(await batch.run(),{status:"completed",scanned:1,checked:1,failed:0});
  assert.deepEqual(calls,[ids[0]+":owner-1"]);
  await client.query("UPDATE wedding_square_invoice_evidence SET payment_revoked_at=now() WHERE id=$1",[ids[0]]);
  calls.length=0;
  assert.equal((await batch.run()).scanned,0,"revoked evidence is never refreshed");
 }finally{
  if(connected){
    await client.query("SET search_path TO public").catch(()=>undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
    await client.end();
  }
  keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});
 }
});
