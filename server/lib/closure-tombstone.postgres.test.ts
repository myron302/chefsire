/** Part 3b internal tombstone primitive (not a closure endpoint). */
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { BACK_OFFICE_SQL, CLEAN_UP_BACK_OFFICE, DROP_BACK_OFFICE } from "../test-support/staff-portal-harness";
import { newClosedMemberIdentity, applyClosedMemberIdentityWithinTransaction } from "./closure-tombstone";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

const CLOSURE_SQL = readFileSync(
  new URL("../../docs/ops/2026-11-10-account-closure-preparation.sql", import.meta.url), "utf8",
);

test("anonymous tombstone identifiers have sufficient randomness and never disclose source identifiers", () => {
  const a = newClosedMemberIdentity();
  const b = newClosedMemberIdentity();
  assert.match(a.username, /^deleted-[a-f0-9]{32}$/);
  assert.match(a.email, /^deleted\+[a-f0-9]{32}@deleted\.invalid$/);
  assert.equal(a.displayName, "Deleted user");
  assert.notEqual(a.username, b.username);
  assert.notEqual(a.email, b.email);
});

if (!PG_URL) {
  test("tombstone primitive requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("tombstone preserves id and ledgers while clearing all known users-row PII", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { db } = await import("../db");
    const rowsOf = (value: any): any[] => value?.rows ?? (Array.isArray(value) ? value : []);
    try {
      await local.query(`
        ${DROP_BACK_OFFICE} DROP TABLE IF EXISTS orders, users CASCADE;
        ${ddl(schema.users, "users")};
        ${BACK_OFFICE_SQL}
        ${CLOSURE_SQL}
        CREATE TABLE orders (
          id varchar PRIMARY KEY, buyer_id varchar REFERENCES users(id),
          amount_cents integer NOT NULL
        );
      `);
      const [u] = (await local.query(`
        INSERT INTO users (username,email,display_name,phone,password,first_name,last_name,
          royal_title,bio,avatar,specialty,catering_enabled,catering_location,catering_bio,
          google_id,facebook_id,instagram_id,tiktok_id,provider,email_verified_at,
          email_verified_via,daily_calorie_goal,macro_goals,dietary_restrictions)
        VALUES ('original','original@real.example','Original Name','+18605551234','stored-hash',
          'First','Last','Chef','Private bio','https://cdn.example/a.png','Cuisine',
          true,'Confidential Address','Private notes','gid','fbid','iid','tid','google',
          now(),'google',2400,'{"protein":150,"carbs":200,"fat":70}'::jsonb,
          '["allergen"]'::jsonb)
        RETURNING id,auth_version
      `)).rows;
      await local.query("INSERT INTO orders(id,buyer_id,amount_cents) VALUES('purchase',$1,3500)", [u.id]);
      const identity = newClosedMemberIdentity();
      await db.transaction((tx: any) => applyClosedMemberIdentityWithinTransaction(tx, u.id, identity));
      const [user] = rowsOf(await db.execute(sql`SELECT * FROM users WHERE id = ${u.id}`));
      assert.equal(user.username, identity.username);
      assert.equal(user.email, identity.email);
      assert.equal(user.display_name, "Deleted user");
      assert.equal(user.auth_version, u.auth_version + 1);
      for (const field of [
        "phone","password","first_name","last_name","royal_title","bio","avatar","specialty",
        "catering_location","catering_bio","catering_latitude","catering_longitude",
        "google_id","facebook_id","instagram_id","tiktok_id","provider","email_verified_at",
        "email_verified_via","daily_calorie_goal","macro_goals",
      ]) assert.equal(user[field], null, `PII remains: ${field}`);
      assert.deepEqual(user.dietary_restrictions, []);
      assert.equal(user.catering_enabled, false);
      const [status] = rowsOf(await db.execute(sql`SELECT status FROM account_status WHERE user_id = ${u.id}`));
      assert.equal(status.status, "closed");
      const ledger = await local.query("SELECT buyer_id,amount_cents FROM orders WHERE id='purchase'");
      assert.deepEqual(ledger.rows, [{ buyer_id: u.id, amount_cents: 3500 }]);
      await assert.rejects(db.transaction((tx: any) => applyClosedMemberIdentityWithinTransaction(tx, u.id, newClosedMemberIdentity())),
        /already closed/);
      const unchanged = await local.query("SELECT username,email,auth_version FROM users WHERE id=$1", [u.id]);
      assert.deepEqual(unchanged.rows[0], {
        username: identity.username, email: identity.email, auth_version: u.auth_version + 1,
      }, "second invocation leaves tombstone untouched");
    } finally {
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS orders, users CASCADE;`);
      await local.end();
    }
  });
}
