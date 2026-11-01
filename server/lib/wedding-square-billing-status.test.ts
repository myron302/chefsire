import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareBillingStatus,WeddingSquareBillingStatusError} from "./wedding-square-billing-status";
import {WEDDING_CONSENT_VERSION} from "./wedding-square-billing-policy";
const valid={
 tier:"premium",agreed_monthly_amount_cents:2499,agreed_currency:"USD",
 billing_consent_terms_version:WEDDING_CONSENT_VERSION,
 provider_status:"ACTIVE",requested_start_date:"2026-11-18",
 cancellation_requested_at:null,provider_cancelled_at:null,
 last_reconciled_at:new Date("2026-11-01T20:00:00Z"),
 square_card_id:"DO_NOT_EXPOSE",square_customer_id:"SECRET_CUSTOMER",
 square_subscription_id:"PRIVATE_PROVIDER_ID",
};
async function sandbox(fn:()=>Promise<void>){
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"]as const;
 const previous=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",
 WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1"});
 try{await fn();}finally{keys.forEach((k,i)=>{
  if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];
 });}
}
function fixture(options:{rows?:unknown[],paid?:unknown,failDb?:boolean,failPaid?:boolean}={}){
 const calls:string[]=[];
 const db={query:async(sql:string,args:unknown[])=>{
  calls.push("SELECT");
  assert.match(sql,/user_id=\$1/);
  assert.match(sql,/square_environment='sandbox'/);
  assert.match(sql,/square_merchant_id=\$2/);
  assert.match(sql,/LIMIT 2/);
  assert.deepEqual(args,["owner-1","merchant-1","loc-1"]);
  if(options.failDb)throw Error("database token leaked");
  return{rows:options.rows??[valid]};
 }};
 const paid=async(userId:string)=>{
  calls.push("PAID");
  assert.equal(userId,"owner-1");
  if(options.failPaid)throw Error("secret provider failure");
  return options.paid===undefined?null:options.paid;
 };
 return{svc:createWeddingSquareBillingStatus(db as any,paid as any),calls};
}
test("active row is account-bound, price-checked and never leaks Square identifiers",()=>sandbox(async()=>{
 const x=fixture();const status=await x.svc.inspect("owner-1");
 assert.equal(status.enrollmentStatus,"active");
 assert.equal(status.billingLive,false);
 assert.equal(status.monthlyAmountCents,2499);
 assert.equal(status.tier,"premium");
 assert.equal(status.requestedFirstChargeDate,"2026-11-18");
 assert.equal(status.verifiedPaidAccessThrough,null);
 assert.deepEqual(x.calls,["SELECT","PAID"]);
 assert.doesNotMatch(JSON.stringify(status),/SECRET_CUSTOMER|PRIVATE_PROVIDER_ID|DO_NOT_EXPOSE|merchant-1/);
}));
test("actual verified paid date only comes from independent paid reader",()=>sandbox(async()=>{
 const through="2026-12-01T00:00:00.000Z";
 const x=fixture({paid:{tier:"premium",paidThrough:through}});
 assert.equal((await x.svc.inspect("owner-1")).verifiedPaidAccessThrough,through);
}));
test("not enrolled and disabled environments never invent a canceled or paid status",()=>sandbox(async()=>{
 const x=fixture({rows:[]});const no=await x.svc.inspect("owner-1");
 assert.equal(no.enrollmentStatus,"not_enrolled");
 assert.deepEqual(x.calls,["SELECT"]);
 const previous=process.env.SQUARE_ENV;process.env.SQUARE_ENV="production";
 try{const disabled=fixture();const v=await disabled.svc.inspect("owner-1");
  assert.equal(v.enrollmentStatus,"unavailable");
  assert.equal(v.billingLive,false);assert.deepEqual(disabled.calls,[]);
 }finally{process.env.SQUARE_ENV=previous;}
}));
test("cancellation requested is not falsely described as confirmed",()=>sandbox(async()=>{
 const x=fixture({rows:[{...valid,cancellation_requested_at:new Date("2026-11-01T12:00:00Z")}]});
 assert.equal((await x.svc.inspect("owner-1")).enrollmentStatus,"cancellation_requested");
 const y=fixture({rows:[{...valid,provider_status:"CANCELED",
   provider_cancelled_at:new Date("2026-11-02T12:00:00Z")}]});
 assert.equal((await y.svc.inspect("owner-1")).enrollmentStatus,"canceled");
}));
test("wrong tier/price/consent, invalid dates, overlapping live rows and DB failure fail closed",()=>sandbox(async()=>{
 for(const changed of [
  {tier:"free"},{tier:"elite"},{agreed_monthly_amount_cents:4999},
  {billing_consent_terms_version:"old"},
  {agreed_currency:"EUR"},{provider_status:"unknown"},
  {requested_start_date:"2026-02-30"},
  {last_reconciled_at:"invalid"},
 ]){
  const x=fixture({rows:[{...valid,...changed}]});
  await assert.rejects(x.svc.inspect("owner-1"),WeddingSquareBillingStatusError);
 }
 await assert.rejects(fixture({rows:[valid,valid]}).svc.inspect("owner-1"),WeddingSquareBillingStatusError);
 await assert.rejects(fixture({failDb:true}).svc.inspect("owner-1"),
   e=>e instanceof WeddingSquareBillingStatusError&&!/token|database/i.test(e.message));
 await assert.rejects(fixture({failPaid:true}).svc.inspect("owner-1"),WeddingSquareBillingStatusError);
}));
