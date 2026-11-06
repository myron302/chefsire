'use strict';
// Private operator acceptance runner. Never mounted as an application route.
// The owner executes the final command; official Square test tokens only.
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {createRequire} = require('node:module');
const APP = '/var/www/vhosts/chefsire.com/httpdocs';
const DIR = '/var/www/vhosts/chefsire.com/private/chefsire-square-provider-fixtures';
const TESTER = 'e361538e-10b2-4629-bcfa-1c95e4c2132b';
const GATES = ['CANCEL','CARD_SETUP_HTTP','CARD_UPDATE','CUSTOMER_CARD_WRITE','EVIDENCE_WRITE','PAYMENT_EVENTS','RECONCILIATION_BATCH','RECONCILIATION','RENEWAL_SCAN','SUBMIT'].map(x=>'WEDDING_SQUARE_SANDBOX_'+x+'_ENABLED').concat('WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED');
const SPECS = Object.freeze([
  Object.freeze({kind:'decline',amount:4999,source:'cnon:card-nonce-declined',reference:'wedding-acceptance-decline-v1'}),
  Object.freeze({kind:'recovery',amount:4999,source:'cnon:card-nonce-ok',reference:'wedding-acceptance-recovery-v1'}),
  Object.freeze({kind:'dispute',amount:8801,source:'cnon:card-nonce-ok',reference:'wedding-acceptance-dispute-v1'}),
]);
function validate(env,owner) {
  if(env.SQUARE_ENV!=='sandbox'||env.SQUARE_LIVE_PAYMENTS_ENABLED!=='false'||
    env.WEDDING_SQUARE_ALLOWED_ORIGIN!=='https://chefsire.com'||!GATES.every(k=>env[k]==='false')||
    typeof env.SQUARE_ACCESS_TOKEN!=='string'||!env.SQUARE_ACCESS_TOKEN||
    !env.SQUARE_LOCATION_ID||!env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID||
    owner?.user_id!==TESTER||owner?.username!=='myron-ware'||owner?.verified!==true||
    !owner.square_customer_id||owner.square_environment!=='sandbox'||
    owner.square_merchant_id!==env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID||owner.square_location_id!==env.SQUARE_LOCATION_ID) throw Error('SAFETY_GUARD');
}
function paymentProof(p,owner,env,spec) {
  if(!p||typeof p.id!=='string'||p.status!=='COMPLETED'||
    p.customer_id!==owner.square_customer_id||p.location_id!==env.SQUARE_LOCATION_ID||
    p.reference_id!==spec.reference||p.amount_money?.amount!==spec.amount||p.amount_money?.currency!=='USD'||
    p.total_money?.amount!==spec.amount||p.total_money?.currency!=='USD')throw Error('PAYMENT_BINDING');
  return {id:p.id,status:p.status,amountCents:spec.amount,currency:'USD',referenceId:spec.reference};
}
function reserveIntent(dir,kind,details) {
  if(!['decline','recovery','dispute','recovery-refund'].includes(kind)||
    details.amountCents!==(kind==='dispute'?8801:4999))throw Error('INTENT_GUARD');
  const file=path.join(dir,kind+'-intent.json');
  if(fs.existsSync(file))throw Error('UNCERTAIN_PREVIOUS_WRITE_DO_NOT_RETRY');
  const intent={idempotencyKey:randomUUID(),customerId:details.customerId,userId:details.userId,
    paymentId:details.paymentId,amountCents:details.amountCents,currency:'USD',referenceId:details.referenceId};
  const fd=fs.openSync(file,'wx',0o600);
  try {fs.writeFileSync(fd,JSON.stringify(intent,null,2));fs.fsyncSync(fd);}
  finally {fs.closeSync(fd);}
  const parent=fs.openSync(dir,'r');
  try {fs.fsyncSync(parent);}finally {fs.closeSync(parent);}
  return Object.freeze(intent);
}
function refundProof(f,paymentId,expectedId,locationId) {
  if(!f||typeof expectedId!=='string'||!expectedId||/\s/.test(expectedId)||f.id!==expectedId||
    f.payment_id!==paymentId||f.location_id!==locationId||f.amount_money?.amount!==4999||
    f.amount_money?.currency!=='USD'||!['PENDING','COMPLETED'].includes(f.status))throw Error('REFUND_REQUIRES_REVIEW');
  return {id:f.id,paymentId:f.payment_id,status:f.status,amountCents:4999,currency:'USD'};
}
async function verifyCachedRefund(get,cached,paymentId,locationId) {
  if(!cached||typeof cached.id!=='string'||!cached.id||/\s/.test(cached.id)||cached.paymentId!==paymentId)throw Error('REFUND_REQUIRES_REVIEW');
  return refundProof((await get('refunds/'+encodeURIComponent(cached.id))).refund,paymentId,cached.id,locationId);
}
function runtime() {
  for(const pid of fs.readdirSync('/proc').filter(x=>/^[0-9]+$/.test(x)).sort((a,b)=>Number(b)-Number(a))) {
    try {
      if(!fs.readFileSync('/proc/'+pid+'/cmdline','utf8').startsWith('Passenger NodeApp:'))continue;
      const env=Object.fromEntries(fs.readFileSync('/proc/'+pid+'/environ','utf8').split(String.fromCharCode(0)).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
      if(env.WEDDING_SQUARE_ALLOWED_ORIGIN==='https://chefsire.com'&&env.DATABASE_URL&&env.JWT_SECRET)return env;
    } catch {}
  }
  throw Error('RUNTIME_UNAVAILABLE');
}
async function main() {
  let pool;
  const out={kind:'official-square-sandbox-fixtures',sandbox:true,liveBillingEnabled:false,grantsWeddingEntitlement:false,results:[]};
  try {
    const env=runtime();
    Object.assign(process.env,env);
    const req=createRequire(APP+'/package.json');req('tsx/cjs');
    pool=new (req('pg').Pool)({connectionString:env.DATABASE_URL,connectionTimeoutMillis:5000,max:1});
    const owners=(await pool.query("SELECT s.user_id,u.username,s.square_customer_id,s.square_merchant_id,s.square_location_id,s.square_environment,u.email_verified_at IS NOT NULL AND u.email_verified_via IN ('email_link','google') AS verified FROM wedding_square_subscriptions s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1 AND s.square_environment='sandbox' AND s.square_merchant_id=$2 AND s.square_location_id=$3",[TESTER,env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID,env.SQUARE_LOCATION_ID])).rows;
    if(owners.length!==1)throw Error('OWNER_BINDING');const owner=owners[0];validate(env,owner);
    const attestation=await req(APP+'/server/lib/wedding-square-sandbox-merchant-attestation.ts').weddingSquareSandboxMerchantAttestation.inspect();
    if(attestation.verifiedSandboxMerchantContext!==true||attestation.merchantId!==env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID||attestation.locationId!==env.SQUARE_LOCATION_ID)throw Error('MERCHANT_BINDING');
    fs.mkdirSync(DIR,{recursive:true,mode:0o700});fs.chmodSync(DIR,0o700);
    const save=(name,value,exclusive=false)=>fs.writeFileSync(path.join(DIR,name),JSON.stringify(value,null,2),{mode:0o600,flag:exclusive?'wx':'w'});
    const read=name=>fs.existsSync(path.join(DIR,name))?JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8')):null;
    async function request(route,body) {
      const method=body?'POST':'GET';
      if(body&&!['payments','refunds'].includes(route))throw Error('ROUTE_GUARD');
      const response=await fetch('https://connect.squareupsandbox.com/v2/'+route,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+env.SQUARE_ACCESS_TOKEN,'Square-Version':'2025-10-16',Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
      const data=await response.json();return {status:response.status,data};
    }
    const clean=d=>d&&typeof d==='object'&&!Array.isArray(d)&&(d.errors===undefined||(Array.isArray(d.errors)&&d.errors.length===0));
    async function get(route) {const r=await request(route);if(r.status!==200||!clean(r.data))throw Error('PROVIDER_READ');return r.data;}
    const customer=(await get('customers/'+encodeURIComponent(owner.square_customer_id))).customer;
    if(customer?.id!==owner.square_customer_id||customer.reference_id!==TESTER)throw Error('CUSTOMER_BINDING');
    let cursor,pages=0;const existing=[];
    do {const d=await get('payments?limit=100&location_id='+encodeURIComponent(env.SQUARE_LOCATION_ID)+(cursor?'&cursor='+encodeURIComponent(cursor):''));existing.push(...(d.payments||[]).filter(p=>p.customer_id===owner.square_customer_id&&SPECS.some(s=>s.reference===p.reference_id)));cursor=d.cursor;pages++;}while(cursor&&pages<3);
    if(cursor)throw Error('PAYMENT_PAGINATION');
    for(const spec of SPECS) {
      const name=spec.kind+'-result.json',prior=read(name),matches=existing.filter(p=>p.reference_id===spec.reference);
      if(matches.length>1)throw Error('AMBIGUOUS_EXISTING_FIXTURE');
      if(prior) {
        if(spec.kind==='decline') {if(prior.declined!==true)throw Error('PRIOR_DECLINE_UNCERTAIN');out.results.push(prior);continue;}
        const proof=paymentProof((await get('payments/'+encodeURIComponent(prior.payment?.id))).payment,owner,env,spec);
        out.results.push({...prior,payment:proof,reused:true});continue;
      }
      if(matches.length) {
        if(spec.kind==='decline')throw Error('EXISTING_DECLINE_REQUIRES_REVIEW');
        const result={kind:spec.kind,payment:paymentProof((await get('payments/'+encodeURIComponent(matches[0].id))).payment,owner,env,spec),reused:true,grantsWeddingEntitlement:false};save(name,result,true);out.results.push(result);continue;
      }
      const intent=reserveIntent(DIR,spec.kind,{customerId:owner.square_customer_id,userId:TESTER,amountCents:spec.amount,referenceId:spec.reference});
      const r=await request('payments',{source_id:spec.source,idempotency_key:intent.idempotencyKey,customer_id:owner.square_customer_id,location_id:env.SQUARE_LOCATION_ID,amount_money:{amount:spec.amount,currency:'USD'},autocomplete:true,reference_id:spec.reference,note:'ChefSire standalone sandbox acceptance fixture; never Wedding invoice evidence'});
      const codes=Array.isArray(r.data.errors)?r.data.errors.map(e=>e.code).filter(c=>typeof c==='string'&&/^[A-Z_]{1,80}$/.test(c)):[];
      if(spec.kind==='decline') {
        const declined=[400,402].includes(r.status)&&codes.some(c=>['GENERIC_DECLINE','CARD_DECLINED'].includes(c))&&(!r.data.payment||r.data.payment.status==='FAILED');
        const result={kind:spec.kind,httpStatus:r.status,errorCodes:codes,declined,paymentId:r.data.payment?.id||null,grantsWeddingEntitlement:false};save(name,result,true);out.results.push(result);if(!declined)throw Error('EXPECTED_DECLINE_NOT_OBSERVED');
      } else {
        if(r.status!==200||!clean(r.data))throw Error('PAYMENT_RESPONSE_UNCERTAIN');
        const proof=paymentProof(r.data.payment,owner,env,spec);
        const result={kind:spec.kind,httpStatus:r.status,payment:proof,grantsWeddingEntitlement:false};save(name,result,true);out.results.push(result);
      }
    }
    // Return the standalone recovery payment after the provider result is read
    // independently. This refund is not linked to any Wedding invoice ledger.
    const recovery=out.results.find(r=>r.kind==='recovery').payment;
    paymentProof((await get('payments/'+encodeURIComponent(recovery.id))).payment,owner,env,SPECS[1]);
    const refundPrior=read('recovery-refund-result.json');
    if(refundPrior)out.recoveryRefund={...await verifyCachedRefund(get,refundPrior,recovery.id,env.SQUARE_LOCATION_ID),reused:true};
    else {
      const intent=reserveIntent(DIR,'recovery-refund',{paymentId:recovery.id,amountCents:4999});
      const r=await request('refunds',{idempotency_key:intent.idempotencyKey,payment_id:recovery.id,amount_money:{amount:4999,currency:'USD'},reason:'Return standalone sandbox recovery test payment'});
      const f=r.data.refund;
      if(r.status!==200||!clean(r.data))throw Error('REFUND_RESPONSE_UNCERTAIN');
      out.recoveryRefund=refundProof(f,recovery.id,f?.id,env.SQUARE_LOCATION_ID);save('recovery-refund-result.json',out.recoveryRefund,true);
    }
    out.fixtureGenerationCompleted=true;out.completed=out.recoveryRefund.status==='COMPLETED';
    out.requiresRefundReadback=out.recoveryRefund.status==='PENDING';out.disabledLifecycleCount=11;
  } catch(error) {
    out.failed=true;out.code=/^[A-Z_]+$/.test(error?.message||'')?error.message:'FIXTURE_RUN_REQUIRES_REVIEW';
  } finally {
    if(pool)await pool.end().catch(()=>{});
    if(fs.existsSync(DIR))fs.writeFileSync(DIR+'/last-run.json',JSON.stringify(out,null,2),{mode:0o600});
    console.log(JSON.stringify(out));
  }
}
module.exports={validate,paymentProof,reserveIntent,verifyCachedRefund,SPECS,GATES};
if(require.main===module)void main();
