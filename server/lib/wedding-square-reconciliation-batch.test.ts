import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareReconciliationBatch,WeddingSquareBatchUnavailableError} from "./wedding-square-reconciliation-batch";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
async function sandbox(fn:()=>Promise<void>){
 const names=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
  "WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED",
  "WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED",
  "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID"] as const;
 const saved=names.map(k=>process.env[k]);
 Object.assign(process.env,{SQUARE_ENV:"sandbox",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED:"true",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1"});
 try{await fn();}finally{names.forEach((k,i)=>{
  if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];
 });}
}
function mock(options:{rows?:unknown[],fail?:boolean,providerFail?:boolean}={}){
 const calls:string[]=[];
 const db={query:async(sql:string,args:unknown[])=>{
  calls.push("select");
  assert.match(sql,/e\.payment_revoked_at IS NULL/);
  assert.match(sql,/e\.period_ends_at>statement_timestamp\(\)/);
  assert.match(sql,/s\.verified_paid_through>=e\.period_ends_at/);
  assert.match(sql,/ORDER BY e\.reconciliation_revision ASC/);
  assert.match(sql,/LIMIT 10/);
  assert.deepEqual(args,["merchant-1","loc-1"]);
  if(options.fail)throw Error("Private Neon credentials");
  return{rows:options.rows??[
   {evidence_id:a,user_id:"owner-1",reconciliation_revision:0},
   {evidence_id:b,user_id:"owner-2",reconciliation_revision:1},
  ]};
 }};
 const refresh={refresh:async(id:string,user:string)=>{
  calls.push(id+":"+user);
  if(options.providerFail&&id===a)throw Error("Private Square token");
  return id===a?{status:"payment_rechecked"}:{status:"reconciliation_required"};
 }};
 return{batch:createWeddingSquareReconciliationBatch(db as any,refresh as any),calls};
}
test("trusted rows produce serial bounded refresh with no user input",()=>sandbox(async()=>{
 const x=mock();
 assert.deepEqual(await x.batch.run(),{status:"completed",scanned:2,checked:1,failed:1});
 assert.deepEqual(x.calls,["select",a+":owner-1",b+":owner-2"]);
}));
test("sandbox and operator switches fail before any SQL read or provider GET",()=>sandbox(async()=>{
 for(const [key,value]of [["SQUARE_ENV","production"],
  ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"],
  ["WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED","false"],
  ["WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED","false"],
  ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID",""],
  ["SQUARE_LOCATION_ID","bad id"]]as const){
  const prev=process.env[key];process.env[key]=value;
  try{const x=mock();assert.equal((await x.batch.run()).status,"disabled");assert.deepEqual(x.calls,[]);}
  finally{if(prev===undefined)delete process.env[key];else process.env[key]=prev;}
 }
}));
test("reject malformed, duplicate, foreign or unbounded DB scan before any risk check",()=>sandbox(async()=>{
 const valid={evidence_id:a,user_id:"owner-1",reconciliation_revision:0};
 for(const rows of [
  [valid,valid],[{...valid,evidence_id:"not-a-uuid"}],
  [{...valid,user_id:"foreign owner"}],
  [{...valid,reconciliation_revision:-1}],
  [{...valid,reconciliation_revision:"0"}],
  Array.from({length:11},(_,i)=>({...valid,evidence_id:
    `00000000-0000-4000-8000-${String(i).padStart(12,"0")}`})),
 ]){
  const x=mock({rows});
  await assert.rejects(x.batch.run(),WeddingSquareBatchUnavailableError);
  assert.deepEqual(x.calls,["select"]);
 }
}));
test("provider failures are counted safely; no secrets, retries or stopping remaining owners",()=>sandbox(async()=>{
 const x=mock({providerFail:true});
 assert.deepEqual(await x.batch.run(),{status:"completed",scanned:2,checked:0,failed:2});
 assert.equal(x.calls.length,3);
 const y=mock({fail:true});
 await assert.rejects(y.batch.run(),e=>e instanceof WeddingSquareBatchUnavailableError &&
   !/Neon|credential/i.test(e.message));
}));
test("same process overlapping batch cannot trigger second scan",()=>sandbox(async()=>{
 let release:()=>void=()=>undefined;
 let started:()=>void=()=>undefined;
 const ready=new Promise<void>(resolve=>{started=resolve;});
 const go=new Promise<void>(resolve=>{release=resolve;});
 const calls:string[]=[];
 const service=createWeddingSquareReconciliationBatch(
  {query:async()=>{
   calls.push("select");started();await go;
   return{rows:[{evidence_id:a,user_id:"owner-1",reconciliation_revision:0}]};
  }}as any,
  {refresh:async()=>{calls.push("refresh");return{status:"payment_rechecked"};}}as any);
 const first=service.run();await ready;
 assert.deepEqual(await service.run(),{status:"already_running",scanned:0,checked:0,failed:0});
 release();
 assert.deepEqual(await first,{status:"completed",scanned:1,checked:1,failed:0});
 assert.deepEqual(calls,["select","refresh"]);
}));
