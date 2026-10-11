/**
 * Atomic application of a reviewed plan, including PostgreSQL enum additions, on a REAL disposable database that this test creates and
 * drops. Skipped (not passed) when no local PostgreSQL that can CREATE DATABASE is reachable.
 */
import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { SchemaPushApplyError, applyReviewedPlan, catalogFingerprint, type QueryClient } from "./schema-push-apply";

const candidates = [
  process.env.TEST_DATABASE_URL,
  process.env.PGURL,
  `postgres://${process.env.USER || "root"}@localhost/postgres?host=/var/run/postgresql`,
  "postgres://postgres:postgres@localhost:5432/postgres",
  "postgres://postgres@127.0.0.1:5433/postgres",
].filter((value): value is string => Boolean(value));

async function reachableAdminUrl(): Promise<string | null> {
  for (const connectionString of candidates) {
    const client = new pg.Client({ connectionString });
    try {
      await client.connect();
      const { rows } = await client.query("SELECT rolcreatedb OR rolsuper AS ok FROM pg_roles WHERE rolname = current_user");
      await client.end();
      if (rows[0]?.ok && ["localhost", "127.0.0.1", "::1", ""].includes(new URL(connectionString).hostname)) return connectionString;
    } catch { /* next */ }
  }
  return null;
}

const adminUrl = await reachableAdminUrl();
if (!adminUrl) console.log("# no reachable local PostgreSQL that can CREATE DATABASE -- schema-push apply test skipped");
const postgresTest = adminUrl ? test : test.skip;

async function withDatabase(fn: (db: pg.Client) => Promise<void>) {
  const name = `chefsire_applytest_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client({ connectionString: adminUrl! });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(adminUrl!);
  url.pathname = `/${name}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query(`CREATE TYPE status AS ENUM ('a', 'b'); CREATE TABLE t (id int PRIMARY KEY, s status NOT NULL DEFAULT 'a'); INSERT INTO t VALUES (1, 'a')`);
    await fn(db);
  } finally {
    await db.end().catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch(() => undefined);
    await admin.end();
  }
}

const labels = async (db: pg.Client) => (await db.query("SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'status' ORDER BY enumsortorder")).rows.map((row) => row.enumlabel);
const hasColumn = async (db: pg.Client, column: string) => (await db.query("SELECT 1 FROM information_schema.columns WHERE table_name = 't' AND column_name = $1", [column])).rowCount === 1;
const applyError = async (promise: Promise<unknown>) => { try { await promise; } catch (error) { assert.ok(error instanceof SchemaPushApplyError, String(error)); return error; } assert.fail("expected the application to fail"); };

postgresTest("root cause: PostgreSQL refuses to use an enum value in the transaction that added it", async () => {
  await withDatabase(async (db) => {
    await db.query("BEGIN");
    await db.query("ALTER TYPE status ADD VALUE 'c'");
    await assert.rejects(db.query("ALTER TABLE t ALTER COLUMN s SET DEFAULT 'c'"), (error: { code?: string }) => error.code === "55P04");
    await db.query("ROLLBACK");
    assert.deepEqual(await labels(db), ["a", "b"]);
  });
});

postgresTest("ordinary plans without enums apply atomically", async () => {
  await withDatabase(async (db) => {
    await applyReviewedPlan(db, ['ALTER TABLE "t" ADD COLUMN "x" integer;', 'CREATE INDEX "t_x" ON "t" ("x");'], await catalogFingerprint(db));
    assert.equal(await hasColumn(db, "x"), true);
  });
});

postgresTest("an enum addition that nothing in the plan uses applies in the same transaction", async () => {
  await withDatabase(async (db) => {
    await applyReviewedPlan(db, ["ALTER TYPE \"public\".\"status\" ADD VALUE 'c';", 'ALTER TABLE "t" ADD COLUMN "x" integer;'], await catalogFingerprint(db));
    assert.deepEqual(await labels(db), ["a", "b", "c"]);
    assert.equal(await hasColumn(db, "x"), true);
    // the value is usable by the NEXT plan, as the guidance says
    await applyReviewedPlan(db, ['ALTER TABLE "t" ALTER COLUMN "s" SET DEFAULT \'c\';'], await catalogFingerprint(db));
  });
});

