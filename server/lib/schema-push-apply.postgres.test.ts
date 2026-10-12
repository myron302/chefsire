/**
 * Atomic application of a reviewed plan, including PostgreSQL enum additions, on a REAL disposable database that this test creates and
 * drops. Skipped (not passed) when no local PostgreSQL that can CREATE DATABASE is reachable.
 */
import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { SchemaPushApplyError, applyReviewedPlan, catalogFingerprint, excludeProtectedSequences, readServerIdentity, sequenceProtection, type QueryClient } from "./schema-push-apply";
import { ServerIdentityError, canonicalConstraint, classifyPushPlan, connectionTarget, parseIndexStatement, planAcknowledgementToken, type PlanCatalogFacts } from "./schema-push-plan";

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

/* ------------------------------------------------ server identity ------------------------------------------------ */

postgresTest("the server identity is read from the cluster, is stable across calls, and contains no secret", async () => {
  await withDatabase(async (db) => {
    const target = connectionTarget("postgres://user:hunter2-secret@localhost:5433/whatever?sslmode=disable");
    const first = await readServerIdentity(db, target);
    const second = await readServerIdentity(db, target);
    assert.equal(first.id, second.id, "stable between review and apply");
    assert.equal(first.strong, true, "a superuser can read the cluster system identifier");
    const parsed = JSON.parse(first.id);
    const { rows } = await db.query("SELECT system_identifier::text AS id FROM pg_control_system()");
    assert.equal(parsed.system, rows[0].id);
    assert.doesNotMatch(first.id, /hunter2|secret|user:|sslmode/);
    // a different connection target (e.g. the same database name on another endpoint) is a different identity, and a different token
    const other = await readServerIdentity(db, "other-host.example.com:5432");
    assert.notEqual(other.id, first.id);
    const plan = ['ALTER TABLE "t" DISABLE ROW LEVEL SECURITY;'];
    assert.notEqual(planAcknowledgementToken(plan, first.id, undefined, "c"), planAcknowledgementToken(plan, other.id, undefined, "c"));
  });
});

postgresTest("when the cluster identifier is not readable (managed services) the identity is WEAK: no error, and never equal to a strong one", async () => {
  await withDatabase(async (db) => {
    // Revoking EXECUTE on a pg_catalog function would change the whole cluster, so the privilege answer is simulated instead.
    const denied: QueryClient = { query: async (text: string, values?: unknown[]) => (text.includes("has_function_privilege") ? { rows: [{ ok: false }] } : db.query(text, values)) };
    const weak = await readServerIdentity(denied, "t:5432");
    const strong = await readServerIdentity(db, "t:5432");
    assert.equal(weak.strong, false);
    assert.equal(strong.strong, true);
    assert.notEqual(weak.id, strong.id);
    assert.equal(JSON.parse(weak.id).system, null);
    // an unreadable privilege answer is treated as "not readable", not as permission
    const unclear: QueryClient = { query: async (text: string, values?: unknown[]) => (text.includes("has_function_privilege") ? { rows: [] } : db.query(text, values)) };
    assert.equal((await readServerIdentity(unclear, "t:5432")).strong, false);
  });
});

postgresTest("ambiguous identity answers fail closed", async () => {
  await withDatabase(async (db) => {
    const lying = (rows: Record<string, unknown>[], match: string): QueryClient => ({
      query: async (text: string, values?: unknown[]) => (text.includes(match) ? { rows } : db.query(text, values)),
    });
    await assert.rejects(readServerIdentity(lying([], "FROM pg_database d"), "t:1"), ServerIdentityError, "no database row");
    await assert.rejects(readServerIdentity(lying([{ oid: "1", name: "a" }, { oid: "2", name: "b" }], "FROM pg_database d"), "t:1"), ServerIdentityError, "two database rows");
    await assert.rejects(readServerIdentity(lying([], "FROM pg_control_system()"), "t:1"), ServerIdentityError, "no system identifier row");
    await assert.rejects(readServerIdentity(lying([{ id: "1" }, { id: "2" }], "FROM pg_control_system()"), "t:1"), ServerIdentityError, "two system identifier rows");
    await assert.rejects(readServerIdentity(lying([{ id: "not-a-number" }], "FROM pg_control_system()"), "t:1"), ServerIdentityError, "garbled identifier");
  });
});

