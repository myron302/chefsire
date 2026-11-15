/**
 * The socket send path's own closure/suspension safety, against a real database.
 *
 * The HTTP send path is covered by server/routes/dm-closure-safety.postgres.test.ts. This file
 * exists because the socket transport is a second, independent way into the same writes: a socket
 * authenticated before a status change stays connected, and the `send` event never goes back
 * through HTTP `requireAuth`. Asserting that the HTTP path refuses says nothing about this one.
 *
 * Real `attachDmRealtime`, real Socket.IO client, real PostgreSQL, default (database-backed)
 * membership check -- no injected lookup, because the point here is the lock, not the authorization
 * rule the other socket suites already cover.
 */
import "../test-support/accept-test-sessions";
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { attachDmRealtime } from "./dmSocket";

const tokenFor = (id: string) =>
  jwt.sign({ id, av: 1, email: `${id}@chefsire.test` }, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "5m" });

const SCHEMA = (usersDdl: string, notificationsDdl: string) => `
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
  throw new Error("Expected the socket send to wait on an account lock");
}

if (!PG_URL) {
  test("DM socket closure safety requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  /**
   * Each scenario lands its change while the send is already blocked inside the lock, which is the
   * only way to prove the recheck rather than the pre-check. Applied before the send instead, every
   * one of these would be refused by the handler's own pre-checks and prove nothing.
   */
  const scenarios = [
    {
      name: "a sender suspended while their socket send waits on the account lock is refused",
      expect: "MEMBER_CONTENT_WRITE_BLOCKED",
      barrier: "FROM users WHERE id =",
      apply: (holder: any, threadId: string, senderId: string) =>
        holder.query("INSERT INTO account_status(user_id,status,reason) VALUES($1,'suspended','Suspended mid-send')", [senderId]),
    },
    {
      name: "a sender removed from the thread while their socket send waits is refused",
      expect: "MEMBER_CONTENT_WRITE_BLOCKED",
      barrier: "FROM users WHERE id =",
      apply: (holder: any, threadId: string, senderId: string) =>
        holder.query("DELETE FROM dm_participants WHERE thread_id = $1 AND user_id = $2", [threadId, senderId]),
    },
    {
      name: "a thread claimed by a catering booking while a socket send waits is refused",
      expect: "MEMBER_CONTENT_WRITE_BLOCKED",
      barrier: "FROM users WHERE id =",
      apply: (holder: any, threadId: string) =>
        holder.query("INSERT INTO catering_booking_conversations(booking_id,thread_id) VALUES ('socket-booking',$1)", [threadId]),
    },
  ];

  for (const scenario of scenarios) {
    test(scenario.name, async () => {
      const local = await connectLocalPg();
      const { users, notifications } = await import("../../shared/schema");
      await local.query(SCHEMA(ddl(users, "users"), ddl(notifications, "notifications")));
      const [sender, other] = (await local.query(`
        INSERT INTO users(username,email,display_name) VALUES
          ('socket-sender','socket-sender@example.test','Socket Sender'),
          ('socket-other','socket-other@example.test','Other')
        RETURNING id
      `)).rows;
      await local.query("INSERT INTO dm_threads(id) VALUES('socket-thread')");
      await local.query("INSERT INTO dm_participants(thread_id,user_id) VALUES ('socket-thread',$1),('socket-thread',$2)",
        [sender.id, other.id]);

      const httpServer = http.createServer();
      const realtime = attachDmRealtime(httpServer);
      await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
      const address = httpServer.address();
      const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      let client: ClientSocket | undefined;
      const holder = await local.connect();
      try {
        client = await new Promise<ClientSocket>((resolve, reject) => {
          const socket = connect(`${url}/dm`, {
            path: "/socket.io",
            transports: ["websocket"],
            reconnection: false,
            forceNew: true,
            auth: { token: tokenFor(String(sender.id)) },
          });
          socket.on("connect", () => resolve(socket));
          socket.on("connect_error", (error: Error) => reject(error));
          setTimeout(() => reject(new Error("socket connect timeout")), 5000).unref?.();
        });

        const refusal = new Promise<any>((resolve, reject) => {
          client!.on("error", resolve);
          client!.on("message", () => reject(new Error("the send was broadcast rather than refused")));
          setTimeout(() => reject(new Error("no refusal arrived")), 15000).unref?.();
        });

        await holder.query("BEGIN");
        await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [sender.id]);
        client.emit("send", { threadId: "socket-thread", text: "Sent against stale state" });
        await lockWait(local, scenario.barrier);
        await scenario.apply(holder, "socket-thread", String(sender.id));
        await holder.query("COMMIT");

        const payload = await refusal;
        assert.equal(payload?.error, scenario.expect, JSON.stringify(payload));
        assert.equal((await local.query("SELECT count(*)::int AS n FROM dm_messages")).rows[0].n, 0,
          "a refused socket send must leave no message behind");
        assert.equal((await local.query("SELECT count(*)::int AS n FROM notifications")).rows[0].n, 0,
          "a refused socket send must notify nobody");
        assert.equal(
          (await local.query("SELECT count(*)::int AS n FROM dm_participants WHERE last_read_message_id IS NOT NULL")).rows[0].n,
          0,
          "a refused socket send must not move anyone's read marker",
        );
      } finally {
        await holder.query("ROLLBACK").catch(() => undefined);
        holder.release();
        client?.close();
        await realtime.namespace.server.close().catch(() => undefined);
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
        await local.query("DELETE FROM account_status WHERE user_id IN (SELECT id FROM users)").catch(() => undefined);
        await local.query("DROP TABLE IF EXISTS notifications, catering_booking_conversations, dm_messages, dm_participants, dm_threads, users CASCADE");
        await local.end();
      }
    });
  }

  test("an ordinary socket send still lands and notifies the other participant", async () => {
    const local = await connectLocalPg();
    const { users, notifications } = await import("../../shared/schema");
    await local.query(SCHEMA(ddl(users, "users"), ddl(notifications, "notifications")));
    const [sender, other] = (await local.query(`
      INSERT INTO users(username,email,display_name) VALUES
        ('socket-ok-sender','socket-ok-sender@example.test','Socket OK Sender'),
        ('socket-ok-other','socket-ok-other@example.test','Other')
      RETURNING id
    `)).rows;
    await local.query("INSERT INTO dm_threads(id) VALUES('socket-ok')");
    await local.query("INSERT INTO dm_participants(thread_id,user_id) VALUES ('socket-ok',$1),('socket-ok',$2)",
      [sender.id, other.id]);

    const httpServer = http.createServer();
    const realtime = attachDmRealtime(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    const address = httpServer.address();
    const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    let client: ClientSocket | undefined;
    try {
      client = await new Promise<ClientSocket>((resolve, reject) => {
        const socket = connect(`${url}/dm`, {
          path: "/socket.io",
          transports: ["websocket"],
          reconnection: false,
          forceNew: true,
          auth: { token: tokenFor(String(sender.id)) },
        });
        socket.on("connect", () => resolve(socket));
        socket.on("connect_error", (error: Error) => reject(error));
        setTimeout(() => reject(new Error("socket connect timeout")), 5000).unref?.();
      });
      // The send is broadcast to the thread's room, so join it first -- otherwise the sender's own
      // confirmation never arrives and the test would be measuring room membership, not the send.
      await new Promise<void>((resolve, reject) => {
        client!.once("joined", () => resolve());
        client!.once("error", (payload: any) => reject(new Error(`join refused: ${JSON.stringify(payload)}`)));
        client!.emit("join", { threadId: "socket-ok" });
        setTimeout(() => reject(new Error("no join confirmation arrived")), 10000).unref?.();
      });

      const delivered = new Promise<any>((resolve, reject) => {
        client!.on("message", resolve);
        client!.on("error", (payload: any) => reject(new Error(`refused: ${JSON.stringify(payload)}`)));
        setTimeout(() => reject(new Error("no message arrived")), 15000).unref?.();
      });
      client.emit("send", { threadId: "socket-ok", text: "An ordinary message" });
      const payload = await delivered;
      assert.equal(payload?.message?.body, "An ordinary message");

      const notified = (await local.query("SELECT user_id,title FROM notifications")).rows;
      assert.equal(notified.length, 1);
      assert.equal(notified[0].user_id, other.id);
      assert.equal(notified[0].title, "New message from Socket OK Sender");
    } finally {
      client?.close();
      await realtime.namespace.server.close().catch(() => undefined);
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS notifications, catering_booking_conversations, dm_messages, dm_participants, dm_threads, users CASCADE");
      await local.end();
    }
  });
}
