import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "20260920_marketplace_payment_fulfillment.sql"), "utf8");
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
    } catch { /* try the next isolated/local candidate */ }
  }
  return null;
}

const connectionString = await firstReachable();
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# no reachable isolated PostgreSQL -- marketplace payment migration tests skipped");

postgresTest("legacy orders stay unverified and captured state requires provider evidence", async () => {
  const client = new pg.Client({ connectionString: connectionString! });
  const schema = `marketplace_payment_${process.pid}_${Date.now()}`;
  try {
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE orders (id text PRIMARY KEY, status text, square_payment_id text)`);
    await client.query(`INSERT INTO orders VALUES ('legacy-delivered', 'delivered', NULL)`);
    await client.query(migration);
    assert.deepEqual(
      (await client.query(`SELECT status, payment_status FROM orders WHERE id = 'legacy-delivered'`)).rows[0],
      { status: "delivered", payment_status: "unverified" },
    );
    await assert.rejects(
      client.query(`UPDATE orders SET payment_status = 'captured' WHERE id = 'legacy-delivered'`),
      /orders_captured_payment_evidence_check/,
    );
    await client.query(`UPDATE orders SET payment_status = 'captured', payment_provider = 'square',
      square_payment_id = 'provider-payment', capture_idempotency_key = 'stable-capture',
      provider_payment_status = 'COMPLETED', payment_captured_at = now()
      WHERE id = 'legacy-delivered'`);
  } finally {
    await client.query("RESET search_path").catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
