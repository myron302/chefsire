import assert from "node:assert/strict";
import {test} from "node:test";
import {createWeddingSquareLegacyCancelGuard,WeddingSquareLegacyCancellationBlocked} from "./wedding-square-legacy-cancel-guard";
function fixture(options:{blocked?:boolean,fail?:boolean}={}){
 const calls:string[]=[];
 const svc=createWeddingSquareLegacyCancelGuard({
  query:async(sql:string,args:unknown[])=>{
   calls.push("query");
   assert.deepEqual(args,["owner-1"]);
   assert.match(sql,/a\.status IN \('reserved','submitting','needs_reconciliation'\)/);
   assert.match(sql,/a\.status='confirmed'/);
   assert.match(sql,/s\.provider_status IN \('PENDING','ACTIVE','PAUSED'\)/);
   assert.match(sql,/cancellation_requested_at IS NOT NULL/);
   assert.match(sql,/a\.user_id=\$1/);
   assert.match(sql,/s\.user_id=\$1/);
   if(options.fail)throw Error("private DB token");
   return{rows:[{blocked:options.blocked??false}]};
  },
 }as any);
 return{svc,calls};
}
test("cardless trial legacy cancellation only succeeds when Neon proves no Square commitment",async()=>{
 const x=fixture();
 assert.deepEqual(await x.svc.assertCardlessOnly("owner-1"),{legacyCancellationSafe:true});
 assert.deepEqual(x.calls,["query"]);
});
test("any reserved, ambiguous, confirmed or live Square enrollment blocks local-only cancellation",async()=>{
 const x=fixture({blocked:true});
 await assert.rejects(x.svc.assertCardlessOnly("owner-1"),WeddingSquareLegacyCancellationBlocked);
 assert.deepEqual(x.calls,["query"]);
});
test("missing Neon, invalid identity or malformed data fails closed and never leaks credentials",async()=>{
 const x=fixture({fail:true});
 await assert.rejects(x.svc.assertCardlessOnly("owner-1"),e=>
  e instanceof WeddingSquareLegacyCancellationBlocked&&!/token|private/i.test(e.message));
 const y=fixture();
 await assert.rejects(y.svc.assertCardlessOnly("owner 1"),WeddingSquareLegacyCancellationBlocked);
 assert.deepEqual(y.calls,[]);
});
