// server/routes/square-connection.ts
import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../middleware";
import { squareConnectionLimiter } from "../middleware/rate-limit";
import { squareConnections } from "../lib/square-connection";
import { SquareCredentialDiscardBlockedError, type SquareConnectionService } from "../lib/square-connection-service";

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
  const origin = req.get("origin");
  if (origin) {
    const allowed = new Set<string>();
    for (const configured of [process.env.CLIENT_URL, process.env.APP_BASE_URL]) {
      try {
        if (configured?.trim()) allowed.add(new URL(configured.trim()).origin);
      } catch {
        // An unparsable configured URL simply allows nothing extra.
      }
    }
    const host = req.get("host");
    if (host) allowed.add(`${req.protocol}://${host}`);
    let requestOrigin: string;
    try {
      requestOrigin = new URL(origin).origin;
    } catch {
      return res.status(403).json({ ok: false, error: "Request origin is not allowed" });
    }
    if (!allowed.has(requestOrigin)) return res.status(403).json({ ok: false, error: "Request origin is not allowed" });
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
        return res.status(409).json({ ok: false, code: "connection_in_use", error: "Square can't be disconnected right now because a customer checkout on it couldn't be closed. Try again in a moment." });
      }
      console.error("Square disconnect error:", error instanceof Error ? error.name : "unknown");
      res.status(500).json({ ok: false, error: "Failed to disconnect Square" });
    }
  });

  return router;
}

export default createSquareConnectionRouter(squareConnections);
