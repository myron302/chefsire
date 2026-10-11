/**
 * The pure half of the schema-push guard: plan parsing and classification. No database, no drizzle-kit process.
 * The end-to-end behaviour on a real PostgreSQL is in server/scripts/schema-push-safety.postgres.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SchemaPlanParseError,
  canonicalConstraint,
  catalogLookupsNeeded,
  classifyPushPlan,
  constraintFactKey,
  dropSequenceTarget,
  enumAdditionCount,
  enumAdditionHazards,
  interpretDryRun,
  indexFactKey,
  isDisposableTestDatabase,
  parsePushPlan,
  pgIdentifier,
  planAcknowledgementToken,
  splitSqlStatements,
  type PlanCatalogFacts,
} from "./schema-push-plan";

const wrap = (body: string) => ` Warning  You are about to execute current statements:\n\n${body}\n\n❯ No, abort\n  Yes, I want to execute all statements\n`;
const kinds = (statements: string[], facts?: PlanCatalogFacts) => classifyPushPlan(statements, facts).map((item) => item.kind);
const facts = (constraints: Record<string, string> = {}, indexes: Record<string, string> = {}): PlanCatalogFacts => ({ constraints, indexes });

/* ------------------------------------------------ RLS and authorization boundaries (P1) ------------------------------------------------ */

test("disabling row level security always requires review, whatever the spelling", () => {
  for (const statement of [
    'ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;',
    'alter table orders disable row level security;',
    'ALTER TABLE "public"."orders" DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY',
    'ALTER TABLE ONLY "orders" DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE IF EXISTS "orders" DISABLE ROW LEVEL SECURITY;',
    'ALTER   TABLE\n\t"my ""odd"" table"\n  DISABLE\n ROW   LEVEL\tSECURITY ;',
    'ALTER TABLE "é表" DISABLE ROW LEVEL SECURITY;',
  ]) assert.deepEqual(kinds([statement]), ["rls_disabled"], statement);
});

test("NO FORCE ROW LEVEL SECURITY requires review", () => {
  for (const statement of ['ALTER TABLE "orders" NO FORCE ROW LEVEL SECURITY;', 'ALTER TABLE "public"."orders" no force row level security;'])
    assert.deepEqual(kinds([statement]), ["rls_no_force"], statement);
});

test("dropping, altering or adding a policy requires review (a permissive policy widens access)", () => {
  assert.deepEqual(kinds(['DROP POLICY "tenant_isolation" ON "orders";']), ["policy_dropped"]);
  assert.deepEqual(kinds(['DROP POLICY IF EXISTS tenant_isolation ON public.orders;']), ["policy_dropped"]);
  assert.deepEqual(kinds(['ALTER POLICY "tenant_isolation" ON "orders" USING (true);']), ["policy_altered"]);
  assert.deepEqual(kinds(['ALTER POLICY p ON orders TO PUBLIC;']), ["policy_altered"]);
  assert.deepEqual(kinds(['ALTER POLICY p ON orders RENAME TO q;']), ["policy_altered"]);
  assert.deepEqual(kinds(['CREATE POLICY "open" ON "orders" AS PERMISSIVE FOR ALL TO public USING (true);']), ["policy_created"]);
});

test("strengthening RLS passes; other authorization-boundary changes are never silently approved", () => {
  assert.deepEqual(kinds(['ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;', 'ALTER TABLE "public"."orders" FORCE ROW LEVEL SECURITY;']), []);
  for (const statement of [
    'GRANT ALL ON TABLE orders TO PUBLIC;', 'REVOKE ALL ON orders FROM app;', 'ALTER ROLE app BYPASSRLS;', 'CREATE ROLE evil BYPASSRLS;',
    'ALTER TABLE orders OWNER TO evil;', 'ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO PUBLIC;', 'SET ROLE evil;', 'SET row_security = off;',
    'ALTER TABLE orders DISABLE TRIGGER USER;', 'ALTER TABLE orders DISABLE TRIGGER orders_append_only;',
    'DROP TRIGGER orders_append_only ON orders;', 'CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;',
    'DROP FUNCTION forbid_change();', 'ALTER TABLE orders NO INHERIT parent;', 'ALTER TABLE orders SET SCHEMA other;',
  ]) assert.notDeepEqual(kinds([statement]), [], statement);
  assert.deepEqual(kinds(['DROP TRIGGER t ON o;']), ["trigger_dropped"]);
  assert.deepEqual(kinds(['ALTER TABLE o DISABLE TRIGGER t;']), ["trigger_disabled"]);
});

test("a dangerous action cannot hide in a compound or multi-statement string", () => {
  assert.deepEqual(kinds(['ALTER TABLE "o" ADD COLUMN "a" integer, DISABLE ROW LEVEL SECURITY;']), ["unrecognized_statement"]);
  assert.deepEqual(kinds(['ALTER TABLE "o" ADD COLUMN "a" integer; ALTER TABLE "o" DISABLE ROW LEVEL SECURITY;']), ["unrecognized_statement"]);
  assert.deepEqual(kinds(['ALTER TABLE "o" ADD COLUMN "a" numeric(10,2) DEFAULT 0 NOT NULL;']), [], "commas inside parentheses are fine");
});

