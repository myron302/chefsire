/** Part 3b low-level transaction primitives. Not wired to any close-account route. */
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { scrubMemberIdentityWithinClosure } from "./closure-identity-scrub";
import { redactOrdinaryDmWithinClosure, REDACTED_MEMBER_DM_BODY } from "./closure-message-redaction";

if (!PG_URL) {
  test("closure transaction primitives require CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("identity scrub preserves ledger joins, clears PII/auth, and DM redaction preserves booking/counterparty messages", async () => {
    const local = await connectLocalPg();
    const { users } = await import("../../shared/schema");
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS catering_booking_conversations, dm_messages, dm_threads, orders, users CASCADE;
        ${ddl(users, "users")};
        CREATE TABLE orders(id text PRIMARY KEY, buyer_id text REFERENCES users(id), seller_id text REFERENCES users(id));
        CREATE TABLE dm_threads(id text PRIMARY KEY);
        CREATE TABLE dm_messages(id text PRIMARY KEY, sender_id text REFERENCES users(id), thread_id text,
          body text NOT NULL, attachments jsonb NOT NULL DEFAULT '[]'::jsonb);
        CREATE TABLE catering_booking_conversations(booking_id text PRIMARY KEY, thread_id text UNIQUE);
      `);
      const [member] = (await local.query(`
        INSERT INTO users(username,email,display_name,first_name,last_name,phone,password,bio,avatar,
          google_id, facebook_id, instagram_id, tiktok_id, provider,
          catering_location, catering_enabled, daily_calorie_goal, macro_goals, dietary_restrictions,
          email_verified_at, email_verified_via, monthly_revenue)
        VALUES('oldname','original@example.test','Original Name','Original','Name','+18605551234',
          'secret-password','private bio','/uploads/avatar.jpg','google-sub','fb-sub','ig-sub','tiktok-sub',
          'google','Old Location',true,1200,'{"protein":20,"carbs":40,"fat":20}','["nuts"]',
          now(),'google',123.45)
        RETURNING id, auth_version
      `)).rows;
      const [counterparty] = (await local.query(
        "INSERT INTO users(username,email,display_name) VALUES('counterparty','other@example.test','Other') RETURNING id",
      )).rows;
      await local.query("INSERT INTO orders VALUES('order1',$1,$2)", [member.id,counterparty.id]);
      await local.query("INSERT INTO dm_threads VALUES('normal'),('booking')");
      await local.query("INSERT INTO dm_messages VALUES('m1',$1,'normal','Original private text','[{\"url\":\"/uploads/private.jpg\"}]')", [member.id]);
      await local.query("INSERT INTO dm_messages VALUES('m2',$1,'normal','Friend message','[]')", [counterparty.id]);
      await local.query("INSERT INTO dm_messages VALUES('m3',$1,'booking','Contract terms','[]')", [member.id]);
      await local.query("INSERT INTO catering_booking_conversations VALUES('booking1','booking')");

      const result = await db.transaction(async (tx: any) => {
        await tx.execute((await import("drizzle-orm")).sql`SELECT id FROM users WHERE id = ${member.id} FOR UPDATE`);
        const identity = await scrubMemberIdentityWithinClosure(tx, member.id);
        const redacted = await redactOrdinaryDmWithinClosure(tx, member.id);
        return { identity, redacted };
      });
      assert.equal(result.redacted, 1);
      assert.equal(result.identity.authVersion, member.auth_version + 1);
      const [scrubbed] = (await local.query("SELECT * FROM users WHERE id=$1",[member.id])).rows;
      assert.equal(scrubbed.display_name, "Deleted user");
      assert.match(scrubbed.username,/^deleted-[a-f0-9]{32}$/);
      assert.match(scrubbed.email,/^deleted\+[a-f0-9]{32}@deleted\.invalid$/);
      assert.ok(!scrubbed.username.includes(member.id),"tombstone doesn't encode account id");
      for(const field of ["first_name","last_name","phone","password","bio","avatar","google_id",
        "facebook_id","instagram_id","tiktok_id","provider","catering_location",
        "daily_calorie_goal","macro_goals","email_verified_at","email_verified_via"]) {
        assert.equal(scrubbed[field],null,`personal field ${field} cleared`);
      }
      assert.deepEqual(scrubbed.dietary_restrictions,[]);
      assert.equal(scrubbed.catering_enabled,false);
      assert.equal(scrubbed.monthly_revenue,"123.45","retained financial field stays unchanged");
      const joined = await local.query("SELECT u.display_name FROM orders o JOIN users u ON u.id=o.buyer_id WHERE o.id='order1'");
      assert.equal(joined.rows[0].display_name,"Deleted user");
      const messages = (await local.query("SELECT id, body, attachments FROM dm_messages ORDER BY id")).rows;
      assert.equal(messages[0].body,REDACTED_MEMBER_DM_BODY);
      assert.deepEqual(messages[0].attachments,[]);
      assert.equal(messages[1].body,"Friend message");
      assert.equal(messages[2].body,"Contract terms","booking message remains retained evidence");
      assert.equal(await db.transaction((tx: any)=>redactOrdinaryDmWithinClosure(tx,member.id)),0,"redaction retries are idempotent");

      await assert.rejects(db.transaction(async (tx: any) => {
        await tx.execute((await import("drizzle-orm")).sql`SELECT id FROM users WHERE id = ${counterparty.id} FOR UPDATE`);
        await scrubMemberIdentityWithinClosure(tx,counterparty.id);
        throw new Error("abort entire closure");
      }),/abort entire closure/);
      const [original] = (await local.query("SELECT username, display_name FROM users WHERE id=$1",[counterparty.id])).rows;
      assert.equal(original.username,"counterparty","rolled back transaction leaves member intact");
    } finally {
      await local.query("DROP TABLE IF EXISTS catering_booking_conversations, dm_messages, dm_threads, orders, users CASCADE");
      await local.end();
    }
  });
}
