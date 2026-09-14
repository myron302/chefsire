/**
 * DM transport identity and conversation authorization (P1 WebSocket identity).
 *
 * The DM namespace's membership checks were already sound — `join`, `typing`, `send` and `read`
 * each proved participation before acting. They were simply asking about the wrong person: the
 * "user" was whatever `handshake.auth.userId` or `x-user-id` said, unverified. So a client could
 * connect as any participant and act inside their conversation.
 *
 * These run the REAL `attachDmRealtime` over a real HTTP server with real clients. The membership
 * lookup is injected so the authorization rule can be exercised without a database — and, more to
 * the point, so every call can be RECORDED: the decisive assertion is not just that a stranger is
 * refused, but that the server asked about the authenticated user and never about the id the
 * payload named.
 */
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

import { attachDmRealtime } from "./dmSocket";
import { AUTH_TOKEN_COOKIE } from "./socket-auth";

const A = "user-A";
const B = "user-B";
const THREAD_AB = "thread-with-A";      // A is a participant
const THREAD_BC = "thread-without-A";   // A is not

/** Who is in what, as the database would say. */
const PARTICIPANTS: Record<string, string[]> = {
  [THREAD_AB]: [A, B],
  [THREAD_BC]: [B, "user-C"],
};

/** Every membership question the server asked, in order. */
let asked: { threadId: string; userId: string }[] = [];

const tokenFor = (id: string, options: jwt.SignOptions = { expiresIn: "5m" }) =>
  jwt.sign({ id, email: `${id}@chefsire.test` }, TEST_JWT_SECRET, { algorithm: "HS256", ...options });

let httpServer: http.Server;
let realtime: ReturnType<typeof attachDmRealtime>;
let url = "";
const open: ClientSocket[] = [];

