/**
 * Security regression tests for WebSocket authentication.
 *
 * The defect these lock down: both realtime namespaces took identity from
 * `socket.handshake.auth.userId` or an `x-user-id` header, with no token and no verification. Any
 * client could connect *as anyone* — join a stranger's notification room, or act inside a DM
 * thread as a participant it was not.
 *
 * These are real connections: a real Socket.IO server with the real `authenticateSocket`
 * middleware, driven by the real `socket.io-client` over a real HTTP server. Room membership is
 * asserted against the server's own adapter, not against what the client believes.
 */
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { Server, type Socket as ServerSocket } from "socket.io";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

import {
  AUTH_TOKEN_COOKIE,
  authenticateSocket,
  parseCookieHeader,
  socketUserId,
  tokenFromHandshake,
} from "./socket-auth";

const A = "user-A";
const B = "user-B";

const tokenFor = (id: string, options: jwt.SignOptions = { expiresIn: "5m" }) =>
  jwt.sign({ id, email: `${id}@chefsire.test` }, TEST_JWT_SECRET, { algorithm: "HS256", ...options });

/* ------------------------------------------------------------------ harness */

type Harness = {
  url: string;
  io: Server;
  /** Sockets the server actually accepted, in order. */
  accepted: ServerSocket[];
  close: () => Promise<void>;
};

