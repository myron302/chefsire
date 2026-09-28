/** Executes the P1-06 migrations and their atomic state transitions against an isolated test database. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyMigration } from "../scripts/migration-runner";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "20260927_square_oauth_transactions.sql"), "utf8");
const hardeningMigration = fs.readFileSync(path.join(here, "20260928_square_oauth_hardening.sql"), "utf8");
const connectionString = process.env.TEST_DATABASE_URL?.trim() || null;
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) {
  console.log("# TEST_DATABASE_URL unavailable -- P1-06 PostgreSQL integration tests skipped safely");
  console.log("# skipped: atomic browser-bound concurrent claim");
  console.log("# skipped: 100-request/per-user row reuse");
  console.log("# skipped: cross-timezone timestamptz behavior");
  console.log("# skipped: fresh migration sequence (20260927 -> 20260928) idempotency");
  console.log("# skipped: hardening upgrade from the earlier unmerged 20260927 shape");
  console.log("# skipped: claim survives provider latency crossing expires_at");
}

async function withNamespace<T>(
  prefix: string,
  fn: (admin: pg.Client, namespace: string) => Promise<T>,
): Promise<T> {
  const admin = new pg.Client({ connectionString: connectionString! });
  const namespace = `${prefix}_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${namespace}`);
    await admin.query(`SET search_path TO ${namespace}`);
    await admin.query(`CREATE TABLE users (id varchar PRIMARY KEY)`);
    // Minimal stand-in for the real payment_methods table, used only to prove
    // the hardening migration never touches existing seller connections.
    await admin.query(
      `CREATE TABLE payment_methods (
         id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id varchar NOT NULL,
         provider varchar NOT NULL,
         marker varchar
       )`,
    );
    // applyMigration (the real production migration runner) writes to this
    // ledger table on every successful apply; mirror ensureLedger() here.
    await admin.query(
      `CREATE TABLE _app_migrations (filename text primary key, applied_at timestamptz not null default now())`,
    );
    return await fn(admin, namespace);
  } finally {
    await admin.query("RESET search_path").catch(() => undefined);
    await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`).catch(() => undefined);
    await admin.end().catch(() => undefined);
  }
}

async function withSchema(fn: (clients: { admin: pg.Client; namespace: string }) => Promise<void>) {
  await withNamespace("p106", async (admin, namespace) => {
    await admin.query(migration);
    await fn({ admin, namespace });
  });
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

// ---------------------------------------------------------------------------
// Round 2, Finding 1: 20260928 must be safe whether it follows a fresh
// 20260927 (which already installs the final UNIQUE(user_id) constraint) or
// an earlier, unmerged 20260927 shape (which never had it).
// ---------------------------------------------------------------------------

postgresTest(
  "fresh install: 20260927 followed immediately by 20260928 succeeds and installs exactly one user_id uniqueness constraint",
  async () => {
    await withNamespace("p106_fresh", async (admin) => {
      await admin.query(`INSERT INTO payment_methods (user_id, provider, marker) VALUES ('seller-a', 'square', 'preexisting')`);

      // Exercises the exact production path: statement splitting + one
      // transaction per file, via the real migration runner.
      await applyMigration(admin, "server:20260927_square_oauth_transactions.sql", migration);
      await applyMigration(admin, "server:20260928_square_oauth_hardening.sql", hardeningMigration);

      const constraints = await admin.query(
        `SELECT conname FROM pg_constraint
         WHERE conrelid = 'square_oauth_transactions'::regclass AND contype = 'u'
         ORDER BY conname`,
      );
      assert.deepEqual(constraints.rows.map((r) => r.conname), ["square_oauth_transactions_user_id_key"]);

      const marker = await admin.query(`SELECT marker FROM payment_methods WHERE user_id = 'seller-a'`);
      assert.equal(marker.rows[0].marker, "preexisting");
    });
  },
);

postgresTest(
  "upgrade: 20260928 against a database shaped like the earlier unmerged 20260927 succeeds, discards duplicate legacy rows, and never touches payment_methods",
  async () => {
    await withNamespace("p106_upgrade", async (admin) => {
      await admin.query(`INSERT INTO users VALUES ('seller-a'), ('seller-b')`);
      await admin.query(`INSERT INTO payment_methods (user_id, provider, marker) VALUES ('seller-a', 'square', 'preexisting')`);

      // Shape of the earlier, unmerged 20260927 migration: per-request rows,
      // no browser binding, naive `timestamp`, nonce-hash uniqueness, and a
      // superseded_at column.
      await admin.query(`
        CREATE TABLE square_oauth_transactions (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          nonce_hash varchar(64) NOT NULL UNIQUE,
          user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          claim_id varchar(64),
          created_at timestamp NOT NULL DEFAULT now(),
          expires_at timestamp NOT NULL,
          claimed_at timestamp,
          consumed_at timestamp,
          superseded_at timestamp
        );
        CREATE INDEX square_oauth_transactions_user_idx ON square_oauth_transactions (user_id);
        CREATE INDEX square_oauth_transactions_expiry_idx ON square_oauth_transactions (expires_at);
      `);

      // Duplicate legacy rows for the same user -- allowed under the old,
      // non-unique-per-user schema, and must not make constraint
      // installation fail once the hardening migration runs.
      await admin.query(
        `INSERT INTO square_oauth_transactions (nonce_hash, user_id, expires_at) VALUES
           ('${"d".repeat(64)}', 'seller-a', now() + interval '10 minutes'),
           ('${"e".repeat(64)}', 'seller-a', now() + interval '10 minutes'),
           ('${"f".repeat(64)}', 'seller-b', now() + interval '10 minutes')`,
      );

      await applyMigration(admin, "server:20260928_square_oauth_hardening.sql", hardeningMigration);

      const remaining = await admin.query(`SELECT count(*)::int AS n FROM square_oauth_transactions`);
      assert.equal(remaining.rows[0].n, 0);

      const constraints = await admin.query(
        `SELECT conname FROM pg_constraint
         WHERE conrelid = 'square_oauth_transactions'::regclass AND contype = 'u'
         ORDER BY conname`,
      );
      assert.deepEqual(constraints.rows.map((r) => r.conname), ["square_oauth_transactions_user_id_key"]);

      const columns = await admin.query(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_name = 'square_oauth_transactions'
           AND column_name IN ('created_at','expires_at','claimed_at','consumed_at','browser_binding_hash','superseded_at')`,
      );
      const byName = Object.fromEntries(columns.rows.map((r) => [r.column_name, r]));
      for (const column of ["created_at", "expires_at", "claimed_at", "consumed_at"]) {
        assert.equal(byName[column]?.data_type, "timestamp with time zone", `${column} is not timestamptz`);
      }
      assert.equal(byName.browser_binding_hash?.is_nullable, "NO");
      assert.equal(byName.superseded_at, undefined, "superseded_at should be dropped");

      const marker = await admin.query(`SELECT marker FROM payment_methods WHERE user_id = 'seller-a'`);
      assert.equal(marker.rows[0].marker, "preexisting");
    });
  },
);

postgresTest(
  "re-running 20260928 against an already-hardened database is a safe no-op (idempotent on repeated runs)",
  async () => {
    await withNamespace("p106_idempotent", async (admin) => {
      await applyMigration(admin, "server:20260927_square_oauth_transactions.sql", migration);
      await applyMigration(admin, "server:20260928_square_oauth_hardening.sql", hardeningMigration);
      // Applying the same file body a second time (simulating a manual re-run
      // outside the ledger) must not fail or duplicate the constraint.
      await applyMigration(admin, "server:20260928_square_oauth_hardening.sql:rerun", hardeningMigration);

      const constraints = await admin.query(
        `SELECT conname FROM pg_constraint
         WHERE conrelid = 'square_oauth_transactions'::regclass AND contype = 'u'`,
      );
      assert.equal(constraints.rowCount, 1);
    });
  },
);

// ---------------------------------------------------------------------------
// Round 2, Finding 3: expiration gates the initial claim, not post-claim
// persistence after ordinary Square provider latency.
// ---------------------------------------------------------------------------

postgresTest(
  "a transaction claimed just before expiry remains valid for final persistence after provider latency crosses expires_at",
  async () => {
    await withSchema(async ({ admin }) => {
      await admin.query(`INSERT INTO users VALUES ('seller-a'), ('seller-b')`);
      await admin.query(
        `INSERT INTO square_oauth_transactions (user_id, nonce_hash, browser_binding_hash, expires_at)
         VALUES ('seller-a', '${"7".repeat(64)}', '${"8".repeat(64)}', now() + interval '2 seconds')`,
      );

      const claimId = "claim-near-expiry";
      const claim = await admin.query(
        `UPDATE square_oauth_transactions SET claim_id = $3, claimed_at = now()
         WHERE nonce_hash = $1 AND browser_binding_hash = $2
           AND claimed_at IS NULL AND consumed_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        ["7".repeat(64), "8".repeat(64), claimId],
      );
      assert.equal(claim.rowCount, 1);

      // Simulate Square token-exchange + merchant-lookup latency crossing expires_at.
      await admin.query(`SELECT pg_sleep(2.2)`);
      const stillExpired = await admin.query(
        `SELECT expires_at < now() AS past_expiry FROM square_oauth_transactions WHERE user_id = 'seller-a'`,
      );
      assert.equal(stillExpired.rows[0].past_expiry, true);

      // Final persistence lookup mirrors server/routes/payouts.ts: ownership
      // by nonce/user/claim id plus consumed_at IS NULL, no expires_at check.
      const finalLookup = await admin.query(
        `SELECT id FROM square_oauth_transactions
         WHERE nonce_hash = $1 AND user_id = $2 AND claim_id = $3
           AND claimed_at IS NOT NULL AND consumed_at IS NULL`,
        ["7".repeat(64), "seller-a", claimId],
      );
      assert.equal(finalLookup.rowCount, 1, "an already-claimed transaction must survive provider latency past expires_at");

      // claim_id mismatch fails even though everything else matches.
      const wrongClaimId = await admin.query(
        `SELECT id FROM square_oauth_transactions
         WHERE nonce_hash = $1 AND user_id = $2 AND claim_id = $3
           AND claimed_at IS NOT NULL AND consumed_at IS NULL`,
        ["7".repeat(64), "seller-a", "not-the-real-claim-id"],
      );
      assert.equal(wrongClaimId.rowCount, 0);

      // nonce mismatch fails.
      const wrongNonce = await admin.query(
        `SELECT id FROM square_oauth_transactions
         WHERE nonce_hash = $1 AND user_id = $2 AND claim_id = $3
           AND claimed_at IS NOT NULL AND consumed_at IS NULL`,
        ["0".repeat(64), "seller-a", claimId],
      );
      assert.equal(wrongNonce.rowCount, 0);

      // Consuming the transaction, then looking it up again (replay of the
      // final persistence step) must fail: consumed_at IS NULL no longer holds.
      await admin.query(
        `UPDATE square_oauth_transactions SET consumed_at = now() WHERE nonce_hash = $1 AND claim_id = $2`,
        ["7".repeat(64), claimId],
      );
      const afterConsume = await admin.query(
        `SELECT id FROM square_oauth_transactions
         WHERE nonce_hash = $1 AND user_id = $2 AND claim_id = $3
           AND claimed_at IS NOT NULL AND consumed_at IS NULL`,
        ["7".repeat(64), "seller-a", claimId],
      );
      assert.equal(afterConsume.rowCount, 0, "replay after consumption must fail");

      // An unrelated transaction that expired before it was ever claimed can
      // never be claimed -- expiration still gates the initial claim.
      await admin.query(
        `INSERT INTO square_oauth_transactions (user_id, nonce_hash, browser_binding_hash, expires_at)
         VALUES ('seller-b', '${"9".repeat(64)}', '${"a".repeat(64)}', now() - interval '1 second')`,
      );
      const expiredUnclaimed = await admin.query(
        `UPDATE square_oauth_transactions SET claim_id = 'x', claimed_at = now()
         WHERE nonce_hash = $1 AND browser_binding_hash = $2
           AND claimed_at IS NULL AND consumed_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        ["9".repeat(64), "a".repeat(64)],
      );
      assert.equal(expiredUnclaimed.rowCount, 0, "an expired, never-claimed transaction must never become claimable");
    });
  },
);
