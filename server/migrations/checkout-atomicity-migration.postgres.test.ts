/** Executes the production checkout-atomicity migration/backfill against isolated PostgreSQL schemas. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyMigration, splitPostgresStatements } from "../scripts/migration-runner";
import { enforceMarketplaceCheckoutAtomicity } from "../scripts/marketplace-checkout-atomicity-enforcement";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "20260922_atomic_marketplace_checkout.sql"), "utf8");
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
    } catch {
      // Try the next conventional isolated/local test connection.
    }
  }
  return null;
}

const connectionString = await firstReachable();
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# no reachable isolated PostgreSQL -- checkout atomicity migration integration tests skipped");

const schemaSql = `
  CREATE TABLE orders (
    id varchar PRIMARY KEY,
    buyer_id varchar NOT NULL DEFAULT 'buyer',
    payment_status text NOT NULL DEFAULT 'unverified',
    payment_provider text,
    square_payment_id text,
    capture_idempotency_key text,
    provider_payment_status text,
    payment_captured_at timestamp,
    seller_revenue_status text NOT NULL DEFAULT 'uncredited',
    platform_fee numeric(8,2) NOT NULL DEFAULT 10,
    seller_amount numeric(10,2) NOT NULL DEFAULT 90
  );
  CREATE TABLE products (
    id varchar PRIMARY KEY,
    inventory integer DEFAULT 0
  );
  CREATE TABLE commissions (
    id varchar PRIMARY KEY,
    order_id varchar NOT NULL
  );
  CREATE TABLE _app_migrations (filename text PRIMARY KEY);
`;

let sequence = 0;
async function setup() {
  const client = new pg.Client({ connectionString: connectionString! });
  await client.connect();
  const schema = `checkout_atomicity_${process.pid}_${Date.now()}_${sequence++}`;
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  await client.query(schemaSql);
  return { client, schema };
}

async function teardown(client: pg.Client, schema: string) {
  await client.query("RESET search_path");
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.end();
}

function insertOrder(client: pg.Client, row: {
  id: string;
  paymentStatus: string;
  provider?: string | null;
  squarePaymentId?: string | null;
  captureIdempotencyKey?: string | null;
  providerPaymentStatus?: string | null;
  capturedAt?: boolean;
  revenueStatus?: string;
  inventoryStatus?: string | null;
}) {
  const columns = ["id", "payment_status", "payment_provider", "square_payment_id", "capture_idempotency_key",
    "provider_payment_status", "payment_captured_at", "seller_revenue_status"];
  const values = [
    row.id, row.paymentStatus, row.provider ?? null, row.squarePaymentId ?? null, row.captureIdempotencyKey ?? null,
    row.providerPaymentStatus ?? null, row.capturedAt ? new Date() : null, row.revenueStatus ?? "uncredited",
  ];
  if (row.inventoryStatus !== undefined) {
    columns.push("inventory_status");
    values.push(row.inventoryStatus);
  }
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  return client.query(`INSERT INTO orders (${columns.join(", ")}) VALUES (${placeholders})`, values);
}

async function classification(client: pg.Client, id: string) {
  return (await client.query(`SELECT inventory_status FROM orders WHERE id = $1`, [id])).rows[0]?.inventory_status;
}

/** Mirrors exactly what `drizzle-kit push` does to an existing table when it
 * adds a NOT NULL column with a default: every pre-existing row is stamped
 * with the default immediately, independently of and before any backfill. */
async function simulateBypassingDrizzlePush(client: pg.Client) {
  await client.query(`ALTER TABLE orders
    ADD COLUMN checkout_idempotency_key varchar(64),
    ADD COLUMN seller_tier_snapshot text,
    ADD COLUMN commission_rate_snapshot numeric(5,2),
    ADD COLUMN inventory_status text NOT NULL DEFAULT 'legacy_unverified'`);
}

