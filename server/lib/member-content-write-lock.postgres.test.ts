/** Part 3b: a stale HTTP/socket credential cannot write a DM after closure. */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { sql } from "drizzle-orm";
import {
  lockMemberForContentWrite,
  lockAvailableDmParticipants,
  MemberContentWriteBlockedError,
} from "./member-content-write-lock";

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
  /**
   * Why the status read is a SECOND statement rather than a join in the locking statement. This is
   * a characterization test of PostgreSQL at READ COMMITTED, not of our code: it shows both halves
   * of the trap directly, so nobody "simplifies" the two statements into one later. The positive
   * concurrency test below fails if that simplification is made; this one says why.
   */
  test("at READ COMMITTED a join inside the locking statement cannot see a status committed during the lock wait", async () => {
    const local = await connectLocalPg();
    const { users } = await import("../../shared/schema");
    try {
      await local.query(`DROP TABLE IF EXISTS users CASCADE; ${ddl(users, "users")};`);
      const [member] = (await local.query(
        "INSERT INTO users (username,email,display_name) VALUES ('snapshot','snapshot@example.test','Snapshot') RETURNING id",
      )).rows;
      const id = member.id as string;

      const holder = await local.connect();
      const observer = await local.connect();
      try {
        await holder.query("BEGIN");
        await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [id]);

        // The observer's locking statement starts before any status row exists, then blocks.
        await observer.query("BEGIN");
        const joined = observer.query(
          `SELECT u.id, st.status FROM users u
             LEFT JOIN account_status st ON st.user_id = u.id
            WHERE u.id = $1 FOR UPDATE OF u`,
          [id],
        );
        await lockWait(local, "FROM users u");

        // A status change commits while the observer waits.
        await holder.query("INSERT INTO account_status(user_id,status,reason) VALUES($1,'closed','Snapshot test')", [id]);
        await holder.query("COMMIT");

        // The waiting statement keeps the snapshot it started with, so the brand new status row is
        // invisible to it. A guard written this way would let the write through.
        assert.equal((await joined).rows[0].status, null,
          "the locking statement's own snapshot predates the status row, by design in PostgreSQL");

        // A fresh statement in the SAME transaction takes a new snapshot and sees it. That is the
        // only reason lockMemberForContentWrite re-reads instead of joining.
        const reread = await observer.query("SELECT status FROM account_status WHERE user_id = $1", [id]);
        assert.equal(reread.rows[0]?.status, "closed",
          "a second statement after the lock sees what the first could not");
      } finally {
        await observer.query("ROLLBACK").catch(() => undefined);
        await holder.query("ROLLBACK").catch(() => undefined);
        observer.release();
        holder.release();
      }
    } finally {
      await local.query("DELETE FROM account_status WHERE user_id IN (SELECT id FROM users)").catch(() => undefined);
      await local.query("DROP TABLE IF EXISTS users CASCADE");
      await local.end();
    }
  });

  /**
   * Participant lock ORDER, not just participant refusal.
   *
   * Two threads created with the same people in opposite orders deadlock only if the lock is taken
   * in the caller's order, so the property to prove is that the caller's order is irrelevant. A
   * "two concurrent creates in opposite orders" test cannot prove it: both rows are taken inside a
   * single statement microseconds apart, so it passes whether or not the ordering is there -- the
   * same false positive as the checkout-ordering test in stage 1.
   *
   * What does prove it: arrange the pair so physical heap order is the REVERSE of id order (a
   * bitmap heap scan without ORDER BY returns rows in heap order, so it would take the higher id
   * first), hold the LOWER id elsewhere, then call with the higher id as sender. If the lock is
   * id-ordered the call blocks on the lower row and has not touched the higher one, so a third
   * connection can still take the higher row with NOWAIT. Dropping ORDER BY fails exactly this.
   */
  test("participants are locked in id order, not in the order the caller supplied them", async () => {
    const local = await connectLocalPg();
    const { users } = await import("../../shared/schema");
    const { db } = await import("../db");
    try {
      await local.query(`DROP TABLE IF EXISTS users CASCADE; ${ddl(users, "users")};`);

      // Insert pairs until the first-inserted row (first in heap order) has the HIGHER id.
      let lower = "";
      let higher = "";
      for (let attempt = 0; attempt < 200 && !lower; attempt += 1) {
        await local.query("TRUNCATE users CASCADE");
        const inserted = (await local.query(`
          INSERT INTO users(username,email,display_name) VALUES
            ('order-a','order-a@example.test','A'),
            ('order-b','order-b@example.test','B')
          RETURNING id
        `)).rows.map((row: any) => String(row.id));
        if (inserted[0] > inserted[1]) {
          higher = inserted[0];
          lower = inserted[1];
        }
      }
      assert.ok(lower, "could not arrange a pair whose heap order reverses their id order");

      const holder = await local.connect();
      const probe = await local.connect();
      try {
        await holder.query("BEGIN");
        await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [lower]);

        // Caller order is deliberately [higher, lower]: the sender is the higher id.
        const pending = db.transaction((tx: any) => lockAvailableDmParticipants(tx, higher, [lower]));
        await lockWait(local, "WHERE id IN");

        await probe.query("BEGIN");
        await probe.query("SELECT id FROM users WHERE id = $1 FOR UPDATE NOWAIT", [higher]);
        await probe.query("ROLLBACK");

        await holder.query("ROLLBACK");
        await pending;
      } finally {
        await probe.query("ROLLBACK").catch(() => undefined);
        await holder.query("ROLLBACK").catch(() => undefined);
        probe.release();
        holder.release();
      }
    } finally {
      await local.query("DROP TABLE IF EXISTS users CASCADE");
      await local.end();
    }
  });

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
      // The HTTP restricted-write gate must not be bypassed by Socket.IO,
      // which does not pass through HTTP requireAuth on every event.
      await local.query("UPDATE account_status SET status='restricted' WHERE user_id=$1", [sender]);
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
