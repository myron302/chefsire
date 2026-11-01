import assert from "node:assert/strict";
import { test } from "node:test";
import { weddingEntitlement } from "./wedding-entitlement";
import { WeddingSquarePaidEvidenceUnavailableError } from "./wedding-square-paid-entitlement";

const expiry=new Date(Date.now()+7*24*60*60*1000).toISOString();
async function enabled(fn:()=>Promise<void>){
  const keys=["WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED","SQUARE_ENV",
    "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","WEDDING_SQUARE_SANDBOX_MERCHANT_ID",
    "SQUARE_LOCATION_ID"] as const;
  const before=keys.map(key=>process.env[key]);
  Object.assign(process.env,{
    WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED:"true",
    SQUARE_ENV:"sandbox",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1",
  });
  try{await fn();}finally{keys.forEach((key,i)=>{if(before[i]===undefined)delete process.env[key];else process.env[key]=before[i];});}
}
function trialExecutor(tier:"elite"|"premium"|null){
  let count=0;
  return {execute:async()=>{
    count++;
    if(count===1)return {rows:tier?[{
      tier,activatedAt:new Date(Date.now()-7*24*60*60*1000).toISOString(),
      expiresAt:expiry,revokedAt:null,active:true,remainingDays:7,
    }]:[]};
    throw Error("Paid evidence read outage");
  },getCalls:()=>count};
}
test("a valid independent Elite cardless trial survives paid-evidence failure",()=>enabled(async()=>{
  const db=trialExecutor("elite");
  const result=await weddingEntitlement("owner-1","free",db as any);
  assert.equal(result.currentTier,"elite");
  assert.equal(result.status,"active");
  assert.equal(result.trial.status,"active");
  assert.equal(result.endsAt,expiry);
  assert.equal(db.getCalls(),2,"paid proof was attempted, but independent trial survived");
}));
test("an active Premium cardless trial survives ambiguous paid evidence",()=>enabled(async()=>{
  const result=await weddingEntitlement("owner-1","elite",trialExecutor("premium") as any);
  assert.equal(result.currentTier,"premium","legacy Elite record cannot upgrade Premium trial");
  assert.equal(result.status,"active");
}));
test("without an independently active trial, paid evidence outage fails closed",()=>enabled(async()=>{
  await assert.rejects(weddingEntitlement("owner-1","elite",trialExecutor(null) as any),
    WeddingSquarePaidEvidenceUnavailableError);
}));
