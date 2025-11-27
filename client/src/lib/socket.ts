import { io, Socket } from "socket.io-client";

let dmSocket: Socket | null = null;
let notificationSocket: Socket | null = null;

export function getDmSocket(userId: string) {
  if (dmSocket) return dmSocket;
  dmSocket = io("/dm", {
    path: "/socket.io",
    transports: ["polling", "websocket"], // Try polling first for Passenger/Plesk compatibility
    withCredentials: true,
    auth: { userId },
    reconnectionDelayMax: 10000,
    reconnectionAttempts: 5,
  });
  return dmSocket;
}

export function closeDmSocket() {
  if (dmSocket) {
    dmSocket.close();
    dmSocket = null;
  }
}

export function getNotificationSocket(userId: string) {
  if (notificationSocket) return notificationSocket;
  notificationSocket = io("/notifications", {
    path: "/socket.io",
    transports: ["polling", "websocket"], // Try polling first for Passenger/Plesk compatibility
    withCredentials: true,
    auth: { userId },
    reconnectionDelayMax: 10000,
    reconnectionAttempts: 5,
  });
  return notificationSocket;
}

export function closeNotificationSocket() {
  if (notificationSocket) {
    notificationSocket.close();
    notificationSocket = null;
  }
}

// Helper to connect all sockets for a user
export function connectAllSockets(userId: string) {
  getDmSocket(userId);
  getNotificationSocket(userId);
}

// Helper to close all sockets
export function closeAllSockets() {
  closeDmSocket();
  closeNotificationSocket();
}
