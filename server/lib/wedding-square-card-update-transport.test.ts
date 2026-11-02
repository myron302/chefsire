import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareCardUpdateTransport} from "./wedding-square-card-update-transport";
const sub={id:"sub",customer_id:"customer",location_id:"loc",plan_variation_id:"plan",card_id:"new-card",status:"ACTIVE",version:4};
async function enabled(fn:()=>Promise<void>){const vars={SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",
 WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",WEDDING_SQUARE_SANDBOX_CARD_UPDATE_ENABLED:"true",SQUARE_ACCESS_TOKEN:"secret"};
 const old={...process.env};Object.assign(process.env,vars);try{await fn();}finally{for(const k of Object.keys(vars))if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
test("one-shot versioned card-only PUT never clears cancellation or changes plan/price",()=>enabled(async()=>{
 let calls=0;const api=createWeddingSquareCardUpdateTransport(async(url,init)=>{calls++;assert.equal(url,"https://connect.squareupsandbox.com/v2/subscriptions/sub");
  assert.equal(init.method,"PUT");assert.equal(init.redirect,"error");assert.deepEqual(JSON.parse(String(init.body)),{subscription:{card_id:"new-card",version:3}});
  return Response.json({subscription:sub});});
 assert.equal((await api.update("sub","new-card",3)).version,4);assert.equal(calls,1);
}));
test("malformed 2xx, stale versions, changed identities and cancellation require reconciliation",()=>enabled(async()=>{
 for(const response of [{subscription:sub,errors:null},{subscription:sub,errors:[{}]},
 {subscription:{...sub,version:3}},{subscription:{...sub,id:"foreign"}},
 {subscription:{...sub,card_id:"old"}},{subscription:{...sub,canceled_date:"2026-12-01"}}]){
  let calls=0;const api=createWeddingSquareCardUpdateTransport(async()=>{calls++;return Response.json(response);});
  await assert.rejects(api.update("sub","new-card",3));assert.equal(calls,1);
 }
}));
test("unknown PUT outcome is never replayed; disabled/production gates make zero requests",()=>enabled(async()=>{
 let calls=0;const api=createWeddingSquareCardUpdateTransport(async()=>{calls++;throw Error("private token");});
 await assert.rejects(api.update("sub","new-card",3),e=>{assert.doesNotMatch(String(e),/private token/);return true;});assert.equal(calls,1);
 process.env.SQUARE_ENV="production";await assert.rejects(api.get("sub"));assert.equal(calls,1);
}));
