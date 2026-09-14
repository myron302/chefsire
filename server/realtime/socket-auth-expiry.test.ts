/**
 * A socket must not outlive the credential that opened it.
 *
 * The handshake already rejected an *already* expired token. What it did not do was enforce the
 * boundary afterwards: `socket.data.userId` stayed authoritative for as long as the transport
 * stayed open, so a client that connected one second before `exp` kept receiving private
 * notifications, kept sitting in private rooms, and kept sending DMs, typing and marking messages
 * read — indefinitely. Reconnect authentication does not help an uninterrupted socket.
 *
 * Enforcement lives in the shared middleware, so these tests exercise both real namespaces through
 * a real Socket.IO server and the real `socket.io-client`, and assert against the server's own
 * adapter rather than what the client believes.
 *
 * On timing: `exp` is second-granular, so a token minted for "now + 2s" has between 1 and 2
 * seconds of real life. Nothing here sleeps for a fixed span and hopes — every wait is on an
 * actual event (`disconnect`, a delivered notification) with a generous ceiling, so the tests are
 * decided by observed server behaviour rather than by a race with the clock.
 */
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

import { attachDmRealtime } from "./dmSocket";
import { attachNotificationRealtime } from "./notificationSocket";
import { armedAuthExpiryTimerCount, verifiedExpiryMs } from "./socket-auth";

const A = "user-A";
const THREAD_A = "thread-with-A";

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** A token that is valid now and expires in `seconds`, with a real verified `exp`. */
const shortLivedToken = (id: string, seconds: number) =>
  jwt.sign({ id, email: `${id}@chefsire.test`, exp: nowSeconds() + seconds }, TEST_JWT_SECRET, {
    algorithm: "HS256",
  });

const longLivedToken = (id: string) =>
  jwt.sign({ id }, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "7d" });

/* ----------------------------------------------------------------- harness */

let dmServer: http.Server;
let notificationServer: http.Server;
let dm: ReturnType<typeof attachDmRealtime>;
let notifications: ReturnType<typeof attachNotificationRealtime>;
let dmUrl = "";
let notificationUrl = "";
let membershipQuestions: { threadId: string; userId: string }[] = [];
const open: ClientSocket[] = [];

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

test.before(async () => {
  dmServer = http.createServer();
  dm = attachDmRealtime(dmServer, {
    isThreadParticipant: async (threadId, userId) => {
      membershipQuestions.push({ threadId, userId });
      return threadId === THREAD_A && userId === A;
    },
  });
  dmUrl = await listen(dmServer);

  notificationServer = http.createServer();
  notifications = attachNotificationRealtime(notificationServer);
  notificationUrl = await listen(notificationServer);
});

test.after(async () => {
  for (const socket of open) socket.close();
  await dm.namespace.server.close();
  await notifications.namespace.server.close();
  await new Promise<void>((resolve) => dmServer.close(() => resolve()));
  await new Promise<void>((resolve) => notificationServer.close(() => resolve()));
});

test.beforeEach(() => {
  membershipQuestions = [];
});

type Attempt = { ok: true; socket: ClientSocket } | { ok: false; message: string };

function attempt(url: string, namespace: string, auth: Record<string, unknown>): Promise<Attempt> {
  return new Promise((resolve) => {
    const socket = connect(`${url}${namespace}`, {
      path: "/socket.io",
      transports: ["websocket"],
      // Reconnection off so a test never silently re-authenticates behind its own assertion.
      reconnection: false,
      forceNew: true,
      auth,
    });
    let done = false;
    const settle = (result: Attempt) => {
      if (done) return;
      done = true;
      if (result.ok) open.push(result.socket);
      else socket.close();
      resolve(result);
    };
    socket.on("connect", () => settle({ ok: true, socket }));
    socket.on("connect_error", (error: Error) => settle({ ok: false, message: error.message }));
    setTimeout(() => settle({ ok: false, message: "timeout" }), 5000).unref?.();
  });
}

async function connectOk(url: string, namespace: string, auth: Record<string, unknown>) {
  const result = await attempt(url, namespace, auth);
  assert.equal(result.ok, true, `expected a connection, got ${(result as { message?: string }).message}`);
  return (result as { socket: ClientSocket }).socket;
}

/** Resolve when the server closes this socket, or `null` if it stays open past the ceiling. */
function waitForDisconnect(socket: ClientSocket, ceilingMs = 6000): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const settle = (reason: string | null) => { if (!done) { done = true; resolve(reason); } };
    socket.on("disconnect", (reason: string) => settle(reason));
    setTimeout(() => settle(null), ceilingMs).unref?.();
  });
}

