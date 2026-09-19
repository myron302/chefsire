import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { applyMigration } from "./migration-runner";

const candidates = [
  process.env.TEST_DATABASE_URL,
  process.env.PGURL,
  process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : undefined,
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
      // Try the next conventional test connection.
    }
  }
  return null;
}

const connectionString = await firstReachable();
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# no reachable PostgreSQL -- migration-runner integration test skipped");

postgresTest("real PostgreSQL fails closed on 23505 and recovers on rerun", async () => {
  const client = new pg.Client({ connectionString: connectionString! });
  await client.connect();
  const schema = `migration_runner_${process.pid}_${Date.now()}`;
  const quiet = { error() {} };
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE _app_migrations (filename text PRIMARY KEY)`);
    await client.query(`CREATE TABLE unique_values (value text UNIQUE)`);
    await client.query(`INSERT INTO unique_values VALUES ('duplicate')`);

    const failingSql = `
      CREATE TABLE statement_a (id integer);
      INSERT INTO unique_values VALUES ('duplicate');
      CREATE TABLE statement_c (id integer);
    `;
    await assert.rejects(
      applyMigration(client, "integration:23505.sql", failingSql, quiet),
      (error: any) => error.code === "23505"
    );
    assert.equal((await client.query(`SELECT to_regclass('statement_a') AS name`)).rows[0].name, null);
    assert.equal((await client.query(`SELECT to_regclass('statement_c') AS name`)).rows[0].name, null);
    assert.equal((await client.query(`SELECT count(*)::int AS count FROM _app_migrations`)).rows[0].count, 0);

    await client.query(`DELETE FROM unique_values WHERE value = 'duplicate'`);
    await applyMigration(client, "integration:23505.sql", failingSql, quiet);
    assert.equal((await client.query(`SELECT count(*)::int AS count FROM _app_migrations`)).rows[0].count, 1);
    assert.equal((await client.query(`SELECT to_regclass('statement_c') AS name`)).rows[0].name, "statement_c");
  } finally {
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
