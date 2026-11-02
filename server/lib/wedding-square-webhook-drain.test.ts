import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareWebhookDrain,WeddingSquareWebhookDrainUnavailable} from "./wedding-square-webhook-drain";
async function enabled(fn:()=>Promise<void>){
 const vars={SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",
 WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_WEBHOOK_DRAIN_ENABLED:"true",WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED:"true",
 WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-test"};
 const old=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));
 Object.assign(process.env,vars);
 try{await fn();}finally{for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
}
test("bounded notifications trigger independent scans, not payment entitlements",()=>enabled(async()=>{
 const calls:string[]=[];const svc=createWeddingSquareWebhookDrain(
 {query:async(sql:string,args:unknown[])=>{
  if(sql.startsWith("SELECT")){calls.push("select");assert.match(sql,/LIMIT 10/);assert.match(sql,/event_type LIKE/);
   return {rows:[{event_id:"evt-1",event_type:"subscription.updated"},{event_id:"evt-2",event_type:"payment.updated"}]};}
  calls.push("ack");assert.match(sql,/processing_status='pending'/);assert.deepEqual(args,["merchant-test","evt-1"]);
  assert.doesNotMatch(sql,/verified_paid_through|subscription_history|invoice_evidence/);
  return {rowCount:1};
 }}as any,
 {run:async()=>{calls.push("renew");return {status:"completed",scanned:1,recorded:1,existing:0,pending:0};}},
 {run:async()=>{calls.push("reconcile");return {status:"completed",scanned:1,checked:1,failed:0};}});
 assert.deepEqual(await svc.run(),{status:"completed",scanned:2,processed:1,pending:1});
 assert.deepEqual(calls,["select","renew","reconcile","ack"]);
}));
test("disabled and failed scans cannot consume any notification",()=>enabled(async()=>{
 let calls=0;
 const svc=createWeddingSquareWebhookDrain(
 {query:async()=>{calls++;return {rows:[{event_id:"evt-1",event_type:"invoice.updated"}]};}}as any,
 {run:async()=>({status:"disabled",scanned:0})},
 {run:async()=>({status:"completed",scanned:0})});
 assert.equal((await svc.run()).processed,0);assert.equal(calls,1);
 process.env.SQUARE_ENV="production";
 assert.equal((await svc.run()).status,"disabled");assert.equal(calls,1);
}));
test("untrusted malformed metadata cannot cause reconciliation calls",()=>enabled(async()=>{
 let called=0;
 const svc=createWeddingSquareWebhookDrain(
 {query:async()=>({rows:[{event_id:"bad id",event_type:"refund.updated"}]})}as any,
 {run:async()=>{called++;return {status:"completed",scanned:0};}},
 {run:async()=>{called++;return {status:"completed",scanned:0};}});
 await assert.rejects(svc.run(),WeddingSquareWebhookDrainUnavailable);
 assert.equal(called,0);
}));

test("zero or failed provider work preserves unacknowledged notifications",()=>enabled(async()=>{
 for(const scans of [
  [{status:"completed",scanned:0,recorded:0,existing:0,pending:0},{status:"completed",scanned:0,checked:0,failed:0}],
  [{status:"completed",scanned:1,recorded:0,existing:0,pending:1},{status:"completed",scanned:1,checked:0,failed:1}],
 ]){
  let mutations=0;
  const worker=createWeddingSquareWebhookDrain({query:async(sql:string)=>{
   if(sql.startsWith("UPDATE"))mutations++;
   return {rows:[{event_id:"evt-1",event_type:"invoice.updated"}]};
  }}as any,{run:async()=>scans[0]},{run:async()=>scans[1]});
  const result=await worker.run();
  assert.equal(result.processed,0);
  assert.equal(result.pending,1);
  assert.equal(mutations,0);
 }
}));
