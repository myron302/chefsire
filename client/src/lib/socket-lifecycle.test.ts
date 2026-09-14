/**
 * Socket cache lifecycle: a socket that cannot authenticate must never stay cached.
 *
 * The bug this locks down: the cache only let go on `disconnect` with "io server disconnect",
 * which is what an *already connected* socket gets when its token expires. A handshake the server
 * refuses never reaches `disconnect` at all — it surfaces as `connect_error`, and Socket.IO does
 * not retry a connection the server denied. So a socket created while logged out stayed in the
 * cache permanently dead, and every later caller got that same corpse back. Logging in did not
 * help; only a page refresh did.
 *
 * The first half of this file drives the REAL cache against the REAL authentication middleware
 * over a real Socket.IO server, so "rejected, then logged in, then connected" is an actual
 * sequence of handshakes rather than a simulation. The second half drives the same cache with a
 * scripted connector, because some cases -- a transport blip, a late event from a replaced socket
 * -- cannot be produced on demand from a real network.
 */
import { TEST_JWT_SECRET } from "../../../server/test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { io as connect, type Socket } from "socket.io-client";

import { attachDmRealtime } from "../../../server/realtime/dmSocket";
import { createSocketCache, type SocketConnector } from "./socket";
import { SOCKET_AUTH_ERROR_CODE, isTerminalSocketAuthError } from "@shared/realtime-auth";

const A = "user-A";
const THREAD_A = "thread-with-A";
const DM = "/dm";

const validToken = (id = A) =>
  jwt.sign({ id, email: `${id}@chefsire.test` }, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "7d" });
const expiredToken = (id = A) =>
  jwt.sign({ id, exp: Math.floor(Date.now() / 1000) - 60 }, TEST_JWT_SECRET, { algorithm: "HS256" });

/* --------------------------------------------------- a real authenticating server */

let server: http.Server;
let realtime: ReturnType<typeof attachDmRealtime>;
let url = "";
const membershipQuestions: { threadId: string; userId: string }[] = [];

