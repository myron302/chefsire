import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareCardUpdate} from "./wedding-square-card-update";
import {WEDDING_CONSENT_VERSION} from "./wedding-square-billing-policy";
const row={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",user_id:"owner",tier:"premium",square_customer_id:"cust",square_card_id:"old-card",
 square_subscription_id:"sub",square_plan_variation_id:"plan",agreed_monthly_amount_cents:2499,agreed_currency:"USD",billing_consent_terms_version:WEDDING_CONSENT_VERSION};
const attemptId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
async function enabled(fn:()=>Promise<void>){const vars={SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",
 WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",WEDDING_SQUARE_SANDBOX_CARD_UPDATE_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED:"true",WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant",SQUARE_LOCATION_ID:"loc"};
 const old={...process.env};Object.assign(process.env,vars);try{await fn();}finally{for(const k of Object.keys(vars))if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
function fixture({losePut=false,foreignCard=false}={}){
 let current="old-card",cardPosts=0,puts=0,reserved=false,pending=false;
 const queries:{sql:string,args:unknown[]}[]=[];
 const db={query:async(sql:string,args:unknown[]=[])=>{queries.push({sql,args});
  if(sql.startsWith("SELECT id::text AS id,user_id"))return {rows:[row]};
  if(sql.startsWith("INSERT INTO")){if(reserved)throw Error("unresolved unique");reserved=true;return {rows:[{id:attemptId}]};}
  if(sql.startsWith("SELECT id::text AS id,replacement_card_id"))return {rows:pending?[{id:attemptId,replacement_card_id:"new-card",expected_provider_version:3,previous_card_id:"old-card",status:"needs_reconciliation"}]:[]};
  if(sql.includes("SET status='needs_reconciliation'"))pending=true;
  return {rows:[{id:attemptId}]};
 }};
 (db as any).connect=async()=>({query:async(sql:string,args:unknown[]=[])=>
   /^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT pg_advisory)/.test(sql)?{rows:[]}:db.query(sql,args),release:()=>undefined});
 const provider={get:async()=>({id:"sub",customerId:"cust",locationId:"loc",planVariationId:"plan",cardId:current,version:current==="old-card"?3:4,status:"ACTIVE"}),
  update:async()=>{puts++;current="new-card";if(losePut)throw Error("timeout after commit");return provider.get();}};
 const svc=createWeddingSquareCardUpdate(db as any,{inspect:async()=>({verifiedSandboxMerchantContext:true,merchantId:"merchant",locationId:"loc",grantsEntitlement:false})} as any,
  {getCustomer:async()=>({id:"cust",referenceId:"owner"}),getCard:async()=>({id:"new-card",customerId:foreignCard?"foreign":"cust",merchantId:"merchant",enabled:true})},
  {createCard:async()=>{cardPosts++;return {id:"new-card",customerId:"cust",merchantId:"merchant",enabled:true};}},provider as any);
 return {svc,queries,counts:()=>({cardPosts,puts})};
}
test("persist owner intent before one card POST and one versioned PUT; no nonce persisted or paid grant",()=>enabled(async()=>{
 const f=fixture();assert.deepEqual(await f.svc.update("owner","cnon:nonce-secret","verification-secret"),{status:"payment_method_updated",paidEntitlementChanged:false,subscriptionCreated:false});
 assert.deepEqual(f.counts(),{cardPosts:1,puts:1});assert.match(f.queries[1].sql,/INSERT INTO wedding_square_card_updates/);
 assert.doesNotMatch(JSON.stringify(f.queries),/nonce-secret|verification-secret/);
 assert.match(f.queries.at(-1)!.sql,/WITH changed AS/);assert.doesNotMatch(f.queries.at(-1)!.sql,/verified_paid_through|request_fingerprint/);
}));
test("lost PUT response is recovered only by provider GET, without another card or PUT",()=>enabled(async()=>{
 const f=fixture({losePut:true});await assert.rejects(f.svc.update("owner","cnon:once","verification"));
 assert.equal((await f.svc.reconcile("owner")).status,"payment_method_updated");
 assert.deepEqual(f.counts(),{cardPosts:1,puts:1});
}));
test("foreign replacement card fails before subscription PUT and remains unresolved",()=>enabled(async()=>{
 const f=fixture({foreignCard:true});await assert.rejects(f.svc.update("owner","cnon:once","verification"));
 assert.deepEqual(f.counts(),{cardPosts:1,puts:0});assert.match(f.queries.at(-1)!.sql,/needs_reconciliation/);
}));
test("unverified owner and invalid source fail before a card POST",()=>enabled(async()=>{
 const f=fixture();await assert.rejects(f.svc.update("foreign","cnon:once","verification"));
 await assert.rejects(f.svc.update("owner","raw-card-number","verification"));assert.deepEqual(f.counts(),{cardPosts:0,puts:0});
 process.env.SQUARE_ENV="production";await assert.rejects(f.svc.update("owner","cnon:once","verification"));assert.deepEqual(f.counts(),{cardPosts:0,puts:0});
}));