/** The first of these events to arrive, or `null` within the window. */
function waitForEvent(socket: ClientSocket, event: string, windowMs = 400): Promise<unknown | null> {
  return new Promise((resolve) => {
    let done = false;
    const settle = (value: unknown | null) => { if (!done) { done = true; resolve(value); } };
    socket.once(event, (payload: unknown) => settle(payload ?? {}));
    setTimeout(() => settle(null), windowMs).unref?.();
  });
}

/* ------------------------------------------------------- the expiry boundary */

test("a socket connected before expiry is disconnected by the server at expiry", async () => {
  const socket = await connectOk(dmUrl, "/dm", { token: shortLivedToken(A, 2) });
  assert.equal(socket.connected, true, "the connection must succeed while the token is valid");

  const reason = await waitForDisconnect(socket);
  assert.equal(reason, "io server disconnect", "the SERVER must end the socket, not the client");
});

test("the socket is told only that its authorization expired", async () => {
  const socket = await connectOk(dmUrl, "/dm", { token: shortLivedToken(A, 2) });

  const payload = (await waitForEvent(socket, "auth_expired", 6000)) as { code?: string } | null;
  assert.deepEqual(payload, { code: "auth_expired" });
  // No expiry timestamp, no claims, no token, no configuration detail.
  assert.deepEqual(Object.keys(payload ?? {}), ["code"]);

  await waitForDisconnect(socket);
});

/* --------------------------------------------------- notification cutoff */

test("private notifications stop at expiry, and the room no longer holds the socket", async () => {
  const socket = await connectOk(notificationUrl, "/notifications", { token: shortLivedToken(A, 2) });
  const room = `user-${A}`;

  // Before expiry: the socket is in its own room and receives what is sent there.
  assert.equal(notifications.namespace.adapter.rooms.get(room)?.size, 1);
  const before = waitForEvent(socket, "new_notification");
  notifications.namespace.to(room).emit("new_notification", { probe: "before" });
  assert.notEqual(await before, null, "delivery must work while the token is valid");

  const reason = await waitForDisconnect(socket);
  assert.equal(reason, "io server disconnect");

  // After expiry: the adapter no longer lists the socket, so nothing is delivered to it.
  assert.equal(
    notifications.namespace.adapter.rooms.get(room)?.size ?? 0,
    0,
    "an expired socket must not remain in the user's private room",
  );
  const after = waitForEvent(socket, "new_notification");
  notifications.namespace.to(room).emit("new_notification", { probe: "after" });
  assert.equal(await after, null, "a notification sent after expiry must not reach the expired socket");
});

/* ------------------------------------------------------------- DM cutoff */

test("DM actions work before expiry and none succeed on the same socket afterwards", async () => {
  const socket = await connectOk(dmUrl, "/dm", { token: shortLivedToken(A, 2) });

  // Before expiry: the server authorizes A for A's own thread.
  socket.emit("join", { threadId: THREAD_A });
  await waitForEvent(socket, "error", 600); // the booking classifier answers; the point is it got that far
  assert.deepEqual(
    membershipQuestions,
    [{ threadId: THREAD_A, userId: A }],
    "the server must have authorized the action while the token was valid",
  );

  const reason = await waitForDisconnect(socket);
  assert.equal(reason, "io server disconnect");

  // After expiry: every authenticated action on this same socket is inert. Not merely
  // `socket.connected === false` — the server records no further membership question, which is
  // what "the handler never ran" actually looks like.
  membershipQuestions = [];
  for (const [event, payload] of [
    ["join", { threadId: THREAD_A }],
    ["send", { threadId: THREAD_A, text: "after expiry" }],
    ["typing", { threadId: THREAD_A, typing: true }],
    ["read", { threadId: THREAD_A, lastReadMessageId: "m1" }],
  ] as const) {
    socket.emit(event, payload);
  }
  assert.equal(await waitForEvent(socket, "joined", 400), null, "no join may succeed after expiry");
  assert.deepEqual(membershipQuestions, [], "no handler may run for an expired socket");
  assert.equal(dm.namespace.sockets.size, 0, "the server must hold no DM socket for the expired connection");
});

/* --------------------------------------------------------- unusable expiry */

