import assert from "node:assert/strict";
import {test} from "node:test";
import express from "express";
import type {AddressInfo} from "node:net";
import {createWeddingSquareCardUpdateRouter} from "./wedding-square-card-update";
const origin="https://chefsire.com";
async function enabled(fn:()=>Promise<void>){const vars={WEDDING_SQUARE_SANDBOX_TEST_USER_ID:"owner",SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",
 WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",WEDDING_SQUARE_SANDBOX_CARD_UPDATE_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED:"true",WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant",SQUARE_LOCATION_ID:"loc",
 SQUARE_APPLICATION_ID:"sandbox-app",WEDDING_SQUARE_ALLOWED_ORIGIN:origin};
 const old={...process.env};Object.assign(process.env,vars);try{await fn();}finally{for(const k of Object.keys(vars))if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
async function serve(authenticated:boolean,fn:(send:(path:string,body?:unknown,from?:string)=>Promise<Response>,calls:string[])=>Promise<void>){
 const calls:string[]=[];const service={inspect:async(userId:string)=>{calls.push(userId);return {available:true,needsReconciliation:false,monthlyAmountCents:2499,currency:"USD"};},
  update:async(userId:string)=>{calls.push(userId);return {status:"payment_method_updated",paidEntitlementChanged:false,subscriptionCreated:false};},
  reconcile:async(userId:string)=>{calls.push(userId);return {status:"payment_method_updated",paidEntitlementChanged:false,subscriptionCreated:false};}};
 const app=express();app.use(express.json());app.use("/api/wedding",createWeddingSquareCardUpdateRouter(service as any,(req,res,next)=>{
  if(!authenticated)return res.status(401).end();req.user={id:"owner"};next();},(_req,_res,next)=>next()));
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
 try{await fn((path,body,from=origin)=>fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/wedding/subscription/sandbox/payment-method${path}`,{
  method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",Origin:from},...(body===undefined?{}:{body:JSON.stringify(body)}),
 }),calls);}finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test("owner-only same-origin card replacement and read-only recovery expose no provider identities",()=>enabled(async()=>{
 await serve(true,async(send,calls)=>{
  const config=await send("/config");assert.equal(config.status,200);assert.equal((await config.json()).billingLive,false);
  const changed=await send("",{sourceId:"cnon:one",verificationToken:"verified",acceptedExistingRecurringBilling:true});
  assert.equal(changed.status,202);assert.equal(changed.headers.get("cache-control"),"private, no-store");
  assert.deepEqual(await changed.json(),{ok:true,status:"payment_method_updated",paidEntitlementChanged:false,subscriptionCreated:false});
  assert.equal((await send("/reconcile",{})).status,200);assert.deepEqual(calls,["owner","owner","owner"]);
 });
}));
test("foreign IDs, cross-origin requests, absent auth and production gate make no service calls",()=>enabled(async()=>{
 await serve(false,async(send,calls)=>{assert.equal((await send("/config")).status,401);assert.equal(calls.length,0);});
 await serve(true,async(send,calls)=>{
  assert.equal((await send("",{sourceId:"cnon:one",verificationToken:"verified",acceptedExistingRecurringBilling:true,cardId:"foreign"})).status,400);
  assert.equal((await send("/reconcile",{userId:"foreign"})).status,400);
  assert.equal((await send("/reconcile",{},"https://foreign.test")).status,403);
  process.env.SQUARE_ENV="production";assert.equal((await send("/config")).status,503);assert.equal(calls.length,0);
 });
}));

test("non-tester cannot view card fields, replace a card or invoke recovery",()=>enabled(async()=>{
 process.env.WEDDING_SQUARE_SANDBOX_TEST_USER_ID="another-owner";
 await serve(true,async(send,calls)=>{
   assert.equal((await send("/config")).status,403);
   assert.equal((await send("",{sourceId:"cnon:one",verificationToken:"verified",acceptedExistingRecurringBilling:true})).status,403);
   assert.equal((await send("/reconcile",{})).status,403);
   assert.deepEqual(calls,[]);
 });
}));