test("unrecognized or unusual SQL fails closed", () => {
  for (const statement of [
    'VACUUM FULL orders;', 'COMMIT;', 'BEGIN;', 'INSERT INTO t VALUES (1);', 'UPDATE t SET a = 1;', 'CREATE EXTENSION pgcrypto;',
    'CREATE TABLE t AS SELECT 1;', 'CREATE TEMP TABLE t (a int);', 'CREATE INDEX CONCURRENTLY i ON t (a);',
    'ALTER TABLE t RENAME TO u;', 'ALTER TABLE t RENAME COLUMN a TO b;', 'ALTER TABLE t ALTER COLUMN a SET STATISTICS 5;', 'COMMENT ON TABLE t IS \'x\';',
    'ALTER SEQUENCE s RESTART;', 'CREATE VIEW v AS SELECT 1;', 'totally not sql',
  ]) assert.deepEqual(kinds([statement]), ["unrecognized_statement"], statement);
});

test("every destructive statement drizzle-kit can plan is flagged, in any spelling", () => {
  assert.deepEqual(kinds(['DROP TABLE "households" CASCADE;']), ["drop_table"]);
  assert.deepEqual(kinds(['drop table if exists public.households;']), ["drop_table"]);
  assert.deepEqual(kinds(['ALTER TABLE "users" DROP COLUMN "email";']), ["drop_column"]);
  assert.deepEqual(kinds(['ALTER TABLE IF EXISTS ONLY public.users DROP email;']), ["drop_column"]);
  assert.deepEqual(kinds(['DROP TYPE "public"."status";']), ["drop_type"]);
  assert.deepEqual(kinds(['DROP SEQUENCE "public"."x_seq";']), ["drop_sequence"]);
  assert.deepEqual(kinds(['DROP SCHEMA "other" CASCADE;']), ["drop_schema"]);
  assert.deepEqual(kinds(['DROP VIEW "v";']), ["drop_view"]);
  assert.deepEqual(kinds(['DROP MATERIALIZED VIEW "v";']), ["drop_view"]);
  assert.deepEqual(kinds(['DROP FUNCTION f();']), ["drop_other"]);
  assert.deepEqual(kinds(['TRUNCATE TABLE "orders" CASCADE;']), ["truncate"]);
  assert.deepEqual(kinds(['DELETE FROM "orders";']), ["delete_rows"]);
  assert.deepEqual(kinds(['ALTER TABLE "orders" ALTER COLUMN "total_amount" SET DATA TYPE integer;']), ["column_type_change"]);
  assert.deepEqual(kinds(['ALTER TABLE "orders" ALTER COLUMN "total_amount" TYPE integer USING total_amount::integer;']), ["column_type_change"]);
  assert.deepEqual(kinds(['ALTER TABLE "orders" ALTER COLUMN "total_amount" DROP NOT NULL;']), ["not_null_dropped"]);
});

test("ordinary safe schema additions pass silently", () => {
  assert.deepEqual(kinds([
    'CREATE TABLE "t" (\n\t"id" serial PRIMARY KEY NOT NULL,\n\t"c" numeric(10, 2) DEFAULT 0\n);',
    'CREATE TABLE IF NOT EXISTS "public"."t2" ("id" uuid PRIMARY KEY);',
    'ALTER TABLE "t" ADD COLUMN "c" text;',
    'ALTER TABLE "t" ADD COLUMN IF NOT EXISTS "d" text DEFAULT \'a;b\';',
    'ALTER TABLE "t" ALTER COLUMN "c" SET DEFAULT \'{}\'::text[];',
    'ALTER TABLE "t" ALTER COLUMN "c" SET NOT NULL;',
    'CREATE INDEX "t_c_idx" ON "t" USING btree ("c");',
    'CREATE UNIQUE INDEX IF NOT EXISTS "t_u" ON "public"."t" ("c") WHERE "c" IS NOT NULL;',
    'ALTER TABLE "t" ADD CONSTRAINT "t_c_unique" UNIQUE("c");',
    'ALTER TABLE "t" ADD CONSTRAINT "t_fk" FOREIGN KEY ("c") REFERENCES "public"."u"("id") ON DELETE cascade ON UPDATE no action;',
    'CREATE SEQUENCE "s";', 'CREATE TYPE "public"."k" AS ENUM(\'a\', \'b\');', 'ALTER TYPE "k" ADD VALUE \'c\';', 'CREATE SCHEMA "x";',
  ]), []);
});

/* ------------------------------------------- replacement matching (P2) ------------------------------------------- */

const LONG = "catering_booking_access_details_booking_id_catering_bookings_id"; // 63 characters: what PostgreSQL stored
const FK_DB = "FOREIGN KEY (booking_id) REFERENCES catering_bookings(id) ON DELETE CASCADE";
const dropFk = (name = LONG, table = "catering_booking_access_details") => `ALTER TABLE "${table}" DROP CONSTRAINT "${name}";`;
const addFk = (name: string, table = "catering_booking_access_details", extra = 'ON DELETE cascade ON UPDATE no action') =>
  `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("booking_id") REFERENCES "public"."catering_bookings"("id") ${extra};`;
