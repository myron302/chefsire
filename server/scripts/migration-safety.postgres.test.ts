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
import { describeTarget, targetFingerprint, TargetVerificationError } from "./migration-target";

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

const authFor = async (client: pg.Client, sql: string, url = connectionString!) => {
  const identity = await describeTarget(client, url);
  return { sha256: sha256(sql), databaseName: identity.databaseName, targetFingerprint: targetFingerprint(identity) };
};
const opts = (url = connectionString!) => ({ connectionString: url, logger: quiet });
const count = async (c: pg.Client, table: string) => (await c.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;

postgresTest("authorized destructive procedure: exact hash + verified target, atomic, runs once", async () => {
  await sandbox(async ({ client }) => {
    await client.query(`CREATE TABLE doomed (id int)`);
    const sql = "DROP TABLE IF EXISTS doomed CASCADE;";
    const good = await authFor(client, sql);

    await assert.rejects(applyAuthorizedDestructiveMigration(client, "d.sql", sql, { ...good, sha256: "0".repeat(64) }, opts()), /hash does not match/);
    await assert.rejects(applyAuthorizedDestructiveMigration(client, "d.sql", sql, { ...good, databaseName: "some_other_db" }, opts()), TargetVerificationError);
    await assert.rejects(applyAuthorizedDestructiveMigration(client, "d.sql", sql, { ...good, targetFingerprint: "f".repeat(64) }, opts()), TargetVerificationError);
    assert.equal(await exists(client, "doomed"), true);
    assert.deepEqual(await ledger(client), []);

    await applyAuthorizedDestructiveMigration(client, "d.sql", sql, good, opts());
    assert.equal(await exists(client, "doomed"), false);
    assert.deepEqual(await ledger(client), ["destructive:d.sql"]);
    await assert.rejects(applyAuthorizedDestructiveMigration(client, "d.sql", sql, good, opts()), /already applied/);
  });
});

postgresTest("a different server/route (same database name) is rejected and zero destructive statements run", async () => {
  await sandbox(async ({ client }) => {
    await client.query(`CREATE TABLE victim (id int); INSERT INTO victim VALUES (1)`);
    const sql = "DELETE FROM victim WHERE id = 1; DROP TABLE victim;";
    const auth = await authFor(client, sql);
    // Same database name, same server, but the authorization was issued for another host/port route.
    const routeUrl = new URL(connectionString!);
    routeUrl.searchParams.set("host", "db-prod.example.internal");
    const otherRoute = routeUrl.toString();
    assert.notEqual(targetFingerprint(await describeTarget(client, otherRoute)), auth.targetFingerprint);
    await assert.rejects(applyAuthorizedDestructiveMigration(client, "wrong-route.sql", sql, auth, opts(otherRoute)), /does not match the authorized target/);
    assert.equal(await count(client, "victim"), 1);
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("target identity that cannot be verified fails closed", async () => {
  await sandbox(async ({ client }) => {
    await client.query(`CREATE TABLE victim (id int)`);
    const sql = "DROP TABLE victim;";
    const auth = await authFor(client, sql);
    try {
      // A role/server that will not disclose pg_control_system() (stood in for by a wrapper that denies it).
      const denied = {
        query: async (text: string, params?: unknown[]) => {
          if (/pg_control_system/.test(text)) throw Object.assign(new Error("permission denied for function pg_control_system"), { code: "42501" });
          return client.query(text, params as any[]);
        },
      };
      await assert.rejects(describeTarget(denied, connectionString!), /pg_control_system\(\) is not readable/);
      await assert.rejects(
        applyAuthorizedDestructiveMigration(denied as any, "unverifiable.sql", sql, auth, opts()),
        TargetVerificationError
      );
      // A Neon host whose compute reports neither endpoint nor timeline id is refused rather than guessed.
      const neonUrl = "postgres://u@ep-cool-123-pooler.us-east-2.aws.neon.tech/db";
      await assert.rejects(describeTarget(client, neonUrl), /neither neon\.endpoint_id nor neon\.timeline_id/);
      await assert.rejects(describeTarget(client, "not a url"), TargetVerificationError);
      // Simulated Neon compute reporting its ids (session-level custom GUC stands in for the neon extension).
      await client.query(`SELECT set_config('neon.timeline_id', 'tl-abc', false), set_config('neon.endpoint_id', 'ep-cool-123', false)`);
      const pooled = await describeTarget(client, neonUrl);
      const direct = await describeTarget(client, neonUrl.replace("-pooler", ""));
      assert.equal(targetFingerprint(pooled), targetFingerprint(direct), "pooler and direct endpoints of one compute match");
      assert.notEqual(targetFingerprint(pooled), auth.targetFingerprint);
    } finally {
      await client.query(`RESET neon.timeline_id`);
      await client.query(`RESET neon.endpoint_id`);
    }
    assert.equal(await exists(client, "victim"), true);
    assert.deepEqual(await ledger(client), []);
  });
});

async function extraClient(schema: string) {
  const c = new pg.Client({ connectionString: connectionString! });
  await c.connect();
  await c.query(`SET search_path TO ${schema}`);
  return c;
}

postgresTest("concurrent invocations: exactly one executes the destructive SQL", async () => {
  await sandbox(async ({ client, schema }) => {
    await client.query(`CREATE TABLE runs (n int); CREATE TABLE doomed (id int)`);
    const sql = "INSERT INTO runs VALUES (1); SELECT pg_sleep(1); DROP TABLE IF EXISTS doomed;";
    const auth = await authFor(client, sql);
    const clients = [client, await extraClient(schema), await extraClient(schema)];
    try {
      const results = await Promise.allSettled(clients.map((c) => applyAuthorizedDestructiveMigration(c, "race.sql", sql, auth, opts())));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      for (const r of results.filter((x) => x.status === "rejected")) assert.match(String((r as PromiseRejectedResult).reason.message), /already applied/);
      assert.equal(await count(client, "runs"), 1, "destructive SQL ran exactly once");
      assert.deepEqual(await ledger(client), ["destructive:race.sql"]);
    } finally {
      await Promise.all(clients.slice(1).map((c) => c.end()));
    }
  });
});

postgresTest("failure rolls back every statement and the claim; a corrected retry then succeeds; lock is released", async () => {
  await sandbox(async ({ client, schema }) => {
    await client.query(`CREATE TABLE doomed (id int); INSERT INTO doomed VALUES (1)`);
    const broken = "DELETE FROM doomed WHERE id = 1; INSERT INTO no_such_table VALUES (1);";
    await assert.rejects(applyAuthorizedDestructiveMigration(client, "retry.sql", broken, await authFor(client, broken), opts()), (e: any) => e.code === "42P01");
    assert.equal(await count(client, "doomed"), 1, "first statement rolled back");
    assert.deepEqual(await ledger(client), [], "claim rolled back");

    // A second connection can take the lock immediately (it was released by the rollback).
    const other = await extraClient(schema);
    try {
      const fixed = "DELETE FROM doomed WHERE id = 1;";
      await applyAuthorizedDestructiveMigration(other, "retry.sql", fixed, await authFor(other, fixed), opts());
      assert.equal(await count(client, "doomed"), 0);
      assert.deepEqual(await ledger(client), ["destructive:retry.sql"]);
    } finally {
      await other.end();
    }
  });
});

postgresTest("integrated: routine runner rejects unsafe/dynamic input, runs safe input, and never writes a ledger entry for rejected files", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await client.query(`CREATE TABLE users (id int); INSERT INTO users VALUES (1)`);
    const sources = [{ dir, keyPrefix: "drizzle", priority: 0 }];
    await writeFile(join(dir, "001_safe.sql"), "CREATE TABLE ok_table (id int);");
    await writeFile(join(dir, "002_dyn.sql"), "DO 'BEGIN EXECUTE ''DROP TABLE users''; END';");
    await assert.rejects(runPendingMigrations(db, sources, quiet), /No migration was executed/);
    assert.equal(await exists(client, "ok_table"), false, "earlier safe file did not execute");
    assert.equal(await count(client, "users"), 1);
    await rm(join(dir, "002_dyn.sql"));
    await writeFile(join(dir, "002_cte.sql"), "WITH marker AS (SELECT 1 WHERE true) DELETE FROM users;");
    await assert.rejects(runPendingMigrations(db, sources, quiet), /No migration was executed/);
    assert.equal(await count(client, "users"), 1);
    assert.deepEqual(await ledger(client), []);
    await rm(join(dir, "002_cte.sql"));
    await writeFile(join(dir, "002_bounded.sql"), "DELETE FROM users WHERE id = 1;");
    assert.deepEqual((await runPendingMigrations(db, sources, quiet)).applied, ["drizzle:001_safe.sql", "drizzle:002_bounded.sql"]);
    assert.equal(await count(client, "users"), 0);
  });
});

postgresTest("PostgreSQL itself resolves a unicode-escaped name to the prohibited function (why it must be rejected)", async () => {
  await sandbox(async ({ client }) => {
    const viaEscape = await client.query(String.raw`SELECT U&"query\005fto\005fxml"('select 1 as one', false, false, '') AS x`);
    const direct = await client.query(`SELECT query_to_xml('select 1 as one', false, false, '') AS x`);
    assert.equal(viaEscape.rows[0].x, direct.rows[0].x);
  });
});

postgresTest("unicode-escaped and lexing-boundary bypasses are rejected before execution on a real database", async () => {
  await sandbox(async ({ client }) => {
    await client.query(`CREATE TABLE victim (id int); INSERT INTO victim VALUES (1), (2)`);
    for (const sql of [
      `SELECT U&"query\\005fto\\005fxml"('select 1', false, false, '');`,
      `SELECT U&"query!005fto!005fxml" UESCAPE '!'('select 1', false, false, '');`,
      `DO $$ BEGIN PERFORM U&"query\\005fto\\005fxml"('delete from victim', false, false, ''); END $$;`,
      "DO 'BEGIN '\n'EXECUTE ''delete from victim''; END';",
      "SET standard_conforming_strings = off; SELECT '\\''; DELETE FROM victim; SELECT '\\'';",
    ]) {
      await assert.rejects(applyMigration(client, "t:bypass.sql", sql, quiet), DestructiveMigrationError, sql);
    }
    assert.equal(await count(client, "victim"), 2);
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("a session with non-standard string rules refuses to run migrations (routine and destructive)", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await client.query(`CREATE TABLE victim (id int); INSERT INTO victim VALUES (1)`);
    await writeFile(join(dir, "001_safe.sql"), "CREATE TABLE fine (id int);");
    const sources = [{ dir, keyPrefix: "drizzle", priority: 0 }];
    const sql = "DELETE FROM victim WHERE id = 1;";
    const auth = await authFor(client, sql);
    await client.query(`SET standard_conforming_strings = off`);
    try {
      await assert.rejects(runPendingMigrations(db, sources, quiet), /standard_conforming_strings=off/);
      await assert.rejects(applyAuthorizedDestructiveMigration(client, "scs.sql", sql, auth, opts()), /standard_conforming_strings=off/);
    } finally {
      await client.query(`RESET standard_conforming_strings`);
    }
    assert.equal(await exists(client, "fine"), false);
    assert.equal(await count(client, "victim"), 1);
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("already-recorded ledger entries are unaffected by the stricter scanner", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await client.query(`INSERT INTO _app_migrations (filename, applied_at) VALUES ('drizzle:000_old.sql', '2020-01-01T00:00:00Z')`);
    const before = (await client.query(`SELECT filename, applied_at FROM _app_migrations`)).rows;
    await writeFile(join(dir, "000_old.sql"), `SELECT U&"query\\005fto\\005fxml"('select 1', false, false, '');`);
    await writeFile(join(dir, "001_new.sql"), `CREATE TABLE "Mixed Case" ("Col" int);`);
    const result = await runPendingMigrations(db, [{ dir, keyPrefix: "drizzle", priority: 0 }], quiet);
    assert.deepEqual(result.applied, ["drizzle:001_new.sql"]);
    assert.deepEqual((await client.query(`SELECT filename, applied_at FROM _app_migrations WHERE filename = 'drizzle:000_old.sql'`)).rows, before);
  });
});

postgresTest("set_config with a computed name really changes parsing (why configuration changes are rejected)", async () => {
  await sandbox(async ({ client }) => {
    await client.query(`CREATE TABLE victim (id int); INSERT INTO victim VALUES (1), (2)`);
    // Control, run directly against the disposable sandbox only: the sequence a scanner assuming standard strings
    // would read as "two harmless string literals" deletes rows once the setting is off.
    await client.query(`SELECT set_config('standard_conforming_' || 'strings', 'off', false)`);
    await client.query(String.raw`SELECT '\''; DELETE FROM victim; SELECT '\'';`);
    await client.query(`RESET standard_conforming_strings`);
    assert.equal(await count(client, "victim"), 0);
  });
});

postgresTest("configuration-changing migrations are rejected before execution on a real database", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await client.query(`CREATE TABLE victim (id int); INSERT INTO victim VALUES (1), (2)`);
    const hide = String.raw`SELECT '\''; DELETE FROM victim; SELECT '\'';`;
    for (const sql of [
      `SELECT set_config('standard_conforming_' || 'strings', 'off', false); ${hide}`,
      `SELECT set_config(format('%s_%s_%s', 'standard', 'conforming', 'strings'), 'off', false); ${hide}`,
      `SELECT pg_catalog."set_config"(lower('STANDARD_CONFORMING_') || 'strings', 'off', false); ${hide}`,
      `UPDATE pg_settings SET setting = 'off' WHERE name = 'standard_conforming_' || 'strings'; ${hide}`,
      `SET NAMES 'SJIS';`,
      `DO $$ BEGIN PERFORM set_config('standard_conforming_' || 'strings', 'off', false); END $$;`,
    ]) {
      await assert.rejects(applyMigration(client, "t:config.sql", sql, quiet), DestructiveMigrationError, sql);
    }
    assert.equal(await count(client, "victim"), 2);
    assert.equal((await client.query(`SHOW client_encoding`)).rows[0].client_encoding, "UTF8");
    // Same through the routine command: nothing earlier in the batch runs either.
    await writeFile(join(dir, "001_safe.sql"), "CREATE TABLE fine (id int);");
    await writeFile(join(dir, "002_config.sql"), `SELECT set_config('standard_conforming_' || 'strings', 'off', false); ${hide}`);
    await assert.rejects(runPendingMigrations(db, [{ dir, keyPrefix: "drizzle", priority: 0 }], quiet), /No migration was executed/);
    assert.equal(await exists(client, "fine"), false);
    assert.equal(await count(client, "victim"), 2);
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("defence in depth: a change that evades the static guard (existing routine) is rolled back before COMMIT", async () => {
  await sandbox(async ({ client, db, dir, schema }) => {
    await client.query(`CREATE TABLE victim (id int); INSERT INTO victim VALUES (1)`);
    // A routine that already exists in the database is outside what a static scan can see (documented limit).
    await client.query(`CREATE FUNCTION ${schema}.preexisting() RETURNS text LANGUAGE plpgsql AS $f$
      BEGIN RETURN set_config('standard_conforming_strings', 'off', false); END $f$`);
    await writeFile(join(dir, "001_sneaky.sql"), "CREATE TABLE created_first (id int); SELECT preexisting(); CREATE TABLE created_after (id int);");
    await assert.rejects(runPendingMigrations(db, [{ dir, keyPrefix: "drizzle", priority: 0 }], quiet), /standard_conforming_strings=off/);
    assert.equal(await exists(client, "created_first"), false, "whole file rolled back");
    assert.equal(await exists(client, "created_after"), false);
    assert.deepEqual(await ledger(client), [], "no ledger entry for the rejected file");
    assert.equal((await client.query(`SHOW standard_conforming_strings`)).rows[0].standard_conforming_strings, "on");

    // Same for the authorized destructive path.
    const sql = "DELETE FROM victim WHERE id = 1; SELECT preexisting();";
    await assert.rejects(applyAuthorizedDestructiveMigration(client, "sneaky.sql", sql, await authFor(client, sql), opts()), /standard_conforming_strings=off/);
    assert.equal(await count(client, "victim"), 1, "destructive statements rolled back");
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("harmless migrations with timeouts and ordinary SET clauses still run", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await writeFile(join(dir, "001_ok.sql"), "SET LOCAL lock_timeout = '5s'; CREATE TABLE t (id int, x int); INSERT INTO t VALUES (1, 1); UPDATE t SET x = 2 WHERE id = 1;");
    assert.deepEqual((await runPendingMigrations(db, [{ dir, keyPrefix: "drizzle", priority: 0 }], quiet)).applied, ["drizzle:001_ok.sql"]);
    assert.equal((await client.query(`SELECT x FROM t`)).rows[0].x, 2);
  });
});

postgresTest("PostgreSQL honours the real LANGUAGE clause, not a parameter named language (why the scan must too)", async () => {
  await sandbox(async ({ client }) => {
    const superuser = (await client.query(`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`)).rows[0].rolsuper;
    if (!superuser) return; // the `internal` language is superuser-only; the scanner tests above still cover the shape
    await client.query(`CREATE DOMAIN sql AS text`);
    await client.query(`CREATE FUNCTION sneaky(language sql, b text, c bool) RETURNS text AS 'set_config_by_name' LANGUAGE internal`);
    const row = (await client.query(
      `SELECT l.lanname FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.proname = 'sneaky' AND p.pronamespace = current_schema()::regnamespace`
    )).rows[0];
    assert.equal(row.lanname, "internal");
  });
});

postgresTest("unsupported-language definitions are rejected before execution on a real database", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await client.query(`CREATE TABLE victim (id int); INSERT INTO victim VALUES (1)`);
    for (const sql of [
      `CREATE DOMAIN sql AS text; CREATE FUNCTION sneaky(language sql, b text, c bool) RETURNS text AS 'set_config_by_name' LANGUAGE internal;`,
      `CREATE FUNCTION sneaky2(language text) RETURNS void AS $$ DROP TABLE victim $$ LANGUAGE plperl;`,
      `CREATE FUNCTION sneaky3() RETURNS int AS $$ SELECT 1 $$;`,
      `DO $$ BEGIN CREATE FUNCTION sneaky4() RETURNS text AS 'pg_sleep' LANGUAGE internal; END $$;`,
    ]) {
      await assert.rejects(applyMigration(client, "t:lang.sql", sql, quiet), DestructiveMigrationError, sql);
    }
    const created = (await client.query(
      `SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE 'sneaky%' AND pronamespace = current_schema()::regnamespace`
    )).rows[0].n;
    assert.equal(created, 0);
    assert.equal(await exists(client, "sql"), false);
    // Through the routine command: an earlier safe file in the same run does not execute either.
    await writeFile(join(dir, "001_safe.sql"), "CREATE TABLE fine (id int);");
    await writeFile(join(dir, "002_lang.sql"), `CREATE FUNCTION sneaky(language text) RETURNS void AS $$ x $$ LANGUAGE plpythonu;`);
    await assert.rejects(runPendingMigrations(db, [{ dir, keyPrefix: "drizzle", priority: 0 }], quiet), /No migration was executed/);
    assert.equal(await exists(client, "fine"), false);
    assert.deepEqual(await ledger(client), []);
  });
});

postgresTest("legitimate functions (including a parameter named language) still run and work", async () => {
  await sandbox(async ({ client, db, dir }) => {
    await writeFile(
      join(dir, "001_funcs.sql"),
      `CREATE FUNCTION describe(language text) RETURNS text AS $$ SELECT 'lang=' || language $$ LANGUAGE sql IMMUTABLE;
       CREATE FUNCTION add_one(n int) RETURNS int LANGUAGE plpgsql AS $$ BEGIN RETURN n + 1; END $$;
       CREATE PROCEDURE noop(IN language text) LANGUAGE plpgsql AS $$ BEGIN NULL; END $$;`
    );
    assert.deepEqual((await runPendingMigrations(db, [{ dir, keyPrefix: "drizzle", priority: 0 }], quiet)).applied, ["drizzle:001_funcs.sql"]);
    assert.equal((await client.query(`SELECT describe('sql') AS x, add_one(1) AS y`)).rows[0].x, "lang=sql");
    assert.equal((await client.query(`SELECT add_one(1) AS y`)).rows[0].y, 2);
  });
});
