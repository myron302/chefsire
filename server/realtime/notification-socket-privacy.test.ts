/**
 * Notification-stream isolation (P1 WebSocket identity).
 *
 * Before this repair a client chose its own notification room by naming a user in the handshake:
 * connect as anybody, supply someone else's id, receive their notifications. There was never a
 * "subscribe" event to abuse — the room was simply `user-${whatever the client said}`.
 *
 * These tests run the REAL `attachNotificationRealtime` over a real HTTP server and assert against
 * the namespace's own adapter: which rooms the server put each socket in, and who actually
 * received an emit. No database is needed — the room join happens on connection, before any
 * handler touches storage.
 */
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

import { attachNotificationRealtime } from "./notificationSocket";
import { AUTH_TOKEN_COOKIE } from "./socket-auth";

const A = "user-A";
const B = "user-B";

const tokenFor = (id: string, options: jwt.SignOptions = { expiresIn: "5m" }) =>
  jwt.sign({ id, email: `${id}@chefsire.test` }, TEST_JWT_SECRET, { algorithm: "HS256", ...options });

let httpServer: http.Server;
let realtime: ReturnType<typeof attachNotificationRealtime>;
let url = "";
const open: ClientSocket[] = [];

test.before(async () => {
  httpServer = http.createServer();
  realtime = attachNotificationRealtime(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const address = httpServer.address();
  url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

test.after(async () => {
  for (const socket of open) socket.close();
  await realtime.namespace.server.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

type Attempt = { ok: true; socket: ClientSocket; serverSocketId: string } | { ok: false; message: string };

function attempt(opts: { auth?: Record<string, unknown>; headers?: Record<string, string> }): Promise<Attempt> {
  return new Promise((resolve) => {
    const socket = connect(`${url}/notifications`, {
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      auth: opts.auth ?? {},
      extraHeaders: opts.headers ?? {},
    });
    const settle = (result: Attempt) => {
      if (result.ok) open.push(result.socket);
      else socket.close();
      resolve(result);
    };
    socket.on("connect", () => settle({ ok: true, socket, serverSocketId: socket.id! }));
    socket.on("connect_error", (error: Error) => settle({ ok: false, message: error.message }));
    setTimeout(() => settle({ ok: false, message: "timeout" }), 4000).unref?.();
  });
}

/** The rooms the SERVER placed this socket in. */
function serverRooms(socketId: string): string[] {
  const socket = realtime.namespace.sockets.get(socketId);
  assert.ok(socket, "the server should still hold this socket");
  return [...socket.rooms].filter((room) => room !== socketId);
}

/** Emit into a room and report whether this client heard it, within a short window. */
function heard(socket: ClientSocket, room: string, event: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: boolean) => { if (!done) { done = true; resolve(value); } };
    socket.once(event, () => finish(true));
    realtime.namespace.to(room).emit(event, { probe: true });
    setTimeout(() => finish(false), 300).unref?.();
  });
}

/* ------------------------------------------------------------------- cases */

test("A connects with A's token and is placed in A's notification room only", async () => {
  const result = await attempt({ auth: { token: tokenFor(A) } });
  assert.equal(result.ok, true);
  assert.deepEqual(serverRooms((result as { serverSocketId: string }).serverSocketId), [`user-${A}`]);
});

test("A's cookie works the same way the browser uses it", async () => {
  const result = await attempt({ headers: { cookie: `${AUTH_TOKEN_COOKIE}=${tokenFor(A)}` } });
  assert.equal(result.ok, true);
  assert.deepEqual(serverRooms((result as { serverSocketId: string }).serverSocketId), [`user-${A}`]);
});

test("a forged handshake userId does not subscribe A to B's stream", async () => {
  const result = await attempt({ auth: { token: tokenFor(A), userId: B } });
  assert.equal(result.ok, true);
  const rooms = serverRooms((result as { serverSocketId: string }).serverSocketId);
  assert.deepEqual(rooms, [`user-${A}`]);
  assert.equal(rooms.includes(`user-${B}`), false, "B's room must never be joined");
});

test("a forged x-user-id header does not subscribe A to B's stream", async () => {
  const result = await attempt({ auth: { token: tokenFor(A) }, headers: { "x-user-id": B } });
  assert.equal(result.ok, true);
  assert.deepEqual(serverRooms((result as { serverSocketId: string }).serverSocketId), [`user-${A}`]);
});

test("B's notifications are never delivered to A", async () => {
  const result = await attempt({ auth: { token: tokenFor(A), userId: B } });
  assert.equal(result.ok, true);
  const socket = (result as { socket: ClientSocket }).socket;

  assert.equal(await heard(socket, `user-${B}`, "new_notification"), false, "A must not receive B's stream");
  assert.equal(await heard(socket, `user-${A}`, "new_notification"), true, "A must receive its own stream");
});

test("naming a user without a token subscribes to nothing", async () => {
  for (const options of [{ auth: { userId: B } }, { headers: { "x-user-id": B } }, {}]) {
    const result = await attempt(options);
    assert.equal(result.ok, false, "an unauthenticated connection must be refused");
    assert.equal((result as { message: string }).message, "unauthorized");
  }
  // And nothing was left in B's room by the attempts.
  assert.equal(realtime.namespace.adapter.rooms.get(`user-${B}`)?.size ?? 0, 0);
});

test("an invalid, tampered or expired token subscribes to nothing", async () => {
  const [header, , signature] = tokenFor(A).split(".");
  const tampered = `${header}.${Buffer.from(JSON.stringify({ id: B })).toString("base64url").replace(/=+$/, "")}.${signature}`;
  const wrongSecret = jwt.sign({ id: B }, "another-secret-0123456789abcdefgh", { algorithm: "HS256", expiresIn: "5m" });

  for (const token of ["garbage", tampered, wrongSecret, tokenFor(B, { expiresIn: -1 })]) {
    const result = await attempt({ auth: { token } });
    assert.equal(result.ok, false, `token ${token.slice(0, 12)}… must be refused`);
  }
  assert.equal(realtime.namespace.adapter.rooms.get(`user-${B}`)?.size ?? 0, 0, "B's room must still be empty");
});