postgresTest("an enum addition followed by a dependent default or any use of the value is refused before anything runs", async () => {
  for (const dependent of [
    'ALTER TABLE "t" ALTER COLUMN "s" SET DEFAULT \'c\';',
    'ALTER TABLE "t" ADD COLUMN "s2" "status" DEFAULT \'c\';',
    'ALTER TABLE "t" ADD CONSTRAINT "t_chk" CHECK ("s" <> \'c\');',
    'ALTER TABLE "t" ADD COLUMN "z" "public"."status";',
  ]) {
    await withDatabase(async (db) => {
      const before = await catalogFingerprint(db);
      const error = await applyError(applyReviewedPlan(db, ['ALTER TABLE "t" ADD COLUMN "early" integer;', "ALTER TYPE \"status\" ADD VALUE 'c';", dependent], before));
      assert.equal(error.outcome, "nothing_applied");
      assert.match(error.message, /adds an enum value and then uses/);
      assert.match(error.message, /Apply the addition on its own first/, "actionable guidance");
      assert.deepEqual(await labels(db), ["a", "b"]);
      assert.equal(await hasColumn(db, "early"), false, "not even the unrelated earlier statement ran");
      assert.equal(await catalogFingerprint(db), before);
    });
  }
});

postgresTest("a failed plan containing an enum addition is rolled back whole, and is reported as exactly that", async () => {
  await withDatabase(async (db) => {
    const before = await catalogFingerprint(db);
    const error = await applyError(applyReviewedPlan(db, [
      "ALTER TYPE \"status\" ADD VALUE 'c';", 'ALTER TABLE "t" ADD COLUMN "x" integer;', 'ALTER TABLE "t" ADD COLUMN "x" integer;', // duplicate column fails
    ], before));
    assert.equal(error.outcome, "rolled_back");
    assert.deepEqual(await labels(db), ["a", "b"], "the enum addition was rolled back with everything else");
    assert.equal(await hasColumn(db, "x"), false);
    assert.equal(await catalogFingerprint(db), before);
    // the connection is usable again: the failed transaction left nothing open
    assert.equal((await db.query("SELECT 1 AS ok")).rows[0].ok, 1);
  });
});

postgresTest("schema drift between planning and applying aborts with nothing changed", async () => {
  await withDatabase(async (db) => {
    const planned = await catalogFingerprint(db);
    await db.query("ALTER TABLE t ADD COLUMN sneaked integer");
    const error = await applyError(applyReviewedPlan(db, ['ALTER TABLE "t" ADD COLUMN "x" integer;'], planned));
    assert.equal(error.outcome, "rolled_back");
    assert.match(error.message, /changed between planning and applying/);
    assert.equal(await hasColumn(db, "x"), false);
  });
});

/** Wraps a real client so chosen statements fail the way a dropped connection or a server rejection would. */
function flaky(db: pg.Client, fail: (text: string) => Error | null): QueryClient {
  return { query: async (text: string, values?: unknown[]) => { const error = fail(text); if (error) throw error; return db.query(text, values); } };
}

postgresTest("a lost connection at COMMIT or ROLLBACK is reported as UNKNOWN, never as a rollback", async () => {
  await withDatabase(async (db) => {
    const planned = await catalogFingerprint(db);
    const plan = ['ALTER TABLE "t" ADD COLUMN "x" integer;'];
    // COMMIT dies with no server answer: it may have committed
    let lost = await applyError(applyReviewedPlan(flaky(db, (text) => (text === "COMMIT" ? new Error("Connection terminated unexpectedly") : null)), plan, planned));
    assert.equal(lost.outcome, "state_unknown");
    await db.query("ROLLBACK").catch(() => undefined);
    assert.equal(await hasColumn(db, "x"), false);
    // a statement fails AND the rollback cannot be sent
    const stuck = await applyError(applyReviewedPlan(flaky(db, (text) => (text.startsWith("ALTER TABLE") ? new Error("boom") : text === "ROLLBACK" ? new Error("socket closed") : null)), plan, planned));
    assert.equal(stuck.outcome, "state_unknown");
    await db.query("ROLLBACK").catch(() => undefined);
    // COMMIT rejected BY THE SERVER (it carries a SQLSTATE) did not commit: that one is a confirmed rollback
    const rejected = Object.assign(new Error("deferred constraint violated"), { code: "23514" });
    lost = await applyError(applyReviewedPlan(flaky(db, (text) => (text === "COMMIT" ? rejected : null)), plan, planned));
    assert.equal(lost.outcome, "rolled_back");
  });
});
