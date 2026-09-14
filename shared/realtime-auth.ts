// shared/realtime-auth.ts
/**
 * The contract between ChefSire's realtime authentication middleware and the clients that connect
 * to it. Both sides import these, so the wire shape cannot drift out from under either one.
 *
 * The whole point of this contract is that it says *nothing useful to an attacker*. A rejected
 * handshake reports one category — "you are not authenticated" — whether the token was missing,
 * malformed, expired, tampered with, signed with the wrong key, or carried no usable expiry. The
 * client needs to know only that the failure is about credentials and is terminal for that socket;
 * it never needs to know which of those it was, and neither does anyone watching.
 */

/**
 * The `code` carried on a rejected handshake (`err.data.code` on the client's `connect_error`).
 *
 * One value, deliberately. Adding a second — `expired`, say, or `malformed` — would turn the
 * handshake into an oracle that tells a caller which part of a forged credential to fix.
 */
export const SOCKET_AUTH_ERROR_CODE = "unauthorized";

/** The message on a rejected handshake. Same single category, in words. */
export const SOCKET_AUTH_ERROR_MESSAGE = "unauthorized";

/** Emitted once, immediately before the server disconnects a socket whose token has expired. */
export const SOCKET_AUTH_EXPIRED_EVENT = "auth_expired";

/** The `code` carried by that event. Carries no timestamp and no claims. */
export const SOCKET_AUTH_EXPIRED_CODE = "auth_expired";

/**
 * Does this `connect_error` mean the server refused the credential?
 *
 * Socket.IO reports two very different things through `connect_error`: a middleware rejection,
 * which is final for that socket, and an ordinary transport failure, which the client will retry
 * on its own. `socket.active` is Socket.IO's own discriminator — false means "the connection was
 * denied by the server" — and the auth code above confirms the denial came from ChefSire's auth
 * middleware rather than from anything else that might one day reject a handshake.
 *
 * Treating only this case as terminal is what keeps a flaky network from being mistaken for a bad
 * password, and a bad password from being retried forever.
 */
export function isTerminalSocketAuthError(socketIsActive: boolean, error: unknown): boolean {
  // Socket.IO hands `connect_error` an Error with `data` attached at runtime, so this is read
  // defensively rather than typed: the payload is whatever the server chose to send.
  const data = (error as { data?: unknown } | null | undefined)?.data;
  const code = (data as { code?: unknown } | null | undefined)?.code;
  if (code === SOCKET_AUTH_ERROR_CODE) return true;
  // No recognised code, but Socket.IO says the server denied the connection outright: the socket
  // will never retry by itself, so caching it would cache a corpse.
  return socketIsActive === false;
}
