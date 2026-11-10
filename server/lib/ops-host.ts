import path from "node:path";
import type { Request, RequestHandler } from "express";

/**
 * The boundary between the customer site (chefsire.com) and the staff portal (ops.chefsire.com), which run in the
 * same server process.
 *
 * - The staff APIs (/api/ops/*) answer only on the ops host. On every other host they are a plain 404.
 * - The ops host answers only the staff APIs, the staff portal page and its static assets. Customer APIs, uploads and
 *   the customer app are a 404 there, so a member session is useless on that host.
 * - The ops host sends no CORS headers at all (the portal is same-origin) and strict security headers.
 *
 * The host is read from the Host header the reverse proxy (Plesk nginx) passes through, never from X-Forwarded-Host,
 * which a client can add. OPS_HOST overrides the host name; in production it defaults to ops.chefsire.com, elsewhere
 * the portal is off unless OPS_HOST is set.
 */
export function opsHost(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = (env.OPS_HOST ?? "").trim().toLowerCase();
  if (configured) return configured;
  return env.NODE_ENV === "production" ? "ops.chefsire.com" : null;
}

/** The request's host name (lower case, without port), from the Host header only. */
export function requestHostName(req: Pick<Request, "headers">): string {
  const raw = String(req.headers.host ?? "").trim().toLowerCase();
  if (raw.startsWith("[")) return raw.slice(0, raw.indexOf("]") + 1);
  return raw.split(":")[0];
}

export function isOpsRequest(req: Pick<Request, "headers">, env: NodeJS.ProcessEnv = process.env): boolean {
  const host = opsHost(env);
  return Boolean(host) && requestHostName(req) === host;
}

const isOpsApi = (p: string) => p === "/api/ops" || p.startsWith("/api/ops/");
/** Static files the portal page may load from the shared client build. */
const isOpsStatic = (p: string) => p.startsWith("/assets/") || p.startsWith("/images/");

export const OPS_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * Mounted first in app.ts. Marks ops requests (res.locals.opsHost) and enforces the boundary in both directions.
 * `clientDir` is the built client; the portal page is ops.html in it.
 */
/**
 * Apache (Plesk) hands every ops-host request to the app by rewriting it to OPS_FORWARD_PREFIX + the original path
 * (client/public/.htaccess), because otherwise it would answer page paths with the customer app's index.html. The
 * boundary restores the original path first, so every rule below sees exactly what the browser asked for.
 */
export const OPS_FORWARD_PREFIX = "/__ops-portal";

export function opsHostBoundary(getClientDir: () => string, env: () => NodeJS.ProcessEnv = () => process.env): RequestHandler {
  return (req, res, next) => {
    const onOps = isOpsRequest(req, env());
    res.locals.opsHost = onOps;
    if (onOps && (req.url === OPS_FORWARD_PREFIX || req.url.startsWith(`${OPS_FORWARD_PREFIX}/`) || req.url.startsWith(`${OPS_FORWARD_PREFIX}?`))) {
      req.url = req.url.slice(OPS_FORWARD_PREFIX.length) || "/";
      if (req.url.startsWith("?")) req.url = `/${req.url}`;
      if (!req.url.startsWith("/")) req.url = `/${req.url}`;
    }
    const p = req.path;
    if (!onOps) {
      // The staff portal and its page don't exist on the customer site.
      if (isOpsApi(p) || p === "/ops.html") {
        res.status(404).json({ error: "API endpoint not found" });
        return;
      }
      next();
      return;
    }
    for (const [name, value] of Object.entries(OPS_SECURITY_HEADERS)) res.setHeader(name, value);
    if (req.method === "OPTIONS") {
      // No cross-origin access to the portal, so there is nothing to preflight.
      res.status(403).end();
      return;
    }
    if (isOpsApi(p) || p === "/healthz") {
      next();
      return;
    }
    if (isOpsStatic(p) && (req.method === "GET" || req.method === "HEAD")) {
      // Served here, never passed on: a missing asset must be a 404, not the customer app's page fallback.
      const dir = getClientDir();
      // Only plain paths inside /assets or /images (no dot segments that could land on another file).
      if (!dir || path.posix.normalize(p) !== p || /%2e|\\/i.test(req.originalUrl ?? "")) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (p.startsWith("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.sendFile(p.slice(1), { root: dir, dotfiles: "deny" }, (error) => {
        if (error && !res.headersSent) {
          res.removeHeader("Cache-Control");
          res.status(404).json({ error: "Not found" });
        }
      });
      return;
    }
    if (p.startsWith("/api/") || p === "/api" || p.startsWith("/uploads") || p === "/index.html") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Every other page path on the ops host is the portal app.
    const clientDir = getClientDir();
    if (!clientDir) {
      res.status(503).send("Staff portal is not built.");
      return;
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientDir, "ops.html"), (error) => {
      if (error && !res.headersSent) res.status(404).send("Staff portal is not built.");
    });
  };
}
