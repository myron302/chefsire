/** Opt-in isolated PostgreSQL test. Never uses the application's DATABASE_URL. */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
import { PgDialect } from "drizzle-orm/pg-core";
process.env.DATABASE_URL ||= "postgresql://unused:unused@localhost/unused_test";
const { db } = await import("../db");
const { activateWeddingTrial, weddingEntitlement, revokeWeddingTrial } = await import("../lib/wedding-entitlement");
const migration = readFileSync(new URL("../drizzle/20261025_wedding_intro_trials.sql", import.meta.url), "utf8");

test("PostgreSQL migration enforces one trial under concurrent cross-tier inserts and preserves content", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const clients = [new pg.Client({ connectionString: process.env.TEST_DATABASE_URL }), new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })];
  const schema = `wedding_trial_test_${process.pid}_${Date.now()}`;
  await Promise.all(clients.map((c) => c.connect()));
  try {
    await clients[0].query(`CREATE SCHEMA "${schema}"`);
    for (const c of clients) await c.query(`SET search_path TO "${schema}"`);
    await clients[0].query(`CREATE TABLE users (id varchar PRIMARY KEY); INSERT INTO users VALUES ('a'), ('b');
      CREATE TABLE saved_content (user_id varchar REFERENCES users(id), category text, records jsonb);
      INSERT INTO saved_content SELECT 'a', category, jsonb_build_array(jsonb_build_object('id', n, 'attachment', 'r2/keep')) FROM unnest(ARRAY['guests','rsvps','budget','checklist','calendar','vendors','quotes','registry','documents','attachments']) category CROSS JOIN generate_series(1,200) n;
      CREATE TABLE subscription_history (id int PRIMARY KEY, status text); INSERT INTO subscription_history VALUES (1, 'legacy');`);
    await clients[0].query(migration);
    const before = (await clients[0].query("SELECT * FROM saved_content ORDER BY category, records::text")).rows;
    let turn = 0;
    t.mock.method(db, "execute", (statement: any) => {
      const query = new PgDialect().sqlToQuery(statement);
      return clients[turn++ % 2].query(query.sql, query.params);
    });
    const attempts = await Promise.all([activateWeddingTrial("a", "premium"), activateWeddingTrial("a", "elite")]);
    assert.equal(attempts.filter(Boolean).length, 1);
    const winner = attempts.find(Boolean)!;
    assert.equal(+new Date(winner.expiresAt!) - +new Date(winner.activatedAt!), 336 * 3600000);
    assert.equal(await activateWeddingTrial("a", "premium"), null);
    assert.equal(await activateWeddingTrial("a", "elite"), null);
    assert.equal((await weddingEntitlement("b", "elite")).currentTier, "free");
    await assert.rejects(clients[0].query("INSERT INTO wedding_intro_trials (user_id,tier) VALUES ('b','free')"));
    await assert.rejects(clients[0].query("INSERT INTO wedding_intro_trials (user_id,tier,expires_at) VALUES ('b','elite',statement_timestamp() + interval '30 days')"));
    await clients[0].query("UPDATE wedding_intro_trials SET activated_at = statement_timestamp() - interval '336 hours', expires_at = statement_timestamp() WHERE user_id = 'a'");
    const expired = await weddingEntitlement("a", "elite");
    assert.equal(expired.currentTier, "free");
    assert.equal(expired.trial.status, "expired");
    assert.equal(expired.trial.remainingDays, 0);
    await revokeWeddingTrial("a");
    assert.equal(await activateWeddingTrial("a", "elite"), null);
    await clients[0].query(migration); // Rerun never resets eligibility or history.
    assert.equal((await clients[0].query("SELECT * FROM subscription_history")).rows[0].status, "legacy");
    assert.deepEqual((await clients[0].query("SELECT * FROM saved_content ORDER BY category, records::text")).rows, before);
  } finally {
    await clients[0].query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await Promise.all(clients.map((c) => c.end()));
  }
});
