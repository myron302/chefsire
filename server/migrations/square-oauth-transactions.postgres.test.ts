/** Executes the P1-06 migration and its atomic state transition against an isolated test database. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "20260927_square_oauth_transactions.sql"), "utf8");
const connectionString = process.env.TEST_DATABASE_URL?.trim() || null;
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# TEST_DATABASE_URL unavailable -- P1-06 PostgreSQL integration test skipped safely");

postgresTest("one callback atomically claims an unexpired current state and replay loses", async () => {
  const admin = new pg.Client({ connectionString: connectionString! });
  const first = new pg.Client({ connectionString: connectionString! });
  const second = new pg.Client({ connectionString: connectionString! });
  const namespace = `p106_${process.pid}_${Date.now()}`;
  try {
    await Promise.all([admin.connect(), first.connect(), second.connect()]);
    await admin.query(`CREATE SCHEMA ${namespace}`);
    for (const client of [admin, first, second]) await client.query(`SET search_path TO ${namespace}`);
    await admin.query(`CREATE TABLE users (id varchar PRIMARY KEY)`);
    await admin.query(migration);
    await admin.query(`INSERT INTO users VALUES ('seller-a'), ('seller-b')`);
    await admin.query(`INSERT INTO square_oauth_transactions (nonce_hash, user_id, expires_at)
      VALUES ('${"a".repeat(64)}', 'seller-a', now() + interval '10 minutes')`);

    const claim = (client: pg.Client, claimId: string) => client.query(
      `UPDATE square_oauth_transactions SET claim_id = $2, claimed_at = now()
       WHERE nonce_hash = $1 AND claimed_at IS NULL AND consumed_at IS NULL
         AND superseded_at IS NULL AND expires_at > now() RETURNING user_id`,
      ["a".repeat(64), claimId],
    );
    const results = await Promise.all([claim(first, "first"), claim(second, "second")]);
    assert.deepEqual(results.map((result) => result.rowCount).sort(), [0, 1]);
    assert.equal(results.find((result) => result.rowCount === 1)!.rows[0].user_id, "seller-a");
    assert.equal((await claim(first, "replay")).rowCount, 0);

    await admin.query(`INSERT INTO square_oauth_transactions (nonce_hash, user_id, expires_at, superseded_at)
      VALUES ('${"b".repeat(64)}', 'seller-b', now() - interval '1 second', NULL),
             ('${"c".repeat(64)}', 'seller-b', now() + interval '10 minutes', now())`);
    const guarded = await first.query(`UPDATE square_oauth_transactions SET claim_id='bad', claimed_at=now()
      WHERE nonce_hash IN ($1,$2) AND claimed_at IS NULL AND consumed_at IS NULL
        AND superseded_at IS NULL AND expires_at > now() RETURNING id`, ["b".repeat(64), "c".repeat(64)]);
    assert.equal(guarded.rowCount, 0);
  } finally {
    await admin.query("RESET search_path").catch(() => undefined);
    await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`).catch(() => undefined);
    await Promise.all([admin.end().catch(() => undefined), first.end().catch(() => undefined), second.end().catch(() => undefined)]);
  }
});
