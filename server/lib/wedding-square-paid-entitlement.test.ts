import assert from "node:assert/strict";
import { test } from "node:test";
import { readVerifiedWeddingPaid, WeddingSquarePaidEvidenceUnavailableError } from "./wedding-square-paid-entitlement";

const paidAt = new Date(Date.now() + 86400_000).toISOString();
async function sandbox(fn:()=>Promise<void>){
  const keys=["WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED","SQUARE_ENV",
    "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","WEDDING_SQUARE_SANDBOX_MERCHANT_ID",
    "SQUARE_LOCATION_ID"] as const;
  const previous=keys.map(k=>process.env[k]);
  Object.assign(process.env,{
    WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED:"true",
    SQUARE_ENV:"sandbox",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1",
  });
  try { await fn(); } finally {
    keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];});
  }
}
function executor(rows:unknown[]|null, spy:{calls:number,sql:string}){
  return {execute:async(q:{queryChunks?:unknown[]})=>{
    spy.calls++;spy.sql=JSON.stringify(q);
    return rows===null?{bad:"no rows"}:{rows};
  }} as any;
}
const valid={subscriptionId:"11111111-1111-4111-8111-111111111111",
  tier:"premium",paidThrough:paidAt,evidenceCount:1};

test("reader is OFF by default and never touches Neon",async()=>{
  const old=process.env.WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED;
  delete process.env.WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED;
  try{
    const spy={calls:0,sql:""};
    assert.equal(await readVerifiedWeddingPaid("user-1",executor([valid],spy)),null);
    assert.equal(spy.calls,0);
  }finally{if(old!==undefined)process.env.WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED=old;}
});
test("valid unique premium or elite evidence produces only tier and evidenced expiry",()=>sandbox(async()=>{
  for(const tier of ["premium","elite"]as const){
    const spy={calls:0,sql:""};
    const a=await readVerifiedWeddingPaid("owner-1",executor([{...valid,tier}],spy));
    assert.deepEqual(a,{tier,paidThrough:paidAt});
    assert.equal(Object.isFrozen(a),true);
    assert.equal(spy.calls,1);
  }
}));
test("no evidence or expired coverage cannot manufacture paid access",()=>sandbox(async()=>{
  assert.equal(await readVerifiedWeddingPaid("owner-1",executor([],{calls:0,sql:""})),null);
  const spy={calls:0,sql:""};
  for(const row of [
    {...valid,paidThrough:"not-a-date"},
    {...valid,paidThrough:new Date(Date.now()-3600_000).toISOString()},
    {...valid,evidenceCount:0},{...valid,evidenceCount:"1"},
    {...valid,subscriptionId:"bad id"},{...valid,tier:"free"},
  ]){
    await assert.rejects(readVerifiedWeddingPaid("owner-1",executor([row],spy)),
      WeddingSquarePaidEvidenceUnavailableError);
  }
  await assert.rejects(readVerifiedWeddingPaid("owner-1",executor(null,spy)),
    WeddingSquarePaidEvidenceUnavailableError);
}));
test("overlapping subscriptions and SQL outage fail closed rather than select Elite",()=>sandbox(async()=>{
  await assert.rejects(readVerifiedWeddingPaid("owner-1",executor([
    valid,{...valid,tier:"elite",subscriptionId:"22222222-2222-4222-8222-222222222222"},
  ],{calls:0,sql:""})),WeddingSquarePaidEvidenceUnavailableError);
  await assert.rejects(readVerifiedWeddingPaid("owner-1",{
    execute:async()=>{throw Error("Private Neon token");},
  }as any),e=>e instanceof WeddingSquarePaidEvidenceUnavailableError &&
    !/token|Neon/i.test(e.message));
}));
test("live/disabled/bad authenticated identity never reads evidence",()=>sandbox(async()=>{
  for(const [key,value] of [["SQUARE_ENV","production"],
    ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","false"]]as const){
    const before=process.env[key];process.env[key]=value;
    try{
      const spy={calls:0,sql:""};
      await assert.rejects(readVerifiedWeddingPaid("owner-1",executor([valid],spy)),
        WeddingSquarePaidEvidenceUnavailableError);
      assert.equal(spy.calls,0);
    }finally{if(before===undefined)delete process.env[key];else process.env[key]=before;}
  }
  const spy={calls:0,sql:""};
  await assert.rejects(readVerifiedWeddingPaid("bad user id",executor([valid],spy)),
    WeddingSquarePaidEvidenceUnavailableError);
  assert.equal(spy.calls,0);
}));