test("a correctly signed token with no exp is refused", async () => {
  // Signed with the real secret and carrying a real user id — but nothing bounds it, so accepting
  // it would create a socket authorized forever.
  const noExp = jwt.sign({ id: A, email: `${A}@chefsire.test` }, TEST_JWT_SECRET, { algorithm: "HS256" });

  for (const [url, namespace] of [[dmUrl, "/dm"], [notificationUrl, "/notifications"]] as const) {
    const result = await attempt(url, namespace, { token: noExp });
    assert.equal(result.ok, false, `${namespace} must refuse a token with no exp`);
    assert.equal((result as { message: string }).message, "unauthorized");
  }
});

test("an unusable exp claim is refused", () => {
  for (const exp of [undefined, null, "1700000000", NaN, Infinity, -1, 0, {}, []]) {
    assert.equal(verifiedExpiryMs({ exp } as { exp?: unknown }), null, `exp ${String(exp)} must be unusable`);
  }
  const exp = nowSeconds() + 60;
  assert.equal(verifiedExpiryMs({ exp }), exp * 1000);
});

test("an already expired token is still refused at the handshake", async () => {
  const expired = jwt.sign({ id: A, exp: nowSeconds() - 1 }, TEST_JWT_SECRET, { algorithm: "HS256" });
  const result = await attempt(dmUrl, "/dm", { token: expired });
  assert.equal(result.ok, false);
  assert.equal((result as { message: string }).message, "unauthorized");
});

test("reconnecting with the expired credential is refused", async () => {
  const token = shortLivedToken(A, 2);
  const socket = await connectOk(dmUrl, "/dm", { token });
  await waitForDisconnect(socket);

  // The same credential the live socket was holding is now worthless for a new handshake too.
  const again = await attempt(dmUrl, "/dm", { token });
  assert.equal(again.ok, false);
  assert.equal((again as { message: string }).message, "unauthorized");
});

test("a fresh valid token opens a new authenticated socket after the old one expired", async () => {
  // Expiry enforcement must end a session, not lock the user out.
  const first = await connectOk(dmUrl, "/dm", { token: shortLivedToken(A, 2) });
  await waitForDisconnect(first);

  const second = await connectOk(dmUrl, "/dm", { token: longLivedToken(A) });
  assert.equal(second.connected, true);

  second.emit("join", { threadId: THREAD_A });
  await waitForEvent(second, "error", 600);
  assert.deepEqual(
    membershipQuestions.at(-1),
    { threadId: THREAD_A, userId: A },
    "the new socket is a fully authenticated connection in its own right",
  );
  second.close();
});

/* ------------------------------------------------------------ timer hygiene */

/**
 * The armed-timer count is process-wide and earlier tests tear down asynchronously, so wait for it
 * to stop moving before using it as a baseline. Polling for stability rather than sleeping a fixed
 * span keeps these assertions about the code under test instead of about scheduling luck.
 */
async function settledTimerCount(): Promise<number> {
  let previous = -1;
  for (let i = 0; i < 100; i += 1) {
    const current = armedAuthExpiryTimerCount();
    if (current === previous) return current;
    previous = current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return armedAuthExpiryTimerCount();
}

/** Wait for the armed-timer count to reach `expected`, then return it. */
async function timerCountReaches(expected: number): Promise<number> {
  for (let i = 0; i < 100 && armedAuthExpiryTimerCount() !== expected; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return armedAuthExpiryTimerCount();
}

test("a socket that disconnects before expiry leaves no timer behind", async () => {
  const baseline = await settledTimerCount();

  const socket = await connectOk(dmUrl, "/dm", { token: longLivedToken(A) });
  assert.equal(await timerCountReaches(baseline + 1), baseline + 1, "exactly one timer per connection");

  const closed = new Promise<void>((resolve) => socket.on("disconnect", () => resolve()));
  socket.close();
  await closed;

  // The server clears the timer from its own disconnect handler.
  assert.equal(await timerCountReaches(baseline), baseline, "an early disconnect must not leak its timer");
});

test("an expired socket leaves no timer behind either", async () => {
  const baseline = await settledTimerCount();
  const socket = await connectOk(dmUrl, "/dm", { token: shortLivedToken(A, 2) });
  await waitForDisconnect(socket);

  assert.equal(await timerCountReaches(baseline), baseline, "expiry must clear its own timer");
});

test("a seven-day token is scheduled without overflowing the timer", async () => {
  // The normal case: well inside Node's ceiling, so one timer covers it and the socket stays up.
  const baseline = await settledTimerCount();
  const socket = await connectOk(dmUrl, "/dm", { token: longLivedToken(A) });
  assert.equal(await timerCountReaches(baseline + 1), baseline + 1);

  assert.equal(await waitForDisconnect(socket, 500), null, "a long-lived token must not disconnect early");
  socket.close();
});
