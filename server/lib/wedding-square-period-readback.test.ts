import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquarePeriodReadback,WeddingSquarePeriodReadbackError } from "./wedding-square-period-readback";
const iso=(ms:number)=>new Date(ms).toISOString();
const day=(ms:number)=>iso(ms).slice(0,10);
const now=Date.now();
const DAY=86_400_000;
const start=day(now-2*DAY);
const through=day(now+18*DAY);
const created=iso(now-25*60*60*1000);
const paid=iso(now-2*60*60*1000);
const issued=iso(now-10*60*60*1000);
const owner={attemptId:"attempt-1",status:"confirmed",
  providerSubscriptionId:"sub-1",customerId:"customer-1",
  locationId:"loc-1",planVariationId:"plan-1"};
const proof={subscriptionId:"sub-1",invoiceId:"inv-1",paymentId:"pay-1",
  verifiedAmountCents:2499,noRefundsOrDisputes:true,
  grantsEntitlement:false,requiresIndependentPeriodVerification:true};
const sub={subscription:{id:"sub-1",customer_id:"customer-1",location_id:"loc-1",
  plan_variation_id:"plan-1",start_date:start,
  charged_through_date:through,status:"ACTIVE",
  invoice_ids:["inv-1","inv-older"]}};
const invoice={invoice:{id:"inv-1",subscription_id:"sub-1",order_id:"order-1",
  location_id:"loc-1",status:"PAID",created_at:issued,
  primary_recipient:{customer_id:"customer-1"}}};
const payment={payment:{id:"pay-1",order_id:"order-1",location_id:"loc-1",
  customer_id:"customer-1",status:"COMPLETED",created_at:created,
  source_type:"CARD",
  card_details:{status:"CAPTURED",card_payment_timeline:{captured_at:paid}},
  amount_money:{amount:2499,currency:"USD"},
  total_money:{amount:2499,currency:"USD"},
  refunded_money:{amount:0,currency:"USD"},refund_ids:[]}};
