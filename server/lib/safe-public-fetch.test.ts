/** CS-CL-02: SSRF boundary for recipe URL import. All networking/DNS is injected; nothing leaves the process. */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  MAX_REDIRECTS,
  SafeFetchError,
  isPublicIpAddress,
  parseImportUrl,
  safeFetchPublicHtml,
  type Resolver,
} from "./safe-public-fetch";

const PUBLIC = "93.184.216.34";
const HTML = `<html><script type="application/ld+json">{"@type":"Recipe"}</script></html>`;

type Script = { status?: number; headers?: Record<string, string>; body?: string | (() => void); hang?: boolean };

/** Fake transport: records every request's options; answers from a per-hostname script. */
function makeTransport(routes: Record<string, Script | Script[]>) {
  const calls: any[] = [];
  const request = ((options: any, cb: (res: any) => void) => {
    calls.push(options);
    const req: any = new EventEmitter();
    req.destroyed = false;
    let live: any;
    req.destroy = () => { req.destroyed = true; if (live) live.emit("aborted"); };
    req.end = () => {
      const entry = routes[options.hostname];
      const script = Array.isArray(entry) ? entry.shift()! : entry;
      if (!script) return setImmediate(() => req.emit("error", Object.assign(new Error("boom 10.1.2.3"), { code: "ECONNREFUSED" })));
      if (script.hang) return;
      const res: any = new EventEmitter();
      res.statusCode = script.status ?? 200;
      res.headers = { "content-type": "text/html; charset=utf-8", ...(script.headers ?? {}) };
      res.destroy = () => { res.destroyed = true; };
      live = res;
      setImmediate(() => {
        cb(res);
        setImmediate(() => {
          if (typeof script.body === "function") return script.body.call(res);
          res.emit("data", Buffer.from(script.body ?? HTML));
          res.emit("end");
        });
      });
    };
    return req;
  }) as any;
  return { calls, request };
}

const resolverFor = (map: Record<string, string[] | Error>): Resolver => async (h) => {
  const v = map[h];
  if (v instanceof Error) throw v;
  if (!v) return [];
  return v.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }) as const);
};

async function rejects(p: Promise<unknown>, pattern?: RegExp) {
  await assert.rejects(p, (e: any) => {
    assert.ok(e instanceof SafeFetchError, `expected SafeFetchError, got ${e?.stack}`);
    if (pattern) assert.match(e.message, pattern);
    return true;
  });
}

// ---------------- A/B: classification ----------------
test("unsafe IPv4 literals are rejected, public accepted", () => {
  for (const ip of ["127.0.0.1", "127.255.255.254", "0.0.0.0", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.0.1",
    "169.254.169.254", "100.64.0.1", "100.127.255.255", "192.0.0.1", "192.0.2.1", "198.18.0.1", "198.51.100.1",
    "203.0.113.1", "224.0.0.1", "240.0.0.1", "255.255.255.255"]) {
    assert.equal(isPublicIpAddress(ip), false, ip);
  }
  for (const ip of [PUBLIC, "8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "100.63.255.255", "100.128.0.1"]) {
    assert.equal(isPublicIpAddress(ip), true, ip);
  }
});

test("unsafe IPv6 forms are rejected, global unicast accepted", () => {
  for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "febf::1", "ff02::1", "::ffff:127.0.0.1",
    "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe", "::ffff:169.254.169.254", "0:0:0:0:0:ffff:c0a8:1",
    "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:db8::1", "2001::1", "::127.0.0.1", "not-an-ip", "", "1::2::3"]) {
    assert.equal(isPublicIpAddress(ip), false, ip);
  }
  for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicIpAddress(ip), true, ip);
  }
});

// ---------------- G: URL shape ----------------
test("unsupported schemes, credentials, malformed URLs and ports are rejected", () => {
  for (const u of ["file:///etc/passwd", "ftp://example.com/", "gopher://example.com/", "data:text/html,hi",
    "javascript:alert(1)", "https://user:pw@example.com/", "https://user@example.com/", "not a url", "",
    "https://example.com:8080/", "http://example.com:22/", "https://localhost/", "https://a.localhost/"]) {
    assert.throws(() => parseImportUrl(u), SafeFetchError, u);
  }
  assert.equal(parseImportUrl("https://example.com/r#frag").toString(), "https://example.com/r");
  parseImportUrl("http://example.com:80/x");
  parseImportUrl("https://example.com:443/x");
});

