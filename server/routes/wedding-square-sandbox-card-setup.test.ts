import assert from "node:assert/strict";
import { test } from "node:test";
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { createWeddingSquareCardSetupRouter } from "./wedding-square-sandbox-card-setup";

const keys = [
  "SQUARE_ENV","SQUARE_APPLICATION_ID","SQUARE_ACCESS_TOKEN","SQUARE_LOCATION_ID",
  "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","WEDDING_SQUARE_ALLOWED_ORIGIN",
  "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
  "WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED",
  "WEDDING_SQUARE_SANDBOX_CARD_SETUP_HTTP_ENABLED",
  "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID",
  "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID",
  "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID",
  "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID",
];
async function configured(work: () => Promise<void>) {
  const old = keys.map(name => process.env[name]);
  Object.assign(process.env, {
    SQUARE_ENV:"sandbox", SQUARE_APPLICATION_ID:"sandbox-app",SQUARE_ACCESS_TOKEN:"sandbox-test-token",
    SQUARE_LOCATION_ID:"location-1",WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",
    WEDDING_SQUARE_ALLOWED_ORIGIN:"https://chefsire.example",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_CARD_SETUP_HTTP_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_ID:"premium-parent",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_ID:"elite-parent",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID:"premium-variation",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID:"elite-variation",
  });
  try { await work(); } finally { keys.forEach((key,i) =>
    old[i] === undefined ? delete process.env[key] : process.env[key] = old[i]); }
}
async function serve(router: ReturnType<typeof createWeddingSquareCardSetupRouter>,
  work: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use("/api/wedding",router);
  const server = app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve => server.once("listening",resolve));
  try {
    await work("http://127.0.0.1:"+(server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
}
function fixture(opts: { error?: boolean; verified?: boolean } = {}) {
  let submitted=0;
  const steps:string[]=[];
  const svc = {
    setup:async(input: any) => {
      submitted++;
      steps.push("setup");
      assert.equal(input.consent.userId,"owner-1");
      assert.equal(input.consent.agreedMonthlyAmountCents,2499);
      assert.equal(input.config.planVariationId,"premium-variation");
      assert.equal(input.sourceId,"cnon:sample-token");
      if (opts.error) throw Error("private provider error");
      return { status:"reserved",paidEntitlementGranted:false,safeToResubmit:false,
        attemptId:"123e4567-e89b-42d3-a456-426614174001" };
    },
  };
  const owner = { getUser:async()=>{steps.push("owner");return ({
    id:"owner-1",email:"tester@example.com",
    emailVerifiedAt:opts.verified === false ? null : new Date(),
    emailVerifiedVia:opts.verified === false ? null : "google",
  });} };
  const trial = async()=>{steps.push("trial");return ({trial:{status:"expired",expiresAt:null}});};
  const auth:RequestHandler=(req,_res,next)=>{req.user={id:"owner-1"};next();};
  const noRateLimit:RequestHandler=(_req,_res,next)=>next();
  return { router:createWeddingSquareCardSetupRouter(svc as any,owner as any,
    trial as any,auth,noRateLimit), submitted:()=>submitted, steps };
}
const body={ sourceId:"cnon:sample-token",consent:{
  tier:"premium",consentVersion:"wedding-monthly-autorenew-v1",
  acceptedAutomaticMonthlyRenewal:true,acceptedAmountCents:2499,
  acceptedCurrency:"USD",acknowledgedFirstChargeStartDate:null,
}};
function post(base:string, payload: unknown=body, origin="https://chefsire.example") {
  return fetch(base+"/api/wedding/subscription/sandbox/card-setup",{
    method:"POST",headers:{"Content-Type":"application/json",Origin:origin},
    body:JSON.stringify(payload),
  });
}
test("private config exposes only browser-safe sandbox application/location IDs", async()=>configured(async()=>{
  const x=fixture();
  await serve(x.router,async base=>{
    const res=await fetch(base+"/api/wedding/subscription/sandbox/card-config");
    assert.equal(res.status,200);
    assert.equal(res.headers.get("cache-control"),"private, no-store");
    const data=await res.json();
    assert.equal(data.squareEnvironment,"sandbox");
    assert.equal(data.billingLive,false);
    assert.doesNotMatch(JSON.stringify(data),/sandbox-test-token|merchant-1|secret/);
  });
}));
test("owner-only card setup returns attempt ID but no card/customer/payment IDs",async()=>configured(async()=>{
  const x=fixture();
  await serve(x.router,async base=>{
    const res=await post(base);
    assert.equal(res.status,202,"Stages: "+x.steps.join(","));
    const data=await res.json();
    assert.equal(data.status,"subscription_reserved");
    assert.equal(data.paidEntitlementGranted,false);
    assert.doesNotMatch(JSON.stringify(data),/cnon:|cust|card|merchant|token/i);
  });
  assert.equal(x.submitted(),1);
}));
test("cross-site POST or missing verified email never sends a Square request",async()=>configured(async()=>{
  const x=fixture({verified:false});
  await serve(x.router,async base=>{
    assert.equal((await post(base,body,"https://evil.example")).status,403);
    assert.equal((await post(base)).status,409);
  });
  assert.equal(x.submitted(),0);
}));
test("provider uncertainty is sanitized and cannot be safely retried",async()=>configured(async()=>{
  const x=fixture({error:true});
  await serve(x.router,async base=>{
    const res=await post(base);
    assert.equal(res.status,409);
    const data=await res.json();
    assert.equal(data.safeToRetry,false);
    assert.doesNotMatch(JSON.stringify(data),/private provider error|sandbox-test-token/);
  });
}));
test("HTTP setup disabled by default without provider or DB access",async()=>configured(async()=>{
  const x=fixture();
  process.env.WEDDING_SQUARE_SANDBOX_CARD_SETUP_HTTP_ENABLED="false";
  await serve(x.router,async base=>{
    assert.equal((await post(base)).status,503);
  });
  assert.equal(x.submitted(),0);
}));
