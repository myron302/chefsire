import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {test} from "node:test";
import pg from "pg";
import {createWeddingSquareLegacyCancelGuard,WeddingSquareLegacyCancellationBlocked} from "./wedding-square-legacy-cancel-guard";
const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
test("PostgreSQL 16: local trial cancel fails closed on owner unfinished Square enrollment, reopens after verified terminal cancellation",{
 skip:!url?"Requires disposable PostgreSQL 16":undefined,
},async()=>{
 if(!url)throw Error("Missing isolated test DB");
 const u=new URL(url);
 if(!["localhost","127.0.0.1","::1"].includes(u.hostname)||!/test/i.test(u.pathname))
  throw Error("Never test against remote/production database");
 const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
 const schema="wedding_cancel_guard_"+randomUUID().replaceAll("-","");
 let connected=false;
 try{
  await client.connect();connected=true;
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query("CREATE TABLE users(id varchar PRIMARY KEY)");
  await client.query("INSERT INTO users(id) VALUES ('owner-1'),('other-user')");
  for(const file of ["20261101_01_wedding_square_enrollment_attempts.sql",
   "20261101_02_wedding_square_billing_foundation.sql",
   "20261101_03_wedding_square_payment_reconciliation.sql",
   "20261101_04_wedding_square_reconciliation_revision.sql",
   "20261101_05_wedding_square_renewal_scan.sql"]){
    await client.query(readFileSync(path.join(root,"server/migrations",file),"utf8"));
  }
  const guard=createWeddingSquareLegacyCancelGuard({
    query:(sql:string,args?:unknown[])=>client.query(sql,args),
  }as any);
  const safe=()=>guard.assertCardlessOnly("owner-1");
  assert.equal((await safe()).legacyCancellationSafe,true);
  await client.query(`INSERT INTO wedding_square_enrollment_attempts
   (user_id,tier,consent_terms_version,consented_at,consented_amount_cents,
    consented_currency,square_location_id,square_plan_variation_id,
    square_customer_id,square_card_id,idempotency_key,request_fingerprint,status)
   VALUES('owner-1','premium','wedding-monthly-autorenew-v1',
    now(),2499,'USD','loc-1','plan-1','cust-1','card-1',
    'once-1',repeat('a',64),'reserved')`);
  await assert.rejects(safe(),WeddingSquareLegacyCancellationBlocked);
  await client.query(`UPDATE wedding_square_enrollment_attempts
   SET status='needs_reconciliation',provider_subscription_id='sub-1'
   WHERE user_id='owner-1'`);
  await assert.rejects(safe(),WeddingSquareLegacyCancellationBlocked);
  await client.query(`UPDATE wedding_square_enrollment_attempts
    SET status='confirmed' WHERE user_id='owner-1'`);
  await assert.rejects(safe(),WeddingSquareLegacyCancellationBlocked,
    "confirmed but missing subscription row cannot imply no subscription");
  await client.query(`INSERT INTO wedding_square_subscriptions
    (user_id,tier,square_environment,square_merchant_id,
     square_location_id,square_customer_id,square_plan_variation_id,
     square_subscription_id,square_card_id,billing_consent_at,
     billing_consent_terms_version,agreed_monthly_amount_cents,
     agreed_currency,provider_status)
    VALUES('owner-1','premium','sandbox','merchant-1','loc-1',
     'cust-1','plan-1','sub-1','card-1',now(),
     'wedding-monthly-autorenew-v1',2499,'USD','ACTIVE')`);
  await assert.rejects(safe(),WeddingSquareLegacyCancellationBlocked);
  await client.query(`UPDATE wedding_square_subscriptions
    SET provider_status='CANCELED',cancellation_requested_at=now()
    WHERE user_id='owner-1'`);
  await assert.rejects(safe(),WeddingSquareLegacyCancellationBlocked,
    "unacknowledged cancellation request cannot be assumed final");
  await client.query(`UPDATE wedding_square_subscriptions
    SET provider_cancelled_at=now() WHERE user_id='owner-1'`);
  assert.equal((await safe()).legacyCancellationSafe,true);
  assert.equal((await guard.assertCardlessOnly("other-user")).legacyCancellationSafe,true);
 }finally{
  if(connected){
   await client.query("SET search_path TO public").catch(()=>undefined);
   await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
   await client.end();
  }
 }
});
