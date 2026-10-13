// server/routes/square-connection.ts
import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../middleware";
import { squareConnectionLimiter } from "../middleware/rate-limit";
import { squareConnections } from "../lib/square-connection";
import { SquareCredentialDiscardBlockedError, type SquareConnectionService } from "../lib/square-connection-service";
import { externalOriginOf, webOrigin } from "../lib/request-origin";

/** The authenticated user's id, as set by `requireAuth`. Never read from a request body, query or path. */
function currentUserId(req: Request): string {
  return (req.user as { id: string }).id;
}

/**
 * Square provider connection: the signed-in user's OWN connection, and nothing else.
 *
 * No request carries a connection, payment-method, merchant or user id. Every handler resolves the connection from the
 * authenticated user, so there is nothing to guess and no way to read or change anyone else's account. Responses carry
 * the safe view only: a state, two booleans and display names -- never a token, ciphertext, scope list or raw record.
 */

/**
 * State-changing requests must come from this application's own origin and be JSON. Browsers do not attach an
 * `application/json` body to a cross-site form post, and a cross-origin fetch needs a CORS preflight that the
 * configured origin policy refuses; an explicit Origin check closes the remaining gap for sessions that use a cookie.
 */
export function requireSameOriginJson(req: Request, res: Response, next: NextFunction) {
  if (!req.is("application/json")) {
    return res.status(415).json({ ok: false, error: "Expected a JSON request" });
  }
  // Presence, not truthiness: an empty `Origin:` header is still an Origin (a browser never sends one, so it is refused below), not "no Origin".
  const origin = req.headers.origin;
  if (origin !== undefined) {
    const allowed = new Set<string>();
    for (const configured of [process.env.CLIENT_URL, process.env.APP_BASE_URL]) {
      try {
        if (configured?.trim()) allowed.add(new URL(configured.trim()).origin);
      } catch {
        // An unparsable configured URL simply allows nothing extra.
      }
    }
    // This server's own full origin (scheme + host + port), reconstructed from the TLS state of the socket and -- only from a trusted proxy -- one
    // unambiguous X-Forwarded-Proto (lib/request-origin). It used to be `${req.protocol}://${host}`: Express reads the LEFTMOST forwarded value (the
    // client's own, behind Phusion Passenger) and falls back to "http" when a TLS-terminating proxy states nothing, which made an http page the
    // "own origin" of an https deployment. When the scheme cannot be established there is no derived origin and only CLIENT_URL/APP_BASE_URL admit one.
    const own = externalOriginOf(req);
    if (own.origin) allowed.add(own.origin);
    // A browser sends the canonical serialization; anything else (a path, a trailing slash, "null", a list) is not an Origin header it produced.
    const requestOrigin = webOrigin(origin);
    if (requestOrigin === null || requestOrigin !== origin || !allowed.has(requestOrigin)) {
      return res.status(403).json({ ok: false, error: "Request origin is not allowed" });
    }
  }
  return next();
}

export function createSquareConnectionRouter(service: SquareConnectionService) {
  const router = Router();

  router.get("/status", squareConnectionLimiter, requireAuth, async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      res.json({ ok: true, connection: await service.status(currentUserId(req)) });
    } catch (error) {
      console.error("Square connection status error:", error instanceof Error ? error.name : "unknown");
      res.status(500).json({ ok: false, error: "Failed to load Square connection" });
    }
  });

  /** Ask Square again now (e.g. after the provider fixed their location in Square). Same safe view. */
  router.post("/recheck", squareConnectionLimiter, requireAuth, requireSameOriginJson, async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      res.json({ ok: true, connection: await service.status(currentUserId(req), { force: true }) });
    } catch (error) {
      console.error("Square connection recheck error:", error instanceof Error ? error.name : "unknown");
      res.status(500).json({ ok: false, error: "Failed to check Square connection" });
    }
  });

  router.post("/disconnect", squareConnectionLimiter, requireAuth, requireSameOriginJson, async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const result = await service.disconnect(currentUserId(req));
      // `providerRevocation` says what happened at Square; `providerRevoked` is kept as its boolean form (true only for `revoked`).
      res.json({
        ok: true,
        changed: result.changed,
        providerRevocation: result.providerRevocation,
        providerRevoked: result.providerRevoked,
        connection: await service.status(currentUserId(req)),
      });
    } catch (error) {
      // Refused BEFORE anything was changed: something that depends on this connection could not be wound down while its credential still works.
      if (error instanceof SquareCredentialDiscardBlockedError) {
        return res.status(409).json({ ok: false, code: "connection_in_use", error: "Square can't be disconnected yet because an existing Catering checkout still needs to be closed or verified. Try again shortly." });
      }
      console.error("Square disconnect error:", error instanceof Error ? error.name : "unknown");
      res.status(500).json({ ok: false, error: "Failed to disconnect Square" });
    }
  });

  return router;
}

export default createSquareConnectionRouter(squareConnections);
