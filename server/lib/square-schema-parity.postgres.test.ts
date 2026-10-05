/**
 * Drizzle schema <-> SQL migration parity for the Square Gate 0 objects. drizzle-kit push treats the Drizzle schema as authoritative:
 * an object missing from it is not created on a fresh database, and on a migrated one it is DROPPED (or, for a column, narrowed back).
 * square_merchant_revocations is the merchant revocation history, so losing it would let a pre-revocation authorization be trusted again.
 *
 * Part 1 is static. Part 2 runs the real `drizzle-kit push` against throw-away databases created here (set TEST_DATABASE_URL to a
 * loopback database whose name contains "test"; skipped otherwise). Never production.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import { paymentMethods, squareMerchantRevocations } from "../../shared/schema";
import * as barrel from "../../shared/schema";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const MIGRATIONS = ["20261007_square_connection_hardening", "20261008_square_credential_generation", "20261010_square_merchant_revocations", "20261011_square_credential_pair_repair", "20261012_square_merchant_id_width"];

test("Drizzle declares square_merchant_revocations with the migration's exact shape, and the barrel exports it", () => {
  assert.equal((barrel as Record<string, unknown>).squareMerchantRevocations, squareMerchantRevocations);
  const config = getTableConfig(squareMerchantRevocations);
  assert.equal(config.name, "square_merchant_revocations");
  const column = (name: string) => config.columns.find((candidate) => candidate.name === name)!;
  assert.equal(column("merchant_id").getSQLType(), "text", "full-width merchant id, not varchar(64)");
  assert.equal(column("merchant_id").primary, true);
  assert.equal(column("revoked_at").getSQLType(), "timestamp with time zone");
  assert.equal(column("revoked_at").notNull, true);
  assert.equal(column("revocation_epoch").getSQLType(), "bigint");
  assert.equal(column("revocation_epoch").notNull, true);
  assert.equal(column("source").getSQLType(), "varchar(24)");
  assert.equal(column("created_at").notNull, true);
  assert.equal(column("updated_at").notNull, true);
  assert.deepEqual(config.columns.map((candidate) => candidate.name).sort(), ["created_at", "merchant_id", "revocation_epoch", "revoked_at", "source", "updated_at"]);
  assert.deepEqual(config.checks.map((check) => check.name).sort(), ["square_merchant_revocations_epoch_check", "square_merchant_revocations_merchant_check", "square_merchant_revocations_source_check"]);
});

test("Drizzle does not narrow the widened Square identifiers or drop the Gate 0 constraints and index", () => {
  const config = getTableConfig(paymentMethods);
  const type = (name: string) => config.columns.find((candidate) => candidate.name === name)!.getSQLType();
  assert.equal(type("location_id"), "text");
  assert.equal(type("provider_id"), "text");
  assert.equal(type("encrypted_access_token"), "text");
  assert.deepEqual(config.checks.map((check) => check.name).sort(), [
    "payment_methods_account_status_check", "payment_methods_credential_generation_check", "payment_methods_square_credentials_check", "payment_methods_square_dead_holds_no_secret_check",
  ]);
  assert.equal(config.indexes.some((index) => index.config.name === "payment_methods_provider_merchant_idx"), true);
  // The migrations and the Drizzle source agree: no migration still declares a narrow identifier.
  const sql = MIGRATIONS.map((name) => fs.readFileSync(path.join(root, `server/migrations/${name}.sql`), "utf8")).join("\n");
  assert.equal(/merchant_id\s+varchar/i.test(sql), false);
  assert.match(sql, /ALTER COLUMN location_id TYPE text/);
});

if (!URL_ENV) {
  test("Square schema push safety (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const admin = new URL(URL_ENV);
  const withDb = (name: string) => { const u = new URL(URL_ENV); u.pathname = `/${name}`; return u.toString(); };
  const push = (databaseUrl: string) => {
    const result = spawnSync("npx", ["drizzle-kit", "push", "--force", "--verbose"], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8", timeout: 240_000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`.slice(-2000));
    return `${result.stdout}\n${result.stderr}`;
  };
  const SQUARE_OBJECTS = /square_merchant_revocations|payment_methods_(account_status|credential_generation|square_credentials|square_dead_holds_no_secret)_check|payment_methods_provider_merchant_idx|"location_id"/;

  test("fresh db:push creates the revocation table; a push over a MIGRATED database neither drops it, its history, its guards, nor narrows location_id", { timeout: 600_000 }, async () => {
    assert.ok(admin.hostname === "127.0.0.1" || admin.hostname === "localhost", "loopback only");
    const name = `chefsire_schema_parity_test_${randomBytes(4).toString("hex")}`;
    assert.match(name, /test/);
    const adminClient = new pg.Client({ connectionString: URL_ENV });
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE ${name}`);
    const url = withDb(name);
    try {
      // A. a fresh database built from the Drizzle schema alone contains the table at full width.
      push(url);
      const db = new pg.Client({ connectionString: url });
      await db.connect();
      try {
        const fresh = await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'square_merchant_revocations' AND column_name = 'merchant_id'`);
        assert.deepEqual(fresh.rows, [{ data_type: "text" }], "fresh schema contains square_merchant_revocations.merchant_id text");
        await db.query(`INSERT INTO square_merchant_revocations (merchant_id, revoked_at) VALUES ($1, now())`, ["M".repeat(200)]);
        assert.equal((await db.query(`SELECT length(merchant_id) AS n FROM square_merchant_revocations`)).rows[0].n, 200, "a long merchant id is stored in full");

        // B. recreate the state a SQL-migrated database is in: table + trigger from the migrations, history rows present.
        await db.query(`DROP TABLE square_merchant_revocations`);
        await db.query(`ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_account_status_check, DROP CONSTRAINT IF EXISTS payment_methods_credential_generation_check, DROP CONSTRAINT IF EXISTS payment_methods_square_credentials_check, DROP CONSTRAINT IF EXISTS payment_methods_square_dead_holds_no_secret_check`);
        await db.query(`DROP INDEX IF EXISTS payment_methods_provider_merchant_idx`);
        await db.query(`ALTER TABLE payment_methods ALTER COLUMN location_id TYPE varchar(64)`);
        for (const migration of MIGRATIONS) await db.query(fs.readFileSync(path.join(root, `server/migrations/${migration}.sql`), "utf8"));
        await db.query(`INSERT INTO square_merchant_revocations (merchant_id, revoked_at, revocation_epoch) VALUES ('MERCHANT_HISTORY', now(), 3)`);

        const before = await db.query(`SELECT conname, convalidated FROM pg_constraint WHERE conrelid IN ('payment_methods'::regclass, 'square_merchant_revocations'::regclass) AND contype = 'c' ORDER BY 1`);
        const shape = async () => (await db.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'square_merchant_revocations' ORDER BY 1`)).rows;
        const shapeBefore = await shape();

        // C/D. db:push (and db:push:accept's --force) over the migrated database.
        const output = push(url);
        const proposed = output.split("\n").filter((line) => /^(ALTER|DROP|CREATE)/i.test(line.trim()) && SQUARE_OBJECTS.test(line));
        assert.deepEqual(proposed.filter((line) => /DROP\s+TABLE|DROP\s+CONSTRAINT|DROP\s+INDEX|DATA TYPE/i.test(line)), [], `no destructive statement for a Gate 0 object: ${proposed.join(" | ")}`);

        assert.deepEqual((await db.query(`SELECT merchant_id, revocation_epoch FROM square_merchant_revocations`)).rows, [{ merchant_id: "MERCHANT_HISTORY", revocation_epoch: "3" }], "history survives the push");
        assert.deepEqual(await shape(), shapeBefore, "table shape unchanged by the push (matches the migration shape)");
        assert.deepEqual((await db.query(`SELECT conname, convalidated FROM pg_constraint WHERE conrelid IN ('payment_methods'::regclass, 'square_merchant_revocations'::regclass) AND contype = 'c' ORDER BY 1`)).rows, before.rows, "every credential/history CHECK survives with its validation state");
        assert.equal((await db.query(`SELECT 1 FROM pg_trigger WHERE tgname = 'square_merchant_revocations_history_trigger'`)).rows.length, 1, "append-only trigger intact");
        assert.equal((await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'location_id'`)).rows[0].data_type, "text", "location_id not narrowed");
        assert.equal((await db.query(`SELECT 1 FROM pg_indexes WHERE indexname = 'payment_methods_provider_merchant_idx'`)).rows.length, 1);
        // The guard that the pair rule is still ENFORCED after the push, not merely present.
        await assert.rejects(db.query(`INSERT INTO payment_methods (user_id, provider, provider_id, encrypted_access_token) VALUES ('nobody', 'square', 'M', 'sqenc:v1:x')`), { code: "23514" });
      } finally { await db.end(); }
    } finally {
      await adminClient.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await adminClient.end();
    }
  });
}
