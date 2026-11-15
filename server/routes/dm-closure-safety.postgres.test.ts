/** HTTP DM creation must refuse stale credentials after account closure. */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { testAuthHeader } from "../test-support/auth-test-env";

const DM_SCHEMA = (usersDdl: string, notificationsDdl: string) => `
  DROP TABLE IF EXISTS notifications, catering_booking_conversations, dm_messages, dm_participants, dm_threads, users CASCADE;
  ${usersDdl};
  CREATE TABLE dm_threads(id varchar PRIMARY KEY DEFAULT gen_random_uuid(),is_group boolean NOT NULL DEFAULT false,
    title text,created_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE dm_participants(id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id varchar NOT NULL, user_id varchar NOT NULL,role text NOT NULL DEFAULT 'member',
    last_read_message_id varchar,last_read_at timestamp,notifications_muted boolean NOT NULL DEFAULT false,
    created_at timestamp DEFAULT now());
  CREATE TABLE dm_messages(id varchar PRIMARY KEY DEFAULT gen_random_uuid(),thread_id varchar NOT NULL,
    sender_id varchar NOT NULL,body text NOT NULL,attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp DEFAULT now());
  CREATE TABLE catering_booking_conversations(booking_id varchar PRIMARY KEY,thread_id varchar UNIQUE);
  ${notificationsDdl};
`;

/**
 * Wait until some backend is blocked on a lock whose query matches `phrase`. The send request runs
 * in this same process, so without this barrier there is nothing to synchronize against and the
 * test would be a race rather than a proof.
 */
async function lockWait(local: any, phrase: string): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const r = await local.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE $1",
      [`%${phrase}%`],
    );
    if (Number(r.rows[0]?.n) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Expected the DM send to wait on the sender's account lock");
}

