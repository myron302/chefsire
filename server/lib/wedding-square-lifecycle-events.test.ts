import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareLifecycleEvents,readWeddingSquareLifecycleSubscription} from "./wedding-square-lifecycle-events";
const event={event_id:"event-1",event_type:"subscription.updated",square_object_id:"sub-1",attempted_at:"2026-11-02T19:00:00Z"};
const row={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",attempt_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 user_id:"owner",square_subscription_id:"sub-1",square_customer_id:"cust-1",previous_status:"ACTIVE",previous_check_at:null};
const proof={attemptId:row.attempt_id,providerSubscriptionId:"sub-1",providerStatus:"CANCELED",existingIdMatches:true,
 grantsEntitlement:false,safeToResubmit:false,requiresOperatorReconciliation:true};
const invoice={id:"inv-1",subscription_id:"sub-1",location_id:"loc",primary_recipient:{customer_id:"cust-1"},status:"PAID"};
async function enabled(fn:()=>Promise<void>){const vars={SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",
 WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",WEDDING_SQUARE_SANDBOX_PAYMENT_EVENTS_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant",SQUARE_LOCATION_ID:"loc",SQUARE_ACCESS_TOKEN:"secret"};
 const old={...process.env};Object.assign(process.env,vars);try{await fn();}finally{for(const k of Object.keys(vars))if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
function fixture({rows=[row],providerProof=proof,envelope={invoice}}:{rows?:unknown[];providerProof?:unknown;envelope?:unknown}={}){
 const sql:string[]=[];const providerCalls:unknown[]=[];let gets=0;
 const svc=createWeddingSquareLifecycleEvents({query:async(query:string)=>{sql.push(query);return query.startsWith("SELECT")?{rows}:{rowCount:1};}} as any,
 {inspect:async(...args:unknown[])=>{providerCalls.push(args);return providerProof;}} as any,
 async(url,init)=>{gets++;assert.equal(init.method,"GET");assert.equal(init.redirect,"error");
  assert.equal(url,"https://connect.squareupsandbox.com/v2/invoices/inv-1");return Response.json(envelope);});
 return {svc,sql,providerCalls,gets:()=>gets};
}
test("subscription event acknowledges only exact owner/provider identity under a locked queue lease",()=>enabled(async()=>{
 const f=fixture();assert.deepEqual(await f.svc.handle(event),{processed:true,grantsEntitlement:false});
 assert.deepEqual(f.providerCalls,[[row.attempt_id,"owner"]]);assert.equal(f.gets(),0);
 assert.match(f.sql[1],/FOR UPDATE/);assert.match(f.sql[1],/provider_cancelled_at/);
 assert.match(f.sql[1],/last_reconciled_at IS NOT DISTINCT FROM \$12/);
 assert.doesNotMatch(f.sql[1],/verified_paid_through|last_payment_reconciled_at|period_ends_at/);
 assert.match(f.sql[1],/provider_status='PENDING' AND \$6='ACTIVE' THEN 'PENDING'/);
}));
test("invoice PAID hint proves only current lifecycle identity, never settlement or paid coverage",()=>enabled(async()=>{
 const f=fixture();assert.equal((await f.svc.handle({...event,event_type:"invoice.payment_made",square_object_id:"inv-1"})).processed,true);
 assert.equal(f.gets(),1);assert.deepEqual(f.providerCalls,[[row.attempt_id,"owner"]]);
 assert.doesNotMatch(f.sql[1],/invoice_evidence|verified_paid_through/);
}));
test("mixed errors, foreign invoice recipient/location/subscription and ambiguous owners stay pending",()=>enabled(async()=>{
 for(const envelope of [{invoice,errors:null},{invoice,errors:[{}]},
  {invoice:{...invoice,id:"foreign"}},{invoice:{...invoice,location_id:"foreign"}},
  {invoice:{...invoice,primary_recipient:{customer_id:"foreign"}}}]){
  const f=fixture({envelope});assert.equal((await f.svc.handle({...event,event_type:"invoice.updated",square_object_id:"inv-1"})).processed,false);
  assert.equal(f.sql.filter(s=>s.startsWith("WITH")).length,0);
 }
 for(const rows of [[],[row,row],[{...row,square_subscription_id:"foreign"}]]){
  const f=fixture({rows});assert.equal((await f.svc.handle(event)).processed,false);assert.equal(f.providerCalls.length,0);
 }
}));
test("foreign provider proof or live configuration cannot acknowledge events",()=>enabled(async()=>{
 const f=fixture({providerProof:{...proof,providerSubscriptionId:"foreign"}});assert.equal((await f.svc.handle(event)).processed,false);
 assert.equal(f.sql.length,1);process.env.SQUARE_ENV="production";
 const disabled=fixture();assert.equal((await disabled.svc.handle(event)).processed,false);assert.equal(disabled.sql.length,0);
}));
test("raw subscription error envelopes are validated before the ownership verifier can normalize them",()=>enabled(async()=>{
 const subscription={id:"sub-1",customer_id:"cust-1",card_id:"card-1",location_id:"loc",plan_variation_id:"plan",
  status:"ACTIVE",start_date:"2026-11-01",timezone:"UTC"};
 for(const errors of [null,[{code:"DENIED"}]])await assert.rejects(readWeddingSquareLifecycleSubscription("sub-1",async()=>Response.json({subscription,errors})));
 const result=await readWeddingSquareLifecycleSubscription("sub-1",async(url,init)=>{
  assert.match(url,/squareupsandbox.com\/v2\/subscriptions\/sub-1$/);assert.equal(init.method,"GET");assert.equal(init.redirect,"error");
  return Response.json({subscription});
 });
 assert.deepEqual(result,{subscription:{id:"sub-1",customerId:"cust-1",cardId:"card-1",locationId:"loc",planVariationId:"plan",
  status:"ACTIVE",startDate:"2026-11-01",timezone:"UTC"}});
}));
