/**
 * Finalized plaintext-token enforcement must survive schema synchronization. drizzle-kit push treats the Drizzle schema as
 * authoritative and cannot represent the plaintext CHECK (installing it from there would enforce it BEFORE old servers are drained), so
 * a push would drop it. Finalization therefore records a durable one-way marker, and push-schema.ts restores the CHECK from it after
 * every push -- failing the push if it cannot. Before finalization nothing is installed. Real PostgreSQL; set TEST_DATABASE_URL
 * (loopback, name contains "test"). The push tests run the real `npm run db:push` / `db:push:accept` script on throw-away databases.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV } from "./secret-box";
import {
  finalizeSquarePlaintextEnforcement,
  plaintextEnforcementInstalled,
  plaintextFinalizationRecorded,
  restoreFinalizedPlaintextEnforcement,
} from "./square-plaintext-enforcement";
import type { SqlPool } from "./square-connection-service";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const MIGRATIONS = ["20261007_square_connection_hardening", "20261008_square_credential_generation", "20261010_square_merchant_revocations", "20261011_square_credential_pair_repair", "20261012_square_merchant_id_width"];

test("push-schema.ts restores finalized enforcement after the Drizzle push, and the Drizzle schema declares the marker but NOT the constraint", () => {
  const script = fs.readFileSync(path.join(root, "server/scripts/push-schema.ts"), "utf8");
  const push = script.indexOf('"drizzle-kit", "push"') >= 0 ? script.indexOf("run(pushArgs)") : -1;
  const restore = script.indexOf("enforce-square-plaintext-finalization.ts");
  assert.ok(push > 0 && restore > push, "restoration runs after the push");
  assert.equal(script.slice(restore - 80).includes("run(["), true);
  const schema = fs.readFileSync(path.join(root, "shared/schema/domains/ops-wedding.ts"), "utf8");
  assert.match(schema, /pgTable\("square_plaintext_enforcement_state"/);
  const code = schema.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(code.includes("payment_methods_no_plaintext_oauth_token_check"), false, "never installed from the Drizzle schema (would enforce before old servers drain)");
});

if (!URL_ENV) {
  test("Square plaintext finalization durability (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  const sqlPool = (h: SquareHarness) => h.pool as unknown as SqlPool;
  const insertPlaintext = (h: SquareHarness) =>
    h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ('legacy-user', 'square', 'M', 'active', '{"accessToken":"plain-token-xyz","refreshToken":"plain-refresh-xyz"}'::jsonb)`);

  test("PRE-finalization: no constraint, no marker; restoring is a no-op that installs nothing (staged rollout preserved; old servers may still write plaintext)", async () => {
    await run(async (h) => {
      await h.addUser("legacy-user");
      assert.equal(await plaintextFinalizationRecorded(h.pool as never), false);
      assert.deepEqual(await restoreFinalizedPlaintextEnforcement(sqlPool(h)), { ok: true, state: "not_finalized" });
      assert.equal(await plaintextEnforcementInstalled(h.pool as never), false);
      await insertPlaintext(h); // still allowed before finalization
      assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM payment_methods`)).rows[0].n, 1);
    });
  });

  test("an ABSENT constraint is never mistaken for a finalized database", async () => {
    await run(async (h) => {
      assert.equal(await plaintextEnforcementInstalled(h.pool as never), false);
      assert.equal(await plaintextFinalizationRecorded(h.pool as never), false);
      const result = await restoreFinalizedPlaintextEnforcement(sqlPool(h));
      assert.deepEqual(result, { ok: true, state: "not_finalized" });
      assert.equal(await plaintextEnforcementInstalled(h.pool as never), false);
    });
  });

  test("confirmation is required and plaintext blocks finalization: neither writes a marker or a constraint", async () => {
    await run(async (h) => {
      await h.addUser("legacy-user");
      assert.deepEqual(await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: false }), { ok: false, reason: "confirmation_required" });
      await insertPlaintext(h);
      const refused = await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: true });
      assert.equal(refused.ok, false);
      assert.equal(await plaintextFinalizationRecorded(h.pool as never), false);
      assert.equal(await plaintextEnforcementInstalled(h.pool as never), false);
    });
  });

  test("the finalizer installs AND validates the constraint and records the durable marker; re-running is idempotent; the marker is one-way", async () => {
    await run(async (h) => {
      assert.deepEqual(await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: true }), { ok: true, state: "installed" });
      assert.equal(await plaintextEnforcementInstalled(h.pool as never), true, "validated");
      assert.equal(await plaintextFinalizationRecorded(h.pool as never), true);
      const stamp = (await h.pool.query(`SELECT finalized_at FROM square_plaintext_enforcement_state`)).rows;
      assert.equal(stamp.length, 1);
      assert.deepEqual(await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: true }), { ok: true, state: "already_installed" });
      assert.deepEqual(await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: true }), { ok: true, state: "already_installed" });
      assert.deepEqual((await h.pool.query(`SELECT finalized_at FROM square_plaintext_enforcement_state`)).rows, stamp, "marker untouched by re-runs");
      await assert.rejects(h.pool.query(`DELETE FROM square_plaintext_enforcement_state`), /permanent/);
      await assert.rejects(h.pool.query(`UPDATE square_plaintext_enforcement_state SET finalized_at = now()`), /permanent/);
    });
  });

  test("a FINALIZED database rejects plaintext OAuth writes, and sealed credential rows keep working", async () => {
    await run(async (h) => {
      await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: true });
      await h.addUser("legacy-user");
      await assert.rejects(insertPlaintext(h), { code: "23514" });
      h.useMerchant("MERCHANT_1", { access: "fin-access", refresh: "fin-refresh" });
      await h.connect("sealed-user");
      assert.equal((await h.service.getSquarePaymentReadiness("sealed-user")).state, "active");
      assert.equal(h.accessOf(await h.row("sealed-user")), "fin-access");
    });
  });

  test("a push that REMOVED the constraint on a finalized database is repaired from the marker; repeated restores are idempotent", async () => {
    await run(async (h) => {
      await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: true });
      await h.pool.query(`ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_no_plaintext_oauth_token_check`); // what a drizzle push does
      assert.equal(await plaintextEnforcementInstalled(h.pool as never), false);
      assert.deepEqual(await restoreFinalizedPlaintextEnforcement(sqlPool(h)), { ok: true, state: "restored" });
      assert.equal(await plaintextEnforcementInstalled(h.pool as never), true);
      assert.deepEqual(await restoreFinalizedPlaintextEnforcement(sqlPool(h)), { ok: true, state: "intact" });
      await h.addUser("legacy-user");
      await assert.rejects(insertPlaintext(h), { code: "23514" });
    });
  });

  test("FAIL CLOSED: if the constraint was dropped and plaintext reappeared, restoring reports failure (ids only) instead of continuing", async () => {
    await run(async (h) => {
      await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: true });
      await h.pool.query(`ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_no_plaintext_oauth_token_check`);
      await h.addUser("legacy-user");
      await insertPlaintext(h);
      const result = await restoreFinalizedPlaintextEnforcement(sqlPool(h));
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.reason, "plaintext_rows_remain");
        assert.equal(result.rows.length, 1);
        assert.equal(JSON.stringify(result).includes("plain-token-xyz"), false, "no token in the report");
      }
      assert.equal(await plaintextEnforcementInstalled(h.pool as never), false, "not falsely reported as restored");
      assert.equal(await plaintextFinalizationRecorded(h.pool as never), true, "the finalized state is not forgotten");
    });
  });

  test("adopting a constraint an earlier revision installed records the marker without reinstalling", async () => {
    await run(async (h) => {
      await h.pool.query(`ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_no_plaintext_oauth_token_check CHECK (account_details IS NULL OR NOT (account_details ?| ARRAY['accessToken', 'refreshToken']))`);
      assert.deepEqual(await finalizeSquarePlaintextEnforcement(sqlPool(h), { oldServersDrained: true }), { ok: true, state: "already_installed" });
      assert.equal(await plaintextFinalizationRecorded(h.pool as never), true);
    });
  });

  /* ---- the real db:push / db:push:accept script on throw-away databases ---- */
  const admin = new URL(URL_ENV);
  const withDb = (name: string) => { const u = new URL(URL_ENV); u.pathname = `/${name}`; return u.toString(); };
  const pushScript = (databaseUrl: string, force: boolean) => {
    const result = spawnSync("npx", ["tsx", "server/scripts/push-schema.ts", ...(force ? ["--force"] : [])], {
      cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8", timeout: 280_000, input: "",
    });
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  };
  const constraintState = async (db: pg.Client) => (await db.query(`SELECT convalidated FROM pg_constraint WHERE conname = 'payment_methods_no_plaintext_oauth_token_check' AND conrelid = 'payment_methods'::regclass`)).rows;

  test("db:push and db:push:accept: nothing installed before finalization; enforcement and merchant history survive every push after it; a failed restore fails the push", { timeout: 1_500_000 }, async () => {
    assert.ok(admin.hostname === "127.0.0.1" || admin.hostname === "localhost", "loopback only");
    const name = `chefsire_finalization_test_${randomBytes(4).toString("hex")}`;
    const adminClient = new pg.Client({ connectionString: URL_ENV });
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE ${name}`);
    const url = withDb(name);
    try {
      // Fresh database from the Drizzle schema (via the real script): marker table exists and is empty; the constraint is NOT installed.
      let result = pushScript(url, false);
      assert.equal(result.status, 0, result.output.slice(-1500));
      const db = new pg.Client({ connectionString: url });
      await db.connect();
      try {
        assert.deepEqual(await constraintState(db), [], "a pre-finalization push installs nothing");
        assert.equal((await db.query(`SELECT count(*)::int AS n FROM square_plaintext_enforcement_state`)).rows[0].n, 0, "empty marker table = not finalized");
        assert.equal((await db.query(`SELECT to_regclass('square_merchant_revocations') AS t`)).rows[0].t !== null, true, "fresh schema has the revocation history table");
        for (const migration of MIGRATIONS) await db.query(fs.readFileSync(path.join(root, `server/migrations/${migration}.sql`), "utf8"));
        await db.query(`INSERT INTO users (id, username, display_name, email) VALUES ('u1', 'u1', 'U One', 'u1@example.test') ON CONFLICT DO NOTHING`);
        await db.query(`INSERT INTO square_merchant_revocations (merchant_id, revoked_at, revocation_epoch) VALUES ('MERCHANT_HISTORY', now(), 2)`);

        // A second pre-finalization push (force) is still a no-op for enforcement and plaintext is still writable by an old server.
        result = pushScript(url, true);
        assert.equal(result.status, 0, result.output.slice(-1500));
        assert.deepEqual(await constraintState(db), []);
        await db.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ('u1', 'square', 'M', 'active', '{"accessToken":"t","refreshToken":"r"}'::jsonb)`);
        await db.query(`DELETE FROM payment_methods WHERE user_id = 'u1'`);

        // Explicit finalization.
        const pool = new pg.Pool({ connectionString: url });
        assert.deepEqual(await finalizeSquarePlaintextEnforcement(pool as unknown as SqlPool, { oldServersDrained: true }), { ok: true, state: "installed" });
        await pool.end();
        assert.deepEqual((await constraintState(db)).map((row) => row.convalidated), [true]);

        // Post-finalization: db:push, db:push:accept, and repeats all keep the constraint, the marker and the history.
        for (const force of [false, true, false, true]) {
          result = pushScript(url, force);
          assert.equal(result.status, 0, `${force ? "db:push:accept" : "db:push"}: ${result.output.slice(-1500)}`);
          assert.deepEqual((await constraintState(db)).map((row) => row.convalidated), [true], `${force ? "db:push:accept" : "db:push"} preserved the plaintext enforcement`);
          assert.equal((await db.query(`SELECT count(*)::int AS n FROM square_plaintext_enforcement_state`)).rows[0].n, 1);
          assert.deepEqual((await db.query(`SELECT merchant_id, revocation_epoch FROM square_merchant_revocations`)).rows, [{ merchant_id: "MERCHANT_HISTORY", revocation_epoch: "2" }], "merchant revocation history survives");
        }
        await assert.rejects(db.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ('u1', 'square', 'M', 'active', '{"accessToken":"t"}'::jsonb)`), { code: "23514" });
        await db.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, encrypted_access_token, encrypted_refresh_token, token_expires_at) VALUES ('u1', 'square', 'M', 'active', 'sqenc:v1:a:b:c:d', 'sqenc:v1:a:b:c:d', now())`);
        await db.query(`DELETE FROM payment_methods WHERE user_id = 'u1'`);

        // Fail closed: the constraint is gone AND plaintext is present, so the push cannot restore it -> the push FAILS.
        await db.query(`ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_no_plaintext_oauth_token_check`);
        await db.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details) VALUES ('u1', 'square', 'M', 'active', '{"accessToken":"t","refreshToken":"r"}'::jsonb)`);
        result = pushScript(url, true);
        assert.notEqual(result.status, 0, "a push that cannot preserve finalized enforcement must fail");
        assert.match(result.output, /plaintext_rows_remain/);
        assert.equal(result.output.includes('"t"'), false);
      } finally { await db.end(); }
    } finally {
      await adminClient.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await adminClient.end();
    }
  });
}
