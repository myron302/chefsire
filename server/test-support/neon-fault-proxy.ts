/**
 * Deterministic database fault injection for tests (Stability Phase 2C).
 *
 * ChefSire's pool is @neondatabase/serverless, which speaks the Postgres wire protocol over a WebSocket. This module is the same bridge
 * Neon's own `wsproxy` provides for local development -- a WebSocket server that pipes each connection to a plain TCP Postgres -- with a
 * switch that injects the failures production sees: refuse, accept-and-say-nothing (a black hole), delay the handshake, or cut every live connection.
 * Test only: it binds to loopback and is never imported by server code.
 */
import { createServer, type Server } from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import { neonConfig } from "@neondatabase/serverless";

export type FaultMode = "pass" | "refuse" | "blackhole" | "drop";

export type FaultProxy = {
  port: number;
  mode: FaultMode;
  /** Milliseconds to wait before forwarding a new connection (only in `pass` mode). */
  delayMs: number;
  /**
   * Forward client->server but swallow server->client: the "COMMIT was sent and executed, the reply never arrived" case. Applies to live
   * connections immediately and can be toggled mid-connection.
   */
  muteReplies: boolean;
  /** Count of WebSocket connections the proxy has accepted (retry-storm evidence). */
  accepted: number;
  /** Sever every live connection now, like a Neon suspend or a network partition. */
  cutAll(): void;
  close(): Promise<void>;
};

export async function startFaultProxy(target: { host: string; port: number }): Promise<FaultProxy> {
  const http: Server = createServer((_req, res) => { res.statusCode = 426; res.end(); });
  const wss = new WebSocketServer({ noServer: true });
  const live = new Set<{ ws: WebSocket; tcp?: net.Socket }>();
  const proxy: FaultProxy = {
    port: 0, mode: "pass", delayMs: 0, accepted: 0, muteReplies: false,
    cutAll() { for (const c of Array.from(live)) { c.tcp?.destroy(); c.ws.terminate(); } live.clear(); },
    close: async () => { proxy.cutAll(); wss.close(); await new Promise<void>((r) => { http.close(() => r()); http.closeAllConnections?.(); }); },
  };
  http.on("upgrade", (req, socket, head) => {
    proxy.accepted += 1;
    if (proxy.mode === "refuse") { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn: { ws: WebSocket; tcp?: net.Socket } = { ws };
      live.add(conn);
      ws.on("close", () => live.delete(conn));
      ws.on("error", () => {});
      if (proxy.mode === "drop") { ws.terminate(); return; }
      if (proxy.mode === "blackhole") return; // accepted, then silence
      // Frames that arrive before the (possibly delayed) TCP leg is up are buffered, never dropped.
      const buffered: Buffer[] = [];
      let tcp: net.Socket | undefined;
      let open = false;
      ws.on("message", (d) => { const b = Buffer.isBuffer(d) ? d : Buffer.concat(d as Buffer[]); open ? tcp!.write(b) : buffered.push(b); });
      ws.on("close", () => tcp?.destroy());
      const connect = () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        tcp = net.connect(target.port, target.host);
        conn.tcp = tcp;
        tcp.on("connect", () => { open = true; for (const b of buffered) tcp!.write(b); buffered.length = 0; });
        tcp.on("data", (d) => { if (!proxy.muteReplies && ws.readyState === WebSocket.OPEN) ws.send(d); });
        tcp.on("close", () => ws.terminate());
        tcp.on("error", () => ws.terminate());
      };
      if (proxy.delayMs > 0) setTimeout(connect, proxy.delayMs); else connect();
    });
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  proxy.port = (http.address() as AddressInfo).port;
  return proxy;
}

/** Point the Neon driver at the proxy (plain ws, no TLS pipeline). Call BEFORE `server/db` is imported. */
export function useNeonFaultProxy(port: number) {
  neonConfig.webSocketConstructor = WebSocket as never;
  neonConfig.wsProxy = () => `127.0.0.1:${port}/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}
