import { io, Socket } from "socket.io-client";
import { isTerminalSocketAuthError } from "@shared/realtime-auth";

/**
 * Socket.IO connections for ChefSire's realtime transports.
 *
 * These sockets used to announce who they were:
 *
 *   io("/dm", { auth: { userId } })
 *
 * The server believed it. Identity is now proved, not asserted: the server verifies ChefSire's
 * ordinary JWT and takes the user id from the token's claims, exactly as the HTTP API does. No
 * user id is sent, and sending one would change nothing — the server does not read it.
 *
 * The token travels in the `auth_token` cookie, which is httpOnly and therefore unreadable from
 * JavaScript; `withCredentials: true` is what makes the browser attach it to the handshake. That
 * is also why the token is never placed in the connection URL: query strings end up in proxy and
 * server logs, and cookies do not.
 *
 * `optionalToken` exists for non-browser callers (tests, a native client) that hold a token
 * directly and cannot rely on a cookie jar. Browser code should leave it unset.
 *
 * ## Why sockets are cached, and when the cache must let go
 *
 * A socket that cannot authenticate is dead for good: Socket.IO will not retry a handshake the
 * server denied, and it does not become usable later just because the browser has since obtained a
 * valid cookie. Caching one is caching a corpse — every later caller would be handed the same
 * permanently disconnected instance instead of a connection that actually authenticates. So the
 * cache evicts an entry whenever that socket's credential is refused:
 *
 *   - at the handshake, as `connect_error` (no token, expired cookie, helper called before login);
 *   - after connecting, as the server's expiry disconnect.
 *
 * Everything else is left alone. An ordinary network or transport failure is Socket.IO's business,
 * and it will reconnect on its own; treating that as a credential problem would throw away a
 * perfectly good socket mid-blip.
 *
 * Eviction never retries. The failed attempt stays failed, and the NEXT helper call builds a fresh
 * instance with whatever credential is valid at that moment — so logging in after a rejected
 * connection works without a page refresh, and a rejected credential is never replayed at the
 * server in a loop.
 */

type SocketOptions = Parameters<typeof io>[1];

/** How a cache builds its sockets. Injected so the lifecycle can be driven against a real server. */
export type SocketConnector = (namespace: string, options: SocketOptions) => Socket;

export type SocketCache = {
  get(namespace: string, optionalToken?: string): Socket;
  close(namespace: string): void;
  closeAll(): void;
  /** The cached instance for a namespace, or null. Lets callers observe eviction. */
  peek(namespace: string): Socket | null;
};

/**
 * A namespace-keyed cache of authenticated sockets.
 *
 * This is the whole lifecycle in one place, and it is the real implementation the module-level
 * helpers below use — not a parallel one written for tests.
 */
export function createSocketCache(connector: SocketConnector): SocketCache {
  const sockets = new Map<string, Socket>();

  /**
   * Drop `socket` from the cache — but only if it is still the cached one.
   *
   * A dying socket's events can arrive after the app has already replaced it. Without this
   * identity check, a late `connect_error` from a socket nobody holds any more would evict the
   * live replacement, and the next caller would needlessly reconnect. Compare the instance, not
   * the namespace.
   */
  const evict = (namespace: string, socket: Socket) => {
    if (sockets.get(namespace) !== socket) return;
    sockets.delete(namespace);
  };

  const open = (namespace: string, optionalToken?: string): Socket => {
    const socket = connector(namespace, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      // Sends the httpOnly auth cookie on the handshake — and on every reconnect handshake, so a
      // reconnection re-authenticates against the credential that is valid *now* rather than
      // resuming on a previously granted identity.
      withCredentials: true,
      ...(optionalToken ? { auth: { token: optionalToken } } : {}),
    });

    socket.on("connect_error", (error: Error) => {
      // Only a refused credential is terminal. `isTerminalSocketAuthError` reads the server's
      // shared auth code and Socket.IO's own `active` flag; a transport failure satisfies neither,
      // keeps its place in the cache, and reconnects by itself.
      if (!isTerminalSocketAuthError(socket.active, error)) return;
      socket.close();
      evict(namespace, socket);
    });

    socket.on("disconnect", (reason: string) => {
      // "io server disconnect" is what the server sends when the socket's token expires (it emits
      // `auth_expired` first). Socket.IO will not reconnect on its own after this, so the instance
      // is forgotten rather than left cached and dead.
      if (reason !== "io server disconnect") return;
      socket.close();
      evict(namespace, socket);
    });

    return socket;
  };

  return {
    get(namespace, optionalToken) {
      const cached = sockets.get(namespace);
      if (cached) return cached;
      const socket = open(namespace, optionalToken);
      sockets.set(namespace, socket);
      return socket;
    },
    close(namespace) {
      const socket = sockets.get(namespace);
      if (!socket) return;
      sockets.delete(namespace);
      socket.close();
    },
    closeAll() {
      for (const namespace of Array.from(sockets.keys())) this.close(namespace);
    },
    peek(namespace) {
      return sockets.get(namespace) ?? null;
    },
  };
}

export const DM_NAMESPACE = "/dm";
export const NOTIFICATION_NAMESPACE = "/notifications";

const cache = createSocketCache((namespace, options) => io(namespace, options));

export function getDmSocket(optionalToken?: string): Socket {
  return cache.get(DM_NAMESPACE, optionalToken);
}

export function closeDmSocket() {
  cache.close(DM_NAMESPACE);
}

export function getNotificationSocket(optionalToken?: string): Socket {
  return cache.get(NOTIFICATION_NAMESPACE, optionalToken);
}

export function closeNotificationSocket() {
  cache.close(NOTIFICATION_NAMESPACE);
}

// Helper to connect all sockets for the signed-in user.
export function connectAllSockets(optionalToken?: string) {
  getDmSocket(optionalToken);
  getNotificationSocket(optionalToken);
}

/**
 * Close and forget every socket.
 *
 * Call this on logout. A socket authenticated as the previous user must not survive the session:
 * closing it also clears the cached instances, so the next `getDmSocket()` opens a fresh
 * connection and authenticates again with whatever credential exists at that moment. Reconnecting
 * an existing socket would not re-run this module's setup, which is precisely why logout closes
 * rather than merely disconnects.
 */
export function closeAllSockets() {
  cache.closeAll();
}
