// server/lib/cors-policy.ts
/**
 * ONE browser-origin policy for ChefSire's HTTP API and both Socket.IO servers.
 *
 * What it replaces (server/app.ts and the two realtime modules):
 *
 *   cors({ credentials: true, origin: process.env.CLIENT_URL || true })       // HTTP
 *   new Server(httpServer, { cors: { origin: true, credentials: true } })      // Socket.IO, twice
 *
 * `origin: true` makes the `cors` package REFLECT the request's Origin header. With `credentials: true` that answers every origin
 * with `Access-Control-Allow-Origin: <that origin>` + `Access-Control-Allow-Credentials: true`, which is the one combination browsers
 * will let a foreign page read an authenticated response under. It was the behavior whenever CLIENT_URL was missing from the
 * environment, and it was UNCONDITIONAL for Socket.IO whatever CLIENT_URL said. (When CLIENT_URL was set, the HTTP side sent that one
 * fixed string for every request and browsers matched it; but it was never normalized, so a trailing slash silently disabled it.)
 *
 * The rules now:
 *
 *  - There is an explicit allowlist and nothing else. Allowed browser origins are exactly those named in the environment:
 *      CLIENT_URL, APP_BASE_URL, APP_URL   the application's own public URL(s); in production they must be https and not loopback
 *      CORS_ALLOWED_ORIGINS                comma/space separated extras for approved clients (e.g. a mobile web view's capacitor://localhost)
 *      CORS_DEV_ORIGINS                    comma/space separated development origins; ignored unless NODE_ENV is "development" or "test"
 *    Every entry is normalized to a bare origin (scheme://host[:port]). Wildcards, "null", paths, userinfo and unparsable values are
 *    refused (and reported once at startup), never half-honoured.
 *  - Nothing configured means nothing is allowed: a missing CLIENT_URL fails CLOSED, it does not fail open. The SPA is served by this
 *    same server, so same-origin traffic does not depend on any of this.
 *  - An allowed origin is answered with ITS OWN value (never a reflection of an unvalidated header), `Vary: Origin`, and credentials.
 *    There is no wildcard anywhere, and no credentials without an exact match.
 *  - An untrusted origin gets NO CORS headers, so a browser will not let its page read the response, and a preflight from it is
 *    refused with 403. The request itself is NOT rejected: CORS is a browser read-protection, and refusing every cross-origin request
 *    would break form-POST OAuth callbacks and other legitimate cross-site navigations. (It is also not a CSRF defense; see
 *    docs/stability-phase-2a-api-reliability-cors.md.)
 *  - A request with no Origin header is not a cross-origin browser request at all (same-origin GET/HEAD, curl, a native mobile app,
 *    Square's server-to-server webhook delivery, an OAuth redirect) and is untouched by this policy.
 *  - Sockets apply the same allowlist to EVERY engine request, which is the part that matters: browsers do not enforce CORS on WebSocket
 *    connections, so for a WebSocket the server's own origin check is the only one there is. A request that carries an Origin which is
 *    neither allowlisted nor this server's own is refused; one with no Origin (a non-browser client) is let through to the namespace
 *    authentication, which still demands a verified token.
 *  - "This server's own origin" means the FULL origin -- scheme, hostname and effective port -- reconstructed by lib/request-origin from
 *    evidence a page cannot forge (the Host header, the TLS state of the socket, and X-Forwarded-Proto only from a trusted proxy), and it is
 *    UNKNOWN, so nothing is same-origin and only this allowlist admits an origin, whenever that evidence is missing or ambiguous. Matching
 *    hostnames alone is never enough: http://chefsire.com and capacitor://chefsire.com are not https://chefsire.com.
 */
import type { IncomingMessage } from "node:http";
import type { Request, RequestHandler, Response } from "express";
import { externalOriginOf, isDevelopmentRuntime, isOwnOrigin, normalizeOrigin, webOrigin, type RequestLike } from "./request-origin";

// The origin parser lives in request-origin (it is shared with the same-origin decision); re-exported for existing importers.
export { normalizeOrigin };

const HEADER_TOKEN_LIST = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+(?:\s*,\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+)*$/;

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127\.\d+\.\d+\.\d+$/.test(host) || host === "0.0.0.0";
}

function splitList(raw: string | undefined): string[] {
  return (raw ?? "").split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean);
}

export interface CorsPolicy {
  /** The complete set of origins allowed to make credentialed cross-origin browser requests. */
  readonly origins: ReadonlySet<string>;
  /** Human-readable notes about configuration that was refused or looks wrong. Never contains a secret. */
  readonly warnings: readonly string[];
  /** The canonical allowed origin for a received Origin header value, or null. Exact match only. */
  match(origin: unknown): string | null;
}

