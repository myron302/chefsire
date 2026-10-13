/**
 * A database failure inside a notification-socket handler must not be echoed to the client.
 *
 * The handlers used to answer `socket.emit("error", { error: e?.message || "..." })`, which sends the driver's own message -- host names,
 * roles, SQL fragments -- to the connected user. The DM socket already refuses to do this; the notification socket now matches it: the
 * client gets a fixed message, the real error goes to the server log.
 */
import "../test-support/accept-test-sessions";
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://u:p@notification-socket-disclosure.invalid/none";

const { db } = await import("../db");
const { attachNotificationRealtime } = await import("./notificationSocket");

const SECRET = 'connect ECONNREFUSED ep-private-host.neon.tech:5432 role "neondb_owner" password authentication failed';
const token = jwt.sign({ id: "user-A", av: 1 }, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "5m" });

let httpServer: http.Server;
let client: ClientSocket;

test.before(async () => {
  for (const method of ["select", "update"]) (db as any)[method] = () => { throw new Error(SECRET); };
  httpServer = http.createServer();
  attachNotificationRealtime(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const url = `http://127.0.0.1:${(httpServer.address() as { port: number }).port}`;
  client = connect(`${url}/notifications`, { path: "/socket.io", transports: ["websocket"], reconnection: false, forceNew: true, auth: { token } });
  await new Promise<void>((resolve, reject) => { client.on("connect", () => resolve()); client.on("connect_error", reject); });
});

test.after(async () => {
  client.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

const errorAfter = (event: string, payload?: unknown) => new Promise<unknown>((resolve) => {
  client.once("error", resolve);
  client.emit(event, payload);
});

test("every handler answers a database failure with a fixed message and no driver text", async () => {
  const quiet = console.error;
  console.error = () => undefined;
  try {
    const cases: Array<[string, unknown, string]> = [
      ["get_unread_count", undefined, "Failed to get unread count"],
      ["mark_read", { notificationId: "n-1" }, "Failed to mark as read"],
      ["mark_all_read", undefined, "Failed to mark all as read"],
      ["get_recent", { limit: 5 }, "Failed to get recent notifications"],
    ];
    for (const [event, payload, expected] of cases) {
      const body = await errorAfter(event, payload);
      assert.deepEqual(body, { error: expected }, event);
      for (const leaked of ["ECONNREFUSED", "neon.tech", "neondb_owner", "password"]) assert.ok(!JSON.stringify(body).includes(leaked), `${event} leaked ${leaked}`);
    }
  } finally {
    console.error = quiet;
  }
});
