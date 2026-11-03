import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquarePaymentEvents} from "./wedding-square-payment-events";
const event={event_id:"event-1",event_type:"payment.updated",square_object_id:"payment-1",attempted_at:"2026-11-02 18:00:00+00"};
const evidence={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",user_id:"owner",square_customer_id:"customer-1",
 square_payment_id:"payment-1",agreed_monthly_amount_cents:2499,reconciliation_revision:0};
const merchant={inspect:async()=>({verifiedSandboxMerchantContext:true,merchantId:"merchant-1",locationId:"loc-1",
 grantsEntitlement:false,authorizesSubscriptionCreation:false})};
const refund={inspect:async()=>({refundId:"refund-1",paymentId:"payment-1",customerId:"customer-1",locationId:"loc-1",
 amountCents:2499,completedRefund:true,grantsEntitlement:false})};
async function enabled(fn:()=>Promise<void>){const vars={SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",
 WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED:"true",WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1"};
 const old={...process.env};Object.assign(process.env,vars);try{await fn();}finally{for(const k of Object.keys(vars))
 if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
function fixture(events:unknown[]=[event],rows:unknown[]=[evidence],status="payment_rechecked"){
 const calls:{sql:string,args:unknown[]}[]=[];const checked:unknown[]=[];
 const db={query:async(sql:string,args:unknown[]=[])=>{calls.push({sql,args});
  if(sql.startsWith("WITH selected"))return {rows:events};
  if(sql.startsWith("SELECT e.id"))return {rows};return {rowCount:1};}};
 const svc=createWeddingSquarePaymentEvents(db as any,merchant as any,{refresh:async(...args:unknown[])=>{
  checked.push(args);return {status,grantsEntitlement:false};}} as any,refund as any);
 return {svc,calls,checked};
}
test("payment event requires an exact owner-bound fresh check before acknowledgement",()=>enabled(async()=>{
 const f=fixture();assert.deepEqual(await f.svc.run(),{status:"completed",scanned:1,processed:1,pending:0});
 assert.deepEqual(f.checked,[[evidence.id,"owner"]]);assert.equal(f.calls.length,3);
 assert.match(f.calls[0].sql,/SKIP LOCKED/);assert.match(f.calls[0].sql,/last_reconciliation_attempt_at ASC NULLS FIRST/);
 assert.match(f.calls[2].sql,/reconciliation_revision=\$4/);assert.match(f.calls[2].sql,/payment_revoked_at IS NULL/);
 assert.deepEqual(f.calls[2].args,[evidence.id,"merchant-1","payment-1",1,"event-1","payment-1",event.attempted_at]);
}));
test("completed refund revokes only independently matched payment and acknowledges atomically",()=>enabled(async()=>{
 const f=fixture([{...event,event_type:"refund.updated",square_object_id:"refund-1"}]);
 assert.equal((await f.svc.run()).processed,1);assert.equal(f.checked.length,0);
 assert.match(f.calls[2].sql,/WITH locked_queue AS MATERIALIZED/);assert.match(f.calls[2].sql,/FOR UPDATE/);
 assert.match(f.calls[2].sql,/payment_revoked_at=COALESCE/);
 assert.match(f.calls[2].sql,/EXISTS\(SELECT 1 FROM revoked\)/);assert.equal(f.calls[2].args[3],0);
 assert.doesNotMatch(f.calls[2].sql,/verified_paid_through/);
}));
test("unmatched/ambiguous owners and failed payment verification remain pending",()=>enabled(async()=>{
 for(const rows of [[],[evidence,evidence],[{...evidence,square_payment_id:"foreign"}]] ){
  const f=fixture([event],rows);assert.equal((await f.svc.run()).processed,0);assert.equal(f.calls.length,2);}
 const f=fixture([event],[evidence],"reconciliation_required");assert.equal((await f.svc.run()).processed,0);assert.equal(f.calls.length,2);
}));
test("foreign refund customer never revokes evidence",()=>enabled(async()=>{
 const f=fixture();const svc=createWeddingSquarePaymentEvents({query:async(sql:string)=>{
  if(sql.startsWith("WITH selected"))return {rows:[{...event,event_type:"refund.updated",square_object_id:"refund-1"}]};
  if(sql.startsWith("SELECT"))return {rows:[evidence]};throw Error("Must not mutate");
 }} as any,merchant as any,{} as any,{inspect:async()=>({...await refund.inspect(),customerId:"foreign"})} as any);
 assert.equal((await svc.run()).processed,0);assert.equal(f.checked.length,0);
}));
test("dispute notifications revoke only independently resolved owner payment under the queue lease",()=>enabled(async()=>{
 for(const eventType of ["dispute.created","dispute.state.updated"]){
  const calls:{sql:string,args:unknown[]}[]=[];
  const db={query:async(sql:string,args:unknown[]=[])=>{calls.push({sql,args});
   if(sql.startsWith("WITH selected"))return {rows:[{...event,event_type:eventType,square_object_id:"dispute-1"}]};
   if(sql.startsWith("SELECT"))return {rows:[evidence]};return {rowCount:1};}};
  const dispute={inspect:async(id:string)=>{assert.equal(id,"dispute-1");return {disputeId:id,
   paymentId:"payment-1",customerId:"customer-1",locationId:"loc-1",amountCents:2499,grantsEntitlement:false as const};}};
  const worker=createWeddingSquarePaymentEvents(db as any,merchant as any,{} as any,refund as any,undefined,dispute);
  assert.equal((await worker.run()).processed,1);
  assert.match(calls[2].sql,/WITH locked_queue AS MATERIALIZED/);
  assert.match(calls[2].sql,/payment_revoked_at=COALESCE/);
  assert.deepEqual(calls[2].args,[evidence.id,"merchant-1","payment-1",0,"event-1","dispute-1",event.attempted_at]);
  assert.doesNotMatch(calls[2].sql,/verified_paid_through/);
  for(const bad of [{disputeId:"foreign"},{customerId:"foreign"},{paymentId:"foreign"},{locationId:"foreign"},
   {amountCents:4999},{grantsEntitlement:true}]){
   const before=calls.length;
   const rejected=createWeddingSquarePaymentEvents(db as any,merchant as any,{} as any,refund as any,undefined,
    {inspect:async()=>({...await dispute.inspect("dispute-1"),...bad})} as any);
   assert.equal((await rejected.run()).processed,0);
   assert.ok(calls.slice(before).every(c=>!c.sql.startsWith("WITH locked_queue")));
  }
 }
}));
test("default-off, live and production gates do no provider or DB work",()=>enabled(async()=>{
 for(const [key,value] of [["SQUARE_ENV","production"],["SQUARE_LIVE_PAYMENTS_ENABLED","true"],
 ["WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED","false"]]){
  const before=process.env[key];process.env[key]=value;const f=fixture();assert.equal((await f.svc.run()).status,"disabled");
  assert.equal(f.calls.length,0);process.env[key]=before;}
}));
