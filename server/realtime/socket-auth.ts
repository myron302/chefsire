// server/realtime/socket-auth.ts
/**
 * Authentication for ChefSire's Socket.IO transports.
 *
 * Both realtime namespaces used to take identity from whatever the client said it was:
 *
 *   socket.handshake.auth.userId || socket.handshake.headers["x-user-id"]
 *
 * No signature, no token, no verification. Anyone who could open a socket could open it *as
 * anybody* — join another user's notification room and read their notifications, or act inside a
 * DM thread as a participant they are not. The membership checks in the DM namespace were sound;
 * they were simply being asked about the wrong person.
 *
 * Identity now comes from the same cryptographically verified credential HTTP uses. There is one
 * verifier (`verifyAuthToken` from Security Repair 1B), so the socket layer and the HTTP layer
 * cannot disagree about the secret, the algorithm, the token format or expiry. This module reads
 * no secret of its own and defines no fallback.
 *
 * A socket is also not allowed to outlive the credential that opened it. HTTP re-checks the token
 * on every request, so expiry takes effect there by itself; a WebSocket is authenticated once and
 * then held open, so without an explicit boundary a client that connected a second before `exp`
 * would keep receiving private notifications and acting in DM threads indefinitely. The authorized
 * lifetime of a socket therefore ends at the verified `exp` of its own token: at that moment the
 * server disconnects it, which drops every room it was in and ends every authenticated action it
 * could perform. Enforcement lives here, in the shared middleware, so both namespaces — and any
 * namespace added later — inherit the same rule rather than each scheduling their own.
 */
import type { Socket } from "socket.io";
import { verifyAuthToken } from "../lib/jwt-config";

/** The cookie ChefSire's login route sets. It is httpOnly, so the browser sends it, not the app. */
export const AUTH_TOKEN_COOKIE = "auth_token";

/** Server-side socket state. The only identity any realtime handler may act on. */
export interface AuthenticatedSocketData {
  /** The `id` claim of a verified token. Never a client-supplied field. */
  userId: string;
  /**
   * When this socket's authorization ends, in epoch milliseconds: the verified `exp` claim of the
   * token that opened it, and nothing else. The raw token is deliberately not kept — the realtime
   * layer needs the boundary, not the credential.
   */
  authExpiresAt: number;
}

/** Emitted once, immediately before an expiry disconnect, so a client can tell why it was closed. */
export const AUTH_EXPIRED_EVENT = "auth_expired";

/** Parse a raw `Cookie:` header. Values are percent-decoded; a malformed value is skipped. */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue; // first occurrence wins, as in cookie-parser
    const raw = part.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

/**
 * Find the credential on a handshake, in the same order `server/middleware/auth.ts` reads it for
 * HTTP: the cookie first, then an explicitly supplied token.
 *
 * `auth.token` is Socket.IO's own field and is how a non-browser client (or a future client that
 * holds a token itself) presents one. Deliberately absent from this list: anything that names a
 * user rather than proving one — `auth.userId`, `x-user-id`, and query-string identity. A token is
 * never read from the query string either, because URLs get logged by proxies.
 */
export function tokenFromHandshake(socket: Socket): string | null {
  const handshake = socket.handshake;

  const cookies = parseCookieHeader(handshake.headers?.cookie);
  const fromCookie = cookies[AUTH_TOKEN_COOKIE];
  if (typeof fromCookie === "string" && fromCookie.trim()) return fromCookie.trim();

  const fromAuth = (handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof fromAuth === "string" && fromAuth.trim()) return fromAuth.trim();

  const header = handshake.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const bearer = header.slice(7).trim();
    if (bearer) return bearer;
  }

  return null;
}

/**
 * The refusal handed to Socket.IO. Deliberately uniform and contentless: a client learns that it
 * is not authenticated, never whether the token was missing, malformed, expired or signed with the
 * wrong key, and never anything about the token's contents or the signing configuration.
 */
function unauthorized(): Error {
  const error = new Error("unauthorized");
  (error as Error & { data?: unknown }).data = { code: "unauthorized" };
  return error;
}

/** Node refuses a `setTimeout` delay above this and fires it immediately instead. */
const MAX_TIMER_DELAY_MS = 2_147_483_647; // ~24.8 days

/**
 * Live expiry timers, keyed by socket. A WeakMap rather than a field on `socket.data` so the
 * handle stays out of the data every handler reads, and so nothing here keeps a socket alive.
 */
const expiryTimers = new WeakMap<Socket, NodeJS.Timeout>();

/** How many expiry timers are currently armed. Exposed so tests can prove none are leaked. */
let armedTimers = 0;
export function armedAuthExpiryTimerCount(): number {
  return armedTimers;
}

/** Cancel a socket's expiry timer, if it has one. Safe to call repeatedly. */
export function clearAuthExpiryTimer(socket: Socket): void {
  const timer = expiryTimers.get(socket);
  if (!timer) return;
  clearTimeout(timer);
  expiryTimers.delete(socket);
  armedTimers -= 1;
}

