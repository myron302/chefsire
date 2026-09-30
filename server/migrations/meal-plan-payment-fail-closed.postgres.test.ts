import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { enforceMealPlanPaymentIntegrity, MealPlanPaymentIntegrityConflictError } from "../scripts/meal-plan-payment-enforcement";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "20260928_meal_plan_payment_fail_closed.sql"), "utf8");
const candidates = [
  process.env.TEST_DATABASE_URL,
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
    } catch { /* only isolated/local candidates are attempted */ }
  }
  return null;
}

const connectionString = await firstReachable();
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# no reachable isolated PostgreSQL -- meal-plan payment migration tests skipped");

const SCHEMA_SQL = `
  CREATE TABLE meal_plan_blueprints (
    id text PRIMARY KEY, creator_id text NOT NULL, sales_count integer NOT NULL DEFAULT 0, status text NOT NULL, price_in_cents integer NOT NULL
  );
  CREATE TABLE meal_plan_purchases (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id text NOT NULL, blueprint_id text NOT NULL,
    price_paid_cents integer NOT NULL,
    payment_status text NOT NULL DEFAULT 'completed',
    payment_method text, transaction_id text,
    acquisition_type text NOT NULL DEFAULT 'legacy_unverified',
    payment_provider text, provider_payment_id text, provider_payment_status text,
    payment_verified_at timestamptz,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE creator_analytics (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id text NOT NULL, date text NOT NULL,
    total_sales integer NOT NULL DEFAULT 0,
    total_revenue_cents integer NOT NULL DEFAULT 0,
    updated_at timestamp NOT NULL DEFAULT now()
  );
  INSERT INTO meal_plan_blueprints VALUES ('plan', 'creator', 7, 'published', 0);
  INSERT INTO creator_analytics (id, creator_id, date, total_sales, total_revenue_cents)
    VALUES ('daily', 'creator', CURRENT_DATE::text, 7, 17500);
`;

const PAID_COLUMNS = `(id, user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type,
  payment_provider, provider_payment_id, provider_payment_status, payment_verified_at)`;
const paidRow = (id: string, user: string, provider: string | null, paymentId: string | null, status = "verified_paid", blueprint = "plan") =>
  `INSERT INTO meal_plan_purchases ${PAID_COLUMNS} VALUES ('${id}', '${user}', '${blueprint}', 2500, '${status}', 'paid',
    ${provider ? `'${provider}'` : "NULL"}, ${paymentId ? `'${paymentId}'` : "NULL"}, 'COMPLETED', now())`;
const freeRow = (id: string, user: string, blueprint = "plan") =>
  `INSERT INTO meal_plan_purchases (id, user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type)
    VALUES ('${id}', '${user}', '${blueprint}', 0, 'free_acquired', 'free')`;

async function withSchema(body: (client: pg.Client) => Promise<void>) {
  const client = new pg.Client({ connectionString: connectionString! });
  const namespace = `meal_plan_payment_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  try {
    await client.connect();
    await client.query(`CREATE SCHEMA ${namespace}`);
    await client.query(`SET search_path TO ${namespace}`);
    await client.query(SCHEMA_SQL);
    await body(client);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.query("RESET search_path").catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

const analytics = async (client: pg.Client) => ({
  sales: (await client.query(`SELECT sales_count FROM meal_plan_blueprints WHERE id='plan'`)).rows[0].sales_count,
  daily: (await client.query(`SELECT total_sales, total_revenue_cents FROM creator_analytics WHERE id='daily'`)).rows[0],
});
const status = async (client: pg.Client, id: string) =>
  (await client.query(`SELECT payment_status FROM meal_plan_purchases WHERE id='${id}'`)).rows[0]?.payment_status;
const indexNames = async (client: pg.Client) =>
  (await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname LIKE 'meal_plan_purchases_%_uidx' ORDER BY indexname`)).rows.map((r) => r.indexname);
const snapshot = async (client: pg.Client) =>
  (await client.query(`SELECT * FROM meal_plan_purchases ORDER BY id`)).rows;

postgresTest("A. authoritative verified_paid stays paid and counts exactly one sale at its price", async () => {
  await withSchema(async (client) => {
    await client.query(paidRow("paid", "buyer", "square", "pay-1"));
    // Pre-migration state: enforcement first, as db:push does.
    await enforceMealPlanPaymentIntegrity(client, true);
    assert.equal(await status(client, "paid"), "verified_paid");
    await client.query(migration);
    assert.equal(await status(client, "paid"), "verified_paid");
    assert.equal((await analytics(client)).sales, 1);
    assert.deepEqual((await analytics(client)).daily, { total_sales: 1, total_revenue_cents: 2500 });
  });
});