const fkFacts = (table = "catering_booking_access_details", name = LONG, def = FK_DB) => facts({ [constraintFactKey("public", table, name)]: def });

test("genuine Drizzle churn (untruncated name, same definition) is still recognised as an unchanged constraint", () => {
  assert.equal(`${LONG}_fk`.length > 63, true);
  assert.deepEqual(kinds([dropFk(), addFk(`${LONG}_fk`)], fkFacts()), []);
  assert.deepEqual(kinds([dropFk(), addFk(LONG)], fkFacts()), [], "an identical name works too");
  // unique constraint renamed by truncation (the real creator_membership_checkout_sessions case)
  const stored = "creator_membership_checkout_sessions_provider_reference_id_uniq";
  assert.equal(stored.length, 63);
  assert.deepEqual(kinds(
    [`ALTER TABLE "creator_membership_checkout_sessions" DROP CONSTRAINT "${stored}";`,
      'ALTER TABLE "creator_membership_checkout_sessions" ADD CONSTRAINT "creator_membership_checkout_sessions_provider_reference_id_unique" UNIQUE("provider_reference_id");'],
    facts({ [constraintFactKey("public", "creator_membership_checkout_sessions", stored)]: "UNIQUE (provider_reference_id)" })), []);
});

test("two constraints sharing their first 40 characters are NOT equivalent", () => {
  const added = `${LONG.slice(0, 45)}_something_else_entirely_fk`;
  assert.equal(added.slice(0, 40), LONG.slice(0, 40));
  assert.deepEqual(kinds([dropFk(), addFk(added)], fkFacts()), ["drop_constraint_unpaired"]);
});

test("constraints on different tables cannot match", () => {
  assert.deepEqual(kinds([dropFk(), addFk(LONG, "catering_booking_files")], fkFacts()), ["drop_constraint_unpaired"]);
  assert.deepEqual(kinds([dropFk(), addFk(LONG).replace('"catering_booking_access_details"', '"other"."catering_booking_access_details"')], fkFacts()), ["drop_constraint_unpaired"], "nor a different schema");
});

test("a weaker or different replacement of a protective constraint requires review", () => {
  // same name, same table, weaker referential action
  assert.deepEqual(kinds([dropFk(), addFk(LONG, undefined, "ON DELETE set null ON UPDATE no action")], fkFacts()), ["drop_constraint_unpaired"]);
  // foreign key replaced by a different referenced column / table
  assert.deepEqual(kinds([dropFk(), addFk(LONG).replace('"catering_bookings"("id")', '"catering_bookings"("other_id")')], fkFacts()), ["drop_constraint_unpaired"]);
  assert.deepEqual(kinds([dropFk(), addFk(LONG).replace('"catering_bookings"', '"other_table"')], fkFacts()), ["drop_constraint_unpaired"]);
  // unique -> narrower/wider column set, unique -> check, primary key -> unique, validated -> NOT VALID
  const key = (kind: string) => facts({ [constraintFactKey("public", "t", "c")]: kind });
  const swap = (add: string, existing: string) => kinds(['ALTER TABLE "t" DROP CONSTRAINT "c";', `ALTER TABLE "t" ADD CONSTRAINT "c" ${add};`], key(existing));
  assert.deepEqual(swap('UNIQUE ("a")', "UNIQUE (a, b)"), ["drop_constraint_unpaired"]);
  assert.deepEqual(swap('UNIQUE ("a", "b")', "UNIQUE (a, b)"), []);
  assert.deepEqual(swap('UNIQUE ("a") NULLS NOT DISTINCT', "UNIQUE (a)"), ["drop_constraint_unpaired"]);
  assert.deepEqual(swap('CHECK ("a" > 0)', "UNIQUE (a)"), ["drop_constraint_unpaired"]);
  assert.deepEqual(swap('UNIQUE ("a")', "PRIMARY KEY (a)"), ["drop_constraint_unpaired"]);
  assert.deepEqual(swap('PRIMARY KEY ("a")', "PRIMARY KEY (a)"), []);
  assert.deepEqual(swap('UNIQUE ("a") NOT VALID', "UNIQUE (a)"), ["drop_constraint_unpaired"]);
  assert.deepEqual(swap('UNIQUE ("a") DEFERRABLE INITIALLY DEFERRED', "UNIQUE (a)"), ["drop_constraint_unpaired"]);
  assert.deepEqual(swap('CHECK ("amount" > 0)', "CHECK ((amount > 0))"), ["drop_constraint_unpaired"], "an unprovable CHECK equivalence is reviewed, never assumed");
});