postgresTest("a change of server identity between review and apply is detected and nothing is applied", async () => {
  await withDatabase(async (db) => {
    const fingerprint = await catalogFingerprint(db);
    const target = "reviewed-host:5432";
    const reviewed = await readServerIdentity(db, target);
    // the same server and target applies normally
    await applyReviewedPlan(db, ['ALTER TABLE "t" ADD COLUMN "ok" integer;'], fingerprint, { planned: reviewed.id, target });
    assert.equal(await hasColumn(db, "ok"), true);
    // a connection that answers as a different server/target than the one that was reviewed is refused, with a confirmed rollback
    const fp2 = await catalogFingerprint(db);
    const error = await applyError(applyReviewedPlan(db, ['ALTER TABLE "t" ADD COLUMN "nope" integer;'], fp2, { planned: reviewed.id, target: "other-host:5432" }));
    assert.equal(error.outcome, "rolled_back");
    assert.match(error.message, /server identity changed/);
    assert.equal(await hasColumn(db, "nope"), false);
    const forged = JSON.stringify({ ...JSON.parse(reviewed.id), system: "7999999999999999999" });
    const error2 = await applyError(applyReviewedPlan(db, ['ALTER TABLE "t" ADD COLUMN "nope2" integer;'], fp2, { planned: forged, target }));
    assert.equal(error2.outcome, "rolled_back");
    assert.equal(await hasColumn(db, "nope2"), false);
  });
});

/* ------------------------------------------------ foreign key canonical form against PostgreSQL's own rendering ------------------------------------------------ */

postgresTest("canonicalConstraint agrees with pg_get_constraintdef for composite foreign keys and their action column lists", async () => {
  await withDatabase(async (db) => {
    const { rows: version } = await db.query("SHOW server_version_num");
    if (Number(version[0].server_version_num) < 150000) return; // column lists on SET NULL / SET DEFAULT need PostgreSQL 15+
    await db.query("CREATE TABLE parent (x int, y int, PRIMARY KEY (x, y)); CREATE TABLE child (a int DEFAULT 1, b int DEFAULT 1)");
    const defOf = async (action: string) => {
      await db.query(`ALTER TABLE child ADD CONSTRAINT fk FOREIGN KEY (a, b) REFERENCES parent(x, y) ${action}`);
      const { rows } = await db.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'fk'");
      await db.query("ALTER TABLE child DROP CONSTRAINT fk");
      return String(rows[0].def);
    };
    const drizzleStyle = (action: string) => `FOREIGN KEY ("a","b") REFERENCES "public"."parent"("x","y") ${action}`;
    const variants = ["ON DELETE SET NULL", "ON DELETE SET NULL (a)", "ON DELETE SET NULL (b)", "ON DELETE SET NULL (a, b)", "ON DELETE SET DEFAULT (a)", "ON DELETE SET DEFAULT", "ON UPDATE CASCADE"];
    const canon: Record<string, string | null> = {};
    for (const variant of variants) {
      const rendered = await defOf(variant);
      canon[variant] = canonicalConstraint(rendered);
      assert.ok(canon[variant], `PostgreSQL's rendering must be understood: ${rendered}`);
      assert.equal(canon[variant], canonicalConstraint(drizzleStyle(variant.toLowerCase().replace(/\(([^)]*)\)/, (_m, cols: string) => `(${cols.split(",").map((c) => `"${c.trim()}"`).join(",")})`))), `drizzle-style spelling of ${variant}`);
    }
    assert.equal(canon["ON DELETE SET NULL (a, b)"], canon["ON DELETE SET NULL"], "all referencing columns == no list, as PostgreSQL behaves");
    assert.notEqual(canon["ON DELETE SET NULL (a)"], canon["ON DELETE SET NULL (b)"]);
    assert.notEqual(canon["ON DELETE SET NULL (a)"], canon["ON DELETE SET NULL"]);
    assert.notEqual(canon["ON DELETE SET DEFAULT (a)"], canon["ON DELETE SET NULL (a)"]);
    assert.notEqual(canon["ON DELETE SET DEFAULT (a)"], canon["ON DELETE SET DEFAULT"]);
  });
});

