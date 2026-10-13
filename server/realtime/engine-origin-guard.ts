// server/realtime/engine-origin-guard.ts
import { ServerResponse } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

/**
 * An engine.io middleware that applies ONE origin decision to EVERY engine request that carries an `Origin` header.
 *
 * Why a middleware and not just `allowRequest`: engine.io consults `allowRequest` only for a request WITHOUT a `sid` -- the first polling GET or a
 * direct WebSocket upgrade. A polling GET/POST that carries a sid, an OPTIONS preflight with a sid, and the polling->websocket probe upgrade
 * never reach it (verified against engine.io 6.6.4: server.js verify(), the sid branch falls through without calling it). So a policy that lives
 * only in `allowRequest` decides once, for the first request, and nothing afterwards; this runs before `verify()` for all of them. The sid is a
 * 96-bit secret, which bounds the practical exposure, but "every Origin-bearing request is subject to the same decision" is the property worth having.
 *
 * Statuses the client sees: polling and preflights -> 403 JSON in engine.io's own shape (`{"code":4,"message":"origin not allowed"}`) with no
 * CORS headers; a WebSocket upgrade -> 403 written to the raw socket. (engine.io's own refusal of an upgrade is always a 400, and a middleware
 * that answers an upgrade through `res` gets its connection destroyed with no response at all, because the upgrade's `res` is engine.io's
 * private WebSocketResponse whose writeHead() is a no-op and whose end() destroys the socket.)
 *
 * The decision function must not throw; if it does, the request is refused, because an exception here would be uncaught in the `upgrade`
 * listener and server/index.ts exits the process on uncaught exceptions.
 *
 * No Origin header means the request is not a browser CORS/WebSocket request (a same-origin GET, a native client, curl): it proceeds to the
 * namespace's token authentication, which is unchanged.
 */
export type OriginDecision = (req: IncomingMessage, origin: string) => boolean;

const DENIED_BODY = JSON.stringify({ code: 4, message: "origin not allowed" });
const noop = () => undefined;
/** engine.io's private WebSocketResponse: only the raw socket is of interest. */
type UpgradeResponse = { socket?: Duplex };

export function engineOriginGuard(isAllowed: OriginDecision, onDeny?: (req: IncomingMessage, origin: string) => void) {
  return (req: IncomingMessage, res: ServerResponse | UpgradeResponse, next: (error?: Error) => void): void => {
    const origin = req.headers.origin;
    if (origin === undefined) return next();

    let allowed = false;
    try {
      allowed = typeof origin === "string" && isAllowed(req, origin);
    } catch {
      allowed = false;
    }
    if (allowed) return next();

    try {
      onDeny?.(req, String(origin));
    } catch {
      /* logging must never change the answer */
    }

    if (res instanceof ServerResponse) {
      if (!res.headersSent) {
        res.writeHead(403, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(DENIED_BODY), "Cache-Control": "no-store" });
      }
      res.end(DENIED_BODY);
      return;
    }

    const socket = res.socket;
    if (socket && socket.writable) {
      socket.on("error", noop);
      socket.once("finish", () => socket.destroy());
      socket.end(
        "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Type: application/json\r\n" +
          `Content-Length: ${Buffer.byteLength(DENIED_BODY)}\r\n\r\n${DENIED_BODY}`,
      );
    } else {
      socket?.destroy();
    }
  };
}

/** Install the guard on a Socket.IO server's engine. Fails loudly (at boot) if there is no engine to guard, instead of silently guarding nothing. */
export function installEngineOriginGuard(
  io: { engine?: { use(middleware: (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => void): void } },
  isAllowed: OriginDecision,
  onDeny?: (req: IncomingMessage, origin: string) => void,
): void {
  if (!io.engine || typeof io.engine.use !== "function") {
    throw new Error("socket.io engine is not attached yet; the origin guard must be installed on an attached server");
  }
  io.engine.use(engineOriginGuard(isAllowed, onDeny));
}
