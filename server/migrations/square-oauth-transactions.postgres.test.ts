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
if (!connectionString) {
  console.log("# TEST_DATABASE_URL unavailable -- P1-06 PostgreSQL integration tests skipped safely");
  console.log("# skipped: atomic browser-bound concurrent claim");
  console.log("# skipped: 100-request/per-user row reuse");
  console.log("# skipped: cross-timezone timestamptz behavior");
}

async function withSchema(fn: (clients: { admin: pg.Client; namespace: string }) => Promise<void>) {
  const admin = new pg.Client({ connectionString: connectionString! });
  const namespace = `p106_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${namespace}`);
    await admin.query(`SET search_path TO ${namespace}`);
    await admin.query(`CREATE TABLE users (id varchar PRIMARY KEY)`);
    await admin.query(migration);
    await fn({ admin, namespace });
  } finally {
    await admin.query("RESET search_path").catch(() => undefined);
    await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`).catch(() => undefined);
    await admin.end().catch(() => undefined);
  }
}

postgresTest("one callback atomically claims an unexpired current state bound to the right browser, and replay loses", async () => {
  const first = new pg.Client({ connectionString: connectionString! });
  const second = new pg.Client({ connectionString: connectionString! });
  await withSchema(async ({ admin, namespace }) => {
    await Promise.all([first.connect(), second.connect()]);
    for (const client of [first, second]) await client.query(`SET search_path TO ${namespace}`);

    await admin.query(`INSERT INTO users VALUES ('seller-a'), ('seller-b')`);
    await admin.query(
      `INSERT INTO square_oauth_transactions (user_id, nonce_hash, browser_binding_hash, expires_at)
       VALUES ('seller-a', '${"a".repeat(64)}', '${"1".repeat(64)}', now() + interval '10 minutes')`,
    );

    const claim = (client: pg.Client, claimId: string, bindingHash: string) =>
      client.query(
        `UPDATE square_oauth_transactions SET claim_id = $3, claimed_at = now()
         WHERE nonce_hash = $1 AND browser_binding_hash = $2
           AND claimed_at IS NULL AND consumed_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        ["a".repeat(64), bindingHash, claimId],
      );

    // Wrong browser binding (victim opened a forwarded authorization URL) never claims.
    const wrongBinding = await claim(first, "wrong-binding", "2".repeat(64));
    assert.equal(wrongBinding.rowCount, 0);

    // The legitimate transaction is untouched by the failed attempt above and still claimable.
    const results = await Promise.all([
      claim(first, "first", "1".repeat(64)),
      claim(second, "second", "1".repeat(64)),
    ]);
    assert.deepEqual(results.map((result) => result.rowCount).sort(), [0, 1]);
    assert.equal(results.find((result) => result.rowCount === 1)!.rows[0].user_id, "seller-a");

    // Replay after a successful claim fails.
    assert.equal((await claim(first, "replay", "1".repeat(64))).rowCount, 0);

    // Expired transaction can never be claimed, correct binding or not.
    await admin.query(
      `INSERT INTO square_oauth_transactions (user_id, nonce_hash, browser_binding_hash, expires_at)
       VALUES ('seller-b', '${"b".repeat(64)}', '${"3".repeat(64)}', now() - interval '1 second')`,
    );
    const expired = await claim(first, "expired", "3".repeat(64));
    assert.equal(expired.rowCount, 0);
  });
  await Promise.all([first.end().catch(() => undefined), second.end().catch(() => undefined)]);
});

postgresTest("100 initiations from one user retain exactly one row and never affect another user's transaction", async () => {
  await withSchema(async ({ admin }) => {
    await admin.query(`INSERT INTO users VALUES ('seller-a'), ('seller-b')`);
    await admin.query(
      `INSERT INTO square_oauth_transactions (user_id, nonce_hash, browser_binding_hash, expires_at)
       VALUES ('seller-b', '${"b".repeat(64)}', '${"4".repeat(64)}', now() + interval '10 minutes')`,
    );

    let lastNonce = "";
    for (let i = 0; i < 100; i++) {
      lastNonce = i.toString(16).padStart(64, "0");
      await admin.query(
        `INSERT INTO square_oauth_transactions (user_id, nonce_hash, browser_binding_hash, expires_at)
         VALUES ($1, $2, $3, now() + interval '10 minutes')
         ON CONFLICT (user_id) DO UPDATE
         SET nonce_hash = EXCLUDED.nonce_hash,
             browser_binding_hash = EXCLUDED.browser_binding_hash,
             expires_at = EXCLUDED.expires_at,
             claim_id = NULL, claimed_at = NULL, consumed_at = NULL, created_at = now()`,
        ["seller-a", lastNonce, i.toString(16).padStart(64, "5")],
      );
    }

    const rows = await admin.query(`SELECT user_id, nonce_hash FROM square_oauth_transactions ORDER BY user_id`);
    assert.equal(rows.rowCount, 2);
    const sellerA = rows.rows.find((r) => r.user_id === "seller-a");
    assert.equal(sellerA.nonce_hash, lastNonce);

    // A stale nonce from an earlier initiation no longer matches any row.
    const staleClaim = await admin.query(
      `UPDATE square_oauth_transactions SET claim_id = 'x', claimed_at = now()
       WHERE nonce_hash = $1 AND claimed_at IS NULL AND consumed_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      ["0".padStart(64, "0")],
    );
    assert.equal(staleClaim.rowCount, 0);

    // seller-b's independent transaction is unaffected.
    const sellerB = rows.rows.find((r) => r.user_id === "seller-b");
    assert.equal(sellerB.nonce_hash, "b".repeat(64));
  });
});

postgresTest("timestamptz columns represent absolute instants across a Node/PostgreSQL timezone difference", async () => {
  await withSchema(async ({ admin }) => {
    await admin.query(`SET TIME ZONE 'Pacific/Kiritimati'`); // UTC+14, deliberately far from Node's local TZ
    await admin.query(`INSERT INTO users VALUES ('seller-a')`);
    const expiresAtInstant = new Date(Date.now() + 10 * 60 * 1000);
    await admin.query(
      `INSERT INTO square_oauth_transactions (user_id, nonce_hash, browser_binding_hash, expires_at)
       VALUES ('seller-a', $1, $2, $3)`,
      ["c".repeat(64), "6".repeat(64), expiresAtInstant.toISOString()],
    );

    const row = await admin.query(
      `SELECT expires_at, expires_at > now() AS still_valid FROM square_oauth_transactions WHERE user_id = 'seller-a'`,
    );
    assert.equal(row.rows[0].still_valid, true);
    const roundTripped = new Date(row.rows[0].expires_at);
    assert.ok(Math.abs(roundTripped.getTime() - expiresAtInstant.getTime()) < 1000);

    const columnType = await admin.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'square_oauth_transactions' AND column_name = 'expires_at'`,
    );
    assert.equal(columnType.rows[0].data_type, "timestamp with time zone");
  });
});
