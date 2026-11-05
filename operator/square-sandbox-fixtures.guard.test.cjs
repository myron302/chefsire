'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validate,paymentProof,reserveIntent,SPECS,GATES}=require('./square-sandbox-fixtures.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const env={SQUARE_ENV:'sandbox',SQUARE_LIVE_PAYMENTS_ENABLED:'false',WEDDING_SQUARE_ALLOWED_ORIGIN:'https://chefsire.com',SQUARE_ACCESS_TOKEN:'official-test-placeholder',SQUARE_LOCATION_ID:'location',WEDDING_SQUARE_SANDBOX_MERCHANT_ID:'merchant',...Object.fromEntries(GATES.map(k=>[k,'false']))};
const owner={user_id:'e361538e-10b2-4629-bcfa-1c95e4c2132b',username:'myron-ware',verified:true,square_customer_id:'owned-customer',square_merchant_id:'merchant',square_location_id:'location',square_environment:'sandbox'};
test('operator guard requires Sandbox, live off, every lifecycle switch off and exact verified tester',()=>{
 assert.doesNotThrow(()=>validate(env,owner));
 for(const change of [{SQUARE_ENV:'production'},{SQUARE_LIVE_PAYMENTS_ENABLED:'true'},{SQUARE_LIVE_PAYMENTS_ENABLED:undefined},{SQUARE_ACCESS_TOKEN:''},{WEDDING_SQUARE_ALLOWED_ORIGIN:'https://elsewhere.test'}])assert.throws(()=>validate({...env,...change},owner),/SAFETY_GUARD/);
 for(const gate of GATES)assert.throws(()=>validate({...env,[gate]:'true'},owner),/SAFETY_GUARD/);
 for(const change of [{user_id:'another-user'},{verified:false},{username:'other'},{square_customer_id:null},{square_merchant_id:'foreign'},{square_location_id:'foreign'},{square_environment:'production'}])assert.throws(()=>validate(env,{...owner,...change}),/SAFETY_GUARD/);
});
test('standalone fixture proof rejects foreign owners, amounts, status, reference and currency',()=>{
 const spec=SPECS[1],p={id:'payment',status:'COMPLETED',customer_id:'owned-customer',location_id:'location',reference_id:spec.reference,amount_money:{amount:4999,currency:'USD'},total_money:{amount:4999,currency:'USD'}};
 assert.equal(paymentProof(p,owner,env,spec).amountCents,4999);
 for(const change of [{status:'APPROVED'},{customer_id:'foreign'},{location_id:'foreign'},{reference_id:'unrelated'},{amount_money:{amount:8801,currency:'USD'}},{total_money:{amount:4999,currency:'EUR'}}])assert.throws(()=>paymentProof({...p,...change},owner,env,spec),/PAYMENT_BINDING/);
 assert.deepEqual(SPECS.map(s=>s.amount),[4999,4999,8801]);
 assert.equal(SPECS[0].source,'cnon:card-nonce-declined');
 assert.equal(SPECS.slice(1).every(s=>s.source==='cnon:card-nonce-ok'),true);
 assert.equal(Object.isFrozen(SPECS),true);
});
test('durable intent precedes a write, excludes credentials, and blocks duplicate or unknown outcomes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'square-fixture-'));
 try{
  const details={customerId:'owned-customer',userId:owner.user_id,amountCents:4999,referenceId:SPECS[1].reference,token:'must-not-persist',sourceId:'must-not-persist'};
  const intent=reserveIntent(dir,'recovery',details);
  const file=path.join(dir,'recovery-intent.json'),saved=fs.readFileSync(file,'utf8');
  assert.equal(intent.amountCents,4999);assert.ok(Object.isFrozen(intent));
  assert.match(intent.idempotencyKey,/^[a-f0-9-]{36}$/);
  assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.doesNotMatch(saved,/must-not-persist|sourceId|token/);
  assert.throws(()=>reserveIntent(dir,'recovery',details),/DO_NOT_RETRY/);
  assert.equal(fs.readFileSync(file,'utf8'),saved);
  assert.throws(()=>reserveIntent(dir,'other',details),/INTENT_GUARD/);
  assert.throws(()=>reserveIntent(dir,'dispute',details),/INTENT_GUARD/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
