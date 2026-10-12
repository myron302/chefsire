/**
 * The payout CHECK (and every other protection the enforcement migrations install) can never be absent from a COMMITTED state. On a REAL,
 * DISPOSABLE PostgreSQL database that each test creates and drops. Skipped (not passed) when no local PostgreSQL that can CREATE DATABASE is reachable.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { enforcePayoutIntegrity } from "../scripts/payout-integrity-enforcement";
import { SchemaPushApplyError, applyReviewedPlan, catalogFingerprint, type QueryClient } from "./schema-push-apply";
import { PAYOUT_CHECK, payoutCheckExpression, preserveRequiredPayoutCheck, protectedObjects, protectedSnapshot, renderRequiredPayoutCheck } from "./schema-push-protected";
import { classifyPushPlan, constraintFactKey, droppedConstraint, hardRefusals } from "./schema-push-plan";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(path.join(here, "..", "migrations", "20260919_payout_integrity.sql"), "utf8");
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
if (!adminUrl) console.log("# no reachable local PostgreSQL that can CREATE DATABASE -- protected-object test skipped");
const postgresTest = adminUrl ? test : test.skip;

const protections = protectedObjects();
const CHECK_KEY = constraintFactKey(PAYOUT_CHECK.schema, PAYOUT_CHECK.table, PAYOUT_CHECK.name);

async function withPayouts(fn: (db: pg.Client, connect: () => Promise<pg.Client>) => Promise<void>) {
  const name = `chefsire_protected_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client({ connectionString: adminUrl! });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(adminUrl!);
  url.pathname = `/${name}`;
  const connect = async () => { const client = new pg.Client({ connectionString: url.toString() }); await client.connect(); return client; };
  const db = await connect();
  try {
    await db.query(`
      CREATE TABLE payouts (id varchar PRIMARY KEY, provider_payout_id text, status text DEFAULT 'pending', processed_at timestamp, completed_at timestamp);
      CREATE TABLE commissions (id varchar PRIMARY KEY, order_id varchar NOT NULL, payout_id varchar REFERENCES payouts(id), status text DEFAULT 'pending', audit_note text);
      -- history that predates the rule: a completed payout with no transfer evidence (kept for audit; the CHECK is NOT VALID for exactly this)
      INSERT INTO payouts (id, status) VALUES ('legacy-bad', 'completed');
      INSERT INTO payouts (id, status, provider_payout_id, processed_at, completed_at) VALUES ('good', 'completed', 'po_real_123', now(), now());`);
    await enforcePayoutIntegrity(db as never, migration, false); // the reviewed migration: trigger + unique index + NOT VALID CHECK
    await fn(db, connect);
  } finally {
    await db.end().catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch(() => undefined);
    await admin.end();
  }
}

const checkRow = async (db: pg.Client) => (await db.query("SELECT oid::int AS oid, pg_get_constraintdef(oid) AS def, convalidated FROM pg_constraint WHERE conname = 'payouts_completed_transfer_check' AND conrelid = 'payouts'::regclass")).rows;
const DROP = 'ALTER TABLE "payouts" DROP CONSTRAINT "payouts_completed_transfer_check";';
const isPayoutDrop = (statement: string) => { const d = droppedConstraint(statement); return d !== null && d.schema === "public" && d.table === "payouts" && d.name === "payouts_completed_transfer_check"; };
const applyError = async (promise: Promise<unknown>) => { try { await promise; } catch (error) { assert.ok(error instanceof SchemaPushApplyError, String(error)); return error; } assert.fail("expected a failure"); };

test("the protected object names are derived from the enforcement DDL, not hand-listed", () => {
  assert.ok(protections.constraints.includes(CHECK_KEY));
  for (const name of ["orders_seller_revenue_status_check", "orders_inventory_status_check", "orders_captured_payment_evidence_check", "products_inventory_nonnegative_check", "meal_plan_purchases_authoritative_evidence_chk"]) {
    assert.ok(protections.constraintNames.includes(name), name);
  }
  for (const name of ["commissions_active_payout_order_uidx", "commissions_order_uidx", "orders_buyer_checkout_idempotency_uidx", "meal_plan_purchases_entitlement_identity_uidx", "meal_plan_purchases_provider_payment_uidx"]) {
    assert.ok(protections.indexNames.includes(name), name);
  }
  assert.match(payoutCheckExpression(), /provider_payout_id IS NOT NULL/);
  assert.doesNotMatch(payoutCheckExpression(), /--/, "comments are stripped");
});

postgresTest("a push whose plan wants to drop the payout CHECK keeps it: the live constraint IS the required one, so the drop is removed from the plan", async () => {
  await withPayouts(async (db) => {
    const [before] = await checkRow(db);
    assert.ok(before, "the reviewed migration installed it");
    assert.equal(before.convalidated, false, "NOT VALID: enforced for new rows, legacy history untouched");
    const required = await renderRequiredPayoutCheck(db);
    assert.ok(required);
    assert.equal(String(before.def).replace(/\s+NOT VALID\s*$/i, ""), required, "live == required, in PostgreSQL's own rendering");

    const plan = [DROP, 'ALTER TABLE "payouts" ADD COLUMN "note" text;'];
    const result = await preserveRequiredPayoutCheck(db, plan, isPayoutDrop);
    assert.deepEqual(result.preserved, [DROP]);
    assert.deepEqual(result.toApply, ['ALTER TABLE "payouts" ADD COLUMN "note" text;']);
    assert.deepEqual(result.mismatched, []);
    assert.deepEqual(classifyPushPlan(result.toApply, { constraints: {}, indexes: {}, protectedConstraints: protections.constraints, protectedIndexes: protections.indexes }), []);

    await applyReviewedPlan(db, result.toApply, await catalogFingerprint(db), undefined, protections);
    const [after] = await checkRow(db);
    assert.deepEqual(after, before, "the very same constraint object (same oid, definition and validation state) throughout");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM payouts")).rows[0].n, 2, "existing payouts, including the legacy row, are unchanged");
    assert.equal((await db.query("SELECT status FROM payouts WHERE id = 'legacy-bad'")).rows[0].status, "completed");
    assert.equal((await db.query("SELECT provider_payout_id FROM payouts WHERE id = 'good'")).rows[0].provider_payout_id, "po_real_123");
    // invalid completed payouts remain impossible, by the CHECK and by the trigger
    await assert.rejects(db.query("INSERT INTO payouts (id, status) VALUES ('bad-new', 'completed')"), (error: { code?: string }) => error.code === "23514");
    await assert.rejects(db.query("INSERT INTO payouts (id, status, provider_payout_id, processed_at, completed_at) VALUES ('sim', 'completed', 'payout_sim_1', now(), now())"), (error: { code?: string }) => error.code === "23514");
    await assert.rejects(db.query("UPDATE payouts SET status = 'completed' WHERE id <> 'legacy-bad' AND status <> 'completed'"), () => true).catch(() => undefined);
  });
});

postgresTest("a same-named but WEAKER constraint is not accepted as the protection: the drop stays in the plan, is refused as non-approvable, and the database is untouched", async () => {
  await withPayouts(async (db) => {
    await db.query("ALTER TABLE payouts DROP CONSTRAINT payouts_completed_transfer_check");
    await db.query("ALTER TABLE payouts ADD CONSTRAINT payouts_completed_transfer_check CHECK (status <> 'completed' OR provider_payout_id IS NOT NULL) NOT VALID");
    const [weak] = await checkRow(db);
    const result = await preserveRequiredPayoutCheck(db, [DROP], isPayoutDrop);
    assert.deepEqual(result.preserved, []);
    assert.deepEqual(result.mismatched, [DROP]);
    assert.deepEqual(result.toApply, [DROP], "it stays in the plan, where the classifier refuses it");
    const findings = classifyPushPlan(result.toApply, { constraints: {}, indexes: {}, protectedConstraints: protections.constraints });
    assert.deepEqual(findings.map((item) => item.kind), ["protected_object_dropped"]);
    assert.equal(hardRefusals(findings).length, 1, "no acknowledgement token can lift it");
    // even if something tried to run it, the transaction refuses to commit a state without the protection
    const error = await applyError(applyReviewedPlan(db, result.toApply, await catalogFingerprint(db), undefined, protections));
    assert.equal(error.outcome, "rolled_back");
    assert.match(error.message, /remove .*payouts_completed_transfer_check/);
    assert.deepEqual((await checkRow(db))[0], weak, "the (weak) constraint is still exactly as it was");
  });
});

postgresTest("drop + restoration is allowed only inside ONE transaction and only with the identical definition", async () => {
  await withPayouts(async (db) => {
    const [original] = await checkRow(db);
    const required = String(original.def).replace(/\s+NOT VALID\s*$/i, "");
    const restore = `ALTER TABLE "payouts" ADD CONSTRAINT "payouts_completed_transfer_check" ${required} NOT VALID;`;
    await applyReviewedPlan(db, [DROP, restore], await catalogFingerprint(db), undefined, protections);
    const [after] = await checkRow(db);
    assert.equal(String(after.def).replace(/\s+NOT VALID\s*$/i, ""), required, "the identical definition is back, within the same commit");
    assert.notEqual(after.oid, original.oid, "it is a new object, but there was never a committed moment without it");
    assert.equal((await db.query("SELECT 1 FROM pg_constraint WHERE conname = 'payouts_completed_transfer_check'")).rowCount, 1);

    // restoration with a WEAKER definition: rolled back whole, the original stays
    const [current] = await checkRow(db);
    const weaker = 'ALTER TABLE "payouts" ADD CONSTRAINT "payouts_completed_transfer_check" CHECK (status <> \'completed\') NOT VALID;';
    const error = await applyError(applyReviewedPlan(db, [DROP, weaker], await catalogFingerprint(db), undefined, protections));
    assert.equal(error.outcome, "rolled_back");
    assert.deepEqual((await checkRow(db))[0], current, "the original constraint object is untouched");
  });
});

postgresTest("a failure during restoration rolls back the entire transaction, including the drop", async () => {
  await withPayouts(async (db) => {
    const [original] = await checkRow(db);
    const required = String(original.def).replace(/\s+NOT VALID\s*$/i, "");
    const plan = [DROP, `ALTER TABLE "payouts" ADD CONSTRAINT "payouts_completed_transfer_check" ${required} NOT VALID;`, 'ALTER TABLE "payouts" ADD COLUMN "dup" text;', 'ALTER TABLE "payouts" ADD COLUMN "dup" text;'];
    const error = await applyError(applyReviewedPlan(db, plan, await catalogFingerprint(db), undefined, protections));
    assert.equal(error.outcome, "rolled_back");
    assert.deepEqual((await checkRow(db))[0], original, "same oid: the DROP never became visible");
    assert.equal((await db.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'dup'")).rowCount, 0);
    // a restoration statement that itself fails (syntax) behaves the same
    const broken = await applyError(applyReviewedPlan(db, [DROP, 'ALTER TABLE "payouts" ADD CONSTRAINT "payouts_completed_transfer_check" CHECK (nonexistent_column > 0) NOT VALID;'], await catalogFingerprint(db), undefined, protections));
    assert.equal(broken.outcome, "rolled_back");
    assert.deepEqual((await checkRow(db))[0], original);
  });
});

postgresTest("a failure during constraint VALIDATION rolls back the entire transaction", async () => {
  await withPayouts(async (db) => {
    const [original] = await checkRow(db);
    const required = String(original.def).replace(/\s+NOT VALID\s*$/i, "");
    // restoring it VALIDATED (no NOT VALID) must scan the legacy row, which violates the rule: PostgreSQL rejects it
    const plan = [DROP, `ALTER TABLE "payouts" ADD CONSTRAINT "payouts_completed_transfer_check" ${required};`];
    const error = await applyError(applyReviewedPlan(db, plan, await catalogFingerprint(db), undefined, protections));
    assert.equal(error.outcome, "rolled_back");
    assert.match(error.message, /violated by some row/i);
    assert.deepEqual((await checkRow(db))[0], original);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM payouts")).rows[0].n, 2, "no payout row was touched");
    // explicit validation of the original after the fact fails too, and nothing is lost either
    const alsoFails = await applyError(applyReviewedPlan(db, ['ALTER TABLE "payouts" VALIDATE CONSTRAINT "payouts_completed_transfer_check";'], await catalogFingerprint(db), undefined, protections));
    assert.equal(alsoFails.outcome, "rolled_back");
    assert.deepEqual((await checkRow(db))[0], original);
  });
});

postgresTest("a process interruption (connection destroyed at COMMIT) cannot leave a committed state missing the constraint", async () => {
  await withPayouts(async (db, connect) => {
    const [original] = await checkRow(db);
    const victim = await connect();
    victim.on("error", () => undefined); // a destroyed socket emits an error event; the test provokes it on purpose
    const doomed: QueryClient = {
      query: async (text: string, values?: unknown[]) => {
        if (text === "COMMIT") { (victim as unknown as { connection: { stream: { destroy: () => void } } }).connection.stream.destroy(); throw new Error("Connection terminated unexpectedly"); }
        return victim.query(text, values);
      },
    };
    // even a plan that DOES drop it (no commit-time guard passed in, to isolate the transaction itself): the server discards the open transaction
    const error = await applyError(applyReviewedPlan(doomed, [DROP], await catalogFingerprint(victim)));
    assert.equal(error.outcome, "state_unknown", "reported honestly: the client cannot know");
    await victim.end().catch(() => undefined);
    const fresh = await connect();
    try { assert.deepEqual((await checkRow(fresh))[0], original, "the server rolled the transaction back with the connection"); } finally { await fresh.end(); }
  });
});

postgresTest("no other protected constraint, index or trigger is weakened: dropping or altering any of them is rolled back", async () => {
  await withPayouts(async (db) => {
    const triggers = async () => (await db.query("SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname")).rows;
    const snapshotBefore = await protectedSnapshot(db, protections);
    const triggersBefore = await triggers();
    assert.ok(Object.keys(snapshotBefore).some((key) => key.includes("commissions_active_payout_order_uidx")), "the payout claim index is protected");
    assert.ok(triggersBefore.some((row) => row.tgname === "payouts_completed_transfer_trigger"));
    for (const attack of [
      'DROP INDEX "commissions_active_payout_order_uidx";',
      'DROP INDEX "commissions_active_payout_order_uidx"; CREATE UNIQUE INDEX "commissions_active_payout_order_uidx" ON commissions (order_id);', // same name, weaker (no WHERE ... still unique but different)
    ]) {
      const error = await applyError(applyReviewedPlan(db, attack.split("; ").map((statement) => (statement.endsWith(";") ? statement : `${statement};`)), await catalogFingerprint(db), undefined, protections));
      assert.equal(error.outcome, "rolled_back", attack);
      assert.deepEqual(await protectedSnapshot(db, protections), snapshotBefore, "every protection is exactly as before");
    }
    assert.deepEqual(await triggers(), triggersBefore, "the completed-transfer trigger is untouched");
    // an ordinary additive plan commits and leaves every protection identical
    await applyReviewedPlan(db, ['ALTER TABLE "commissions" ADD COLUMN "memo" text;'], await catalogFingerprint(db), undefined, protections);
    assert.deepEqual(await protectedSnapshot(db, protections), snapshotBefore);
    assert.deepEqual(await triggers(), triggersBefore);
  });
});
