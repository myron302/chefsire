import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareBillingAudit,WeddingSquareBillingAuditError } from "./wedding-square-billing-audit";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";

const owner={attemptId:"attempt-1",status:"confirmed",providerSubscriptionId:"sub-1",
 customerId:"cust-1",locationId:"loc-1"};
const merchant={verifiedSandboxMerchantContext:true,merchantId:"merchant-1",
 locationId:"loc-1",currency:"USD",authorizesSubscriptionCreation:false,
 grantsEntitlement:false,safeToResubmit:false};
const row={user_id:"owner-1",tier:"premium",square_merchant_id:"merchant-1",
 square_customer_id:"cust-1",square_location_id:"loc-1",square_subscription_id:"sub-1",
 agreed_monthly_amount_cents:2499,agreed_currency:"USD",
 billing_consent_terms_version:WEDDING_CONSENT_VERSION,provider_status:"ACTIVE"};
const linked={invoiceId:"inv-1",paymentId:"pay-1",subscriptionId:"sub-1",
 requiresOperatorReconciliation:true,requiresAmountAndCoverageVerification:true,
 grantsEntitlement:false,safeToResubmit:false};
const checked={paymentId:"pay-1",noRefundsOrDisputes:true,
 grantsEntitlement:false,requiresIndependentPeriodVerification:true};
async function sandbox(fn:()=>Promise<void>){
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
 "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"]as const;
 const old=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1"});
 try{await fn();}finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
}
function mock(opts:{row?:unknown,owner?:unknown,merchant?:unknown,linked?:unknown,
 checked?:unknown,fail?:"db"|"linked"|"checked"|"merchant"}={}){
 const calls:string[]=[];
 const api=createWeddingSquareBillingAudit(
  {query:async(sql:string,args:unknown[])=>{
    calls.push("neon");
    assert.match(sql,/user_id=\$1/);
    assert.match(sql,/square_environment='sandbox'/);
    assert.deepEqual(args,["owner-1","merchant-1","sub-1","cust-1","loc-1"]);
    if(opts.fail==="db")throw Error("private database error");
    return {rows:opts.row===undefined?[row]:opts.row===null?[]:[opts.row]};
  }}as any,
  {inspect:async(a:string,b:string)=>{
    calls.push("linked");assert.deepEqual([a,b],["attempt-1","owner-1"]);
    if(opts.fail==="linked")throw Error("private linked error");
    return opts.linked===undefined?linked:opts.linked;
  }}as any,
  {inspect:async(a:string,b:string)=>{
    calls.push("owner");assert.deepEqual([a,b],["attempt-1","owner-1"]);
    return opts.owner===undefined?owner:opts.owner;
  }}as any,
  {inspect:async()=>{
    calls.push("merchant");
    if(opts.fail==="merchant")throw Error("private merchant");
    return opts.merchant===undefined?merchant:opts.merchant;
  }}as any,
  {inspect:async(...args:unknown[])=>{
    calls.push("risk");assert.deepEqual(args,["pay-1","cust-1","loc-1",2499]);
    if(opts.fail==="checked")throw Error("private dispute token");
    return opts.checked===undefined?checked:opts.checked;
  }}as any);
 return {api,calls};
}
test("exact saved owner and monthly consent guard read-only provider risk audit",()=>sandbox(async()=>{
 const x=mock();const r=await x.api.inspect("attempt-1","owner-1");
 assert.deepEqual(x.calls,["merchant","owner","neon","linked","risk"]);
 assert.deepEqual(r,{invoiceId:"inv-1",paymentId:"pay-1",subscriptionId:"sub-1",
   verifiedAmountCents:2499,noRefundsOrDisputes:true,
   requiresIndependentPeriodVerification:true,
   grantsEntitlement:false,safeToResubmit:false});
 assert.equal(Object.isFrozen(r),true);
}));
test("foreign user, wrong amount, old consent and unrelated merchant never check provider payment",()=>sandbox(async()=>{
 for(const changed of [
  {user_id:"other"},{tier:"elite"},{agreed_monthly_amount_cents:5000},
  {agreed_currency:"EUR"},{billing_consent_terms_version:"old"},
  {square_customer_id:"not-owner"},{square_subscription_id:"other-sub"},
  {square_merchant_id:"other-merchant"},{provider_status:"PENDING"},
 ]){
   const x=mock({row:{...row,...changed}});
   await assert.rejects(x.api.inspect("attempt-1","owner-1"),WeddingSquareBillingAuditError);
   assert.deepEqual(x.calls,["merchant","owner","neon"]);
 }
}));
test("ambiguous, pending or misbound owner and invoice fail before risk provider",()=>sandbox(async()=>{
 for(const opts of [
  {row:null}, {owner:{...owner,status:"reserved"}},
  {owner:{...owner,customerId:"different"}},
  {linked:{...linked,subscriptionId:"another"}},
  {linked:{...linked,grantsEntitlement:true}},
  {checked:{...checked,noRefundsOrDisputes:false}},
 ]){
   const x=mock(opts);
   await assert.rejects(x.api.inspect("attempt-1","owner-1"),WeddingSquareBillingAuditError);
 }
}));
test("provider/Neon errors never leak secret details or authorize billing",()=>sandbox(async()=>{
 for(const fail of ["db","linked","checked","merchant"]as const){
   const x=mock({fail});
   await assert.rejects(x.api.inspect("attempt-1","owner-1"),e=>
     e instanceof WeddingSquareBillingAuditError&&!/private|token/i.test(e.message));
 }
}));
test("live environment or disabled enrollment prevents all reads",()=>sandbox(async()=>{
 for(const [name,value]of [["SQUARE_ENV","production"],
  ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"]]as const){
    const previous=process.env[name];process.env[name]=value;
    try{const x=mock();await assert.rejects(x.api.inspect("attempt-1","owner-1"),
      WeddingSquareBillingAuditError);assert.deepEqual(x.calls,[]);}
    finally{if(previous===undefined)delete process.env[name];else process.env[name]=previous;}
 }
}));
