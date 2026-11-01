import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createWeddingSquareCancelTransport,
  WeddingSquareCancelTransportError,
} from "./wedding-square-sandbox-cancel-transport";

const provider = {
  subscription: { id:"sub-1",customer_id:"cust-1",location_id:"loc-1",
    plan_variation_id:"premium-var",card_id:"card-1",status:"ACTIVE",
    canceled_date:null },
};
const canceled = { subscription: {...provider.subscription,canceled_date:"2026-12-01"} };
const response = (data:unknown,status=200) =>
  new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
async function sandbox(run:()=>Promise<void>){
  const names=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
    "WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED","SQUARE_ACCESS_TOKEN"] as const;
  const saved=names.map(k=>process.env[k]);
  Object.assign(process.env,{
    SQUARE_ENV:"sandbox",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED:"true",SQUARE_ACCESS_TOKEN:"sandbox-test-only",
  });
  try{await run();}finally{names.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});}
}
test("verified raw GET followed by exactly one bodyless sandbox cancellation POST",()=>sandbox(async()=>{
  const calls:string[]=[];
  const api=createWeddingSquareCancelTransport(async(url,init)=>{
    const u=new URL(url);calls.push(init.method+" "+u.pathname);
    assert.equal(u.origin,"https://connect.squareupsandbox.com");
    assert.equal(init.body,undefined);
    assert.equal(init.redirect,"error");
    assert.equal((init.headers as Record<string,string>)["Square-Version"],"2025-10-16");
    return response(init.method==="POST"?canceled:provider);
  });
  assert.equal((await api.get("sub-1")).canceledDate,null);
  const result=await api.cancel("sub-1");
  assert.equal(result.canceledDate,"2026-12-01");
  assert.equal(result.providerStatus,"ACTIVE");
  assert.deepEqual(calls,["GET /v2/subscriptions/sub-1","POST /v2/subscriptions/sub-1/cancel"]);
}));
test("malformed 2xx errors, mismatched subscription or bad cancellation date fail closed",()=>sandbox(async()=>{
  for(const data of [
    {...canceled,errors:null}, {...canceled,errors:[{code:"ERROR"}]},
    {...canceled,subscription:{...canceled.subscription,id:"sub-2"}},
    {...canceled,subscription:{...canceled.subscription,canceled_date:"2026-99-99"}},
    {...canceled,subscription:{...canceled.subscription,customer_id:""}},
  ]){
    let calls=0;const api=createWeddingSquareCancelTransport(async()=>{calls++;return response(data);});
    await assert.rejects(api.cancel("sub-1"),WeddingSquareCancelTransportError);
    assert.equal(calls,1);
  }
}));
test("zero network requests with production, disabled switches or invalid ID",()=>sandbox(async()=>{
  let calls=0;
  const api=createWeddingSquareCancelTransport(async()=>{calls++;return response(canceled);});
  for(const [key,value] of [
    ["SQUARE_ENV","production"],["WEDDING_SQUARE_SANDBOX_CANCEL_ENABLED","false"],
    ["SQUARE_ACCESS_TOKEN",""],
  ]as const){
    const old=process.env[key];process.env[key]=value;
    try{await assert.rejects(api.cancel("sub-1"),WeddingSquareCancelTransportError);}
    finally{if(old===undefined)delete process.env[key];else process.env[key]=old;}
  }
  await assert.rejects(api.cancel("bad id"),WeddingSquareCancelTransportError);
  assert.equal(calls,0);
}));
test("provider timeouts/HTTP errors and bad payloads never retry or leak identifiers",()=>sandbox(async()=>{
  for(const body of [
    response({errors:[{detail:"secret access token"}]},503),
    new Response("not JSON",{status:200}),
    new Response("x".repeat(65537),{status:200}),
  ]){
    let calls=0;const api=createWeddingSquareCancelTransport(async()=>{calls++;return body;});
    await assert.rejects(api.cancel("sub-1"),(err:unknown)=>{
      assert.ok(err instanceof WeddingSquareCancelTransportError);
      assert.doesNotMatch(err.message,/secret|sub-1|token/);
      return true;
    });
    assert.equal(calls,1);
  }
}));


test("native fetch cannot follow a 307 redirect and replay the provider cancellation POST",()=>sandbox(async()=>{
  let initialPosts=0;
  let replayedPosts=0;
  const server=createServer((request,res)=>{
    if(request.url==="/redirect"){
      initialPosts++;
      res.writeHead(307,{Location:"/target"});res.end();return;
    }
    replayedPosts++;
    res.writeHead(200,{"Content-Type":"application/json"});
    res.end(JSON.stringify(canceled));
  });
  server.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  try {
    const port=(server.address() as AddressInfo).port;
    // Preserve the exact production RequestInit, including redirect:error,
    // while replacing only the remote Square hostname with local test server.
    const api=createWeddingSquareCancelTransport((_squareUrl,init)=>
      fetch(`http://127.0.0.1:${port}/redirect`,init));
    await assert.rejects(api.cancel("sub-1"),WeddingSquareCancelTransportError);
    assert.equal(initialPosts,1);
    assert.equal(replayedPosts,0,"a redirect must never trigger another POST");
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
}));
