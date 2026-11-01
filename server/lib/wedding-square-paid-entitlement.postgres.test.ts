import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readVerifiedWeddingPaid, WeddingSquarePaidEvidenceUnavailableError } from "./wedding-square-paid-entitlement";

const url=process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");

test("disposable PostgreSQL 16: only matched settled invoices with fresh coverage unlock Wedding tier",{
  skip:!url?"Requires disposable PostgreSQL test service":undefined,
},async()=>{
  if(!url)throw Error("Missing loopback test URL");
  const u=new URL(url);
  if(!["127.0.0.1","localhost","::1"].includes(u.hostname)||!/test/i.test(u.pathname))
    throw Error("Non-test or remote DB prohibited");
  const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
  const schema="wedding_paid_test_"+randomUUID().replaceAll("-","");
  const keys=["WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED","SQUARE_ENV",
    "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","WEDDING_SQUARE_SANDBOX_MERCHANT_ID",
    "SQUARE_LOCATION_ID"]as const;
  const old=keys.map(k=>process.env[k]);
  Object.assign(process.env,{
    WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED:"true",SQUARE_ENV:"sandbox",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED:"true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID:"merchant-1",SQUARE_LOCATION_ID:"loc-1",
  });
  let connected=false;
  try {
    await client.connect();connected=true;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query("CREATE TABLE users(id varchar PRIMARY KEY)");
    await client.query("INSERT INTO users(id) VALUES ('owner-1'),('other-user')");
    for(const name of ["20261101_01_wedding_square_enrollment_attempts.sql",
      "20261101_02_wedding_square_billing_foundation.sql",
      "20261101_03_wedding_square_payment_reconciliation.sql"]){
      await client.query(readFileSync(path.join(root,"server/migrations",name),"utf8"));
    }
    const executor=drizzle(client) as any;
    const entitlement=()=>readVerifiedWeddingPaid("owner-1",executor);
    assert.equal(await entitlement(),null,"no provider evidence is Free");

    const subscription=(await client.query<{id:string}>(`INSERT INTO wedding_square_subscriptions
      (user_id,tier,square_environment,square_merchant_id,square_location_id,
       square_customer_id,square_plan_variation_id,square_subscription_id,
       billing_consent_at,billing_consent_terms_version,
       agreed_monthly_amount_cents,agreed_currency,provider_status,
       verified_paid_through,last_reconciled_at)
      VALUES ('owner-1','premium','sandbox','merchant-1','loc-1','cust-1',
        'premium-var','sub-1',now(),'wedding-monthly-autorenew-v1',
        2499,'USD','ACTIVE',now()+interval '30 days',now())
      RETURNING id`)).rows[0];
    assert.equal(await entitlement(),null,"provider ACTIVE is NOT a payment");
    await client.query(`INSERT INTO wedding_square_invoice_evidence
      (wedding_subscription_id,square_environment,square_merchant_id,
       square_invoice_id,square_payment_id,square_subscription_id,
       verified_amount_cents,verified_currency,provider_paid_at,
       period_starts_at,period_ends_at,last_payment_reconciled_at)
      VALUES($1,'sandbox','merchant-1','inv-1','pay-1','sub-1',
        2499,'USD',now()-interval '1 minute',now()-interval '1 day',now()+interval '28 days',now())`,
      [subscription.id]);
    let paid=await entitlement();
    assert.equal(paid?.tier,"premium");
    assert.ok(Date.parse(paid!.paidThrough)>Date.now());
    assert.equal(await readVerifiedWeddingPaid("other-user",executor),null,"another user cannot inherit payment");

    // A second concurrently covering invoice on the SAME subscription must
    // not be silently merged via MAX(paidThrough), even when both appear paid.
    await client.query(`INSERT INTO wedding_square_invoice_evidence
      (wedding_subscription_id,square_environment,square_merchant_id,
       square_invoice_id,square_payment_id,square_subscription_id,
       verified_amount_cents,verified_currency,provider_paid_at,
       period_starts_at,period_ends_at,last_payment_reconciled_at)
      VALUES($1,'sandbox','merchant-1','inv-overlap','pay-overlap','sub-1',
        2499,'USD',now()-interval '1 minute',now()-interval '1 day',
        now()+interval '27 days',now())`,[subscription.id]);
    await assert.rejects(entitlement(),WeddingSquarePaidEvidenceUnavailableError,
      "overlapping current invoice evidence is ambiguous and cannot grant paid access");
    await client.query("DELETE FROM wedding_square_invoice_evidence WHERE square_invoice_id='inv-overlap'");
    assert.equal((await entitlement())?.tier,"premium",
      "removing ambiguous evidence restores the one verified current period");

    // A future-dated reconciliation is not recent provider payment proof:
    // the 24-hour lower bound alone would accept this value for days.
    await client.query("UPDATE wedding_square_invoice_evidence SET last_payment_reconciled_at=now()+interval '48 hours' WHERE square_invoice_id='inv-1'");
    assert.equal(await entitlement(),null,"future-dated PAYMENT reconciliation must not grant access");
    await client.query("UPDATE wedding_square_invoice_evidence SET last_payment_reconciled_at=now() WHERE square_invoice_id='inv-1'");
    assert.equal((await entitlement())?.tier,"premium","a genuinely current provider check restores evidenced coverage");

    await client.query("UPDATE wedding_square_subscriptions SET last_reconciled_at=now()-interval '25 hours' WHERE id=$1",[subscription.id]);
    assert.equal((await entitlement())?.tier,"premium","subscription status check cannot refresh or expire independent payment proof");
    await client.query("UPDATE wedding_square_invoice_evidence SET last_payment_reconciled_at=now()-interval '25 hours' WHERE square_invoice_id='inv-1'");
    assert.equal(await entitlement(),null,"stale PAYMENT reconciliation cannot grant access");
    await client.query("UPDATE wedding_square_subscriptions SET last_reconciled_at=now(),verified_paid_through=NULL WHERE id=$1",[subscription.id]);
    assert.equal(await entitlement(),null,"subscription status update cannot refresh stale payment evidence");
    await client.query("UPDATE wedding_square_invoice_evidence SET last_payment_reconciled_at=now() WHERE square_invoice_id='inv-1'");
    assert.equal(await entitlement(),null,"missing verified paid-through is Free");
    await client.query("UPDATE wedding_square_subscriptions SET verified_paid_through=now()+interval '30 days',provider_status='PENDING' WHERE id=$1",[subscription.id]);
    assert.equal(await entitlement(),null,"pending provider state is not paid");
    await client.query("UPDATE wedding_square_subscriptions SET provider_status='CANCELED' WHERE id=$1",[subscription.id]);
    paid=await entitlement();
    assert.equal(paid?.tier,"premium","canceled still grants paid period until it expires");
    await client.query("UPDATE wedding_square_invoice_evidence SET payment_revoked_at=now() WHERE square_invoice_id='inv-1'");
    assert.equal(await entitlement(),null,"refund or disputed payment must revoke paid access");
    await client.query("UPDATE wedding_square_invoice_evidence SET payment_revoked_at=NULL WHERE square_invoice_id='inv-1'");
    await client.query("UPDATE wedding_square_invoice_evidence SET verified_amount_cents=4999 WHERE square_invoice_id='inv-1'");
    assert.equal(await entitlement(),null,"incorrect price must not grant Premium or Elite");
    await client.query("UPDATE wedding_square_invoice_evidence SET verified_amount_cents=2499,period_ends_at=now()-interval '1 minute' WHERE square_invoice_id='inv-1'");
    assert.equal(await entitlement(),null,"expired payment cannot grant access");
    await assert.rejects(readVerifiedWeddingPaid("owner-1",{
      execute:async()=>{throw Error("Simulated provider database outage");},
    } as any),WeddingSquarePaidEvidenceUnavailableError);
  } finally {
    if(connected){
      await client.query("SET search_path TO public").catch(()=>undefined);
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined);
      await client.end();
    }
    keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});
  }
});
