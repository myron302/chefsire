/**
 * `requireSameOriginJson` (Square connection actions and the catering invoice payment): the CSRF-style origin gate for cookie-authenticated JSON
 * POSTs. It used to admit `${req.protocol}://${Host}` as "this application's own origin". Express's `req.protocol` reads the LEFTMOST
 * X-Forwarded-Proto (the client's own value behind Phusion Passenger, which appends) and answers "http" whenever a TLS-terminating proxy states
 * nothing, so an http page became the own origin of an https deployment -- the same scheme-blind decision as the Socket.IO check, in a second place.
 *
 * Now the own origin comes from lib/request-origin (full origin, trusted-proxy evidence only, fail closed). Driven over real HTTP through the real
 * middleware with hand-set Host / Origin / X-Forwarded-* headers.
 */
import "../test-support/accept-test-sessions";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://u:p@same-origin-json-tests.invalid/none";

const { requireSameOriginJson } = await import("./square-connection");
const { resolveTrustProxy } = await import("../lib/proxy-trust");

const savedEnv = { ...process.env };
const KEYS = ["NODE_ENV", "CLIENT_URL", "APP_BASE_URL", "APP_URL", "CORS_ALLOWED_ORIGINS", "TRUST_PROXY"] as const;
const setEnv = (values: Partial<Record<(typeof KEYS)[number], string>> = {}) => {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "production", ...values });
};

const app = express();
// The real application's trust configuration, evaluated per request so a test can change TRUST_PROXY.
app.use((req, _res, next) => { req.app.set("trust proxy", resolveTrustProxy().setting); next(); });
app.use(express.json());
app.post("/guarded", requireSameOriginJson, (_req, res) => { res.json({ ok: true }); });
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;
test.after(() => {
  server.closeAllConnections?.();
  server.close();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});

const H = "chefsire.test";
function post(headers: Record<string, string | string[]>, contentType: string | null = "application/json") {
  return new Promise<number>((resolve, reject) => {
    const body = contentType === "application/json" ? "{}" : "x=1";
    const req = http.request(
      { host: "127.0.0.1", port, method: "POST", path: "/guarded", headers: { ...(contentType ? { "content-type": contentType } : {}), "content-length": Buffer.byteLength(body), ...headers } },
      (res) => { res.resume(); res.on("end", () => resolve(res.statusCode ?? 0)); },
    );
    req.on("error", reject);
    req.end(body);
  });
}

test("no Origin header proceeds (non-browser callers and same-origin requests that browsers send without one), and the JSON gate still applies", async () => {
  setEnv();
  assert.equal(await post({ Host: H }), 200);
  assert.equal(await post({ Host: H }, "application/x-www-form-urlencoded"), 415);
  assert.equal(await post({ Host: H }, null), 415);
  assert.equal(await post({ Host: H, Origin: `https://${H}`, "X-Forwarded-Proto": "https" }, "text/plain"), 415);
});

test("HTTPS page against the HTTPS application: allowed when a trusted proxy states https", async () => {
  setEnv();
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", Origin: `https://${H}` }), 200);
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "http, https", Origin: `https://${H}` }), 403, "ambiguous: the proxy's value cannot be told from one the client typed in front of it");
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": ["https", "https"], Origin: `https://${H}` }), 403, "two lines are ambiguous too");
});

test("HTTP page against the HTTPS application is refused, however the proxy headers are arranged", async () => {
  setEnv();
  for (const xfp of [{ "X-Forwarded-Proto": "https" }, { "X-Forwarded-Proto": "http" }, { "X-Forwarded-Proto": "https, http" }, { "X-Forwarded-Proto": "http, https" }, {}]) {
    assert.equal(await post({ Host: H, Origin: `http://${H}`, ...xfp }), 403, JSON.stringify(xfp));
  }
});

