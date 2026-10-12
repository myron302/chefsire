/**
 * The origin allowlist: what counts as a configured origin, what is refused, and how production differs from development.
 * Pure functions only; the behavior over HTTP and Socket.IO is covered by routes/cors-http.test.ts and
 * realtime/socket-origin-policy.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createEnvCorsPolicy, isSameOrigin, normalizeOrigin, resolveCorsPolicy } from "./cors-policy";

test("normalizeOrigin reduces a configured value to a bare, canonical origin", () => {
  assert.equal(normalizeOrigin("https://chefsire.com"), "https://chefsire.com");
  assert.equal(normalizeOrigin("  https://ChefSire.COM/  "), "https://chefsire.com", "case and one trailing slash");
  assert.equal(normalizeOrigin("https://chefsire.com:443"), "https://chefsire.com", "default port");
  assert.equal(normalizeOrigin("http://localhost:5173"), "http://localhost:5173");
  assert.equal(normalizeOrigin("http://[::1]:3000"), "http://[::1]:3000");
  assert.equal(normalizeOrigin("capacitor://localhost"), "capacitor://localhost", "opaque scheme used by hybrid mobile apps");
  assert.equal(normalizeOrigin("ionic://LocalHost"), "ionic://localhost");
});

test("normalizeOrigin refuses anything that is not exactly an origin instead of trimming it into one", () => {
  for (const bad of [
    "", "   ", "*", "null", "NULL", "https://*.chefsire.com", "*.chefsire.com", "chefsire.com", "//chefsire.com", "https://",
    "https://chefsire.com/app", "https://chefsire.com/?x=1", "https://chefsire.com#frag", "https://user:pw@chefsire.com", "https://chefsire.com@evil.example",
    "https://chefsire.com, https://evil.example", "https://chefsire.com https://evil.example", "https://chefsire.com\\@evil.example",
    "javascript:alert(1)", "https://exa mple.com", "capacitor://local host", `https://${"a".repeat(3000)}.com`,
  ]) {
    assert.equal(normalizeOrigin(bad), null, `accepted ${JSON.stringify(bad.slice(0, 60))}`);
  }
  for (const notAString of [undefined, null, 5, {}, ["https://chefsire.com"]]) assert.equal(normalizeOrigin(notAString), null);
});

test("production trusts exactly the configured https application origins and nothing else", () => {
  const policy = resolveCorsPolicy({ NODE_ENV: "production", CLIENT_URL: "https://chefsire.com/", APP_URL: "https://www.chefsire.com" } as NodeJS.ProcessEnv);
  assert.deepEqual([...policy.origins].sort(), ["https://chefsire.com", "https://www.chefsire.com"]);
  assert.equal(policy.match("https://chefsire.com"), "https://chefsire.com");
  assert.equal(policy.match("https://www.chefsire.com"), "https://www.chefsire.com");
  for (const other of ["https://evil.example", "https://chefsire.com.evil.example", "https://sub.chefsire.com", "http://chefsire.com", "https://chefsire.com:8443", "null", "", undefined]) {
    assert.equal(policy.match(other), null, `matched ${String(other)}`);
  }
});

test("a received Origin must already be canonical to match: odd case or a trailing slash is not what a browser sends", () => {
  const policy = resolveCorsPolicy({ NODE_ENV: "production", CLIENT_URL: "https://chefsire.com" } as NodeJS.ProcessEnv);
  for (const received of ["https://CHEFSIRE.com", "https://chefsire.com/", " https://chefsire.com", "https://chefsire.com ", "https://chefsire.com, https://evil.example"]) {
    assert.equal(policy.match(received), null, JSON.stringify(received));
  }
});

test("a missing CLIENT_URL fails closed: the allowlist is empty and says so", () => {
  for (const env of [{ NODE_ENV: "production" }, { NODE_ENV: "development" }, {}] as NodeJS.ProcessEnv[]) {
    const policy = resolveCorsPolicy(env);
    assert.equal(policy.origins.size, 0);
    assert.equal(policy.match("https://evil.example"), null);
    assert.equal(policy.match("http://localhost:3000"), null);
    assert.ok(policy.warnings.some((w) => /no trusted browser origin/.test(w)));
  }
});

test("blank and malformed configuration is ignored, reported, and never widened", () => {
  const policy = resolveCorsPolicy({
    NODE_ENV: "production",
    CLIENT_URL: "*",
    APP_URL: "chefsire.com",
    CORS_ALLOWED_ORIGINS: "https://*.chefsire.com, null, https://ok.chefsire.com/path, https://good.example",
  } as NodeJS.ProcessEnv);
  assert.deepEqual([...policy.origins], ["https://good.example"]);
  assert.equal(policy.warnings.filter((w) => /not a valid origin/.test(w)).length, 5);
  assert.equal(policy.match("https://anything.example"), null);
});

test("development origins are honoured only when NODE_ENV is development or test, and only when explicitly listed", () => {
  const dev = resolveCorsPolicy({ NODE_ENV: "development", CORS_DEV_ORIGINS: "http://localhost:5173, http://127.0.0.1:5173" } as NodeJS.ProcessEnv);
  assert.equal(dev.match("http://localhost:5173"), "http://localhost:5173");
  assert.equal(dev.match("http://127.0.0.1:5173"), "http://127.0.0.1:5173");
  assert.equal(dev.match("http://localhost:3000"), null, "an unlisted localhost port is not implied");
  assert.equal(resolveCorsPolicy({ NODE_ENV: "test", CORS_DEV_ORIGINS: "http://localhost:5173" } as NodeJS.ProcessEnv).match("http://localhost:5173"), "http://localhost:5173");

  for (const runtime of ["production", "", "staging", "prod", undefined]) {
    const prod = resolveCorsPolicy({ NODE_ENV: runtime, CORS_DEV_ORIGINS: "http://localhost:5173", CLIENT_URL: "https://chefsire.com" } as NodeJS.ProcessEnv);
    assert.equal(prod.match("http://localhost:5173"), null, `NODE_ENV=${String(runtime)}`);
    assert.equal(prod.match("https://chefsire.com"), "https://chefsire.com");
    assert.ok(prod.warnings.some((w) => /CORS_DEV_ORIGINS/.test(w)));
  }
});

test("the application's own URL in a production runtime must be https and non-loopback; a copied .env.example does not enable localhost", () => {
  const prod = resolveCorsPolicy({ NODE_ENV: "production", CLIENT_URL: "http://localhost:3000", APP_URL: "http://localhost:5000", APP_BASE_URL: "http://chefsire.com" } as NodeJS.ProcessEnv);
  assert.equal(prod.origins.size, 0);
  assert.equal(prod.warnings.filter((w) => /not an https, non-loopback origin/.test(w)).length, 3);

  const dev = resolveCorsPolicy({ NODE_ENV: "development", CLIENT_URL: "http://localhost:3000", APP_URL: "http://localhost:5000" } as NodeJS.ProcessEnv);
  assert.deepEqual([...dev.origins].sort(), ["http://localhost:3000", "http://localhost:5000"]);
});

test("CORS_ALLOWED_ORIGINS is the explicit escape hatch for approved clients, in any runtime", () => {
  const prod = resolveCorsPolicy({ NODE_ENV: "production", CLIENT_URL: "https://chefsire.com", CORS_ALLOWED_ORIGINS: "capacitor://localhost\nhttps://partner.example" } as NodeJS.ProcessEnv);
  assert.equal(prod.match("capacitor://localhost"), "capacitor://localhost");
  assert.equal(prod.match("https://partner.example"), "https://partner.example");
  assert.equal(prod.match("ionic://localhost"), null);
});

test("isSameOrigin compares authority with the Host (or first X-Forwarded-Host) a browser addressed, ignoring scheme", () => {
  assert.equal(isSameOrigin("https://chefsire.com", { host: "chefsire.com" }), true);
  assert.equal(isSameOrigin("http://127.0.0.1:3001", { host: "127.0.0.1:3001" }), true);
  assert.equal(isSameOrigin("https://Chefsire.com", { host: "CHEFSIRE.com" }), true);
  assert.equal(isSameOrigin("https://chefsire.com", { host: "127.0.0.1:3001", "x-forwarded-host": "chefsire.com, internal" }), true);
  assert.equal(isSameOrigin("https://evil.example", { host: "chefsire.com" }), false);
  assert.equal(isSameOrigin("https://chefsire.com:8443", { host: "chefsire.com" }), false, "port is part of the authority");
  assert.equal(isSameOrigin("https://chefsire.com.evil.example", { host: "chefsire.com" }), false);
  assert.equal(isSameOrigin("null", { host: "chefsire.com" }), false);
  assert.equal(isSameOrigin("https://chefsire.com", {}), false);
});

test("the env-backed policy re-reads the environment when it changes and reports each distinct configuration problem once", () => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  const warned: string[] = [];
  const get = createEnvCorsPolicy({ env: () => env, warn: (message) => warned.push(message) });

  assert.equal(get().match("https://chefsire.com"), null);
  get(); get();
  assert.equal(warned.length, 1, "one warning for an unchanged configuration, however many requests");

  env.CLIENT_URL = "https://chefsire.com";
  assert.equal(get().match("https://chefsire.com"), "https://chefsire.com");
  assert.equal(warned.length, 1, "a valid configuration warns about nothing");

  delete env.CLIENT_URL;
  assert.equal(get().match("https://chefsire.com"), null, "removing CLIENT_URL closes it again");
  assert.equal(warned.length, 2);
});