export function resolveCorsPolicy(env: NodeJS.ProcessEnv = process.env): CorsPolicy {
  const development = isDevelopmentRuntime(env);
  const origins = new Set<string>();
  const warnings: string[] = [];

  const add = (variable: string, raw: string, mode: "application" | "explicit") => {
    const origin = normalizeOrigin(raw);
    if (!origin) {
      warnings.push(`${variable}: "${raw.length > 80 ? `${raw.slice(0, 80)}...` : raw}" is not a valid origin (scheme://host[:port], no wildcard, path or credentials); ignored`);
      return;
    }
    if (mode === "application" && !development) {
      // The application's own URL in a production runtime must be a real https origin. A copy of the localhost URL from .env.example
      // would otherwise turn a development origin on in production; an operator who truly needs one lists it in CORS_ALLOWED_ORIGINS.
      let hostname = "";
      try { hostname = new URL(origin).hostname; } catch { /* non-http scheme handled below */ }
      if (!origin.startsWith("https://") || isLoopbackHost(hostname)) {
        warnings.push(`${variable}: ${origin} is not an https, non-loopback origin; not trusted for cross-origin requests in a production runtime`);
        return;
      }
    }
    origins.add(origin);
  };

  for (const variable of ["CLIENT_URL", "APP_BASE_URL", "APP_URL"] as const) {
    const value = env[variable]?.trim();
    if (value) add(variable, value, "application");
  }
  for (const entry of splitList(env.CORS_ALLOWED_ORIGINS)) add("CORS_ALLOWED_ORIGINS", entry, "explicit");
  if (development) {
    for (const entry of splitList(env.CORS_DEV_ORIGINS)) add("CORS_DEV_ORIGINS", entry, "explicit");
  } else if (splitList(env.CORS_DEV_ORIGINS).length > 0) {
    warnings.push("CORS_DEV_ORIGINS is set but NODE_ENV is not development/test; development origins are ignored");
  }

  if (origins.size === 0) {
    warnings.push("no trusted browser origin is configured (CLIENT_URL, APP_BASE_URL, APP_URL, CORS_ALLOWED_ORIGINS): cross-origin browser access is denied; same-origin traffic is unaffected");
  }

  return {
    origins,
    warnings,
    match(origin: unknown): string | null {
      const canonical = normalizeOrigin(origin);
      // Browsers send the canonical serialization. A value that only normalizes to something allowed (trailing slash, odd case) is not
      // what a browser sends, so it does not match.
      if (!canonical || canonical !== origin) return null;
      return origins.has(canonical) ? canonical : null;
    },
  };
}

/**
 * A policy resolved from `process.env` on use, rebuilt only when the relevant variables change, with each distinct set of warnings
 * logged once. Reading lazily (instead of at import) keeps the policy correct however early this module is imported relative to the
 * environment loader, and lets tests vary the environment.
 */
export function createEnvCorsPolicy(options: { env?: () => NodeJS.ProcessEnv; warn?: (message: string) => void } = {}): () => CorsPolicy {
  const readEnv = options.env ?? (() => process.env);
  const warn = options.warn ?? ((message: string) => console.warn(`[cors] ${message}`));
  let key: string | null = null;
  let policy: CorsPolicy | null = null;
  return () => {
    const env = readEnv();
    const nextKey = ["NODE_ENV", "CLIENT_URL", "APP_BASE_URL", "APP_URL", "CORS_ALLOWED_ORIGINS", "CORS_DEV_ORIGINS"].map((name) => env[name] ?? "").join("\u0000");
    if (policy === null || nextKey !== key) {
      key = nextKey;
      policy = resolveCorsPolicy(env);
      for (const message of policy.warnings) warn(message);
    }
    return policy;
  };
}

/** The process-wide policy used by app.ts and both realtime servers, so they cannot drift apart. */
export const currentCorsPolicy = createEnvCorsPolicy();

export type OriginVerdict =
  | { readonly allowed: true; readonly via: "allowlist" | "own_origin" }
  | { readonly allowed: false; readonly unverifiable: boolean };

/**
 * May a browser page at `origin` talk to this server? Yes if the origin is on the explicit allowlist, or is exactly this server's own full
 * origin (scheme + host + effective port, see lib/request-origin). `unverifiable` marks a refusal that LOOKS like our own site (an http(s) origin
 * on the very authority the browser addressed) but that we could not verify because our own scheme is unknown or contradicts it: that is the
 * signature of a deployment that needs CLIENT_URL/APP_URL (or a proxy that states X-Forwarded-Proto), and is the only refusal worth logging.
 */
