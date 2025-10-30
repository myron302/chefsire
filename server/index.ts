// server/index.ts
// Deterministic startup for Plesk: prefer HOST=0.0.0.0 and a non-3001 PORT.
// Single-host retry (PORT, PORT+1, PORT+2) with 1s timeout per attempt.

import "dotenv/config";
import http from "http";
import app from "./app";
import { attachDmRealtime } from "./realtime/dmSocket";

const HOST = (process.env.HOST || "0.0.0.0").trim();
const BASE_PORT = Number(process.env.PORT || 4002); // ✅ default away from 3001
const PORTS = [BASE_PORT, BASE_PORT + 1, BASE_PORT + 2].filter(
  (p) => Number.isFinite(p) && p > 0
);

function createServer() {
  const server = http.createServer(app);
  try {
    attachDmRealtime(server);
  } catch (e) {
    console.warn("[ChefSire] attachDmRealtime warning:", (e as Error)?.message);
  }
  return server;
}

function listenWithTimeout(server: http.Server, host: string, port: number) {
  return new Promise<{ host: string; port: number }>((resolve, reject) => {
    let settled = false;

    const onError = (err: any) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      // do not call server.close(); it may not have bound yet
      reject(new Error("LISTEN_TIMEOUT"));
    }, 1000);

    server.once("error", onError);
    server.listen(port, host, () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      server.off("error", onError);
      resolve({ host, port });
    });
  });
}

(async () => {
  console.log(
    `[ChefSire] Starting… HOST=${HOST} | PORT candidates=${PORTS.join(", ")} | NODE_ENV=${process.env.NODE_ENV || "development"}`
  );

  for (const port of PORTS) {
    const server = createServer();
    process.stdout.write(`[ChefSire] Binding http://${HOST}:${port} … `);
    try {
      const bound = await listenWithTimeout(server, HOST, port);
      console.log("OK");
      console.log(`[ChefSire] API listening on http://${bound.host}:${bound.port}`);
      return;
    } catch (err: any) {
      console.log(`fail (${err?.code || err?.message || String(err)})`);
      // try next port
    }
  }

  console.error(
    `[ChefSire] Failed to bind on HOST=${HOST} using ports ${PORTS.join(", ")}. Set a free PORT in Plesk and restart.`
  );
  process.exit(1);
})();
