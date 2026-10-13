/**
 * Full-origin validation: scheme + hostname + effective port, with the scheme established only from evidence a client cannot forge.
 *
 * Pure tests over `externalOriginOf` / `isOwnOrigin` with fake requests, so every combination of Origin, Host, X-Forwarded-*, TLS state, peer
 * trust and runtime can be enumerated. The same decision is exercised end to end over real Socket.IO in realtime/socket-origin-policy.test.ts
 * and over real HTTP in routes/cors-http.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { externalOriginOf, isOwnOrigin, normalizeOrigin, webOrigin } from "./request-origin";

type Fake = { host?: string; xfp?: string; xfh?: string; tls?: boolean; peer?: string | undefined };
const fake = (f: Fake) => ({
  headers: {
    ...(f.host !== undefined ? { host: f.host } : {}),
    ...(f.xfp !== undefined ? { "x-forwarded-proto": f.xfp } : {}),
    ...(f.xfh !== undefined ? { "x-forwarded-host": f.xfh } : {}),
  },
  socket: { remoteAddress: "peer" in f ? f.peer : "127.0.0.1", encrypted: f.tls },
});

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;
/** Production, TRUST_PROXY unset => one hop => the direct peer IS the proxy (the Plesk/Passenger shape). */
const PROD_TRUSTED = env({ NODE_ENV: "production" });
/** Production, but the loopback peer is not a configured proxy. */
const PROD_UNTRUSTED = env({ NODE_ENV: "production", TRUST_PROXY: "10.0.0.0/8" });
const PROD_NO_PROXY = env({ NODE_ENV: "production", TRUST_PROXY: "false" });
const PROD_LOOPBACK = env({ NODE_ENV: "production", TRUST_PROXY: "loopback" });
const DEV = env({ NODE_ENV: "development" });
const TEST = env({ NODE_ENV: "test" });
const DEV_UNTRUSTED = env({ NODE_ENV: "development", TRUST_PROXY: "10.0.0.0/8" });

const own = (f: Fake, e: NodeJS.ProcessEnv) => externalOriginOf(fake(f), e);
const same = (origin: unknown, f: Fake, e: NodeJS.ProcessEnv) => isOwnOrigin(origin, fake(f), e);

test("HTTPS page to HTTPS application: same-origin when a trusted proxy states https", () => {
  const f = { host: "chefsire.com", xfp: "https" };
  assert.deepEqual(own(f, PROD_TRUSTED), { origin: "https://chefsire.com" });
  assert.equal(same("https://chefsire.com", f, PROD_TRUSTED), true);
});

test("HTTP page to HTTPS application is rejected however the evidence is arranged", () => {
  const arrangements: Array<[string, Fake, NodeJS.ProcessEnv]> = [
    ["trusted proxy states https", { host: "chefsire.com", xfp: "https" }, PROD_TRUSTED],
    ["this process terminated TLS", { host: "chefsire.com", tls: true }, PROD_TRUSTED],
    ["TLS here, client claims http", { host: "chefsire.com", tls: true, xfp: "http" }, PROD_TRUSTED],
    ["untrusted peer claims https", { host: "chefsire.com", xfp: "https" }, PROD_UNTRUSTED],
    ["untrusted peer, nothing claimed", { host: "chefsire.com" }, PROD_UNTRUSTED],
    ["proxy states nothing", { host: "chefsire.com" }, PROD_TRUSTED],
    ["proxy states http (a plain-http listener is never the site in production)", { host: "chefsire.com", xfp: "http" }, PROD_TRUSTED],
    ["forwarding trust switched off", { host: "chefsire.com", xfp: "https" }, PROD_NO_PROXY],
    ["Unix-socket peer under an address-list trust setting", { host: "chefsire.com", xfp: "https", peer: undefined }, PROD_LOOPBACK],
    ["junk in front of the proxy's value", { host: "chefsire.com", xfp: "http, https" }, PROD_TRUSTED],
  ];
  for (const [name, f, e] of arrangements) assert.equal(same("http://chefsire.com", f, e), false, name);
});