test.before(async () => {
  server = http.createServer();
  realtime = attachDmRealtime(server, {
    isThreadParticipant: async (threadId, userId) => {
      membershipQuestions.push({ threadId, userId });
      return threadId === THREAD_A && userId === A;
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

test.after(async () => {
  await realtime.namespace.server.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** A cache whose sockets really talk to the server above. Reconnection off: one decisive attempt. */
const liveCache = () =>
  createSocketCache(((namespace, options) =>
    connect(`${url}${namespace}`, { ...options, reconnection: false, forceNew: true })) as SocketConnector);

/** Resolve once this socket has connected or been refused. */
function outcome(socket: Socket, ceilingMs = 5000): Promise<"connected" | "refused" | "timeout"> {
  return new Promise((resolve) => {
    let done = false;
    const settle = (value: "connected" | "refused" | "timeout") => { if (!done) { done = true; resolve(value); } };
    if (socket.connected) return settle("connected");
    socket.on("connect", () => settle("connected"));
    socket.on("connect_error", () => settle("refused"));
    setTimeout(() => settle("timeout"), ceilingMs).unref?.();
  });
}

/** Let the cache's own `connect_error` handler run before inspecting the cache. */
const settleHandlers = () => new Promise((resolve) => setTimeout(resolve, 50));

/* ----------------------------------------------- real server: rejection then login */

test("a handshake the server refuses is evicted, and the next call builds a new socket", async () => {
  const cache = liveCache();

  // The exact shape Codex described: the helper is called before there is any credential.
  const rejected = cache.get(DM); // no token at all
  assert.equal(await outcome(rejected), "refused");
  await settleHandlers();

  assert.equal(cache.peek(DM), null, "a socket that cannot authenticate must not stay cached");

  const replacement = cache.get(DM, validToken());
  assert.notEqual(replacement, rejected, "the next call must build a NEW Socket.IO instance");
  assert.equal(await outcome(replacement), "connected");
  cache.closeAll();
});

test("logging in after a rejected connection works without a page refresh", async () => {
  const cache = liveCache();

  // 1-5: no credential, helper called, refused, evicted.
  const first = cache.get(DM);
  assert.equal(await outcome(first), "refused");
  await settleHandlers();
  assert.equal(cache.peek(DM), null);

  // 6-10: a credential now exists; the next helper call authenticates and can act as that user.
  const second = cache.get(DM, validToken());
  assert.equal(await outcome(second), "connected");
  assert.notEqual(second, first);

  const before = membershipQuestions.length;
  second.emit("join", { threadId: THREAD_A });
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.deepEqual(
    membershipQuestions.slice(before),
    [{ threadId: THREAD_A, userId: A }],
    "the fresh socket is authenticated as the token's user and may act",
  );
  cache.closeAll();
});

test("an expired explicit token is evicted and a valid one then succeeds", async () => {
  const cache = liveCache();

  const stale = cache.get(DM, expiredToken());
  assert.equal(await outcome(stale), "refused");
  await settleHandlers();
  assert.equal(cache.peek(DM), null);

  const fresh = cache.get(DM, validToken());
  assert.notEqual(fresh, stale);
  assert.equal(await outcome(fresh), "connected");
  cache.closeAll();
});

test("every kind of bad credential is refused as the same public category", async () => {
  const [header, , signature] = validToken().split(".");
  const tampered = `${header}.${Buffer.from(JSON.stringify({ id: "user-B" })).toString("base64url").replace(/=+$/, "")}.${signature}`;
  const wrongSecret = jwt.sign({ id: A }, "another-secret-0123456789abcdefgh", { algorithm: "HS256", expiresIn: "5m" });

  const seen: unknown[] = [];
  for (const auth of [undefined, "garbage", expiredToken(), tampered, wrongSecret]) {
    const socket = connect(`${url}${DM}`, {
      path: "/socket.io",
      reconnection: false,
      forceNew: true,
      transports: ["websocket"],
      ...(auth ? { auth: { token: auth } } : {}),
    });
    const error: any = await new Promise((resolve) => {
      socket.on("connect_error", resolve);
      setTimeout(() => resolve(new Error("timeout")), 5000).unref?.();
    });
    seen.push({ message: error.message, data: error.data, active: socket.active });
    socket.close();
  }

  for (const entry of seen) {
    // One category, every time: missing, malformed, expired, tampered and wrong-secret are
    // indistinguishable from outside. Nothing says which it was.
    assert.deepEqual(entry, { message: "unauthorized", data: { code: SOCKET_AUTH_ERROR_CODE }, active: false });
  }
  // And that single category is exactly what the client treats as terminal.
  assert.equal(isTerminalSocketAuthError(false, { data: { code: SOCKET_AUTH_ERROR_CODE } }), true);
});

/* --------------------------------------------- scripted connector: the edge cases */

/** The smallest socket-shaped object the cache interacts with. */
function fakeSocket() {
  const handlers = new Map<string, ((...args: any[]) => void)[]>();
  const socket = {
    active: true,
    closed: 0,
    on(event: string, handler: (...args: any[]) => void) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return socket;
    },
    close() {
      socket.closed += 1;
      return socket;
    },
    fire(event: string, ...args: unknown[]) {
      for (const handler of handlers.get(event) ?? []) handler(...args);
    },
  };
  return socket;
}

type Fake = ReturnType<typeof fakeSocket>;

function scriptedCache() {
  const built: Fake[] = [];
  const cache = createSocketCache(((_namespace, _options) => {
    const socket = fakeSocket();
    built.push(socket);
    return socket as unknown as Socket;
  }) as SocketConnector);
  return { cache, built };
}

const authError = () => Object.assign(new Error("unauthorized"), { data: { code: SOCKET_AUTH_ERROR_CODE } });

test("an ordinary transport failure keeps its socket cached and is left to reconnect", () => {
  const { cache, built } = scriptedCache();
  const socket = cache.get(DM);

  // A network blip: Socket.IO stays active and will retry on its own.
  socket.active = true as never;
  (built[0] as Fake).fire("connect_error", new Error("xhr poll error"));

  assert.equal(cache.peek(DM), socket, "a transport failure must not evict a healthy socket");
  assert.equal((built[0] as Fake).closed, 0, "and must not close it out from under Socket.IO");
  assert.equal(cache.get(DM), socket, "the same instance is reused, so reconnection continues");
  assert.equal(built.length, 1, "no replacement socket is built for a transient failure");
});

test("a server-denied connection with no recognised code is still terminal", () => {
  const { cache, built } = scriptedCache();
  cache.get(DM);

  // `active === false` is Socket.IO's own "the server denied this connection".
  (built[0] as Fake).active = false;
  (built[0] as Fake).fire("connect_error", new Error("something else"));

  assert.equal(cache.peek(DM), null);
});

test("eviction never retries: no replacement is built inside the error handler", () => {
  const { cache, built } = scriptedCache();
  cache.get(DM);

  (built[0] as Fake).active = false;
  (built[0] as Fake).fire("connect_error", authError());

  assert.equal(built.length, 1, "the failed attempt stays failed — no loop, no immediate retry");
  assert.equal(cache.peek(DM), null);

  // Only a later, deliberate call creates the next one.
  cache.get(DM);
  assert.equal(built.length, 2);
});

test("a late event from a replaced socket cannot evict the newer one", () => {
  const { cache, built } = scriptedCache();
  const first = cache.get(DM);

  // The first socket is refused and evicted; the app immediately opens a replacement.
  (built[0] as Fake).active = false;
  (built[0] as Fake).fire("connect_error", authError());
  const second = cache.get(DM);
  assert.notEqual(second, first);
  assert.equal(cache.peek(DM), second);

  // Now a straggler from the dead socket arrives.
  (built[0] as Fake).fire("connect_error", authError());
  (built[0] as Fake).fire("disconnect", "io server disconnect");

  assert.equal(cache.peek(DM), second, "the live replacement must survive its predecessor's events");
});

test("a connected socket disconnected by the server at auth expiry is evicted, without a retry", () => {
  const { cache, built } = scriptedCache();
  const socket = cache.get(DM);

  (built[0] as Fake).fire("disconnect", "io server disconnect");

  assert.equal(cache.peek(DM), null);
  assert.equal((built[0] as Fake).closed, 1);
  assert.equal(built.length, 1, "no reconnect loop with the expired credential");

  const replacement = cache.get(DM);
  assert.notEqual(replacement, socket);
  assert.equal(built.length, 2);
});

test("an ordinary disconnect leaves the socket cached for Socket.IO to reconnect", () => {
  const { cache, built } = scriptedCache();
  const socket = cache.get(DM);

  (built[0] as Fake).fire("disconnect", "transport close");

  assert.equal(cache.peek(DM), socket);
  assert.equal((built[0] as Fake).closed, 0);
});

test("eviction is per namespace and never touches the other one", () => {
  const { cache, built } = scriptedCache();
  const dm = cache.get("/dm");
  const notifications = cache.get("/notifications");

  (built[0] as Fake).active = false;
  (built[0] as Fake).fire("connect_error", authError());

  assert.equal(cache.peek("/dm"), null);
  assert.equal(cache.peek("/notifications"), notifications, "an unrelated namespace must be untouched");
  assert.notEqual(dm, notifications);
});

test("closeAll closes and forgets every cached socket", () => {
  const { cache, built } = scriptedCache();
  cache.get("/dm");
  cache.get("/notifications");

  cache.closeAll();

  assert.equal(cache.peek("/dm"), null);
  assert.equal(cache.peek("/notifications"), null);
  for (const socket of built) assert.equal(socket.closed, 1, "logout must close, not merely forget");

  // And a later login builds fresh instances.
  cache.get("/dm");
  assert.equal(built.length, 3);
});

test("the terminal-error rule itself", () => {
  // Refused credential: terminal however Socket.IO reports activity.
  assert.equal(isTerminalSocketAuthError(false, { data: { code: SOCKET_AUTH_ERROR_CODE } }), true);
  assert.equal(isTerminalSocketAuthError(true, { data: { code: SOCKET_AUTH_ERROR_CODE } }), true);
  // Server denied the connection outright: terminal, because nothing will retry it.
  assert.equal(isTerminalSocketAuthError(false, undefined), true);
  assert.equal(isTerminalSocketAuthError(false, new Error("nope")), true);
  // Transport trouble: not terminal, Socket.IO's own lifecycle handles it.
  assert.equal(isTerminalSocketAuthError(true, undefined), false);
  assert.equal(isTerminalSocketAuthError(true, new Error("xhr poll error")), false);
  assert.equal(isTerminalSocketAuthError(true, { data: { code: "something-else" } }), false);
});
