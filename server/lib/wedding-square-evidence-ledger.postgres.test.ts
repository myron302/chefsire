import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import pg from "pg";
import { createWeddingSquareEvidenceLedger,WeddingSquareEvidenceLedgerError } from "./wedding-square-evidence-ledger";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const attempt="11111111-1111-4111-8111-111111111111";
test("isolated PostgreSQL: invoice proof plus paid-through commit atomically, duplicate never extends access",{
  skip:!url?"Requires local disposable PostgreSQL":undefined,
},async()=>{
  if(!url)throw Error("Missing test DB");
  const parsed=new URL(url);
  if(!["localhost","127.0.0.1","::1"].includes(parsed.hostname)||
      !/test/i.test(parsed.pathname))throw Error("Remote DB prohibited");
  const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
  const schema="wedding_evidence_test_"+randomUUID().replaceAll("-","");
  const env=["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
    "WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED",
    "WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID",
    "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID"]as const;
  const before=env.map(e=>process.env[e]);
  Object.assign(process.env,{SQUARE_ENV:"sandbox",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",
    SQUARE_LOCATION_ID:"loc-1",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID:"premium-var"});
  let connected=false;
  try{
    await client.connect();connected=true;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query("CREATE TABLE users(id varchar PRIMARY KEY)");
    await client.query("INSERT INTO users(id) VALUES ('owner-1'),('foreign-1')");
    for(const name of ["20261101_01_wedding_square_enrollment_attempts.sql",
      "20261101_02_wedding_square_billing_foundation.sql",
      "20261101_03_wedding_square_payment_reconciliation.sql"]){
      await client.query(readFileSync(path.join(root,"server/migrations",name),"utf8"));
    }
    await client.query(`INSERT INTO wedding_square_enrollment_attempts
      (id,user_id,tier,consent_terms_version,consented_at,
       consented_amount_cents,consented_currency,
       square_location_id,square_plan_variation_id,
       square_customer_id,square_card_id,idempotency_key,request_fingerprint,
       status,provider_subscription_id)
      VALUES($1,'owner-1','premium',$2,now(),2499,'USD',
        'loc-1','premium-var','customer-1','card-1','idempotency-once',
        repeat('a',64),'confirmed','sub-1')`,[attempt,WEDDING_CONSENT_VERSION]);
    const inserted=(await client.query<{id:string}>(`INSERT INTO wedding_square_subscriptions
      (user_id,tier,square_environment,square_merchant_id,square_location_id,
       square_customer_id,square_plan_variation_id,square_subscription_id,
       square_card_id,billing_consent_at,billing_consent_terms_version,
       agreed_monthly_amount_cents,agreed_currency,provider_status)
      VALUES('owner-1','premium','sandbox','merchant-1','loc-1',
       'customer-1','premium-var','sub-1','card-1',now(),$1,2499,'USD','ACTIVE')
      RETURNING id`,[WEDDING_CONSENT_VERSION])).rows[0];
    const captured=new Date(Date.now()-3_600_000).toISOString();
    const expires=new Date(Date.now()+10*86_400_000).toISOString();
    const proof={
      subscriptionId:"sub-1",invoiceId:"inv-1",paymentId:"pay-1",
      verifiedAmountCents:2499,providerPaidAt:captured,periodStartsAt:captured,
      periodEndsAt:expires,grantsEntitlement:false,
      requiresOperatorReconciliation:true,requiresIndependentRefundDisputeRecheck:true,
    };
    const refreshed={
      subscriptionId:"sub-1",invoiceId:"inv-1",paymentId:"pay-1",
      verifiedAmountCents:2499,noRefundsOrDisputes:true,grantsEntitlement:false,
      requiresIndependentPeriodVerification:true,
    };
    const svc=createWeddingSquareEvidenceLedger({
      connect:async()=>({
        query:(sql:string,args?:unknown[])=>client.query(sql,args),
        release:()=>undefined,
      }),
    }as any,{inspect:async()=>proof}as any,{inspect:async()=>refreshed}as any);
    const result=await svc.record(attempt,"owner-1");
    assert.equal(result.status,"recorded");
    assert.equal(result.paidEntitlementGranted,false);
    const evidence=(await client.query(`SELECT wedding_subscription_id,
      square_invoice_id,square_payment_id,verified_amount_cents,
      last_payment_reconciled_at,payment_revoked_at,
      period_starts_at,period_ends_at FROM wedding_square_invoice_evidence`)).rows;
    assert.equal(evidence.length,1);
    assert.equal(evidence[0].wedding_subscription_id,inserted.id);
    assert.equal(evidence[0].square_invoice_id,"inv-1");
    assert.equal(evidence[0].square_payment_id,"pay-1");
    assert.equal(evidence[0].verified_amount_cents,2499);
    assert.ok(evidence[0].last_payment_reconciled_at instanceof Date);
    assert.equal(evidence[0].payment_revoked_at,null);
    assert.equal(evidence[0].period_starts_at.toISOString(),captured);
    assert.equal(evidence[0].period_ends_at.toISOString(),expires);
    const sub=(await client.query(`SELECT verified_paid_through FROM wedding_square_subscriptions WHERE id=$1`,[inserted.id])).rows[0];
    assert.equal(sub.verified_paid_through.toISOString(),expires);
    await assert.rejects(svc.record(attempt,"owner-1"),WeddingSquareEvidenceLedgerError);
    await assert.rejects(svc.record(attempt,"foreign-1"),WeddingSquareEvidenceLedgerError);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM wedding_square_invoice_evidence")).rows[0].n,1);
  }finally{
    if(connected){
      await client.query("ROLLBACK").catch(()=>undefined);
      await client.query("SET search_path TO public").catch(()=>undefined);
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
      await client.end();
    }
    env.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});
  }
});