postgresTest("path A: never-backfilled column classifies every payment state from its own evidence", async () => {
  const { client, schema } = await setup();
  try {
    await insertOrder(client, { id: "genuine-legacy", paymentStatus: "unverified" });
    await insertOrder(client, { id: "pending-good", paymentStatus: "capture_pending", captureIdempotencyKey: "idem-1" });
    await insertOrder(client, {
      id: "reconciliation-good", paymentStatus: "capture_reconciliation", provider: "square",
      squarePaymentId: "sq_1", captureIdempotencyKey: "idem-2", providerPaymentStatus: "COMPLETED", capturedAt: true,
    });
    await insertOrder(client, {
      id: "captured-good", paymentStatus: "captured", provider: "square", squarePaymentId: "sq_2",
      captureIdempotencyKey: "idem-3", providerPaymentStatus: "COMPLETED", capturedAt: true, revenueStatus: "credited",
    });
    await insertOrder(client, {
      id: "refunded-good", paymentStatus: "refunded", provider: "square", squarePaymentId: "sq_3",
      captureIdempotencyKey: "idem-4", providerPaymentStatus: "REFUNDED", capturedAt: true, revenueStatus: "reversed",
    });
    // Ambiguous/incomplete evidence must never be promoted off legacy_unverified.
    await insertOrder(client, { id: "pending-no-key", paymentStatus: "capture_pending", captureIdempotencyKey: null });
    await insertOrder(client, {
      id: "captured-missing-evidence", paymentStatus: "captured", provider: "square",
      squarePaymentId: null, captureIdempotencyKey: "idem-5", capturedAt: true, revenueStatus: "credited",
    });

    await applyMigration(client, "20260922_atomic_marketplace_checkout.sql", migration, { error() {} });

    assert.equal(await classification(client, "genuine-legacy"), "legacy_unverified");
    assert.equal(await classification(client, "pending-good"), "reserved");
    assert.equal(await classification(client, "reconciliation-good"), "reserved");
    assert.equal(await classification(client, "captured-good"), "sold");
    assert.equal(await classification(client, "refunded-good"), "sold");
    assert.equal(await classification(client, "pending-no-key"), "legacy_unverified");
    assert.equal(await classification(client, "captured-missing-evidence"), "legacy_unverified");

    const captured = (await client.query(
      `SELECT checkout_idempotency_key, seller_tier_snapshot, commission_rate_snapshot FROM orders WHERE id = 'captured-good'`
    )).rows[0];
    assert.equal(captured.checkout_idempotency_key, "p1-03:captured-good");
    assert.equal(captured.seller_tier_snapshot, "legacy_p1_03");
    assert.equal(Number(captured.commission_rate_snapshot), 10);
  } finally {
    await teardown(client, schema);
  }
});

postgresTest("path B: a schema push that already defaulted rows to legacy_unverified is still recoverable", async () => {
  const { client, schema } = await setup();
  try {
    // Simulates Drizzle's ADD COLUMN ... NOT NULL DEFAULT 'legacy_unverified'
    // running ahead of the migration/backfill: every row already carries the
    // default, none are NULL, before any row is even inserted.
    await simulateBypassingDrizzlePush(client);
    await insertOrder(client, { id: "stranded-pending", paymentStatus: "capture_pending", captureIdempotencyKey: "idem-1" });
    await insertOrder(client, {
      id: "stranded-reconciliation", paymentStatus: "capture_reconciliation", provider: "square",
      squarePaymentId: "sq_1", captureIdempotencyKey: "idem-2", providerPaymentStatus: "COMPLETED", capturedAt: true,
    });
    await insertOrder(client, {
      id: "stranded-captured", paymentStatus: "captured", provider: "square", squarePaymentId: "sq_2",
      captureIdempotencyKey: "idem-3", providerPaymentStatus: "COMPLETED", capturedAt: true, revenueStatus: "credited",
    });
    await insertOrder(client, { id: "genuine-legacy", paymentStatus: "unverified" });
    assert.equal(await classification(client, "stranded-pending"), "legacy_unverified");

    await enforceMarketplaceCheckoutAtomicity(client, migration, false);

    assert.equal(await classification(client, "stranded-pending"), "reserved");
    assert.equal(await classification(client, "stranded-reconciliation"), "reserved");
    assert.equal(await classification(client, "stranded-captured"), "sold");
    assert.equal(await classification(client, "genuine-legacy"), "legacy_unverified");
  } finally {
    await teardown(client, schema);
  }
});

