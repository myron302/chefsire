import assert from "node:assert/strict";
import test from "node:test";
import { isWeddingSquareSandboxTester } from "./wedding-square-sandbox-tester";
test("tester scope requires an exact authenticated ID and explicit sandbox/live-off context",()=>{
 const old={...process.env};const keys=["SQUARE_ENV","SQUARE_LIVE_PAYMENTS_ENABLED","WEDDING_SQUARE_SANDBOX_TEST_USER_ID"];
 try{
  Object.assign(process.env,{SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",WEDDING_SQUARE_SANDBOX_TEST_USER_ID:"approved-owner"});
  assert.equal(isWeddingSquareSandboxTester("approved-owner"),true);
  for(const id of [undefined,null,"","another-owner"," approved-owner","approved-owner\n",{id:"approved-owner"}])assert.equal(isWeddingSquareSandboxTester(id),false);
  for(const selected of [undefined,""," approved-owner","approved-owner,another-owner","*"]){
    if(selected===undefined)delete process.env.WEDDING_SQUARE_SANDBOX_TEST_USER_ID;else process.env.WEDDING_SQUARE_SANDBOX_TEST_USER_ID=selected;
    assert.equal(isWeddingSquareSandboxTester("approved-owner"),false);
  }
  process.env.WEDDING_SQUARE_SANDBOX_TEST_USER_ID="approved-owner";
  process.env.SQUARE_ENV="production";assert.equal(isWeddingSquareSandboxTester("approved-owner"),false);
  process.env.SQUARE_ENV="sandbox";process.env.SQUARE_LIVE_PAYMENTS_ENABLED="true";assert.equal(isWeddingSquareSandboxTester("approved-owner"),false);
  delete process.env.SQUARE_LIVE_PAYMENTS_ENABLED;assert.equal(isWeddingSquareSandboxTester("approved-owner"),false);
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