test("a dropped constraint with no live definition, an unparseable definition, or an ambiguous pairing fails closed", () => {
  assert.deepEqual(kinds([dropFk(), addFk(LONG)]), ["drop_constraint_unpaired"], "no catalog facts");
  assert.deepEqual(kinds([dropFk(), addFk(LONG)], fkFacts(undefined, undefined, "EXCLUDE USING gist (c WITH =)")), ["drop_constraint_unpaired"], "unparseable live definition");
  assert.deepEqual(kinds([dropFk(), addFk(LONG).replace("FOREIGN KEY", "SOMETHING ELSE")], fkFacts()), ["drop_constraint_unpaired"], "unparseable replacement");
  assert.deepEqual(kinds([dropFk(), addFk(LONG), addFk(`${LONG}_fk`)], fkFacts()), ["drop_constraint_unpaired"], "two candidates are ambiguous");
  assert.deepEqual(kinds([dropFk(), dropFk(), addFk(LONG)], fkFacts()).length, 1, "one replacement can excuse only one drop");
  assert.deepEqual(kinds([`ALTER TABLE "t" DROP CONSTRAINT "c" CASCADE;`]), ["drop_constraint_unpaired"], "CASCADE is never a plain drop");
  assert.deepEqual(kinds(['ALTER TABLE "t" DROP CONSTRAINT "a", DROP CONSTRAINT "b";']), ["unrecognized_statement"]);
  assert.deepEqual(kinds(['ALTER TABLE "payouts" DROP CONSTRAINT "payouts_amount_check";']), ["drop_constraint_unpaired"]);
});

test("the one CHECK that push-schema.ts reasserts after every push is the only allowed drift-drop, and only on its own table", () => {
  assert.deepEqual(kinds(['ALTER TABLE "payouts" DROP CONSTRAINT "payouts_completed_transfer_check";']), []);
  assert.deepEqual(kinds(['ALTER TABLE "public"."payouts" DROP CONSTRAINT "payouts_completed_transfer_check";']), []);
  assert.deepEqual(kinds(['ALTER TABLE "orders" DROP CONSTRAINT "payouts_completed_transfer_check";']), ["drop_constraint_unpaired"]);
});

const INDEX_DB = "CREATE INDEX creator_campaign_rollout_timeline_events_campaign_occurred_at_i ON public.creator_campaign_rollout_timeline_events USING btree (campaign_id, occurred_at)";
const IDX = "creator_campaign_rollout_timeline_events_campaign_occurred_at_i";
const dropIdx = (name = IDX) => `DROP INDEX "${name}";`;
const createIdx = (name: string, table = "creator_campaign_rollout_timeline_events", rest = 'USING btree ("campaign_id","occurred_at")', unique = "") =>
  `CREATE ${unique}INDEX "${name}" ON "${table}" ${rest};`;
const idxFacts = (def = INDEX_DB, name = IDX) => facts({}, { [indexFactKey("public", name)]: def });

test("indexes: genuine churn passes; same table, same effective name and same definition are all required", () => {
  assert.deepEqual(kinds([dropIdx(), createIdx(`${IDX}dx`)], idxFacts()), [], "untruncated name, same definition");
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX)], idxFacts()), []);
  assert.deepEqual(kinds([dropIdx(), createIdx(`${IDX.slice(0, 45)}_unrelated_index_idx`)], idxFacts()), ["drop_index_unpaired"], "40-char prefix is not identity");
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX, "some_other_table")], idxFacts()), ["drop_index_unpaired"], "different table");
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX).replace('"creator_campaign_rollout_timeline_events"', '"other"."creator_campaign_rollout_timeline_events"')], idxFacts()), ["drop_index_unpaired"], "different schema");
  assert.deepEqual(kinds([`DROP INDEX "other"."${IDX}";`, createIdx(IDX)], idxFacts()), ["drop_index_unpaired"]);
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX, undefined, 'USING btree ("campaign_id")')], idxFacts()), ["drop_index_unpaired"], "different columns");
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX, undefined, 'USING hash ("campaign_id","occurred_at")')], idxFacts()), ["drop_index_unpaired"], "different method");
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX, undefined, 'USING btree ("campaign_id","occurred_at") WHERE "campaign_id" > 0')], idxFacts()), ["drop_index_unpaired"], "partial index");
});

test("a UNIQUE index replaced with a non-unique index requires review; unique stays unique", () => {
  const uniqueDb = INDEX_DB.replace("CREATE INDEX", "CREATE UNIQUE INDEX");
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX)], idxFacts(uniqueDb)), ["drop_index_unpaired"]);
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX, undefined, undefined, "UNIQUE ")], idxFacts(uniqueDb)), []);
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX, undefined, undefined, "UNIQUE ")], idxFacts()), ["drop_index_unpaired"], "non-unique replaced by unique is still a change to review");
});

test("indexes with no live definition, unparseable text, CONCURRENTLY, CASCADE or several targets fail closed", () => {
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX)]), ["drop_index_unpaired"]);
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX)], idxFacts("not an index definition")), ["drop_index_unpaired"]);
  assert.deepEqual(kinds(["DROP INDEX CONCURRENTLY i;"]), ["drop_index_unpaired"]);
  assert.deepEqual(kinds(["DROP INDEX a, b;"]), ["drop_index_unpaired"]);
  assert.deepEqual(kinds(["DROP INDEX a CASCADE;"]), ["drop_index_unpaired"]);
  assert.deepEqual(kinds([dropIdx(), createIdx(IDX).replace("USING btree", "USING btree INCLUDE (x) ,junk")], idxFacts()), ["drop_index_unpaired"]);
});