test("TLS terminated by this process is https whatever the headers say", () => {
  for (const e of [PROD_TRUSTED, PROD_NO_PROXY, PROD_UNTRUSTED, PROD_LOOPBACK]) {
    for (const xfp of [undefined, "http", "https", "ws", "http, http"]) {
      assert.deepEqual(own({ host: "chefsire.com", tls: true, ...(xfp ? { xfp } : {}) }, e), { origin: "https://chefsire.com" });
    }
  }
  assert.equal(same("http://chefsire.com", { host: "chefsire.com", tls: true, xfp: "http" }, PROD_TRUSTED), false);
});

test("a custom-scheme or otherwise non-web Origin with a matching hostname is rejected", () => {
  const f = { host: "chefsire.com", xfp: "https" };
  for (const origin of [
    "capacitor://chefsire.com", "ionic://chefsire.com", "file://chefsire.com", "chrome-extension://chefsire.com", "app://chefsire.com", "ws://chefsire.com",
    "wss://chefsire.com", "ftp://chefsire.com", "javascript://chefsire.com", "data://chefsire.com", "blob://chefsire.com", "about://chefsire.com", "view-source://chefsire.com",
  ]) {
    assert.equal(same(origin, f, PROD_TRUSTED), false, origin);
    assert.equal(same(origin, { host: "chefsire.com" }, DEV), false, `${origin} (dev)`);
  }
});

test("a different hostname or a different port is rejected", () => {
  const f = { host: "chefsire.com", xfp: "https" };
  for (const origin of [
    "https://evil.example", "https://chefsire.com.evil.example", "https://evilchefsire.com", "https://sub.chefsire.com", "https://chefsire.co", "https://chefsire.com:8443",
    "https://chefsire.com:444", "https://chefsire.com:80", "https://chefsire.com:0",
  ]) {
    assert.equal(same(origin, f, PROD_TRUSTED), false, origin);
  }
  assert.equal(same("https://chefsire.com", { host: "chefsire.com:8443", xfp: "https" }, PROD_TRUSTED), false);
  assert.equal(same("https://chefsire.com:8443", { host: "chefsire.com:8443", xfp: "https" }, PROD_TRUSTED), true);
  assert.equal(same("https://chefsire.com:8443", { host: "chefsire.com", xfp: "https" }, PROD_TRUSTED), false);
});

test("effective port: the server side normalizes default ports; a received Origin must already be canonical", () => {
  assert.deepEqual(own({ host: "chefsire.com:443", xfp: "https" }, PROD_TRUSTED), { origin: "https://chefsire.com" });
  assert.deepEqual(own({ host: "chefsire.com:80", xfp: "https" }, PROD_TRUSTED), { origin: "https://chefsire.com:80" });
  assert.deepEqual(own({ host: "chefsire.com:80", xfp: "http" }, DEV), { origin: "http://chefsire.com" });
  assert.equal(same("https://chefsire.com", { host: "chefsire.com:443", xfp: "https" }, PROD_TRUSTED), true);
  assert.equal(same("https://chefsire.com:443", { host: "chefsire.com", xfp: "https" }, PROD_TRUSTED), false, "a browser never sends :443");
  assert.equal(same("https://chefsire.com", { host: "chefsire.com:80", xfp: "https" }, PROD_TRUSTED), false);
});