postgresTest("B. historical simulated purchase becomes legacy_unverified with no sales or revenue", async () => {
  await withSchema(async (client) => {
    await client.query(`INSERT INTO meal_plan_purchases (id, user_id, blueprint_id, price_paid_cents, payment_status, transaction_id)
      VALUES ('legacy', 'buyer', 'plan', 2500, 'completed', 'sim_old')`);
    await enforceMealPlanPaymentIntegrity(client, true);
    assert.equal(await status(client, "legacy"), "legacy_unverified");
    await client.query(migration);
    assert.equal(await status(client, "legacy"), "legacy_unverified");
    assert.equal((await analytics(client)).sales, 0);
    assert.deepEqual((await analytics(client)).daily, { total_sales: 0, total_revenue_cents: 0 });
    await assert.rejects(
      client.query(`INSERT INTO meal_plan_purchases (user_id, blueprint_id, price_paid_cents, payment_status) VALUES ('stale', 'plan', 2500, 'completed')`),
      /meal_plan_purchases_authoritative_evidence_chk/,
    );
    await assert.rejects(
      client.query(`UPDATE meal_plan_purchases SET payment_status='verified_paid', acquisition_type='paid' WHERE id='legacy'`),
      /meal_plan_purchases_authoritative_evidence_chk/,
    );
  });
});

postgresTest("C. free_acquired stays free with no provider evidence, sales, or revenue; free inserts are idempotent", async () => {
  await withSchema(async (client) => {
    await client.query(freeRow("free", "free-user"));
    await enforceMealPlanPaymentIntegrity(client, true);
    await client.query(migration);
    const row = (await client.query(`SELECT * FROM meal_plan_purchases WHERE id='free'`)).rows[0];
    assert.equal(row.payment_status, "free_acquired");
    assert.equal(row.acquisition_type, "free");
    assert.equal(row.payment_provider, null);
    assert.equal(row.provider_payment_id, null);
    assert.equal(row.provider_payment_status, null);
    assert.equal(row.payment_verified_at, null);
    assert.equal(row.transaction_id, null);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await client.query(`INSERT INTO meal_plan_purchases
        (user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type)
        VALUES ('free-user', 'plan', 0, 'free_acquired', 'free') ON CONFLICT DO NOTHING`);
    }
    assert.equal((await client.query(`SELECT COUNT(*)::int AS count FROM meal_plan_purchases WHERE user_id='free-user'`)).rows[0].count, 1);
    assert.equal((await analytics(client)).sales, 0);
    assert.deepEqual((await analytics(client)).daily, { total_sales: 0, total_revenue_cents: 0 });
  });
});

postgresTest("healthy enforcement is idempotent and leaves valid rows byte-identical", async () => {
  await withSchema(async (client) => {
    await client.query(paidRow("paid", "u1", "square", "pay-1"));
    await client.query(freeRow("free", "u2"));
    await enforceMealPlanPaymentIntegrity(client, true);
    const first = await snapshot(client);
    await enforceMealPlanPaymentIntegrity(client, true);
    await enforceMealPlanPaymentIntegrity(client, false);
    assert.deepEqual(await snapshot(client), first);
    assert.deepEqual(await indexNames(client), [
      "meal_plan_purchases_entitlement_identity_uidx",
      "meal_plan_purchases_provider_payment_uidx",
    ]);
    // Drift (missing index) is restored.
    await client.query(`DROP INDEX meal_plan_purchases_provider_payment_uidx`);
    await enforceMealPlanPaymentIntegrity(client, true);
    assert.equal((await indexNames(client)).length, 2);
  });
});

postgresTest("malformed trusted rows normalize before conflict detection and do not conflict", async () => {
  await withSchema(async (client) => {
    await client.query(paidRow("good", "u1", "square", "pay-good"));
    // Claims verified_paid but lacks provider evidence, so it is malformed.
    await client.query(`INSERT INTO meal_plan_purchases (id, user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type)
      VALUES ('bad', 'u1', 'plan', 2500, 'verified_paid', 'paid')`);
    await client.query(`INSERT INTO meal_plan_purchases (id, user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type)
      VALUES ('bad-free', 'u1', 'plan', 100, 'free_acquired', 'free')`);
    await enforceMealPlanPaymentIntegrity(client, true);
    assert.equal(await status(client, "good"), "verified_paid");
    assert.equal(await status(client, "bad"), "legacy_unverified");
    assert.equal(await status(client, "bad-free"), "legacy_unverified");
  });
});

