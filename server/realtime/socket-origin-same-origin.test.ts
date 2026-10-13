/**
 * Full-origin validation on the REAL Socket.IO servers (Stability Phase 2A, repair pass 1).
 *
 * The previous same-origin test compared only host and port, so `http://chefsire.com` and `capacitor://chefsire.com` were "the same origin" as the
 * https deployment, and a spoofable `X-Forwarded-Host` could stand in for the Host. This drives every combination of Origin, Host, X-Forwarded-*,
 * peer trust, runtime and allowlist through the production wiring -- both realtime modules on ONE http server, as server/index.ts attaches them --
 * over raw WebSocket upgrades, raw polling requests and real socket.io-client connections to BOTH namespaces.
 *
 * Header-controlled requests come from raw `ws` / `http` clients, because that is the only way to set Host, X-Forwarded-* and a hostile Origin
 * exactly. A request is "refused before authentication" when the server answers 403 with no session (no `sid`) and the account lookup that
 * authentication performs was never called -- even though the request carried a perfectly valid auth cookie.
 */
import "../test-support/accept-test-sessions";
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import WebSocket from "ws";
import { io as connect } from "socket.io-client";
import { setSessionLookupForTests } from "../lib/auth-session";
import { attachDmRealtime } from "./dmSocket";
import { attachNotificationRealtime } from "./notificationSocket";

const token = jwt.sign({ id: "user-A", av: 1, email: "a@chefsire.test" }, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "5m" });
const COOKIE = `auth_token=${token}`;

let lookups = 0;
setSessionLookupForTests(async (id) => { lookups += 1; return { id, authVersion: 1 }; });

const savedEnv = { ...process.env };
const POLICY_KEYS = ["NODE_ENV", "CLIENT_URL", "APP_BASE_URL", "APP_URL", "CORS_ALLOWED_ORIGINS", "CORS_DEV_ORIGINS", "TRUST_PROXY"] as const;
function setEnv(values: Partial<Record<(typeof POLICY_KEYS)[number], string>>) {
  for (const key of POLICY_KEYS) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "production", ...values });
}

let httpServer: http.Server;
let port = 0;
test.before(async () => {
  httpServer = http.createServer((_req, res) => { res.statusCode = 404; res.end(); });
  attachDmRealtime(httpServer, { isThreadParticipant: async () => true });
  attachNotificationRealtime(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  port = (httpServer.address() as { port: number }).port;
});
test.after(async () => {
  httpServer.closeAllConnections?.();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});

type Headers = { origin?: string; host?: string; xfp?: string; xfh?: string };
const toHeaders = (h: Headers): Record<string, string> => ({
  Cookie: COOKIE,
  ...(h.origin !== undefined ? { Origin: h.origin } : {}),
  ...(h.host !== undefined ? { Host: h.host } : {}),
  ...(h.xfp !== undefined ? { "X-Forwarded-Proto": h.xfp } : {}),
  ...(h.xfh !== undefined ? { "X-Forwarded-Host": h.xfh } : {}),
});

/** The first request of a polling session. */
function polling(h: Headers) {
  return new Promise<{ status: number; sid: string | null }>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: "/socket.io/?EIO=4&transport=polling", headers: toHeaders(h) }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, sid: /"sid":"([^"]+)"/.exec(text)?.[1] ?? null }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** A direct WebSocket handshake. */
function upgrade(h: Headers) {
  return new Promise<{ opened: boolean; status?: number }>((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`, { headers: toHeaders(h) });
    ws.on("open", () => { ws.close(); resolve({ opened: true }); });
    ws.on("unexpected-response", (_req, res) => { res.resume(); resolve({ opened: false, status: res.statusCode }); });
    ws.on("error", () => resolve({ opened: false }));
  });
}

/** A real Socket.IO client connecting to a namespace with a valid credential. */
function client(namespace: "/dm" | "/notifications", h: Headers) {
  return new Promise<boolean>((resolve) => {
    const socket = connect(`http://127.0.0.1:${port}${namespace}`, {
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      auth: { token },
      extraHeaders: Object.fromEntries(Object.entries(toHeaders(h)).filter(([name]) => name !== "Cookie")),
      timeout: 4_000,
    });
    socket.on("connect", () => { socket.close(); resolve(true); });
    socket.on("connect_error", () => { socket.close(); resolve(false); });
  });
}

type Row = { name: string; env?: Partial<Record<(typeof POLICY_KEYS)[number], string>>; headers: Headers; allow: boolean };
const H = "chefsire.test";

