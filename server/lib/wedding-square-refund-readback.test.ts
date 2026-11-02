import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareRefundReadback,WeddingSquareRefundReadbackError} from "./wedding-square-refund-readback";
const vars={SQUARE_ENV:"sandbox",SQUARE_LIVE_PAYMENTS_ENABLED:"false",WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
 SQUARE_ACCESS_TOKEN:"sandbox-secret",SQUARE_LOCATION_ID:"loc"};
async function enabled(fn:()=>Promise<void>){const old={...process.env};Object.assign(process.env,vars);
 try{await fn();}finally{for(const k of Object.keys(vars))if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
const refund={id:"refund-1",payment_id:"payment-1",location_id:"loc",status:"COMPLETED",amount_money:{amount:100,currency:"USD"}};
const payment={id:"payment-1",customer_id:"owner-customer",location_id:"loc",status:"COMPLETED",
 amount_money:{amount:2499,currency:"USD"},total_money:{amount:2499,currency:"USD"},
 refunded_money:{amount:100,currency:"USD"},refund_ids:["refund-1"]};
test("refund and original payment must independently agree on identity and returned funds",()=>enabled(async()=>{
 const calls:string[]=[];
 const api=createWeddingSquareRefundReadback(async(url,init)=>{calls.push(url);assert.equal(init.method,"GET");
  assert.equal(init.redirect,"error");return Response.json(url.includes("/refunds/")?{refund}:{payment});});
 assert.deepEqual(await api.inspect("refund-1"),{refundId:"refund-1",paymentId:"payment-1",customerId:"owner-customer",
  locationId:"loc",amountCents:2499,completedRefund:true,grantsEntitlement:false});
 assert.deepEqual(calls,["https://connect.squareupsandbox.com/v2/refunds/refund-1","https://connect.squareupsandbox.com/v2/payments/payment-1"]);
}));
test("pending, foreign, mixed-error, unlinked and mismatched refund/payment records fail closed",()=>enabled(async()=>{
 for(const [r,p,envelope] of [
  [{...refund,status:"PENDING"},payment,{}], [{...refund,location_id:"foreign"},payment,{}],
  [{...refund,unlinked:true},payment,{}], [refund,{...payment,id:"other"},{}],
  [refund,{...payment,refund_ids:["another-refund"]},{}],
  [refund,{...payment,refunded_money:{amount:0,currency:"USD"}},{}],
  [refund,payment,{errors:null}], [refund,payment,{errors:[{code:"DENIED"}]}],
 ] as const){const api=createWeddingSquareRefundReadback(async url=>Response.json({...envelope,...(url.includes("/refunds/")?{refund:r}:{payment:p})}));
  await assert.rejects(api.inspect("refund-1"),WeddingSquareRefundReadbackError);}
}));
test("production, live-enabled, invalid IDs and network faults never verify a refund",()=>enabled(async()=>{
 let calls=0;const api=createWeddingSquareRefundReadback(async()=>{calls++;throw Error("secret provider error");});
 await assert.rejects(api.inspect(" padded"),WeddingSquareRefundReadbackError);assert.equal(calls,0);
 process.env.SQUARE_ENV="production";await assert.rejects(api.inspect("refund-1"));assert.equal(calls,0);
 process.env.SQUARE_ENV="sandbox";process.env.SQUARE_LIVE_PAYMENTS_ENABLED="true";
 await assert.rejects(api.inspect("refund-1"));assert.equal(calls,0);
 process.env.SQUARE_LIVE_PAYMENTS_ENABLED="false";
 await assert.rejects(api.inspect("refund-1"),error=>{assert.doesNotMatch(String(error),/secret provider/);return true;});
}));
