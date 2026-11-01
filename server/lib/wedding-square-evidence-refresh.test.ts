import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareEvidenceRefresh,WeddingSquareEvidenceRefreshError } from "./wedding-square-evidence-refresh";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const id="11111111-1111-4111-8111-111111111111";
const last=new Date(Date.now()-3600_000);
const row={
  id,user_id:"owner-1",tier:"premium",square_invoice_id:"inv-1",
  square_payment_id:"pay-1",square_subscription_id:"sub-1",square_merchant_id:"merchant-1",
  square_customer_id:"customer-1",square_location_id:"loc-1",agreed_monthly_amount_cents:2499,
  agreed_currency:"USD",billing_consent_terms_version:WEDDING_CONSENT_VERSION,
  verified_amount_cents:2499,last_payment_reconciled_at:last,
  reconciliation_revision:7,
  payment_revoked_at:null,provider_status:"ACTIVE",
};
const clean={paymentId:"pay-1",noRefundsOrDisputes:true,
  grantsEntitlement:false,requiresIndependentPeriodVerification:true};
async function enabled(fn:()=>Promise<void>){
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
   "WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED",
   "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"]as const;
 const old=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",
   WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1"});
 try{await fn();}finally{keys.forEach((key,i)=>{
   if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];
 });}
}
function mock(options:{row?:unknown,result?:unknown,fail?:"db"|"provider"|"update",
 conflict?:boolean}={}){
 const calls:string[]=[];let sqlUpdate="";
 const db={query:async(sql:string,params:unknown[])=>{
   if(sql.trim().startsWith("SELECT")){
     calls.push("select");
     assert.deepEqual(params,[id,"owner-1","merchant-1","loc-1"]);
     if(options.fail==="db")throw Error("private DB credential");
     return{rows:options.row===undefined?[row]:options.row===null?[]:[options.row]};
   }
   calls.push("update");
   sqlUpdate=sql;
   if(options.fail==="update")throw Error("private DB outage");
   if(sql.includes("e.reconciliation_revision=$5"))assert.deepEqual(params,
     [id,"owner-1","merchant-1","pay-1",7]);
   else assert.deepEqual(params,[id,"owner-1","merchant-1","pay-1"]);
   return{rows:options.conflict?[]:[{id}]};
 }};
 const provider={inspect:async(payment:string,customer:string,location:string,amount:number)=>{
   calls.push("provider");
   assert.deepEqual([payment,customer,location,amount],["pay-1","customer-1","loc-1",2499]);
   if(options.fail==="provider")throw Error("private DISPUTES_READ outage");
   return options.result===undefined?clean:options.result;
 }};
 return{service:createWeddingSquareEvidenceRefresh(db as any,provider as any),
   calls,getUpdate:()=>sqlUpdate};
}
test("refreshes only exact owner/payment with complete fresh provider check",()=>enabled(async()=>{
 const x=mock();const result=await x.service.refresh(id,"owner-1");
 assert.deepEqual(x.calls,["select","provider","update"]);
 assert.match(x.getUpdate(),/payment_revoked_at IS NULL/);
 assert.match(x.getUpdate(),/reconciliation_revision=\\$5/);
 assert.deepEqual(result,{status:"payment_rechecked",grantsEntitlement:false,paidThroughChanged:false});
 assert.equal(Object.isFrozen(result),true);
}));
test("provider refund/dispute/error clears freshness rather than extending paid access",()=>enabled(async()=>{
 for(const options of [{fail:"provider"as const},
  {result:{...clean,noRefundsOrDisputes:false}},
  {result:{...clean,paymentId:"foreign"}},
  {result:{...clean,grantsEntitlement:true}},
 ]){
   const x=mock(options);
   assert.deepEqual(await x.service.refresh(id,"owner-1"),
     {status:"reconciliation_required",grantsEntitlement:false});
   assert.deepEqual(x.calls,["select","provider","update"]);
   assert.match(x.getUpdate(),/SET last_payment_reconciled_at=NULL/);
   assert.doesNotMatch(x.getUpdate(),/verified_paid_through=/);
 }
}));
test("wrong saved owner, amount, currency and merchant never call provider",()=>enabled(async()=>{
 for(const changed of [
   {user_id:"another"},{tier:"elite"},{agreed_monthly_amount_cents:5000},
   {verified_amount_cents:4999},{agreed_currency:"EUR"},
   {billing_consent_terms_version:"old"},{square_merchant_id:"another"},
   {provider_status:"PENDING"},{square_payment_id:"bad id"},
 ]){
   const x=mock({row:{...row,...changed}});
   await assert.rejects(x.service.refresh(id,"owner-1"),WeddingSquareEvidenceRefreshError);
   assert.deepEqual(x.calls,["select"]);
 }
}));
test("revoked payment is permanently blocked without new provider check",()=>enabled(async()=>{
 const x=mock({row:{...row,payment_revoked_at:new Date()}});
 assert.deepEqual(await x.service.refresh(id,"owner-1"),
   {status:"operator_review",grantsEntitlement:false});
 assert.deepEqual(x.calls,["select"]);
}));
test("an ambiguous concurrent update or DB outage cannot report fresh proof",()=>enabled(async()=>{
 for(const options of [{conflict:true},{fail:"update"as const},{fail:"db"as const}]){
   const x=mock(options);
   await assert.rejects(x.service.refresh(id,"owner-1"),e=>
     e instanceof WeddingSquareEvidenceRefreshError&&!/private|credential/i.test(e.message));
 }
}));
test("disabled switch, production env and malformed owner cause no SQL or provider reads",()=>enabled(async()=>{
 for(const [key,value]of [["SQUARE_ENV","production"],
   ["WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED","false"]]as const){
   const before=process.env[key];process.env[key]=value;
   try{
     const x=mock();await assert.rejects(x.service.refresh(id,"owner-1"),
       WeddingSquareEvidenceRefreshError);
     assert.deepEqual(x.calls,[]);
   }finally{if(before===undefined)delete process.env[key];else process.env[key]=before;}
 }
 const x=mock();await assert.rejects(x.service.refresh("not-a-uuid","owner-1"),
   WeddingSquareEvidenceRefreshError);
 assert.deepEqual(x.calls,[]);
}));