test("malformed, opaque and non-canonical Origin values are rejected", () => {
  const f = { host: "chefsire.com", xfp: "https" };
  for (const origin of [
    "", " ", "null", "NULL", "*", "chefsire.com", "//chefsire.com", "https://", "https:///", "https://chefsire.com/", "https://chefsire.com/path", "https://chefsire.com?x=1",
    "https://chefsire.com#f", "https://user@chefsire.com", "https://user:pw@chefsire.com", "https://chefsire.com\\@evil.example", "https://chefsire.com, https://evil.example",
    "https://evil.example, https://chefsire.com", "https://chefsire.com https://evil.example", " https://chefsire.com", "https://chefsire.com ", "HTTPS://chefsire.com",
    "https://CHEFSIRE.com", "https://chefsire.com.", "https://chefsire.com\r\nX-Injected: 1", "https://chefsire.com\u0000", "https://exa mple.com", "https:chefsire.com",
    "https:/chefsire.com", "https://chefsire.com:abc", "https://chefsire.com:99999", "https://[::1", "https://chefsire.com\t", "https://chefsire.com%00",
  ]) {
    assert.equal(same(origin, f, PROD_TRUSTED), false, JSON.stringify(origin));
  }
  for (const notAString of [undefined, null, 5, {}, ["https://chefsire.com"], true]) assert.equal(same(notAString, f, PROD_TRUSTED), false);
});

test("spoofed X-Forwarded-Host never produces an allowed origin, and never changes the real one", () => {
  const spoofed = { host: "chefsire.com", xfp: "https", xfh: "evil.example" };
  for (const e of [PROD_TRUSTED, PROD_UNTRUSTED, PROD_NO_PROXY, DEV, TEST]) {
    assert.equal(same("https://evil.example", spoofed, e), false);
    assert.equal(same("http://evil.example", { ...spoofed, xfp: "http" }, e), false);
  }
  assert.deepEqual(own(spoofed, PROD_TRUSTED), { origin: "https://chefsire.com" }, "the header is ignored, not merged");
  assert.equal(same("https://chefsire.com", spoofed, PROD_TRUSTED), true);
  // The forwarded host cannot rescue a Host that does not match either.
  assert.equal(same("https://chefsire.com", { host: "127.0.0.1:3001", xfp: "https", xfh: "chefsire.com" }, PROD_TRUSTED), false);
  assert.equal(same("https://chefsire.com", { host: "127.0.0.1:3001", xfp: "https", xfh: "chefsire.com, evil.example" }, PROD_TRUSTED), false);
});

test("spoofed X-Forwarded-Proto cannot make an untrusted peer look like https, and cannot downgrade a TLS socket", () => {
  const spoofed = { host: "chefsire.com", xfp: "https" };
  for (const [e, peer] of [[PROD_UNTRUSTED, "127.0.0.1"], [PROD_NO_PROXY, "127.0.0.1"], [PROD_LOOPBACK, undefined], [PROD_LOOPBACK, "203.0.113.9"]] as const) {
    const request = { ...spoofed, peer };
    assert.equal(own(request, e).origin, null, "production never trusts a plain-http listener as the site");
    assert.equal(same("https://chefsire.com", request, e), false);
    assert.equal(same("http://chefsire.com", request, e), false);
  }
  // Development has no TLS-terminating proxy: an untrusted peer's plain socket is http and its header is ignored.
  assert.deepEqual(own(spoofed, DEV_UNTRUSTED), { origin: "http://chefsire.com" });
  assert.equal(same("https://chefsire.com", spoofed, DEV_UNTRUSTED), false);
  assert.equal(same("http://chefsire.com", spoofed, DEV_UNTRUSTED), true);
});