test("PostgreSQL identifiers: 63 BYTES of UTF-8, never splitting a character", () => {
  assert.equal(pgIdentifier("a".repeat(63)), "a".repeat(63));
  assert.equal(pgIdentifier("a".repeat(70)), "a".repeat(63));
  // 'é' is 2 bytes: 31 of them = 62 bytes, a 32nd would make 64 -> stops at 31 characters
  assert.equal(pgIdentifier("é".repeat(40)), "é".repeat(31));
  // 3-byte and 4-byte characters
  assert.equal(pgIdentifier("表".repeat(30)), "表".repeat(21));
  assert.equal(pgIdentifier("😀".repeat(20)), "😀".repeat(15));
  assert.equal(Buffer.byteLength(pgIdentifier("x" + "表".repeat(30)), "utf8") <= 63, true);
  assert.equal(pgIdentifier("short"), "short");
});

test("multibyte long identifiers pair by their stored (byte-truncated) name and still fail closed when they differ", () => {
  const base = `${"é".repeat(31)}`; // 62 bytes
  const stored = pgIdentifier(`${base}_constraint_that_is_far_too_long`);
  assert.equal(stored, `${base}_`);
  const table = "t_é";
  const live = facts({ [constraintFactKey("public", table, stored)]: "UNIQUE (a)" });
  assert.deepEqual(kinds([`ALTER TABLE "${table}" DROP CONSTRAINT "${stored}";`, `ALTER TABLE "${table}" ADD CONSTRAINT "${base}_constraint_that_is_far_too_long" UNIQUE ("a");`], live), []);
  assert.deepEqual(kinds([`ALTER TABLE "${table}" DROP CONSTRAINT "${stored}";`, `ALTER TABLE "${table}" ADD CONSTRAINT "${"è".repeat(31)}_x" UNIQUE ("a");`], live), ["drop_constraint_unpaired"]);
  // quoted identifiers keep case; unquoted fold; so "T" and t are different tables
  assert.deepEqual(kinds([`ALTER TABLE "T_é" DROP CONSTRAINT "${stored}";`, `ALTER TABLE ${table} ADD CONSTRAINT "${stored}" UNIQUE ("a");`], live), ["drop_constraint_unpaired"]);
});

test("catalogLookupsNeeded names exactly the dropped constraints and indexes, with their stored identifiers", () => {
  assert.deepEqual(catalogLookupsNeeded([dropFk(`${LONG}_fk`), 'DROP INDEX "public"."i";', 'DROP TABLE "x";', 'ALTER TABLE "a" ADD COLUMN "b" int;']),
    { constraints: [{ schema: "public", table: "catering_booking_access_details", name: LONG }], indexes: [{ schema: "public", name: "i" }] });
});

test("canonicalConstraint understands both drizzle's and PostgreSQL's spelling of the same constraint", () => {
  assert.equal(
    canonicalConstraint('FOREIGN KEY ("booking_id") REFERENCES "public"."catering_bookings"("id") ON DELETE cascade ON UPDATE no action'),
    canonicalConstraint("FOREIGN KEY (booking_id) REFERENCES catering_bookings(id) ON DELETE CASCADE"));
  assert.notEqual(canonicalConstraint("FOREIGN KEY (a) REFERENCES t(id)"), canonicalConstraint("FOREIGN KEY (a) REFERENCES t(id) ON DELETE CASCADE"));
  assert.equal(canonicalConstraint("something unknown"), null);
  assert.equal(canonicalConstraint("UNIQUE (a) trailing junk"), null);
});

/* ------------------------------------------------ acknowledgement ------------------------------------------------ */

test("the acknowledgement token names one set of dangerous statements on one database", () => {
  const a = classifyPushPlan(['DROP TABLE "a" CASCADE;']);
  const b = classifyPushPlan(['DROP TABLE "b" CASCADE;']);
  assert.equal(planAcknowledgementToken(a, "db1"), planAcknowledgementToken(classifyPushPlan(['DROP TABLE   "a"   CASCADE;']), "db1"));
  assert.notEqual(planAcknowledgementToken(a, "db1"), planAcknowledgementToken(b, "db1"));
  assert.notEqual(planAcknowledgementToken(a, "db1"), planAcknowledgementToken([...a, ...b], "db1"));
  assert.notEqual(planAcknowledgementToken(a, "db1"), planAcknowledgementToken(a, "db2"), "bound to the database");
  assert.notEqual(planAcknowledgementToken(a, "db1"), planAcknowledgementToken(classifyPushPlan(['ALTER TABLE "a" DISABLE ROW LEVEL SECURITY;']), "db1"));
  assert.match(planAcknowledgementToken(a, "db1"), /^[0-9a-f]{24}$/);
});

/* ------------------------------------------------ parsing ------------------------------------------------ */

