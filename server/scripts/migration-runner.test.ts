import assert from "node:assert/strict";
import test from "node:test";
import { applyMigration, splitPostgresStatements, type MigrationClient } from "./migration-runner";

type Snapshot = { tables: Set<string>; rows: string[]; ledger: string[] };

class TransactionalFake implements MigrationClient {
  state: Snapshot = { tables: new Set(), rows: [], ledger: [] };
  private before: Snapshot | null = null;
  failCode: string | null = null;
  queries: string[] = [];

  async query(sql: string, params: unknown[] = []) {
    this.queries.push(sql);
    if (sql === "BEGIN") {
      this.before = { tables: new Set(this.state.tables), rows: [...this.state.rows], ledger: [...this.state.ledger] };
    } else if (sql === "COMMIT") {
      this.before = null;
    } else if (sql === "ROLLBACK") {
      assert.ok(this.before);
      this.state = this.before;
      this.before = null;
    } else if (sql === "FAIL") {
      const error = new Error("synthetic database failure") as Error & { code: string };
      error.code = this.failCode ?? "XX999";
      throw error;
    } else if (/^CREATE TABLE IF NOT EXISTS /i.test(sql)) {
      this.state.tables.add(sql.match(/^CREATE TABLE IF NOT EXISTS (\w+)/i)![1]);
    } else if (/^CREATE TABLE /i.test(sql)) {
      const table = sql.match(/^CREATE TABLE (\w+)/i)![1];
      if (this.state.tables.has(table)) {
        const error = new Error(`relation ${table} already exists`) as Error & { code: string };
        error.code = "42P07";
        throw error;
      }
      this.state.tables.add(table);
    } else if (/^INSERT TEST /i.test(sql)) {
      const value = sql.slice("INSERT TEST ".length);
      if (this.state.rows.includes(value)) {
        const error = new Error("duplicate key value violates unique constraint") as Error & { code: string };
        error.code = "23505";
        throw error;
      }
      this.state.rows.push(value);
    } else if (/insert into _app_migrations/i.test(sql)) {
      const key = String(params[0]);
      if (!this.state.ledger.includes(key)) this.state.ledger.push(key);
    }
    return {};
  }
}

const quiet = { error() {} };

test("23505 rolls back earlier statements, skips later statements, and does not write the ledger", async () => {
  const db = new TransactionalFake();
  db.state.rows.push("duplicate");
  db.failCode = "23505";

  await assert.rejects(
    applyMigration(db, "test:unique.sql", "CREATE TABLE first; INSERT TEST duplicate; CREATE TABLE third;", quiet),
    (error: any) => error.code === "23505"
  );
  assert.deepEqual([...db.state.tables], []);
  assert.deepEqual(db.state.ledger, []);
});

test("a failed migration is recoverable and recorded exactly once", async () => {
  const db = new TransactionalFake();
  db.state.rows.push("duplicate");
  await assert.rejects(applyMigration(db, "test:recovery.sql", "INSERT TEST duplicate;", quiet));

  db.state.rows.length = 0;
  await applyMigration(db, "test:recovery.sql", "INSERT TEST duplicate; CREATE TABLE recovered;", quiet);
  assert.deepEqual(db.state.rows, ["duplicate"]);
  assert.ok(db.state.tables.has("recovered"));
  assert.deepEqual(db.state.ledger, ["test:recovery.sql"]);
});

test("explicit duplicate-schema idempotency succeeds without swallowing a SQLSTATE", async () => {
  const db = new TransactionalFake();
  db.state.tables.add("existing");
  await applyMigration(db, "test:idempotent.sql", "CREATE TABLE IF NOT EXISTS existing (id int);", quiet);
  assert.deepEqual(db.state.ledger, ["test:idempotent.sql"]);
});

test("an unrelated database error surfaces and leaves the migration unapplied", async () => {
  const db = new TransactionalFake();
  db.failCode = "42P01";
  await assert.rejects(applyMigration(db, "test:missing.sql", "CREATE TABLE first; FAIL;", quiet));
  assert.deepEqual([...db.state.tables], []);
  assert.deepEqual(db.state.ledger, []);
});

test("splitter preserves strings, comments, identifiers, and dollar-quoted blocks", () => {
  const sql = `
    -- a comment containing ;
    INSERT INTO notes(value) VALUES ('semi;colon');
    /* an outer ; /* nested ; */ comment */
    DO $body$ BEGIN
      PERFORM 'inside;body';
      PERFORM 2;
    END $body$;
    SELECT "semi;identifier";
  `;
  const statements = splitPostgresStatements(sql);
  assert.equal(statements.length, 3);
  assert.match(statements[0], /'semi;colon'/);
  assert.match(statements[1], /PERFORM 2;/);
  assert.match(statements[2], /"semi;identifier"/);
});

test("splitter keeps PostgreSQL escape strings intact", () => {
  const sql = String.raw`SELECT E'one\';two\\three''four'; SELECT e'lower\';case\\'; SELECT 3;`;
  const statements = splitPostgresStatements(sql);
  assert.equal(statements.length, 3);
  assert.equal(statements[0], String.raw`SELECT E'one\';two\\three''four'`);
  assert.equal(statements[1], String.raw`SELECT e'lower\';case\\'`);
  assert.equal(statements[2], "SELECT 3");
});

test("ordinary strings do not acquire escape-string backslash behavior", () => {
  const statements = splitPostgresStatements(String.raw`SELECT 'ordinary\\'; SELECT 2;`);
  assert.deepEqual(statements, [String.raw`SELECT 'ordinary\\'`, "SELECT 2"]);
});

test("CREATE INDEX CONCURRENTLY is rejected before the transaction or ledger write", async () => {
  for (const sql of [
    "CREATE INDEX CONCURRENTLY example_idx ON example(id);",
    "create  unique\n index\tconcurrently example_idx ON example(id);",
  ]) {
    const db = new TransactionalFake();
    await assert.rejects(
      applyMigration(db, "test:concurrent.sql", sql, quiet),
      /incompatible with ChefSire's atomic transactional migration runner/
    );
    assert.deepEqual(db.queries, []);
    assert.deepEqual(db.state.ledger, []);
  }
});

test("transaction compatibility guard ignores protected mentions", async () => {
  const db = new TransactionalFake();
  await applyMigration(
    db,
    "test:protected.sql",
    `
      -- CREATE INDEX CONCURRENTLY comment_idx ON example(id);
      SELECT 'CREATE INDEX CONCURRENTLY string_idx ON example(id)';
      DO $body$ BEGIN
        PERFORM 'CREATE INDEX CONCURRENTLY body_idx ON example(id)';
      END $body$;
      /* nested /* CREATE INDEX CONCURRENTLY nested_idx ON example(id) */ comment */
    `,
    quiet
  );
  assert.equal(db.queries[0], "BEGIN");
  assert.match(db.queries.at(-2)!, /insert into _app_migrations/i);
  assert.equal(db.queries.at(-1), "COMMIT");
  assert.deepEqual(db.state.ledger, ["test:protected.sql"]);
});
