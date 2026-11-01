import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import { createWeddingSquareSandboxCustomerCardApi, WeddingSquareCustomerCardApiError } from "./wedding-square-sandbox-customer-card-api";

const customer={customer:{id:"customer-1",reference_id:"user-1"}};
const card={card:{id:"card-1",customer_id:"customer-1",merchant_id:"merchant-1",enabled:true}};
function response(body:unknown,status=200) {return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});}
async function sandbox(run:()=>Promise<void>) {
  const names=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","SQUARE_ACCESS_TOKEN"] as const;
  const old=names.map(n=>process.env[n]);
  process.env.SQUARE_ENV="sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED="true";
  process.env.SQUARE_ACCESS_TOKEN="offline-test-only";
  try {await run();} finally {names.forEach((n,i)=>{if(old[i]===undefined) delete process.env[n];else process.env[n]=old[i];});}
}
test("Square SDK v43 exposes customer and card GET without network",()=>{
  const sdk=new SquareClient({token:"offline-test",environment:SquareEnvironment.Sandbox});
  assert.equal(typeof sdk.customers.get,"function");
  assert.equal(typeof sdk.cards.get,"function");
});
test("raw GET uses only fixed sandbox endpoints and returns exact, minimal IDs",()=>sandbox(async()=>{
  const paths:string[]=[];
  const api=createWeddingSquareSandboxCustomerCardApi(async(url,init)=>{
    const u=new URL(url);paths.push(u.pathname);
    assert.equal(u.origin,"https://connect.squareupsandbox.com");
    assert.equal(init.method,"GET");
    assert.ok(init.signal);
    return response(u.pathname.includes("/customers/")?customer:card);
  });
  assert.deepEqual(await api.getCustomer("customer-1"),{id:"customer-1",referenceId:"user-1"});
  assert.deepEqual(await api.getCard("card-1"),{id:"card-1",customerId:"customer-1",merchantId:"merchant-1",enabled:true});
  assert.deepEqual(paths,["/v2/customers/customer-1","/v2/cards/card-1"]);
}));
test("malformed success envelopes and disabled cards fail closed",()=>sandbox(async()=>{
  for(const errors of [null,false,{},[{}]]){
    for(const [method,base,id] of [["getCustomer",customer,"customer-1"],["getCard",card,"card-1"]] as const){
      const api=createWeddingSquareSandboxCustomerCardApi(async()=>response({...base,errors}));
      await assert.rejects(api[method](id),WeddingSquareCustomerCardApiError);
    }
  }
  for(const data of [{...card.card,enabled:false},{...card.card,merchant_id:null},{...card.card,customer_id:""}]){
    const api=createWeddingSquareSandboxCustomerCardApi(async()=>response({card:data}));
    await assert.rejects(api.getCard("card-1"),WeddingSquareCustomerCardApiError);
  }
}));
test("production and disabled switches cause zero provider requests",()=>sandbox(async()=>{
  let calls=0;
  const api=createWeddingSquareSandboxCustomerCardApi(async()=>{calls++;return response(card);});
  for(const [n,value] of [["SQUARE_ENV","production"],["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"],["SQUARE_ACCESS_TOKEN",""]] as const){
    const before=process.env[n];process.env[n]=value;
    try{await assert.rejects(api.getCard("card-1"),WeddingSquareCustomerCardApiError);}
    finally{if(before===undefined)delete process.env[n];else process.env[n]=before;}
  }
  await assert.rejects(api.getCard("bad id"),WeddingSquareCustomerCardApiError);
  assert.equal(calls,0);
}));
test("provider errors and malformed/oversized responses are never retried",()=>sandbox(async()=>{
  for(const body of [
    new Response("not-json",{status:200}),
    new Response("x".repeat(65537),{status:200}),
    response({errors:[{code:"FAIL"}]},503),
  ]){
    let calls=0;
    const api=createWeddingSquareSandboxCustomerCardApi(async()=>{calls++;return body;});
    await assert.rejects(api.getCard("card-1"),WeddingSquareCustomerCardApiError);
    assert.equal(calls,1);
  }
}));
