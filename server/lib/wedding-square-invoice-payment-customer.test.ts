import assert from "node:assert/strict";
import { test } from "node:test";
import { readWeddingSquareInvoicePaymentCustomer as owner } from "./wedding-square-invoice-payment-customer";
import { createWeddingSquareSandboxPaymentRiskApi } from "./wedding-square-sandbox-payment-risk-api";
import { createWeddingSquareRefundReadback } from "./wedding-square-refund-readback";
import { createWeddingSquareDisputeReadback } from "./wedding-square-dispute-readback";

const payment={id:"pay",order_id:"order",location_id:"loc",status:"COMPLETED",
  amount_money:{amount:2499,currency:"USD"},total_money:{amount:2499,currency:"USD"}};
const invoice={id:"inv",order_id:"order",location_id:"loc",subscription_id:"sub",primary_recipient:{customer_id:"customer"}};
const order={id:"order",location_id:"loc",state:"COMPLETED",tenders:[{id:"pay",type:"CARD"}]};
const subscription={id:"sub",location_id:"loc",customer_id:"customer",invoice_ids:["inv"]};
const refund={id:"refund",payment_id:"pay",location_id:"loc",status:"COMPLETED",amount_money:{amount:100,currency:"USD"}};
const dispute={id:"dispute",location_id:"loc",amount_money:{amount:100,currency:"USD"},disputed_payment:{payment_id:"pay"}};
const body=(data:unknown)=>new Response(JSON.stringify(data));
function fixture(changes:Record<string,unknown>={}, calls:string[]=[]){
 return async(url:string,init:RequestInit)=>{
  const u=new URL(url);calls.push(u.pathname+u.search);
  assert.equal(u.origin,"https://connect.squareupsandbox.com");assert.equal(init.method,"GET");assert.equal(init.redirect,"error");
  assert.equal((init.headers as Record<string,string>)["Square-Version"],"2025-10-16");
  const key=u.pathname.split("/")[2];
  const defaults:Record<string,unknown>={invoices:u.pathname==="/v2/invoices"?{invoices:[invoice]}:{invoice},orders:{order},subscriptions:{subscription},payments:{payment},refunds:{refund},disputes:u.pathname==="/v2/disputes"?{}:{dispute}};
  return body(Object.hasOwn(changes,u.pathname)?changes[u.pathname]:defaults[key]);
 };
}
async function sandbox(fn:()=>Promise<void>){
 const values={SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",SQUARE_ACCESS_TOKEN:"fixture-token",SQUARE_LOCATION_ID:"loc",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED:"true",WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED:"true"};
 const prior=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
 try{await fn()}finally{for(const [k,v]of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
}
test("missing hosted customer requires fresh unique invoice, canonical CARD tender and subscription membership",()=>sandbox(async()=>{
 const calls:string[]=[];assert.equal(await owner(payment,fixture({},calls)),"customer");
 assert.deepEqual(calls,["/v2/invoices?location_id=loc&limit=100","/v2/invoices/inv","/v2/orders/order","/v2/subscriptions/sub"]);
 const boundCalls:string[]=[];assert.equal(await owner({...payment,customer_id:"foreign"},fixture({},boundCalls)),"foreign");assert.equal(boundCalls.length,0,"caller must reject explicit foreign owner, never overwrite it");
}));
test("no ambiguous, foreign, split, malformed or incomplete provider ownership can pass",()=>sandbox(async()=>{
 for(const changes of [
  {"/v2/invoices":{}},{"/v2/invoices":{invoices:[invoice,invoice]}},
  {"/v2/invoices":{invoices:[invoice,{...invoice,id:"inv2"}]}},
  {"/v2/invoices":{invoices:[invoice],cursor:"loop"}},
  {"/v2/invoices":{errors:null,invoices:[invoice]}},
  {"/v2/invoices/inv":{invoice:{...invoice,id:"foreign"}}},
  {"/v2/invoices/inv":{invoice:{...invoice,location_id:"foreign"}}},
  {"/v2/invoices/inv":{invoice:{...invoice,order_id:"foreign"}}},
  {"/v2/orders/order":{order:{...order,state:"OPEN"}}},
  {"/v2/orders/order":{order:{...order,customer_id:"foreign"}}},
  {"/v2/orders/order":{order:{...order,tenders:[{id:"pay",type:"CARD",customer_id:"foreign"}]}}},
  {"/v2/orders/order":{order:{...order,tenders:[{id:"pay",type:"CARD",payment_id:"foreign"}]}}},
  {"/v2/orders/order":{order:{...order,tenders:[{id:"foreign",type:"CARD"}]}}},
  {"/v2/orders/order":{order:{...order,tenders:[...order.tenders,...order.tenders]}}},
  {"/v2/orders/order":{order:{...order,tenders:[{id:"pay",type:"CASH"}]}}},
  {"/v2/subscriptions/sub":{subscription:{...subscription,customer_id:"foreign"}}},
  {"/v2/subscriptions/sub":{subscription:{...subscription,invoice_ids:["foreign"]}}},
  {"/v2/subscriptions/sub":{subscription:{...subscription,invoice_ids:["inv","inv"]}}},
 ])await assert.rejects(owner(payment,fixture(changes)));
 for(const changed of [{customer_id:null},{order_id:undefined},{location_id:"foreign"}])await assert.rejects(owner({...payment,...changed},fixture()));
}));
test("pagination must finish with one match; repeated cursors and page cap fail closed",()=>sandbox(async()=>{
 let n=0;const base=fixture();const sender=async(url:string,init:RequestInit)=>{
  if(new URL(url).pathname==="/v2/invoices")return body(n++===0?{invoices:[invoice],cursor:"next"}:{});
  return base(url,init);
 };assert.equal(await owner(payment,sender),"customer");assert.equal(n,2);
 let count=0;await assert.rejects(owner(payment,async()=>body({cursor:"cursor"+(count++),invoices:[]})));assert.equal(count,3);
}));
test("live, disabled, unavailable and malformed reads fail closed",()=>sandbox(async()=>{
 for(const [key,value]of [["SQUARE_ENV","production"],["SQUARE_LIVE_PAYMENTS_ENABLED","true"],["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"]]){
  const prior=process.env[key];process.env[key]=value;let calls=0;await assert.rejects(owner(payment,async()=>{calls++;return body({})}));assert.equal(calls,0);process.env[key]=prior;
 }
 for(const response of [new Response("{}",{status:503}),new Response("{oops"),new Response("{}",{headers:{"content-length":"999999"}})])await assert.rejects(owner(payment,async()=>response));
}));
test("risk, refund discovery and dispute readback retain independent ownership on omitted customer",()=>sandbox(async()=>{
 const risk=createWeddingSquareSandboxPaymentRiskApi(fixture());assert.equal((await risk.inspect("pay","customer","loc",2499)).noRefundsOrDisputes,true);
 await assert.rejects(risk.inspect("pay","foreign","loc",2499));
 const returned={...payment,refunded_money:{amount:100,currency:"USD"},refund_ids:["refund"]};
 const refunds=createWeddingSquareRefundReadback(fixture({"/v2/payments/pay":{payment:returned}}));
 assert.equal((await refunds.inspect("refund")).customerId,"customer");assert.equal((await refunds.inspectPayment("pay")).customerId,"customer");
 assert.equal((await createWeddingSquareDisputeReadback(fixture()).inspect("dispute")).customerId,"customer");
 const foreign={"/v2/subscriptions/sub":{subscription:{...subscription,customer_id:"foreign"}}};
 await assert.rejects(createWeddingSquareRefundReadback(fixture({...foreign,"/v2/payments/pay":{payment:returned}})).inspect("refund"));
 await assert.rejects(createWeddingSquareDisputeReadback(fixture(foreign)).inspect("dispute"));
 // Daily $1 ownership is useful operationally but remains outside monthly billing guards.
 await assert.rejects(risk.inspect("pay","customer","loc",100));
}));