test("X-Forwarded-Proto from a trusted peer must be ONE line holding ONE http/https token; anything else is ambiguous and fails closed", () => {
  // Single tokens: case-insensitive, space/tab padding tolerated.
  assert.deepEqual(own({ host: "chefsire.com", xfp: "https" }, PROD_TRUSTED), { origin: "https://chefsire.com" });
  assert.deepEqual(own({ host: "chefsire.com", xfp: " HTTPS " }, PROD_TRUSTED), { origin: "https://chefsire.com" });
  assert.deepEqual(own({ host: "chefsire.com", xfp: "\thttps\t" }, PROD_TRUSTED), { origin: "https://chefsire.com" });
  assert.deepEqual(own({ host: "chefsire.com", xfp: "Http" }, DEV), { origin: "http://chefsire.com" });

  // A list means the proxy's value cannot be told from one the client typed in front of it (Phusion Passenger appends to the client's own): ambiguous,
  // whichever end looks right, in every runtime.
  for (const xfp of ["https, http", "http, https", "https,https", "https, https", "evil, https", "https, ", ",https", "https,", ",", "", " ", "ws", "wss", "ftp", "https://", "https;", "h ttps", "1", "true", "https ,ws", "https, ftp", "\u00a0https", "https\u00a0", "httpſ", "ｈttps"]) {
    for (const e of [PROD_TRUSTED, DEV]) {
      assert.deepEqual(own({ host: "chefsire.com", xfp }, e), { origin: null, reason: "ambiguous_forwarded_proto" }, `${JSON.stringify(xfp)} ${e.NODE_ENV}`);
    }
    assert.equal(same("https://chefsire.com", { host: "chefsire.com", xfp }, PROD_TRUSTED), false, JSON.stringify(xfp));
    assert.equal(same("http://chefsire.com", { host: "chefsire.com", xfp }, PROD_TRUSTED), false, JSON.stringify(xfp));
  }

  // Several LINES (Node joins them with a comma in `headers`; `rawHeaders` shows them separately) are ambiguous even when identical.
  const twoLines = { headers: { host: "chefsire.com", "x-forwarded-proto": "https, https" }, rawHeaders: ["Host", "chefsire.com", "X-Forwarded-Proto", "https", "X-Forwarded-Proto", "https"], socket: { remoteAddress: "127.0.0.1" } };
  assert.deepEqual(externalOriginOf(twoLines, PROD_TRUSTED), { origin: null, reason: "ambiguous_forwarded_proto" });
});

test("a repeated Host line is invalid: Node keeps the first and silently drops the rest, so only rawHeaders shows it", () => {
  const twoHosts = (first: string, second: string) => ({
    headers: { host: first, "x-forwarded-proto": "https" },
    rawHeaders: ["Host", first, "Host", second, "X-Forwarded-Proto", "https"],
    socket: { remoteAddress: "127.0.0.1" },
  });
  assert.deepEqual(externalOriginOf(twoHosts("chefsire.com", "evil.example"), PROD_TRUSTED), { origin: null, reason: "invalid_host" });
  assert.deepEqual(externalOriginOf(twoHosts("evil.example", "chefsire.com"), PROD_TRUSTED), { origin: null, reason: "invalid_host" });
  assert.equal(isOwnOrigin("https://chefsire.com", twoHosts("chefsire.com", "chefsire.com"), PROD_TRUSTED), false);
});

test("Host is compared literally, never repaired by the URL parser", () => {
  // Outside the host[:port] grammar: no origin at all.
  for (const host of ["chefsire.com:0443", "chefsire.com:0", "chefsire.com:65536", "chefsire..com", ".chefsire.com", "chefsire.com.", "münchen.de", "chefsire.com:", "chefsire.com:+443"]) {
    assert.equal(own({ host, xfp: "https" }, PROD_TRUSTED).origin, null, `Host ${JSON.stringify(host)}`);
  }
  // Inside the grammar but not in the canonical spelling a browser sends: the origin is the LITERAL text, so it can never equal a canonical Origin
  // (the URL parser would have rewritten each of these into the canonical form, and thereby matched).
  assert.deepEqual(own({ host: "127.1:3001", xfp: "https" }, PROD_TRUSTED), { origin: "https://127.1:3001" });
  assert.equal(same("https://127.0.0.1:3001", { host: "127.1:3001", xfp: "https" }, PROD_TRUSTED), false);
  assert.equal(same("https://127.0.0.1:3001", { host: "0x7f.1:3001", xfp: "https" }, PROD_TRUSTED), false);
  assert.equal(same("https://[::1]:3001", { host: "[0:0:0:0:0:0:0:1]:3001", xfp: "https" }, PROD_TRUSTED), false);
  assert.equal(same("https://chefsire.com", { host: "chefsire.com:0443", xfp: "https" }, PROD_TRUSTED), false);
  // And the canonical spellings still work.
  assert.deepEqual(own({ host: "CHEFSIRE.COM:443", xfp: "https" }, PROD_TRUSTED), { origin: "https://chefsire.com" });
  assert.deepEqual(own({ host: "[2001:db8::1]:8443", xfp: "https" }, PROD_TRUSTED), { origin: "https://[2001:db8::1]:8443" });
});

