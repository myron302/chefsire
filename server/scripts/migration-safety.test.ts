import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyMigration, type MigrationClient } from "./migration-runner";
import { tokenize } from "./sql-tokens";
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

test("destructive statements written directly inside DO/function bodies are found", () => {
  assert.ok(ops("DO $$ BEGIN DROP TABLE users; END $$;").includes("DROP TABLE"));
  assert.ok(ops("DO 'BEGIN DROP TABLE users; END';").includes("DROP TABLE"));
  assert.ok(ops("CREATE FUNCTION f() RETURNS void AS $$ BEGIN TRUNCATE users; END $$ LANGUAGE plpgsql;").includes("TRUNCATE"));
  assert.ok(ops("DO $a$ BEGIN ALTER TABLE t DROP COLUMN c; END $a$;").includes("DROP COLUMN"));
  assert.ok(ops("DO $a$ BEGIN DELETE FROM t; END $a$;").includes("DELETE without WHERE"));
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

// ---- Finding 1: dynamic SQL / procedural execution is rejected, never evaluated -----------------------------------
const DYNAMIC_BYPASSES: Record<string, string> = {
  "single-quoted DO body": "DO 'BEGIN EXECUTE ''DROP TABLE users''; END';",
  "concatenated fragments": "DO $$ BEGIN EXECUTE 'DR' || 'OP TABLE users'; END $$;",
  "format() assembled": "DO $$ BEGIN EXECUTE format('DROP %s users', 'TABLE'); END $$;",
  "variable assembled": "DO $$ DECLARE s text := 'DROP TABLE users'; BEGIN EXECUTE s; END $$;",
  "EXECUTE in nested dollar tags": "DO $outer$ BEGIN EXECUTE $inner$DROP TABLE users$inner$; END $outer$;",
  "DO LANGUAGE before body": "DO LANGUAGE plpgsql $x$ BEGIN EXECUTE 'TRUNCATE users'; END $x$;",
  "DO body after LANGUAGE": "DO $x$ BEGIN EXECUTE 'TRUNCATE users'; END $x$ LANGUAGE plpgsql;",
  "E'' DO body (not decoded)": "DO E'BEGIN PERFORM 1; END';",
  "U&'' DO body (not decoded)": "DO U&'BEGIN PERFORM 1; END';",
  "other procedural language": "DO LANGUAGE plpython3u $$ plpy.execute('drop table users') $$;",
  "function in C": "CREATE FUNCTION f() RETURNS void AS 'lib', 'sym' LANGUAGE c;",
  "function in plpython": "CREATE FUNCTION f() RETURNS void AS $$ plpy.execute('x') $$ LANGUAGE plpython3u;",
  "function with EXECUTE": "CREATE FUNCTION f() RETURNS void AS $$ BEGIN EXECUTE 'DROP TABLE users'; END $$ LANGUAGE plpgsql;",
  "query_to_xml": "SELECT query_to_xml('drop table users', false, false, '');",
  "schema-qualified query_to_xml": "SELECT pg_catalog.query_to_xml('delete from users', false, false, '');",
  "quoted query_to_xml": 'SELECT "query_to_xml"(\'x\', false, false, \'\');',
  "dblink_exec": "SELECT dblink_exec('dbname=x', 'drop table users');",
  "CALL": "CALL dangerous_procedure();",
  "CALL inside DO": "DO $$ BEGIN CALL dangerous_procedure(); END $$;",
  "prepared EXECUTE": "PREPARE p AS SELECT 1; EXECUTE p;",
  "COPY PROGRAM": "COPY users TO PROGRAM 'rm -rf /';",
  "unknown statement kind": "REASSIGN OWNED BY a TO b;",
  "DO inside function-shaped nesting": "DO $a$ BEGIN EXECUTE $b$ DO $c$ BEGIN EXECUTE 'x'; END $c$ $b$; END $a$;",
};
for (const [name, sql] of Object.entries(DYNAMIC_BYPASSES)) {
  test(`dynamic/procedural bypass rejected: ${name}`, () => {
    assert.ok(findDestructiveOperations(sql).length > 0, sql);
  });
}

test("a splitter/lexer disagreement about statement boundaries is rejected", () => {
  // The executor's splitter treats `$b$` inside the identifier as a dollar-quote opener and sends ONE chunk;
  // PostgreSQL would run all three statements in it.
  const sql = "SELECT 1 AS a$b$; DROP TABLE users; SELECT 2 AS a$b$;";
  const found = ops(sql);
  assert.ok(found.some((o) => o.startsWith("PARSER DISAGREEMENT")), String(found));
  assert.ok(found.includes("DROP TABLE"));
});

test("ordinary procedural migrations (triggers, DO guards, plpgsql functions) are still supported", () => {
  assert.deepEqual(
    findDestructiveOperations(`
      CREATE OR REPLACE FUNCTION guard() RETURNS trigger AS $$
      BEGIN
        IF OLD.id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'id is immutable; DELETE FROM x is not allowed'; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_trigger') THEN
          CREATE TRIGGER guard_trigger BEFORE UPDATE ON t FOR EACH ROW EXECUTE FUNCTION guard();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'c1') THEN
          ALTER TABLE t ADD CONSTRAINT c1 CHECK (id > 0) NOT VALID;
        END IF;
        DELETE FROM t WHERE id < 0;
      END $$;
      ALTER TABLE child DROP CONSTRAINT IF EXISTS fk, ADD CONSTRAINT fk FOREIGN KEY (p) REFERENCES t(id) ON DELETE CASCADE;
      CREATE TABLE c2 (p int REFERENCES t(id) ON DELETE SET NULL ON UPDATE CASCADE);
      CREATE TRIGGER after_del AFTER INSERT OR DELETE ON t FOR EACH ROW EXECUTE PROCEDURE guard();
      CREATE POLICY p ON t FOR DELETE USING (true);
      GRANT SELECT, INSERT, DELETE ON t TO app;
    `),
    []
  );
});

// ---- Finding 2: DELETE validation is specific to the DELETE command ----------------------------------------------
const UNBOUNDED_DELETES: Record<string, string> = {
  "unrelated WHERE inside a CTE": "WITH marker AS (SELECT 1 WHERE true) DELETE FROM users;",
  "multiline with comments": "WITH marker AS (\n  SELECT 1 -- WHERE true\n  WHERE true /* WHERE */\n)\nDELETE /* c */ FROM\n  users;",
  "WHERE only inside USING subquery": "DELETE FROM users USING (SELECT 1 WHERE true) s;",
  "WHERE only inside RETURNING subquery": "DELETE FROM users RETURNING (SELECT 1 WHERE true);",
  "second DELETE in CTE chain unbounded": "WITH d AS (DELETE FROM a WHERE id = 1 RETURNING *) DELETE FROM b;",
  "bounded CTE delete + unbounded outer": "WITH d AS (DELETE FROM a WHERE id = 1 RETURNING *) DELETE FROM d_log;",
  "trivial WHERE true": "DELETE FROM users WHERE true;",
  "trivial WHERE (true)": "DELETE FROM users WHERE (TRUE);",
  "trivial WHERE 1=1": "DELETE FROM users WHERE 1 = 1;",
  "MERGE … THEN DELETE": "MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN DELETE;",
  "unknown DELETE shape": "SELECT delete;",
  "DELETE ONLY without WHERE": "DELETE FROM ONLY users;",
};
for (const [name, sql] of Object.entries(UNBOUNDED_DELETES)) {
  test(`unbounded/ambiguous DELETE rejected: ${name}`, () => {
    assert.ok(ops(sql).length > 0, sql);
    if (!/MERGE/.test(sql)) assert.ok(ops(sql).some((o) => /DELETE/.test(o)), `${sql} -> ${ops(sql)}`);
  });
}

test("DELETE in a later statement of a multi-statement file is located precisely", () => {
  const found = findDestructiveOperations("DELETE FROM a WHERE id = 1;\nUPDATE b SET x = 1;\nDELETE FROM c;");
  assert.deepEqual(found.map((f) => [f.operation, f.statement]), [["DELETE without WHERE", 3]]);
});

test("bounded DELETE statements remain supported", () => {
  for (const sql of [
    "DELETE FROM users WHERE id = 1;",
    "DELETE FROM ONLY users AS u WHERE u.id = 1 RETURNING u.id;",
    "DELETE FROM users WHERE id IN (SELECT id FROM banned WHERE reason IS NOT NULL);",
    "DELETE FROM users WHERE id IN (SELECT id FROM banned WHERE true);", // inner WHERE is irrelevant; outer is bounded
    "WITH s AS (SELECT id FROM old WHERE ok) DELETE FROM users USING s WHERE users.id = s.id;",
    "WITH d AS (DELETE FROM users WHERE id = 1 RETURNING *) INSERT INTO log SELECT * FROM d;",
    "DELETE FROM users WHERE CURRENT OF c;",
    "-- DELETE FROM users;\nSELECT 'DELETE FROM users';",
  ]) {
    assert.deepEqual(ops(sql), [], sql);
  }
});

test("the reviewed historical exception covers exactly the two operations it was reviewed for", () => {
  const sql = readFileSync(join(serverDir, "migrations", "20260928_square_oauth_hardening.sql"), "utf-8");
  assert.deepEqual(ops(sql).sort(), ["DELETE without WHERE", "DROP COLUMN"]);
  assert.equal(sha256(sql), REVIEWED_HISTORICAL_DESTRUCTIVE["server:20260928_square_oauth_hardening.sql"].sha256);
});

// ---- Unicode-escaped identifiers and other lexing-boundary bypasses (Codex d4b6a8c) -------------------------------
const CALL = "('select 1', false, false, '')";
const UNICODE_IDENTIFIERS: Record<string, string> = {
  "backslash escape": `SELECT U&"query\\005fto\\005fxml"${CALL};`,
  "long (+) escape": `SELECT U&"query\\+00005fto\\+00005fxml"${CALL};`,
  "UESCAPE '!'": `SELECT U&"query!005fto!005fxml" UESCAPE '!'${CALL};`,
  "UESCAPE '#'": `SELECT U&"query#005fto#005fxml" UESCAPE '#'${CALL};`,
  "UESCAPE '^'": `SELECT U&"query^005fto^005fxml" UESCAPE '^'${CALL};`,
  "mixed escaped and literal characters": `SELECT U&"query_to\\005fxml"${CALL};`,
  "escaped first letter": `SELECT U&"\\0071uery_to_xml"${CALL};`,
  "lowercase u prefix": `SELECT u&"query\\005fto\\005fxml"${CALL};`,
  "no escape actually used": `SELECT U&"query_to_xml"${CALL};`,
  "unrelated name (still not analysable)": `SELECT U&"harmless"${CALL};`,
  "schema-qualified": `SELECT pg_catalog.U&"query\\005fto\\005fxml"${CALL};`,
  "multiline with comments": `SELECT -- c\n  /* U&"x" */ U&"query\\005f\\\n  to_xml"\n${CALL};`.replace("\\\n  to_xml", "to_xml"),
  "inside a DO body": `DO $$ BEGIN PERFORM U&"query\\005fto\\005fxml"${CALL}; END $$;`,
  "inside a function body": `CREATE FUNCTION f() RETURNS void AS $$ BEGIN PERFORM U&"dblink\\005fexec"('a','b'); END $$ LANGUAGE plpgsql;`,
  "as a table name too": `CREATE TABLE U&"t\\0061ble" (id int);`,
  "malformed escape (too short)": `SELECT U&"query\\00"${CALL};`,
  "malformed escape (non-hex)": `SELECT U&"query\\zzzz"${CALL};`,
  "malformed UESCAPE operand": `SELECT U&"x" UESCAPE 'ab'${CALL};`,
  "illegal UESCAPE operand (hex digit)": `SELECT U&"x" UESCAPE 'a'${CALL};`,
  "unterminated": `SELECT U&"query\\005fto\\005fxml${CALL};`,
};
for (const [name, sql] of Object.entries(UNICODE_IDENTIFIERS)) {
  test(`unicode-escaped identifier rejected: ${name}`, () => {
    assert.ok(findDestructiveOperations(sql).length > 0, sql);
  });
}

test("unicode-escaped identifiers are not treated as ordinary quoted identifiers", () => {
  const [escaped] = tokenize('U&"d\\0061ta"');
  assert.equal(escaped.kind, "qident");
  assert.equal(escaped.flavor, "unicode");
  const [plain] = tokenize('"data"');
  assert.equal(plain.flavor, "plain");
  assert.ok(ops('SELECT U&"d\\0061ta" FROM t;').includes("UNICODE-ESCAPED IDENTIFIER"));
  assert.ok(ops("SELECT U&\"x\" UESCAPE '!';").includes("UNICODE ESCAPE (UESCAPE)"));
});

test("prohibited function names are rejected in every plain spelling", () => {
  for (const name of ["query_to_xml", "QUERY_TO_XML", "Query_To_Xml", '"query_to_xml"', 'pg_catalog."query_to_xml"', "dblink_exec"]) {
    const found = ops(`SELECT ${name}('select 1', false, false, '');`);
    assert.ok(found.some((o) => o.startsWith("DYNAMIC SQL FUNCTION")), name);
  }
  assert.ok(ops(`DO $$ BEGIN PERFORM query_to_xml('select 1', false, false, ''); END $$;`).some((o) => o.startsWith("DYNAMIC SQL FUNCTION")));
});

test("legitimate standard quoted identifiers and unicode text data still pass", () => {
  assert.deepEqual(
    findDestructiveOperations(`
      CREATE TABLE "Order Items" ("Item ID" serial PRIMARY KEY, "query_to_xml_log" text, "Query_To_Xml" text);
      CREATE INDEX "idx ""quoted""" ON "Order Items" ("Item ID");
      INSERT INTO "Order Items" ("query_to_xml_log") VALUES ('naïve café ☕'), (U&'\\0041bc');
      SELECT "Item ID" FROM "Order Items" WHERE "Query_To_Xml" IS NULL; -- "dblink" in a comment
      COMMENT ON TABLE "Order Items" IS 'we never call query_to_xml or U&"x"';
    `),
    []
  );
});

const LEXING_BYPASSES: Record<string, string> = {
  "adjacent DO literals": "DO 'BEGIN '\n'EXECUTE ''delete from victim''; END';",
  "adjacent DO literals (benign halves)": "DO 'BEGIN '\n'PERFORM 1; END';",
  "language operand as string hides body": "DO LANGUAGE 'plpgsql' $$ BEGIN EXECUTE 'x'; END $$;",
  "adjacent function-body literals": "CREATE FUNCTION f() RETURNS void AS 'a'\n'b' LANGUAGE sql;",
  "function body + link symbol": "CREATE FUNCTION f() RETURNS void AS 'a', 'b' LANGUAGE plpgsql;",
  "standard_conforming_strings off": "SET standard_conforming_strings = off; SELECT '\\''; DELETE FROM victim; SELECT '\\'';",
  "SET LOCAL scs": "SET LOCAL standard_conforming_strings TO off;",
  "set_config scs": "SELECT set_config('standard_conforming_strings', 'off', false);",
  "quoted scs name": 'ALTER DATABASE x SET "standard_conforming_strings" = off;',
  "client_encoding": "SET client_encoding = 'SJIS';",
  "non-breaking space is not whitespace in PostgreSQL": "DROP TABLE users;",
  "meta command": "\\i /etc/passwd",
};
for (const [name, sql] of Object.entries(LEXING_BYPASSES)) {
  test(`lexing-boundary bypass rejected: ${name}`, () => {
    assert.ok(findDestructiveOperations(sql).length > 0, sql);
  });
}

test("a DO block whose language is written as a string literal is still analysed and accepted when safe", () => {
  assert.deepEqual(findDestructiveOperations("DO LANGUAGE 'plpgsql' $$ BEGIN PERFORM 1; END $$;"), []);
  assert.deepEqual(findDestructiveOperations("DO $$ BEGIN PERFORM 1; END $$ LANGUAGE plpgsql;"), []);
});

test("PostgreSQL whitespace is exactly space, tab, CR, LF, FF, VT", () => {
  assert.deepEqual(tokenize("a b").map((t) => t.text), ["A B"]);
  assert.deepEqual(tokenize("a\u000bb\fc").map((t) => t.text), ["A", "B", "C"]);
});
