/**
 * Stability Phase 2A: CORS over real HTTP, through the REAL `server/app.ts`.
 *
 * The audit's claim was that a missing CLIENT_URL makes the API permissive. The first test reproduces the previous middleware
 * (`cors({ credentials: true, origin: process.env.CLIENT_URL || true })`) so the claim is checked against actual behavior rather than
 * asserted: with CLIENT_URL unset it answers an arbitrary foreign origin with that origin plus `Access-Control-Allow-Credentials: true`.
 * Everything after that drives the application as shipped.
 */
import "../test-support/accept-test-sessions";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import cors from "cors";
import express from "express";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://app:secret@127.0.0.1:9/chefsire_cors_test";
process.env.SQUARE_ENV = "sandbox";
process.env.SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY = "test-signature-key";
process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL = "https://chefsire.test/api/catering/webhooks/square";

const { db } = await import("../db");
const { default: app } = await import("../app");

// The catering webhook service writes through drizzle; give it a thenable chain so a correctly signed delivery completes without a database.
{
  const chain = (rows: unknown[]) => {
    const proxy: any = new Proxy(function () {}, {
      get: (_target, prop) => (prop === "then" ? (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) : () => proxy),
      apply: () => proxy,
    });
    return proxy;
  };
  (db as any).insert = () => chain([]);
  (db as any).update = () => chain([{ id: "event-row", state: "processing" }]);
  (db as any).select = () => chain([]);
}

const PRODUCTION_ORIGIN = "https://chefsire.com";
const EVIL = "https://evil.example";
const CORS_ENV = ["NODE_ENV", "CLIENT_URL", "APP_BASE_URL", "APP_URL", "CORS_ALLOWED_ORIGINS", "CORS_DEV_ORIGINS"] as const;
const savedEnv = Object.fromEntries(CORS_ENV.map((key) => [key, process.env[key]]));

function configure(values: Partial<Record<(typeof CORS_ENV)[number], string>>) {
  for (const key of CORS_ENV) delete process.env[key];
  Object.assign(process.env, values);
}

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as AddressInfo).port;
const base = `http://127.0.0.1:${port}`;
const ownOrigin = `http://127.0.0.1:${port}`;

test.after(() => {
  for (const key of CORS_ENV) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  server.close();
  server.closeAllConnections?.();
});

async function request(method: string, path: string, headers: Record<string, string> = {}, body?: string) {
  const response = await fetch(base + path, { method, headers, body });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text };
}

const acao = (r: { headers: Headers }) => r.headers.get("access-control-allow-origin");
const acac = (r: { headers: Headers }) => r.headers.get("access-control-allow-credentials");
const noCorsHeaders = (r: { headers: Headers }) => {
  for (const name of ["access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-methods", "access-control-allow-headers"]) {
    assert.equal(r.headers.get(name), null, `${name} must be absent`);
  }
};