const ROWS: Row[] = [
  // ---- allowed ----------------------------------------------------------------------------------------------------------------------
  { name: "HTTPS page, HTTPS app, verified same-origin through a trusted proxy that states https", headers: { host: H, xfp: "https", origin: `https://${H}` }, allow: true },
  { name: "HTTPS page allowlisted in CLIENT_URL while the proxy rewrites Host and states nothing", env: { CLIENT_URL: `https://${H}` }, headers: { host: "127.0.0.1:3001", origin: `https://${H}` }, allow: true },
  { name: "allowlisted origin is allowed whatever X-Forwarded-Proto says", env: { CLIENT_URL: `https://${H}` }, headers: { host: H, xfp: "http", origin: `https://${H}` }, allow: true },
  { name: "TRUST_PROXY=loopback over a TCP loopback upstream", env: { TRUST_PROXY: "loopback" }, headers: { host: H, xfp: "https", origin: `https://${H}` }, allow: true },
  { name: "http origin explicitly authorized in CORS_ALLOWED_ORIGINS", env: { CORS_ALLOWED_ORIGINS: `http://${H}` }, headers: { host: H, xfp: "https", origin: `http://${H}` }, allow: true },
  { name: "custom-scheme origin explicitly authorized for a mobile web view", env: { CORS_ALLOWED_ORIGINS: "capacitor://localhost" }, headers: { host: H, xfp: "https", origin: "capacitor://localhost" }, allow: true },
  { name: "a different port, explicitly allowlisted", env: { CORS_ALLOWED_ORIGINS: `https://${H}:8443` }, headers: { host: H, xfp: "https", origin: `https://${H}:8443` }, allow: true },
  { name: "development: explicitly allowlisted http origin", env: { NODE_ENV: "development", CORS_DEV_ORIGINS: "http://localhost:5173" }, headers: { host: H, origin: "http://localhost:5173" }, allow: true },
  { name: "development: plain-http same-origin, nothing configured", env: { NODE_ENV: "development" }, headers: { origin: "SELF" }, allow: true },
  // ---- refused ----------------------------------------------------------------------------------------------------------------------
  { name: "HTTP page against the HTTPS application", headers: { host: H, xfp: "https", origin: `http://${H}` }, allow: false },
  { name: "HTTP page against the HTTPS application, with the https origin allowlisted", env: { CLIENT_URL: `https://${H}` }, headers: { host: H, xfp: "https", origin: `http://${H}` }, allow: false },
  { name: "HTTP page, proxy states nothing about the scheme", headers: { host: H, origin: `http://${H}` }, allow: false },
  { name: "HTTP page, trusted proxy claims http", headers: { host: H, xfp: "http", origin: `http://${H}` }, allow: false },
  { name: "custom-scheme origin with the matching hostname", headers: { host: H, xfp: "https", origin: `capacitor://${H}` }, allow: false },
  { name: "other non-web schemes with the matching hostname", headers: { host: H, xfp: "https", origin: `ionic://${H}` }, allow: false },
  { name: "ws:// as an Origin", headers: { host: H, xfp: "https", origin: `ws://${H}` }, allow: false },
  { name: "different hostname", headers: { host: H, xfp: "https", origin: "https://evil.example" }, allow: false },
  { name: "suffix-lookalike hostname", headers: { host: H, xfp: "https", origin: `https://${H}.evil.example` }, allow: false },
  { name: "different port", headers: { host: H, xfp: "https", origin: `https://${H}:8443` }, allow: false },
  { name: "malformed Origin: path", headers: { host: H, xfp: "https", origin: `https://${H}/app` }, allow: false },
  { name: "malformed Origin: not an origin", headers: { host: H, xfp: "https", origin: "not an origin" }, allow: false },
  { name: "malformed Origin: no host", headers: { host: H, xfp: "https", origin: "https://" }, allow: false },
  { name: "malformed Origin: two origins", headers: { host: H, xfp: "https", origin: `https://${H}, https://evil.example` }, allow: false },
  { name: "malformed Origin: userinfo", headers: { host: H, xfp: "https", origin: `https://user@${H}` }, allow: false },
  { name: "opaque Origin: null", headers: { host: H, xfp: "https", origin: "null" }, allow: false },
  { name: "opaque Origin: empty", headers: { host: H, xfp: "https", origin: "" }, allow: false },
  { name: "spoofed X-Forwarded-Proto from a peer that is not a trusted proxy", env: { TRUST_PROXY: "10.0.0.0/8" }, headers: { host: H, xfp: "https", origin: `https://${H}` }, allow: false },
  { name: "spoofed X-Forwarded-Proto when forwarded headers are not trusted at all", env: { TRUST_PROXY: "false" }, headers: { host: H, xfp: "https", origin: `https://${H}` }, allow: false },
  { name: "spoofed X-Forwarded-Host naming the attacker's origin", headers: { host: H, xfp: "https", xfh: "evil.example", origin: "https://evil.example" }, allow: false },
  { name: "X-Forwarded-Host standing in for a Host that does not match", headers: { host: "127.0.0.1:3001", xfp: "https", xfh: H, origin: `https://${H}` }, allow: false },
  { name: "X-Forwarded-Host standing in for a Host that does not match, on a hostile origin", headers: { host: "127.0.0.1:3001", xfp: "https", xfh: "evil.example", origin: "https://evil.example" }, allow: false },
  { name: "missing proxy headers: production fails closed for the https origin", headers: { host: H, origin: `https://${H}` }, allow: false },
  { name: "ambiguous X-Forwarded-Proto: a client value in front of the proxy's (https, http)", headers: { host: H, xfp: "https, http", origin: `https://${H}` }, allow: false },
  { name: "ambiguous X-Forwarded-Proto: a client value in front of the proxy's (http, https)", headers: { host: H, xfp: "http, https", origin: `https://${H}` }, allow: false },
  { name: "garbage X-Forwarded-Proto", headers: { host: H, xfp: "wss", origin: `https://${H}` }, allow: false },
  { name: "production plain-http same-origin is not accepted", headers: { origin: "SELF" }, allow: false },
  { name: "a development origin listed in production is ignored", env: { CORS_DEV_ORIGINS: "http://localhost:5173" }, headers: { host: H, xfp: "https", origin: "http://localhost:5173" }, allow: false },
  { name: "development: an unlisted port", env: { NODE_ENV: "development", CORS_DEV_ORIGINS: "http://localhost:5173" }, headers: { host: H, origin: "http://localhost:4000" }, allow: false },
  { name: "development: an https page is not the plain-http dev server", env: { NODE_ENV: "development" }, headers: { origin: "https://127.0.0.1:SELFPORT" }, allow: false },
];

