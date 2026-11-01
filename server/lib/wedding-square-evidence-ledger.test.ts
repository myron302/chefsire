import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareEvidenceLedger,WeddingSquareEvidenceLedgerError } from "./wedding-square-evidence-ledger";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const attempt="11111111-1111-4111-8111-111111111111";
const subscriptionRow="22222222-2222-4222-8222-222222222222";
const captured=new Date(Date.now()-3_600_000).toISOString();
const end=new Date(Date.now()+10*86_400_000).toISOString();
const proof={subscriptionId:"sub-1",invoiceId:"inv-1",paymentId:"pay-1",
  verifiedAmountCents:2499,providerPaidAt:captured,periodStartsAt:captured,
  periodEndsAt:end,grantsEntitlement:false,requiresOperatorReconciliation:true,
  requiresIndependentRefundDisputeRecheck:true};
const fresh={subscriptionId:"sub-1",invoiceId:"inv-1",paymentId:"pay-1",
  verifiedAmountCents:2499,noRefundsOrDisputes:true,
  grantsEntitlement:false,requiresIndependentPeriodVerification:true};
const row={id:subscriptionRow,user_id:"owner-1",tier:"premium",
  square_merchant_id:"merchant-1",square_location_id:"loc-1",
  square_plan_variation_id:"premium-var",square_subscription_id:"sub-1",
  agreed_monthly_amount_cents:2499,agreed_currency:"USD",
  billing_consent_terms_version:WEDDING_CONSENT_VERSION,provider_status:"ACTIVE"};
