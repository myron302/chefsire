// server/index.ts
// Robust startup with host/port fallback + 2s timeout per attempt.
// Keeps DM realtime attach intact.

import "dotenv/config";
import http from "http";
import app from "./app";
import { attachDmRealtime } from "./realtime/dmSocket";

const envPort = Number(process.env.PORT || 3001);

// Candidate ports: env, then nearby and common alternates
const PORTS = Array.from(
  new Set<number>([envPort, envPort + 1, envPort + 2, 4001, 4002, 5001, 8080])
).filter((p) => Number.isFinite(p) && p > 0);

// Candidate hosts: prefer 127.0.0.1 for Plesk reverse proxy
const HOSTS = Array.from(
  new Set<string>([process.env.HOST || "127.0.0.1", "0.0.0.0", "::"])
);

function createServer() {
  const server = http.createServer(app);
  try {
    attachDmRealtime(server); // ✅ DMs stay attached
  } catch (e) {
    console.warn("[ChefSire] attachDmRealtime failed (continuing):", (e as Error)?.message);
  }
  return server;
}

function listenOn(server: http.Server, host: string, port: number) {
  return new Promise<{ host: string; port: number }>((resolve, reject) => {
    let settled = false;

    const onError = (err: any) => {
      if (settled) return;
      settled = true;
      // do not call server.close(); it may not be listening yet
      reject(err);
    };

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("LISTEN_TIMEOUT"));
    }, 2000);

    server.once("error", onError);
    server.listen(port, host, () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.off("error", onError);
      resolve({ host, port });
    });
  });
}

(async () => {
  console.log(
    `[ChefSire] Startup candidates → hosts: ${HOSTS.join(", ")} | ports: ${PORTS.join(", ")}`
  );

  for (const port of PORTS) {
    for (const host of HOSTS) {
      const server = createServer();
      process.stdout.write(`[ChefSire] Trying ${host}:${port} ... `);
      try {
        const bound = await listenOn(server, host, port);
        console.log("OK");
        console.log(
          `[ChefSire] API listening on http://${bound.host}:${bound.port} (NODE_ENV=${process.env.NODE_ENV || "development"})`
        );
        return; // success
      } catch (err: any) {
        const code = err?.code || err?.message || String(err);
        console.log(`fail (${code})`);
        // try next host/port
      }
    }
  }

  console.error(
    "[ChefSire] No available host/port from candidates. Set PORT env var (e.g. 4002) and try again."
  );
  process.exit(1);
})();
