import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  applyAuthorizedDestructiveMigration,
  applyMigration,
  discoverMigrations,
  runPendingMigrations,
  type MigrationPool,
} from "./migration-runner";
import { DestructiveMigrationError, sha256 } from "./migration-safety";

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
if (!connectionString) console.log("# no reachable PostgreSQL -- migration-safety integration tests skipped");

const quiet = { log() {}, error() {} };
const here = dirname(fileURLToPath(import.meta.url));

/** A throwaway schema (and temp dir) per test; everything is dropped afterwards. Never touches other schemas. */
async function sandbox(run: (ctx: { client: pg.Client; db: MigrationPool; dir: string; schema: string }) => Promise<void>) {
  const client = new pg.Client({ connectionString: connectionString! });
  await client.connect();
  const schema = `mig_safety_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = await mkdtemp(join(tmpdir(), "mig-safety-"));
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE _app_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const db: MigrationPool = {
      query: (sql, params) => client.query(sql, params as any[]) as any,
      connect: async () => Object.assign(client, { release() {} }) as any,
    };
    await run({ client, db, dir, schema });
  } finally {
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
    await rm(dir, { recursive: true, force: true });
  }
}

const exists = async (c: pg.Client, table: string) =>
  (await c.query(`SELECT to_regclass($1) AS name`, [table])).rows[0].name !== null;
const ledger = async (c: pg.Client) => (await c.query(`SELECT filename FROM _app_migrations ORDER BY filename`)).rows.map((r) => r.filename);

postgresTest("the original unsafe file is not executed: it is not discoverable by the real runner sources", async () => {
  const serverDir = join(here, "..");
  const found = await discoverMigrations([
    { dir: join(serverDir, "drizzle"), keyPrefix: "drizzle", priority: 0 },
    { dir: join(serverDir, "migrations"), keyPrefix: "server", priority: 1 },
    { dir: join(serverDir, "..", "migrations"), keyPrefix: "legacy", priority: 2 },
  ]);
  assert.ok(found.length > 50);
  assert.ok(!found.some((f) => /cleanup_phase2/.test(f.filename)));
});

postgresTest("a dangerous file placed in a scanned directory is rejected and the live table survives", async () => {
  await sandbox(async ({ client, db, dir }) => {
    // Reproduces the pre-fix behaviour: cleanup_phase2.sql in a scanned dir used to drop live tables.
    await client.query(`CREATE TABLE competitions (id serial PRIMARY KEY, name text)`);
    await client.query(`INSERT INTO competitions (name) VALUES ('real user data')`);
    const original = await readFile(join(here, "..", "migration-quarantine", "cleanup_phase2.sql"), "utf-8");
    await mkdir(join(dir, "drizzle"));
    await writeFile(join(dir, "drizzle", "cleanup_phase2.sql"), original);

    await assert.rejects(
      runPendingMigrations(db, [{ dir: join(dir, "drizzle"), keyPrefix: "drizzle", priority: 0 }], quiet),
      /No migration was executed/
    );
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM competitions`)).rows[0].n, 1);
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("legitimate migrations run, are recorded once, and re-running is idempotent", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await writeFile(join(dir, "001_a.sql"), "CREATE TABLE a (id int); INSERT INTO a VALUES (1);");
    await writeFile(join(dir, "002_b.sql"), "ALTER TABLE a ADD COLUMN note text; ALTER TABLE a ALTER COLUMN note DROP NOT NULL;");
    const sources = [{ dir, keyPrefix: "drizzle", priority: 0 }];

    const first = await runPendingMigrations(db, sources, quiet);
    assert.deepEqual(first.applied, ["drizzle:001_a.sql", "drizzle:002_b.sql"]);
    const second = await runPendingMigrations(db, sources, quiet);
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.skipped, ["drizzle:001_a.sql", "drizzle:002_b.sql"]);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM a`)).rows[0].n, 1);
    assert.deepEqual(await ledger(client), ["drizzle:001_a.sql", "drizzle:002_b.sql"]);
  });
});

postgresTest("one unsafe pending file stops the whole run before any earlier safe file executes", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await client.query(`CREATE TABLE keep (id int)`);
    await writeFile(join(dir, "001_safe.sql"), "CREATE TABLE should_not_exist (id int);");
    await writeFile(join(dir, "002_unsafe.sql"), "CREATE TABLE half (id int);\n/* x */ DROP\nTABLE keep;");
    await assert.rejects(runPendingMigrations(db, [{ dir, keyPrefix: "drizzle", priority: 0 }], quiet), /destructive SQL/);
    assert.equal(await exists(client, "should_not_exist"), false);
    assert.equal(await exists(client, "half"), false);
    assert.equal(await exists(client, "keep"), true);
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("a rejected multi-statement migration leaves no partial schema change", async () => {
  await sandbox(async ({ client }) => {
    await client.query(`CREATE TABLE users (id int, email text)`);
    await assert.rejects(
      applyMigration(client, "t:multi.sql", "CREATE TABLE a (id int); CREATE TABLE b (id int); ALTER TABLE users DROP COLUMN email;", quiet),
      DestructiveMigrationError
    );
    assert.equal(await exists(client, "a"), false);
    assert.equal(await exists(client, "b"), false);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'email'`)).rows[0].n, 1);
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("existing history is untouched: recorded files are neither re-run nor re-validated", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await client.query(`INSERT INTO _app_migrations (filename, applied_at) VALUES ('drizzle:000_old.sql', '2020-01-01T00:00:00Z')`);
    const before = (await client.query(`SELECT filename, applied_at FROM _app_migrations`)).rows;
    // The already-recorded file contains destructive SQL (as a historical one might); it must be skipped silently.
    await writeFile(join(dir, "000_old.sql"), "DROP TABLE would_be_dangerous;");
    await writeFile(join(dir, "001_new.sql"), "CREATE TABLE fresh (id int);");
    const result = await runPendingMigrations(db, [{ dir, keyPrefix: "drizzle", priority: 0 }], quiet);
    assert.deepEqual(result.applied, ["drizzle:001_new.sql"]);
    const after = (await client.query(`SELECT filename, applied_at FROM _app_migrations WHERE filename = 'drizzle:000_old.sql'`)).rows;
    assert.deepEqual(after, before);
  });
});

