import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareRenewalActivation,WeddingSquareRenewalActivationError} from "./wedding-square-renewal-activation";
const attempt="11111111-1111-4111-8111-111111111111";
const id="22222222-2222-4222-8222-222222222222";
const provider={attemptId:attempt,providerSubscriptionId:"sub-1",
  providerStatus:"ACTIVE",existingIdMatches:true,
  requiresOperatorReconciliation:true,grantsEntitlement:false,safeToResubmit:false};
async function enabled(fn:()=>Promise<void>){
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
 "WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED",
 "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID",
 "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID",
 "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID"] as const;
 const prev=keys.map(x=>process.env[x]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",
  SQUARE_LOCATION_ID:"loc-1",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID:"premium-var",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID:"elite-var"});
 try{await fn();}finally{keys.forEach((k,i)=>{
  if(prev[i]===undefined)delete process.env[k];else process.env[k]=prev[i];
 });}
}
function mock(changes:{provider?:unknown,rows?:unknown[],fail?:boolean}={}){
 const calls:string[]=[];
 const db={query:async(sql:string,args:unknown[])=>{
  calls.push("UPDATE");
  assert.match(sql,/s\.provider_status='PENDING'/);
  assert.match(sql,/a\.status='confirmed'/);
  assert.match(sql,/s\.square_customer_id=a\.square_customer_id/);
  assert.match(sql,/s\.billing_consent_terms_version=a\.consent_terms_version/);
  assert.doesNotMatch(sql,/verified_paid_through\s*=/);
  assert.deepEqual(args,[attempt,"owner-1","sub-1","merchant-1","loc-1","premium-var","elite-var"]);
  if(changes.fail)throw Error("private Neon error");
  return{rows:changes.rows??[{id}]};
 }};
 const source={inspect:async(a:string,b:string)=>{
  calls.push("Square GET");
  assert.deepEqual([a,b],[attempt,"owner-1"]);
  return changes.provider??provider;
 }};
 return{svc:createWeddingSquareRenewalActivation(db as any,source as any),calls};
}
test("owner-verified provider ACTIVE advances exactly one PENDING row without granting paid access",()=>enabled(async()=>{
 const x=mock();
 assert.deepEqual(await x.svc.activate(attempt,"owner-1","sub-1"),{
  activated:true,subscriptionId:"sub-1",grantsEntitlement:false});
 assert.deepEqual(x.calls,["Square GET","UPDATE"]);
}));
test("PENDING, PAUSED, CANCELED or foreign provider identities must never mutate Neon",()=>enabled(async()=>{
 for(const invalid of [{providerStatus:"PENDING"},{providerStatus:"PAUSED"},
  {providerStatus:"CANCELED"},{providerSubscriptionId:"foreign"},
  {attemptId:"foreign"},{existingIdMatches:false},{grantsEntitlement:true},
  {safeToResubmit:true}]){
   const x=mock({provider:{...provider,...invalid}});
   await assert.rejects(x.svc.activate(attempt,"owner-1","sub-1"),WeddingSquareRenewalActivationError);
   assert.deepEqual(x.calls,["Square GET"]);
 }
}));
test("nonmatching/duplicate local rows and Neon outage require operator reconciliation",()=>enabled(async()=>{
 for(const option of [{rows:[]},{rows:[{id},{id}]},{fail:true}]){
  const x=mock(option);
  await assert.rejects(x.svc.activate(attempt,"owner-1","sub-1"),WeddingSquareRenewalActivationError);
  assert.deepEqual(x.calls,["Square GET","UPDATE"]);
 }
}));
test("production or disabled switches block even the first provider GET",()=>enabled(async()=>{
 for(const [key,value]of [["SQUARE_ENV","production"],
  ["WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED","false"],
  ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"],
  ["SQUARE_LOCATION_ID",""]]as const){
  const old=process.env[key];process.env[key]=value;
  try{
   const x=mock();await assert.rejects(x.svc.activate(attempt,"owner-1","sub-1"),WeddingSquareRenewalActivationError);
   assert.deepEqual(x.calls,[]);
  }finally{if(old===undefined)delete process.env[key];else process.env[key]=old;}
 }
}));