async function sandbox(fn:()=>Promise<void>){
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED"]as const;
 const old=keys.map(k=>process.env[k]);
 process.env.SQUARE_ENV="sandbox";
 process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED="true";
 try{await fn();}finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
}
function mock(changes:{sub?:unknown,invoice?:unknown,payment?:unknown,owner?:unknown,proof?:unknown}={}){
 const calls:string[]=[];
 const service=createWeddingSquarePeriodReadback(
   {inspect:async(id:string,user:string)=>{
     calls.push("audit");assert.deepEqual([id,user],["attempt-1","owner-1"]);
     return changes.proof??proof;
   }}as any,
   {inspect:async(id:string,user:string)=>{
     calls.push("owner");assert.deepEqual([id,user],["attempt-1","owner-1"]);
     return changes.owner??owner;
   }}as any,
   async(type,key)=>{
     calls.push(type+":"+key);
     if(type==="subscriptions"){assert.equal(key,"sub-1");return changes.sub??sub;}
     if(type==="invoices"){assert.equal(key,"inv-1");return changes.invoice??invoice;}
     assert.equal(key,"pay-1");return changes.payment??payment;
   });
 return {service,calls};
}
test("strict latest paid invoice bounds coverage conservatively to payment and charged-through UTC date",()=>sandbox(async()=>{
 const x=mock();
 const actual=await x.service.inspect("attempt-1","owner-1");
 assert.deepEqual(x.calls,["audit","owner","subscriptions:sub-1","invoices:inv-1","payments:pay-1"]);
 assert.deepEqual(actual,{
   subscriptionId:"sub-1",invoiceId:"inv-1",paymentId:"pay-1",verifiedAmountCents:2499,
   providerPaidAt:paid,periodStartsAt:paid,
   periodEndsAt:iso(Date.parse(through+"T00:00:00.000Z")+DAY),
   grantsEntitlement:false,requiresOperatorReconciliation:true,
   requiresIndependentRefundDisputeRecheck:true,
 });
 assert.equal(Object.isFrozen(actual),true);
}));
test("unpaid/foreign invoice, wrong newest invoice or customer, malformed 2xx fail shut",()=>sandbox(async()=>{
 for(const changed of [
  {sub:{subscription:{...sub.subscription,invoice_ids:["inv-older","inv-1"]}}},
  {sub:{subscription:{...sub.subscription,customer_id:"foreign"}}},
  {sub:{...sub,errors:null}},
  {invoice:{invoice:{...invoice.invoice,status:"UNPAID"}}},
  {invoice:{invoice:{...invoice.invoice,primary_recipient:{customer_id:"foreign"}}}},
  {invoice:{...invoice,errors:[{code:"INVALID"}]}},
  {payment:{payment:{...payment.payment,status:"FAILED"}}},
  {payment:{...payment,errors:null}},
  {payment:{payment:{...payment.payment,order_id:"foreign"}}},
  {payment:{payment:{...payment.payment,total_money:{amount:2600,currency:"USD"}}}},
  {payment:{payment:{...payment.payment,refund_ids:["refund-1"]}}},
 ]){
   const x=mock(changed);
   await assert.rejects(x.service.inspect("attempt-1","owner-1"),WeddingSquarePeriodReadbackError);
 }
}));
test("invoiced period is NOT paid proof when settlement date is future, before invoice or coverage ends",()=>sandbox(async()=>{
 for(const changed of [
  {payment:{payment:{...payment.payment,card_details:{status:"CAPTURED",card_payment_timeline:{captured_at:iso(now+DAY)}}}}},
  {payment:{payment:{...payment.payment,card_details:{status:"CAPTURED",card_payment_timeline:{captured_at:iso(now-3*DAY)}}}}},
  {payment:{payment:{...payment.payment,created_at:iso(now+DAY)}}},
  {payment:{payment:{...payment.payment,card_details:undefined}}},
  {payment:{payment:{...payment.payment,card_details:{status:"AUTHORIZED",card_payment_timeline:{captured_at:paid}}}}},
  {sub:{subscription:{...sub.subscription,charged_through_date:day(now-DAY)}}},
  {sub:{subscription:{...sub.subscription,charged_through_date:day(now+60*DAY)}}},
  {sub:{subscription:{...sub.subscription,charged_through_date:"2026-99-99"}}},
  {invoice:{invoice:{...invoice.invoice,created_at:iso(now+DAY)}}},
 ]){
   const x=mock(changed);
   await assert.rejects(x.service.inspect("attempt-1","owner-1"),WeddingSquarePeriodReadbackError);
 }
}));
test("no clean risk audit or verified owner means zero Square period requests",()=>sandbox(async()=>{
 for(const changed of [
   {proof:{...proof,noRefundsOrDisputes:false}},
   {proof:{...proof,grantsEntitlement:true}},
   {proof:{...proof,subscriptionId:"another"}},
   {owner:{...owner,status:"reserved"}},
 ]){
   const x=mock(changed);
   await assert.rejects(x.service.inspect("attempt-1","owner-1"),WeddingSquarePeriodReadbackError);
   assert.ok(!x.calls.some(s=>s.startsWith("subscriptions")));
 }
 // A forged customer in otherwise valid owner data requires the independent
 // provider GET to detect and reject; it cannot be rejected pre-network.
 const foreign=mock({owner:{...owner,customerId:"another"}});
 await assert.rejects(foreign.service.inspect("attempt-1","owner-1"),WeddingSquarePeriodReadbackError);
 assert.deepEqual(foreign.calls,["audit","owner","subscriptions:sub-1"]);
}));
test("production/disabled states never read provider or owner records",()=>sandbox(async()=>{
 for(const [key,value]of [["SQUARE_ENV","production"],
   ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"]]as const){
   const old=process.env[key];process.env[key]=value;
   try{
     const x=mock();
     await assert.rejects(x.service.inspect("attempt-1","owner-1"),WeddingSquarePeriodReadbackError);
     assert.deepEqual(x.calls,[]);
   }finally{if(old===undefined)delete process.env[key];else process.env[key]=old;}
 }
}));