/* ------------------------------------------------ sequences that belong to tables ------------------------------------------------ */

const sequenceExists = async (db: pg.Client, schema: string, name: string) => (await db.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND n.nspname = $1 AND c.relname = $2", [schema, name])).rowCount === 1;

postgresTest("pg_depend semantics: which relationships protect which kind of sequence", async () => {
  await withDatabase(async (db) => {
    await db.query(`
      CREATE TABLE u_serial (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE u_always (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
      CREATE TABLE u_default (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY);
      CREATE SEQUENCE s_manual; CREATE TABLE u_uses_manual (id bigint DEFAULT nextval('s_manual'));
      CREATE SEQUENCE s_unused;`);
    const names = { serial: "u_serial_id_seq", always: "u_always_id_seq", byDefault: "u_default_id_seq" };
    for (const name of Object.values(names)) assert.equal(await sequenceExists(db, "public", name), true, name);
    // the dependency rows themselves, so the test documents the direction of each relationship
    const dep = async (sequence: string) => (await db.query(
      `SELECT d.deptype, d.refclassid::regclass::text AS refclass, d.classid::regclass::text AS cls
         FROM pg_depend d WHERE d.objid = $1::regclass AND d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass`, [sequence])).rows;
    assert.deepEqual((await dep(names.serial)).map((r) => r.deptype), ["a"], "SERIAL: the sequence is OWNED BY the column (sequence -> table, 'a')");
    assert.deepEqual((await dep(names.always)).map((r) => r.deptype), ["i"], "IDENTITY: the sequence is INTERNAL to the column (sequence -> table, 'i')");
    assert.equal((await db.query("SELECT 1 FROM pg_depend WHERE refobjid = 'u_always_id_seq'::regclass AND classid = 'pg_attrdef'::regclass")).rowCount, 0, "an identity column has NO default expression referring to its sequence");
    assert.equal((await db.query("SELECT 1 FROM pg_depend WHERE refobjid = 'u_serial_id_seq'::regclass AND classid = 'pg_attrdef'::regclass")).rowCount, 1, "a SERIAL default does refer to its sequence");

    const check = async (schema: string, name: string) => sequenceProtection(db, schema, name);
    assert.deepEqual(await check("public", names.serial), { exists: true, protected: true, reasons: ["owned by a table column", "referenced by a default or another object"] });
    assert.deepEqual(await check("public", names.always), { exists: true, protected: true, reasons: ["identity sequence of a table column"] }, "GENERATED ALWAYS AS IDENTITY");
    assert.deepEqual(await check("public", names.byDefault), { exists: true, protected: true, reasons: ["identity sequence of a table column"] }, "GENERATED BY DEFAULT AS IDENTITY");
    assert.deepEqual(await check("public", "s_manual"), { exists: true, protected: true, reasons: ["referenced by a default or another object"] }, "unowned sequence used by a DEFAULT");
    assert.deepEqual(await check("public", "s_unused"), { exists: true, protected: false, reasons: [] }, "an unrelated sequence is NOT protected");
    assert.deepEqual(await check("public", "does_not_exist"), { exists: false, protected: false, reasons: [] });
  });
});

postgresTest("the identity-sequence case the old check missed: PostgreSQL itself refuses the drop, and the guard excludes it before planning", async () => {
  await withDatabase(async (db) => {
    await db.query("CREATE TABLE unmanaged_identity (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, v text); INSERT INTO unmanaged_identity (v) VALUES ('keep')");
    await assert.rejects(db.query('DROP SEQUENCE "public"."unmanaged_identity_id_seq"'), (error: { code?: string }) => error.code === "2BP01" || error.code === "55000", "the server would refuse it, and a failed statement aborts the whole push");
    const dropIt = 'DROP SEQUENCE "public"."unmanaged_identity_id_seq";';
    const { toApply, skipped } = await excludeProtectedSequences(db, ['ALTER TABLE "unmanaged_identity" ADD COLUMN "x" integer;', dropIt]);
    assert.deepEqual(toApply, ['ALTER TABLE "unmanaged_identity" ADD COLUMN "x" integer;']);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].statement, dropIt);
    await applyReviewedPlan(db, toApply, await catalogFingerprint(db));
    assert.equal(await sequenceExists(db, "public", "unmanaged_identity_id_seq"), true, "not dropped");
    await db.query("INSERT INTO unmanaged_identity (v) VALUES ('after')"); // the identity still generates values
    assert.equal((await db.query("SELECT count(*)::int AS n FROM unmanaged_identity")).rows[0].n, 2);
  });
});

