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
 await assert.rejects(api.inspectPayment(" padded"),WeddingSquareRefundReadbackError);assert.equal(calls,0);
 process.env.SQUARE_ENV="production";await assert.rejects(api.inspect("refund-1"));assert.equal(calls,0);
 await assert.rejects(api.inspectPayment("payment-1"));assert.equal(calls,0);
 process.env.SQUARE_ENV="sandbox";process.env.SQUARE_LIVE_PAYMENTS_ENABLED="true";
 await assert.rejects(api.inspect("refund-1"));assert.equal(calls,0);
 await assert.rejects(api.inspectPayment("payment-1"));assert.equal(calls,0);
 process.env.SQUARE_LIVE_PAYMENTS_ENABLED="false";
 await assert.rejects(api.inspect("refund-1"),error=>{assert.doesNotMatch(String(error),/secret provider/);return true;});
 await assert.rejects(api.inspectPayment("payment-1"),error=>{assert.doesNotMatch(String(error),/secret provider/);return true;});
}));
test("a payment hint resolves its completed partial or full refund using fresh GETs",()=>enabled(async()=>{
 for(const refunded of [100,2499]){
  const calls:string[]=[];
  const api=createWeddingSquareRefundReadback(async(url,init)=>{
   calls.push(url);assert.equal(init.method,"GET");assert.equal(init.redirect,"error");
   assert.equal(new URL(url).origin,"https://connect.squareupsandbox.com");
   return Response.json(url.includes("/refunds/")?{refund}:{payment:{...payment,refunded_money:{amount:refunded,currency:"USD"}}});
  });
  assert.equal((await api.inspectPayment("payment-1")).completedRefund,true);
  assert.deepEqual(calls,["https://connect.squareupsandbox.com/v2/payments/payment-1",
   "https://connect.squareupsandbox.com/v2/refunds/refund-1","https://connect.squareupsandbox.com/v2/payments/payment-1"]);
 }
}));
test("payment refund discovery rejects missing, malformed, foreign or drifting provider evidence",()=>enabled(async()=>{
 for(const bad of [{id:"foreign"},{location_id:"foreign"},{refund_ids:[]},{refund_ids:["refund-1","refund-1"]},
  {refunded_money:{amount:0,currency:"USD"}},{refunded_money:{amount:2500,currency:"USD"}},
  {refunded_money:null},{total_money:{amount:2500,currency:"USD"}}]){
  const api=createWeddingSquareRefundReadback(async(url)=>Response.json(url.includes("/refunds/")?{refund}:{payment:{...payment,...bad}}));
  await assert.rejects(api.inspectPayment("payment-1"),WeddingSquareRefundReadbackError);
 }
 let paymentReads=0;
 const changed=createWeddingSquareRefundReadback(async(url)=>Response.json(url.includes("/refunds/")?{refund}:
  {payment:{...payment,customer_id:++paymentReads===1?"owner-customer":"foreign"}}));
 await assert.rejects(changed.inspectPayment("payment-1"),WeddingSquareRefundReadbackError);
}));
test("pending refunds are never proof and discovery has a bounded candidate count",()=>enabled(async()=>{
 let refundReads=0;
 const api=createWeddingSquareRefundReadback(async(url)=>{
  if(url.includes("/refunds/")){refundReads++;return Response.json({refund:{...refund,status:"PENDING"}});}
  return Response.json({payment:{...payment,refund_ids:Array.from({length:11},(_,i)=>`refund-${i+1}`)}});
 });
 await assert.rejects(api.inspectPayment("payment-1"),WeddingSquareRefundReadbackError);
 assert.equal(refundReads,10);
}));
test("a pending candidate does not hide a later independently completed refund",()=>enabled(async()=>{
 const api=createWeddingSquareRefundReadback(async(url)=>Response.json(
  url.includes("/refunds/")?{refund:{...refund,id:url.endsWith("refund-2")?"refund-2":"refund-1",
   status:url.endsWith("refund-2")?"COMPLETED":"PENDING"}}:
   {payment:{...payment,refund_ids:["refund-1","refund-2"]}}));
 assert.equal((await api.inspectPayment("payment-1")).refundId,"refund-2");
}));
