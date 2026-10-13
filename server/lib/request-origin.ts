// server/lib/request-origin.ts
/**
 * Is this browser `Origin` the origin of THIS server, as the browser addressed it? Scheme, hostname and effective port must ALL match.
 *
 * This replaces `isSameOrigin()` in cors-policy.ts, which compared only the authority (host:port) of the Origin with the Host header. With the
 * scheme ignored, a page on `http://chefsire.com` was "the same origin" as the `https://chefsire.com` application, and so was
 * `capacitor://chefsire.com`. For a WebSocket that is the whole ballgame: browsers apply no CORS check to it, the handshake carries the
 * site's cookies, and the Origin check is the only thing standing between an untrusted page and an authenticated socket.
 *
 * Inputs are the raw request's headers and socket only. That is deliberate: Socket.IO/engine.io hands the policy a raw `IncomingMessage` that
 * Express never touched, so `req.protocol`, `req.hostname`, `req.ip` and the app's `trust proxy` do not exist there.
 *
 * The server's own external origin is reconstructed from evidence that a browser-based attacker cannot forge, and is UNKNOWN (so the check fails
 * closed and only the explicit allowlist in cors-policy.ts can admit an origin) whenever the evidence is not good enough:
 *
 *   host    exactly one `Host` header LINE (Node silently drops a second one, so duplicates are read from `rawHeaders`), matched against a strict
 *           host[:port] grammar and compared LITERALLY -- it is never run through the URL parser, which "repairs" its input (`127.1`,
 *           `chefsire.com:0443`, `a.com/x` and `user@a.com` all become something else). `X-Forwarded-Host` is NEVER used: a browser puts the
 *           authority it dialled in Host and a page cannot change it; a proxy that rewrites Host is handled by listing the public origin in
 *           CLIENT_URL / APP_URL.
 *   scheme  1. this process terminated TLS (`socket.encrypted`)                              -> https. Nothing a client sends changes that.
 *           2. the direct peer is NOT a trusted proxy (lib/proxy-trust)                      -> http. Its forwarding headers are not even read.
 *           3. a trusted proxy and EXACTLY ONE `X-Forwarded-Proto` line holding exactly one `http` or `https` token (ASCII, only space/tab trimmed)
 *              -> that token. Several lines, a comma list, a blank value or any other token mean the scheme is UNKNOWN: with an ambiguous header
 *              there is no way to tell the proxy's value from one the client typed in front of it. (Express's `req.protocol` takes the LEFTMOST
 *              element, which under Phusion Passenger -- it appends, never overwrites -- is the client's own.)
 *           4. a trusted proxy that sends no `X-Forwarded-Proto` at all -> UNKNOWN in production, because TLS may have ended at the proxy and
 *              "http" would then wrongly bless an http page; in development/test (no TLS-terminating proxy) the socket scheme, http.
 *           5. in production an `http` result is never accepted as this site's own origin (policy, beyond the rules above): production serves its
 *              users over https only (the auth cookies are `Secure`), so a plain-http page is not "the site" however the headers are arranged, and a
 *              mis-set TRUST_PROXY cannot turn that into an accept. An operator who really runs plain http lists the origin in CORS_ALLOWED_ORIGINS.
 *
 * The received Origin must itself be a CANONICAL http(s) origin -- exactly the string a browser serializes: lower-case scheme and host, no default
 * port, no path, no userinfo, no trailing dot, port 1..65535 -- or nothing matches. Compared as (scheme, hostname, effective port).
 *
 * "Trusted" is Express's own `trust proxy` rule applied to the socket's remote address. Under Phusion Passenger the upstream is a Unix socket and a
 * request that arrives over plain HTTP can carry a client-typed `X-Forwarded-Proto: https` that nothing in the request distinguishes from the real
 * one; the only protection is the operator redirecting http to https before it reaches the app. That is why this reconstruction is a fallback: the
 * deployment is expected to put its public https origin in CLIENT_URL / APP_URL / APP_BASE_URL, which the allowlist honours without any of the above.
 * See docs/stability-phase-2a-api-reliability-cors.md.
 */
import type { IncomingMessage } from "node:http";
import { isTrustedProxyPeer } from "./proxy-trust";

const MAX_ORIGIN_LENGTH = 300; // the longest legitimate one is "https://" + a 253-character name + ":65535"
const MAX_HOST_LENGTH = 300;
const MAX_HOSTNAME_LENGTH = 253;
const DEFAULT_PORT = { http: 80, https: 443 } as const;
type Scheme = keyof typeof DEFAULT_PORT;

