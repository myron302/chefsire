/**
 * The pure half of the schema-push guard: plan parsing and classification. No database, no drizzle-kit process.
 * The end-to-end behaviour on a real PostgreSQL is in server/scripts/schema-push-safety.postgres.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SchemaPlanParseError,
  classifyPushPlan,
  isDisposableTestDatabase,
  parsePushPlan,
  planAcknowledgementToken,
  splitSqlStatements,
} from "./schema-push-plan";

const wrap = (body: string) => ` Warning  You are about to execute current statements:\n\n${body}\n\n❯ No, abort\n  Yes, I want to execute all statements\n`;
const kinds = (statements: string[]) => classifyPushPlan(statements).map((finding) => finding.kind);

test("every destructive statement drizzle-kit can plan is flagged", () => {
  assert.deepEqual(kinds(['DROP TABLE "households" CASCADE;']), ["drop_table"]);
  assert.deepEqual(kinds(['ALTER TABLE "users" DROP COLUMN "email";']), ["drop_column"]);
  assert.deepEqual(kinds(['DROP TYPE "public"."status";']), ["drop_type"]);
  assert.deepEqual(kinds(['DROP SEQUENCE "public"."x_seq";']), ["drop_sequence"]);
  assert.deepEqual(kinds(['DROP SCHEMA "other" CASCADE;']), ["drop_schema"]);
  assert.deepEqual(kinds(['DROP VIEW "v";']), ["drop_view"]);
  assert.deepEqual(kinds(['DROP MATERIALIZED VIEW "v";']), ["drop_view"]);
  assert.deepEqual(kinds(['TRUNCATE TABLE "orders" CASCADE;']), ["truncate"]);
  assert.deepEqual(kinds(['DELETE FROM "orders";']), ["delete_rows"]);
  assert.deepEqual(kinds(['ALTER TABLE "orders" ALTER COLUMN "total_amount" SET DATA TYPE integer;']), ["column_type_change"]);
});

test("additive and in-place statements are not flagged", () => {
  assert.deepEqual(kinds([
    'CREATE TABLE "t" (\n\t"id" serial PRIMARY KEY NOT NULL\n);',
    'ALTER TABLE "t" ADD COLUMN "c" text;',
    'ALTER TABLE "t" ALTER COLUMN "c" SET DEFAULT \'{}\'::text[];',
    'ALTER TABLE "t" ALTER COLUMN "c" SET NOT NULL;',
    'CREATE INDEX "t_c_idx" ON "t" USING btree ("c");',
    'ALTER TABLE "t" ADD CONSTRAINT "t_c_unique" UNIQUE("c");',
    'ALTER TABLE "t" DISABLE ROW LEVEL SECURITY;',
  ]), []);
});

test("drop + re-add of the same constraint or index under its untruncated name is churn; an unmatched drop is a removed protection", () => {
  const longName = "catering_booking_access_details_booking_id_catering_bookings_id";
  assert.deepEqual(kinds([
    `ALTER TABLE "catering_booking_access_details" DROP CONSTRAINT "${longName}";`,
    `ALTER TABLE "catering_booking_access_details" ADD CONSTRAINT "${longName}_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."catering_bookings"("id");`,
    'DROP INDEX "creator_campaign_rollout_timeline_events_campaign_occurred_at_i";',
    'CREATE INDEX "creator_campaign_rollout_timeline_events_campaign_occurred_at_idx" ON "x" USING btree ("campaign_id");',
  ]), []);
  assert.deepEqual(kinds(['ALTER TABLE "orders" DROP CONSTRAINT "orders_amount_positive_check";']), ["drop_constraint_unpaired"]);
  assert.deepEqual(kinds(['DROP INDEX "orders_one_capture_per_key";']), ["drop_index_unpaired"]);
  // a re-add on a DIFFERENT table does not excuse the drop
  assert.deepEqual(kinds([
    'ALTER TABLE "orders" DROP CONSTRAINT "orders_amount_positive_check";',
    'ALTER TABLE "payouts" ADD CONSTRAINT "orders_amount_positive_check" CHECK (a > 0);',
  ]), ["drop_constraint_unpaired"]);
});

test("the one CHECK that push-schema.ts reasserts after every push is allowed to drift-drop; no other CHECK is", () => {
  assert.deepEqual(kinds(['ALTER TABLE "payouts" DROP CONSTRAINT "payouts_completed_transfer_check";']), []);
  assert.deepEqual(kinds(['ALTER TABLE "payouts" DROP CONSTRAINT "payouts_amount_check";']), ["drop_constraint_unpaired"]);
});

test("the acknowledgement token names exactly one set of dangerous statements", () => {
  const a = classifyPushPlan(['DROP TABLE "a" CASCADE;']);
  const b = classifyPushPlan(['DROP TABLE "b" CASCADE;']);
  assert.equal(planAcknowledgementToken(a), planAcknowledgementToken(classifyPushPlan(['DROP TABLE   "a"   CASCADE;'])));
  assert.notEqual(planAcknowledgementToken(a), planAcknowledgementToken(b));
  assert.notEqual(planAcknowledgementToken(a), planAcknowledgementToken([...a, ...b]));
  assert.match(planAcknowledgementToken(a), /^[0-9a-f]{16}$/);
});

test("splitSqlStatements honours parentheses, quotes and dollar quoting", () => {
  assert.deepEqual(splitSqlStatements(`CREATE TABLE "t" (\n "a" text DEFAULT 'x;y',\n "b" int\n);\nDROP TABLE "u" CASCADE;`), [
    `CREATE TABLE "t" (\n "a" text DEFAULT 'x;y',\n "b" int\n);`, 'DROP TABLE "u" CASCADE;',
  ]);
  assert.deepEqual(splitSqlStatements("DO $$ BEGIN PERFORM 1; END $$;\nSELECT 2;"), ["DO $$ BEGIN PERFORM 1; END $$;", "SELECT 2;"]);
  assert.throws(() => splitSqlStatements("SELECT 'open;"), SchemaPlanParseError);
  assert.throws(() => splitSqlStatements("SELECT 1"), SchemaPlanParseError);
});

test("parsePushPlan reads drizzle-kit's verbose strict output and never mistakes an unreadable plan for an empty one", () => {
  const output = `No config path provided\n[\u001b[32m✓\u001b[39m] Pulling schema from database...\n${wrap('ALTER TABLE "t" ADD COLUMN "c" text;\nDROP TABLE "u" CASCADE;')}`;
  assert.deepEqual(parsePushPlan(output), ['ALTER TABLE "t" ADD COLUMN "c" text;', 'DROP TABLE "u" CASCADE;']);
  assert.deepEqual(parsePushPlan("[i] No changes detected"), []);
  assert.throws(() => parsePushPlan("something unexpected"), SchemaPlanParseError, "neither a plan nor 'no changes' => refuse");
  assert.throws(() => parsePushPlan(" Warning  You are about to execute current statements:\n\nDROP TABLE \"u\" CASCADE;\n"), SchemaPlanParseError, "no approval prompt => possibly truncated");
  assert.throws(() => parsePushPlan(wrap("this is not sql;")), SchemaPlanParseError);
});

test("only loopback databases named *test* are disposable", () => {
  assert.equal(isDisposableTestDatabase("postgres://u@localhost:5432/chefsire_test_1"), true);
  assert.equal(isDisposableTestDatabase("postgres://u@127.0.0.1/my_TEST_db"), true);
  assert.equal(isDisposableTestDatabase("postgres:///chefsire_test?host=/var/run/postgresql"), true);
  assert.equal(isDisposableTestDatabase("postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require"), false);
  assert.equal(isDisposableTestDatabase("postgres://u:p@ep-test-123.neon.tech/neondb_test"), false, "a remote host is never disposable");
  assert.equal(isDisposableTestDatabase("postgres://u@localhost/chefsire"), false);
  assert.equal(isDisposableTestDatabase("not a url"), false);
});
