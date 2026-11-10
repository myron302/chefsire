/** Part 3b: a stale HTTP/socket credential cannot write a DM after closure. */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { sql } from "drizzle-orm";
import { lockMemberForContentWrite, MemberContentWriteBlockedError } from "./member-content-write-lock";

async function lockWait(local: any, phrase: string): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const r = await local.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE $1",
      [`%${phrase}%`],
    );
    if (Number(r.rows[0]?.n) > 0) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("Expected concurrent member content writer to wait on account lock");
}

if (!PG_URL) {
  test("Member content close/write locking requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("closed accounts refuse personal writes; completed closure wins an in-flight sender lock", async () => {
    const local = await connectLocalPg();
    const { users } = await import("../../shared/schema");
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS dm_messages, users CASCADE;
        ${ddl(users, "users")};
        CREATE TABLE dm_messages (id text PRIMARY KEY, sender_id text, body text);
      `);
      const [member] = (await local.query(
        "INSERT INTO users (username,email,display_name) VALUES ('stale-sender','stale-sender@example.test','Sender') RETURNING id",
      )).rows;
      const sender = member.id as string;
      await db.transaction(async (tx: any) => {
        await lockMemberForContentWrite(tx, sender);
        await tx.execute(sql`INSERT INTO dm_messages (id,sender_id,body) VALUES ('original', ${sender}, 'existing message')`);
      });

      // Closure obtains the same users row lock and commits its terminal state.
      const closer = await local.connect();
      try {
        await closer.query("BEGIN");
        await closer.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [sender]);
        await closer.query("INSERT INTO account_status(user_id,status,reason) VALUES($1,'closed','Test closure')", [sender]);
        const pending = db.transaction(async (tx: any) => {
          await lockMemberForContentWrite(tx, sender);
          await tx.execute(sql`INSERT INTO dm_messages (id,sender_id,body) VALUES ('not-allowed', ${sender}, 'must not persist')`);
        });
        await lockWait(local, "FROM users WHERE id =");
        await closer.query("COMMIT");
        await assert.rejects(pending, (e: unknown) => e instanceof MemberContentWriteBlockedError);
      } finally {
        await closer.query("ROLLBACK").catch(() => undefined);
        closer.release();
      }
      assert.deepEqual((await local.query("SELECT id FROM dm_messages ORDER BY id")).rows, [{ id: "original" }]);
      await assert.rejects(
        db.transaction((tx: any) => lockMemberForContentWrite(tx, sender)),
        (e: unknown) => e instanceof MemberContentWriteBlockedError,
      );
    } finally {
      await local.query("DROP TABLE IF EXISTS dm_messages, users CASCADE");
      await local.end();
    }
  });

  test("an already-writing DM transaction finishes before closure can inspect and redact it", async () => {
    const local = await connectLocalPg();
    const { users } = await import("../../shared/schema");
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS dm_messages, users CASCADE;
        ${ddl(users, "users")};
        CREATE TABLE dm_messages (id text PRIMARY KEY, sender_id text, body text);
      `);
      const [member] = (await local.query(
        "INSERT INTO users (username,email,display_name) VALUES ('in-flight','in-flight@example.test','Sender') RETURNING id",
      )).rows;
      const sender = member.id as string;
      let signal!: () => void;
      let release!: () => void;
      const acquired = new Promise<void>(r => { signal = r; });
      const hold = new Promise<void>(r => { release = r; });
      const send = db.transaction(async (tx: any) => {
        await lockMemberForContentWrite(tx, sender);
        signal();
        await hold;
        await tx.execute(sql`INSERT INTO dm_messages (id,sender_id,body) VALUES ('in-flight', ${sender}, 'private content')`);
      });
      await acquired;
      const close = db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT id FROM users WHERE id = ${sender} FOR UPDATE`);
        const redacted = await tx.execute(sql`
          UPDATE dm_messages SET body='This message was removed' WHERE sender_id = ${sender}
        `);
        await tx.execute(sql`INSERT INTO account_status (user_id,status,reason)
          VALUES (${sender},'closed','Test closure')`);
        return redacted;
      });
      await lockWait(local, "FROM users WHERE id =");
      release();
      await send;
      await close;
      assert.deepEqual((await local.query("SELECT id,body FROM dm_messages")).rows,
        [{ id:"in-flight", body:"This message was removed" }],
        "the completed send must be visible to the subsequent locked redaction");
    } finally {
      await local.query("DROP TABLE IF EXISTS dm_messages, users CASCADE");
      await local.end();
    }
  });
}
