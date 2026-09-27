/**
 * Verifies the SQL-level exactly-once safety of the crash-window reservation
 * reconciliation at the heart of Finding 1: the atomic claim (right before
 * calling Square) and the "never submitted" release (the background
 * reconciler) race on the exact same predicate, so exactly one of them can
 * ever win for a given reservation -- never both.
 */
import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const connectionString = process.env.TEST_DATABASE_URL?.trim() || null;
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# TEST_DATABASE_URL unavailable -- checkout reconciliation PostgreSQL integration tests skipped safely");

async function setup() {
  const client = new pg.Client({ connectionString: connectionString! });
  await client.connect();
  const schema = `checkout_reconcile_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  await client.query(`
    CREATE TABLE products (id text PRIMARY KEY, inventory integer);
    CREATE TABLE orders (
      id text PRIMARY KEY, product_id text NOT NULL, quantity integer NOT NULL DEFAULT 1,
      payment_status text NOT NULL DEFAULT 'unverified', inventory_status text NOT NULL DEFAULT 'unreserved',
      capture_idempotency_key text, capture_attempted_at timestamp, capture_request_submitted_at timestamp,
      last_payment_failure_code text
    );
  `);
  return { client, schema };
}

async function teardown(client: pg.Client, schema: string) {
  await client.query("RESET search_path");
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.end();
}

// Mirrors payments.ts's claim UPDATE.
const claim = (client: pg.Client, orderId: string) => client.query(
  `UPDATE orders SET capture_request_submitted_at = now()
   WHERE id = $1 AND payment_status = 'capture_pending' AND capture_idempotency_key IS NOT NULL
     AND capture_request_submitted_at IS NULL
   RETURNING id`,
  [orderId],
);

// Mirrors releaseAbandonedCaptureReservation's never-submitted release.
async function releaseNeverSubmitted(client: pg.Client, orderId: string) {
  await client.query("BEGIN");
  try {
    const released = await client.query(
      `UPDATE orders SET payment_status = 'unverified', capture_idempotency_key = NULL, capture_attempted_at = NULL,
         capture_request_submitted_at = NULL, last_payment_failure_code = 'CAPTURE_NEVER_SUBMITTED', inventory_status = 'released'
       WHERE id = $1 AND payment_status = 'capture_pending' AND inventory_status = 'reserved'
         AND capture_request_submitted_at IS NULL
       RETURNING quantity, product_id`,
      [orderId],
    );
    if (released.rowCount === 1) {
      await client.query(`UPDATE products SET inventory = inventory + $1 WHERE id = $2`, [released.rows[0].quantity, released.rows[0].product_id]);
    }
    await client.query("COMMIT");
    return released.rowCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

postgresTest("a live claim and a concurrent never-submitted release cannot both win", async () => {
  const { client, schema } = await setup();
  const rival = new pg.Client({ connectionString: connectionString! });
  await rival.connect();
  try {
    await rival.query(`SET search_path TO ${schema}`);
    await client.query(`INSERT INTO products VALUES ('product', 0)`);
    await client.query(`INSERT INTO orders (id, product_id, quantity, payment_status, inventory_status, capture_idempotency_key, capture_attempted_at)
      VALUES ('order-1', 'product', 3, 'capture_pending', 'reserved', 'idem-1', now())`);

    const [claimResult, releaseCount] = await Promise.all([
      claim(client, "order-1"),
      releaseNeverSubmitted(rival, "order-1"),
    ]);

    const winners = [claimResult.rowCount === 1, releaseCount === 1].filter(Boolean).length;
    assert.equal(winners, 1, "exactly one of claim/release may win the race, never both, never neither");

    const finalRow = (await client.query(`SELECT payment_status, inventory_status, capture_request_submitted_at FROM orders WHERE id = 'order-1'`)).rows[0];
    if (claimResult.rowCount === 1) {
      assert.equal(finalRow.payment_status, "capture_pending");
      assert.ok(finalRow.capture_request_submitted_at, "the winning claim must have set the timestamp");
      assert.equal((await client.query(`SELECT inventory FROM products WHERE id = 'product'`)).rows[0].inventory, 0, "a winning claim must not restock");
    } else {
      assert.equal(finalRow.payment_status, "unverified");
      assert.equal(finalRow.inventory_status, "released");
      assert.equal((await client.query(`SELECT inventory FROM products WHERE id = 'product'`)).rows[0].inventory, 3, "a winning release must restock exactly the reserved quantity");
    }
  } finally {
    await rival.end();
    await teardown(client, schema);
  }
});

postgresTest("never-submitted release is a no-op once a request has been claimed as submitted", async () => {
  const { client, schema } = await setup();
  try {
    await client.query(`INSERT INTO products VALUES ('product', 0)`);
    await client.query(`INSERT INTO orders (id, product_id, quantity, payment_status, inventory_status, capture_idempotency_key, capture_attempted_at, capture_request_submitted_at)
      VALUES ('order-submitted', 'product', 2, 'capture_pending', 'reserved', 'idem-2', now(), now())`);

    const rowCount = await releaseNeverSubmitted(client, "order-submitted");
    assert.equal(rowCount, 0, "a reservation with a non-null submission claim must never be released as never-submitted");
    assert.equal((await client.query(`SELECT inventory FROM products WHERE id = 'product'`)).rows[0].inventory, 0);
    assert.equal((await client.query(`SELECT payment_status FROM orders WHERE id = 'order-submitted'`)).rows[0].payment_status, "capture_pending");
  } finally {
    await teardown(client, schema);
  }
});

postgresTest("releasing an already-released reservation restocks exactly once", async () => {
  const { client, schema } = await setup();
  try {
    await client.query(`INSERT INTO products VALUES ('product', 0)`);
    await client.query(`INSERT INTO orders (id, product_id, quantity, payment_status, inventory_status, capture_idempotency_key, capture_attempted_at)
      VALUES ('order-double', 'product', 5, 'capture_pending', 'reserved', 'idem-3', now())`);

    assert.equal(await releaseNeverSubmitted(client, "order-double"), 1);
    assert.equal(await releaseNeverSubmitted(client, "order-double"), 0, "a second release attempt must affect zero rows");
    assert.equal((await client.query(`SELECT inventory FROM products WHERE id = 'product'`)).rows[0].inventory, 5, "restock must happen exactly once, not twice");
  } finally {
    await teardown(client, schema);
  }
});

postgresTest("two concurrent claims for the same reservation: exactly one wins", async () => {
  const { client, schema } = await setup();
  const rival = new pg.Client({ connectionString: connectionString! });
  await rival.connect();
  try {
    await rival.query(`SET search_path TO ${schema}`);
    await client.query(`INSERT INTO products VALUES ('product', 0)`);
    await client.query(`INSERT INTO orders (id, product_id, quantity, payment_status, inventory_status, capture_idempotency_key, capture_attempted_at)
      VALUES ('order-race', 'product', 1, 'capture_pending', 'reserved', 'idem-4', now())`);

    const [first, second] = await Promise.all([claim(client, "order-race"), claim(rival, "order-race")]);
    assert.deepEqual([first.rowCount, second.rowCount].sort(), [0, 1]);
  } finally {
    await rival.end();
    await teardown(client, schema);
  }
});
