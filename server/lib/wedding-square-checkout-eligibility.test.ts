import assert from "node:assert/strict";
import { test } from "node:test";
import { mayBeginWeddingSquareSandboxCheckout } from "./wedding-square-checkout-eligibility";
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