postgresTest("same sequence name in different schemas: only the one that belongs to a table is protected", async () => {
  await withDatabase(async (db) => {
    await db.query(`
      CREATE SCHEMA other;
      CREATE TABLE public.t_a (id BIGSERIAL PRIMARY KEY);            -- public.t_a_id_seq is owned
      CREATE SEQUENCE other.t_a_id_seq;                               -- same name, unrelated, in another schema
      CREATE SEQUENCE other.only_other;`);
    assert.equal((await sequenceProtection(db, "public", "t_a_id_seq")).protected, true);
    assert.equal((await sequenceProtection(db, "other", "t_a_id_seq")).protected, false, "a name alone is not an identity");
    const { toApply, skipped } = await excludeProtectedSequences(db, ['DROP SEQUENCE "other"."t_a_id_seq";', 'DROP SEQUENCE "public"."t_a_id_seq";', 'DROP SEQUENCE other.only_other;']);
    assert.deepEqual(toApply, ['DROP SEQUENCE "other"."t_a_id_seq";', 'DROP SEQUENCE other.only_other;']);
    assert.deepEqual(skipped.map((item) => `${item.schema}.${item.name}`), ["public.t_a_id_seq"]);
    // the unrelated ones stay in the plan and are still reviewed like any drop
    assert.deepEqual(classifyPushPlan(toApply).map((item) => item.kind), ["drop_sequence", "drop_sequence"]);
    // an unqualified DROP SEQUENCE means public (the search path), never "any schema with that name"
    assert.deepEqual((await excludeProtectedSequences(db, ["DROP SEQUENCE t_a_id_seq;"])).skipped.map((item) => item.schema), ["public"]);
  });
});

postgresTest("an unrelated sequence is still dropped when the plan is applied; a protected one is not reported as removed", async () => {
  await withDatabase(async (db) => {
    await db.query("CREATE SEQUENCE s_unused; CREATE TABLE u_serial (id BIGSERIAL PRIMARY KEY)");
    const plan = ['DROP SEQUENCE "public"."s_unused";', 'DROP SEQUENCE "public"."u_serial_id_seq";', 'ALTER TABLE "u_serial" ADD COLUMN "z" integer;'];
    const { toApply, skipped } = await excludeProtectedSequences(db, plan);
    assert.deepEqual(toApply, [plan[0], plan[2]]);
    assert.deepEqual(skipped.map((item) => item.name), ["u_serial_id_seq"]);
    await applyReviewedPlan(db, toApply, await catalogFingerprint(db));
    assert.equal(await sequenceExists(db, "public", "s_unused"), false, "the unrelated sequence was removed as reviewed");
    assert.equal(await sequenceExists(db, "public", "u_serial_id_seq"), true, "the owned sequence was kept");
    assert.equal(toApply.length, 2, "the executable plan, not the original, is what is counted and reported");
  });
});

