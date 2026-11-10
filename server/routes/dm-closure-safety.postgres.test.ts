/** HTTP DM creation must refuse stale credentials after account closure. */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { testAuthHeader } from "../test-support/auth-test-env";

if (!PG_URL) {
  test("DM closure HTTP regression requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("stale closed-account tokens cannot create threads or messages; notification bodies contain no retained PII", async () => {
    const local = await connectLocalPg();
    const { users, notifications } = await import("../../shared/schema");
    const { default: dmRouter } = await import("./dm");
    const app = express();
    app.use(express.json());
    app.use("/api/dm", dmRouter);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        DROP TABLE IF EXISTS notifications, catering_booking_conversations, dm_messages, dm_participants, dm_threads, users CASCADE;
        ${ddl(users, "users")};
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
        ${ddl(notifications, "notifications")};
      `);
      const [closed, active, friend] = (await local.query(`
        INSERT INTO users(username,email,display_name) VALUES
          ('closed','closed@example.test','Old Person Name'),
          ('active','active@example.test','Active Member'),
          ('friend','friend@example.test','Friend')
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
      const accepted = await send("/api/dm/threads/shared/messages", active.id, { text: "Private content in DM" });
      assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
      assert.equal((await local.query("SELECT count(*)::int AS n FROM dm_messages")).rows[0].n, 1);
      const notifications = (await local.query("SELECT title,message FROM notifications ORDER BY id")).rows;
      assert.equal(notifications.length, 2);
      assert.ok(notifications.every((n: any) => n.title === "New message" &&
        n.message === "You have a new message."), "notification copies must not retain message text or old identity");
      const [created] = (await local.query("SELECT body,sender_id FROM dm_messages")).rows;
      assert.deepEqual(created, { body: "Private content in DM", sender_id: active.id });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS notifications, catering_booking_conversations, dm_messages, dm_participants, dm_threads, users CASCADE");
      await local.end();
    }
  });
}
