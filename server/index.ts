// server/index.ts
// Starts the API with automatic port fallback.
// Tries process.env.PORT (or 3001), then a small list of alternates.
// Keeps your DM realtime (attachDmRealtime) exactly as-is.

import "dotenv/config";
import http from "http";
import app from "./app";
import { attachDmRealtime } from "./realtime/dmSocket";

const envPort = Number(process.env.PORT || 3001);

// Build a de-duplicated candidate list.
// 1) Whatever PORT is set to (or 3001), then +1 and +2
// 2) Common alternates we’ve used before on this project
const candidates = Array.from(
  new Set<number>([
    envPort,
    envPort + 1,
    envPort + 2,
    4001,
    4002,
    5001,
    8080,
  ])
).filter((p) => Number.isFinite(p) && p > 0);

function createServer() {
  const server = http.createServer(app);
  attachDmRealtime(server); // ✅ keep DMs attached to whichever server instance we use
  return server;
}

function listenOnce(server: http.Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    const onError = (err: any) => {
      // Clean up this server instance if it failed to bind
      server.close().catch(() => {});
      reject(err);
    };

    server.once("error", onError);
    server.listen(port, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

(async () => {
  for (const port of candidates) {
    const server = createServer();
    try {
      await listenOnce(server, port);
      console.log(
        `[ChefSire] API listening on port ${port} (NODE_ENV=${process.env.NODE_ENV || "development"})`
      );
      // If we got here, we’re bound successfully; stop trying others.
      return;
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "EADDRINUSE" || code === "EACCES") {
        console.warn(
          `[ChefSire] Port ${port} unavailable (${code}). Trying next candidate…`
        );
        // loop continues to try next port
      } else {
        console.error(
          `[ChefSire] Failed to start on port ${port}:`,
          err?.message || err
        );
        // For unexpected errors, also try next candidate instead of bailing immediately
      }
    }
  }

  console.error(
    "[ChefSire] No available ports from candidates:",
    candidates.join(", ")
  );
  process.exit(1);
})();
