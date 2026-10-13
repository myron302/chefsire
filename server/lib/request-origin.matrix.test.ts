/**
 * The 195-case origin decision matrix (request-origin.matrix.json).
 *
 * The expectations were written from the nine rules of the repair brief -- scheme, hostname and effective port must all match; only canonical http(s)
 * origins; X-Forwarded-Host never used; X-Forwarded-Proto only from a trusted peer and only as one http/https token; TLS here means https; an untrusted
 * peer's plain socket is http; a silent trusted proxy is unknown in production; unknown or invalid Host fails closed; the received Origin must already be
 * canonical -- by an independent investigation that also built a reference implementation (plain JS) and cross-checked it over raw bytes against real
 * http and https listeners. This file runs the SAME cases against the production module, so two independent implementations agree on every one.
 *
 * Exactly six cases differ, and on purpose: the rules would accept an `http` page against an `http` own origin in production (an untrusted peer's plain
 * socket, or a trusted proxy that states http). Production here serves https only -- the auth cookies are `Secure` -- so an http own origin is never
 * accepted there, which is what keeps an http page from being blessed when a TLS-terminating proxy is mis-trusted or mis-configured. Those six are
 * asserted as DENY below; an operator who really runs plain http lists the origin in CORS_ALLOWED_ORIGINS.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { externalOriginOf, isOwnOrigin } from "./request-origin";

type Case = {
  name: string;
  origin?: string | string[];
  host?: string | string[];
  xForwardedProto?: string | string[];
  xForwardedHost?: string | string[];
  socketTls: boolean;
  peerTrusted: boolean;
  runtime: string;
  expected: "ALLOW" | "DENY";
  reason: string;
};

const cases = JSON.parse(readFileSync(new URL("./request-origin.matrix.json", import.meta.url), "utf8")) as Case[];

/** Production refuses an http own origin (policy, beyond the nine rules). */
const PRODUCTION_HTTP_POLICY = new Set(["A20", "A21", "A23", "B11", "H33", "H34"]);

const lines = (value: unknown): string[] => (value === undefined || value === "<absent>" ? [] : Array.isArray(value) ? (value as string[]) : [String(value)]);

function build(c: Case) {
  const env: Record<string, string> = { TRUST_PROXY: c.peerTrusted ? "1" : "false" };
  if (c.runtime !== "(unset)") env.NODE_ENV = c.runtime;
  const rawHeaders: string[] = [];
  for (const [name, value] of [["Origin", c.origin], ["Host", c.host], ["X-Forwarded-Proto", c.xForwardedProto], ["X-Forwarded-Host", c.xForwardedHost]] as const) {
    for (const line of lines(value)) rawHeaders.push(name, line);
  }
  // Node presents repeated lines joined with a comma, except Host, whose later lines it drops.
  const headers: Record<string, string> = {};
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i].toLowerCase();
    if (key === "host" && key in headers) continue;
    headers[key] = key in headers ? `${headers[key]}, ${rawHeaders[i + 1]}` : rawHeaders[i + 1];
  }
  return { env: env as NodeJS.ProcessEnv, req: { headers, rawHeaders, socket: { remoteAddress: "127.0.0.1", encrypted: c.socketTls } } };
}

test("the matrix is the size and shape the investigation produced", () => {
  assert.equal(cases.length, 195);
  assert.equal(cases.filter((c) => c.expected === "ALLOW").length, 31);
  assert.equal(cases.filter((c) => c.expected === "DENY").length, 164);
  assert.equal(new Set(cases.map((c) => c.name.split(" ")[0])).size, 195, "every case has a unique id prefix");
});

for (const c of cases) {
  const id = c.name.split(" ")[0];
  const policy = PRODUCTION_HTTP_POLICY.has(id);
  test(`${policy ? "POLICY DENY" : c.expected}: ${c.name}`, () => {
    const { env, req } = build(c);
    const received = lines(c.origin).length > 1 ? req.headers.origin : lines(c.origin)[0];
    const got = isOwnOrigin(received, req, env);
    assert.equal(got, policy ? false : c.expected === "ALLOW", `${c.reason}`);
    if (policy) {
      assert.deepEqual(externalOriginOf(req, env), { origin: null, reason: "plain_http_in_production" });
    }
  });
}
