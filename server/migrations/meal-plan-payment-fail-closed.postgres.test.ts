import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "20260928_meal_plan_payment_fail_closed.sql"), "utf8");
const candidates = [
  process.env.TEST_DATABASE_URL,
  `postgres://${process.env.USER || "root"}@localhost/postgres?host=/var/run/postgresql`,
  "postgres://postgres:postgres@localhost:5432/postgres",
  "postgres://localhost:5432/postgres",
].filter((value): value is string => Boolean(value));

async function firstReachable() {
  for (const connectionString of candidates) {
    const client = new pg.Client({ connectionString });
    try {
      await client.connect();
      await client.end();
      return connectionString;
    } catch { /* only isolated/local candidates are attempted */ }
  }
  return null;
}

const connectionString = await firstReachable();
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# no reachable isolated PostgreSQL -- meal-plan payment migration tests skipped");

postgresTest("meal-plan migration revokes simulated accounting and enforces authoritative shapes", async () => {
  const client = new pg.Client({ connectionString: connectionString! });
  const namespace = `meal_plan_payment_${process.pid}_${Date.now()}`;
  try {
    await client.connect();
    await client.query(`CREATE SCHEMA ${namespace}`);
    await client.query(`SET search_path TO ${namespace}`);
    await client.query(`
      CREATE TABLE meal_plan_blueprints (
        id text PRIMARY KEY, creator_id text NOT NULL, sales_count integer NOT NULL DEFAULT 0, status text NOT NULL, price_in_cents integer NOT NULL
      );
      CREATE TABLE meal_plan_purchases (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id text NOT NULL, blueprint_id text NOT NULL,
        price_paid_cents integer NOT NULL,
        payment_status text NOT NULL DEFAULT 'completed',
        payment_method text, transaction_id text,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE creator_analytics (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        creator_id text NOT NULL, date text NOT NULL,
        total_sales integer NOT NULL DEFAULT 0,
        total_revenue_cents integer NOT NULL DEFAULT 0,
        updated_at timestamp NOT NULL DEFAULT now()
      );
      INSERT INTO meal_plan_blueprints VALUES ('plan', 'creator', 7, 'published', 0);
      INSERT INTO meal_plan_purchases
        (id, user_id, blueprint_id, price_paid_cents, payment_status, transaction_id)
        VALUES ('legacy', 'buyer', 'plan', 2500, 'completed', 'sim_old');
      INSERT INTO creator_analytics
        (id, creator_id, date, total_sales, total_revenue_cents)
        VALUES ('daily', 'creator', CURRENT_DATE::text, 7, 17500);
    `);

    await client.query(migration);
    assert.equal((await client.query(`SELECT payment_status FROM meal_plan_purchases WHERE id='legacy'`)).rows[0].payment_status, "legacy_unverified");
    assert.equal((await client.query(`SELECT sales_count FROM meal_plan_blueprints WHERE id='plan'`)).rows[0].sales_count, 0);
    assert.deepEqual(
      (await client.query(`SELECT total_sales, total_revenue_cents FROM creator_analytics WHERE id='daily'`)).rows[0],
      { total_sales: 0, total_revenue_cents: 0 },
    );

    await assert.rejects(
      client.query(`INSERT INTO meal_plan_purchases (user_id, blueprint_id, price_paid_cents, payment_status) VALUES ('stale', 'plan', 2500, 'completed')`),
      /meal_plan_purchases_authoritative_evidence_chk/,
    );
    await assert.rejects(
      client.query(`UPDATE meal_plan_purchases SET payment_status='verified_paid', acquisition_type='paid' WHERE id='legacy'`),
      /meal_plan_purchases_authoritative_evidence_chk/,
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await client.query(`INSERT INTO meal_plan_purchases
        (user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type)
        SELECT 'free-user', id, 0, 'free_acquired', 'free'
        FROM meal_plan_blueprints
        WHERE id='plan' AND status='published' AND price_in_cents=0
        ON CONFLICT DO NOTHING`);
    }
    assert.equal((await client.query(`SELECT COUNT(*)::int AS count FROM meal_plan_purchases WHERE user_id='free-user'`)).rows[0].count, 1);
    assert.deepEqual(
      (await client.query(`SELECT total_sales, total_revenue_cents FROM creator_analytics WHERE id='daily'`)).rows[0],
      { total_sales: 0, total_revenue_cents: 0 },
    );
    await client.query(`INSERT INTO meal_plan_purchases
      (user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type,
       payment_provider, provider_payment_id, provider_payment_status, payment_verified_at)
      VALUES ('paid-user', 'plan', 2500, 'verified_paid', 'paid',
       'square', 'square-payment', 'COMPLETED', now())`);
  } finally {
    await client.query("RESET search_path").catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
