import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWeddingSquareOwnerCardReadback,
  WeddingSquareOwnerCardReadbackError,
} from "./wedding-square-owner-card-readback";

const attempt="11111111-1111-4111-8111-111111111111";
const saved={
  id:attempt, user_id:"user-1", square_environment:"sandbox",
  square_customer_id:"customer-1", square_card_id:"card-1",
};
const merchant={
  verifiedSandboxMerchantContext:true, merchantId:"merchant-1",
  locationId:"location-1",currency:"USD",
  authorizesSubscriptionCreation:false,grantsEntitlement:false,safeToResubmit:false,
};
const customer={id:"customer-1",referenceId:"user-1"};
const card={id:"card-1",customerId:"customer-1",merchantId:"merchant-1",enabled:true};
async function sandbox(run:()=>Promise<void>){
  const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
    "SQUARE_LOCATION_ID","WEDDING_SQUARE_SANDBOX_MERCHANT_ID"] as const;
  const before=keys.map(k=>process.env[k]);
  Object.assign(process.env,{SQUARE_ENV:"sandbox",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
    SQUARE_LOCATION_ID:"location-1",WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1"});
  try {await run();}finally{
    keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});
  }
}
function mock(options:{
  rows?:unknown[], merchant?:unknown,customer?:unknown,card?:unknown,
  fail?: "merchant"|"db"|"customer"|"card",
}={}){
  const calls:string[]=[];
  const service=createWeddingSquareOwnerCardReadback(
    {query:async(sql:string,args:unknown[])=>{
      calls.push("neon");
      assert.match(sql,/a\.user_id = \$2/);
      assert.match(sql,/a\.status = 'reserved'/);
      assert.match(sql,/NOT EXISTS/);
      assert.match(sql,/other\.user_id <> a\.user_id/);
      assert.deepEqual(args,[attempt,"user-1"]);
      if(options.fail==="db")throw Error("database unavailable");
      return {rows:options.rows===undefined?[saved]:options.rows};
    }} as any,
    {inspect:async()=>{
      calls.push("attest");
      if(options.fail==="merchant")throw Error("merchant unavailable");
      return options.merchant===undefined?merchant:options.merchant;
    }} as any,
    {
      getCustomer:async(id:string)=>{
        calls.push("customer");
        assert.equal(id,"customer-1");
        if(options.fail==="customer")throw Error("customer unavailable");
        return options.customer===undefined?customer:options.customer;
      },
      getCard:async(id:string)=>{
        calls.push("card");
        assert.equal(id,"card-1");
        if(options.fail==="card")throw Error("card unavailable");
        return options.card===undefined?card:options.card;
      },
    } as any,
  );
  return {service,calls};
}
test("owner-scoped reserved Neon record and token-owned Square GETs construct immutable claim input",()=>sandbox(async()=>{
  const {service,calls}=mock();
  const result=await service.inspect(attempt,"user-1");
  assert.deepEqual(calls,["attest","neon","customer","card"]);
  assert.deepEqual(result,{
    attemptId:attempt,authenticatedUserId:"user-1",expectedSandboxMerchantId:"merchant-1",
    savedBinding:{userId:"user-1",squareEnvironment:"sandbox",squareMerchantId:"merchant-1",squareCustomerId:"customer-1"},
    providerCustomer:{id:"customer-1",squareMerchantId:"merchant-1"},
    providerCard:{id:"card-1",customerId:"customer-1"},
  });
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.savedBinding),true);
  assert.equal("grantsEntitlement" in result,false);
}));
test("disabled, production, malformed attempt or user prevent any network and database operations",()=>sandbox(async()=>{
  for(const [env,value] of [["SQUARE_ENV","production"],
    ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"]] as const){
    const prev=process.env[env];process.env[env]=value;
    try{
      const {service,calls}=mock();
      await assert.rejects(service.inspect(attempt,"user-1"),WeddingSquareOwnerCardReadbackError);
      assert.deepEqual(calls,[]);
    }finally{if(prev===undefined)delete process.env[env];else process.env[env]=prev;}
  }
  for(const [a,u] of [["not-a-uuid","user-1"],[attempt,"different user"],["","user-1"]] as const){
    const {service,calls}=mock();
    await assert.rejects(service.inspect(a,u),WeddingSquareOwnerCardReadbackError);
    assert.deepEqual(calls,[]);
  }
}));
test("merchant attestation must be exact before reading Neon or Square owner details",()=>sandbox(async()=>{
  for(const change of [
    {merchantId:"different-merchant"},{locationId:"another-location"},
    {verifiedSandboxMerchantContext:false},{grantsEntitlement:true},
    {authorizesSubscriptionCreation:true},{safeToResubmit:true},
  ]){
    const {service,calls}=mock({merchant:{...merchant,...change}});
    await assert.rejects(service.inspect(attempt,"user-1"),WeddingSquareOwnerCardReadbackError);
    assert.deepEqual(calls,["attest"]);
  }
}));
test("missing or malformed reserved owner row blocks provider GETs",()=>sandbox(async()=>{
  for(const rows of [[],[saved,saved],[{...saved,id:"22222222-2222-4222-8222-222222222222"}],
    [{...saved,user_id:"other-user"}],[{...saved,square_customer_id:"bad id"}],
    [{...saved,square_environment:"production"}]]){
    const {service,calls}=mock({rows});
    await assert.rejects(service.inspect(attempt,"user-1"),WeddingSquareOwnerCardReadbackError);
    assert.deepEqual(calls,["attest","neon"]);
  }
}));
test("provider customer identity and optional referenceId must match trusted enrollment",()=>sandbox(async()=>{
  for(const change of [{id:"other-customer"},{referenceId:"another-user"},{referenceId:" wrong "}]){
    const {service,calls}=mock({customer:{...customer,...change}});
    await assert.rejects(service.inspect(attempt,"user-1"),WeddingSquareOwnerCardReadbackError);
    assert.deepEqual(calls,["attest","neon","customer"]);
  }
  const {service}=mock({customer:{...customer,referenceId:null}});
  assert.equal((await service.inspect(attempt,"user-1")).providerCustomer.id,"customer-1");
}));
test("Square card must be enabled and match saved owner, provider customer and attested merchant",()=>sandbox(async()=>{
  for(const change of [
    {id:"another-card"},{customerId:"another-customer"},{merchantId:"wrong-merchant"},
    {enabled:false},{enabled:null},
  ]){
    const {service,calls}=mock({card:{...card,...change}});
    await assert.rejects(service.inspect(attempt,"user-1"),WeddingSquareOwnerCardReadbackError);
    assert.deepEqual(calls,["attest","neon","customer","card"]);
  }
}));
test("Neon and provider exceptions fail closed without leaking private identifiers",()=>sandbox(async()=>{
  for(const fail of ["merchant","db","customer","card"] as const){
    const {service,calls}=mock({fail});
    await assert.rejects(service.inspect(attempt,"user-1"),(error:unknown)=>{
      assert.ok(error instanceof WeddingSquareOwnerCardReadbackError);
      assert.doesNotMatch(error.message,/customer-1|card-1|merchant-1|user-1/);
      return true;
    });
    assert.equal(calls[0],"attest");
  }
}));