test.before(async () => {
  httpServer = http.createServer();
  realtime = attachDmRealtime(httpServer, {
    isThreadParticipant: async (threadId, userId) => {
      asked.push({ threadId, userId });
      return (PARTICIPANTS[threadId] ?? []).includes(userId);
    },
  });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const address = httpServer.address();
  url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

test.after(async () => {
  for (const socket of open) socket.close();
  await realtime.namespace.server.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test.beforeEach(() => {
  asked = [];
});

type Attempt = { ok: true; socket: ClientSocket } | { ok: false; message: string };

function attempt(opts: { auth?: Record<string, unknown>; headers?: Record<string, string> }): Promise<Attempt> {
  return new Promise((resolve) => {
    const socket = connect(`${url}/dm`, {
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
    socket.on("connect", () => settle({ ok: true, socket }));
    socket.on("connect_error", (error: Error) => settle({ ok: false, message: error.message }));
    setTimeout(() => settle({ ok: false, message: "timeout" }), 4000).unref?.();
  });
}

/** Connect as a user, asserting the connection succeeded. */
async function connectAs(auth: Record<string, unknown>, headers: Record<string, string> = {}) {
  const result = await attempt({ auth, headers });
  assert.equal(result.ok, true, `expected a connection, got ${(result as { message?: string }).message}`);
  return (result as { socket: ClientSocket }).socket;
}

/** Emit and collect the first `joined` or `error` the server sends back. */
function ask(socket: ClientSocket, event: string, payload: unknown): Promise<{ event: string; payload: any }> {
  return new Promise((resolve) => {
    let done = false;
    const settle = (event: string, payload: unknown) => { if (!done) { done = true; resolve({ event, payload }); } };
    socket.once("joined", (data: unknown) => settle("joined", data));
    socket.once("error", (data: unknown) => settle("error", data));
    socket.emit(event, payload);
    setTimeout(() => settle("silence", null), 600).unref?.();
  });
}

const roomsOf = (socketId: string) => {
  const socket = realtime.namespace.sockets.get(socketId);
  return socket ? [...socket.rooms].filter((room) => room !== socketId) : [];
};

/* ------------------------------------------------------------ connection */

test("an anonymous DM connection is rejected", async () => {
  const result = await attempt({});
  assert.equal(result.ok, false);
  assert.equal((result as { message: string }).message, "unauthorized");
});

test("a DM connection naming a user without a token is rejected", async () => {
  for (const options of [{ auth: { userId: A } }, { headers: { "x-user-id": A } }]) {
    const result = await attempt(options);
    assert.equal(result.ok, false);
  }
  assert.deepEqual(asked, [], "an unauthenticated connection never reaches an authorization check");
});

test("an invalid, tampered, wrong-secret or expired token is rejected", async () => {
  const [header, , signature] = tokenFor(A).split(".");
  const tampered = `${header}.${Buffer.from(JSON.stringify({ id: B })).toString("base64url").replace(/=+$/, "")}.${signature}`;
  const wrongSecret = jwt.sign({ id: A }, "another-secret-0123456789abcdefgh", { algorithm: "HS256", expiresIn: "5m" });

  for (const token of ["garbage", tampered, wrongSecret, tokenFor(A, { expiresIn: -1 })]) {
    const result = await attempt({ auth: { token } });
    assert.equal(result.ok, false, `token ${token.slice(0, 12)}… must be refused`);
  }
});

/* --------------------------------------------------------- authorization */

test("A is authorized for a conversation A participates in", async () => {
  const socket = await connectAs({ token: tokenFor(A) });
  const answer = await ask(socket, "join", { threadId: THREAD_AB });

  // Authorization passed: the server asked about A, and A is a participant. What stops the join
  // here is the NEXT gate — the catering booking-link classifier, which has no database in this
  // test and therefore fails closed with its own distinct code. That distinction is the assertion:
  // `forbidden` means authorization refused the user, `thread_check_unavailable` means it did not.
  assert.deepEqual(asked, [{ threadId: THREAD_AB, userId: A }]);
  assert.equal(answer.event, "error");
  assert.equal(answer.payload.error, "thread_check_unavailable");
  assert.notEqual(answer.payload.error, "forbidden", "A must not be refused from A's own conversation");
});

test("A may not join a conversation A is not part of", async () => {
  const socket = await connectAs({ token: tokenFor(A) });
  const answer = await ask(socket, "join", { threadId: THREAD_BC });

  assert.equal(answer.event, "error");
  assert.equal(answer.payload.error, "forbidden");
  assert.deepEqual(asked, [{ threadId: THREAD_BC, userId: A }]);
  assert.deepEqual(roomsOf(socket.id!), [], "a refused join must leave the socket in no thread room");
});

/* -------------------------------------------------------- impersonation */

test("a forged handshake userId does not make A act as B", async () => {
  // A presents A's token but claims to be B. B is a participant of THREAD_BC; A is not.
  const socket = await connectAs({ token: tokenFor(A), userId: B });
  const answer = await ask(socket, "join", { threadId: THREAD_BC });

  assert.equal(answer.event, "error");
  assert.equal(answer.payload.error, "forbidden");
  assert.deepEqual(asked, [{ threadId: THREAD_BC, userId: A }], "the server asked about A, not B");
  assert.deepEqual(roomsOf(socket.id!), []);
});

test("a forged x-user-id header does not make A act as B", async () => {
  const socket = await connectAs({ token: tokenFor(A) }, { "x-user-id": B });
  const answer = await ask(socket, "join", { threadId: THREAD_BC });

  assert.equal(answer.event, "error");
  assert.deepEqual(asked, [{ threadId: THREAD_BC, userId: A }]);
});

test("an actor named in the event payload is ignored on send", async () => {
  // The payload tries every actor field an attacker would reach for. None is read: `send` takes
  // its sender from the authenticated socket, so this is still A acting, and A is not in THREAD_BC.
  const socket = await connectAs({ token: tokenFor(A) });
  const answer = await ask(socket, "send", {
    threadId: THREAD_BC,
    text: "posing as B",
    userId: B,
    senderId: B,
    authorId: B,
  });

  assert.equal(answer.event, "error");
  assert.equal(answer.payload.error, "forbidden");
  assert.deepEqual(asked, [{ threadId: THREAD_BC, userId: A }], "the sender is the socket's user, not the payload's");
});

test("an actor named in the event payload is ignored on typing and read", async () => {
  for (const event of ["typing", "read"]) {
    asked = [];
    const socket = await connectAs({ token: tokenFor(A) });
    const answer = await ask(socket, event, {
      threadId: THREAD_BC,
      typing: true,
      lastReadMessageId: "message-1",
      userId: B,
      senderId: B,
    });

    assert.equal(answer.event, "error", `${event} must be refused`);
    assert.equal(answer.payload.error, "forbidden");
    assert.deepEqual(asked, [{ threadId: THREAD_BC, userId: A }], `${event} must authorize A, not B`);
  }
});

test("A cannot reach B's conversation by presenting B's id in every place at once", async () => {
  const socket = await connectAs(
    { token: tokenFor(A), userId: B },
    { cookie: `${AUTH_TOKEN_COOKIE}=${tokenFor(A)}`, "x-user-id": B },
  );
  const answer = await ask(socket, "join", { threadId: THREAD_BC, userId: B });

  assert.equal(answer.event, "error");
  assert.deepEqual(asked, [{ threadId: THREAD_BC, userId: A }]);
  assert.deepEqual(roomsOf(socket.id!), []);
});

test("B, authenticated as B, is authorized for the very conversation A was refused", async () => {
  // The mirror case, on the same thread, in the same run: the rule denies impersonation, not
  // legitimate access. A got `forbidden` for THREAD_BC above; B does not.
  const socket = await connectAs({ token: tokenFor(B) });
  const answer = await ask(socket, "join", { threadId: THREAD_BC });

  assert.deepEqual(asked, [{ threadId: THREAD_BC, userId: B }]);
  assert.notEqual(answer.payload?.error, "forbidden", "B is a participant and must not be refused");
  assert.equal(answer.payload.error, "thread_check_unavailable");
});