test("missing proxy headers: production fails closed for BOTH schemes; development falls back to the socket scheme", () => {
  const f = { host: "chefsire.com" };
  assert.deepEqual(own(f, PROD_TRUSTED), { origin: null, reason: "scheme_not_stated_by_proxy" });
  assert.equal(same("https://chefsire.com", f, PROD_TRUSTED), false);
  assert.equal(same("http://chefsire.com", f, PROD_TRUSTED), false, "a TLS-terminating proxy that states nothing must not bless an http page");
  for (const e of [env({}), env({ NODE_ENV: "staging" }), env({ NODE_ENV: "prod" }), env({ NODE_ENV: "" }), env({ NODE_ENV: "Production" })]) {
    assert.equal(own(f, e).origin, null, `NODE_ENV=${String(e.NODE_ENV)} is production-strict`);
  }
  for (const e of [DEV, TEST]) {
    assert.deepEqual(own(f, e), { origin: "http://chefsire.com" });
    assert.equal(same("http://chefsire.com", f, e), true);
    assert.equal(same("https://chefsire.com", f, e), false);
  }
});

test("correct trusted-proxy HTTPS forwarding works for hostnames, ports and IPv6 literals", () => {
  assert.equal(same("https://app.chefsire.com", { host: "app.chefsire.com", xfp: "https" }, PROD_TRUSTED), true);
  assert.equal(same("https://chefsire.com", { host: "CHEFSIRE.com", xfp: "https" }, PROD_TRUSTED), true, "Host is lowercased on the server side");
  assert.equal(same("https://CHEFSIRE.com", { host: "CHEFSIRE.com", xfp: "https" }, PROD_TRUSTED), false, "but a received Origin must already be lowercase");
  assert.equal(same("https://[2001:db8::1]:8443", { host: "[2001:db8::1]:8443", xfp: "https" }, PROD_TRUSTED), true);
  assert.equal(same("https://[2001:db8::1]", { host: "[2001:db8::1]", xfp: "https" }, PROD_TRUSTED), true);
  assert.equal(same("https://xn--bcher-kva.example", { host: "xn--bcher-kva.example", xfp: "https" }, PROD_TRUSTED), true);
  // Every trusted-proxy topology that states the scheme works: hop counts, loopback over TCP (including the IPv4-mapped form), a listed address.
  assert.equal(same("https://chefsire.com", { host: "chefsire.com", xfp: "https" }, env({ NODE_ENV: "production", TRUST_PROXY: "2" })), true);
  assert.equal(same("https://chefsire.com", { host: "chefsire.com", xfp: "https" }, PROD_LOOPBACK), true);
  assert.equal(same("https://chefsire.com", { host: "chefsire.com", xfp: "https", peer: "::ffff:127.0.0.1" }, PROD_LOOPBACK), true);
  assert.equal(same("https://chefsire.com", { host: "chefsire.com", xfp: "https", peer: "203.0.113.9" }, env({ NODE_ENV: "production", TRUST_PROXY: "203.0.113.9" })), true);
  // Phusion Passenger over a Unix socket: no peer address, hop-count trust, Passenger appended https on a TLS request.
  assert.equal(same("https://chefsire.com", { host: "chefsire.com", xfp: "https", peer: undefined }, PROD_TRUSTED), true);
});