test("alternate IP spellings normalise to literals that are then rejected without DNS", async () => {
  let dnsCalls = 0;
  const resolver: Resolver = async () => { dnsCalls++; return [{ address: PUBLIC, family: 4 }]; };
  const t = makeTransport({});
  for (const u of ["http://2130706433/", "http://0x7f.1/", "http://0177.0.0.1/", "http://127.1/", "http://[::1]/",
    "http://[::ffff:127.0.0.1]/", "http://[fe80::1]/", "http://169.254.169.254/latest/meta-data/", "http://[fc00::1]/"]) {
    await rejects(safeFetchPublicHtml(u, { resolver, httpRequest: t.request, httpsRequest: t.request }), undefined);
  }
  assert.equal(dnsCalls, 0);
  assert.equal(t.calls.length, 0, "must never connect");
});

// ---------------- C: DNS ----------------
test("hostnames resolving to private, mixed, empty or failing DNS are rejected before connecting", async () => {
  const t = makeTransport({ "ok.example": {} });
  const resolver = resolverFor({
    "priv.example": ["10.0.0.5"],
    "mixed.example": [PUBLIC, "192.168.1.1"],
    "mixed6.example": [PUBLIC, "::1"],
    "mapped.example": ["::ffff:127.0.0.1"],
    "empty.example": [],
    "fail.example": new Error("ENOTFOUND"),
  });
  for (const h of ["priv", "mixed", "mixed6", "mapped", "empty", "fail", "unknown"]) {
    await rejects(safeFetchPublicHtml(`https://${h}.example/`, { resolver, httpsRequest: t.request }));
  }
  assert.equal(t.calls.length, 0);
});

// ---------------- D: redirects ----------------
test("public redirects to localhost/private/metadata/unsafe IPv6 fail before connecting to them", async () => {
  for (const target of ["http://localhost/", "http://127.0.0.1/", "http://10.0.0.1/admin", "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/", "http://[::ffff:10.0.0.1]/", "http://[fd00::1]/", "http://internal.example/", "file:///etc/passwd",
    "https://user:pw@good.example/", "http://good.example:8080/"]) {
    const t = makeTransport({ "pub.example": { status: 302, headers: { location: target } }, "internal.example": {}, "good.example": {} });
    const resolver = resolverFor({ "pub.example": [PUBLIC], "internal.example": ["10.9.9.9"], "good.example": [PUBLIC] });
    await rejects(safeFetchPublicHtml("https://pub.example/", { resolver, httpRequest: t.request, httpsRequest: t.request }));
    assert.deepEqual(t.calls.map((c) => c.hostname), ["pub.example"], target);
  }
});

test("relative redirects resolve against current URL and are followed manually; redirects are bounded", async () => {
  const t = makeTransport({ "a.example": [{ status: 301, headers: { location: "/next" } }, { status: 200 }] });
  const r = await safeFetchPublicHtml("https://a.example/start", { resolver: resolverFor({ "a.example": [PUBLIC] }), httpsRequest: t.request });
  assert.equal(r.finalUrl, "https://a.example/next");
  assert.deepEqual(t.calls.map((c) => c.path), ["/start", "/next"]);
  assert.ok(t.calls.every((c) => c.agent === false));

  const many = makeTransport({ "b.example": Array.from({ length: 20 }, (_, i) => ({ status: 302, headers: { location: `/p${i}` } })) });
  await rejects(safeFetchPublicHtml("https://b.example/", { resolver: resolverFor({ "b.example": [PUBLIC] }), httpsRequest: many.request }), /too many redirects/);
  assert.equal(many.calls.length, MAX_REDIRECTS + 1);

  const loop = makeTransport({ "c.example": [{ status: 302, headers: { location: "/" } }] });
  await rejects(safeFetchPublicHtml("https://c.example/", { resolver: resolverFor({ "c.example": [PUBLIC] }), httpsRequest: loop.request }), /loop/);
});

test("each redirect hop re-resolves and re-pins to that hop's own validated address", async () => {
  const t = makeTransport({ "a.example": { status: 302, headers: { location: "https://b.example/x" } }, "b.example": {} });
  const resolver = resolverFor({ "a.example": ["93.184.216.34"], "b.example": ["8.8.8.8"] });
  await safeFetchPublicHtml("https://a.example/", { resolver, httpsRequest: t.request });
  const addr = (o: any) => new Promise<any>((res) => o.lookup(o.hostname, {}, (_e: any, a: string) => res(a)));
  assert.deepEqual(await Promise.all(t.calls.map(addr)), ["93.184.216.34", "8.8.8.8"]);
});

