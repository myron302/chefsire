import { io, Socket } from "socket.io-client";

let dmSocket: Socket | null = null;

export function getDmSocket(userId: string) {
  if (dmSocket) return dmSocket;
  dmSocket = io("/dm", {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: { userId }, // replace with token-based auth if you have it
  });
  return dmSocket;
}

export function closeDmSocket() {
  if (dmSocket) {
    dmSocket.close();
    dmSocket = null;
  }
}
