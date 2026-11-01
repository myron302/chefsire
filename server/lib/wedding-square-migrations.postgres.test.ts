import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import pg from "pg";
const { Client } = pg;
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  weddingSquareEnrollmentAttempts,
  weddingSquareSubscriptions,
  weddingSquareWebhookEvents,
  weddingSquareInvoiceEvidence,
} from "../../shared/schema/domains/wedding-square-billing";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FILES = [
  "server/migrations/20261101_01_wedding_square_enrollment_attempts.sql",
  "server/migrations/20261101_02_wedding_square_billing_foundation.sql",
];
const TABLES = [
  weddingSquareEnrollmentAttempts,
  weddingSquareSubscriptions,
  weddingSquareWebhookEvents,
  weddingSquareInvoiceEvidence,
];

const pgUrl = process.env.WEDDING_SQUARE_TEST_DATABASE_URL;
function disposableTestConnection(url: string): boolean {
  try {
    const u = new URL(url);
    return ["localhost", "127.0.0.1", "::1"].includes(u.hostname) &&
      /^[A-Za-z0-9_]*test[A-Za-z0-9_]*$/i.test(decodeURIComponent(u.pathname.slice(1)));
  } catch {
    return false;
  }
}

test("the prepared Wedding Square migrations match Drizzle schema on a disposable PostgreSQL instance", {
  skip: !pgUrl ? "WEDDING_SQUARE_TEST_DATABASE_URL not set" : undefined,
}, async () => {
  // Absolutely refuse to connect to Neon or any other remote/production DB.
  if (!pgUrl || !disposableTestConnection(pgUrl)) {
    throw new Error("Wedding Square schema tests are restricted to a loopback disposable *_test* PostgreSQL database.");
  }
  const db = new Client({ connectionString: pgUrl, connectionTimeoutMillis: 5000 });
  await db.connect();
  let started = false;
  try {
    await db.query("BEGIN");
    started = true;
    await db.query("SET LOCAL lock_timeout = '3s'");
    await db.query("SET LOCAL statement_timeout = '20s'");

    // This fixture mimics only the referenced owner primary key. The
    // entire fixture and all table DDL roll back at the end of the test.
    await db.query("CREATE TABLE users (id varchar PRIMARY KEY)");
    for (const file of FILES) {
      const sql = readFileSync(path.join(ROOT, file), "utf8");
      assert.doesNotMatch(sql, /\b(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|CREATE\s+INDEX\s+CONCURRENTLY)\b/i);
      await db.query(sql);
    }

    const allTables = (await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name LIKE 'wedding_square_%'"
    )).rows.map((row) => row.table_name).sort();
    assert.deepEqual(allTables, TABLES.map((t) => getTableConfig(t).name).sort());

    for (const table of TABLES) {
      const config = getTableConfig(table);
      const actual = (await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",
        [config.name],
      )).rows;
      assert.deepEqual(actual.map((column) => column.column_name).sort(),
        config.columns.map((column) => column.name).sort(), config.name + ": SQL and Drizzle columns differ");
      for (const column of config.columns) {
        const dbColumn = actual.find((item) => item.column_name === column.name);
        assert.ok(dbColumn, column.name + " missing from " + config.name);
        assert.equal(dbColumn.is_nullable, column.notNull ? "NO" : "YES", config.name + "." + column.name);
        const expectedType = column.dataType === "date" ? "date"
          : column.columnType.startsWith("PgUUID") ? "uuid"
          : column.columnType.startsWith("PgVarchar") ? "character varying"
          : column.columnType.startsWith("PgTimestamp") ? "timestamp with time zone"
          : column.columnType.startsWith("PgInteger") ? "integer"
          : "text";
        assert.equal(dbColumn.data_type, expectedType, config.name + "." + column.name);
      }
      const definitions = (await db.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass`, [config.name],
      )).rows.map((row) => row.conname);
      for (const check of config.checks) assert.ok(definitions.includes(check.name), config.name + " missing CHECK " + check.name);
      for (const constraint of config.uniqueConstraints) assert.ok(definitions.includes(constraint.name), config.name + " missing UNIQUE " + constraint.name);
      for (const constraint of config.primaryKeys) assert.ok(definitions.includes(constraint.getName()), config.name + " missing PRIMARY KEY " + constraint.getName());
      const indexes = (await db.query<{ indexname: string }>(
        "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = $1", [config.name],
      )).rows.map((row) => row.indexname);
      for (const index of config.indexes) assert.ok(indexes.includes(index.config.name!), config.name + " missing index " + index.config.name);
    }

    await db.query("INSERT INTO users (id) VALUES ('test-user-1'), ('test-user-2')");
    const insertAttempt = `INSERT INTO wedding_square_enrollment_attempts
      (user_id, tier, consent_terms_version, consented_at, consented_amount_cents, consented_currency,
       square_location_id, square_plan_variation_id, square_customer_id, square_card_id,
       idempotency_key, request_fingerprint)
      VALUES ($1, 'premium', 'consent-v1', now(), $2, 'USD',
              'loc-1', 'plan-1', 'customer-1', 'card-1', $3, repeat('a',64))`;
    await db.query(insertAttempt, ["test-user-1", 2499, "once-only"]);

    const expectRefused = async (sql: string, params: unknown[] = []) => {
      await db.query("SAVEPOINT reject_probe");
      await assert.rejects(db.query(sql, params), (error: unknown) =>
        typeof (error as { code?: string }).code === "string");
      await db.query("ROLLBACK TO SAVEPOINT reject_probe");
      await db.query("RELEASE SAVEPOINT reject_probe");
    };
    // Atomic one-live-attempt constraint protects uncertain Square calls.
    await expectRefused(insertAttempt, ["test-user-1", 2499, "another-key"]);
    // Idempotency keys cannot be reissued to another account.
    await expectRefused(insertAttempt, ["test-user-2", 2499, "once-only"]);
    // No incorrect Premium amount can be persisted.
    await expectRefused(insertAttempt, ["test-user-2", 4999, "different-key"]);

    const webhook = `INSERT INTO wedding_square_webhook_events
      (event_id, square_environment, square_merchant_id, event_type, processing_status)
      VALUES ('evt-1', 'sandbox', 'merchant-1', 'invoice.payment_made', 'pending')
      ON CONFLICT (square_environment, square_merchant_id, event_id) DO NOTHING`;
    assert.equal((await db.query(webhook)).rowCount, 1);
    assert.equal((await db.query(webhook)).rowCount, 0);
    await expectRefused(`INSERT INTO wedding_square_webhook_events
      (event_id, square_environment, square_merchant_id, event_type, processing_status)
      VALUES ('evt-2','sandbox','merchant-1','invoice.payment_made','verified_paid')`);

    const sub = (await db.query<{ id: string }>(`INSERT INTO wedding_square_subscriptions
      (user_id, tier, square_environment, square_merchant_id, square_location_id,
       square_customer_id, square_plan_variation_id, square_subscription_id,
       billing_consent_at, billing_consent_terms_version, agreed_monthly_amount_cents,
       agreed_currency, requested_start_date)
      VALUES ('test-user-1','premium','sandbox','merchant-1','loc-1','customer-1',
              'plan-1','sub-1',now(),'consent-v1',2499,'USD',current_date)
      RETURNING id`)).rows[0];
    assert.ok(sub.id);
    const evidence = `INSERT INTO wedding_square_invoice_evidence
      (wedding_subscription_id, square_environment, square_merchant_id, square_invoice_id,
       square_payment_id, square_subscription_id, verified_amount_cents, verified_currency,
       provider_paid_at, period_starts_at, period_ends_at)
      VALUES ($1,'sandbox','merchant-1',$2,$3,'sub-1',2499,'USD',
              now(), now() - interval '1 day', now() + interval '29 days')`;
    await db.query(evidence, [sub.id, "invoice-1", "payment-1"]);
    await expectRefused(evidence, [sub.id, "invoice-1", "payment-2"]);
    await expectRefused(evidence, [sub.id, "invoice-2", "payment-1"]);
    await expectRefused(`INSERT INTO wedding_square_invoice_evidence
      (wedding_subscription_id, square_environment, square_merchant_id, square_invoice_id,
       square_payment_id, square_subscription_id, verified_amount_cents, verified_currency,
       provider_paid_at, period_starts_at, period_ends_at)
      VALUES ($1,'sandbox','merchant-1','invoice-bad','payment-bad','sub-1',2499,'USD',
              now(), now(), now())`, [sub.id]);

    // No permanent schema or fixture data leaves this test.
  } finally {
    if (started) await db.query("ROLLBACK").catch(() => undefined);
    await db.end();
  }
});