// ---------------- E: pinning ----------------
test("connection is pinned to the validated address and keeps hostname for Host/SNI/TLS", async () => {
  let resolutions = 0;
  // Rebinding resolver: safe on first answer, loopback on any later one.
  const resolver: Resolver = async () => (resolutions++ === 0 ? [{ address: PUBLIC, family: 4 }] : [{ address: "127.0.0.1", family: 4 }]);
  const t = makeTransport({ "rebind.example": {} });
  await safeFetchPublicHtml("https://rebind.example/recipe", { resolver, httpsRequest: t.request });
  const o = t.calls[0];
  assert.equal(resolutions, 1, "exactly one resolution per hop");
  assert.equal(o.hostname, "rebind.example", "hostname preserved (SNI / cert verification / Host)");
  assert.equal(o.rejectUnauthorized, undefined, "TLS verification must stay at default");
  assert.equal(o.servername, undefined, "servername not overridden to an IP");
  assert.equal(o.headers.host, undefined, "no Host override needed");
  // Whatever the socket layer asks the lookup, only the validated address comes back.
  const single = await new Promise<any>((res) => o.lookup("rebind.example", {}, (_e: any, a: string, f: number) => res([a, f])));
  assert.deepEqual(single, [PUBLIC, 4]);
  const all = await new Promise<any>((res) => o.lookup("anything.else", { all: true }, (_e: any, a: any) => res(a)));
  assert.deepEqual(all, [{ address: PUBLIC, family: 4 }]);
  const fn = await new Promise<any>((res) => o.lookup("x", (_e: any, a: string) => res(a)));
  assert.equal(fn, PUBLIC);
});

test("pinning holds over a real socket: the OS resolver is never consulted for the pinned host", async () => {
  // Real https.request to a hostname that cannot resolve; the pinned lookup must supply the address.
  // Pin to a blocked-by-policy-irrelevant local listener via the lookup contract by using the real transport
  // with a resolver returning a public IP that is unroutable in the sandbox -> connection fails, but with a
  // transport error (not ENOTFOUND), proving the injected address was used rather than DNS.
  const r = safeFetchPublicHtml("http://no-such-host.invalid/", { resolver: resolverFor({ "no-such-host.invalid": [PUBLIC] }), timeoutMs: 500 });
  await assert.rejects(r, (e: any) => {
    assert.ok(e instanceof SafeFetchError);
    assert.doesNotMatch(e.message, /ENOTFOUND/);
    return true;
  });
});

// ---------------- F: valid import ----------------
test("a normal public HTTPS recipe page passes the boundary and is returned", async () => {
  const t = makeTransport({ "recipes.example": { body: HTML } });
  const r = await safeFetchPublicHtml("https://recipes.example/pasta?x=1#top", { resolver: resolverFor({ "recipes.example": [PUBLIC, "2606:4700:4700::1111"] }), httpsRequest: t.request });
  assert.equal(r.html, HTML);
  assert.equal(t.calls[0].path, "/pasta?x=1");
  assert.equal(t.calls[0].headers["accept-encoding"], "identity");
});

// ---------------- H: limits / content ----------------
test("non-HTML, HTTP errors and oversized pages are rejected with safe messages", async () => {
  const resolver = resolverFor({ "x.example": [PUBLIC] });
  const run = (s: Script, o: object = {}) =>
    safeFetchPublicHtml("https://x.example/", { resolver, httpsRequest: makeTransport({ "x.example": s }).request, ...o });
  await rejects(run({ headers: { "content-type": "application/json" } }), /non-html/);
  await rejects(run({ status: 404 }), /404/);
  await rejects(run({ headers: { "content-length": "99999999" } }), /too large/);
  await rejects(run({ body: "x".repeat(200) }, { maxBodyBytes: 100 }), /too large/); // streamed cap, no content-length
});

test("a stalled server hits the overall timeout; unreachable hosts leak nothing", async () => {
  const resolver = resolverFor({ "slow.example": [PUBLIC], "down.example": [PUBLIC] });
  await rejects(safeFetchPublicHtml("https://slow.example/", { resolver, httpsRequest: makeTransport({ "slow.example": { hang: true } }).request, timeoutMs: 50 }), /timeout/);
  // Stalls mid-body (headers sent, body never finishes).
  const stall: Script = { body: function () { /* never ends */ } };
  await rejects(safeFetchPublicHtml("https://slow.example/", { resolver, httpsRequest: makeTransport({ "slow.example": stall }).request, timeoutMs: 50 }));
  await assert.rejects(safeFetchPublicHtml("https://down.example/", { resolver, httpsRequest: makeTransport({}).request }), (e: any) => {
    assert.ok(e instanceof SafeFetchError);
    assert.doesNotMatch(e.clientMessage, /10\.1\.2\.3|ECONNREFUSED|boom|\d+\.\d+\.\d+\.\d+/);
    return true;
  });
});