postgresTest("repeated repair runs are idempotent and never touch an already-correct row", async () => {
  const { client, schema } = await setup();
  try {
    await simulateBypassingDrizzlePush(client);
    await insertOrder(client, { id: "pending-good", paymentStatus: "capture_pending", captureIdempotencyKey: "idem-1" });
    await insertOrder(client, { id: "genuine-legacy", paymentStatus: "unverified" });

    await enforceMarketplaceCheckoutAtomicity(client, migration, false);
    const firstPass = await client.query(`SELECT id, inventory_status, checkout_idempotency_key, seller_tier_snapshot, commission_rate_snapshot FROM orders ORDER BY id`);

    // A row the application itself already placed on the trusted lifecycle
    // (not 'legacy_unverified') must never be reclassified by a rerun.
    await client.query(`INSERT INTO orders (id, payment_status, inventory_status, checkout_idempotency_key, seller_tier_snapshot, commission_rate_snapshot)
      VALUES ('already-reserved', 'capture_pending', 'reserved', 'app:already-reserved', 'gold', 12.5)`);

    await enforceMarketplaceCheckoutAtomicity(client, migration, false);
    await enforceMarketplaceCheckoutAtomicity(client, migration, false);
    const secondPass = await client.query(`SELECT id, inventory_status, checkout_idempotency_key, seller_tier_snapshot, commission_rate_snapshot FROM orders WHERE id != 'already-reserved' ORDER BY id`);

    assert.deepEqual(secondPass.rows, firstPass.rows);
    assert.deepEqual(
      (await client.query(`SELECT inventory_status, checkout_idempotency_key, seller_tier_snapshot, commission_rate_snapshot FROM orders WHERE id = 'already-reserved'`)).rows[0],
      { inventory_status: "reserved", checkout_idempotency_key: "app:already-reserved", seller_tier_snapshot: "gold", commission_rate_snapshot: "12.50" }
    );
  } finally {
    await teardown(client, schema);
  }
});

postgresTest("partial bootstrap permits Drizzle to create fresh tables and fails closed once all three exist", async () => {
  const client = new pg.Client({ connectionString: connectionString! });
  await client.connect();
  const root = `checkout_partial_${process.pid}_${Date.now()}_${sequence++}`;
  try {
    await client.query(`CREATE SCHEMA ${root}_none`);
    await client.query(`SET search_path TO ${root}_none`);
    assert.deepEqual(
      await enforceMarketplaceCheckoutAtomicity(client, migration, true),
      { orders: false, products: false, commissions: false }
    );
    await assert.rejects(enforceMarketplaceCheckoutAtomicity(client, migration, false), /must all exist/);
  } finally {
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA IF EXISTS ${root}_none CASCADE`);
    await client.end();
  }
});

postgresTest("post-push reapplication restores a NOT VALID constraint Drizzle dropped as drift", async () => {
  const { client, schema } = await setup();
  try {
    await applyMigration(client, "20260922_atomic_marketplace_checkout.sql", migration, { error() {} });
    await client.query(`ALTER TABLE orders DROP CONSTRAINT orders_sold_inventory_payment_evidence_check`);
    const insertSoldMissingEvidence = (id: string) => client.query(
      `INSERT INTO orders (id, payment_status, inventory_status, checkout_idempotency_key, seller_tier_snapshot, commission_rate_snapshot)
       VALUES ($1, 'captured', 'sold', $1, 'tier', 10)`,
      [id]
    );
    await assert.doesNotReject(insertSoldMissingEvidence("would-violate"));
    await client.query(`DELETE FROM orders WHERE id = 'would-violate'`);

    await enforceMarketplaceCheckoutAtomicity(client, migration, false);

    await assert.rejects(insertSoldMissingEvidence("post-push-invalid"), (error: any) => error.code === "23514");
  } finally {
    await teardown(client, schema);
  }
});