/**
 * The verified expiry, in epoch milliseconds, or `null` if the token does not carry a usable one.
 *
 * The claims passed in have already been through `verifyAuthToken`, so this reads a value that
 * survived signature, algorithm and expiry verification. Nothing here decodes a token itself, and
 * no client-supplied expiry is consulted.
 */
export function verifiedExpiryMs(claims: { exp?: unknown }): number | null {
  const exp = claims?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0) return null;
  const asMillis = exp * 1000;
  if (!Number.isSafeInteger(Math.trunc(asMillis))) return null;
  return asMillis;
}

/**
 * End a socket's authorized life: tell it why in one word, then disconnect.
 *
 * Disconnecting is what makes this airtight rather than piecemeal — Socket.IO removes the socket
 * from every room as it goes, so notification delivery and DM broadcasts stop together, and no
 * further event from that connection can reach a handler. The client is told `auth_expired` and
 * nothing more: not when the token expired, not what it contained.
 */
function terminateExpiredSocket(socket: Socket): void {
  clearAuthExpiryTimer(socket);
  try {
    socket.emit(AUTH_EXPIRED_EVENT, { code: "auth_expired" });
  } catch {
    // A transport already going away is not a problem worth reporting.
  }
  try {
    socket.disconnect(true);
  } catch {
    // Ditto.
  }
  // Defensive: if the namespace connection had not finished being set up, `disconnect()` is a
  // no-op, so close the underlying transport directly rather than leave it open.
  if (socket.connected === false) {
    try {
      (socket as unknown as { client?: { conn?: { close?: () => void } } }).client?.conn?.close?.();
    } catch {
      // Nothing further to do.
    }
  }
}

/**
 * Arm (or re-arm) the disconnect timer for a socket.
 *
 * Delays longer than Node can hold are scheduled in chunks: each wake re-reads the stored
 * boundary and either re-arms for what is left or terminates. That also means a very long-lived
 * token cannot wrap around into an immediate — or a never — disconnect.
 */
function armAuthExpiryTimer(socket: Socket): void {
  // Always clear first, so a connection can never accumulate two timers.
  clearAuthExpiryTimer(socket);

  const remaining = (socket.data as AuthenticatedSocketData).authExpiresAt - Date.now();
  if (remaining <= 0) {
    terminateExpiredSocket(socket);
    return;
  }

  const timer = setTimeout(() => {
    expiryTimers.delete(socket);
    armedTimers -= 1;
    const left = (socket.data as AuthenticatedSocketData).authExpiresAt - Date.now();
    if (left > 0) {
      armAuthExpiryTimer(socket); // a chunked wake: more of the token's life remains
      return;
    }
    terminateExpiredSocket(socket);
  }, Math.min(remaining, MAX_TIMER_DELAY_MS));

  // The timer must not be the reason the process stays alive; the listening server is.
  timer.unref?.();

  expiryTimers.set(socket, timer);
  armedTimers += 1;
}

/**
 * Namespace middleware: verify the credential, pin the authenticated id and its expiry to
 * server-side socket state, and schedule the socket's end at that expiry. A connection that
 * reaches a handler has been authenticated; one that has not is refused before it joins any room
 * or receives any event.
 */
export function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
  const token = tokenFromHandshake(socket);
  if (!token) return next(unauthorized());

  let claims: { id?: unknown; exp?: unknown };
  try {
    claims = verifyAuthToken(token);
  } catch {
    // Expired, tampered, wrong secret, malformed, wrong algorithm — all one answer.
    return next(unauthorized());
  }

  const userId = typeof claims?.id === "string" ? claims.id.trim() : "";
  if (!userId) return next(unauthorized());

  // A socket must have an end. ChefSire's auth tokens always carry a seven-day `exp` (Security
  // Repair 1B), so a token without a usable one is not a token this transport issued — and
  // accepting it would create a connection authorized forever. Refused, like any other bad
  // credential. This is a socket-specific requirement; the HTTP verifier's contract is unchanged,
  // because HTTP re-checks the credential on every request and needs no such boundary.
  const authExpiresAt = verifiedExpiryMs(claims);
  if (authExpiresAt === null) return next(unauthorized());
  if (authExpiresAt <= Date.now()) return next(unauthorized());

  const data = socket.data as AuthenticatedSocketData;
  data.userId = userId;
  data.authExpiresAt = authExpiresAt;

  // The socket's authorization now has a hard end. If it disconnects on its own first, the timer
  // goes with it rather than being left to hold the closure.
  socket.on("disconnect", () => clearAuthExpiryTimer(socket));
  armAuthExpiryTimer(socket);

  next();
}

/**
 * The authenticated user id for a socket that has passed `authenticateSocket`.
 *
 * Handlers call this instead of re-reading the handshake, so there is no second place where a
 * client-supplied value could creep back in as identity. It throws rather than returning a blank
 * id, because a handler running without an authenticated socket is a wiring bug, not a request to
 * fall back to something weaker.
 */
export function socketUserId(socket: Socket): string {
  const userId = (socket.data as Partial<AuthenticatedSocketData> | undefined)?.userId;
  if (typeof userId !== "string" || !userId) {
    throw new Error("socket is not authenticated");
  }
  return userId;
}