async function startServer(): Promise<Harness> {
  const httpServer = http.createServer();
  const io = new Server(httpServer, { path: "/socket.io", cors: { origin: true, credentials: true } });
  const accepted: ServerSocket[] = [];

  const ns = io.of("/dm");
  ns.use(authenticateSocket);
  ns.on("connection", (socket) => {
    accepted.push(socket);
    // Exactly what the real namespaces do: act on the server-side identity, never the handshake.
    socket.join(`user-${socketUserId(socket)}`);
    socket.emit("whoami", { userId: socketUserId(socket) });
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    io,
    accepted,
    close: async () => {
      await io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

type Attempt =
  | { ok: true; socket: ClientSocket; whoami: string }
  | { ok: false; message: string };

/** Try to connect, and resolve with either the accepted identity or the refusal. */
function attempt(
  harness: Harness,
  opts: { auth?: Record<string, unknown>; headers?: Record<string, string> } = {},
): Promise<Attempt> {
  return new Promise((resolve) => {
    const socket = connect(`${harness.url}/dm`, {
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      auth: opts.auth ?? {},
      extraHeaders: opts.headers ?? {},
    });
    const settle = (result: Attempt) => {
      if (!result.ok) socket.close();
      resolve(result);
    };
    socket.on("whoami", ({ userId }: { userId: string }) => settle({ ok: true, socket, whoami: userId }));
    socket.on("connect_error", (error: Error) => settle({ ok: false, message: error.message }));
    setTimeout(() => settle({ ok: false, message: "timeout" }), 4000).unref?.();
  });
}

/** The rooms the SERVER has this socket in — the only trustworthy view of what was joined. */
const roomsOf = (socket: ServerSocket) => [...socket.rooms].filter((room) => room !== socket.id);

let harness: Harness;
test.before(async () => {
  harness = await startServer();
});
test.after(async () => {
  await harness.close();
});

/* ------------------------------------------------------------- happy paths */

test("a valid token in auth.token authenticates the connection", async () => {
  const result = await attempt(harness, { auth: { token: tokenFor(A) } });
  assert.equal(result.ok, true);
  assert.equal((result as { whoami: string }).whoami, A);
  (result as { socket: ClientSocket }).socket.close();
});

test("a valid token in the auth_token cookie authenticates the connection", async () => {
  // What the browser actually does: the cookie is httpOnly, so `withCredentials` sends it and the
  // page never handles the token itself.
  const result = await attempt(harness, {
    headers: { cookie: `${AUTH_TOKEN_COOKIE}=${tokenFor(A)}` },
  });
  assert.equal(result.ok, true);
  assert.equal((result as { whoami: string }).whoami, A);
  (result as { socket: ClientSocket }).socket.close();
});

test("an authenticated socket joins only its own room", async () => {
  const before = harness.accepted.length;
  const result = await attempt(harness, { auth: { token: tokenFor(A) } });
  assert.equal(result.ok, true);
  assert.deepEqual(roomsOf(harness.accepted[before]), [`user-${A}`]);
  (result as { socket: ClientSocket }).socket.close();
});

/* ------------------------------------------------------ rejected credentials */

test("a connection with no token is rejected", async () => {
  const result = await attempt(harness, {});
  assert.equal(result.ok, false);
  assert.equal((result as { message: string }).message, "unauthorized");
});

test("a malformed token is rejected", async () => {
  for (const token of ["not-a-token", "a.b", "...", "eyJhbGciOiJIUzI1NiJ9"]) {
    const result = await attempt(harness, { auth: { token } });
    assert.equal(result.ok, false, `malformed token ${JSON.stringify(token)} must be rejected`);
  }
});

test("a token signed with the wrong secret is rejected", async () => {
  const forged = jwt.sign({ id: A }, "a-different-secret-0123456789abcdef", {
    algorithm: "HS256",
    expiresIn: "5m",
  });
  const result = await attempt(harness, { auth: { token: forged } });
  assert.equal(result.ok, false);
});

test("a tampered token is rejected", async () => {
  const [header, , signature] = tokenFor(A).split(".");
  const swapped = Buffer.from(
    JSON.stringify({ id: B, exp: Math.floor(Date.now() / 1000) + 300 }),
  ).toString("base64url").replace(/=+$/, "");
  const result = await attempt(harness, { auth: { token: `${header}.${swapped}.${signature}` } });
  assert.equal(result.ok, false);
});

test("an expired token is rejected", async () => {
  const result = await attempt(harness, { auth: { token: tokenFor(A, { expiresIn: -1 }) } });
  assert.equal(result.ok, false);
});

test("a token with no usable id claim is rejected", async () => {
  for (const claims of [{}, { id: "" }, { id: "   " }, { id: 42 }]) {
    const token = jwt.sign(claims, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "5m" });
    const result = await attempt(harness, { auth: { token } });
    assert.equal(result.ok, false, `claims ${JSON.stringify(claims)} must be rejected`);
  }
});

test("a refusal tells the client nothing about why", async () => {
  const cases = [
    {},
    { auth: { token: "not-a-token" } },
    { auth: { token: tokenFor(A, { expiresIn: -1 }) } },
  ];
  for (const options of cases) {
    const result = await attempt(harness, options);
    assert.equal(result.ok, false);
    // One uniform answer: no "jwt expired", no "invalid signature", no secret, no claims.
    assert.equal((result as { message: string }).message, "unauthorized");
  }
});

/* ------------------------------------------------------------ impersonation */

test("a forged handshake userId does not change the authenticated identity", async () => {
  const before = harness.accepted.length;
  const result = await attempt(harness, { auth: { token: tokenFor(A), userId: B } });
  assert.equal(result.ok, true);
  assert.equal((result as { whoami: string }).whoami, A, "identity must come from the token");
  assert.deepEqual(roomsOf(harness.accepted[before]), [`user-${A}`], "B's room must never be joined");
  (result as { socket: ClientSocket }).socket.close();
});

test("a forged x-user-id header does not change the authenticated identity", async () => {
  const before = harness.accepted.length;
  const result = await attempt(harness, {
    auth: { token: tokenFor(A) },
    headers: { "x-user-id": B },
  });
  assert.equal(result.ok, true);
  assert.equal((result as { whoami: string }).whoami, A);
  assert.deepEqual(roomsOf(harness.accepted[before]), [`user-${A}`]);
  (result as { socket: ClientSocket }).socket.close();
});

test("a userId with no token is rejected outright", async () => {
  for (const options of [{ auth: { userId: B } }, { headers: { "x-user-id": B } }]) {
    const result = await attempt(harness, options);
    assert.equal(result.ok, false, "naming a user is not proving one");
    assert.equal((result as { message: string }).message, "unauthorized");
  }
});

test("a cookie for A beats an auth.userId claiming B, and a header claiming B", async () => {
  const before = harness.accepted.length;
  const result = await attempt(harness, {
    auth: { userId: B },
    headers: { cookie: `${AUTH_TOKEN_COOKIE}=${tokenFor(A)}`, "x-user-id": B },
  });
  assert.equal(result.ok, true);
  assert.equal((result as { whoami: string }).whoami, A);
  assert.deepEqual(roomsOf(harness.accepted[before]), [`user-${A}`]);
  (result as { socket: ClientSocket }).socket.close();
});

test("reconnecting with a now-invalid credential is refused", async () => {
  // Reconnection re-runs the handshake, so it re-authenticates. A socket cannot outlive its
  // credential by reconnecting: the second attempt carries what is valid *now*.
  const first = await attempt(harness, { auth: { token: tokenFor(A) } });
  assert.equal(first.ok, true);
  (first as { socket: ClientSocket }).socket.close();

  const second = await attempt(harness, { auth: { token: tokenFor(A, { expiresIn: -1 }) } });
  assert.equal(second.ok, false);
});

/* ----------------------------------------------------------- unit-level edges */

test("the handshake reader never treats an identity field as a credential", () => {
  const handshake = (auth: Record<string, unknown>, headers: Record<string, string>) =>
    tokenFromHandshake({ handshake: { auth, headers } } as never);

  assert.equal(handshake({ userId: B }, {}), null);
  assert.equal(handshake({}, { "x-user-id": B }), null);
  assert.equal(handshake({}, {}), null);
  // And a real credential is found in each supported place.
  assert.equal(handshake({ token: "t" }, {}), "t");
  assert.equal(handshake({}, { cookie: `${AUTH_TOKEN_COOKIE}=t` }), "t");
  assert.equal(handshake({}, { authorization: "Bearer t" }), "t");
  // The cookie wins, matching how HTTP reads credentials in server/middleware/auth.ts.
  assert.equal(handshake({ token: "from-auth" }, { cookie: `${AUTH_TOKEN_COOKIE}=from-cookie` }), "from-cookie");
});

test("the cookie parser handles the shapes a browser actually sends", () => {
  assert.deepEqual(parseCookieHeader(undefined), {});
  assert.deepEqual(parseCookieHeader(""), {});
  assert.deepEqual(parseCookieHeader("a=1; b=2"), { a: "1", b: "2" });
  assert.deepEqual(parseCookieHeader("  a = 1 ;b=2 "), { a: "1", b: "2" });
  assert.deepEqual(parseCookieHeader("a=x%20y"), { a: "x y" });
  // A malformed percent-escape must not throw; it falls back to the raw value.
  assert.deepEqual(parseCookieHeader("a=%E0%A4%A"), { a: "%E0%A4%A" });
  // Valueless and duplicate entries follow cookie-parser: skip, and first wins.
  assert.deepEqual(parseCookieHeader("novalue; a=1; a=2"), { a: "1" });
});

test("an unauthenticated socket has no identity to offer a handler", () => {
  assert.throws(() => socketUserId({ data: {} } as never), /not authenticated/);
  assert.throws(() => socketUserId({ data: { userId: "" } } as never), /not authenticated/);
  assert.equal(socketUserId({ data: { userId: A } } as never), A);
});