test("splitSqlStatements honours parentheses, quotes, dollar quoting and refuses comments", () => {
  assert.deepEqual(splitSqlStatements(`CREATE TABLE "t" (\n "a" text DEFAULT 'x;y',\n "b" int\n);\nDROP TABLE "u" CASCADE;`), [
    `CREATE TABLE "t" (\n "a" text DEFAULT 'x;y',\n "b" int\n);`, 'DROP TABLE "u" CASCADE;',
  ]);
  assert.deepEqual(splitSqlStatements("DO $$ BEGIN PERFORM 1; END $$;\nSELECT 2;"), ["DO $$ BEGIN PERFORM 1; END $$;", "SELECT 2;"]);
  assert.deepEqual(splitSqlStatements(`SELECT E'it\\'s;';SELECT "a;b";`), [`SELECT E'it\\'s;';`, `SELECT "a;b";`]);
  assert.throws(() => splitSqlStatements("SELECT 'open;"), SchemaPlanParseError);
  assert.throws(() => splitSqlStatements('SELECT "open;'), SchemaPlanParseError);
  assert.throws(() => splitSqlStatements("SELECT 1"), SchemaPlanParseError);
  assert.throws(() => splitSqlStatements("SELECT 1; -- hide; DROP TABLE x\nSELECT 2;"), SchemaPlanParseError, "comments are refused");
  assert.throws(() => splitSqlStatements("SELECT /* x */ 1;"), SchemaPlanParseError);
});

test("parsePushPlan reads drizzle-kit's verbose strict output and never mistakes an unreadable plan for an empty one", () => {
  const output = `No config path provided\n[\u001b[32m✓\u001b[39m] Pulling schema from database...\n${wrap('ALTER TABLE "t" ADD COLUMN "c" text;\nDROP TABLE "u" CASCADE;')}`;
  assert.deepEqual(parsePushPlan(output), ['ALTER TABLE "t" ADD COLUMN "c" text;', 'DROP TABLE "u" CASCADE;']);
  assert.deepEqual(parsePushPlan("[i] No changes detected"), []);
  assert.throws(() => parsePushPlan("something unexpected"), SchemaPlanParseError);
  assert.throws(() => parsePushPlan(" Warning  You are about to execute current statements:\n\nDROP TABLE \"u\" CASCADE;\n"), SchemaPlanParseError);
  // a name that imitates the approval prompt cannot cut the plan short and hide what follows it
  const spoofed = wrap('CREATE TABLE "x\n  Yes, I want to execute all statements" ("a" int);\nDROP TABLE "victim" CASCADE;');
  assert.deepEqual(classifyPushPlan(parsePushPlan(spoofed)).map((item) => item.kind), ["drop_table"]);
});

test("dropSequenceTarget reads the sequence a DROP SEQUENCE names, qualified or not", () => {
  assert.deepEqual(dropSequenceTarget('DROP SEQUENCE "public"."households_id_seq";'), { schema: "public", name: "households_id_seq" });
  assert.deepEqual(dropSequenceTarget("drop sequence if exists other.s;"), { schema: "other", name: "s" });
  assert.equal(dropSequenceTarget('DROP TABLE "x";'), null);
  assert.equal(dropSequenceTarget("DROP SEQUENCE a, b;"), null);
});

test("only loopback databases named with a whole-word 'test' are disposable", () => {
  assert.equal(isDisposableTestDatabase("postgres://u@localhost:5432/chefsire_test_1"), true);
  assert.equal(isDisposableTestDatabase("postgres://u@127.0.0.1/my_TEST_db"), true);
  assert.equal(isDisposableTestDatabase("postgres://u@127.0.0.1/test"), true);
  assert.equal(isDisposableTestDatabase("postgres:///chefsire_test?host=/var/run/postgresql"), true);
  assert.equal(isDisposableTestDatabase("postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require"), false);
  assert.equal(isDisposableTestDatabase("postgres://u:p@ep-test-123.neon.tech/neondb_test"), false, "a remote host is never disposable");
  assert.equal(isDisposableTestDatabase("postgres://u@localhost/chefsire"), false);
  assert.equal(isDisposableTestDatabase("postgres://u@localhost/latest"), false, "'test' must be a whole word");
  assert.equal(isDisposableTestDatabase("postgres://u@localhost/contest_prod"), false);
  assert.equal(isDisposableTestDatabase("postgres://u@localhost/app_test?host=db.prod.example.com"), false, "libpq lets ?host override the URL host");
  assert.equal(isDisposableTestDatabase("postgres://u@localhost/app_test?hostaddr=10.0.0.5"), false);
  assert.equal(isDisposableTestDatabase("postgres://u@localhost,db.prod.example.com/app_test"), false);
  assert.equal(isDisposableTestDatabase("not a url"), false);
});

test("DROP NOT NULL is protection-removing in every spelling, including financial, entitlement and authentication tables", () => {
  for (const table of ["orders", "payouts", "commissions", "catering_booking_payments", "meal_plan_purchases", "users", "subscription_history"]) {
    for (const statement of [
      `ALTER TABLE "${table}" ALTER COLUMN "c" DROP NOT NULL;`,
      `ALTER TABLE "public"."${table}" ALTER COLUMN c DROP NOT NULL`,
      `alter table ${table} alter column "Mixed Case" drop not null;`,
      `ALTER TABLE ONLY IF EXISTS ${table}\n  ALTER COLUMN\n  c\n  DROP\n  NOT NULL ;`.replace("ONLY IF EXISTS", "IF EXISTS ONLY"),
      `ALTER TABLE ${table} ALTER c DROP NOT NULL;`,
    ]) assert.deepEqual(kinds([statement]), ["not_null_dropped"], statement);
  }
});