test("an invalid or absent Host means the server's own origin is unknown", () => {
  for (const host of [
    undefined, "", "chefsire.com/evil", "user@chefsire.com", "chefsire.com evil", "chefsire.com\t", "chefsire.com:", "chefsire.com:99999x", "-", ".", "[::1", "a".repeat(300),
    "chefsire.com, evil.example", "chefsire.com?x", "chefsire.com#x", "chefsire.com\\evil", "https://chefsire.com", "[]", "chefsire.com:80:80",
  ]) {
    assert.equal(externalOriginOf(fake({ host, xfp: "https" }), PROD_TRUSTED).origin, null, JSON.stringify(host));
  }
});

test("a trailing-dot host is a different origin and fails closed", () => {
  assert.equal(same("https://chefsire.com", { host: "chefsire.com.", xfp: "https" }, PROD_TRUSTED), false);
  assert.equal(same("https://chefsire.com.", { host: "chefsire.com", xfp: "https" }, PROD_TRUSTED), false);
});

test("trust follows the Express rule on the socket address: hop counts trust a Unix-socket peer, address lists cannot", () => {
  const unix = { host: "chefsire.com", xfp: "https", peer: undefined };
  assert.deepEqual(own(unix, PROD_TRUSTED), { origin: "https://chefsire.com" });
  assert.equal(own(unix, PROD_LOOPBACK).origin, null, "address-list trust cannot vouch for a peer with no address; production refuses http");
  assert.equal(own({ ...unix, peer: "203.0.113.9" }, PROD_LOOPBACK).origin, null);
  assert.deepEqual(own({ ...unix, peer: "127.0.0.1" }, PROD_LOOPBACK), { origin: "https://chefsire.com" });
  assert.deepEqual(own({ ...unix, peer: "::1" }, PROD_LOOPBACK), { origin: "https://chefsire.com" });
});

test("an unusable TRUST_PROXY fails closed at request time", () => {
  for (const raw of ["true", "banana", "9"]) {
    assert.equal(own({ host: "chefsire.com", xfp: "https" }, env({ NODE_ENV: "production", TRUST_PROXY: raw })).origin, null, raw);
  }
});

test("development same-origin over plain http still works, on a bare IP, a port and an IPv6 literal", () => {
  assert.equal(same("http://127.0.0.1:3001", { host: "127.0.0.1:3001" }, DEV), true);
  assert.equal(same("http://localhost:5000", { host: "localhost:5000" }, TEST), true);
  assert.equal(same("http://localhost:5001", { host: "localhost:5000" }, TEST), false);
  assert.equal(same("http://[::1]:3000", { host: "[::1]:3000" }, DEV), true);
  assert.equal(same("https://localhost:5000", { host: "localhost:5000" }, DEV), false, "an https page is not the plain-http dev server");
  assert.equal(same("http://localhost:5000", { host: "localhost:5000", xfp: "https" }, DEV), false, "a dev proxy that says https makes an http page foreign");
});

test("a development fallback never reaches production", () => {
  const f = { host: "localhost:5000" };
  assert.equal(same("http://localhost:5000", f, DEV), true);
  assert.equal(same("http://localhost:5000", f, PROD_TRUSTED), false);
  assert.equal(same("http://localhost:5000", f, env({})), false);
});

test("webOrigin accepts only canonical http(s) origins; normalizeOrigin still accepts operator-allowlisted custom schemes", () => {
  assert.equal(webOrigin("https://chefsire.com"), "https://chefsire.com");
  assert.equal(webOrigin("capacitor://localhost"), null);
  assert.equal(webOrigin("ws://chefsire.com"), null);
  assert.equal(normalizeOrigin("capacitor://localhost"), "capacitor://localhost");
});
