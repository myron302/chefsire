import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareSandboxCancellation, WeddingSquareSandboxCancellationError } from "./wedding-square-sandbox-cancellation";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const id="11111111-1111-4111-8111-111111111111";
const saved={
  id,user_id:"owner-1",tier:"premium",square_merchant_id:"merchant-1",
  square_location_id:"loc-1",square_customer_id:"cust-1",square_card_id:"card-1",
  square_plan_variation_id:"premium-var",square_subscription_id:"sub-1",
  billing_consent_terms_version:WEDDING_CONSENT_VERSION,
  agreed_monthly_amount_cents:2499,agreed_currency:"USD",provider_status:"ACTIVE",
};
const merchant={
  verifiedSandboxMerchantContext:true,merchantId:"merchant-1",locationId:"loc-1",
  currency:"USD",authorizesSubscriptionCreation:false,grantsEntitlement:false,safeToResubmit:false,
};
const before={id:"sub-1",customerId:"cust-1",locationId:"loc-1",
  planVariationId:"premium-var",cardId:"card-1",providerStatus:"ACTIVE",canceledDate:null};
const after={...before,canceledDate:"2026-12-01"};
async function sandbox(fn:()=>Promise<void>){
  const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
    "WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED","WEDDING_SQUARE_SANDBOX_MERCHANT_ID",
    "SQUARE_LOCATION_ID","WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID"] as const;
  const old=keys.map(k=>process.env[k]);
  Object.assign(process.env,{
    SQUARE_ENV:"sandbox",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED:"true",WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",
    SQUARE_LOCATION_ID:"loc-1",WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID:"premium-var",
  });
  try{await fn();}finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
}
function mock(options:{
  row?:unknown,verified?:unknown,before?:unknown,after?:unknown,
  duplicate?:boolean,fail?: "merchant"|"get"|"claim"|"post"|"ack",
}={}){
  const calls:string[]=[];
  let claimed=false;
  const db={
    query:async(sql:string,params:unknown[])=>{
      const verb=sql.trim().split(/\s+/)[0].toUpperCase();
      calls.push(verb==="SELECT"?"select":claimed?"ack":"claim");
      if(verb==="SELECT") {
        assert.deepEqual(params,["owner-1","merchant-1","loc-1"]);
        return {rows:options.row===undefined?[saved]:options.row===null?[]:[options.row]};
      }
      if(!claimed){
        assert.match(sql,/cancellation_requested_at IS NULL/);
        claimed=true;
        if(options.fail==="claim")throw Error("Neon failure");
        return {rows:options.duplicate?[]:[{id}]};
      }
      if(options.fail==="ack")throw Error("database failure");
      assert.match(sql,/last_reconciled_at/);
      assert.doesNotMatch(sql,/verified_paid_through/);
      return {rows:[{id}]};
    }
  };
  const service=createWeddingSquareSandboxCancellation(
    db as any,
    {inspect:async()=>{
      calls.push("merchant");
      if(options.fail==="merchant")throw Error("bad Square token");
      return options.verified===undefined?merchant:options.verified;
    }} as any,
    {
      get:async(sub:string)=>{
        calls.push("get");assert.equal(sub,"sub-1");
        if(options.fail==="get")throw Error("provider GET failed");
        return options.before===undefined?before:options.before;
      },
      cancel:async(sub:string)=>{
        calls.push("POST");assert.equal(sub,"sub-1");
        if(options.fail==="post")throw Error("ambiguous Square timeout");
        return options.after===undefined?after:options.after;
      },
    } as any,
  );
  return {service,calls};
}
test("verified user-owned, active provider subscription gets one claimed cancellation POST",()=>sandbox(async()=>{
  const x=mock();const result=await x.service.cancel("owner-1");
  assert.deepEqual(x.calls,["merchant","select","get","claim","POST","ack"]);
  assert.deepEqual(result,{
    cancellationScheduled:true,scheduledEndDate:"2026-12-01",
    chargesAfterScheduledEnd:false,paidEntitlementChanged:false,safeToRetryCancellation:false,
  });
}));
test("disabled/live environment or malformed user ID causes no calls",()=>sandbox(async()=>{
  for(const [key,value] of [["SQUARE_ENV","production"],["WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED","false"]] as const){
    const old=process.env[key];process.env[key]=value;
    try{const x=mock();await assert.rejects(x.service.cancel("owner-1"),WeddingSquareSandboxCancellationError);assert.deepEqual(x.calls,[]);}
    finally{if(old===undefined)delete process.env[key];else process.env[key]=old;}
  }
  const x=mock();await assert.rejects(x.service.cancel("bad id"),WeddingSquareSandboxCancellationError);
  assert.deepEqual(x.calls,[]);
}));
test("wrong owner, billing terms or plan block provider readback and POST",()=>sandbox(async()=>{
  for(const change of [
    {user_id:"another-user"},{tier:"elite"},{agreed_monthly_amount_cents:999},
    {agreed_currency:"EUR"},{billing_consent_terms_version:"outdated"},
    {square_plan_variation_id:"foreign-plan"},{square_merchant_id:"other"},
    {square_customer_id:"wrong customer"},{square_subscription_id:""},
  ]){
    const x=mock({row:{...saved,...change}});
    await assert.rejects(x.service.cancel("owner-1"),WeddingSquareSandboxCancellationError);
    assert.deepEqual(x.calls,["merchant","select"]);
  }
}));
test("provider mismatch or missing cancellation date blocks provider ACK",()=>sandbox(async()=>{
  for(const change of [
    {customerId:"wrong"},{locationId:"wrong"},{planVariationId:"wrong"},
    {cardId:"wrong"},{providerStatus:"CANCELED"},{canceledDate:"2026-12-01"},
  ]){
    const x=mock({before:{...before,...change}});
    await assert.rejects(x.service.cancel("owner-1"),WeddingSquareSandboxCancellationError);
    assert.deepEqual(x.calls,["merchant","select","get"]);
  }
  for(const change of [{customerId:"wrong"},{canceledDate:null},{id:"other"}]){
    const x=mock({after:{...after,...change}});
    await assert.rejects(x.service.cancel("owner-1"),WeddingSquareSandboxCancellationError);
    assert.deepEqual(x.calls,["merchant","select","get","claim","POST"]);
  }
}));
test("duplicate claim, one provider POST failure or Neon ACK outage blocks any retry",()=>sandbox(async()=>{
  for(const opt of [{duplicate:true},{fail:"post" as const},{fail:"ack" as const}]){
    const x=mock(opt);
    await assert.rejects(x.service.cancel("owner-1"),(err:unknown)=>{
      assert.ok(err instanceof WeddingSquareSandboxCancellationError);
      assert.doesNotMatch(err.message,/secret|token|Square timeout|owner-1/);
      return true;
    });
    assert.ok(x.calls.filter(c=>c==="POST").length<=1);
  }
}));
