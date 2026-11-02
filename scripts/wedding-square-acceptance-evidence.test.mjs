import {test} from "node:test";
import assert from "node:assert/strict";
import {assessWeddingSquareEvidence,collectWeddingSquareEvidence} from "./wedding-square-acceptance-evidence.mjs";
const empty=()=>Object.fromEntries(["cardSetups","enrollmentAttempts","subscriptions","invoicePayments","freshPayments","revokedPayments","cancellations","failedWebhooks","pendingWebhooks","unresolvedCardSetups","unresolvedEnrollments"].map(k=>[k,0]));
test("empty database never qualifies as completed Square acceptance",()=>{
 const out=assessWeddingSquareEvidence(empty());
 assert.equal(out.realProviderAcceptancePassed,false);
 assert.equal(out.liveBillingActivated,false);
 assert.ok(out.blockers.length>=3);
});
test("nonempty aggregates still cannot substitute for Square provider verification",()=>{
 const row=Object.fromEntries(Object.keys(empty()).map(k=>[k,1]));
 row.failedWebhooks=0;row.pendingWebhooks=0;row.unresolvedCardSetups=0;row.unresolvedEnrollments=0;
 const out=assessWeddingSquareEvidence(row);
 assert.equal(out.realProviderAcceptancePassed,false);
 assert.deepEqual(out.blockers,[]);
 assert.equal(out.readOnly,true);
});
test("bad counters and non-sandbox environment fail closed",async()=>{
 for(const v of [-1,1.5,"NaN",undefined]){
  assert.throws(()=>assessWeddingSquareEvidence({...empty(),subscriptions:v}));
 }
 let called=false;
 await assert.rejects(collectWeddingSquareEvidence({SQUARE_ENV:"production",DATABASE_URL:"secret"},()=>{called=true;}));
 assert.equal(called,false);
});
test("script never prints provider identifiers or individual owners",()=>{
 const result=JSON.stringify(assessWeddingSquareEvidence(empty()));
 assert.doesNotMatch(result,/customerId|cardId|paymentId|userId|accessToken/);
});