postgresTest("the approval token names the executable plan: the protected DROP SEQUENCE is not in it", async () => {
  await withDatabase(async (db) => {
    await db.query("CREATE TABLE u (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY)");
    const original = ['ALTER TABLE "x" DISABLE ROW LEVEL SECURITY;', 'DROP SEQUENCE "public"."u_id_seq";'];
    const { toApply } = await excludeProtectedSequences(db, original);
    assert.deepEqual(toApply, [original[0]]);
    const identity = (await readServerIdentity(db, "t:5432")).id;
    const token = (plan: string[]) => planAcknowledgementToken(plan, identity, undefined, "c");
    assert.notEqual(token(toApply), token(original));
    assert.equal(token(toApply), token([original[0]]));
    // an approval issued for the original (unfiltered) plan cannot be used for the executable one
    assert.deepEqual(classifyPushPlan(toApply).map((item) => item.kind), ["rls_disabled"]);
  });
});

postgresTest("incomplete or ambiguous dependency inspection fails closed", async () => {
  await withDatabase(async (db) => {
    const lying = (rows: Record<string, unknown>[]): QueryClient => ({ query: async (text: string, values?: unknown[]) => (text.includes("pg_depend") ? { rows } : db.query(text, values)) });
    await assert.rejects(sequenceProtection(lying([{ owned: true, identity: false, referenced: false }, { owned: false, identity: false, referenced: false }]), "public", "s"), /unambiguously/);
    await assert.rejects(sequenceProtection(lying([{ owned: null, identity: false, referenced: false }]), "public", "s"), /completely/);
    await assert.rejects(sequenceProtection(lying([{ owned: "t", identity: false, referenced: false }]), "public", "s"), /completely/);
    const broken: QueryClient = { query: async () => { throw new Error("catalog unavailable"); } };
    await assert.rejects(excludeProtectedSequences(broken, ['DROP SEQUENCE "public"."s";']), /catalog unavailable/, "an inspection error stops the push; the statement is never silently kept or dropped");
  });
});

/* ------------------------------------------------ literal semantics, checked against PostgreSQL itself ------------------------------------------------ */

postgresTest("canonical equality never claims two literals are equal when PostgreSQL says they differ (differential test against the server)", async () => {
  await withDatabase(async (db) => {
    const { rows: setting } = await db.query("SHOW standard_conforming_strings");
    assert.equal(setting[0].standard_conforming_strings, "on", "precondition: the default");
    const canon = (literal: string) => canonicalConstraint(`CHECK (x <> ${literal})`, { standardConformingStrings: true });
    // SQL source text of each literal (a TS "\\n" is the two characters backslash and n, which is what the SQL text contains)
    const pairs: [string, string][] = [
      ["E'\\n'", "'\\n'"], ["E'\\n'", "E'\\t'"], ["E'\\n'", "E'\\\\n'"], ["E'\\x41'", "E'\\x42'"], ["E'A'", "E'\\x41'"], ["E'A'", "E'\\101'"],
      ["E'A'", "E'\\u0041'"], ["E'A'", "E'\\U00000041'"], ["E'\\\\n'", "'\\n'"], ["E'\\z'", "E'z'"], ["E'\\''", "''''"], ["'it''s'", "E'it\\'s'"],
      ["'it''s'", "$$it's$$"], ["'it''s'", "'its'"], ["$$a\\nb$$", "E'a\\\\nb'"], ["$$a\\nb$$", "E'a\\nb'"], ["$a$one$a$", "$b$one$b$"], ["$a$one$a$", "$a$two$a$"],
      ["''''", "''"], ["E'\\b'", "E'\\f'"], ["E'\\r'", "E'\\n'"], ["'a'", "'a'"], ["''", "E''"],
    ];
    let equalClaims = 0;
    for (const [a, b] of pairs) {
      const { rows } = await db.query(`SELECT (${a}) = (${b}) AS equal`);
      const claimed = canon(a) !== null && canon(a) === canon(b);
      if (claimed) { equalClaims += 1; assert.equal(rows[0].equal, true, `canonical form claims ${a} == ${b} but PostgreSQL says they differ`); }
      else assert.equal(rows[0].equal, false, `canonical form did not equate ${a} and ${b}, which PostgreSQL treats as equal`);
    }
    assert.ok(equalClaims >= 10, "legitimate equivalences are recognised");
    // with standard_conforming_strings off an ordinary literal IS an escape string -- the case the canonical form refuses to guess
    await db.query("SET standard_conforming_strings = off");
    await db.query("SET escape_string_warning = off");
    assert.equal((await db.query("SELECT ('\\n') = (E'\\n') AS equal")).rows[0].equal, true);
    assert.equal(canonicalConstraint("CHECK (x <> '\\n')", { standardConformingStrings: false }), canonicalConstraint("CHECK (x <> E'\\n')", { standardConformingStrings: false }));
    assert.equal(canonicalConstraint("CHECK (x <> '\\n')", {}), null);
  });
});