async function enabled(fn:()=>Promise<void>){
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
  "WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED","WEDDING_SQUARE_SANDBOX_MERCHANT_ID",
  "SQUARE_LOCATION_ID","WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID"]as const;
 const old=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",
  SQUARE_LOCATION_ID:"loc-1",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID:"premium-var"});
 try{await fn();}finally{keys.forEach((key,i)=>{
  if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];
 });}
}
function mock(opts:{row?:unknown,period?:unknown,fresh?:unknown,
 fail?:"select"|"insert"|"update"|"commit"|"risk"|"period"}={}){
 const calls:string[]=[];
 const released:unknown[]=[];
 const db={connect:async()=>({
   query:async(sql:string,args:unknown[]=[])=>{
     const verb=sql.trim().split(/\s+/)[0].toUpperCase();
     calls.push(verb.toLowerCase());
     if(verb==="SELECT"){
       assert.match(sql,/FOR UPDATE OF s/);
       assert.deepEqual(args,[attempt,"owner-1","merchant-1","loc-1","sub-1"]);
       if(opts.fail==="select")throw Error("private Neon SELECT failure");
       return{rows:opts.row===undefined?[row]:opts.row===null?[]:[opts.row]};
     }
     if(verb==="INSERT"){
       assert.match(sql,/ON CONFLICT DO NOTHING/);
       assert.doesNotMatch(sql,/UPDATE|verified_paid_through/);
       assert.deepEqual(args,[subscriptionRow,"merchant-1","inv-1","pay-1",
         "sub-1",2499,captured,captured,end]);
       if(opts.fail==="insert")throw Error("unique invoice conflict");
       return{rows:[{id:"33333333-3333-4333-8333-333333333333"}]};
     }
     if(verb==="UPDATE"){
       assert.match(sql,/verified_paid_through=GREATEST/);
       assert.deepEqual(args,[subscriptionRow,"owner-1",end,"merchant-1","sub-1"]);
       if(opts.fail==="update")throw Error("lost connection");
       return{rows:[{id:subscriptionRow}]};
     }
     if(verb==="COMMIT"&&opts.fail==="commit")throw Error("unknown commit acknowledgement");
     return{rows:[]};
   },
   release:(error?:Error)=>{released.push(error);},
 })};
 const svc=createWeddingSquareEvidenceLedger(db as any,
   {inspect:async(a:string,b:string)=>{
     calls.push("period");
     assert.deepEqual([a,b],[attempt,"owner-1"]);
     if(opts.fail==="period")throw Error("private provider error");
     return opts.period===undefined?proof:opts.period;
   }}as any,
   {inspect:async(a:string,b:string)=>{
     calls.push("risk");
     assert.deepEqual([a,b],[attempt,"owner-1"]);
     if(opts.fail==="risk")throw Error("private DISPUTES_READ failure");
     return opts.fresh===undefined?fresh:opts.fresh;
   }}as any);
 return{svc,calls,released};
}
test("fresh provider payment + disputes verified BEFORE atomic SQL write, no entitlement",()=>enabled(async()=>{
 const x=mock();const result=await x.svc.record(attempt,"owner-1");
 assert.deepEqual(x.calls,["period","risk","begin","select","insert","update","commit"]);
 assert.deepEqual(result,{status:"recorded",subscriptionId:"sub-1",
   invoiceId:"inv-1",verifiedPaidThrough:end,
   paidEntitlementGranted:false,safeToResubmit:false});
 assert.equal(Object.isFrozen(result),true);
 assert.equal(x.released.length,1);
 assert.equal(x.released[0],undefined);
}));
test("disabled/live switch prevents every provider call or SQL write",()=>enabled(async()=>{
 for(const [name,value]of [["SQUARE_ENV","production"],
  ["WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED","false"],
  ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"]]as const){
   const old=process.env[name];process.env[name]=value;
   try{
     const x=mock();await assert.rejects(x.svc.record(attempt,"owner-1"),WeddingSquareEvidenceLedgerError);
     assert.deepEqual(x.calls,[]);
   }finally{if(old===undefined)delete process.env[name];else process.env[name]=old;}
 }
}));
test("stale/ambiguous Square evidence never starts a Neon transaction",()=>enabled(async()=>{
 for(const variants of [
  {period:{...proof,grantsEntitlement:true}},
  {period:{...proof,providerPaidAt:new Date(Date.now()+86_400_000).toISOString()}},
  {period:{...proof,periodEndsAt:new Date(Date.now()-86_400_000).toISOString()}},
  {period:{...proof,periodStartsAt:new Date(Date.now()-3600_000).toISOString().replace("Z","+00:00")}},
  {fresh:{...fresh,invoiceId:"other"}},
  {fresh:{...fresh,noRefundsOrDisputes:false}},
  {fail:"period"as const},{fail:"risk"as const},
 ]){
   const x=mock(variants);
   await assert.rejects(x.svc.record(attempt,"owner-1"),WeddingSquareEvidenceLedgerError);
   assert.ok(!x.calls.includes("begin"));
 }
}));
test("wrong tier price, consent, merchant, plan and account fail before INSERT",()=>enabled(async()=>{
 for(const changed of [
  {user_id:"foreign"},{tier:"elite"},{agreed_monthly_amount_cents:4999},
  {agreed_currency:"EUR"},{billing_consent_terms_version:"old"},
  {square_merchant_id:"other"},{square_plan_variation_id:"other"},
  {provider_status:"PENDING"}, {square_subscription_id:"other"},
 ]){
   const x=mock({row:{...row,...changed}});
   await assert.rejects(x.svc.record(attempt,"owner-1"),WeddingSquareEvidenceLedgerError);
   assert.deepEqual(x.calls,["period","risk","begin","select","rollback"]);
   assert.ok(x.released[0] instanceof Error);
 }
}));
test("insert collision, SQL outage, or uncertain COMMIT must rollback and discard connection",()=>enabled(async()=>{
 for(const fail of ["select","insert","update","commit"]as const){
   const x=mock({fail});
   await assert.rejects(x.svc.record(attempt,"owner-1"),
     e=>e instanceof WeddingSquareEvidenceLedgerError&&!/Neon|private/i.test(e.message));
   assert.ok(x.calls.includes("rollback"));
   assert.ok(x.released[0] instanceof Error);
 }
}));
