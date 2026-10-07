/**
 * Drizzle <-> SQL migration parity for the Phase 2Q objects, on a REAL PostgreSQL. `drizzle-kit push` treats the Drizzle schema as
 * authoritative: a constraint or index the Drizzle declaration lacks is DROPPED from a migrated database, and one it has wrongly is
 * created on a fresh one. So the database built by `drizzle-kit push` (the template every harness clones) and the database built by
 * `20261014_catering_square_payments.sql` must be catalog-identical for every object this phase adds or widens.
 *
 * Set TEST_DATABASE_URL to a loopback database whose name contains "test"; skipped otherwise. Never production.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";
import { getTableConfig } from "drizzle-orm/pg-core";
import { CATERING_LEDGER_PROCESSOR_PAYMENT_ID_COLUMN_LENGTH, SQUARE_PAYMENT_ID_MAX_LENGTH, SQUARE_ORDER_ID_MAX_LENGTH, SQUARE_PAYMENT_LINK_ID_MAX_LENGTH } from "../../shared/catering-square-payments";
import { cateringBookingPayments } from "../../shared/schema";
import { cateringAttemptSquarePayments, cateringBookingPaymentAttempts, cateringSquareWebhookEvents } from "../../shared/schema";
import * as barrel from "../../shared/schema";
import { prepareCateringSquareEnvironment, withCateringSquareHarness, type CateringSquareHarness } from "../test-support/catering-square-harness";

prepareCateringSquareEnvironment();
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = fs.readFileSync(path.join(root, "server", "migrations", "20261014_catering_square_payments.sql"), "utf8");

test("the barrel exports both Phase 2Q tables, which is how drizzle-kit finds them", () => {
  assert.equal((barrel as Record<string, unknown>).cateringBookingPaymentAttempts, cateringBookingPaymentAttempts);
  assert.equal((barrel as Record<string, unknown>).cateringSquareWebhookEvents, cateringSquareWebhookEvents);
  assert.equal(getTableConfig(cateringBookingPaymentAttempts).name, "catering_booking_payment_attempts");
  assert.equal(getTableConfig(cateringSquareWebhookEvents).name, "catering_square_webhook_events");
  assert.equal(getTableConfig(cateringAttemptSquarePayments).name, "catering_attempt_square_payments");
  assert.equal((barrel as Record<string, unknown>).cateringAttemptSquarePayments, cateringAttemptSquarePayments);
});

test("money columns in the new tables are bigint cents, read as numbers: no decimal, float or numeric", () => {
  assert.equal(/decimal|numeric|real\b|double precision|float/i.test(migration.replace(/--.*$/gm, "")), false);
  for (const table of [cateringBookingPaymentAttempts, cateringAttemptSquarePayments]) {
    for (const column of getTableConfig(table).columns.filter((candidate) => /cents/.test(candidate.name))) {
      assert.equal(column.getSQLType(), "bigint", column.name);
      assert.equal((column as unknown as { mapFromDriverValue(value: unknown): unknown }).mapFromDriverValue("12345"), 12345, `${column.name} reads as a number`);
    }
  }
});

test("the migration is additive: it drops no table or column and touches only the constraints it names", () => {
  const body = migration.replace(/--.*$/gm, "");
  assert.equal(/DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM/i.test(body), false);
  // The ONLY column alteration is the widening of the ledger's processor payment id (no narrowing, no rewrite).
  assert.deepEqual([...body.matchAll(/ALTER\s+COLUMN\s+(\w+)\s+TYPE\s+([\w()]+)/gi)].map((match) => [match[1], match[2]]), [["processor_payment_id", "varchar(255)"]]);
  const dropped = [...body.matchAll(/DROP CONSTRAINT IF EXISTS (\w+)/g)].map((match) => match[1]).sort();
  assert.deepEqual(dropped, ["catering_booking_activity_event_type_check", "catering_payment_method_check", "catering_payment_online_method_check", "catering_payment_processor_check"]);
});

test("the Drizzle ledger column holds the longest valid Square payment id, matches the SQL migration, and the identifier maximums agree", () => {
  const column = getTableConfig(cateringBookingPayments).columns.find((candidate) => candidate.name === "processor_payment_id")!;
  assert.equal(column.getSQLType(), `varchar(${CATERING_LEDGER_PROCESSOR_PAYMENT_ID_COLUMN_LENGTH})`);
  assert.ok(CATERING_LEDGER_PROCESSOR_PAYMENT_ID_COLUMN_LENGTH >= SQUARE_PAYMENT_ID_MAX_LENGTH, "never narrower than Square's 192");
  assert.equal(SQUARE_PAYMENT_ID_MAX_LENGTH, 192);
  assert.match(migration.replace(/--.*$/gm, ""), new RegExp(`ALTER COLUMN processor_payment_id TYPE varchar\\(${CATERING_LEDGER_PROCESSOR_PAYMENT_ID_COLUMN_LENGTH}\\)`));
  // Identifier audit: every OTHER persisted Square identifier of this phase is unbounded text, so none can truncate or reject a valid id.
  const text = (table: Parameters<typeof getTableConfig>[0], name: string) => getTableConfig(table).columns.find((candidate) => candidate.name === name)!.getSQLType();
  for (const [table, name] of [[cateringBookingPaymentAttempts, "square_payment_id"], [cateringBookingPaymentAttempts, "square_order_id"], [cateringBookingPaymentAttempts, "square_payment_link_id"], [cateringBookingPaymentAttempts, "merchant_id"], [cateringBookingPaymentAttempts, "location_id"], [cateringAttemptSquarePayments, "square_payment_id"], [cateringSquareWebhookEvents, "event_id"], [cateringSquareWebhookEvents, "square_order_id"], [cateringSquareWebhookEvents, "square_payment_id"], [cateringSquareWebhookEvents, "merchant_id"]] as const) {
    assert.equal(text(table, name), "text", `${name} is unbounded text`);
  }
  assert.ok(SQUARE_ORDER_ID_MAX_LENGTH >= 192 && SQUARE_PAYMENT_LINK_ID_MAX_LENGTH >= 192);
});

if (!URL_ENV) {
  test("Catering Square schema parity (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: CateringSquareHarness) => Promise<void>) => withCateringSquareHarness(URL_ENV, {}, fn);

  /** A name-independent description of a table's catalog: columns, indexes, and constraints (foreign keys by definition only). */
  async function describeTable(h: CateringSquareHarness, table: string) {
    const columns = await h.q(
      `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY column_name`, [table]);
    const indexes = await h.q(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema() AND tablename = $1 AND indexname NOT LIKE '%_pkey' ORDER BY indexname`, [table]);
    const constraints = await h.q(
      `SELECT CASE WHEN contype = 'f' THEN 'foreign key' ELSE conname END AS name, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY 1, 3`, [table]);
    return { columns, indexes, constraints };
  }

  test("the SQL migration produces exactly the catalog drizzle-kit push produces, for both new tables and every widened constraint", async () => {
    await run(async (h) => {
      const tables = ["catering_booking_payment_attempts", "catering_square_webhook_events"];
      const before = { evidence: await describeTable(h, "catering_attempt_square_payments"), attempts: await describeTable(h, tables[0]), webhooks: await describeTable(h, tables[1]), payments: await describeTable(h, "catering_booking_payments"), activity: await describeTable(h, "catering_booking_activity") };
      assert.ok(before.attempts.columns.length >= 28 && before.webhooks.columns.length === 13, "the push built both tables");

      // Rebuild everything Phase 2Q owns from its SQL migration alone.
      await h.pool.query(`DROP TABLE catering_attempt_square_payments; DROP TABLE catering_square_webhook_events; DROP TABLE catering_booking_payment_attempts;`);
      await h.pool.query(migration);
      const after = { evidence: await describeTable(h, "catering_attempt_square_payments"), attempts: await describeTable(h, tables[0]), webhooks: await describeTable(h, tables[1]), payments: await describeTable(h, "catering_booking_payments"), activity: await describeTable(h, "catering_booking_activity") };

      assert.deepEqual(after.attempts, before.attempts, "catering_booking_payment_attempts: migration == drizzle push");
      assert.deepEqual(after.evidence, before.evidence, "catering_attempt_square_payments: migration == drizzle push");
      assert.deepEqual(after.webhooks, before.webhooks, "catering_square_webhook_events: migration == drizzle push");
      assert.deepEqual(after.payments, before.payments, "catering_booking_payments: widened/added checks are identical");
      assert.deepEqual(after.activity, before.activity, "catering_booking_activity: the widened event check is identical");

      // And it is safe to run again (every statement is idempotent), leaving the same catalog.
      await h.pool.query(migration);
      assert.deepEqual(await describeTable(h, tables[0]), before.attempts);
      assert.deepEqual(await describeTable(h, "catering_booking_payments"), before.payments);
    });
  });

  test("a push-built database enforces the same invariants the migration does: sandbox, one open attempt per invoice, one ledger row per Square payment", async () => {
    await run(async (h) => {
      const names = (await h.q(`SELECT conname FROM pg_constraint WHERE conrelid = 'catering_booking_payment_attempts'::regclass AND contype = 'c' ORDER BY conname`)).map((row) => row.conname);
      assert.ok(names.includes("catering_attempt_environment_check") && names.includes("catering_attempt_processor_check") && names.includes("catering_attempt_currency_check"));
      const indexes = (await h.q(`SELECT indexname FROM pg_indexes WHERE tablename = 'catering_booking_payment_attempts'`)).map((row) => row.indexname);
      for (const expected of ["catering_attempts_idempotency_uidx", "catering_attempts_open_invoice_uidx", "catering_attempts_order_uidx", "catering_attempts_square_payment_uidx", "catering_attempts_ledger_uidx", "catering_attempts_link_uidx"]) assert.ok(indexes.includes(expected), expected);
      const ledger = (await h.q(`SELECT indexname FROM pg_indexes WHERE tablename = 'catering_booking_payments'`)).map((row) => row.indexname);
      assert.ok(ledger.includes("catering_payments_processor_uidx"), "the existing processor-payment uniqueness invariant is intact");
    });
  });

  test("db:push over a database built from the SQL migration is a no-op for Phase 2Q: nothing it owns is dropped or narrowed", async () => {
    await run(async (h) => {
      const tables = ["catering_attempt_square_payments", "catering_booking_payment_attempts", "catering_square_webhook_events", "catering_booking_payments", "catering_booking_activity"];
      await h.pool.query(`DROP TABLE catering_attempt_square_payments; DROP TABLE catering_square_webhook_events; DROP TABLE catering_booking_payment_attempts;`);
      await h.pool.query(migration);
      const before = await Promise.all(tables.map((table) => describeTable(h, table)));
      const config = parseLocalTestDatabaseUrl(URL_ENV);
      const url = `postgres://${config.user ?? "postgres"}${config.password ? `:${config.password}` : ""}@${config.host}:${config.port}/${h.database}`;
      const result = spawnSync("npx", ["drizzle-kit", "push", "--force"], { cwd: root, env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", timeout: 240_000 });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`.slice(-1500));
      assert.deepEqual(await Promise.all(tables.map((table) => describeTable(h, table))), before);
    });
  });

  test("migration over an OLD varchar(128) ledger column widens it in place: existing shorter ids survive, the unique index still blocks duplicates, and a 192-character id then fits", async () => {
    await run(async (h) => {
      // Put the ledger column back to what Phase 2L created, with a real processor row in it.
      await h.pool.query(`ALTER TABLE catering_booking_payments ALTER COLUMN processor_payment_id TYPE varchar(128)`);
      const providerId = await h.user("provider");
      const customerId = await h.user("customer");
      const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices: [{ kind: "deposit", amountCents: 40000 }] });
      const insert = (id: string) => h.pool.query(
        `INSERT INTO catering_booking_payments (booking_id, invoice_id, amount_cents, currency, payment_method, payment_source, status, received_on, processor, processor_payment_id)
         VALUES ($1, $2, 100, 'USD', 'card_online', 'processor', 'recorded', current_date, 'square', $3)`, [bookingId, invoiceIds[0], id]);
      await insert("SHORT_PAYMENT_ID");
      await insert("S".repeat(128));
      await assert.rejects(insert("L".repeat(129)), /value too long/, "the old column really was too narrow");
      const indexBefore = (await h.q(`SELECT indexdef FROM pg_indexes WHERE indexname = 'catering_payments_processor_uidx'`))[0].indexdef;

      await h.pool.query(migration);
      const column = (await h.q(`SELECT character_maximum_length FROM information_schema.columns WHERE table_name = 'catering_booking_payments' AND column_name = 'processor_payment_id'`))[0];
      assert.equal(Number(column.character_maximum_length), 255);
      assert.deepEqual((await h.q(`SELECT processor_payment_id FROM catering_booking_payments WHERE booking_id = $1 ORDER BY length(processor_payment_id)`, [bookingId])).map((row) => row.processor_payment_id), ["SHORT_PAYMENT_ID", "S".repeat(128)], "existing ids are untouched");
      assert.equal((await h.q(`SELECT indexdef FROM pg_indexes WHERE indexname = 'catering_payments_processor_uidx'`))[0].indexdef, indexBefore, "the uniqueness invariant is the same index");
      for (const length of [129, 192]) {
        await insert("L".repeat(length));
        await assert.rejects(insert("L".repeat(length)), /catering_payments_processor_uidx/, `a duplicate ${length}-character id is still blocked`);
      }
      await assert.rejects(insert("SHORT_PAYMENT_ID"), /catering_payments_processor_uidx/);
    });
  });
}
