import assert from "node:assert/strict";
import { test } from "node:test";
import { mayBeginWeddingSquareSandboxCheckout, mayBeginWeddingSquareSandboxCheckoutForTester } from "./wedding-square-checkout-eligibility";
const eligible={ok:true,billingLive:false,billingMode:"sandbox",enrollmentStatus:"not_enrolled"};
test("checkout only for verified sandbox not-enrolled owner",()=>{
 assert.equal(mayBeginWeddingSquareSandboxCheckout(true,eligible),true);
 assert.equal(mayBeginWeddingSquareSandboxCheckout(false,eligible),false);
 for(const state of ["active","pending","paused","needs_reconciliation","cancellation_requested","canceled","ended","unavailable"]){
  assert.equal(mayBeginWeddingSquareSandboxCheckout(true,{...eligible,enrollmentStatus:state}),false,state);
 }
});
test("unknown or spoofed billing readback never opens card entry",()=>{
 for(const bad of [null,{}, {...eligible,ok:false},
  {...eligible,billingLive:true},{...eligible,billingMode:"disabled"},
  {...eligible,ok:"true"},{...eligible,enrollmentStatus:null}]){
  assert.equal(mayBeginWeddingSquareSandboxCheckout(true,bad),false);
 }
});

test("non-tester quote cannot expose checkout even with every lifecycle switch and an eligible billing state",()=>{
 const old={...process.env};const keys=["SQUARE_ENV","SQUARE_LIVE_PAYMENTS_ENABLED","WEDDING_SQUARE_SANDBOX_TEST_USER_ID"];
 try{
  Object.assign(process.env,{SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",WEDDING_SQUARE_SANDBOX_TEST_USER_ID:"approved-owner"});
  assert.equal(mayBeginWeddingSquareSandboxCheckoutForTester("approved-owner",true,eligible),true);
  assert.equal(mayBeginWeddingSquareSandboxCheckoutForTester("another-owner",true,eligible),false);
  assert.equal(mayBeginWeddingSquareSandboxCheckoutForTester(undefined,true,eligible),false);
  assert.equal(mayBeginWeddingSquareSandboxCheckoutForTester("approved-owner",false,eligible),false);
  assert.equal(mayBeginWeddingSquareSandboxCheckoutForTester("approved-owner",true,{...eligible,enrollmentStatus:"active"}),false);
  delete process.env.WEDDING_SQUARE_SANDBOX_TEST_USER_ID;
  assert.equal(mayBeginWeddingSquareSandboxCheckoutForTester("approved-owner",true,eligible),false);
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
