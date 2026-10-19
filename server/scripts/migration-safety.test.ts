import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyMigration, type MigrationClient } from "./migration-runner";
import {
  assertNonDestructive,
  DestructiveMigrationError,
  findDestructiveOperations,
  REVIEWED_HISTORICAL_DESTRUCTIVE,
  sha256,
} from "./migration-safety";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "..");
const ops = (sql: string) => [...new Set(findDestructiveOperations(sql).map((f) => f.operation))];

test("flags each destructive operation", () => {
  assert.deepEqual(ops("DROP TABLE users;"), ["DROP TABLE"]);
  assert.deepEqual(ops("drop table if exists users;"), ["DROP TABLE"]);
  assert.deepEqual(ops("DROP SCHEMA app;"), ["DROP SCHEMA"]);
  assert.deepEqual(ops("TRUNCATE users;"), ["TRUNCATE"]);
  assert.deepEqual(ops("ALTER TABLE users DROP COLUMN email;"), ["DROP COLUMN"]);
  assert.deepEqual(ops("ALTER TABLE users DROP COLUMN IF EXISTS email;"), ["DROP COLUMN"]);
  assert.deepEqual(ops("ALTER TABLE users DROP email;"), ["DROP COLUMN"]); // COLUMN keyword is optional
  assert.deepEqual(ops('ALTER TABLE users DROP "Email";'), ["DROP COLUMN"]);
  assert.deepEqual(ops("DELETE FROM users;"), ["DELETE without WHERE"]);
  assert.deepEqual(ops("DROP TYPE kind CASCADE;"), ["DROP ... CASCADE"]);
});

test("comments, whitespace and case cannot hide a destructive statement", () => {
  for (const sql of [
    "DROP /* hidden */ TABLE users;",
    "DROP\n-- comment\nTABLE users;",
    "dRoP\t\n  tAbLe users;",
    "/* a /* nested */ b */ TRUNCATE users;",
    "ALTER TABLE users\n  ADD COLUMN x int,\n  DROP /* c */ COLUMN y;",
    "SELECT 1; -- harmless\nDROP TABLE users",
  ]) {
    assert.ok(findDestructiveOperations(sql).length > 0, sql);
  }
});

test("destructive statements inside DO/function bodies and EXECUTE strings are found", () => {
  assert.ok(ops("DO $$ BEGIN DROP TABLE users; END $$;").includes("DROP TABLE"));
  assert.ok(ops("DO $x$ BEGIN EXECUTE 'DROP TABLE users'; END $x$;").includes("DROP TABLE"));
  assert.ok(ops("CREATE FUNCTION f() RETURNS void AS $$ TRUNCATE users $$ LANGUAGE sql;").includes("TRUNCATE"));
  assert.ok(ops("DO $a$ BEGIN EXECUTE $b$ALTER TABLE t DROP COLUMN c$b$; END $a$;").includes("DROP COLUMN"));
});

test("mentions in comments and string literals are not destructive", () => {
  assert.deepEqual(
    findDestructiveOperations(`
      -- DROP TABLE users;
      /* TRUNCATE users; */
      INSERT INTO notes(value) VALUES ('DROP TABLE users; TRUNCATE x');
      INSERT INTO notes(value) VALUES (E'it''s a DROP COLUMN');
      SELECT "drop table";
    `),
    []
  );
});

test("a destructive statement in any position of a multi-statement file is found and located", () => {
  const found = findDestructiveOperations("CREATE TABLE a (id int); CREATE TABLE b (id int); DROP TABLE c; SELECT 1;");
  assert.deepEqual(found.map((f) => [f.operation, f.statement]), [["DROP TABLE", 3]]);
});