if (!PG_URL) {
  test("DM closure HTTP regression requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("stale closed-account tokens cannot create threads or messages, and closed participants stop receiving alerts", async () => {
    const local = await connectLocalPg();
    const { users, notifications } = await import("../../shared/schema");
    const { default: dmRouter } = await import("./dm");
    const app = express();
    app.use(express.json());
    app.use("/api/dm", dmRouter);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(DM_SCHEMA(ddl(users, "users"), ddl(notifications, "notifications")));
      const [closed, active, friend, newRecipient] = (await local.query(`
        INSERT INTO users(username,email,display_name) VALUES
          ('closed','closed@example.test','Old Person Name'),
          ('active','active@example.test','Active Member'),
          ('friend','friend@example.test','Friend'),
          ('new-recipient','new-recipient@example.test','New Recipient')
        RETURNING id
      `)).rows;
      await local.query("INSERT INTO account_status(user_id,status,reason) VALUES($1,'closed','Test closed')", [closed.id]);
      await local.query("INSERT INTO dm_threads(id) VALUES('shared')");
      await local.query("INSERT INTO dm_participants(thread_id,user_id) VALUES ('shared',$1),('shared',$2),('shared',$3)",
        [closed.id, active.id, friend.id]);
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const send = async (path: string, userId: string, payload: unknown) => {
        const response = await fetch(base + path, {
          method: "POST",
          headers: { ...testAuthHeader(userId), "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        return { status: response.status, data: await response.json() };
      };
      const deniedMessage = await send("/api/dm/threads/shared/messages", closed.id, { text: "Old private message" });
      assert.equal(deniedMessage.status, 409, JSON.stringify(deniedMessage.data));
      assert.equal(deniedMessage.data.code, "MEMBER_CONTENT_WRITE_BLOCKED");
      const deniedThread = await send("/api/dm/threads", closed.id, { participantIds: [friend.id] });
      assert.equal(deniedThread.status, 409, JSON.stringify(deniedThread.data));
      const closedRecipient = await send("/api/dm/threads", active.id, { participantIds: [closed.id] });
      assert.equal(closedRecipient.status, 409, JSON.stringify(closedRecipient.data));
      assert.equal(closedRecipient.data.code, "MEMBER_CONTENT_WRITE_BLOCKED");
      const validThread = await send("/api/dm/threads", active.id, { participantIds: [newRecipient.id] });
      assert.equal(validThread.status, 200, JSON.stringify(validThread.data));
      assert.equal(validThread.data.reused, false);
      assert.ok(validThread.data.threadId);
      const accepted = await send("/api/dm/threads/shared/messages", active.id, { text: "Private content in DM" });
      assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
      assert.equal((await local.query("SELECT count(*)::int AS n FROM dm_messages")).rows[0].n, 1);
      const notificationRows = (await local.query("SELECT user_id,title,message FROM notifications ORDER BY id")).rows;
      assert.equal(notificationRows.length, 1, "closed participants must not receive new alerts");
      assert.equal(notificationRows[0].user_id, friend.id,
        "only the participant who can still receive gets the alert");
      // The sender's name and a preview are deliberately kept: this is the product's existing
      // notification copy, and it is not this change's business to degrade it. The flip side is
      // recorded for stage 3 -- a recipient's notification row holds the sender's name and text,
      // and that row is not reachable from the sender's own private-content erasure, so permanent
      // closure has to redact notifications that reference the closed member. See
      // docs/ops/part3b-closure-erasure-followups.md.
      assert.equal(notificationRows[0].title, "New message from Active Member");
      assert.equal(notificationRows[0].message, "Private content in DM");
      const [created] = (await local.query("SELECT body,sender_id FROM dm_messages")).rows;
      assert.deepEqual(created, { body: "Private content in DM", sender_id: active.id });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS notifications, catering_booking_conversations, dm_messages, dm_participants, dm_threads, users CASCADE");
      await local.end();
    }
  });

  /**
   * GPT's blocking finding on the first cut of this change: filtering recipients by status in one
   * statement and inserting in another left a window, so a recipient suspended between the two
   * still got the alert. The barrier here is the recipient's own users row, which the notification
   * transaction now takes.
   */
  test("a recipient suspended while the notification transaction waits on their row is not notified", async () => {
    const local = await connectLocalPg();
    const { users, notifications } = await import("../../shared/schema");
    const { default: dmRouter } = await import("./dm");
    const app = express();
    app.use(express.json());
    app.use("/api/dm", dmRouter);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(DM_SCHEMA(ddl(users, "users"), ddl(notifications, "notifications")));
      const [sender, suspended, stayer] = (await local.query(`
        INSERT INTO users(username,email,display_name) VALUES
          ('notify-sender','notify-sender@example.test','Notify Sender'),
          ('notify-suspended','notify-suspended@example.test','Suspended Soon'),
          ('notify-stayer','notify-stayer@example.test','Still Here')
        RETURNING id
      `)).rows;
      await local.query("INSERT INTO dm_threads(id) VALUES('notify')");
      await local.query("INSERT INTO dm_participants(thread_id,user_id) VALUES ('notify',$1),('notify',$2),('notify',$3)",
        [sender.id, suspended.id, stayer.id]);
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

      const holder = await local.connect();
      try {
        await holder.query("BEGIN");
        // Hold the recipient's row: the message itself commits, then the notification transaction
        // blocks here, which is exactly the window the old filter-then-insert left open.
        await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [suspended.id]);
        const pending = fetch(`${base}/api/dm/threads/notify/messages`, {
          method: "POST",
          headers: { ...testAuthHeader(sender.id), "content-type": "application/json" },
          body: JSON.stringify({ text: "Sent just before a suspension" }),
        });
        await lockWait(local, "FROM users WHERE id IN");
        await holder.query("INSERT INTO account_status(user_id,status,reason) VALUES($1,'suspended','Suspended mid-send')",
          [suspended.id]);
        await holder.query("COMMIT");
        const response = await pending;
        assert.equal(response.status, 200, JSON.stringify(await response.json()));
      } finally {
        await holder.query("ROLLBACK").catch(() => undefined);
        holder.release();
      }

      // The message is the sender's to write and stands. The alert to an account suspended during
      // the send does not.
      assert.equal((await local.query("SELECT count(*)::int AS n FROM dm_messages")).rows[0].n, 1);
      const notified = (await local.query("SELECT user_id FROM notifications ORDER BY user_id")).rows
        .map((row: any) => row.user_id);
      assert.deepEqual(notified, [stayer.id],
        "only the participant still able to receive at insert time may be notified");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DELETE FROM account_status WHERE user_id IN (SELECT id FROM users)").catch(() => undefined);
      await local.query("DROP TABLE IF EXISTS notifications, catering_booking_conversations, dm_messages, dm_participants, dm_threads, users CASCADE");
      await local.end();
    }
  });

  /**
   * The two rechecks inside the send transaction, each proved by making the change land while the
   * request is already blocked on the sender's users row. Both pass without their recheck if the
   * change is applied before the request starts, which is why the lock barrier is the test.
   */
  for (const scenario of [
    {
      name: "a sender removed from the thread while its send waits on the account lock is refused",
      apply: (holder: any, threadId: string, senderId: string) =>
        holder.query("DELETE FROM dm_participants WHERE thread_id = $1 AND user_id = $2", [threadId, senderId]),
    },
    {
      name: "a thread claimed by a catering booking while its send waits on the account lock is refused",
      apply: (holder: any, threadId: string) =>
        holder.query("INSERT INTO catering_booking_conversations(booking_id,thread_id) VALUES ('booking-1',$1)", [threadId]),
    },
  ]) {
    test(scenario.name, async () => {
      const local = await connectLocalPg();
      const { users, notifications } = await import("../../shared/schema");
      const { default: dmRouter } = await import("./dm");
      const app = express();
      app.use(express.json());
      app.use("/api/dm", dmRouter);
      const server = app.listen(0, "127.0.0.1");
      try {
        await local.query(DM_SCHEMA(ddl(users, "users"), ddl(notifications, "notifications")));
        const [sender, other] = (await local.query(`
          INSERT INTO users(username,email,display_name) VALUES
            ('racing-sender','racing-sender@example.test','Racing Sender'),
            ('racing-other','racing-other@example.test','Other')
          RETURNING id
        `)).rows;
        await local.query("INSERT INTO dm_threads(id) VALUES('racing')");
        await local.query("INSERT INTO dm_participants(thread_id,user_id) VALUES ('racing',$1),('racing',$2)",
          [sender.id, other.id]);
        const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        // Hold the sender's users row so the request blocks inside the content lock, AFTER the
        // handler's own pre-checks have already passed.
        const holder = await local.connect();
        try {
          await holder.query("BEGIN");
          await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [sender.id]);
          const pending = fetch(`${base}/api/dm/threads/racing/messages`, {
            method: "POST",
            headers: { ...testAuthHeader(sender.id), "content-type": "application/json" },
            body: JSON.stringify({ text: "Sent against stale state" }),
          });
          await lockWait(local, "FROM users WHERE id =");
          await scenario.apply(holder, "racing", sender.id);
          await holder.query("COMMIT");
          const response = await pending;
          const data: any = await response.json();
          assert.equal(response.status, 409, JSON.stringify(data));
          assert.equal(data.code, "MEMBER_CONTENT_WRITE_BLOCKED");
        } finally {
          await holder.query("ROLLBACK").catch(() => undefined);
          holder.release();
        }

        assert.equal((await local.query("SELECT count(*)::int AS n FROM dm_messages")).rows[0].n, 0,
          "a refused send must leave no message behind");
        assert.equal((await local.query("SELECT count(*)::int AS n FROM notifications")).rows[0].n, 0,
          "a refused send must notify nobody");
        assert.equal(
          (await local.query("SELECT count(*)::int AS n FROM dm_participants WHERE last_read_message_id IS NOT NULL")).rows[0].n,
          0,
          "a refused send must not move anyone's read marker",
        );
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await local.query("DROP TABLE IF EXISTS notifications, catering_booking_conversations, dm_messages, dm_participants, dm_threads, users CASCADE");
        await local.end();
      }
    });
  }
}
