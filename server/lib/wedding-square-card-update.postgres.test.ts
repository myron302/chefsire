import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import pg from "pg";
import { createWeddingSquareCardUpdate } from "./wedding-square-card-update";
import {createWeddingSquareReconciliationReadback} from "./wedding-square-reconciliation-readback";
import {createWeddingSquareSandboxCancellation} from "./wedding-square-sandbox-cancellation";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const evidenceId="11111111-1111-4111-8111-111111111111";
test("PostgreSQL 16: existing card update survives lost PUT response without another provider write",{
 timeout:30000,
 skip:!url?"Requires disposable PostgreSQL 16":undefined,
},async()=>{
 if(!url)throw Error("Missing disposable DB URL");
 const u=new URL(url);
 if(!["localhost","127.0.0.1","::1"].includes(u.hostname)||!/test/i.test(u.pathname))
   throw Error("Remote or non-test DB prohibited");
 const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
 const schema="wedding_refresh_test_"+randomUUID().replaceAll("-","");
 const keys=["SQUARE_ENV","SQUARE_LIVE_PAYMENTS_ENABLED","WEDDING_SQUARE_SANDBOX_CARD_UPDATE_ENABLED","WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
   "WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED",
   "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"]as const;
 const before=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",WEDDING_SQUARE_SANDBOX_CARD_UPDATE_ENABLED:"true",WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED:"true",
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
     "20261102_05_wedding_square_card_updates.sql"]){
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
   await client.query("UPDATE wedding_square_subscriptions SET square_card_id='old-card'");
   const enrollment=(await client.query(`INSERT INTO wedding_square_enrollment_attempts
     (user_id,tier,consent_terms_version,consented_at,consented_amount_cents,consented_currency,
      square_location_id,square_plan_variation_id,square_customer_id,square_card_id,idempotency_key,request_fingerprint,
      status,provider_subscription_id)
     VALUES('owner-1','premium',$1,now(),2499,'USD','loc-1','premium-var','cust-1','old-card','original-key',repeat('a',64),
       'confirmed','sub-1') RETURNING id`,[WEDDING_CONSENT_VERSION])).rows[0];
   const db={query:(sql:string,args?:unknown[])=>client.query(sql,args),
    connect:async()=>({query:(sql:string,args?:unknown[])=>client.query(sql,args),release:()=>undefined})} as any;
   let current='old-card',puts=0,cards=0;
   const get=async()=>({id:'sub-1',customerId:'cust-1',locationId:'loc-1',planVariationId:'premium-var',
     cardId:current,version:current==='old-card'?3:4,status:'ACTIVE'});
   const service=createWeddingSquareCardUpdate(db,{inspect:async()=>({verifiedSandboxMerchantContext:true,
     merchantId:'merchant-1',locationId:'loc-1',grantsEntitlement:false})} as any,
     {getCustomer:async()=>({id:'cust-1',referenceId:'owner-1'}),getCard:async()=>({id:'replacement',customerId:'cust-1',merchantId:'merchant-1',enabled:true})},
     {createCard:async()=>{cards++;return {id:'replacement',customerId:'cust-1',merchantId:'merchant-1',enabled:true};}},
     {get,update:async()=>{puts++;current='replacement';throw Error('lost response after provider commit');}} as any);
   await assert.rejects(service.update('owner-1','cnon:single-use','buyer-verification'));
   assert.equal((await client.query("SELECT status FROM wedding_square_card_updates")).rows[0].status,'needs_reconciliation');
   assert.equal((await service.reconcile('owner-1')).status,'payment_method_updated');
   assert.equal((await service.reconcile('owner-1')).status,'payment_method_updated','lost success response can be checked repeatedly by GET');
   assert.equal(cards,1);assert.equal(puts,1);
   const snapshot=(await client.query("SELECT square_card_id,verified_paid_through FROM wedding_square_subscriptions")).rows[0];
   assert.equal(snapshot.square_card_id,'replacement');
   const saved=await createWeddingSquareReconciliationReadback(db).inspect(enrollment.id,'owner-1');
   assert.equal(saved.cardId,'old-card');assert.equal(saved.currentCardId,'replacement');assert.equal(saved.persistedRequestFingerprint,'a'.repeat(64));
   await assert.rejects(service.update('owner-1','cnon:single-use','buyer-verification'));
   assert.equal(cards,1,'nonce digest uniqueness blocks another provider card creation');assert.equal(puts,1);
   assert.equal((await client.query("SELECT count(*)::int AS n FROM wedding_square_subscriptions")).rows[0].n,1);
   // Two real connections: a durable replacement intent excludes a racing
   // cancellation before either can leave conflicting provider identities.
   const second=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
   const cancelFlag=process.env.WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED;
   const planFlag=process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID;
   Object.assign(process.env,{WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED:'true',WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID:'premium-var'});
   await second.connect();
   try{
    await second.query(`SET search_path TO "${schema}"`);
    const cancelDb={query:(sql:string,args?:unknown[])=>second.query(sql,args),
      connect:async()=>({query:(sql:string,args?:unknown[])=>second.query(sql,args),release:()=>undefined})} as any;
    const merchant={inspect:async()=>({verifiedSandboxMerchantContext:true,merchantId:'merchant-1',locationId:'loc-1',
      currency:'USD',grantsEntitlement:false,authorizesSubscriptionCreation:false,safeToResubmit:false})} as any;
    let cardStarted!:()=>void,releaseCard!:()=>void;
    const atCard=new Promise<void>(resolve=>{cardStarted=resolve;});
    const allowCard=new Promise<void>(resolve=>{releaseCard=resolve;});
    let version=4;
    const currentSubscription=async()=>({id:'sub-1',customerId:'cust-1',locationId:'loc-1',planVariationId:'premium-var',
      cardId:current,version,status:'ACTIVE'});
    const replacement=createWeddingSquareCardUpdate(db,merchant,
      {getCustomer:async()=>({id:'cust-1',referenceId:'owner-1'}),getCard:async()=>({id:'replacement-2',customerId:'cust-1',merchantId:'merchant-1',enabled:true})},
      {createCard:async()=>{cardStarted();await allowCard;return {id:'replacement-2',customerId:'cust-1',merchantId:'merchant-1',enabled:true};}},
      {get:currentSubscription,update:async(_s:string,card:string)=>{current=card;version++;return currentSubscription();}} as any);
    let cancelPosts=0;
    const cancellation=createWeddingSquareSandboxCancellation(cancelDb,merchant,{get:async()=>({...await currentSubscription(),
      providerStatus:'ACTIVE',canceledDate:null}),cancel:async()=>{cancelPosts++;return {...await currentSubscription(),providerStatus:'ACTIVE',canceledDate:'2026-12-01'};}} as any);
    const updating=replacement.update('owner-1','cnon:racing-replacement','buyer-verification');
    await atCard;
    await assert.rejects(cancellation.cancel('owner-1'));
    assert.equal(cancelPosts,0,'pending card intent blocks cancellation POST');
    assert.equal((await second.query('SELECT cancellation_requested_at FROM wedding_square_subscriptions')).rows[0].cancellation_requested_at,null);
    releaseCard();assert.equal((await updating).status,'payment_method_updated');
    // Reverse ordering: cancellation's committed claim prevents replacement
    // from creating a card while cancellation waits on Square.
    let atCancel!:()=>void,releaseCancel!:()=>void;
    const cancelStarted=new Promise<void>(resolve=>{atCancel=resolve;});
    const allowCancel=new Promise<void>(resolve=>{releaseCancel=resolve;});
    const cancelFirst=createWeddingSquareSandboxCancellation(cancelDb,merchant,{get:async()=>({...await currentSubscription(),providerStatus:'ACTIVE',canceledDate:null}),
      cancel:async()=>{atCancel();await allowCancel;return {...await currentSubscription(),providerStatus:'ACTIVE',canceledDate:'2026-12-01'};}} as any);
    const canceling=cancelFirst.cancel('owner-1');await cancelStarted;
    await assert.rejects(replacement.update('owner-1','cnon:must-not-post','buyer-verification'));
    releaseCancel();assert.equal((await canceling).cancellationScheduled,true);
   }finally{
    await second.end();
    if(cancelFlag===undefined)delete process.env.WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED;else process.env.WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED=cancelFlag;
    if(planFlag===undefined)delete process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID;else process.env.WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID=planFlag;
   }
 }finally{
   if(connected){
     await client.query("SET search_path TO public").catch(()=>undefined);
     await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
     await client.end();
   }
   keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});
 }
});
