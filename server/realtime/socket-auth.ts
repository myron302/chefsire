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
 */
import type { Socket } from "socket.io";
import { verifyAuthToken } from "../lib/jwt-config";

/** The cookie ChefSire's login route sets. It is httpOnly, so the browser sends it, not the app. */
export const AUTH_TOKEN_COOKIE = "auth_token";

/** Server-side socket state. The only identity any realtime handler may act on. */
export interface AuthenticatedSocketData {
  /** The `id` claim of a verified token. Never a client-supplied field. */
  userId: string;
}

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

/**
 * Namespace middleware: verify the credential, then pin the authenticated id to server-side socket
 * state. A connection that reaches a handler has been authenticated; one that has not is refused
 * before it joins any room or receives any event.
 */
export function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
  const token = tokenFromHandshake(socket);
  if (!token) return next(unauthorized());

  let claims: { id?: unknown };
  try {
    claims = verifyAuthToken(token);
  } catch {
    // Expired, tampered, wrong secret, malformed, wrong algorithm — all one answer.
    return next(unauthorized());
  }

  const userId = typeof claims?.id === "string" ? claims.id.trim() : "";
  if (!userId) return next(unauthorized());

  (socket.data as AuthenticatedSocketData).userId = userId;
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