test("several ALTER COLUMN operations in one statement cannot smuggle DROP NOT NULL past review", () => {
  assert.deepEqual(kinds(['ALTER TABLE "o" ALTER COLUMN "a" SET NOT NULL, ALTER COLUMN "b" DROP NOT NULL;']), ["unrecognized_statement"]);
  assert.deepEqual(kinds(['ALTER TABLE "o" ALTER COLUMN "b" DROP NOT NULL, ALTER COLUMN "a" SET NOT NULL;']), ["unrecognized_statement"]);
  assert.deepEqual(kinds(['ALTER TABLE "o" ALTER COLUMN "a" SET DEFAULT 1, ALTER COLUMN "b" DROP NOT NULL;']), ["unrecognized_statement"]);
  assert.deepEqual(kinds(['ALTER TABLE "o" ALTER COLUMN "a" SET NOT NULL;', 'ALTER TABLE "o" ALTER COLUMN "b" DROP NOT NULL;']), ["not_null_dropped"], "separate statements are each classified");
});

test("tightening nullability and ordinary defaults stay silent; dropping a default (can carry security state) is reviewed", () => {
  assert.deepEqual(kinds(['ALTER TABLE "o" ALTER COLUMN "a" SET NOT NULL;', 'ALTER TABLE "o" ALTER COLUMN "a" SET DEFAULT \'free\';']), []);
  assert.deepEqual(kinds(['ALTER TABLE "o" ALTER COLUMN "tier" DROP DEFAULT;']), ["default_dropped"]);
  assert.deepEqual(kinds(['ALTER TABLE "public"."o" ALTER COLUMN "tier" DROP DEFAULT, ALTER COLUMN "x" SET NOT NULL;']), ["unrecognized_statement"]);
});

/* ------------------------------------------------ the dry-run process (stdout vs stderr) ------------------------------------------------ */

const PLAN_OUT = `No config path provided, using default 'drizzle.config.ts'\nUsing 'pg' driver for database querying\n${wrap('ALTER TABLE "users" DROP COLUMN "probe";')}`;
const NPM_WARNING = "npm warn exec The following package was not found and will be installed: drizzle-kit@0.30.4\nnpm warn config global `--global` is deprecated\n";

test("a valid plan on stdout is read whether or not npm wrote warnings to stderr", () => {
  const quiet = interpretDryRun({ status: 0, stdout: PLAN_OUT, stderr: "" });
  const noisy = interpretDryRun({ status: 0, stdout: PLAN_OUT, stderr: NPM_WARNING });
  assert.ok(quiet.ok && noisy.ok);
  assert.deepEqual(quiet.ok && quiet.statements, ['ALTER TABLE "users" DROP COLUMN "probe";']);
  assert.deepEqual(noisy.ok && noisy.statements, quiet.ok ? quiet.statements : []);
  assert.match(noisy.ok ? noisy.diagnostics : "", /npm warn/, "stderr is kept for diagnostics, not parsed");
  const empty = interpretDryRun({ status: 0, stdout: "[i] No changes detected", stderr: NPM_WARNING });
  assert.deepEqual(empty.ok && empty.statements, []);
});

test("a stderr warning can neither hide nor create a statement, so it can never change classification", () => {
  const hostile = 'ALTER TABLE "o" DISABLE ROW LEVEL SECURITY;\nDROP TABLE "victim" CASCADE;\n';
  const withStderr = interpretDryRun({ status: 0, stdout: PLAN_OUT, stderr: `${hostile}${NPM_WARNING}` });
  assert.ok(withStderr.ok);
  assert.deepEqual(classifyPushPlan(withStderr.ok ? withStderr.statements : []).map((item) => item.kind), ["drop_column"], "only stdout statements exist");
  // the dangerous statement on stdout is classified identically with or without stderr noise
  const a = interpretDryRun({ status: 0, stdout: PLAN_OUT, stderr: "" });
  assert.deepEqual(withStderr.ok && withStderr.statements, a.ok ? a.statements : null);
  // and a plan printed on STDERR only is not a plan
  const wrongStream = interpretDryRun({ status: 0, stdout: "", stderr: PLAN_OUT });
  assert.equal(wrongStream.ok, false);
  assert.equal(!wrongStream.ok && wrongStream.kind, "plan_unreadable");
});

test("prose inside the plan region is read as a statement and then fails closed in classification", () => {
  const outcome = interpretDryRun({ status: 0, stdout: wrap("this is not sql;"), stderr: "" });
  assert.ok(outcome.ok);
  assert.deepEqual(classifyPushPlan(outcome.ok ? outcome.statements : []).map((item) => item.kind), ["unrecognized_statement"]);
});

