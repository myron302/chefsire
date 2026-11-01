import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareRenewalScan, WeddingSquareRenewalScanError } from "./wedding-square-renewal-scan";
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const S="33333333-3333-4333-8333-333333333333";
const row={attempt_id:A,user_id:"owner-1",subscription_id:S,square_subscription_id:"sub-1",provider_status:"ACTIVE"};
const candidate={subscriptionId:"sub-1",invoiceId:"inv-new",paymentId:"pay-new",
  grantsEntitlement:false,safeToResubmit:false,requiresOperatorReconciliation:true,
  requiresAmountAndCoverageVerification:true};
const outcome={status:"recorded",invoiceId:"inv-new",subscriptionId:"sub-1",
  paidEntitlementGranted:false,safeToResubmit:false};
async function enabled(fn:()=>Promise<void>){
 const keys=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
  "WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED","WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED",
  "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"] as const;
 const old=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1"});
 try{await fn();}finally{keys.forEach((k,i)=>{
  if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];
 });}
}
function fixture(opts:{rows?:unknown[],prior?:unknown[],providerFail?:boolean,
 wrong?:boolean,ledgerFail?:boolean,activationFail?:boolean}={}){
 const calls:string[]=[];
 const db={query:async(sql:string,args:unknown[])=>{
  if(sql.includes("WITH selected")){
   calls.push("claim");
   assert.match(sql,/FOR UPDATE OF s SKIP LOCKED/);
   assert.match(sql,/last_renewal_scan_at = statement_timestamp/);
   assert.match(sql,/LIMIT 20/);
   assert.match(sql,/a\.status = 'confirmed'/);
   assert.deepEqual(args,["merchant-1","loc-1"]);
   return{rows:opts.rows??[row]};
  }
  calls.push("existing");
  assert.match(sql,/square_invoice_id = \$4/);
  assert.deepEqual(args,[S,"merchant-1","sub-1","inv-new"]);
  return{rows:opts.prior??[]};
 }};
 const payment={inspect:async(attemptId:string,userId:string)=>{
  calls.push("provider");
  assert.deepEqual([attemptId,userId],[A,"owner-1"]);
  if(opts.providerFail)throw Error("private Square token");
  return opts.wrong?{...candidate,subscriptionId:"foreign"}:candidate;
 }};
 const activation={activate:async(attemptId:string,userId:string,sub:string)=>{
  calls.push("activate");
  assert.deepEqual([attemptId,userId,sub],[A,"owner-1","sub-1"]);
  if(opts.activationFail)throw Error("Square not ACTIVE");
  return{activated:true,subscriptionId:sub,grantsEntitlement:false};
 }};
 const ledger={record:async(attemptId:string,userId:string)=>{
  calls.push("ledger");
  assert.deepEqual([attemptId,userId],[A,"owner-1"]);
  if(opts.ledgerFail)throw Error("private Neon rollback");
  return outcome;
 }};
 return{service:createWeddingSquareRenewalScan(db as any,payment as any,ledger as any,activation as any),calls};
}
test("newest verified renewal invoice creates one ledger record; no Square charge",()=>enabled(async()=>{
 const x=fixture();
 assert.deepEqual(await x.service.run(),{status:"completed",scanned:1,recorded:1,existing:0,pending:0});
 assert.deepEqual(x.calls,["claim","provider","existing","ledger"]);
}));
test("unchanged invoice is skipped, never reinserted or paid through twice",()=>enabled(async()=>{
 const x=fixture({prior:[{square_payment_id:"pay-new"}]});
 assert.deepEqual(await x.service.run(),{status:"completed",scanned:1,recorded:0,existing:1,pending:0});
 assert.deepEqual(x.calls,["claim","provider","existing"]);
}));
test("ambiguous invoice ID, provider outage or failed full settlement stays pending",()=>enabled(async()=>{
 for(const options of [{wrong:true},{providerFail:true},{ledgerFail:true},
  {prior:[{square_payment_id:"different"}]}]){
  const x=fixture(options);
  const res=await x.service.run();
  assert.equal(res.pending,1);
  assert.equal(res.recorded,0);
 }
}));
test("production and disabled flags perform zero Neon or Square calls",()=>enabled(async()=>{
 for(const [key,value] of [
  ["SQUARE_ENV","production"],
  ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"],
  ["WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED","false"],
  ["WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED","false"],
  ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID",""],
  ["SQUARE_LOCATION_ID","invalid id"],
 ]as const){
  const previous=process.env[key];process.env[key]=value;
  try{const x=fixture();assert.equal((await x.service.run()).status,"disabled");assert.deepEqual(x.calls,[]);}
  finally{if(previous===undefined)delete process.env[key];else process.env[key]=previous;}
 }
}));
test("invalid, duplicated or unbounded persisted rows are rejected before network calls",()=>enabled(async()=>{
 for(const rows of [
  [{...row,user_id:"bad owner"}],
  [{...row,attempt_id:"invalid"}],
  [{...row,subscription_id:"invalid"}],
  [row,row],
  [{...row,provider_status:"DEACTIVATED"}],
  Array.from({length:21},(_,i)=>({...row,subscription_id:
   `00000000-0000-4000-8000-${String(i).padStart(12,"0")}`})),
 ]){
  const x=fixture({rows});
  await assert.rejects(x.service.run(),WeddingSquareRenewalScanError);
  assert.deepEqual(x.calls,["claim"]);
 }
}));
test("same-worker overlap returns already_running without a second provider scan",()=>enabled(async()=>{
 let unblock:()=>void=()=>undefined, ready:()=>void=()=>undefined;
 const started=new Promise<void>(resolve=>ready=resolve);
 const released=new Promise<void>(resolve=>unblock=resolve);
 const calls:string[]=[];
 const db={query:async(sql:string)=>{
  calls.push("claim");ready();await released;
  return{rows:[]};
 }};
 const svc=createWeddingSquareRenewalScan(db as any,{}as any,{}as any,{}as any);
 const first=svc.run();await started;
 assert.equal((await svc.run()).status,"already_running");
 unblock();assert.equal((await first).status,"completed");
 assert.deepEqual(calls,["claim"]);
}));

test("PENDING first-charge must receive verified ACTIVE owner transition BEFORE real ledger",()=>enabled(async()=>{
 const x=fixture({rows:[{...row,provider_status:"PENDING"}]});
 const res=await x.service.run();
 assert.deepEqual(res,{status:"completed",scanned:1,recorded:1,existing:0,pending:0});
 assert.deepEqual(x.calls,["claim","provider","activate","existing","ledger"]);
 const failed=fixture({rows:[{...row,provider_status:"PENDING"}],activationFail:true});
 const blocked=await failed.service.run();
 assert.equal(blocked.pending,1);
 assert.deepEqual(failed.calls,["claim","provider","activate"]);
}));
