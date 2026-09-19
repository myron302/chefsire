/** Executes the production payout-integrity migration against isolated PostgreSQL schemas. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyMigration } from "../scripts/migration-runner";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "20260919_payout_integrity.sql"), "utf8");
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
if (!connectionString) console.log("# no reachable isolated PostgreSQL -- payout migration integration tests skipped");

const schemaSql = `
  CREATE TABLE payouts (
    id varchar PRIMARY KEY,
    provider_payout_id text,
    status text DEFAULT 'pending',
    processed_at timestamp,
    completed_at timestamp
  );
  CREATE TABLE commissions (
    id varchar PRIMARY KEY,
    order_id varchar NOT NULL,
    payout_id varchar REFERENCES payouts(id),
    status text DEFAULT 'pending',
    audit_note text
  );
  CREATE TABLE _app_migrations (filename text PRIMARY KEY);
`;

let sequence = 0;
async function setup() {
  const client = new pg.Client({ connectionString: connectionString! });
  await client.connect();
  const schema = `payout_integrity_${process.pid}_${Date.now()}_${sequence++}`;
  const decoy = `${schema}_decoy`;
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`CREATE SCHEMA ${decoy}`);
  await client.query(`CREATE TABLE ${decoy}.payouts (id integer, CONSTRAINT payouts_completed_transfer_check CHECK (id > 0))`);
  await client.query(`SET search_path TO ${schema}`);
  await client.query(schemaSql);
  return { client, schema, decoy };
}

async function teardown(client: pg.Client, schema: string, decoy: string) {
  await client.query("RESET search_path");
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.query(`DROP SCHEMA IF EXISTS ${decoy} CASCADE`);
  await client.end();
}

postgresTest("production payout migration enforces completion and preserves history", async () => {
  const { client, schema, decoy } = await setup();
  try {
    await client.query(`INSERT INTO payouts (id, status) VALUES ('historic-payout', 'pending')`);
    await client.query(`INSERT INTO commissions (id, order_id, status, audit_note) VALUES ('historic-commission', 'historic-order', 'pending', 'keep me')`);

    await applyMigration(client, "20260919_payout_integrity.sql", migration, { error() {} });

    const targetConstraint = await client.query(
      `SELECT count(*)::int AS count FROM pg_constraint
        WHERE conname = 'payouts_completed_transfer_check' AND conrelid = 'payouts'::regclass`
    );
    assert.equal(targetConstraint.rows[0].count, 1, "a same-named constraint on another relation must not suppress creation");
    assert.equal((await client.query(`SELECT audit_note FROM commissions WHERE id = 'historic-commission'`)).rows[0].audit_note, "keep me");
    assert.equal((await client.query(`SELECT status FROM payouts WHERE id = 'historic-payout'`)).rows[0].status, "pending");

    const insertCompleted = (id: string, providerId: string | null, timestamps = true) => client.query(
      `INSERT INTO payouts (id, provider_payout_id, status, processed_at, completed_at)
       VALUES ($1, $2, 'completed', $3, $3)`,
      [id, providerId, timestamps ? new Date() : null]
    );
    await assert.rejects(insertCompleted("missing-evidence", null), (error: any) => error.code === "23514");
    await assert.rejects(insertCompleted("empty-evidence", ""), (error: any) => error.code === "23514");
    await assert.rejects(insertCompleted("blank-evidence", "   "), (error: any) => error.code === "23514");
    await assert.rejects(insertCompleted("legacy-placeholder", "sq_payout_1700000000000"), (error: any) => error.code === "23514");
    await assert.rejects(insertCompleted("legacy-simulation", "payout_sim_1700000000000"), (error: any) => error.code === "23514");
    await assert.rejects(insertCompleted("legacy-square-simulation", "sq_payout_sim_1700000000000"), (error: any) => error.code === "23514");
    await insertCompleted("verified", "provider-transfer-abc123");
  } finally {
    await teardown(client, schema, decoy);
  }
});

postgresTest("PostgreSQL serializes concurrent claims and rejects the duplicate with 23505", async () => {
  const { client, schema, decoy } = await setup();
  const rival = new pg.Client({ connectionString: connectionString! });
  await rival.connect();
  try {
    await applyMigration(client, "20260919_payout_integrity.sql", migration, { error() {} });
    await client.query(`INSERT INTO payouts (id) VALUES ('claim-a'), ('claim-b')`);
    await rival.query(`SET search_path TO ${schema}`);
    await client.query("BEGIN");
    await rival.query("BEGIN");
    await client.query(`INSERT INTO commissions (id, order_id, payout_id, status) VALUES ('claim-1', 'order-1', 'claim-a', 'processing')`);

    const competingInsert = rival.query(
      `INSERT INTO commissions (id, order_id, payout_id, status) VALUES ('claim-2', 'order-1', 'claim-b', 'processing')`
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    await client.query("COMMIT");
    await assert.rejects(competingInsert, (error: any) => error.code === "23505");
    await rival.query("ROLLBACK");
    assert.equal((await client.query(`SELECT count(*)::int AS count FROM commissions WHERE order_id = 'order-1'`)).rows[0].count, 1);
  } finally {
    await rival.end();
    await teardown(client, schema, decoy);
  }
});
