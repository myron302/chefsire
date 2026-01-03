// client/src/lib/socket.ts
import { io, type Socket } from "socket.io-client";

let notifSocket: Socket | null = null;
let currentUserId: string | null = null;

export function getNotificationSocket(userId: string): Socket {
  // Reuse if already connected for this user
  if (notifSocket && currentUserId === userId) return notifSocket;

  // Cleanup old socket if user changed
  if (notifSocket) {
    try {
      notifSocket.disconnect();
    } catch {}
    notifSocket = null;
  }

  currentUserId = userId;

  const baseUrl =
    (import.meta as any).env?.VITE_SOCKET_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  // IMPORTANT: Your server uses namespace "/notifications"
  notifSocket = io(`${baseUrl}/notifications`, {
    path: "/socket.io",

    // IMPORTANT: start with polling so it works even if WebSocket upgrade is blocked
    transports: ["polling", "websocket"],

    withCredentials: true,
    auth: { userId },

    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  return notifSocket;
}