const resolve = (row: Row): Row => {
  const self = `http://127.0.0.1:${port}`;
  const origin = row.headers.origin === "SELF" ? self : row.headers.origin?.replace("SELFPORT", String(port));
  const host = row.headers.origin === "SELF" || row.headers.origin?.includes("SELFPORT") ? `127.0.0.1:${port}` : row.headers.host;
  return { ...row, headers: { ...row.headers, ...(origin !== undefined ? { origin } : {}), ...(host !== undefined ? { host } : {}) } };
};

for (const raw of ROWS) {
  test(`${raw.allow ? "ALLOW" : "REFUSE"}: ${raw.name}`, async () => {
    const row = resolve(raw);
    setEnv(row.env ?? {});
    const before = lookups;

    const poll = await polling(row.headers);
    const ws = await upgrade(row.headers);

    if (row.allow) {
      assert.equal(poll.status, 200, "polling handshake");
      assert.ok(poll.sid, "a session was established");
      assert.equal(ws.opened, true, "websocket handshake");
      // Both realtime servers, end to end, with a valid credential.
      assert.equal(await client("/dm", row.headers), true, "/dm");
      assert.equal(await client("/notifications", row.headers), true, "/notifications");
    } else {
      assert.equal(poll.status, 403, "polling handshake");
      assert.equal(poll.sid, null, "no session is established");
      assert.deepEqual({ opened: ws.opened, status: ws.status }, { opened: false, status: 403 }, "websocket handshake");
      assert.equal(lookups, before, "refused before authentication: the account lookup was never reached, though the request carried a valid cookie");
      assert.equal(await client("/dm", row.headers), false, "/dm");
      assert.equal(await client("/notifications", row.headers), false, "/notifications");
      assert.equal(lookups, before, "and still not reached for the real clients, which presented a valid token");
    }
  });
}

test("requests with no Origin are unaffected by the origin policy in every configuration, and are still authenticated", async () => {
  for (const env of [{}, { TRUST_PROXY: "false" }, { NODE_ENV: "development" }, { CLIENT_URL: `https://${H}` }]) {
    setEnv(env);
    assert.equal((await polling({ host: H })).status, 200);
    assert.equal((await upgrade({ host: H })).opened, true);
    assert.equal(await client("/dm", { host: H }), true);
    assert.equal(await client("/notifications", { host: H }), true);
  }
});

test("a sid-bearing request cannot be used to switch to an origin the first request would have been refused for", async () => {
  setEnv({ CLIENT_URL: `https://${H}` });
  const first = await polling({ host: H, xfp: "https", origin: `https://${H}` });
  assert.equal(first.status, 200);
  const sid = first.sid!;
  const follow = (origin: string, method = "GET") => new Promise<number>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: `/socket.io/?EIO=4&transport=polling&sid=${sid}`, headers: { Host: H, "X-Forwarded-Proto": "https", Origin: origin, ...(method === "POST" ? { "content-length": 2 } : {}) } }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", reject);
    req.end(method === "POST" ? "40" : undefined);
  });
  assert.equal(await follow(`http://${H}`), 403);
  assert.equal(await follow(`capacitor://${H}`, "POST"), 403);
  assert.equal(await follow("https://evil.example"), 403);
  assert.equal(await follow(`https://${H}`), 200);
  const probe = await new Promise<{ opened: boolean; status?: number }>((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket&sid=${sid}`, { headers: { Host: H, "X-Forwarded-Proto": "https", Origin: `http://${H}` } });
    ws.on("open", () => { ws.close(); resolve({ opened: true }); });
    ws.on("unexpected-response", (_req, res) => { res.resume(); resolve({ opened: false, status: res.statusCode }); });
    ws.on("error", () => resolve({ opened: false }));
  });
  assert.deepEqual(probe, { opened: false, status: 403 });
});
