import assert from "node:assert/strict";
import { test } from "node:test";
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { createWeddingSquareSandboxSubmitRouter } from "./wedding-square-sandbox-submit";

const attemptId = "11111111-1111-4111-8111-111111111111";
const origin = "https://chefsire.com";
const verified = {
  attemptId, authenticatedUserId: "user-1", expectedSandboxMerchantId: "merchant-1",
  savedBinding: { userId: "user-1", squareEnvironment: "sandbox", squareMerchantId: "merchant-1", squareCustomerId: "customer-1" },
  providerCustomer: { id: "customer-1", squareMerchantId: "merchant-1" },
  providerCard: { id: "card-1", customerId: "customer-1" },
};
const result = {
  attemptId, status: "confirmed", providerSubscriptionId: "provider-1",
  grantsEntitlement: false, safeToResubmit: false, requiresPaymentReconciliation: true,
};
async function enabled(run: () => Promise<void>) {
  const values = {
    SQUARE_ENV: "sandbox", WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_SUBMIT_ENABLED: "true",
    WEDDING_SQUARE_ALLOWED_ORIGIN: origin,
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant-1",
  };
  const before=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));
  Object.assign(process.env,values);
  try{await run();} finally {
    for(const [name,value] of Object.entries(before)){
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
}
function mock(config:{
  authUser?:string|null,source?:unknown,submission?:unknown,fail?:"source"|"submit",
}={}){
  const calls:string[]=[];
  const auth: RequestHandler=(req,res,next)=>{
    calls.push("auth");
    if(config.authUser===null)return res.status(401).json({error:"Unauthorized"});
    req.user={id:config.authUser||"user-1"};next();
  };
  const route=createWeddingSquareSandboxSubmitRouter(
    {inspect:async(id:string,userId:string)=>{
      calls.push("source");
      assert.equal(id,attemptId);assert.equal(userId,config.authUser||"user-1");
      if(config.fail==="source")throw Error("private DB or Square ID");
      return config.source===undefined?verified:config.source;
    }} as any,
    {submit:async(input:unknown)=>{
      calls.push("submit");
      assert.ok(input); 
      if(config.fail==="submit")throw Error("provider timeout");
      return config.submission===undefined?result:config.submission;
    }} as any,
    auth,
  );
  return {route,calls};
}
async function serve(router:ReturnType<typeof createWeddingSquareSandboxSubmitRouter>,
  run:(send:(body:unknown,from?:string)=>Promise<Response>)=>Promise<void>){
  const app=express();app.use(express.json());app.use("/api/wedding",router);
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  try {
    const port=(server.address() as AddressInfo).port;
    const send=(body:unknown,from=origin)=>fetch(
      `http://127.0.0.1:${port}/api/wedding/subscription/sandbox/submit`,
      {method:"POST",headers:{"Content-Type":"application/json",Origin:from},body:JSON.stringify(body)},
    );
    await run(send);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
}
test("only authenticated reserved attempt ID reaches trusted owner readback and one-shot submit",()=>enabled(async()=>{
  const {route,calls}=mock();
  await serve(route,async(send)=>{
    const r=await send({attemptId});
    assert.equal(r.status,202);
    assert.deepEqual(await r.json(),{
      ok:true,attemptId,status:"pending_payment_verification",paidEntitlementGranted:false,
    });
    assert.equal(r.headers.get("cache-control"),"no-store");
  });
  assert.deepEqual(calls,["auth","source","submit"]);
}));
test("unauthenticated caller never reads Neon or posts to Square",()=>enabled(async()=>{
  const {route,calls}=mock({authUser:null});
  await serve(route,async(send)=>{
    assert.equal((await send({attemptId})).status,401);
  });
  assert.deepEqual(calls,["auth"]);
}));
test("disabled sandbox, live environment and wrong/missing origin cannot claim a subscription",()=>enabled(async()=>{
  for(const [name,value] of [
    ["SQUARE_ENV","production"],
    ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"],
    ["WEDDING_SQUARE_SANDBOX_SUBMIT_ENABLED","false"],
    ["WEDDING_SQUARE_ALLOWED_ORIGIN","http://chefsire.com"],
  ] as const){
    const old=process.env[name];process.env[name]=value;
    try{
      const {route,calls}=mock();
      await serve(route,async(send)=>{
        assert.equal((await send({attemptId})).status,503);
      });
      assert.deepEqual(calls,["auth"]);
    } finally {
      if(old===undefined)delete process.env[name];else process.env[name]=old;
    }
  }
  const {route,calls}=mock();
  await serve(route,async(send)=>{
    assert.equal((await send({attemptId},"https://different.example")).status,403);
    assert.equal((await send({attemptId},"")).status,403);
  });
  assert.deepEqual(calls,["auth","auth"]);
}));
test("body accepts ONLY attemptId, never user, merchant, card, or provider IDs",()=>enabled(async()=>{
  const {route,calls}=mock();
  await serve(route,async(send)=>{
    for(const body of [
      {},{attemptId:"invalid"}, {attemptId,cardId:"caller-card"},
      {attemptId,userId:"another-user"}, {attemptId,merchantId:"other"},
      {attemptId,providerSubscriptionId:"another-provider"},
    ]){
      const res=await send(body);assert.equal(res.status,400);
    }
  });
  assert.equal(calls.filter(x=>x==="source").length,0);
  assert.equal(calls.filter(x=>x==="submit").length,0);
}));
test("source mismatch, uncertain writes, invalid return never grant paid access or imply safe retry",()=>enabled(async()=>{
  for(const options of [
    {fail:"source" as const},
    {fail:"submit" as const},
    {source:{...verified,authenticatedUserId:"another-user"}},
    {source:{...verified,expectedSandboxMerchantId:"different-merchant"}},
    {submission:{...result,grantsEntitlement:true}},
    {submission:{...result,safeToResubmit:true}},
    {submission:{...result,requiresPaymentReconciliation:false}},
    {submission:{...result,status:"failed"}},
  ]){
    const {route,calls}=mock(options);
    await serve(route,async(send)=>{
      const response=await send({attemptId});
      assert.equal(response.status,409);
      assert.deepEqual(await response.json(),{
        ok:false,code:"WEDDING_SQUARE_RECONCILIATION_REQUIRED",safeToResubmit:false,
      });
    });
    if("source" in options) assert.ok(!calls.includes("submit"));
  }
}));