// A DNS-ish label: letters, digits, underscore and hyphen, never leading/trailing hyphen -- which also rules out empty labels and a leading or
// trailing dot. Deliberately no `i` and no `u` flag anywhere: Unicode case folding makes `/^https$/iu` match "httpſ", and the Kelvin sign
// lower-cases to an ASCII "k". Case is handled explicitly, on text that is already known to be ASCII.
const LABEL = "[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?";
const LABEL_ANYCASE = "[A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?";
const ORIGIN_RE = new RegExp(`^(https?)://((?:${LABEL}(?:\\.${LABEL})*)|(?:\\[[0-9a-f:]{2,45}\\]))(?::([1-9][0-9]{0,4}))?$`);
const HOST_RE = new RegExp(`^((?:${LABEL_ANYCASE}(?:\\.${LABEL_ANYCASE})*)|(?:\\[[0-9A-Fa-f:]{2,45}\\]))(?::([1-9][0-9]{0,4}))?$`);

// Configured / allowlisted origins (operator input, any scheme): lossy normalization, then exact set membership.
const SCHEME_AUTHORITY = /^([a-z][a-z0-9+.-]*):\/\/([^/?#@\\]+)\/?$/i;
const OPAQUE_SCHEME_AUTHORITY = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

/** NODE_ENV values under which development conveniences may apply. Anything else (including unset) is production-strict, as in jwt-config. */
export function isDevelopmentRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const runtime = env.NODE_ENV?.trim().toLowerCase();
  return runtime === "development" || runtime === "test";
}

/**
 * Reduce a CONFIGURED value (an allowlist entry) to a bare, canonical origin (`scheme://host[:port]`, lowercase, default port removed), or null if
 * it is not exactly an origin. Paths other than a single trailing slash, query strings, fragments, userinfo, whitespace, lists and wildcards are
 * refused rather than trimmed, so a value can never be silently widened. Any scheme is accepted (an operator may allowlist `capacitor://localhost`).
 *
 * This is for operator input and is deliberately forgiving about spelling (`HTTPS://Chefsire.com:443/` -> `https://chefsire.com`). A RECEIVED Origin
 * header is never judged by it alone: callers require the received string to equal the result, or use `webOrigin` / `isOwnOrigin`.
 */
export function normalizeOrigin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  if (value === "*" || value.toLowerCase() === "null" || /[\s*,]/.test(value)) return null;
  const match = SCHEME_AUTHORITY.exec(value);
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const authority = match[2];
  if (scheme === "http" || scheme === "https") {
    try {
      const url = new URL(`${scheme}://${authority}`);
      if (!url.hostname || url.username || url.password) return null;
      return url.origin;
    } catch {
      return null;
    }
  }
  // Non-special schemes (capacitor://localhost, ionic://localhost) have an opaque origin to the URL parser, so validate by hand.
  if (!OPAQUE_SCHEME_AUTHORITY.test(authority)) return null;
  return `${scheme}://${authority.toLowerCase()}`;
}

type ParsedOrigin = { readonly scheme: Scheme; readonly hostname: string; readonly port: number };

/** A received Origin as (scheme, hostname, EFFECTIVE port) -- only if it is exactly the canonical serialization of an http(s) origin. */
function parseCanonicalWebOrigin(raw: unknown): ParsedOrigin | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_ORIGIN_LENGTH) return null;
  const match = ORIGIN_RE.exec(raw);
  if (!match) return null; // lower-case http/https only: no capacitor/ionic/file/ws/wss, "null", "", "*", path, query, fragment, userinfo, whitespace, comma, backslash
  const scheme = match[1] as Scheme;
  const hostname = match[2];
  if (hostname.length > MAX_HOSTNAME_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // Canonical form: no explicit default port, no leading zeros, no IDN or IPv4 short forms, compressed lower-case IPv6.
  if (url.origin !== raw) return null;
  const port = match[3] === undefined ? DEFAULT_PORT[scheme] : Number(match[3]);
  if (!(port >= 1 && port <= 65535)) return null; // URL accepts ":0"
  return { scheme, hostname, port };
}

/** `raw` itself if (and only if) it is a canonical http(s) origin, else null. */
export function webOrigin(raw: unknown): string | null {
  return parseCanonicalWebOrigin(raw) === null ? null : (raw as string);
}

export type OwnOriginUnknownReason =
  | "no_host"
  | "invalid_host"
  | "scheme_not_stated_by_proxy"
  | "ambiguous_forwarded_proto"
  | "plain_http_in_production";