postgresTest("PostgreSQL's own renderings of constraints and indexes with different escape semantics have different canonical forms", async () => {
  await withDatabase(async (db) => {
    await db.query("CREATE TABLE lit (a text, b text)");
    const def = async (create: string, name: string, kind: "constraint" | "index") => {
      await db.query(create);
      const { rows } = await db.query(kind === "constraint" ? "SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = $1" : "SELECT pg_get_indexdef(indexrelid) AS d FROM pg_index WHERE indexrelid = $1::regclass", [name]);
      return String(rows[0].d);
    };
    const options = { standardConformingStrings: true };
    const checkNewline = await def("ALTER TABLE lit ADD CONSTRAINT c_nl CHECK (a <> E'\\n')", "c_nl", "constraint");
    const checkBackslashN = await def("ALTER TABLE lit ADD CONSTRAINT c_bn CHECK (a <> '\\n')", "c_bn", "constraint");
    assert.ok(canonicalConstraint(checkNewline, options) && canonicalConstraint(checkBackslashN, options), "PostgreSQL's renderings are understood");
    assert.notEqual(canonicalConstraint(checkNewline, options), canonicalConstraint(checkBackslashN, options));
    const partialNewline = await def("CREATE UNIQUE INDEX i_nl ON lit (a) WHERE (b <> E'\\n')", "i_nl", "index");
    const partialBackslashN = await def("CREATE UNIQUE INDEX i_bn ON lit (a) WHERE (b <> '\\n')", "i_bn", "index");
    const exprNewline = await def("CREATE INDEX x_nl ON lit ((a || E'\\n'))", "x_nl", "index");
    const exprBackslashN = await def("CREATE INDEX x_bn ON lit ((a || '\\n'))", "x_bn", "index");
    const idx = (definition: string) => parseIndexStatement(definition, options)?.canonical;
    assert.ok(idx(partialNewline) && idx(partialBackslashN) && idx(exprNewline) && idx(exprBackslashN), "PostgreSQL's index renderings are understood");
    assert.notEqual(idx(partialNewline), idx(partialBackslashN), "partial UNIQUE index");
    assert.notEqual(idx(exprNewline), idx(exprBackslashN), "expression index");
    // the classifier therefore reviews swapping one for the other, while an index compared with itself stays excused
    const facts = (name: string, definition: string): PlanCatalogFacts => ({ constraints: {}, indexes: { [JSON.stringify(["public", name])]: definition }, standardConformingStrings: true });
    const rename = (definition: string, name: string) => definition.replace(/INDEX \S+ ON public\./, `INDEX "${name}" ON "public".`);
    const swap = (from: string, to: string, name: string) => classifyPushPlan([`DROP INDEX "${name}";`, `${rename(to, name)};`], facts(name, from)).map((item) => item.kind);
    assert.deepEqual(swap(partialNewline, partialBackslashN, "i_nl"), ["drop_index_unpaired"]);
    assert.deepEqual(swap(partialNewline, partialNewline, "i_nl"), []);
    assert.deepEqual(swap(exprNewline, exprBackslashN, "x_nl"), ["drop_index_unpaired"]);
    assert.deepEqual(swap(exprNewline, exprNewline, "x_nl"), []);
  });
});