export function originVerdict(req: RequestLike, origin: unknown, getPolicy: () => CorsPolicy = currentCorsPolicy, env: NodeJS.ProcessEnv = process.env): OriginVerdict {
  if (getPolicy().match(origin) !== null) return { allowed: true, via: "allowlist" };
  if (isOwnOrigin(origin, req, env)) return { allowed: true, via: "own_origin" };
  const web = webOrigin(origin);
  const host = typeof req.headers.host === "string" ? req.headers.host.toLowerCase() : "";
  const looksLikeUs = web !== null && web === origin && web.replace(/^https?:\/\//, "") === host.replace(/:(80|443)$/, "");
  return { allowed: false, unverifiable: looksLikeUs && externalOriginOf(req, env).origin === null };
}

const REFUSAL_LOG_INTERVAL_MS = 10 * 60 * 1000;
let lastRefusalLogAt = 0;
/** One line, at most every ten minutes, telling an operator why a page that looks like their own site was refused. Never logs request data other than the origin. */
function noteUnverifiableRefusal(req: RequestLike, origin: unknown, env: NodeJS.ProcessEnv = process.env): void {
  const now = Date.now();
  if (now - lastRefusalLogAt < REFUSAL_LOG_INTERVAL_MS) return;
  lastRefusalLogAt = now;
  const own = externalOriginOf(req, env);
  console.warn(
    `[cors] refused browser origin ${JSON.stringify(String(origin).slice(0, 120))}: it matches this server's host but its own https origin cannot be established ` +
      `(${own.origin === null ? own.reason : "scheme mismatch"}). Set CLIENT_URL or APP_URL to the public https origin, or have the reverse proxy send X-Forwarded-Proto.`,
  );
}

/**
 * Express CORS middleware. See the module comment for the rules; in short: no Origin header -> untouched; allowlisted -> its own
 * value plus credentials (and a 204 for a preflight); anything else -> no CORS headers, and a 403 for a preflight.
 */
export function createCorsMiddleware(getPolicy: () => CorsPolicy = currentCorsPolicy): RequestHandler {
  return (req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    if (origin === undefined) return next();

    // The answer depends on the Origin header, so no cache may serve one origin's answer to another.
    res.vary("Origin");

    const allowed = getPolicy().match(origin);
    const preflight = req.method === "OPTIONS" && typeof req.headers["access-control-request-method"] === "string";

    if (!allowed) {
      // A browser never preflights a same-origin request, so this exemption only matters to tooling; it uses the same full-origin test as sockets.
      if (preflight && !isOwnOrigin(origin, req)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }
      return next();
    }

    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (preflight) {
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
      const requested = req.headers["access-control-request-headers"];
      if (typeof requested === "string" && HEADER_TOKEN_LIST.test(requested)) {
        res.setHeader("Access-Control-Allow-Headers", requested);
        res.vary("Access-Control-Request-Headers");
      }
      res.setHeader("Content-Length", "0");
      res.status(204).end();
      return;
    }
    next();
  };
}

/**
 * The ONE origin decision for Socket.IO / engine.io, used by `allowRequest` and by the engine-level guard (realtime/engine-origin-guard).
 * Never throws: an engine hook that throws is an uncaught exception, and server/index.ts exits the process on those.
 */
export function socketOriginAllowed(req: IncomingMessage, origin: unknown, getPolicy: () => CorsPolicy = currentCorsPolicy): boolean {
  try {
    const verdict = originVerdict(req, origin, getPolicy);
    if (!verdict.allowed && verdict.unverifiable) noteUnverifiableRefusal(req, origin);
    return verdict.allowed;
  } catch {
    return false;
  }
}

/**
 * Options for `new Server(httpServer, {...})` from socket.io, shared by the DM and notification servers.
 *
 * `cors` answers the polling transport's CORS check from the allowlist (never `true`, never a reflection). `allowRequest` decides the first
 * request of every session (engine.io does not consult it for requests that carry a sid; the guard installed by socket-server.ts covers those).
 * A request with no Origin header is a non-browser client and proceeds to the namespace's token authentication, which refuses it unless it
 * presents a verified credential. The first argument of the callback is always a string or null: engine.io serializes anything else into a
 * Buffer on an upgrade and throws inside the `upgrade` listener.
 */
export function socketIoOriginOptions(getPolicy: () => CorsPolicy = currentCorsPolicy) {
  return {
    cors: {
      origin: (origin: string | undefined, callback: (error: Error | null, allow?: string | false) => void) => {
        callback(null, getPolicy().match(origin) ?? false);
      },
      credentials: true,
    },
    allowRequest: (req: IncomingMessage, callback: (error: string | null | undefined, success: boolean) => void) => {
      const origin = req.headers.origin;
      if (origin === undefined) return callback(null, true);
      return socketOriginAllowed(req, origin, getPolicy) ? callback(null, true) : callback("origin not allowed", false);
    },
  };
}