export type OwnOrigin = { readonly origin: string } | { readonly origin: null; readonly reason: OwnOriginUnknownReason };

/**
 * The slice of an `IncomingMessage` this module reads. A Socket.IO handshake and an Express request both satisfy it. `rawHeaders` is optional only
 * so unit tests can pass a bare object; real requests always have it, and it is how repeated header LINES are seen (Node keeps the first `Host`
 * line, drops the rest, and joins repeated `X-Forwarded-Proto` lines with a comma).
 */
export type RequestLike = Pick<IncomingMessage, "headers"> & {
  rawHeaders?: string[];
  socket: { remoteAddress?: string; encrypted?: boolean };
};

/** Every value of a header, one entry per header line as received. */
function headerLines(req: RequestLike, name: string): string[] {
  if (Array.isArray(req.rawHeaders)) {
    const lines: string[] = [];
    for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) if (req.rawHeaders[i].toLowerCase() === name) lines.push(req.rawHeaders[i + 1]);
    return lines;
  }
  const value = req.headers[name];
  return typeof value === "string" ? [value] : [];
}

type SchemeResult = Scheme | "unknown_proxy_silent" | "unknown_ambiguous";

function resolveScheme(req: RequestLike, env: NodeJS.ProcessEnv): SchemeResult {
  if (req.socket.encrypted === true) return "https";
  if (!isTrustedProxyPeer(req.socket.remoteAddress, env)) return "http";
  const lines = headerLines(req, "x-forwarded-proto");
  if (lines.length === 0) return isDevelopmentRuntime(env) ? "http" : "unknown_proxy_silent";
  if (lines.length !== 1 || lines[0].length > 16) return "unknown_ambiguous";
  const token = lines[0].replace(/^[ \t]+|[ \t]+$/g, ""); // HTTP optional whitespace only -- never String.prototype.trim(), which also strips NBSP and BOM
  if (!/^[\x21-\x7e]+$/.test(token)) return "unknown_ambiguous"; // ASCII BEFORE any case folding
  const folded = token.toLowerCase();
  return folded === "http" || folded === "https" ? folded : "unknown_ambiguous";
}

/** The Host header as (lower-cased hostname, effective port for `scheme`), or null. Never goes through the URL parser. */
function parseHost(req: RequestLike, scheme: Scheme): { hostname: string; port: number } | null {
  const lines = headerLines(req, "host");
  if (lines.length !== 1) return null;
  const raw = lines[0];
  if (raw.length === 0 || raw.length > MAX_HOST_LENGTH) return null;
  const match = HOST_RE.exec(raw);
  if (!match) return null;
  const hostname = match[1].toLowerCase(); // safe: ASCII by construction
  if (hostname.length > MAX_HOSTNAME_LENGTH) return null;
  const port = match[2] === undefined ? DEFAULT_PORT[scheme] : Number(match[2]);
  return port >= 1 && port <= 65535 ? { hostname, port } : null;
}

/** This server's own external origin for a request, or `{ origin: null, reason }` when it cannot be established securely. */
export function externalOriginOf(req: RequestLike, env: NodeJS.ProcessEnv = process.env): OwnOrigin {
  const hostLines = headerLines(req, "host");
  if (hostLines.length === 0 || hostLines[0].length === 0) return { origin: null, reason: "no_host" };

  const resolved = resolveScheme(req, env);
  if (resolved === "unknown_proxy_silent") return { origin: null, reason: "scheme_not_stated_by_proxy" };
  if (resolved === "unknown_ambiguous") return { origin: null, reason: "ambiguous_forwarded_proto" };
  if (resolved === "http" && !isDevelopmentRuntime(env)) return { origin: null, reason: "plain_http_in_production" };

  const host = parseHost(req, resolved);
  if (host === null) return { origin: null, reason: "invalid_host" };
  const port = host.port === DEFAULT_PORT[resolved] ? "" : `:${host.port}`;
  return { origin: `${resolved}://${host.hostname}${port}` };
}

/**
 * Is the received Origin exactly this server's own origin? Never true for a non-http(s) or non-canonical Origin, and never true when the server's
 * own origin cannot be established.
 */
export function isOwnOrigin(received: unknown, req: RequestLike, env: NodeJS.ProcessEnv = process.env): boolean {
  const origin = parseCanonicalWebOrigin(received);
  if (origin === null) return false;
  const own = externalOriginOf(req, env);
  return own.origin !== null && own.origin === received;
}
