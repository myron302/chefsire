import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import pg from "pg";
import { createWeddingSquareConfirmationPersistence, WeddingSquareConfirmationPersistenceError } from "./wedding-square-confirmation-persistence";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
const attemptId = "8a1b4384-4bf5-44ea-8637-5d18bcf8b115";
const fp = "a".repeat(64);

test("real PostgreSQL: provider confirmation + subscription ledger commit together, never grant paid period", {
  skip: !url ? "Requires isolated PostgreSQL 16 from GitHub Actions" : undefined,
}, async () => {
  if (!url) throw Error("Missing isolated test DB");
  const dbUrl = new URL(url);
  if (!["127.0.0.1", "localhost", "::1"].includes(dbUrl.hostname) ||
      !/test/i.test(dbUrl.pathname)) throw Error("Remote or non-disposable databases forbidden");
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  const schema = "wedding_test_" + randomUUID().replaceAll("-", "");
  const keys = ["SQUARE_ENV","WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED","WEDDING_SQUARE_SANDBOX_MERCHANT_ID","SQUARE_LOCATION_ID",
    "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID",
    "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID"] as const;
  const previous = keys.map(key => process.env[key]);
  Object.assign(process.env, {
    SQUARE_ENV: "sandbox", WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant-1", SQUARE_LOCATION_ID: "loc-1",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "premium-var",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "elite-var",
  });
  let connected = false;
  try {
    await client.connect(); connected = true;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query("CREATE TABLE users (id varchar PRIMARY KEY)");
    await client.query("INSERT INTO users (id) VALUES ('owner-1'),('other-1')");
    for (const name of [
      "20261101_01_wedding_square_enrollment_attempts.sql",
      "20261101_02_wedding_square_billing_foundation.sql",
      "20261101_03_wedding_square_payment_reconciliation.sql",
    ]) {
      await client.query(readFileSync(path.join(root, "server/migrations", name), "utf8"));
    }
    await client.query(`INSERT INTO wedding_square_enrollment_attempts (
      id,user_id,tier,consent_terms_version,consented_at,consented_amount_cents,consented_currency,
      trial_expires_at,requested_start_date,square_location_id,square_plan_variation_id,
      square_customer_id,square_card_id,idempotency_key,request_fingerprint,status
    ) VALUES ($1,'owner-1','premium',$2,now(),2499,'USD',
      '2026-11-15T12:00:00Z','2026-11-16','loc-1','premium-var',
      'square-customer','square-card','stable-key',$3,'submitting')`,
      [attemptId, WEDDING_CONSENT_VERSION, fp]);
    const service = createWeddingSquareConfirmationPersistence({
      connect: async () => ({
        query: (sql: string, args?: unknown[]) => client.query(sql, args),
        release: () => undefined,
      }),
    } as any);
    const attempt = {
      attemptId, authenticatedUserId: "owner-1", persistedIdempotencyKey: "stable-key",
      persistedRequestFingerprint: fp,
      verifiedResponse: {
        providerSubscriptionId: "square-sub-1", providerStatus: "PENDING" as const,
        verifiedLocationId: "loc-1", verifiedPlanVariationId: "premium-var",
      },
    };
    const confirmed = await service.confirm(attempt);
    assert.equal(confirmed.status, "confirmed");
    const subscription = (await client.query(`SELECT user_id,tier,square_merchant_id,
      square_customer_id,square_subscription_id,agreed_monthly_amount_cents,
      billing_consent_terms_version,provider_status,verified_paid_through
      FROM wedding_square_subscriptions WHERE user_id = 'owner-1'`)).rows;
    assert.equal(subscription.length, 1);
    assert.deepEqual({
      user_id: subscription[0].user_id, tier: subscription[0].tier,
      merchant: subscription[0].square_merchant_id, customer: subscription[0].square_customer_id,
      id: subscription[0].square_subscription_id,
      amount: subscription[0].agreed_monthly_amount_cents,
      version: subscription[0].billing_consent_terms_version,
      status: subscription[0].provider_status,
      through: subscription[0].verified_paid_through,
    }, {
      user_id: "owner-1", tier: "premium", merchant: "merchant-1",
      customer: "square-customer", id: "square-sub-1",
      amount: 2499, version: WEDDING_CONSENT_VERSION, status: "PENDING",
      through: null,
    });
    const saved = (await client.query("SELECT status,provider_subscription_id FROM wedding_square_enrollment_attempts WHERE id = $1", [attemptId])).rows[0];
    assert.deepEqual(saved, { status: "confirmed", provider_subscription_id: "square-sub-1" });
    // A repeat is never interpreted as a new successful subscription.
    await assert.rejects(service.confirm(attempt), WeddingSquareConfirmationPersistenceError);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM wedding_square_subscriptions")).rows[0].n, 1);
  } finally {
    if (connected) {
      await client.query("ROLLBACK").catch(() => undefined);
      await client.query("SET search_path TO public").catch(() => undefined);
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
      await client.end();
    }
    keys.forEach((key,i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});
