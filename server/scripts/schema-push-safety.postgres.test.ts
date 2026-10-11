/**
 * End-to-end schema-push safety on a REAL, DISPOSABLE PostgreSQL database: the real server/scripts/push-schema.ts (and so the real
 * drizzle-kit and the real enforcement scripts) against a database created for this test and dropped afterwards.
 *
 * Needs a reachable PostgreSQL where the role may CREATE DATABASE (TEST_DATABASE_URL, PGURL, or a local default); skipped otherwise.
 * It never touches any database it did not create. The throw-away database is deliberately NOT named "*test*", so the guard treats it like a
 * real database (a "*test*" loopback database acknowledges destructive plans implicitly).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
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
      const host = new URL(connectionString).hostname;
      if (rows[0]?.ok && ["localhost", "127.0.0.1", "::1", ""].includes(host)) return connectionString;
    } catch {
      /* try the next conventional connection */
    }
  }
  return null;
}

const adminUrl = await reachableAdminUrl();
if (!adminUrl) console.log("# no reachable local PostgreSQL that can CREATE DATABASE -- schema-push safety test skipped");

function withDatabase(url: string, database: string): string {
  const next = new URL(url);
  next.pathname = `/${database}`;
  return next.toString();
}

function pushSchema(databaseUrl: string, args: string[] = []) {
  const result = spawnSync("npx", ["tsx", "server/scripts/push-schema.ts", ...args], {
    cwd: ROOT, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8", timeout: 280_000, input: "", maxBuffer: 64 * 1024 * 1024,
  });
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

async function catalog(client: pg.Client) {
  const constraints = await client.query("SELECT conrelid::regclass::text AS tbl, conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1, 2");
  const indexes = await client.query("SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2");
  const triggers = await client.query("SELECT tgrelid::regclass::text AS tbl, tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1, 2");
  return { constraints: constraints.rows, indexes: indexes.rows, triggers: triggers.rows };
}

const postgresTest = adminUrl ? test : test.skip;

postgresTest("push never drops undeclared tables, refuses destructive plans without an exact acknowledgement, and preserves every protection", { timeout: 1_200_000 }, async () => {
  const name = `chefsire_pushsafety_${process.pid}_${Date.now()}`;
  const admin = new pg.Client({ connectionString: adminUrl! });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  const databaseUrl = withDatabase(adminUrl!, name);
  const db = new pg.Client({ connectionString: databaseUrl });
  try {
    // 1. Fresh bootstrap through the real flow.
    const boot = pushSchema(databaseUrl);
    assert.equal(boot.status, 0, boot.output.slice(-2000));
    await db.connect();

    // 2. Real-world residue: undeclared tables holding evidence, a serial sequence, an append-only trigger, a migration ledger.
    await db.query(`
      CREATE TABLE _app_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO _app_migrations (filename) VALUES ('drizzle/0000_example.sql');
      CREATE TABLE legacy_credential_invalidations (user_id varchar PRIMARY KEY, email text NOT NULL, reason text NOT NULL, invalidated_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO legacy_credential_invalidations VALUES ('u-1', 'a@example.test', 'evidence', now());
      CREATE TABLE wedding_vendor_quotes (id BIGSERIAL PRIMARY KEY, note text);
      INSERT INTO wedding_vendor_quotes (note) VALUES ('keep me');
      CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only'; END $$;
      CREATE TRIGGER legacy_append_only BEFORE UPDATE OR DELETE ON legacy_credential_invalidations FOR EACH ROW EXECUTE FUNCTION forbid_change();
    `);
    const before = await catalog(db);

    // 3. Push again. Undeclared tables, their rows, the sequence, the trigger and every constraint and index must be exactly as they were.
    const second = pushSchema(databaseUrl);
    assert.equal(second.status, 0, second.output.slice(-2500));
    for (const [table, expected] of [["_app_migrations", 1], ["legacy_credential_invalidations", 1], ["wedding_vendor_quotes", 1]] as const) {
      const { rows } = await db.query(`SELECT count(*)::int AS n FROM ${table}`);
      assert.equal(rows[0].n, expected, `${table} rows survive`);
    }
    await db.query("INSERT INTO wedding_vendor_quotes (note) VALUES ('sequence still works')");
    await assert.rejects(db.query("DELETE FROM legacy_credential_invalidations"), /append-only/, "the append-only trigger survives");
    assert.deepEqual(await catalog(db), (() => ({ ...before }))(), "constraints, indexes and triggers are unchanged by a routine push");

    // 3b. Authorization boundaries. Row level security that exists in the database but not in the schema would be DISABLED by drizzle's plan.
    //     That must be refused, BEFORE any pre-push script runs, and must leave RLS and the policy exactly as they were.
    await db.query(`ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY; ALTER TABLE water_logs FORCE ROW LEVEL SECURITY;
                    CREATE POLICY water_owner ON water_logs USING (user_id = current_user)`);
    const rlsBefore = await catalog(db);
    const rlsRefused = pushSchema(databaseUrl);
    assert.equal(rlsRefused.status, 1, rlsRefused.output.slice(-1500));
    assert.match(rlsRefused.output, /\[rls_disabled\] ALTER TABLE "water_logs" DISABLE ROW LEVEL SECURITY/);
    assert.doesNotMatch(rlsRefused.output, /invariants verified/, "a refused push runs no pre-push script");
    const rls = async () => (await db.query("SELECT relrowsecurity, relforcerowsecurity, (SELECT count(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies FROM pg_class c WHERE relname = 'water_logs'")).rows[0];
    assert.deepEqual(await rls(), { relrowsecurity: true, relforcerowsecurity: true, policies: 1 }, "RLS and its policy are untouched by the refusal");
    assert.deepEqual(await catalog(db), rlsBefore);
    await db.query("DROP POLICY water_owner ON water_logs; ALTER TABLE water_logs NO FORCE ROW LEVEL SECURITY; ALTER TABLE water_logs DISABLE ROW LEVEL SECURITY");

    // 3c. A same-named replacement that is NOT the same protection is refused: a foreign key whose referential action drifted, and a UNIQUE
    //     index that the schema declares as a plain index (drizzle plans drop + create under one name).
    const { rows: fks } = await db.query("SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'meal_streaks'::regclass AND contype = 'f'");
    assert.equal(fks.length, 1);
    await db.query(`ALTER TABLE meal_streaks DROP CONSTRAINT "${fks[0].conname}"`);
    await db.query(`ALTER TABLE meal_streaks ADD CONSTRAINT "${fks[0].conname}" ${String(fks[0].def).replace(/ON UPDATE \w+( \w+)?/i, "").trim()} ON UPDATE CASCADE`);
    const idxName = "creator_campaign_rollout_timeline_events_campaign_occurred_at_i";
    const idxExists = (await db.query("SELECT 1 FROM pg_indexes WHERE indexname = $1", [idxName])).rowCount === 1;
    assert.equal(idxExists, true, "the schema's rollout-timeline index exists under its stored (truncated) name");
    await db.query(`DROP INDEX "${idxName}"; CREATE UNIQUE INDEX "${idxName}" ON creator_campaign_rollout_timeline_events (campaign_id, occurred_at)`);
    const weakBefore = await catalog(db);
    const weak = pushSchema(databaseUrl);
    assert.equal(weak.status, 1, weak.output.slice(-1500));
    assert.match(weak.output, /\[drop_constraint_unpaired\] ALTER TABLE "meal_streaks" DROP CONSTRAINT/);
    assert.match(weak.output, /\[drop_index_unpaired\] DROP INDEX/);
    assert.deepEqual(await catalog(db), weakBefore, "the refused push left every constraint and index exactly as they were");
    // restore the schema's own definitions so the remaining steps start from a routine state
    await db.query(`ALTER TABLE meal_streaks DROP CONSTRAINT "${fks[0].conname}"`);
    await db.query(`ALTER TABLE meal_streaks ADD CONSTRAINT "${fks[0].conname}" ${fks[0].def}`);
    await db.query(`DROP INDEX "${idxName}"; CREATE INDEX "${idxName}" ON creator_campaign_rollout_timeline_events (campaign_id, occurred_at)`);
    assert.equal(pushSchema(databaseUrl).status, 0, "back to routine: the genuine churn passes review again");

    // 3d. Removing NOT NULL. users.password is nullable in the schema; making it NOT NULL in the database makes drizzle plan DROP NOT NULL on
    //     an authentication table. That must be refused, leave the constraint in place, and apply only with the exact token.
    const passwordNullable = async () => (await db.query("SELECT is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password'")).rows[0].is_nullable;
    assert.equal(await passwordNullable(), "YES", "precondition: the schema declares users.password nullable");
    await db.query("ALTER TABLE users ALTER COLUMN password SET NOT NULL");
    const notNullBefore = await catalog(db);
    const notNullRefused = pushSchema(databaseUrl);
    assert.equal(notNullRefused.status, 1, notNullRefused.output.slice(-1500));
    assert.match(notNullRefused.output, /\[not_null_dropped\] ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL/);
    assert.doesNotMatch(notNullRefused.output, /invariants verified/);
    assert.equal(await passwordNullable(), "NO", "NOT NULL is still in force after the refusal");
    assert.deepEqual(await catalog(db), notNullBefore);
    assert.equal(pushSchema(databaseUrl, ["--force"]).status, 1, "--force is not an acknowledgement");
    const notNullToken = /--accept-plan=([0-9a-f]{24})/.exec(notNullRefused.output)?.[1];
    assert.ok(notNullToken);
    // The token is bound to this exact plan: a different plan (an extra dangerous change) invalidates it.
    await db.query("ALTER TABLE users ADD COLUMN token_probe integer");
    const staleToken = pushSchema(databaseUrl, [`--accept-plan=${notNullToken}`]);
    assert.equal(staleToken.status, 1, "a token for the old plan does not authorise a changed plan");
    assert.equal(await passwordNullable(), "NO");
    await db.query("ALTER TABLE users DROP COLUMN token_probe");
    assert.equal(pushSchema(databaseUrl, [`--accept-plan=${notNullToken}`]).status, 0);
    assert.equal(await passwordNullable(), "YES", "the reviewed DROP NOT NULL was applied");

    // 4. A destructive plan against a DECLARED table is refused, applies nothing, and names a plan-specific token.
    await db.query("ALTER TABLE users ADD COLUMN reviewed_later integer");
    const refused = pushSchema(databaseUrl);
    assert.equal(refused.status, 1, refused.output.slice(-1500));
    assert.match(refused.output, /Schema push REFUSED/);
    assert.match(refused.output, /\[drop_column\] ALTER TABLE "users" DROP COLUMN "reviewed_later"/);
    const columnPresent = async () => (await db.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reviewed_later'")).rowCount === 1;
    assert.equal(await columnPresent(), true, "nothing was applied");

    // 5. --force is NOT an acknowledgement on a real database; a wrong token is not either.
    const forced = pushSchema(databaseUrl, ["--force"]);
    assert.equal(forced.status, 1);
    assert.match(forced.output, /--force no longer bypasses/);
    assert.equal(pushSchema(databaseUrl, ["--accept-plan=000000000000000000000000"]).status, 1);
    assert.equal(await columnPresent(), true, "still nothing applied");

    // 6. The exact token lets exactly that plan through, atomically.
    const token = /--accept-plan=([0-9a-f]{24})/.exec(refused.output)?.[1];
    assert.ok(token, refused.output.slice(-800));
    const accepted = pushSchema(databaseUrl, [`--accept-plan=${token}`]);
    assert.equal(accepted.status, 0, accepted.output.slice(-2000));
    assert.equal(await columnPresent(), false, "the reviewed column drop was applied");
    const { rows: survivors } = await db.query("SELECT (SELECT count(*) FROM legacy_credential_invalidations)::int AS a, (SELECT count(*) FROM _app_migrations)::int AS b");
    assert.deepEqual(survivors[0], { a: 1, b: 1 });

    // 7. A plan that fails part-way is rolled back whole (drizzle-kit alone applies statement by statement and would leave the early
    //    CREATE TABLE behind). The plan creates water_logs first, then fails on SET NOT NULL over a legacy NULL.
    await db.query("DROP TABLE water_logs");
    await db.query("ALTER TABLE meal_streaks ALTER COLUMN current_streak DROP NOT NULL");
    await db.query("SET session_replication_role = replica");
    await db.query("INSERT INTO meal_streaks (user_id, current_streak) VALUES ('ghost-user', NULL)");
    await db.query("SET session_replication_role = origin");
    const failed = pushSchema(databaseUrl);
    assert.notEqual(failed.status, 0, failed.output.slice(-1500));
    assert.match(failed.output, /rolled back/);
    assert.equal((await db.query("SELECT to_regclass('public.water_logs') AS t")).rows[0].t, null, "the early CREATE TABLE was rolled back with the failed statement");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM legacy_credential_invalidations")).rows[0].n, 1);
  } finally {
    await db.end().catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch(() => undefined);
    await admin.end();
  }
});
