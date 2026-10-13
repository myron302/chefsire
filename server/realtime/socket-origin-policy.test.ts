/**
 * Socket.IO origin policy (Stability Phase 2A).
 *
 * Both realtime servers used to be created with `cors: { origin: true, credentials: true }`: every browser origin was reflected, with
 * credentials, whatever CLIENT_URL said. And CORS is not the control that matters for a WebSocket anyway -- browsers do not apply it
 * to them -- so a page on ANY origin could open a socket carrying the visitor's cookies.
 *
 * These run the REAL `attachDmRealtime` and `attachNotificationRealtime`, attached to ONE http server exactly as server/index.ts does,
 * with real socket.io clients that set the Origin header the way a browser would. Authentication is real too (a valid token is
 * presented in every case), so a refusal below can only be the origin policy: the credential is good.
 */
import "../test-support/accept-test-sessions";
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

import { attachDmRealtime } from "./dmSocket";
import { attachNotificationRealtime } from "./notificationSocket";
import { socketIoServerFor } from "./socket-server";

const ALLOWED = "https://chefsire.com";
const token = jwt.sign({ id: "user-A", av: 1, email: "a@chefsire.test" }, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "5m" });

const savedEnv = { ...process.env };
function setEnv(values: Record<string, string | undefined>) {
  for (const key of ["NODE_ENV", "CLIENT_URL", "APP_BASE_URL", "APP_URL", "CORS_ALLOWED_ORIGINS", "CORS_DEV_ORIGINS"]) delete process.env[key];
  for (const [key, value] of Object.entries(values)) if (value !== undefined) process.env[key] = value;
}

let httpServer: http.Server;
let dm: ReturnType<typeof attachDmRealtime>;
let notifications: ReturnType<typeof attachNotificationRealtime>;
let url = "";
let hostHeader = "";
const open: ClientSocket[] = [];

