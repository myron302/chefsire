// server/index.ts
// Starts the API with automatic port fallback and DM realtime attached.

import "dotenv/config";
import http from "http";
import app from "./app";
import { attachDmRealtime } from "./realtime/dmSocket";

const envPort = Number(process.env.PORT || 3001);

// Candidate ports: try env, then nearby and common alternates
const candidates = Array.from(
  new Set<number>([envPort, envPort + 1, envPort + 2, 4001, 4002, 5001, 8080])
).filter((p) => Number.isFinite(p) && p > 0);

function createServer() {
  const server = http.createServer(app);
  attachDmRealtime(server); // keep DMs attached
  return server;
}

function listenOn(server: http.Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    const onError = (err: any) => {
      // Do NOT call server.close() here; server may not be listening yet.
      reject(err);
    };
    server.once("error", onError);
    server.listen(port, () => {
      server.off("error", onError);
      console.log(
        `[ChefSire] API listening on port ${port} (NODE_ENV=${process.env.NODE_ENV || "development"})`
      );
      resolve();
    });
  });
}

(async () => {
  for (const port of candidates) {
    const server = createServer();
    try {
      await listenOn(server, port);
      return; // success
    } catch (err: any) {
      const code = err?.code || "";
      console.warn(`[ChefSire] Port ${port} unavailable (${code || err?.message || err}); trying next…`);
      // try next candidate
    }
  }
  console.error("[ChefSire] No available ports from candidates:", candidates.join(", "));
  process.exit(1);
})();