for (const [name, statements, pattern] of [
  ["two verified_paid rows for one user/blueprint", [paidRow("a", "u1", "square", "pay-a"), paidRow("b", "u1", "square", "pay-b")], /user_id=u1 blueprint_id=plan purchase_ids=\[a,b\]/],
  ["verified_paid plus free_acquired for one user/blueprint", [paidRow("a", "u1", "square", "pay-a"), freeRow("f", "u1")], /user_id=u1 blueprint_id=plan purchase_ids=\[a,f\]/],
  ["duplicate provider payment identity", [paidRow("a", "u1", "square", "same"), paidRow("b", "u2", "square", "same")], /payment_provider=square provider_payment_id=same purchase_ids=\[a,b\]/],
  ["duplicate provider identity on a legacy row", [paidRow("a", "u1", "square", "same"), paidRow("b", "u2", "square", "same", "legacy_unverified")], /payment_provider=square provider_payment_id=same purchase_ids=\[a,b\]/],
] as Array<[string, string[], RegExp]>) {
  postgresTest(`conflict fails closed and rolls back: ${name}`, async () => {
    await withSchema(async (client) => {
      for (const statement of statements) {
        // The legacy row is inserted with a legacy shape so the CHECK (if present) is not involved pre-enforcement.
        await client.query(statement.includes("'legacy_unverified'") ? statement.replace("'paid'", "'legacy_unverified'") : statement);
      }
      const before = await snapshot(client);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await assert.rejects(enforceMealPlanPaymentIntegrity(client, true), (error: Error) => {
          assert.ok(error instanceof MealPlanPaymentIntegrityConflictError);
          assert.match(error.message, pattern);
          return true;
        });
        // Transaction is closed and nothing was created or changed.
        assert.deepEqual(await indexNames(client), []);
        assert.deepEqual(await snapshot(client), before);
        assert.equal((await client.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname='meal_plan_purchases_authoritative_evidence_chk'`)).rows[0].n, 0);
      }
    });
  });
}

postgresTest("conflict rollback also undoes normalization done earlier in the same transaction", async () => {
  await withSchema(async (client) => {
    await client.query(`INSERT INTO meal_plan_purchases (id, user_id, blueprint_id, price_paid_cents, payment_status, transaction_id)
      VALUES ('legacy', 'x', 'plan', 2500, 'completed', 'sim')`);
    await client.query(paidRow("a", "u1", "square", "pay-a"));
    await client.query(paidRow("b", "u1", "square", "pay-b"));
    await assert.rejects(enforceMealPlanPaymentIntegrity(client, true), MealPlanPaymentIntegrityConflictError);
    assert.equal(await status(client, "legacy"), "completed");
  });
});

postgresTest("same provider_payment_id under different providers and NULL provider identities do not conflict", async () => {
  await withSchema(async (client) => {
    await client.query(paidRow("a", "u1", "square", "shared"));
    await client.query(paidRow("b", "u2", "stripe", "shared"));
    await client.query(`INSERT INTO meal_plan_purchases (id, user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type)
      VALUES ('n1', 'u3', 'plan', 0, 'pending', 'legacy_unverified'), ('n2', 'u4', 'plan', 0, 'pending', 'legacy_unverified')`);
    await enforceMealPlanPaymentIntegrity(client, true);
    // NULL provider with duplicated non-null payment id: NULLs are distinct in the unique index.
    await client.query(`INSERT INTO meal_plan_purchases (id, user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type, provider_payment_id)
      VALUES ('n3', 'u5', 'plan', 0, 'pending', 'legacy_unverified', 'dup'), ('n4', 'u6', 'plan', 0, 'pending', 'legacy_unverified', 'dup')`);
    await enforceMealPlanPaymentIntegrity(client, true);
    assert.equal(await status(client, "a"), "verified_paid");
    assert.equal(await status(client, "b"), "verified_paid");
  });
});

postgresTest("duplicate legacy rows for one user/blueprint are preserved and do not conflict", async () => {
  await withSchema(async (client) => {
    await client.query(`INSERT INTO meal_plan_purchases (id, user_id, blueprint_id, price_paid_cents, payment_status, transaction_id) VALUES
      ('l1', 'u1', 'plan', 2500, 'completed', 'sim1'), ('l2', 'u1', 'plan', 2500, 'completed', 'sim2')`);
    await enforceMealPlanPaymentIntegrity(client, true);
    assert.equal(await status(client, "l1"), "legacy_unverified");
    assert.equal(await status(client, "l2"), "legacy_unverified");
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM meal_plan_purchases`)).rows[0].n, 2);
  });
});

postgresTest("fresh --allow-missing bootstrap is a no-op and explicit stale completed writes stay rejected", async () => {
  const client = new pg.Client({ connectionString: connectionString! });
  const namespace = `meal_plan_payment_empty_${process.pid}_${Date.now()}`;
  try {
    await client.connect();
    await client.query(`CREATE SCHEMA ${namespace}`);
    await client.query(`SET search_path TO ${namespace}`);
    assert.deepEqual(await enforceMealPlanPaymentIntegrity(client, true), { purchases: false });
    await assert.rejects(enforceMealPlanPaymentIntegrity(client, false), /does not exist/);
  } finally {
    await client.query("RESET search_path").catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
  await withSchema(async (c) => {
    await enforceMealPlanPaymentIntegrity(c, true);
    await assert.rejects(
      c.query(`INSERT INTO meal_plan_purchases (user_id, blueprint_id, price_paid_cents, payment_status) VALUES ('stale', 'plan', 2500, 'completed')`),
      /meal_plan_purchases_authoritative_evidence_chk/,
    );
  });
});