postgresTest("a migration that fails halfway rolls back completely and succeeds on rerun after the fix", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await client.query(`CREATE TABLE uniq (v text UNIQUE)`);
    await client.query(`INSERT INTO uniq VALUES ('dup')`);
    await writeFile(join(dir, "001_half.sql"), "CREATE TABLE step_one (id int); INSERT INTO uniq VALUES ('dup'); CREATE TABLE step_three (id int);");
    const sources = [{ dir, keyPrefix: "drizzle", priority: 0 }];
    await assert.rejects(runPendingMigrations(db, sources, quiet), (e: any) => e.code === "23505");
    assert.equal(await exists(client, "step_one"), false);
    assert.deepEqual(await ledger(client), []);
    await client.query(`DELETE FROM uniq`);
    await runPendingMigrations(db, sources, quiet);
    assert.equal(await exists(client, "step_three"), true);
    assert.deepEqual(await ledger(client), ["drizzle:001_half.sql"]);
  });
});

postgresTest("DO-block and comment-obfuscated destructive SQL is rejected against a real database", async () => {
  await sandbox(async ({ client }) => {
    await client.query(`CREATE TABLE victim (id int)`);
    await client.query(`INSERT INTO victim VALUES (1)`);
    for (const sql of [
      "DO $$ BEGIN EXECUTE 'DROP TABLE victim'; END $$;",
      "TRUNCATE\n-- sneaky\nvictim;",
      "DROP/**/TABLE victim;",
      "DELETE FROM victim;",
    ]) {
      await assert.rejects(applyMigration(client, "t:x.sql", sql, quiet), DestructiveMigrationError, sql);
    }
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM victim`)).rows[0].n, 1);
  });
});

postgresTest("authorized destructive procedure requires the exact hash and database, runs atomically, and runs once", async () => {
  await sandbox(async ({ client }) => {
    await client.query(`CREATE TABLE doomed (id int)`);
    const sql = "DROP TABLE IF EXISTS doomed CASCADE;";
    const dbName = (await client.query(`SELECT current_database() AS n`)).rows[0].n;

    await assert.rejects(applyAuthorizedDestructiveMigration(client, "d.sql", sql, { sha256: "0".repeat(64), databaseName: dbName }, quiet), /hash does not match/);
    await assert.rejects(applyAuthorizedDestructiveMigration(client, "d.sql", sql, { sha256: sha256(sql), databaseName: "some_other_db" }, quiet), /nothing was executed/);
    assert.equal(await exists(client, "doomed"), true);

    await applyAuthorizedDestructiveMigration(client, "d.sql", sql, { sha256: sha256(sql), databaseName: dbName }, quiet);
    assert.equal(await exists(client, "doomed"), false);
    assert.deepEqual(await ledger(client), ["destructive:d.sql"]);
    await assert.rejects(applyAuthorizedDestructiveMigration(client, "d.sql", sql, { sha256: sha256(sql), databaseName: dbName }, quiet), /already applied/);
  });
});