test("process failures, signals, spawn errors and non-zero exits fail closed even if stdout looks like a plan", () => {
  for (const result of [
    { status: 1, stdout: PLAN_OUT, stderr: "" },
    { status: 2, stdout: "", stderr: "boom" },
    { status: null, signal: "SIGTERM", stdout: PLAN_OUT, stderr: "" },
    { status: null, stdout: PLAN_OUT, stderr: "" },
    { status: null, error: new Error("spawnSync npm ETIMEDOUT"), stdout: "", stderr: "" },
  ]) {
    const outcome = interpretDryRun(result);
    assert.equal(outcome.ok, false);
    assert.equal(!outcome.ok && outcome.kind, "process_failed");
  }
  const failed = interpretDryRun({ status: 1, stdout: "Error: connect ECONNREFUSED", stderr: "npm warn x" });
  assert.match(!failed.ok ? failed.diagnostics : "", /ECONNREFUSED/, "a legitimate drizzle error is surfaced, not suppressed");
});

test("malformed, truncated or unexpected stdout is 'unreadable', distinct from a failed process and from a dangerous plan", () => {
  for (const stdout of [
    "", "garbage", "Reading config file\nUsing 'pg' driver\n",
    " Warning  You are about to execute current statements:\n\nDROP TABLE \"u\" CASCADE;\n", // no approval prompt: truncated
    wrap('ALTER TABLE "t" ADD COLUMN "c" text'), // unterminated statement
    `${wrap('DROP TABLE "u" CASCADE;')}\ntrailing text after the prompt`,
  ]) {
    const outcome = interpretDryRun({ status: 0, stdout, stderr: "" });
    if (outcome.ok) assert.fail(`accepted: ${JSON.stringify(stdout)} -> ${JSON.stringify(outcome.statements)}`);
    assert.equal(outcome.kind, "plan_unreadable", JSON.stringify(stdout));
  }
});

/* ------------------------------------------------ enum value additions ------------------------------------------------ */

const ADD_C = 'ALTER TYPE "public"."status" ADD VALUE \'c\';';

test("an enum addition that nothing in the plan uses is not a hazard (and plain plans have none)", () => {
  assert.equal(enumAdditionCount([ADD_C]), 1);
  assert.deepEqual(enumAdditionHazards([ADD_C]), []);
  assert.deepEqual(enumAdditionHazards([ADD_C, 'ALTER TABLE "t" ADD COLUMN "x" integer;', 'CREATE INDEX "t_x" ON "t" ("x");']), []);
  assert.deepEqual(enumAdditionHazards(['ALTER TABLE "t" ADD COLUMN "x" integer;', 'CREATE TABLE "u" ("id" int);']), []);
  assert.equal(enumAdditionCount(['ALTER TABLE "t" ADD COLUMN "x" integer;']), 0);
});

test("an enum addition followed by a dependent default, column, constraint or literal use is a hazard", () => {
  const dependents: string[][] = [
    ['ALTER TABLE "t" ALTER COLUMN "s" SET DEFAULT \'c\';'],
    ['ALTER TABLE "t" ADD COLUMN "s2" "status" DEFAULT \'c\' NOT NULL;'],
    ['ALTER TABLE "t" ADD COLUMN "s2" "public"."status";'], // names the type
    ['CREATE TABLE "u" ("s" "public"."status" NOT NULL DEFAULT \'c\');'],
    ['ALTER TABLE "t" ADD CONSTRAINT "t_chk" CHECK ("s" <> \'c\');'],
    ['UPDATE "t" SET "s" = \'c\';'],
    ['ALTER TABLE "t" ALTER COLUMN "s" SET DEFAULT \'x\'::status;'],
  ];
  for (const later of dependents) {
    const hazards = enumAdditionHazards([ADD_C, ...later]);
    assert.equal(hazards.length, 1, later.join());
    assert.deepEqual(hazards[0].dependents, later.map((statement) => statement.replace(/\s+/g, " ")));
  }
  // order matters: a statement BEFORE the addition cannot depend on it
  assert.deepEqual(enumAdditionHazards(['ALTER TABLE "t" ALTER COLUMN "s" SET DEFAULT \'a\';', ADD_C]), []);
  // unrelated statements after the addition are not dependents
  assert.deepEqual(enumAdditionHazards([ADD_C, 'ALTER TABLE "t" ADD COLUMN "z" text DEFAULT \'d\';']).length, 0);
});

test("enum additions in other spellings (IF NOT EXISTS, BEFORE/AFTER, unqualified, odd value) are read; unreadable ones fail closed", () => {
  assert.equal(enumAdditionHazards(["ALTER TYPE status ADD VALUE IF NOT EXISTS 'c' AFTER 'a';", 'SELECT 1 WHERE x = \'c\';']).length, 1);
  assert.equal(enumAdditionHazards(['ALTER TYPE "my status" ADD VALUE \'it\'\'s\';', 'ALTER TABLE t ALTER COLUMN s SET DEFAULT \'it\'\'s\';']).length, 1);
  assert.equal(enumAdditionHazards(["ALTER TYPE status ADD VALUE some_word;", "ALTER TABLE t ADD COLUMN y int;"]).length, 1, "unreadable value: every later statement is a dependent");
});

test("the classifier still reviews dangerous SQL in a plan that contains an enum addition", () => {
  assert.deepEqual(kinds([ADD_C, 'DROP TABLE "x" CASCADE;', 'ALTER TABLE "o" DISABLE ROW LEVEL SECURITY;']), ["drop_table", "rls_disabled"]);
  assert.deepEqual(kinds([ADD_C]), []);
});