test.before(async () => {
  httpServer = http.createServer((_req, res) => { res.statusCode = 404; res.end(); });
  dm = attachDmRealtime(httpServer, { isThreadParticipant: async () => true });
  notifications = attachNotificationRealtime(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const port = (httpServer.address() as { port: number }).port;
  url = `http://127.0.0.1:${port}`;
  hostHeader = `127.0.0.1:${port}`;
});

test.after(async () => {
  for (const socket of open) socket.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});

type Attempt = { ok: true; socket: ClientSocket } | { ok: false; message: string };

function attempt(namespace: "/dm" | "/notifications", options: { origin?: string; transport?: "websocket" | "polling"; withToken?: boolean }): Promise<Attempt> {
  return new Promise((resolve) => {
    const transport = options.transport ?? "websocket";
    const socket = connect(`${url}${namespace}`, {
      path: "/socket.io",
      transports: [transport],
      upgrade: false,
      reconnection: false,
      forceNew: true,
      auth: options.withToken === false ? {} : { token },
      extraHeaders: options.origin === undefined ? {} : { Origin: options.origin },
      timeout: 4_000,
    });
    open.push(socket);
    socket.on("connect", () => resolve({ ok: true, socket }));
    socket.on("connect_error", (error) => { socket.close(); resolve({ ok: false, message: error.message }); });
  });
}

test("both realtime modules share ONE Socket.IO server per HTTP server (two on one path made a WebSocket upgrade throw and kill the process)", async () => {
  assert.equal(socketIoServerFor(httpServer), socketIoServerFor(httpServer));
  assert.equal(dm.namespace.server, notifications.namespace.server);
  const other = http.createServer();
  try {
    assert.notEqual(socketIoServerFor(other), socketIoServerFor(httpServer), "a different HTTP server gets its own");
  } finally {
    await socketIoServerFor(other).close();
  }
});

const BOTH = ["/dm", "/notifications"] as const;
const TRANSPORTS = ["websocket", "polling"] as const;

test("an allowlisted production origin connects to both namespaces, over both transports", async () => {
  setEnv({ NODE_ENV: "production", CLIENT_URL: ALLOWED });
  for (const namespace of BOTH) for (const transport of TRANSPORTS) {
    const result = await attempt(namespace, { origin: ALLOWED, transport });
    assert.equal(result.ok, true, `${namespace} over ${transport}: ${result.ok ? "" : result.message}`);
  }
});

test("a disallowed external origin is refused on both namespaces and both transports, even with a valid token", async () => {
  setEnv({ NODE_ENV: "production", CLIENT_URL: ALLOWED });
  for (const origin of ["https://evil.example", "https://chefsire.com.evil.example", "http://chefsire.com", "https://chefsire.com:8443", "null", "https://CHEFSIRE.com/"]) {
    for (const namespace of BOTH) for (const transport of TRANSPORTS) {
      const result = await attempt(namespace, { origin, transport });
      assert.equal(result.ok, false, `${origin} reached ${namespace} over ${transport}`);
    }
  }
});

test("missing CLIENT_URL fails closed: no browser origin is accepted, none is reflected", async () => {
  setEnv({ NODE_ENV: "production" });
  for (const origin of ["https://evil.example", ALLOWED, "http://localhost:5173"]) {
    for (const namespace of BOTH) {
      const result = await attempt(namespace, { origin });
      assert.equal(result.ok, false, `${origin} reached ${namespace} with no origin configured`);
    }
  }
});

test("the polling transport sends CORS headers only to an allowlisted origin, and never a wildcard", async () => {
  setEnv({ NODE_ENV: "production", CLIENT_URL: ALLOWED });
  const poll = (origin: string) => fetch(`${url}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: origin } });

  const allowed = await poll(ALLOWED);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), ALLOWED);
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
  await allowed.arrayBuffer();

  const denied = await poll("https://evil.example");
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
  assert.equal(denied.headers.get("access-control-allow-credentials"), null);
  await denied.arrayBuffer();

  setEnv({ NODE_ENV: "production" });
  const unconfigured = await poll("https://evil.example");
  assert.equal(unconfigured.status, 403);
  assert.equal(unconfigured.headers.get("access-control-allow-origin"), null);
  await unconfigured.arrayBuffer();
});

test("a preflight to the polling transport from a disallowed origin gets no CORS headers", async () => {
  setEnv({ NODE_ENV: "production", CLIENT_URL: ALLOWED });
  const preflight = (origin: string) => fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
  });
  const bad = await preflight("https://evil.example");
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  assert.equal(bad.headers.get("access-control-allow-credentials"), null);
  const good = await preflight(ALLOWED);
  assert.equal(good.headers.get("access-control-allow-origin"), ALLOWED);
  assert.equal(good.headers.get("access-control-allow-credentials"), "true");
});

test("same-origin is the FULL origin: development accepts the plain-http page of its own server; production never infers it from the Host alone", async () => {
  setEnv({ NODE_ENV: "development" });
  for (const namespace of BOTH) {
    const result = await attempt(namespace, { origin: `http://${hostHeader}` });
    assert.equal(result.ok, true, `development same-origin ${namespace}: ${result.ok ? "" : result.message}`);
  }
  // Production, nothing configured, and the connection carries no statement of its scheme (here the peer is the loopback "proxy" and sends no
  // X-Forwarded-Proto): the host matching is not evidence, so the page is refused. The complete scheme/host/port/proxy matrix, over raw
  // WebSocket upgrades, polling and real clients, is in socket-origin-same-origin.test.ts.
  setEnv({ NODE_ENV: "production" });
  for (const namespace of BOTH) {
    const result = await attempt(namespace, { origin: `http://${hostHeader}` });
    assert.equal(result.ok, false, `production ${namespace} must not infer same-origin from the host alone`);
  }
});

test("clients that send no Origin (native mobile apps, server-side clients) are not blocked by the origin policy, only by authentication", async () => {
  setEnv({ NODE_ENV: "production" });
  for (const namespace of BOTH) {
    const withToken = await attempt(namespace, {});
    assert.equal(withToken.ok, true, `${namespace} without Origin: ${withToken.ok ? "" : withToken.message}`);
    const withoutToken = await attempt(namespace, { withToken: false });
    assert.equal(withoutToken.ok, false, `${namespace} must still demand a credential`);
  }
});

test("an allowlisted origin without a credential is still refused by authentication", async () => {
  setEnv({ NODE_ENV: "production", CLIENT_URL: ALLOWED });
  for (const namespace of BOTH) {
    const result = await attempt(namespace, { origin: ALLOWED, withToken: false });
    assert.equal(result.ok, false);
  }
});

test("a development origin works when explicitly configured outside production and is ignored in production", async () => {
  setEnv({ NODE_ENV: "development", CORS_DEV_ORIGINS: "http://localhost:5173" });
  for (const namespace of BOTH) {
    assert.equal((await attempt(namespace, { origin: "http://localhost:5173" })).ok, true, `${namespace} dev`);
    assert.equal((await attempt(namespace, { origin: "http://localhost:4000" })).ok, false, `${namespace} unlisted dev port`);
  }
  setEnv({ NODE_ENV: "production", CORS_DEV_ORIGINS: "http://localhost:5173", CLIENT_URL: ALLOWED });
  for (const namespace of BOTH) {
    assert.equal((await attempt(namespace, { origin: "http://localhost:5173" })).ok, false, `${namespace} dev origin must not work in production`);
    assert.equal((await attempt(namespace, { origin: ALLOWED })).ok, true);
  }
});