// ------------------------------------------------------------------------------------------------------------------------------
test("verification: the previous configuration reflects any origin, with credentials, when CLIENT_URL is missing", async () => {
  const savedClientUrl = process.env.CLIENT_URL;
  delete process.env.CLIENT_URL;
  const legacy = express();
  legacy.use(cors({ credentials: true, origin: process.env.CLIENT_URL || true }));
  legacy.get("/api/me", (_req, res) => res.json({ secret: "authenticated response" }));
  const legacyServer = http.createServer(legacy);
  await new Promise<void>((resolve) => legacyServer.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(legacyServer.address() as AddressInfo).port}/api/me`, { headers: { Origin: EVIL, Cookie: "auth_token=victim" } });
    assert.equal(response.headers.get("access-control-allow-origin"), EVIL, "reflected");
    assert.equal(response.headers.get("access-control-allow-credentials"), "true", "with credentials: a foreign page may read the response");
    await response.arrayBuffer();
  } finally {
    legacyServer.close();
    if (savedClientUrl !== undefined) process.env.CLIENT_URL = savedClientUrl;
  }

  // The same request against the application as shipped.
  configure({});
  const current = await request("GET", "/api", { Origin: EVIL, Cookie: "auth_token=victim" });
  assert.equal(current.status, 200);
  noCorsHeaders(current);
});

test("allowed production origin: answered with its own value, credentials, and Vary: Origin", async () => {
  configure({ NODE_ENV: "production", CLIENT_URL: PRODUCTION_ORIGIN });
  const response = await request("GET", "/api", { Origin: PRODUCTION_ORIGIN });
  assert.equal(response.status, 200);
  assert.equal(acao(response), PRODUCTION_ORIGIN);
  assert.equal(acac(response), "true");
  assert.match(response.headers.get("vary") ?? "", /\bOrigin\b/i);
});

test("the configured URL is normalized: a trailing slash or odd case in CLIENT_URL still works, and the header is the canonical origin", async () => {
  configure({ NODE_ENV: "production", CLIENT_URL: "https://ChefSire.com/" });
  const response = await request("GET", "/api", { Origin: PRODUCTION_ORIGIN });
  assert.equal(acao(response), PRODUCTION_ORIGIN);
});

test("disallowed external origin: no CORS headers (the browser will not expose the response), and the request is not otherwise altered", async () => {
  configure({ NODE_ENV: "production", CLIENT_URL: PRODUCTION_ORIGIN });
  for (const origin of [EVIL, "https://chefsire.com.evil.example", "http://chefsire.com", "https://sub.chefsire.com", "https://chefsire.com:8443", "null"]) {
    const response = await request("GET", "/api", { Origin: origin, Cookie: "auth_token=victim" });
    assert.equal(response.status, 200, origin);
    noCorsHeaders(response);
    assert.match(response.headers.get("vary") ?? "", /\bOrigin\b/i, "caches must not reuse an allowed origin's answer");
  }
});

test("missing CLIENT_URL fails closed in every runtime: nothing is reflected, no wildcard is sent", async () => {
  for (const runtime of ["production", "development", "test"]) {
    configure({ NODE_ENV: runtime });
    for (const origin of [EVIL, PRODUCTION_ORIGIN, "http://localhost:3000", "http://localhost:5173"]) {
      const response = await request("GET", "/api", { Origin: origin, Cookie: "auth_token=x" });
      assert.equal(response.status, 200);
      noCorsHeaders(response);
    }
  }
});

test("same-origin requests are untouched: they work with nothing configured and carry no CORS requirement", async () => {
  configure({ NODE_ENV: "production" });
  const get = await request("GET", "/api", { Origin: ownOrigin });
  assert.equal(get.status, 200);

  // A same-origin POST carries an Origin header in browsers. It must reach the router (404 here for an unknown path), not a 403.
  const post = await request("POST", "/api/definitely-not-a-route", { Origin: ownOrigin, "content-type": "application/json" }, "{}");
  assert.equal(post.status, 404);
  assert.deepEqual(JSON.parse(post.text), { error: "API endpoint not found" });

  // Requests with no Origin at all (same-origin GET, curl, server-to-server) are not CORS requests.
  const bare = await request("GET", "/api");
  assert.equal(bare.status, 200);
  noCorsHeaders(bare);
  assert.doesNotMatch(bare.headers.get("vary") ?? "", /\bOrigin\b/i, "no Origin header, nothing to vary on");
});

test("valid development origin: honoured when explicitly configured outside production, ignored in production", async () => {
  configure({ NODE_ENV: "development", CORS_DEV_ORIGINS: "http://localhost:5173" });
  const dev = await request("GET", "/api", { Origin: "http://localhost:5173" });
  assert.equal(acao(dev), "http://localhost:5173");
  assert.equal(acac(dev), "true");
  noCorsHeaders(await request("GET", "/api", { Origin: "http://localhost:4000" }));

  configure({ NODE_ENV: "development", CLIENT_URL: "http://localhost:3000" });
  assert.equal(acao(await request("GET", "/api", { Origin: "http://localhost:3000" })), "http://localhost:3000");

  configure({ NODE_ENV: "production", CORS_DEV_ORIGINS: "http://localhost:5173", CLIENT_URL: PRODUCTION_ORIGIN });
  noCorsHeaders(await request("GET", "/api", { Origin: "http://localhost:5173" }));
  assert.equal(acao(await request("GET", "/api", { Origin: PRODUCTION_ORIGIN })), PRODUCTION_ORIGIN);

  // A localhost CLIENT_URL copied from .env.example into production does not turn a development origin on.
  configure({ NODE_ENV: "production", CLIENT_URL: "http://localhost:3000" });
  noCorsHeaders(await request("GET", "/api", { Origin: "http://localhost:3000" }));
});

test("credentialed requests: cookies and Authorization never earn Access-Control-Allow-Credentials from an untrusted origin", async () => {
  configure({ NODE_ENV: "production", CLIENT_URL: PRODUCTION_ORIGIN });
  const credentials = { Cookie: "auth_token=session-cookie", Authorization: "Bearer not-a-real-token" };
  const trusted = await request("GET", "/api", { Origin: PRODUCTION_ORIGIN, ...credentials });
  assert.equal(acao(trusted), PRODUCTION_ORIGIN);
  assert.equal(acac(trusted), "true");
  assert.notEqual(acao(trusted), "*");

  for (const origin of [EVIL, "null", "https://chefsire.com.evil.example"]) {
    const untrusted = await request("GET", "/api", { Origin: origin, ...credentials });
    assert.equal(acac(untrusted), null);
    assert.notEqual(acao(untrusted), "*");
    assert.notEqual(acao(untrusted), origin);
  }
});

test("a duplicated Origin header cannot smuggle an untrusted origin past an allowed one", () => new Promise<void>((resolve, reject) => {
  configure({ NODE_ENV: "production", CLIENT_URL: PRODUCTION_ORIGIN });
  const req = http.request({ host: "127.0.0.1", port, path: "/api", headers: { origin: [PRODUCTION_ORIGIN, EVIL] as unknown as string } }, (res) => {
    try {
      assert.equal(res.headers["access-control-allow-origin"], undefined);
      assert.equal(res.headers["access-control-allow-credentials"], undefined);
      res.resume();
      resolve();
    } catch (error) { reject(error); }
  });
  req.on("error", reject);
  req.end();
}));

test("OPTIONS preflight: an allowed origin gets a 204 with its own origin, credentials, methods and the (valid) requested headers", async () => {
  configure({ NODE_ENV: "production", CLIENT_URL: PRODUCTION_ORIGIN });
  const response = await request("OPTIONS", "/api/catering/bookings", {
    Origin: PRODUCTION_ORIGIN,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type, authorization, x-idempotency-key",
  });
  assert.equal(response.status, 204);
  assert.equal(acao(response), PRODUCTION_ORIGIN);
  assert.equal(acac(response), "true");
  assert.match(response.headers.get("access-control-allow-methods") ?? "", /\bPOST\b/);
  assert.equal(response.headers.get("access-control-allow-headers"), "content-type, authorization, x-idempotency-key");
  assert.match(response.headers.get("vary") ?? "", /\bOrigin\b/i);

  const malformed = await request("OPTIONS", "/api", {
    Origin: PRODUCTION_ORIGIN,
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "x-ok, <script>",
  });
  assert.equal(malformed.status, 204);
  assert.equal(malformed.headers.get("access-control-allow-headers"), null, "an unparsable request-headers list is not echoed");
});

test("OPTIONS preflight: a disallowed or unconfigured origin is refused with 403 and no CORS headers", async () => {
  configure({ NODE_ENV: "production", CLIENT_URL: PRODUCTION_ORIGIN });
  const refused = await request("OPTIONS", "/api/catering/bookings", { Origin: EVIL, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" });
  assert.equal(refused.status, 403);
  noCorsHeaders(refused);
  assert.deepEqual(JSON.parse(refused.text), { error: "Origin not allowed" });

  configure({ NODE_ENV: "production" });
  const unconfigured = await request("OPTIONS", "/api", { Origin: PRODUCTION_ORIGIN, "Access-Control-Request-Method": "GET" });
  assert.equal(unconfigured.status, 403);
  noCorsHeaders(unconfigured);

  // An OPTIONS request that is not a CORS preflight (no Access-Control-Request-Method) is not treated as one.
  const plain = await request("OPTIONS", "/api", { Origin: EVIL });
  assert.notEqual(plain.status, 403);
  noCorsHeaders(plain);
});

test("OPTIONS preflight from the server's own origin is never refused", async () => {
  configure({ NODE_ENV: "production" });
  const response = await request("OPTIONS", "/api", { Origin: ownOrigin, "Access-Control-Request-Method": "GET" });
  assert.notEqual(response.status, 403);
});

test("third-party webhooks and OAuth redirects do not depend on, and are not blocked by, the origin policy", async () => {
  const delivery = JSON.stringify({ event_id: "evt-cors-1", type: "customer.created", merchant_id: "MERCHANT_1", data: { object: {} } });
  const signature = createHmac("sha256", "test-signature-key").update(process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL! + delivery).digest("base64");
  const headers = { "content-type": "application/json", "x-square-hmacsha256-signature": signature };

  for (const cfg of [{}, { NODE_ENV: "production", CLIENT_URL: PRODUCTION_ORIGIN }] as const) {
    configure(cfg);
    // Square delivers server to server: no Origin header.
    const plain = await request("POST", "/api/catering/webhooks/square", headers, delivery);
    assert.equal(plain.status, 200, plain.text);
    assert.deepEqual(JSON.parse(plain.text), { ok: true });
    // Even if a sender includes an Origin that is not allowlisted, the webhook is processed (verified by signature, not by origin)...
    const withForeignOrigin = await request("POST", "/api/catering/webhooks/square", { ...headers, Origin: "https://connect.squareupsandbox.com" }, delivery);
    assert.equal(withForeignOrigin.status, 200);
    noCorsHeaders(withForeignOrigin); // ...and no browser is given read access to the response.
    // A forged delivery is still refused by the signature check, whatever Origin it claims.
    const forged = await request("POST", "/api/catering/webhooks/square", { ...headers, "x-square-hmacsha256-signature": "AAAA", Origin: PRODUCTION_ORIGIN }, delivery);
    assert.equal(forged.status, 401);
  }

  // OAuth: provider redirects are top-level navigations (no Origin) and a cross-site form_post callback carries a foreign Origin. Neither
  // is answered differently by the CORS layer: the status is whatever the route decides, identical with or without the allowlist.
  const statuses: number[][] = [];
  for (const cfg of [{}, { NODE_ENV: "production", CLIENT_URL: PRODUCTION_ORIGIN }] as const) {
    configure(cfg);
    const navigation = await fetch(`${base}/api/auth/google/callback?error=access_denied`, { redirect: "manual" });
    await navigation.arrayBuffer();
    const formPost = await fetch(`${base}/api/auth/google/callback`, {
      method: "POST",
      redirect: "manual",
      headers: { Origin: "https://accounts.google.com", "content-type": "application/x-www-form-urlencoded" },
      body: "code=abc&state=xyz",
    });
    await formPost.arrayBuffer();
    statuses.push([navigation.status, formPost.status]);
    assert.notEqual(formPost.status, 403, "a foreign Origin on a non-preflight request is not rejected by the CORS layer");
    assert.equal(formPost.headers.get("access-control-allow-origin"), null);
  }
  assert.deepEqual(statuses[0], statuses[1], "OAuth routes behave the same under both configurations");
});
