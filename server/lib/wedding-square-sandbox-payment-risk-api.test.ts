import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createWeddingSquareSandboxPaymentRiskApi,
  WeddingSquarePaymentRiskUnavailableError,
} from "./wedding-square-sandbox-payment-risk-api";

const payment={payment:{
  id:"pay-1",customer_id:"customer-1",location_id:"location-1",
  order_id:"order-1",status:"COMPLETED",
  amount_money:{amount:2499,currency:"USD"},
  total_money:{amount:2499,currency:"USD"},
  refunded_money:{amount:0,currency:"USD"},refund_ids:[],
}};
const otherDispute={id:"dispute-other",location_id:"location-1",
  disputed_payment:{payment_id:"another-payment"},state:"WON"};
const forPayment={...otherDispute,id:"dispute-ours",
  disputed_payment:{payment_id:"pay-1"}};
const response=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{
  status,headers:{"content-type":"application/json"},
});
async function sandbox(f:()=>Promise<void>){
  const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","SQUARE_ACCESS_TOKEN","SQUARE_LOCATION_ID"]as const;
  const prior=keys.map(k=>process.env[k]);
  Object.assign(process.env,{SQUARE_ENV:"sandbox",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",SQUARE_ACCESS_TOKEN:"offline-token",
    SQUARE_LOCATION_ID:"location-1"});
  try{await f();}finally{keys.forEach((key,i)=>{
    if(prior[i]===undefined)delete process.env[key];else process.env[key]=prior[i];
  });}
}
test("exact owner payment, no refunds and COMPLETE dispute pagination are required",()=>sandbox(async()=>{
  const urls:string[]=[];
  const api=createWeddingSquareSandboxPaymentRiskApi(async(url,init)=>{
    const u=new URL(url);urls.push(u.pathname+u.search);
    assert.equal(u.origin,"https://connect.squareupsandbox.com");
    assert.equal(init.method,"GET");
    assert.equal(init.redirect,"error");
    assert.equal((init.headers as Record<string,string>).Authorization,"Bearer offline-token");
    assert.equal((init.headers as Record<string,string>)["Square-Version"],"2025-10-16");
    if(u.pathname.includes("/payments/"))return response(payment);
    return response(u.searchParams.has("cursor")
      ?{disputes:[otherDispute]}:{disputes:[otherDispute],cursor:"page-2"});
  });
  assert.deepEqual(await api.inspect("pay-1","customer-1","location-1",2499),{
    paymentId:"pay-1",noRefundsOrDisputes:true,grantsEntitlement:false,
    requiresIndependentPeriodVerification:true,
  });
  assert.deepEqual(urls,[
    "/v2/payments/pay-1",
    "/v2/disputes?location_id=location-1",
    "/v2/disputes?location_id=location-1&cursor=page-2",
  ]);
}));
test("wrong amount, identity, status, refund or tips refuse settlement",()=>sandbox(async()=>{
  for(const changed of [
    {id:"other-payment"},{customer_id:"foreign"},
    {location_id:"foreign"},{status:"PENDING"},
    {amount_money:{amount:4999,currency:"USD"}},
    {total_money:{amount:2500,currency:"USD"}},
    {refunded_money:{amount:1,currency:"USD"}},
    {refund_ids:["refund-1"]},
    {tip_money:{amount:1,currency:"USD"}},
  ]){
    let disputeCalls=0;
    const api=createWeddingSquareSandboxPaymentRiskApi(async(url)=>{
      if(url.includes("/disputes")){disputeCalls++;return response({disputes:[]});}
      return response({payment:{...payment.payment,...changed}});
    });
    await assert.rejects(api.inspect("pay-1","customer-1","location-1",2499),
      WeddingSquarePaymentRiskUnavailableError);
    assert.equal(disputeCalls,0);
  }
}));
test("ANY matching dispute on any page or state rejects payment",()=>sandbox(async()=>{
  for(const status of ["WON","LOST","EVIDENCE_REQUIRED","ACCEPTED"]){
    const api=createWeddingSquareSandboxPaymentRiskApi(async(url)=>{
      if(url.includes("/payments/"))return response(payment);
      return response({disputes:[{...forPayment,state:status}]});
    });
    await assert.rejects(api.inspect("pay-1","customer-1","location-1",2499),
      WeddingSquarePaymentRiskUnavailableError);
  }
}));
test("dispute pagination loops, malformed envelope, outage, and errors:null fail closed",()=>sandbox(async()=>{
  for(const disputed of [
    {disputes:[],cursor:"again"},
    {errors:null,disputes:[]},
    {errors:[{code:"ERROR"}],disputes:[]},
    {disputes:[{...otherDispute,location_id:"wrong-location"}]},
    {disputes:[{id:"invalid"}]},
    {disputes:"not-an-array"},
  ]){
    const api=createWeddingSquareSandboxPaymentRiskApi(async(url)=>{
      if(url.includes("/payments/"))return response(payment);
      return response(disputed);
    });
    await assert.rejects(api.inspect("pay-1","customer-1","location-1",2499),
      WeddingSquarePaymentRiskUnavailableError);
  }
  let calls=0;
  const api=createWeddingSquareSandboxPaymentRiskApi(async(url)=>{
    calls++;
    if(url.includes("/payments/"))return response(payment);
    throw Error("secret token in failed DISPUTES_READ");
  });
  await assert.rejects(api.inspect("pay-1","customer-1","location-1",2499),
    e=>e instanceof WeddingSquarePaymentRiskUnavailableError &&
      !/secret|token in/i.test(e.message));
  assert.equal(calls,2,"read-only and no automatic retries");
}));
test("disabled/prod environment and malformed input cause ZERO requests",()=>sandbox(async()=>{
  let calls=0;
  const api=createWeddingSquareSandboxPaymentRiskApi(async()=>{calls++;return response(payment);});
  for(const [key,value]of [["SQUARE_ENV","production"],
    ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"],
    ["SQUARE_ACCESS_TOKEN",""],
    ["SQUARE_LOCATION_ID","wrong-location"]]as const){
    const old=process.env[key];process.env[key]=value;
    try{await assert.rejects(api.inspect("pay-1","customer-1","location-1",2499),
      WeddingSquarePaymentRiskUnavailableError);}
    finally{if(old===undefined)delete process.env[key];else process.env[key]=old;}
  }
  await assert.rejects(api.inspect("bad id","customer-1","location-1",2499),
    WeddingSquarePaymentRiskUnavailableError);
  await assert.rejects(api.inspect("pay-1","customer-1","location-1",123),
    WeddingSquarePaymentRiskUnavailableError);
  assert.equal(calls,0);
}));
test("native 307 HTTP redirect cannot forward a payment or dispute GET",()=>sandbox(async()=>{
  let redirects=0;
  const server=createServer((_req,res)=>{redirects++;res.writeHead(307,{Location:"/target"});res.end();});
  server.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  try{
    const port=(server.address()as AddressInfo).port;
    const api=createWeddingSquareSandboxPaymentRiskApi((_url,init)=>
      fetch(`http://127.0.0.1:${port}/redirect`,init));
    await assert.rejects(api.inspect("pay-1","customer-1","location-1",2499),
      WeddingSquarePaymentRiskUnavailableError);
    assert.equal(redirects,1);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
}));