test("a proxy that states nothing leaves the own origin unknown: nothing derived is accepted, not even the https page", async () => {
  setEnv();
  assert.equal(await post({ Host: H, Origin: `https://${H}` }), 403);
  assert.equal(await post({ Host: H, Origin: `http://${H}` }), 403, "this was accepted before the repair: req.protocol answered http");
  assert.equal(await post({ Host: H, Origin: `https://${H}`, "X-Forwarded-Proto": "wss" }), 403);
});

test("forwarded values from a peer that is not a trusted proxy count for nothing", async () => {
  setEnv({ TRUST_PROXY: "10.0.0.0/8" });
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", Origin: `https://${H}` }), 403);
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", "X-Forwarded-Host": "evil.example", Origin: "https://evil.example" }), 403);
  setEnv({ TRUST_PROXY: "false" });
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", Origin: `https://${H}` }), 403);
});

test("X-Forwarded-Host is never consulted", async () => {
  setEnv();
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", "X-Forwarded-Host": "evil.example", Origin: "https://evil.example" }), 403);
  assert.equal(await post({ Host: "127.0.0.1:3001", "X-Forwarded-Proto": "https", "X-Forwarded-Host": H, Origin: `https://${H}` }), 403);
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", "X-Forwarded-Host": "evil.example", Origin: `https://${H}` }), 200, "and it cannot break the real origin either");
});

test("foreign, custom-scheme, opaque, malformed and non-canonical origins are refused", async () => {
  setEnv();
  const proxy = { Host: H, "X-Forwarded-Proto": "https" };
  for (const origin of [
    "https://evil.example", `https://${H}.evil.example`, `https://${H}:8443`, `capacitor://${H}`, `ionic://${H}`, `ws://${H}`, "null", "", `https://${H}/`, `https://${H}/app`,
    `https://user@${H}`, `https://${H}, https://evil.example`, `HTTPS://${H}`, `https://${H.toUpperCase()}`, "not an origin",
  ]) {
    assert.equal(await post({ ...proxy, Origin: origin }), 403, JSON.stringify(origin));
  }
});

test("a configured CLIENT_URL / APP_BASE_URL admits its origin whatever the proxy says, and only that origin", async () => {
  setEnv({ CLIENT_URL: `https://${H}` });
  assert.equal(await post({ Host: "127.0.0.1:3001", Origin: `https://${H}` }), 200, "the proxy rewrote Host and states nothing");
  assert.equal(await post({ Host: "127.0.0.1:3001", "X-Forwarded-Proto": "http", Origin: `https://${H}` }), 200);
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", Origin: `http://${H}` }), 403);
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", Origin: "https://evil.example" }), 403);

  setEnv({ APP_URL: `https://${H}` });
  assert.equal(await post({ Host: "127.0.0.1:3001", Origin: `https://${H}` }), 200, "APP_URL counts too, as in the CORS policy");
  setEnv({ APP_BASE_URL: `https://${H}/some/path` });
  assert.equal(await post({ Host: "127.0.0.1:3001", Origin: `https://${H}` }), 403, "a configured URL with a path is not an origin: ignored (warned at boot), fail closed");
  setEnv({ CLIENT_URL: "http://localhost:5173" });
  assert.equal(await post({ Host: H, Origin: "http://localhost:5173" }), 403, "a development URL left in production configures nothing");

  // Not an application URL: CORS_ALLOWED_ORIGINS is for read access by approved clients, not for cookie-authenticated state changes.
  setEnv({ CORS_ALLOWED_ORIGINS: "capacitor://localhost" });
  assert.equal(await post({ Host: H, "X-Forwarded-Proto": "https", Origin: "capacitor://localhost" }), 403);
});

test("development/test: the plain-http origin of the server itself is its own, and an https page is not", async () => {
  setEnv({ NODE_ENV: "test" });
  assert.equal(await post({ Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}` }), 200);
  assert.equal(await post({ Host: `127.0.0.1:${port}`, Origin: `https://127.0.0.1:${port}` }), 403);
  assert.equal(await post({ Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port + 1}` }), 403);
  setEnv({ NODE_ENV: "production" });
  assert.equal(await post({ Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}` }), 403, "never in production");
});