test("ordinary non-destructive migrations are not blocked", () => {
  assert.deepEqual(
    findDestructiveOperations(`
      CREATE TABLE IF NOT EXISTS t (id serial PRIMARY KEY, name text);
      ALTER TABLE t ADD COLUMN IF NOT EXISTS extra text;
      ALTER TABLE t ALTER COLUMN extra SET DEFAULT 'x';
      ALTER TABLE t ALTER COLUMN extra DROP NOT NULL;
      ALTER TABLE t ALTER COLUMN extra DROP DEFAULT;
      ALTER TABLE t DROP CONSTRAINT IF EXISTS t_chk;
      DROP INDEX IF EXISTS t_idx;
      CREATE INDEX IF NOT EXISTS t_idx ON t (name);
      UPDATE t SET extra = 'y' WHERE extra IS NULL;
      DELETE FROM t WHERE id IN (SELECT id FROM t WHERE name IS NULL);
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM t) THEN INSERT INTO t(name) VALUES ('seed'); END IF; END $$;
    `),
    []
  );
});

test("unparseable SQL is rejected, not waved through", () => {
  for (const sql of ["SELECT 1 /* never closed", "SELECT 'never closed", 'SELECT "never closed', "DO $$ never closed"]) {
    assert.ok(findDestructiveOperations(sql).some((f) => f.operation.startsWith("UNPARSEABLE")), sql);
  }
});

test("applyMigration rejects destructive SQL before BEGIN: nothing is sent to the database", async () => {
  const queries: string[] = [];
  const db: MigrationClient = { query: async (sql) => void queries.push(sql) };
  await assert.rejects(
    applyMigration(db, "test:bad.sql", "CREATE TABLE ok (id int); DROP TABLE users;", { error() {} }),
    DestructiveMigrationError
  );
  assert.deepEqual(queries, []);
});

test("the reviewed-historical list is pinned to exact content and is not a general bypass", () => {
  for (const [key, entry] of Object.entries(REVIEWED_HISTORICAL_DESTRUCTIVE)) {
    const [prefix, filename] = key.split(":");
    const dir = prefix === "drizzle" ? "drizzle" : "migrations";
    const sql = readFileSync(join(serverDir, dir, filename), "utf-8");
    assert.equal(sha256(sql), entry.sha256, `${key} changed since review`);
    assert.doesNotThrow(() => assertNonDestructive(key, sql));
    assert.throws(() => assertNonDestructive(key, sql + "\nDROP TABLE users;"), DestructiveMigrationError);
    assert.throws(() => assertNonDestructive("other:" + filename, sql + "\n"), DestructiveMigrationError);
  }
  assert.equal(Object.keys(REVIEWED_HISTORICAL_DESTRUCTIVE).length, 1);
});

test("every SQL file in a directory scanned by the runner is safe or explicitly reviewed", () => {
  const dirs = [
    ["drizzle", join(serverDir, "drizzle")],
    ["server", join(serverDir, "migrations")],
    ["legacy", join(serverDir, "..", "migrations")],
  ] as const;
  for (const [prefix, dir] of dirs) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(join(dir, file), "utf-8");
      assert.doesNotThrow(() => assertNonDestructive(`${prefix}:${file}`, sql), `${prefix}:${file}`);
    }
  }
});

test("quarantined cleanup_phase2.sql is byte-identical, still flagged, and outside every scanned directory", () => {
  const sql = readFileSync(join(serverDir, "migration-quarantine", "cleanup_phase2.sql"), "utf-8");
  assert.equal(sha256(sql), "020f1db7a1f1275740b08352469d63d18e8a542426b6b9d3c1ed3d26ce929954");
  assert.ok(ops(sql).includes("DROP TABLE"));
  for (const dir of [join(serverDir, "drizzle"), join(serverDir, "migrations"), join(serverDir, "..", "migrations")]) {
    assert.ok(!readdirSync(dir).includes("cleanup_phase2.sql"), dir);
  }
});

test("the normal migration command never references the quarantine directory and fails the process on error", () => {
  const runner = readFileSync(join(here, "run-migrations.ts"), "utf-8");
  const code = runner.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(code, /quarantine/);
  assert.match(code, /process\.exitCode = 1/);
  const pkg = JSON.parse(readFileSync(join(serverDir, "..", "package.json"), "utf-8"));
  for (const [name, command] of Object.entries<string>(pkg.scripts)) {
    assert.doesNotMatch(command, /run-destructive-migration/, `npm script ${name} must not run destructive migrations`);
  }
});
