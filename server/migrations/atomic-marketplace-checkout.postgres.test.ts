import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "20260922_atomic_marketplace_checkout.sql"), "utf8");
const connectionString = process.env.TEST_DATABASE_URL?.trim() || null;
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# TEST_DATABASE_URL unavailable -- P1-05 PostgreSQL integration tests skipped safely");

async function reserve(client: pg.Client, orderId: string) {
  await client.query("BEGIN");
  try {
    const product = await client.query(`UPDATE products SET inventory = CASE WHEN inventory IS NULL THEN NULL ELSE inventory - 1 END
      WHERE id = 'product' AND is_active = true AND (inventory IS NULL OR inventory >= 1) RETURNING id`);
    if (product.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }
    const order = await client.query(`UPDATE orders SET inventory_status = 'reserved', payment_status = 'capture_pending'
      WHERE id = $1 AND inventory_status = 'unreserved' AND payment_status = 'unverified' RETURNING id`, [orderId]);
    if (order.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

postgresTest("P1-05 migration enforces checkout, inventory, capture, and commission invariants", async () => {
  const admin = new pg.Client({ connectionString: connectionString! });
  const first = new pg.Client({ connectionString: connectionString! });
  const second = new pg.Client({ connectionString: connectionString! });
  const namespace = `p105_${process.pid}_${Date.now()}`;
  try {
    await Promise.all([admin.connect(), first.connect(), second.connect()]);
    await admin.query(`CREATE SCHEMA ${namespace}`);
    for (const client of [admin, first, second]) await client.query(`SET search_path TO ${namespace}`);
    await admin.query(`
      CREATE TABLE products (id text PRIMARY KEY, inventory integer, is_active boolean NOT NULL DEFAULT true, sales_count integer DEFAULT 0);
      CREATE TABLE orders (
        id text PRIMARY KEY, buyer_id text NOT NULL, seller_id text NOT NULL, product_id text NOT NULL,
        quantity integer NOT NULL, total_amount numeric(10,2) NOT NULL, platform_fee numeric(8,2) NOT NULL,
        seller_amount numeric(10,2) NOT NULL, status text DEFAULT 'pending', payment_status text NOT NULL DEFAULT 'unverified',
        seller_revenue_status text NOT NULL DEFAULT 'uncredited', payment_provider text, square_payment_id text,
        capture_idempotency_key text, provider_payment_status text, payment_captured_at timestamp
      );
      CREATE TABLE commissions (id text PRIMARY KEY, order_id text NOT NULL);
    `);
    await admin.query(`INSERT INTO products VALUES ('product', 1, true, 0)`);
    await admin.query(`INSERT INTO orders
      (id,buyer_id,seller_id,product_id,quantity,total_amount,platform_fee,seller_amount)
      VALUES ('legacy','legacy-buyer','seller','product',1,10,1,9)`);
    await admin.query(`INSERT INTO orders
      (id,buyer_id,seller_id,product_id,quantity,total_amount,platform_fee,seller_amount,payment_status,
       seller_revenue_status,payment_provider,square_payment_id,capture_idempotency_key,provider_payment_status,payment_captured_at)
      VALUES ('p103-reconcile','p103-buyer','seller','product',1,10,1,9,'capture_reconciliation',
       'uncredited','square','square-existing','stable-existing','COMPLETED',now())`);
    await admin.query(migration);
    assert.equal((await admin.query(`SELECT inventory_status FROM orders WHERE id='legacy'`)).rows[0].inventory_status, "legacy_unverified");
    assert.deepEqual((await admin.query(`SELECT inventory_status, checkout_idempotency_key, seller_tier_snapshot
      FROM orders WHERE id='p103-reconcile'`)).rows[0], {
      inventory_status: "reserved", checkout_idempotency_key: "p1-03:p103-reconcile", seller_tier_snapshot: "legacy_p1_03",
    });

    const insertOrder = (id: string, buyer: string, key: string) => admin.query(`INSERT INTO orders
      (id,buyer_id,seller_id,product_id,quantity,total_amount,platform_fee,seller_amount,
       checkout_idempotency_key,seller_tier_snapshot,commission_rate_snapshot,inventory_status)
      VALUES ($1,$2,'seller','product',1,10,1,9,$3,'free',10,'unreserved')`, [id, buyer, key]);
    await insertOrder("one", "buyer-one", "key-one");
    await insertOrder("two", "buyer-two", "key-two");
    await assert.rejects(insertOrder("duplicate", "buyer-one", "key-one"), /orders_buyer_checkout_idempotency_uidx/);

    const [oneReserved, twoReserved] = await Promise.all([reserve(first, "one"), reserve(second, "two")]);
    assert.deepEqual([oneReserved, twoReserved].sort(), [false, true]);
    assert.equal((await admin.query(`SELECT inventory FROM products WHERE id='product'`)).rows[0].inventory, 0);
    const winner = oneReserved ? "one" : "two";
    assert.equal(await reserve(first, winner), false, "payment retry cannot reserve twice");
    assert.equal((await admin.query(`SELECT inventory FROM products WHERE id='product'`)).rows[0].inventory, 0);

    await assert.rejects(admin.query(`UPDATE orders SET inventory_status='sold', payment_status='captured' WHERE id=$1`, [winner]), /check constraint/);
    await admin.query(`UPDATE orders SET inventory_status='sold', payment_status='captured', payment_provider='square',
      square_payment_id='square-payment', capture_idempotency_key='stable-capture', provider_payment_status='COMPLETED',
      payment_captured_at=now(), seller_revenue_status='credited' WHERE id=$1`, [winner]);
    await admin.query(`INSERT INTO commissions VALUES ('commission-one',$1)`, [winner]);
    await assert.rejects(admin.query(`INSERT INTO commissions VALUES ('commission-two',$1)`, [winner]), /commissions_order_uidx/);
  } finally {
    await admin.query("RESET search_path").catch(() => undefined);
    await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`).catch(() => undefined);
    await Promise.all([admin.end().catch(() => undefined), first.end().catch(() => undefined), second.end().catch(() => undefined)]);
  }
});
