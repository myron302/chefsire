import { io, Socket } from "socket.io-client";

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
 */

let dmSocket: Socket | null = null;
let notificationSocket: Socket | null = null;

function connect(namespace: string, optionalToken?: string): Socket {
  return io(namespace, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    // Sends the httpOnly auth cookie on the handshake — and on every reconnect handshake, so a
    // reconnection re-authenticates against the credential that is valid *now* rather than
    // resuming on a previously granted identity.
    withCredentials: true,
    ...(optionalToken ? { auth: { token: optionalToken } } : {}),
  });
}

export function getDmSocket(optionalToken?: string): Socket {
  if (dmSocket) return dmSocket;
  dmSocket = connect("/dm", optionalToken);
  return dmSocket;
}

export function closeDmSocket() {
  if (dmSocket) {
    dmSocket.close();
    dmSocket = null;
  }
}

export function getNotificationSocket(optionalToken?: string): Socket {
  if (notificationSocket) return notificationSocket;
  notificationSocket = connect("/notifications", optionalToken);
  return notificationSocket;
}

export function closeNotificationSocket() {
  if (notificationSocket) {
    notificationSocket.close();
    notificationSocket = null;
  }
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
  closeDmSocket();
  closeNotificationSocket();
}
