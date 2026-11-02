import assert from "node:assert/strict";
import {test} from "node:test";
import express,{type RequestHandler} from "express";
import type {AddressInfo} from "node:net";
import {createWeddingSquareBillingStatusRouter} from "./wedding-square-billing-status";

const view={ok:true,billingMode:"sandbox",enrollmentStatus:"active",
 billingLive:false,requiresProviderVerification:true,
 tier:"premium",monthlyAmountCents:2499,currency:"USD",
 requestedFirstChargeDate:"2026-11-18",
 cancellationRequestedAt:null,providerCancellationRecordedAt:null,
 lastProviderCheckAt:null,verifiedPaidAccessThrough:null};
function fixture(options:{authenticated?:boolean,error?:boolean}={}){
 const calls:string[]=[];
 const auth:RequestHandler=(req,res,next)=>{
  calls.push("auth");
  if(options.authenticated===false)return res.status(401).json({ok:false});
  req.user={id:"owner-1"};next();
 };
 const router=createWeddingSquareBillingStatusRouter({
  inspect:async(userId:string)=>{
   calls.push("inspect");
   assert.equal(userId,"owner-1");
   if(options.error)throw Error("private Square token");
   return view;
  },
 }as any,auth);
 return{router,calls};
}
async function serve(router:ReturnType<typeof createWeddingSquareBillingStatusRouter>,fn:(fetcher:()=>Promise<Response>)=>Promise<void>){
 const app=express();app.use("/api/wedding",router);
 const server=app.listen(0,"127.0.0.1");
 await new Promise<void>(resolve=>server.once("listening",resolve));
 try{
  const port=(server.address()as AddressInfo).port;
  await fn(()=>fetch(`http://127.0.0.1:${port}/api/wedding/subscription/billing-status`));
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test("owner-authenticated read is private, no-store and read-only",async()=>{
 const x=fixture();
 await serve(x.router,async(get)=>{
  const res=await get();assert.equal(res.status,200);
  assert.equal(res.headers.get("cache-control"),"private, no-store");
  assert.deepEqual(await res.json(),view);
 });
 assert.deepEqual(x.calls,["auth","inspect"]);
});
test("anonymous accounts never query private billing state",async()=>{
 const x=fixture({authenticated:false});
 await serve(x.router,async(get)=>{assert.equal((await get()).status,401);});
 assert.deepEqual(x.calls,["auth"]);
});
test("provider/Neon outage reveals no secrets and returns no fake Free status",async()=>{
 const x=fixture({error:true});
 await serve(x.router,async(get)=>{
  const res=await get();assert.equal(res.status,503);
  const payload=await res.json();
  assert.equal(payload.code,"WEDDING_BILLING_STATUS_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(payload),/token|customer|secret/i);
 });
 assert.deepEqual(x.calls,["auth","inspect"]);
});
