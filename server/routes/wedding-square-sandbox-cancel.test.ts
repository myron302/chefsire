import assert from "node:assert/strict";
import { test } from "node:test";
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { createWeddingSquareSandboxCancellationRouter } from "./wedding-square-sandbox-cancel";
const origin="https://chefsire.com";
async function sandbox(fn:()=>Promise<void>){
 const names=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
   "WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED","WEDDING_SQUARE_ALLOWED_ORIGIN"] as const;
 const old=names.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
   WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED:"true",WEDDING_SQUARE_ALLOWED_ORIGIN:origin});
 try{await fn();}finally{names.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
}
function mock(options:{authenticated?:boolean, fail?:boolean}={}){
 const calls:string[]=[];
 const auth:RequestHandler=(req,res,next)=>{
   calls.push("auth");
   if(options.authenticated===false)return res.status(401).end();
   req.user={id:"owner-1"};next();
 };
 const bypassLimit:RequestHandler=(_req,_res,next)=>next();
 const router=createWeddingSquareSandboxCancellationRouter({
   cancel:async(userId:string)=>{
     calls.push("cancel");assert.equal(userId,"owner-1");
     if(options.fail)throw Error("private token or provider failure");
     return {
       cancellationScheduled:true,scheduledEndDate:"2026-12-01",
       chargesAfterScheduledEnd:false,paidEntitlementChanged:false,safeToRetryCancellation:false,
     };
   }
 }as any,auth,bypassLimit);
 return {calls,router};
}
async function serve(router:ReturnType<typeof createWeddingSquareSandboxCancellationRouter>,
 run:(send:(body:unknown,origin?:string)=>Promise<Response>)=>Promise<void>){
 const app=express();app.use(express.json());app.use("/api/wedding",router);
 const server=app.listen(0,"127.0.0.1");
 await new Promise<void>(resolve=>server.once("listening",resolve));
 try{
   const port=(server.address() as AddressInfo).port;
   await run((body,from=origin)=>fetch(`http://127.0.0.1:${port}/api/wedding/subscription/sandbox/cancel`,
     {method:"POST",headers:{"Content-Type":"application/json",Origin:from},body:JSON.stringify(body)}));
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test("authenticated first-party cancellation exposes only end date, never paid entitlement",()=>sandbox(async()=>{
 const x=mock();await serve(x.router,async(send)=>{
   const r=await send({});
   assert.equal(r.status,202);
   assert.deepEqual(await r.json(),{
     ok:true,status:"cancellation_scheduled",scheduledEndDate:"2026-12-01",
     paidEntitlementChanged:false,
   });
   assert.equal(r.headers.get("cache-control"),"no-store");
 });
 assert.deepEqual(x.calls,["auth","cancel"]);
}));
test("absent auth, wrong origin, production/disabled flags or foreign IDs cause zero provider POSTs",()=>sandbox(async()=>{
 let x=mock({authenticated:false});
 await serve(x.router,async(send)=>{assert.equal((await send({})).status,401);});
 assert.deepEqual(x.calls,["auth"]);
 x=mock();await serve(x.router,async(send)=>{
   assert.equal((await send({},"https://foreign.example")).status,403);
   assert.equal((await send({subscriptionId:"other"})).status,400);
   assert.equal((await send({userId:"other"})).status,400);
 });assert.ok(!x.calls.includes("cancel"));
 for(const [key,value] of [
   ["SQUARE_ENV","production"],
   ["WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED","false"],
   ["WEDDING_SQUARE_ALLOWED_ORIGIN","http://chefsire.com"],
 ]as const){
   const old=process.env[key];process.env[key]=value;
   try{const a=mock();await serve(a.router,async(send)=>{assert.equal((await send({})).status,503);});assert.deepEqual(a.calls,["auth"]);}
   finally{if(old===undefined)delete process.env[key];else process.env[key]=old;}
 }
}));
test("uncertain provider cancellation returns fail-closed no-retry response",()=>sandbox(async()=>{
 const x=mock({fail:true});await serve(x.router,async(send)=>{
   const r=await send({});assert.equal(r.status,409);
   assert.deepEqual(await r.json(),{
     ok:false,code:"WEDDING_SQUARE_CANCEL_RECONCILIATION_REQUIRED",
     safeToRetryCancellation:false,
   });
 });assert.deepEqual(x.calls,["auth","cancel"]);
}));
